import { ConnectivityType } from '../types/landChange';

export interface RawComponentCluster {
  discoveryIndex: number;
  pixelCount: number;
  pixels: Array<[number, number]>;
  boundingBox: {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  };
  centroid: {
    row: number;
    col: number;
  };
  meanAbsoluteChange: number;
  maxAbsoluteChange: number;
  meanSignedChange: number;
  dominantDirection: 'decrease' | 'increase' | 'mixed';
}

const NEIGHBORS_4: ReadonlyArray<[number, number]> = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0]
];

const NEIGHBORS_8: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
];

/**
 * Labels connected components of candidate changed pixels using deterministic
 * row-major Breadth-First Search (BFS).
 *
 * Time Complexity: O(W * H) where W = width and H = height
 * Space Complexity: O(W * H) for visited tracking and BFS queue
 */
export function labelConnectedComponents(
  candidateChangeMask: number[][],
  commonValidMask: number[][],
  absoluteChange: (number | null)[][],
  signedChange: (number | null)[][],
  width: number,
  height: number,
  connectivity: ConnectivityType = 8
): RawComponentCluster[] {
  const visited = new Uint8Array(width * height);
  const neighbors = connectivity === 4 ? NEIGHBORS_4 : NEIGHBORS_8;
  const clusters: RawComponentCluster[] = [];

  let discoveryIndex = 0;

  for (let startRow = 0; startRow < height; startRow++) {
    for (let startCol = 0; startCol < width; startCol++) {
      const flatIdx = startRow * width + startCol;

      // Only group eligible candidate changed pixels; invalid pixels are strictly excluded
      if (
        visited[flatIdx] === 1 ||
        candidateChangeMask[startRow][startCol] !== 1 ||
        commonValidMask[startRow][startCol] !== 1
      ) {
        continue;
      }

      discoveryIndex++;
      visited[flatIdx] = 1;

      const queue: Array<[number, number]> = [[startRow, startCol]];
      const pixels: Array<[number, number]> = [];

      let minRow = startRow;
      let maxRow = startRow;
      let minCol = startCol;
      let maxCol = startCol;
      let sumRow = 0;
      let sumCol = 0;

      let sumAbsChange = 0;
      let maxAbsChange = 0;
      let sumSignedChange = 0;
      let negCount = 0;
      let posCount = 0;

      let head = 0;
      while (head < queue.length) {
        const [r, c] = queue[head++];
        pixels.push([r, c]);

        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
        sumRow += r;
        sumCol += c;

        const absVal = absoluteChange[r][c] ?? 0;
        const sigVal = signedChange[r][c] ?? 0;
        sumAbsChange += absVal;
        if (absVal > maxAbsChange) maxAbsChange = absVal;
        sumSignedChange += sigVal;
        if (sigVal < 0) negCount++;
        else if (sigVal > 0) posCount++;

        for (const [dr, dc] of neighbors) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) {
            continue;
          }
          const nFlat = nr * width + nc;
          if (
            visited[nFlat] === 0 &&
            candidateChangeMask[nr][nc] === 1 &&
            commonValidMask[nr][nc] === 1
          ) {
            visited[nFlat] = 1;
            queue.push([nr, nc]);
          }
        }
      }

      const pixelCount = pixels.length;
      let dominantDirection: 'decrease' | 'increase' | 'mixed' = 'mixed';
      if (negCount >= posCount * 1.5) {
        dominantDirection = 'decrease';
      } else if (posCount >= negCount * 1.5) {
        dominantDirection = 'increase';
      }

      clusters.push({
        discoveryIndex,
        pixelCount,
        pixels,
        boundingBox: { minRow, maxRow, minCol, maxCol },
        centroid: {
          row: Number((sumRow / pixelCount).toFixed(2)),
          col: Number((sumCol / pixelCount).toFixed(2))
        },
        meanAbsoluteChange: Number((sumAbsChange / pixelCount).toFixed(6)),
        maxAbsoluteChange: Number(maxAbsChange.toFixed(6)),
        meanSignedChange: Number((sumSignedChange / pixelCount).toFixed(6)),
        dominantDirection
      });
    }
  }

  return clusters;
}
