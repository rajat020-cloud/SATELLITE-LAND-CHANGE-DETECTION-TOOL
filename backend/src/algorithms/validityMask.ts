export interface CommonValidityResult {
  commonValidMask: number[][];
  invalidMask: number[][];
  eligiblePixelCount: number;
  invalidPixelCount: number;
  totalPixels: number;
  validCoveragePercentage: number;
  invalidPercentage: number;
}

/**
 * Constructs the common validity mask from the effective validity masks of the 'before' and 'after' dates.
 * A pixel is eligible for comparison (commonValidMask[r][c] = 1) if and only if it is valid and
 * its index could be calculated on BOTH dates.
 */
export function buildCommonValidityMask(
  beforeEffectiveMask: number[][],
  afterEffectiveMask: number[][],
  width: number,
  height: number
): CommonValidityResult {
  const totalPixels = width * height;
  const commonValidMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  );
  const invalidMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(1)
  );

  let eligiblePixelCount = 0;
  let invalidPixelCount = 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const isEligible = beforeEffectiveMask[r][c] === 1 && afterEffectiveMask[r][c] === 1;
      if (isEligible) {
        commonValidMask[r][c] = 1;
        invalidMask[r][c] = 0;
        eligiblePixelCount++;
      } else {
        commonValidMask[r][c] = 0;
        invalidMask[r][c] = 1;
        invalidPixelCount++;
      }
    }
  }

  const validCoveragePercentage =
    totalPixels > 0 ? Number(((eligiblePixelCount / totalPixels) * 100).toFixed(2)) : 0;
  const invalidPercentage =
    totalPixels > 0 ? Number(((invalidPixelCount / totalPixels) * 100).toFixed(2)) : 0;

  return {
    commonValidMask,
    invalidMask,
    eligiblePixelCount,
    invalidPixelCount,
    totalPixels,
    validCoveragePercentage,
    invalidPercentage
  };
}
