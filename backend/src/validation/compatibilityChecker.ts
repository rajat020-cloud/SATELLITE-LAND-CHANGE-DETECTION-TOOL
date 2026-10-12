import {
  AnalysisConfig,
  LandChangeDataset,
  ValidationIssue,
  ValidationResult
} from '../types/landChange';
import { parseRawInput } from './inputParser';
import { validateAnalysisConfig, validateDatasetSchema } from './schemaValidator';

/**
 * Verifies cross-temporal compatibility between the 'before' and 'after' image slices:
 * - Matching width and height
 * - Matching alignmentId (shared coordinate grid)
 * - Matching coordinateSystem (if specified)
 * - Matching pixelWidthMeters and pixelHeightMeters
 * - Chronological date ordering warnings
 */
export function checkImageCompatibility(dataset: LandChangeDataset): {
  issues: ValidationIssue[];
  warnings: string[];
} {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];

  const { before, after } = dataset;

  if (before.width !== after.width || before.height !== after.height) {
    issues.push({
      field: 'after.dimensions',
      code: 'DIMENSION_MISMATCH',
      message: `Image dimension mismatch: 'before' is ${before.width}×${before.height} px, whereas 'after' is ${after.width}×${after.height} px. Both images must have identical grid dimensions.`
    });
  }

  if (before.alignmentId !== after.alignmentId) {
    issues.push({
      field: 'after.alignmentId',
      code: 'ALIGNMENT_MISMATCH',
      message: `Incompatible alignment metadata: 'before.alignmentId' ("${before.alignmentId}") does not match 'after.alignmentId' ("${after.alignmentId}"). Matching pixel dimensions alone do not guarantee spatial registration.`
    });
  }

  if (
    before.coordinateSystem &&
    after.coordinateSystem &&
    before.coordinateSystem !== after.coordinateSystem
  ) {
    issues.push({
      field: 'after.coordinateSystem',
      code: 'COORDINATE_SYSTEM_MISMATCH',
      message: `Incompatible coordinate reference systems: 'before' uses "${before.coordinateSystem}" and 'after' uses "${after.coordinateSystem}".`
    });
  }

  if (
    Math.abs(before.pixelWidthMeters - after.pixelWidthMeters) > 1e-9 ||
    Math.abs(before.pixelHeightMeters - after.pixelHeightMeters) > 1e-9
  ) {
    issues.push({
      field: 'after.pixelDimensions',
      code: 'PIXEL_RESOLUTION_MISMATCH',
      message: `Incompatible pixel dimensions: 'before' is ${before.pixelWidthMeters}m × ${before.pixelHeightMeters}m, whereas 'after' is ${after.pixelWidthMeters}m × ${after.pixelHeightMeters}m.`
    });
  }

  if (before.date === after.date) {
    warnings.push(
      `Both 'before' and 'after' slices carry the same timestamp ("${before.date}"). Verify whether you intended to compare two distinct acquisition dates.`
    );
  } else {
    const beforeTime = Date.parse(before.date);
    const afterTime = Date.parse(after.date);
    if (!Number.isNaN(beforeTime) && !Number.isNaN(afterTime) && afterTime < beforeTime) {
      warnings.push(
        `The 'after' date (${after.date}) precedes the 'before' date (${before.date}) chronologically.`
      );
    }
  }

  if (dataset.origin.toLowerCase() !== 'synthetic') {
    warnings.push(
      `Dataset origin is declared as "${dataset.origin}". Ensure input reflectance bands have been radiometrically calibrated and co-registered prior to NDVI change analysis.`
    );
  } else {
    warnings.push(
      'Synthetic dataset: pixel arrays represent deterministic simulated reflectance values, not actual satellite sensor imagery.'
    );
  }

  return { issues, warnings };
}

/**
 * Full validation pipeline combining input parsing, schema validation, and image compatibility checks.
 */
export function validateCompletePayload(
  rawPayload: unknown,
  requireConfigValidation = false
): {
  result: ValidationResult;
  dataset: LandChangeDataset | null;
  config: AnalysisConfig | null;
} {
  const { dataset: rawDataset, configInput, parseIssues } = parseRawInput(rawPayload);

  if (parseIssues.length > 0) {
    return {
      result: {
        valid: false,
        issues: parseIssues,
        warnings: []
      },
      dataset: null,
      config: null
    };
  }

  const { dataset, issues: schemaIssues } = validateDatasetSchema(rawDataset);
  const { config, issues: configIssues } = validateAnalysisConfig(configInput);

  const combinedIssues: ValidationIssue[] = [...schemaIssues];
  if (requireConfigValidation || configIssues.length > 0) {
    combinedIssues.push(...configIssues);
  }

  if (!dataset) {
    return {
      result: {
        valid: false,
        issues: combinedIssues,
        warnings: []
      },
      dataset: null,
      config
    };
  }

  const { issues: compatIssues, warnings } = checkImageCompatibility(dataset);
  combinedIssues.push(...compatIssues);

  // Additional sanity check on minComponentSize relative to total image pixels
  const totalPixels = dataset.before.width * dataset.before.height;
  if (config && config.minComponentSize > totalPixels) {
    combinedIssues.push({
      field: 'config.minComponentSize',
      code: 'INVALID_CONFIGURATION',
      message: `minComponentSize (${config.minComponentSize}) cannot exceed total image pixel count (${totalPixels}).`
    });
  }

  const valid = combinedIssues.length === 0;

  return {
    result: {
      valid,
      issues: combinedIssues,
      warnings,
      summary: valid
        ? {
            datasetId: dataset.datasetId,
            origin: dataset.origin,
            width: dataset.before.width,
            height: dataset.before.height,
            alignmentId: dataset.before.alignmentId,
            pixelWidthMeters: dataset.before.pixelWidthMeters,
            pixelHeightMeters: dataset.before.pixelHeightMeters,
            beforeDate: dataset.before.date,
            afterDate: dataset.after.date
          }
        : undefined
    },
    dataset: valid ? dataset : null,
    config: valid ? config : null
  };
}
