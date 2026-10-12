import {
  DateValidityStats,
  IndexSummary,
  TemporalImageSlice
} from '../types/landChange';

export interface TemporalIndexResult {
  ndviGrid: (number | null)[][];
  effectiveValidMask: number[][];
  summary: IndexSummary;
  validityStats: DateValidityStats;
}

const EPSILON = 1e-12;

/**
 * Calculates Normalized Difference Vegetation Index (NDVI) for a temporal slice:
 *   NDVI = (NIR - Red) / (NIR + Red)
 *
 * Rules:
 * - If slice.validMask[r][c] !== 1, the pixel is marked invalid (null NDVI, effectiveValidMask = 0).
 * - If (NIR + Red) === 0 (within floating-point epsilon), the pixel cannot have a valid NDVI,
 *   so it is marked invalid (null NDVI, effectiveValidMask = 0) and counted in zeroDenominatorPixels.
 * - Never silently assigns 0.0 to invalid or zero-denominator pixels.
 */
export function calculateTemporalNdvi(slice: TemporalImageSlice): TemporalIndexResult {
  const { width, height, bands, validMask, date } = slice;
  const totalPixels = width * height;

  const ndviGrid: (number | null)[][] = Array.from({ length: height }, () =>
    Array<number | null>(width).fill(null)
  );
  const effectiveValidMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  );

  let maskValidPixels = 0;
  let maskInvalidPixels = 0;
  let zeroDenominatorPixels = 0;
  let effectiveValidPixels = 0;

  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  let sumVal = 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const isMaskValid = validMask[r][c] === 1;
      if (!isMaskValid) {
        maskInvalidPixels++;
        ndviGrid[r][c] = null;
        effectiveValidMask[r][c] = 0;
        continue;
      }

      maskValidPixels++;
      const red = bands.red[r][c];
      const nir = bands.nir[r][c];
      const denominator = nir + red;

      if (!Number.isFinite(red) || !Number.isFinite(nir) || Math.abs(denominator) < EPSILON) {
        zeroDenominatorPixels++;
        ndviGrid[r][c] = null;
        effectiveValidMask[r][c] = 0;
        continue;
      }

      const rawNdvi = (nir - red) / denominator;
      // Clamp to [-1, 1] for numerical stability and round to 6 decimal places for determinism
      const clampedNdvi = Math.max(-1, Math.min(1, rawNdvi));
      const roundedNdvi = Number(clampedNdvi.toFixed(6));

      ndviGrid[r][c] = roundedNdvi;
      effectiveValidMask[r][c] = 1;
      effectiveValidPixels++;

      if (roundedNdvi < minVal) minVal = roundedNdvi;
      if (roundedNdvi > maxVal) maxVal = roundedNdvi;
      sumVal += roundedNdvi;
    }
  }

  const summary: IndexSummary = {
    min: effectiveValidPixels > 0 ? Number(minVal.toFixed(6)) : null,
    max: effectiveValidPixels > 0 ? Number(maxVal.toFixed(6)) : null,
    mean: effectiveValidPixels > 0 ? Number((sumVal / effectiveValidPixels).toFixed(6)) : null,
    validIndexPixels: effectiveValidPixels,
    zeroDenominatorPixels
  };

  const validityStats: DateValidityStats = {
    date,
    totalPixels,
    maskValidPixels,
    maskInvalidPixels,
    zeroDenominatorPixels,
    effectiveValidPixels,
    validCoveragePercentage:
      totalPixels > 0 ? Number(((effectiveValidPixels / totalPixels) * 100).toFixed(2)) : 0
  };

  return {
    ndviGrid,
    effectiveValidMask,
    summary,
    validityStats
  };
}
