import { z } from 'zod';
import {
  AnalysisConfig,
  LandChangeDataset,
  TemporalImageSlice,
  ValidationIssue
} from '../types/landChange';
import { DEFAULT_ANALYSIS_CONFIG } from './inputParser';

export const MIN_IMAGE_DIMENSION = 20;
export const MAX_IMAGE_DIMENSION = 500;

const finiteNumberSchema = z.number({
  required_error: 'Value is required',
  invalid_type_error: 'Expected a finite number'
}).refine((val) => Number.isFinite(val), {
  message: 'Value must be a finite number (NaN and Infinity are not permitted)'
});

const reflectanceBandValueSchema = finiteNumberSchema.refine(
  (val) => val >= 0 && val <= 1,
  {
    message: 'Normalized reflectance band values must be within [0.0, 1.0]'
  }
);

const validMaskValueSchema = finiteNumberSchema.refine(
  (val) => val === 0 || val === 1,
  {
    message: 'Validity mask values must be binary integers (0 for invalid, 1 for valid)'
  }
);

const temporalSliceSchema = z.object({
  date: z.string({ required_error: 'Image date is required' }).trim().min(1, 'Image date cannot be empty'),
  width: finiteNumberSchema
    .refine((val) => Number.isInteger(val), 'Image width must be an integer')
    .refine((val) => val >= MIN_IMAGE_DIMENSION, `Image width must be at least ${MIN_IMAGE_DIMENSION} pixels`)
    .refine((val) => val <= MAX_IMAGE_DIMENSION, `Image width cannot exceed ${MAX_IMAGE_DIMENSION} pixels`),
  height: finiteNumberSchema
    .refine((val) => Number.isInteger(val), 'Image height must be an integer')
    .refine((val) => val >= MIN_IMAGE_DIMENSION, `Image height must be at least ${MIN_IMAGE_DIMENSION} pixels`)
    .refine((val) => val <= MAX_IMAGE_DIMENSION, `Image height cannot exceed ${MAX_IMAGE_DIMENSION} pixels`),
  alignmentId: z.string({ required_error: 'alignmentId is required' }).trim().min(1, 'alignmentId cannot be empty'),
  coordinateSystem: z.string().trim().min(1).optional(),
  pixelWidthMeters: finiteNumberSchema.refine(
    (val) => val > 0 && val <= 10000,
    'pixelWidthMeters must be a positive number (> 0 and <= 10,000 meters)'
  ),
  pixelHeightMeters: finiteNumberSchema.refine(
    (val) => val > 0 && val <= 10000,
    'pixelHeightMeters must be a positive number (> 0 and <= 10,000 meters)'
  ),
  bands: z.object(
    {
      red: z.array(z.array(reflectanceBandValueSchema), {
        required_error: 'Red band 2D array is required',
        invalid_type_error: 'Red band must be a 2D array of numbers'
      }),
      nir: z.array(z.array(reflectanceBandValueSchema), {
        required_error: 'NIR (Near-Infrared) band 2D array is required',
        invalid_type_error: 'NIR band must be a 2D array of numbers'
      })
    },
    {
      required_error: 'bands object containing red and nir arrays is required',
      invalid_type_error: 'bands must be an object containing red and nir arrays'
    }
  ).strict('Only documented bands (red, nir) are allowed in the bands object'),
  validMask: z.array(z.array(validMaskValueSchema), {
    required_error: 'validMask 2D array is required',
    invalid_type_error: 'validMask must be a 2D array of 0/1 integers'
  })
});

export const datasetZodSchema = z.object({
  schemaVersion: z.literal('1.0', {
    errorMap: () => ({ message: 'schemaVersion must be "1.0"' })
  }),
  datasetId: z.string({ required_error: 'datasetId is required' }).trim().min(1, 'datasetId cannot be empty'),
  title: z.string().trim().min(1).optional(),
  origin: z.string({ required_error: 'origin is required' }).trim().min(1, 'origin cannot be empty'),
  description: z.string({ required_error: 'description is required' }).trim().min(1, 'description cannot be empty'),
  recommendedConfig: z
    .object({
      threshold: finiteNumberSchema.optional(),
      minComponentSize: finiteNumberSchema.optional(),
      connectivity: z.union([z.literal(4), z.literal(8)]).optional()
    })
    .optional(),
  before: temporalSliceSchema,
  after: temporalSliceSchema
});

export const analysisConfigZodSchema = z.object({
  threshold: finiteNumberSchema
    .refine((val) => val >= 0, 'Change threshold cannot be negative (must be >= 0)')
    .refine((val) => val <= 2.0, 'Change threshold cannot exceed 2.0 (maximum possible |ΔNDVI|)'),
  minComponentSize: finiteNumberSchema
    .refine((val) => Number.isInteger(val), 'Minimum component size must be an integer')
    .refine((val) => val >= 1, 'Minimum component size must be at least 1 pixel')
    .refine((val) => val <= 250000, 'Minimum component size is unreasonably large (max 250,000)'),
  connectivity: z.union([z.literal(4), z.literal(8)], {
    errorMap: () => ({ message: 'Connectivity convention must be either 4 or 8' })
  })
});

