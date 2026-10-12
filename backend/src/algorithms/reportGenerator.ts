import {
  AnalysisConfig,
  AnalysisResponse,
  AnalysisSummaryMetrics,
  LandChangeDataset,
  ThresholdSensitivityPoint
} from '../types/landChange';
import { checkImageCompatibility } from '../validation/compatibilityChecker';
import { calculateAreaFromPixels } from './areaCalculator';
import { detectCandidateChanges } from './changeDetector';
import { filterComponentsByMinSize } from './componentFilter';
import { labelConnectedComponents } from './connectedComponents';
import { calculateTemporalNdvi } from './indexCalculator';
import { buildCommonValidityMask } from './validityMask';

export const STANDARD_LIMITATIONS: string[] = [
  'Detected changes represent pixel-level spectral index (NDVI) differences between the two temporal acquisitions and do NOT automatically prove real-world events such as deforestation, construction, agriculture, or hazard damage.',
  'Optical bands (Red, NIR) are sensitive to unmasked thin clouds, cloud shadows, haze, and aerosol variations.',
  'Solar elevation, viewing geometry, and bidirectional reflectance distribution (BRDF) illumination differences can shift index values without actual land-cover transformation.',
  'Phenological and seasonal cycles (e.g., dry vs. wet season crop senescence) produce strong NDVI variations that require domain verification.',
  'Sub-pixel co-registration or image alignment errors along sharp boundaries (roads, water edges, forest margins) can induce false edge-change components.',
  'Results depend directly on the user-configured |ΔNDVI| threshold and minimum connected-component size filter; changes occurring without altering red/NIR contrast (e.g., grading bare soil to concrete of similar reflectance) may be missed.'
];

const SENSITIVITY_THRESHOLDS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.75];

/**
 * Executes the complete deterministic 10-step PS08 change detection pipeline on a validated dataset and configuration.
 */
