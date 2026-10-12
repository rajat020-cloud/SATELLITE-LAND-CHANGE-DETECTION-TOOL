export type ConnectivityType = 4 | 8;

export interface BandData {
  red: number[][];
  nir: number[][];
}

export interface TemporalImageSlice {
  date: string;
  width: number;
  height: number;
  alignmentId: string;
  coordinateSystem?: string;
  pixelWidthMeters: number;
  pixelHeightMeters: number;
  bands: BandData;
  validMask: number[][];
}

export interface LandChangeDataset {
  schemaVersion: string;
  datasetId: string;
  title?: string;
  origin: 'synthetic' | string;
  description: string;
  recommendedConfig?: {
    threshold: number;
    minComponentSize: number;
    connectivity: ConnectivityType;
  };
  before: TemporalImageSlice;
  after: TemporalImageSlice;
}

export interface AnalysisConfig {
  threshold: number;
  minComponentSize: number;
  connectivity: ConnectivityType;
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
  summary?: {
    datasetId: string;
    origin: string;
    width: number;
    height: number;
    alignmentId: string;
    pixelWidthMeters: number;
    pixelHeightMeters: number;
    beforeDate: string;
    afterDate: string;
  };
}

export interface IndexSummary {
  min: number | null;
  max: number | null;
  mean: number | null;
  validIndexPixels: number;
  zeroDenominatorPixels: number;
}

export interface DateValidityStats {
  date: string;
  totalPixels: number;
  maskValidPixels: number;
  maskInvalidPixels: number;
  zeroDenominatorPixels: number;
  effectiveValidPixels: number;
  validCoveragePercentage: number;
}

export interface ConnectedComponentInfo {
  componentId: number;
  pixelCount: number;
  areaSquareMeters: number;
  areaHectares: number;
  areaSquareKilometers: number;
  percentageOfEligible: number;
  meanAbsoluteChange: number;
  maxAbsoluteChange: number;
  meanSignedChange: number;
  dominantDirection: 'decrease' | 'increase' | 'mixed';
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
  retained: boolean;
  pixels: Array<[number, number]>;
}

/**
 * Pixel classification codes in the exported mask:
 * -1 = Invalid (mask invalid on either date or zero denominator in NDVI)
 *  0 = Unchanged eligible pixel (|ΔNDVI| < threshold)
 *  1 = Candidate changed pixel removed by minimum-size filter
 *  2 = Retained changed pixel (belongs to a component with pixelCount >= minComponentSize)
 */
export type PixelClassificationCode = -1 | 0 | 1 | 2;

export type PixelClassificationLabel =
  | 'INVALID'
  | 'UNCHANGED'
  | 'FILTERED_CANDIDATE_CHANGE'
  | 'RETAINED_CHANGE';

export interface ThresholdSensitivityPoint {
  threshold: number;
  candidatePixels: number;
  retainedPixels: number;
  retainedAreaSquareMeters: number;
  retainedAreaHectares: number;
  retainedComponentCount: number;
}

export interface AnalysisSummaryMetrics {
  totalPixels: number;
  pixelAreaSquareMeters: number;
  totalAreaSquareMeters: number;
  totalAreaHectares: number;
  beforeValidity: DateValidityStats;
  afterValidity: DateValidityStats;
  eligiblePixelCount: number;
  invalidPixelCount: number;
  validCoveragePercentage: number;
  invalidPercentage: number;
  unchangedEligiblePixelCount: number;
  candidateChangedPixelCount: number;
  filteredOutChangedPixelCount: number;
  retainedChangedPixelCount: number;
  retainedDecreasePixelCount: number;
  retainedIncreasePixelCount: number;
  retainedDecreaseAreaHectares: number;
  retainedIncreaseAreaHectares: number;
  candidateChangedPercentage: number | null;
  retainedChangedPercentage: number | null;
  candidateChangeAreaSquareMeters: number;
  candidateChangeAreaHectares: number;
  candidateChangeAreaSquareKilometers: number;
  retainedChangeAreaSquareMeters: number;
  retainedChangeAreaHectares: number;
  retainedChangeAreaSquareKilometers: number;
  candidateComponentCount: number;
  filteredOutComponentCount: number;
  retainedComponentCount: number;
  percentageDenominatorDescription: string;
}

export interface AnalysisResponse {
  analysisId: string;
  timestamp: string;
  processingDurationMs: number;
  datasetMetadata: {
    schemaVersion: string;
    datasetId: string;
    title: string;
    origin: string;
    description: string;
    beforeDate: string;
    afterDate: string;
    width: number;
    height: number;
    alignmentId: string;
    coordinateSystem: string;
    pixelWidthMeters: number;
    pixelHeightMeters: number;
  };
  config: AnalysisConfig & {
    comparisonOperator: 'GREATER_THAN_OR_EQUAL (>=)';
    indexFormula: 'NDVI = (NIR - Red) / (NIR + Red)';
    changeFormula: 'absoluteChange = |NDVI_after - NDVI_before|';
  };
  indexSummaries: {
    before: IndexSummary;
    after: IndexSummary;
  };
  summary: AnalysisSummaryMetrics;
  components: {
    retained: ConnectedComponentInfo[];
    filteredOut: ConnectedComponentInfo[];
    allCandidate: ConnectedComponentInfo[];
  };
  sensitivityProfile: ThresholdSensitivityPoint[];
  rasters: {
    beforeNdvi: (number | null)[][];
    afterNdvi: (number | null)[][];
    absoluteChange: (number | null)[][];
    signedChange: (number | null)[][];
    commonValidMask: number[][];
    invalidMask: number[][];
    candidateChangeMask: number[][];
    retainedChangeMask: number[][];
    classificationMask: PixelClassificationCode[][];
    componentLabelMask: number[][];
  };
  warnings: string[];
  limitations: string[];
}
