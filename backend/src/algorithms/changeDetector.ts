export interface PixelChangeResult {
  absoluteChange: (number | null)[][];
  signedChange: (number | null)[][];
  candidateChangeMask: number[][];
  candidateChangedPixelCount: number;
  unchangedEligiblePixelCount: number;
}

const FLOAT_TOLERANCE = 1e-9;

/**
 * Computes pixel-level NDVI difference on eligible pixels and applies the threshold.
 *
 * Comparison rule:
 *   A pixel is marked as a candidate change (candidateChangeMask[r][c] = 1) when:
 *     commonValidMask[r][c] === 1  AND  |NDVI_after - NDVI_before| >= threshold
 *
 * Invalid pixels (commonValidMask[r][c] === 0) receive null in absoluteChange and signedChange
 * (never silently assigned 0.0) and 0 in candidateChangeMask.
 */
export function detectCandidateChanges(
  beforeNdvi: (number | null)[][],
  afterNdvi: (number | null)[][],
  commonValidMask: number[][],
  width: number,
  height: number,
  threshold: number
): PixelChangeResult {
  const absoluteChange: (number | null)[][] = Array.from({ length: height }, () =>
    Array<number | null>(width).fill(null)
  );
  const signedChange: (number | null)[][] = Array.from({ length: height }, () =>
    Array<number | null>(width).fill(null)
  );
  const candidateChangeMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  );

  let candidateChangedPixelCount = 0;
  let unchangedEligiblePixelCount = 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (commonValidMask[r][c] !== 1) {
        absoluteChange[r][c] = null;
        signedChange[r][c] = null;
        candidateChangeMask[r][c] = 0;
        continue;
      }

      const bVal = beforeNdvi[r][c];
      const aVal = afterNdvi[r][c];

      if (bVal === null || aVal === null) {
        absoluteChange[r][c] = null;
        signedChange[r][c] = null;
        candidateChangeMask[r][c] = 0;
        continue;
      }

      const rawSigned = aVal - bVal;
      const roundedSigned = Number(rawSigned.toFixed(6));
      const roundedAbs = Number(Math.abs(roundedSigned).toFixed(6));

      signedChange[r][c] = roundedSigned;
      absoluteChange[r][c] = roundedAbs;

      // Greater-than-or-equal (>=) comparison with IEEE-754 floating-point boundary guard
      if (roundedAbs + FLOAT_TOLERANCE >= threshold) {
        candidateChangeMask[r][c] = 1;
        candidateChangedPixelCount++;
      } else {
        candidateChangeMask[r][c] = 0;
        unchangedEligiblePixelCount++;
      }
    }
  }

  return {
    absoluteChange,
    signedChange,
    candidateChangeMask,
    candidateChangedPixelCount,
    unchangedEligiblePixelCount
  };
}