function validateMatrixDimensions(
  slice: TemporalImageSlice,
  sliceLabel: 'before' | 'after',
  issues: ValidationIssue[]
): void {
  const { width, height, bands, validMask } = slice;

  const checkGrid = (grid: unknown[][], fieldPath: string, gridName: string) => {
    if (grid.length !== height) {
      issues.push({
        field: fieldPath,
        code: 'MATRIX_ROW_COUNT_MISMATCH',
        message: `${sliceLabel} ${gridName} has ${grid.length} rows, but declared height is ${height}.`
      });
      return;
    }
    for (let r = 0; r < grid.length; r++) {
      if (!Array.isArray(grid[r]) || grid[r].length !== width) {
        issues.push({
          field: `${fieldPath}[${r}]`,
          code: 'MATRIX_COL_COUNT_MISMATCH',
          message: `${sliceLabel} ${gridName} row ${r} has ${Array.isArray(grid[r]) ? grid[r].length : 0} columns, but declared width is ${width}.`
        });
        break; // Report first mismatched row per matrix to avoid flooding
      }
    }
  };

  checkGrid(bands.red, `${sliceLabel}.bands.red`, 'Red band');
  checkGrid(bands.nir, `${sliceLabel}.bands.nir`, 'NIR band');
  checkGrid(validMask, `${sliceLabel}.validMask`, 'validity mask');
}

/**
 * Validates the dataset schema and matrix dimensions.
 */
export function validateDatasetSchema(rawDataset: unknown): {
  dataset: LandChangeDataset | null;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  // Pre-check raw bands keys before Zod runs so missing/extra bands give specific error codes
  if (rawDataset && typeof rawDataset === 'object') {
    const d = rawDataset as Record<string, unknown>;
    for (const key of ['before', 'after'] as const) {
      const slice = d[key] as Record<string, unknown> | undefined;
      if (slice && typeof slice === 'object') {
        const bands = slice.bands as Record<string, unknown> | undefined;
        if (!bands || typeof bands !== 'object' || Array.isArray(bands)) {
          issues.push({
            field: `${key}.bands`,
            code: 'INVALID_BANDS_DEFINITION',
            message: `${key}.bands must be an object containing 'red' and 'nir' band arrays.`
          });
        } else {
          const bandKeys = Object.keys(bands);
          if (!bandKeys.includes('red') || !bandKeys.includes('nir')) {
            issues.push({
              field: `${key}.bands`,
              code: 'INCOMPATIBLE_BAND_DEFINITION',
              message: `${key}.bands must define both 'red' and 'nir' normalized bands. Found: [${bandKeys.join(', ')}].`
            });
          }
          const unsupported = bandKeys.filter((k) => k !== 'red' && k !== 'nir');
          if (unsupported.length > 0) {
            issues.push({
              field: `${key}.bands`,
              code: 'UNSUPPORTED_BAND_DEFINITION',
              message: `${key}.bands contains undocumented bands [${unsupported.join(', ')}]. Expected only 'red' and 'nir'.`
            });
          }
        }
      }
    }
  }

  const parsed = datasetZodSchema.safeParse(rawDataset);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      const field = err.path.join('.') || 'dataset';
      let code = 'SCHEMA_VALIDATION_ERROR';
      if (field.includes('width') || field.includes('height')) {
        code = 'INVALID_IMAGE_DIMENSIONS';
      } else if (field.includes('pixelWidthMeters') || field.includes('pixelHeightMeters')) {
        code = 'INVALID_PIXEL_DIMENSIONS';
      } else if (field.includes('alignmentId')) {
        code = 'INVALID_ALIGNMENT_METADATA';
      } else if (field.includes('validMask')) {
        code = 'INVALID_VALIDITY_MASK';
      } else if (field.includes('bands')) {
        code = 'INVALID_BAND_VALUES';
      }
      issues.push({
        field,
        code,
        message: err.message
      });
    }
    return { dataset: null, issues };
  }

  const dataset = parsed.data as LandChangeDataset;
  validateMatrixDimensions(dataset.before, 'before', issues);
  validateMatrixDimensions(dataset.after, 'after', issues);

  if (issues.length > 0) {
    return { dataset: null, issues };
  }

  return { dataset, issues };
}

/**
 * Validates and normalizes analysis configuration parameters.
 */
export function validateAnalysisConfig(rawConfig: unknown): {
  config: AnalysisConfig | null;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const base = (rawConfig && typeof rawConfig === 'object' ? rawConfig : {}) as Record<string, unknown>;

  const candidate = {
    threshold: base.threshold !== undefined ? base.threshold : DEFAULT_ANALYSIS_CONFIG.threshold,
    minComponentSize:
      base.minComponentSize !== undefined ? base.minComponentSize : DEFAULT_ANALYSIS_CONFIG.minComponentSize,
    connectivity: base.connectivity !== undefined ? base.connectivity : DEFAULT_ANALYSIS_CONFIG.connectivity
  };

  const parsed = analysisConfigZodSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      issues.push({
        field: `config.${err.path.join('.')}`,
        code: 'INVALID_CONFIGURATION',
        message: err.message
      });
    }
    return { config: null, issues };
  }

  return {
    config: parsed.data,
    issues: []
  };
}
