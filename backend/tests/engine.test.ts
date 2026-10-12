import { describe, expect, it } from 'vitest';
import { calculateAreaFromPixels } from '../src/algorithms/areaCalculator';
import { detectCandidateChanges } from '../src/algorithms/changeDetector';
import { filterComponentsByMinSize } from '../src/algorithms/componentFilter';
import { labelConnectedComponents } from '../src/algorithms/connectedComponents';
import {
  serializeAnalysisSummaryJson,
  serializeChangeMaskCsv,
  serializeChangeMaskJson
} from '../src/algorithms/exportSerializer';
import { calculateTemporalNdvi } from '../src/algorithms/indexCalculator';
import { runLandChangeAnalysis } from '../src/algorithms/reportGenerator';
import { buildCommonValidityMask } from '../src/algorithms/validityMask';
import { LandChangeDataset } from '../src/types/landChange';
import {
  buildCloudMaskedDataset,
  buildMultiComponentDataset,
  buildRectangularChangeDataset,
  buildUnchangedDataset
} from '../src/utils/generateSamples';
import { validateCompletePayload } from '../src/validation/compatibilityChecker';

function makeUniformDataset(width = 20, height = 20): LandChangeDataset {
  const createGrid = (val: number) =>
    Array.from({ length: height }, () => Array<number>(width).fill(val));

  return {
    schemaVersion: '1.0',
    datasetId: 'test-uniform-20x20',
    origin: 'synthetic',
    description: 'Uniform 20x20 synthetic test fixture',
    before: {
      date: '2026-01-01',
      width,
      height,
      alignmentId: 'grid-test-001',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: {
        red: createGrid(0.1),
        nir: createGrid(0.7) // NDVI = (0.7 - 0.1) / 0.8 = 0.75
      },
      validMask: createGrid(1)
    },
    after: {
      date: '2026-06-01',
      width,
      height,
      alignmentId: 'grid-test-001',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: {
        red: createGrid(0.1),
        nir: createGrid(0.7) // NDVI = 0.75
      },
      validMask: createGrid(1)
    }
  };
}

