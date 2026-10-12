export type ConnectivityType = 4 | 8;

export type NavigationTab =
  | 'overview'
  | 'new-analysis'
  | 'results'
  | 'sample-datasets'
  | 'methodology'
  | 'api-docs';

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
  origin: string;
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

export type PixelClassificationCode = -1 | 0 | 1 | 2;

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
  retainedDecreasePixelCount?: number;
  retainedIncreasePixelCount?: number;
  retainedDecreaseAreaHectares?: number;
  retainedIncreaseAreaHectares?: number;
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
    comparisonOperator: string;
    indexFormula: string;
    changeFormula: string;
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
  sensitivityProfile?: ThresholdSensitivityPoint[];
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

export interface DatasetCatalogEntry {
  datasetId: string;
  title: string;
  origin: string;
  description: string;
  beforeDate: string;
  afterDate: string;
  width: number;
  height: number;
  alignmentId: string;
  pixelWidthMeters: number;
  pixelHeightMeters: number;
  isValidDemo: boolean;
  recommendedConfig: AnalysisConfig;
}