export function runLandChangeAnalysis(
  dataset: LandChangeDataset,
  config: AnalysisConfig
): AnalysisResponse {
  const startTime = performance.now();

  const { width, height, pixelWidthMeters, pixelHeightMeters } = dataset.before;
  const totalPixels = width * height;

  // Compatibility warnings
  const { warnings: compatWarnings } = checkImageCompatibility(dataset);
  const warnings: string[] = [...compatWarnings];

  // Step 3: Calculate NDVI for both dates
  const beforeIndex = calculateTemporalNdvi(dataset.before);
  const afterIndex = calculateTemporalNdvi(dataset.after);

  if (beforeIndex.validityStats.zeroDenominatorPixels > 0) {
    warnings.push(
      `Before slice (${dataset.before.date}) contained ${beforeIndex.validityStats.zeroDenominatorPixels} pixel(s) where (NIR + Red) = 0; those pixels were excluded as invalid.`
    );
  }
  if (afterIndex.validityStats.zeroDenominatorPixels > 0) {
    warnings.push(
      `After slice (${dataset.after.date}) contained ${afterIndex.validityStats.zeroDenominatorPixels} pixel(s) where (NIR + Red) = 0; those pixels were excluded as invalid.`
    );
  }

  // Step 4: Construct common validity mask
  const commonValidity = buildCommonValidityMask(
    beforeIndex.effectiveValidMask,
    afterIndex.effectiveValidMask,
    width,
    height
  );

  if (commonValidity.eligiblePixelCount === 0) {
    warnings.push(
      'ZERO_ELIGIBLE_PIXELS: No pixels are simultaneously valid on both dates. Change percentages cannot be computed and are returned as null.'
    );
  } else if (commonValidity.invalidPixelCount > 0) {
    warnings.push(
      `${commonValidity.invalidPixelCount} pixel(s) (${commonValidity.invalidPercentage}% of total grid) were excluded from comparison due to validity masks or zero NDVI denominators.`
    );
  }

  // Step 5 & 6: Calculate pixel-level change measure and apply threshold (>=)
  const changeDetection = detectCandidateChanges(
    beforeIndex.ndviGrid,
    afterIndex.ndviGrid,
    commonValidity.commonValidMask,
    width,
    height,
    config.threshold
  );

  // Step 7: Label connected components of candidate changed pixels
  const rawClusters = labelConnectedComponents(
    changeDetection.candidateChangeMask,
    commonValidity.commonValidMask,
    changeDetection.absoluteChange,
    changeDetection.signedChange,
    width,
    height,
    config.connectivity
  );

  // Step 8: Filter components smaller than configured minimum component size
  const filteredResult = filterComponentsByMinSize(
    rawClusters,
    commonValidity.commonValidMask,
    changeDetection.candidateChangeMask,
    width,
    height,
    config.minComponentSize,
    pixelWidthMeters,
    pixelHeightMeters,
    commonValidity.eligiblePixelCount
  );

  if (filteredResult.filteredOutComponents.length > 0) {
    warnings.push(
      `Minimum component size filter (${config.minComponentSize} px) removed ${filteredResult.filteredOutComponents.length} candidate group(s) totaling ${filteredResult.filteredOutChangedPixelCount} pixel(s).`
    );
  }

  // Directional breakdown among retained changed pixels (NDVI decrease vs NDVI increase)
  let retainedDecreasePixelCount = 0;
  let retainedIncreasePixelCount = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (filteredResult.retainedChangeMask[r][c] === 1) {
        const sig = changeDetection.signedChange[r][c] ?? 0;
        if (sig < 0) retainedDecreasePixelCount++;
        else if (sig > 0) retainedIncreasePixelCount++;
      }
    }
  }
  const decreaseArea = calculateAreaFromPixels(
    retainedDecreasePixelCount,
    pixelWidthMeters,
    pixelHeightMeters
  );
  const increaseArea = calculateAreaFromPixels(
    retainedIncreasePixelCount,
    pixelWidthMeters,
    pixelHeightMeters
  );

  // Step 9: Calculate summary metrics and areas
  const pixelAreaSquareMeters = Number((pixelWidthMeters * pixelHeightMeters).toFixed(4));
  const totalArea = calculateAreaFromPixels(totalPixels, pixelWidthMeters, pixelHeightMeters);
  const candidateArea = calculateAreaFromPixels(
    changeDetection.candidateChangedPixelCount,
    pixelWidthMeters,
    pixelHeightMeters
  );
  const retainedArea = calculateAreaFromPixels(
    filteredResult.retainedChangedPixelCount,
    pixelWidthMeters,
    pixelHeightMeters
  );

  const eligiblePixelCount = commonValidity.eligiblePixelCount;

  const candidateChangedPercentage =
    eligiblePixelCount > 0
      ? Number(((changeDetection.candidateChangedPixelCount / eligiblePixelCount) * 100).toFixed(2))
      : null;

  const retainedChangedPercentage =
    eligiblePixelCount > 0
      ? Number(((filteredResult.retainedChangedPixelCount / eligiblePixelCount) * 100).toFixed(2))
      : null;

  // Compute deterministic threshold sensitivity profile across standard thresholds
  const sensitivityProfile: ThresholdSensitivityPoint[] = SENSITIVITY_THRESHOLDS.map((t) => {
    const det = detectCandidateChanges(
      beforeIndex.ndviGrid,
      afterIndex.ndviGrid,
      commonValidity.commonValidMask,
      width,
      height,
      t
    );
    const clusters = labelConnectedComponents(
      det.candidateChangeMask,
      commonValidity.commonValidMask,
      det.absoluteChange,
      det.signedChange,
      width,
      height,
      config.connectivity
    );
    const retainedClusters = clusters.filter((cl) => cl.pixelCount >= config.minComponentSize);
    const retPixels = retainedClusters.reduce((acc, cl) => acc + cl.pixelCount, 0);
    const retArea = calculateAreaFromPixels(retPixels, pixelWidthMeters, pixelHeightMeters);
    return {
      threshold: t,
      candidatePixels: det.candidateChangedPixelCount,
      retainedPixels: retPixels,
      retainedAreaSquareMeters: retArea.squareMeters,
      retainedAreaHectares: retArea.hectares,
      retainedComponentCount: retainedClusters.length
    };
  });

  const summary: AnalysisSummaryMetrics = {
    totalPixels,
    pixelAreaSquareMeters,
    totalAreaSquareMeters: totalArea.squareMeters,
    totalAreaHectares: totalArea.hectares,
    beforeValidity: beforeIndex.validityStats,
    afterValidity: afterIndex.validityStats,
    eligiblePixelCount,
    invalidPixelCount: commonValidity.invalidPixelCount,
    validCoveragePercentage: commonValidity.validCoveragePercentage,
    invalidPercentage: commonValidity.invalidPercentage,
    unchangedEligiblePixelCount: changeDetection.unchangedEligiblePixelCount,
    candidateChangedPixelCount: changeDetection.candidateChangedPixelCount,
    filteredOutChangedPixelCount: filteredResult.filteredOutChangedPixelCount,
    retainedChangedPixelCount: filteredResult.retainedChangedPixelCount,
    retainedDecreasePixelCount,
    retainedIncreasePixelCount,
    retainedDecreaseAreaHectares: decreaseArea.hectares,
    retainedIncreaseAreaHectares: increaseArea.hectares,
    candidateChangedPercentage,
    retainedChangedPercentage,
    candidateChangeAreaSquareMeters: candidateArea.squareMeters,
    candidateChangeAreaHectares: candidateArea.hectares,
    candidateChangeAreaSquareKilometers: candidateArea.squareKilometers,
    retainedChangeAreaSquareMeters: retainedArea.squareMeters,
    retainedChangeAreaHectares: retainedArea.hectares,
    retainedChangeAreaSquareKilometers: retainedArea.squareKilometers,
    candidateComponentCount: filteredResult.allCandidateComponents.length,
    filteredOutComponentCount: filteredResult.filteredOutComponents.length,
    retainedComponentCount: filteredResult.retainedComponents.length,
    percentageDenominatorDescription:
      'Change percentages (candidateChangedPercentage and retainedChangedPercentage) use eligiblePixelCount (pixels valid with finite NDVI on BOTH dates) as the denominator. Valid/invalid grid coverage percentages use totalPixels (width × height) as the denominator.'
  };

  const durationMs = Number((performance.now() - startTime).toFixed(2));

  // Deterministic analysisId derived from datasetId and config parameters
  const analysisId = `ps08-${dataset.datasetId}-t${config.threshold}-m${config.minComponentSize}-c${config.connectivity}`;

  return {
    analysisId,
    timestamp: new Date().toISOString(),
    processingDurationMs: durationMs,
    datasetMetadata: {
      schemaVersion: dataset.schemaVersion,
      datasetId: dataset.datasetId,
      title: dataset.title ?? dataset.datasetId,
      origin: dataset.origin,
      description: dataset.description,
      beforeDate: dataset.before.date,
      afterDate: dataset.after.date,
      width,
      height,
      alignmentId: dataset.before.alignmentId,
      coordinateSystem: dataset.before.coordinateSystem ?? 'LOCAL-GRID-METRIC',
      pixelWidthMeters,
      pixelHeightMeters
    },
    config: {
      ...config,
      comparisonOperator: 'GREATER_THAN_OR_EQUAL (>=)',
      indexFormula: 'NDVI = (NIR - Red) / (NIR + Red)',
      changeFormula: 'absoluteChange = |NDVI_after - NDVI_before|'
    },
    indexSummaries: {
      before: beforeIndex.summary,
      after: afterIndex.summary
    },
    summary,
    components: {
      retained: filteredResult.retainedComponents,
      filteredOut: filteredResult.filteredOutComponents,
      allCandidate: filteredResult.allCandidateComponents
    },
    sensitivityProfile,
    rasters: {
      beforeNdvi: beforeIndex.ndviGrid,
      afterNdvi: afterIndex.ndviGrid,
      absoluteChange: changeDetection.absoluteChange,
      signedChange: changeDetection.signedChange,
      commonValidMask: commonValidity.commonValidMask,
      invalidMask: commonValidity.invalidMask,
      candidateChangeMask: changeDetection.candidateChangeMask,
      retainedChangeMask: filteredResult.retainedChangeMask,
      classificationMask: filteredResult.classificationMask,
      componentLabelMask: filteredResult.componentLabelMask
    },
    warnings,
    limitations: STANDARD_LIMITATIONS
  };
}