describe('PS08 Deterministic Change Detection Engine — Unit Tests (Scenarios 1–18)', () => {
  it('Scenario 1: Calculates exact NDVI values for known Red and NIR reflectance inputs', () => {
    const ds = makeUniformDataset(20, 20);
    // Set specific test pixels
    ds.before.bands.red[0][0] = 0.2;
    ds.before.bands.nir[0][0] = 0.6; // (0.6 - 0.2) / (0.6 + 0.2) = 0.4 / 0.8 = 0.5
    ds.before.bands.red[0][1] = 0.4;
    ds.before.bands.nir[0][1] = 0.1; // (0.1 - 0.4) / (0.1 + 0.4) = -0.3 / 0.5 = -0.6

    const res = calculateTemporalNdvi(ds.before);
    expect(res.ndviGrid[0][0]).toBeCloseTo(0.5, 6);
    expect(res.ndviGrid[0][1]).toBeCloseTo(-0.6, 6);
    expect(res.ndviGrid[1][1]).toBeCloseTo(0.75, 6);
    expect(res.summary.validIndexPixels).toBe(400);
    expect(res.summary.zeroDenominatorPixels).toBe(0);
  });

  it('Scenario 2: Handles zero-denominator (NIR + Red = 0) pixels by marking them invalid (null NDVI, never 0)', () => {
    const ds = makeUniformDataset(20, 20);
    ds.before.bands.red[3][4] = 0;
    ds.before.bands.nir[3][4] = 0;

    const indexResult = calculateTemporalNdvi(ds.before);
    expect(indexResult.ndviGrid[3][4]).toBeNull();
    expect(indexResult.effectiveValidMask[3][4]).toBe(0);
    expect(indexResult.summary.zeroDenominatorPixels).toBe(1);
    expect(indexResult.summary.validIndexPixels).toBe(399);

    const analysis = runLandChangeAnalysis(ds, {
      threshold: 0.25,
      minComponentSize: 1,
      connectivity: 8
    });
    expect(analysis.summary.eligiblePixelCount).toBe(399);
    expect(analysis.summary.invalidPixelCount).toBe(1);
    expect(analysis.rasters.absoluteChange[3][4]).toBeNull();
    expect(analysis.rasters.classificationMask[3][4]).toBe(-1);
  });

  it('Scenario 3: Identical / unchanged image pairs produce zero candidate and zero retained changes', () => {
    const unchangedDs = buildUnchangedDataset();
    const report = runLandChangeAnalysis(unchangedDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    expect(report.summary.totalPixels).toBe(576);
    expect(report.summary.eligiblePixelCount).toBe(576);
    expect(report.summary.candidateChangedPixelCount).toBe(0);
    expect(report.summary.retainedChangedPixelCount).toBe(0);
    expect(report.summary.retainedComponentCount).toBe(0);
    expect(report.summary.retainedChangeAreaSquareMeters).toBe(0);
    expect(report.summary.retainedChangedPercentage).toBe(0);
  });

  it('Scenario 4: Detects known 8×8 rectangular changed region (64 pixels, 6,400 m², 0.64 ha)', () => {
    const rectDs = buildRectangularChangeDataset();
    const report = runLandChangeAnalysis(rectDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    expect(report.summary.totalPixels).toBe(576);
    expect(report.summary.eligiblePixelCount).toBe(576);
    expect(report.summary.candidateChangedPixelCount).toBe(64);
    expect(report.summary.retainedChangedPixelCount).toBe(64);
    expect(report.summary.retainedComponentCount).toBe(1);
    expect(report.summary.retainedChangeAreaSquareMeters).toBe(6400);
    expect(report.summary.retainedChangeAreaHectares).toBe(0.64);
    expect(report.components.retained[0].boundingBox).toEqual({
      minRow: 6,
      maxRow: 13,
      minCol: 8,
      maxCol: 15
    });
  });

  it('Scenario 5 & 6: Excludes invalid / cloud-masked pixels and combines different validity masks between dates', () => {
    const cloudDs = buildCloudMaskedDataset();
    const report = runLandChangeAnalysis(cloudDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    // 42 masked in before + 35 masked in after + 2 zero-denominator in after = 79 invalid
    expect(report.summary.beforeValidity.maskInvalidPixels).toBe(42);
    expect(report.summary.afterValidity.maskInvalidPixels).toBe(35);
    expect(report.summary.afterValidity.zeroDenominatorPixels).toBe(2);
    expect(report.summary.invalidPixelCount).toBe(79);
    expect(report.summary.eligiblePixelCount).toBe(576 - 79); // 497
    // Only the 36-pixel valid change region is counted; cloud-masked pixels with altered bands are ignored
    expect(report.summary.candidateChangedPixelCount).toBe(36);
    expect(report.summary.retainedChangedPixelCount).toBe(36);
    expect(report.summary.retainedChangedPercentage).toBeCloseTo((36 / 497) * 100, 2);
  });

  it('Scenario 7: Entirely invalid comparison area returns null percentages and ZERO_ELIGIBLE_PIXELS warning without dividing by zero', () => {
    const ds = makeUniformDataset(20, 20);
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 20; c++) {
        ds.before.validMask[r][c] = 0;
      }
    }

    const report = runLandChangeAnalysis(ds, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    expect(report.summary.eligiblePixelCount).toBe(0);
    expect(report.summary.invalidPixelCount).toBe(400);
    expect(report.summary.candidateChangedPercentage).toBeNull();
    expect(report.summary.retainedChangedPercentage).toBeNull();
    expect(report.warnings.some((w) => w.includes('ZERO_ELIGIBLE_PIXELS'))).toBe(true);
  });

  it('Scenario 8: Rejects image dimension mismatch between before and after slices', () => {
    const ds = makeUniformDataset(20, 20);
    ds.after.width = 22;
    ds.after.bands.red = Array.from({ length: 20 }, () => Array(22).fill(0.2));
    ds.after.bands.nir = Array.from({ length: 20 }, () => Array(22).fill(0.6));
    ds.after.validMask = Array.from({ length: 20 }, () => Array(22).fill(1));

    const { result } = validateCompletePayload(ds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DIMENSION_MISMATCH')).toBe(true);
  });

  it('Scenario 9: Rejects incompatible or missing band definitions', () => {
    const ds = makeUniformDataset(20, 20) as unknown as Record<string, unknown>;
    const afterObj = ds.after as Record<string, unknown>;
    afterObj.bands = {
      red: Array.from({ length: 20 }, () => Array(20).fill(0.2)),
      swir: Array.from({ length: 20 }, () => Array(20).fill(0.5))
    };

    const { result } = validateCompletePayload(ds);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.code === 'INCOMPATIBLE_BAND_DEFINITION' ||
          i.code === 'UNSUPPORTED_BAND_DEFINITION' ||
          i.code === 'INVALID_BAND_VALUES'
      )
    ).toBe(true);
  });

  it('Scenario 10: Rejects incompatible alignment metadata (mismatched alignmentId)', () => {
    const ds = makeUniformDataset(20, 20);
    ds.after.alignmentId = 'different-grid-999';

    const { result } = validateCompletePayload(ds);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'ALIGNMENT_MISMATCH')).toBe(true);
  });

  it('Scenario 11: Rejects invalid, negative, or mismatched pixel-size metadata', () => {
    const dsNegative = makeUniformDataset(20, 20);
    dsNegative.before.pixelWidthMeters = -10;
    const resNeg = validateCompletePayload(dsNegative);
    expect(resNeg.result.valid).toBe(false);
    expect(resNeg.result.issues.some((i) => i.code === 'INVALID_PIXEL_DIMENSIONS')).toBe(true);

    const dsMismatch = makeUniformDataset(20, 20);
    dsMismatch.after.pixelHeightMeters = 25;
    const resMis = validateCompletePayload(dsMismatch);
    expect(resMis.result.valid).toBe(false);
    expect(resMis.result.issues.some((i) => i.code === 'PIXEL_RESOLUTION_MISMATCH')).toBe(true);
  });

  it('Scenario 12: Rejects invalid numerical values (NaN, Infinity, out-of-range reflectance, non-binary mask)', () => {
    const dsNan = makeUniformDataset(20, 20);
    dsNan.before.bands.red[2][2] = Number.NaN;
    const resNan = validateCompletePayload(dsNan);
    expect(resNan.result.valid).toBe(false);

    const dsOutRange = makeUniformDataset(20, 20);
    dsOutRange.after.bands.nir[0][0] = 1.45; // > 1.0 normalized reflectance
    const resRange = validateCompletePayload(dsOutRange);
    expect(resRange.result.valid).toBe(false);
    expect(resRange.result.issues.some((i) => i.code === 'INVALID_BAND_VALUES')).toBe(true);

    const dsBadMask = makeUniformDataset(20, 20);
    dsBadMask.before.validMask[0][0] = 2; // Not 0 or 1
    const resMask = validateCompletePayload(dsBadMask);
    expect(resMask.result.valid).toBe(false);
    expect(resMask.result.issues.some((i) => i.code === 'INVALID_VALIDITY_MASK')).toBe(true);
  });

  it('Scenario 13: Enforces greater-than-or-equal (>=) threshold boundary behavior consistently', () => {
    // Pixel (0,0) has before NDVI = 0.50, after NDVI = 0.25 -> |ΔNDVI| = 0.25
    // Pixel (0,1) has before NDVI = 0.50, after NDVI = 0.2501 -> |ΔNDVI| = 0.2499 < 0.25
    const beforeNdvi = [[0.5, 0.5]];
    const afterNdvi = [[0.25, 0.2501]];
    const validMask = [[1, 1]];

    const result = detectCandidateChanges(beforeNdvi, afterNdvi, validMask, 2, 1, 0.25);
    expect(result.candidateChangeMask[0][0]).toBe(1); // Exact equality 0.25 >= 0.25 is marked changed
    expect(result.candidateChangeMask[0][1]).toBe(0); // 0.2499 < 0.25 is unchanged
    expect(result.candidateChangedPixelCount).toBe(1);
  });

  it('Scenario 14: Groups diagonal neighbors under 8-connectivity and separates them under 4-connectivity', () => {
    const candidateMask = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const validMask = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ];
    const absChange = [
      [0.5, 0, 0],
      [0, 0.5, 0],
      [0, 0, 0.5]
    ];
    const sigChange = [
      [-0.5, 0, 0],
      [0, -0.5, 0],
      [0, 0, -0.5]
    ];

    const clusters8 = labelConnectedComponents(
      candidateMask,
      validMask,
      absChange,
      sigChange,
      3,
      3,
      8
    );
    expect(clusters8.length).toBe(1);
    expect(clusters8[0].pixelCount).toBe(3);

    const clusters4 = labelConnectedComponents(
      candidateMask,
      validMask,
      absChange,
      sigChange,
      3,
      3,
      4
    );
    expect(clusters4.length).toBe(3);
    expect(clusters4.every((c) => c.pixelCount === 1)).toBe(true);
  });

  it('Scenario 15: Filters out connected components smaller than minComponentSize while preserving candidate stats', () => {
    const multiDs = buildMultiComponentDataset();
    // With minComponentSize = 6: 4 retained groups (24, 45, 12, 16 = 97 px) and 2 filtered groups (2, 3 = 5 px)
    const reportMin6 = runLandChangeAnalysis(multiDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    expect(reportMin6.summary.candidateComponentCount).toBe(6);
    expect(reportMin6.summary.candidateChangedPixelCount).toBe(102);
    expect(reportMin6.summary.retainedComponentCount).toBe(4);
    expect(reportMin6.summary.retainedChangedPixelCount).toBe(97);
    expect(reportMin6.summary.filteredOutComponentCount).toBe(2);
    expect(reportMin6.summary.filteredOutChangedPixelCount).toBe(5);

    // Increase minComponentSize to 20: only the 24-px and 45-px components remain (69 px)
    const reportMin20 = runLandChangeAnalysis(multiDs, {
      threshold: 0.25,
      minComponentSize: 20,
      connectivity: 8
    });
    expect(reportMin20.summary.candidateChangedPixelCount).toBe(102);
    expect(reportMin20.summary.retainedComponentCount).toBe(2);
    expect(reportMin20.summary.retainedChangedPixelCount).toBe(69);
    expect(reportMin20.summary.filteredOutComponentCount).toBe(4);
    expect(reportMin20.summary.filteredOutChangedPixelCount).toBe(33);
  });

  it('Scenario 16: Calculates exact square-meter, hectare, and square-kilometer areas using pixel dimensions', () => {
    const area1 = calculateAreaFromPixels(45, 10, 10); // 45 * 100 = 4,500 m² = 0.45 ha
    expect(area1.squareMeters).toBe(4500);
    expect(area1.hectares).toBe(0.45);
    expect(area1.squareKilometers).toBe(0.0045);

    const area2 = calculateAreaFromPixels(120, 15, 20); // 120 * 300 = 36,000 m² = 3.6 ha
    expect(area2.squareMeters).toBe(36000);
    expect(area2.hectares).toBe(3.6);
  });

  it('Scenario 17: Uses eligiblePixelCount (valid on both dates) as the percentage denominator', () => {
    const multiDs = buildMultiComponentDataset();
    const report = runLandChangeAnalysis(multiDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    // Total = 900, Invalid = 60, Eligible = 840, Candidate = 102, Retained = 97
    expect(report.summary.eligiblePixelCount).toBe(840);
    expect(report.summary.candidateChangedPercentage).toBeCloseTo((102 / 840) * 100, 2);
    expect(report.summary.retainedChangedPercentage).toBeCloseTo((97 / 840) * 100, 2);
  });

  it('Scenario 18: Exported JSON summary, CSV mask, and JSON mask totals strictly match analysis summary metrics', () => {
    const multiDs = buildMultiComponentDataset();
    const report = runLandChangeAnalysis(multiDs, {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    });

    const summaryJson = JSON.parse(serializeAnalysisSummaryJson(report));
    const maskJson = JSON.parse(serializeChangeMaskJson(report));
    const csvLines = serializeChangeMaskCsv(report).trim().split('\n');

    expect(summaryJson.summaryStatistics.retainedChangedPixelCount).toBe(97);
    expect(maskJson.summaryTotals.retainedChangedPixelCount).toBe(97);
    expect(csvLines.length).toBe(900 + 1); // header + 900 pixel rows

    // Count retained pixels directly in exported mask matrix
    const maskRetainedCount = maskJson.masks.retainedChangeMask
      .flat()
      .filter((v: number) => v === 1).length;
    expect(maskRetainedCount).toBe(report.summary.retainedChangedPixelCount);

    const maskInvalidCount = maskJson.masks.invalidMask
      .flat()
      .filter((v: number) => v === 1).length;
    expect(maskInvalidCount).toBe(report.summary.invalidPixelCount);
  });
});
