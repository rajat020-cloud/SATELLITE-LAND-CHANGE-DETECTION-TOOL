import {
  ConnectedComponentInfo,
  PixelClassificationCode
} from '../types/landChange';
import { calculateAreaFromPixels } from './areaCalculator';
import { RawComponentCluster } from './connectedComponents';

export interface ComponentFilteringResult {
  retainedComponents: ConnectedComponentInfo[];
  filteredOutComponents: ConnectedComponentInfo[];
  allCandidateComponents: ConnectedComponentInfo[];
  retainedChangeMask: number[][];
  classificationMask: PixelClassificationCode[][];
  componentLabelMask: number[][];
  retainedChangedPixelCount: number;
  filteredOutChangedPixelCount: number;
}

/**
 * Filters connected components by minimum pixel count (component.pixelCount >= minComponentSize),
 * assigns deterministic component IDs in scan order (1..N for retained components),
 * and produces the retainedChangeMask, classificationMask, and componentLabelMask.
 */
export function filterComponentsByMinSize(
  rawClusters: RawComponentCluster[],
  commonValidMask: number[][],
  candidateChangeMask: number[][],
  width: number,
  height: number,
  minComponentSize: number,
  pixelWidthMeters: number,
  pixelHeightMeters: number,
  eligiblePixelCount: number
): ComponentFilteringResult {
  const retainedChangeMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  );
  const componentLabelMask: number[][] = Array.from({ length: height }, () =>
    Array<number>(width).fill(0)
  );
  const classificationMask: PixelClassificationCode[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (__, c): PixelClassificationCode => {
      if (commonValidMask[r][c] !== 1) return -1;
      if (candidateChangeMask[r][c] === 1) return 1; // Default candidate to 1 (filtered); upgraded to 2 if retained
      return 0;
    })
  );

  const retainedComponents: ConnectedComponentInfo[] = [];
  const filteredOutComponents: ConnectedComponentInfo[] = [];
  const allCandidateComponents: ConnectedComponentInfo[] = [];

  let retainedChangedPixelCount = 0;
  let filteredOutChangedPixelCount = 0;
  let nextRetainedId = 1;
  let nextFilteredId = 1;

  for (const cluster of rawClusters) {
    const isRetained = cluster.pixelCount >= minComponentSize;
    const area = calculateAreaFromPixels(
      cluster.pixelCount,
      pixelWidthMeters,
      pixelHeightMeters
    );
    const percentageOfEligible =
      eligiblePixelCount > 0
        ? Number(((cluster.pixelCount / eligiblePixelCount) * 100).toFixed(2))
        : 0;

    const assignedId = isRetained ? nextRetainedId++ : nextFilteredId++;

    const compInfo: ConnectedComponentInfo = {
      componentId: assignedId,
      pixelCount: cluster.pixelCount,
      areaSquareMeters: area.squareMeters,
      areaHectares: area.hectares,
      areaSquareKilometers: area.squareKilometers,
      percentageOfEligible,
      meanAbsoluteChange: cluster.meanAbsoluteChange,
      maxAbsoluteChange: cluster.maxAbsoluteChange,
      meanSignedChange: cluster.meanSignedChange,
      dominantDirection: cluster.dominantDirection,
      boundingBox: cluster.boundingBox,
      centroid: cluster.centroid,
      retained: isRetained,
      pixels: cluster.pixels
    };

    allCandidateComponents.push(compInfo);

    if (isRetained) {
      retainedComponents.push(compInfo);
      retainedChangedPixelCount += cluster.pixelCount;

      for (const [r, c] of cluster.pixels) {
        retainedChangeMask[r][c] = 1;
        classificationMask[r][c] = 2;
        componentLabelMask[r][c] = assignedId;
      }
    } else {
      filteredOutComponents.push(compInfo);
      filteredOutChangedPixelCount += cluster.pixelCount;
      for (const [r, c] of cluster.pixels) {
        retainedChangeMask[r][c] = 0;
        classificationMask[r][c] = 1;
        componentLabelMask[r][c] = 0;
      }
    }
  }

  return {
    retainedComponents,
    filteredOutComponents,
    allCandidateComponents,
    retainedChangeMask,
    classificationMask,
    componentLabelMask,
    retainedChangedPixelCount,
    filteredOutChangedPixelCount
  };
}
