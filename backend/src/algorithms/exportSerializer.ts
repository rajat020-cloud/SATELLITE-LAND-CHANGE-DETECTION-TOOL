import {
  AnalysisResponse,
  PixelClassificationCode,
  PixelClassificationLabel
} from '../types/landChange';

export function classificationCodeToLabel(
  code: PixelClassificationCode
): PixelClassificationLabel {
  switch (code) {
    case -1:
      return 'INVALID';
    case 0:
      return 'UNCHANGED';
    case 1:
      return 'FILTERED_CANDIDATE_CHANGE';
    case 2:
      return 'RETAINED_CHANGE';
  }
}

export interface ReproducibleSummaryReport {
  reportSchemaVersion: '1.0';
  analysisId: string;
  generatedAt: string;
  datasetMetadata: AnalysisResponse['datasetMetadata'];
  configuration: AnalysisResponse['config'];
  indexSummaries: AnalysisResponse['indexSummaries'];
  summaryStatistics: AnalysisResponse['summary'];
  retainedComponents: Array<Omit<AnalysisResponse['components']['retained'][number], 'pixels'>>;
  filteredOutComponents: Array<Omit<AnalysisResponse['components']['filteredOut'][number], 'pixels'>>;
  warnings: string[];
  limitations: string[];
}

/**
 * Serializes the reproducible analysis summary as formatted JSON.
 */
export function serializeAnalysisSummaryJson(analysis: AnalysisResponse): string {
  const report: ReproducibleSummaryReport = {
    reportSchemaVersion: '1.0',
    analysisId: analysis.analysisId,
    generatedAt: analysis.timestamp,
    datasetMetadata: analysis.datasetMetadata,
    configuration: analysis.config,
    indexSummaries: analysis.indexSummaries,
    summaryStatistics: analysis.summary,
    retainedComponents: analysis.components.retained.map(({ pixels: _pixels, ...rest }) => rest),
    filteredOutComponents: analysis.components.filteredOut.map(
      ({ pixels: _pixels, ...rest }) => rest
    ),
    warnings: analysis.warnings,
    limitations: analysis.limitations
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Serializes the pixel-level change mask and classification details as CSV.
 * Every pixel (row, col) is exported with its validity, before/after NDVI,
 * absolute change, candidate status, retained status, classification code/label, and component ID.
 */
export function serializeChangeMaskCsv(analysis: AnalysisResponse): string {
  const { width, height } = analysis.datasetMetadata;
  const {
    beforeNdvi,
    afterNdvi,
    signedChange,
    absoluteChange,
    commonValidMask,
    candidateChangeMask,
    retainedChangeMask,
    classificationMask,
    componentLabelMask
  } = analysis.rasters;

  const lines: string[] = [];
  lines.push(
    'row,col,common_valid,before_ndvi,after_ndvi,signed_change,absolute_change,candidate_changed,retained_changed,classification_code,classification_label,component_id'
  );

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const valid = commonValidMask[r][c];
      const bNdvi = beforeNdvi[r][c] !== null ? beforeNdvi[r][c]!.toFixed(6) : '';
      const aNdvi = afterNdvi[r][c] !== null ? afterNdvi[r][c]!.toFixed(6) : '';
      const sDiff = signedChange[r][c] !== null ? signedChange[r][c]!.toFixed(6) : '';
      const aDiff = absoluteChange[r][c] !== null ? absoluteChange[r][c]!.toFixed(6) : '';
      const cand = candidateChangeMask[r][c];
      const ret = retainedChangeMask[r][c];
      const code = classificationMask[r][c];
      const label = classificationCodeToLabel(code);
      const compId = componentLabelMask[r][c];

      lines.push(
        `${r},${c},${valid},${bNdvi},${aNdvi},${sDiff},${aDiff},${cand},${ret},${code},${label},${compId}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Serializes the pixel-level change masks and metadata as JSON.
 */
export function serializeChangeMaskJson(analysis: AnalysisResponse): string {
  const payload = {
    reportSchemaVersion: '1.0',
    analysisId: analysis.analysisId,
    datasetMetadata: analysis.datasetMetadata,
    configuration: analysis.config,
    legend: {
      classificationMaskCodes: {
        '-1': 'INVALID (excluded by validity mask or zero NDVI denominator)',
        '0': 'UNCHANGED (eligible pixel below threshold)',
        '1': 'FILTERED_CANDIDATE_CHANGE (exceeded threshold but removed by minComponentSize)',
        '2': 'RETAINED_CHANGE (exceeded threshold and belongs to retained component)'
      },
      retainedChangeMaskCodes: {
        '0': 'Not retained change',
        '1': 'Retained change pixel'
      },
      invalidMaskCodes: {
        '0': 'Eligible pixel (valid on both dates)',
        '1': 'Invalid pixel (excluded from comparison)'
      }
    },
    summaryTotals: {
      totalPixels: analysis.summary.totalPixels,
      eligiblePixelCount: analysis.summary.eligiblePixelCount,
      invalidPixelCount: analysis.summary.invalidPixelCount,
      candidateChangedPixelCount: analysis.summary.candidateChangedPixelCount,
      filteredOutChangedPixelCount: analysis.summary.filteredOutChangedPixelCount,
      retainedChangedPixelCount: analysis.summary.retainedChangedPixelCount,
      retainedComponentCount: analysis.summary.retainedComponentCount,
      retainedChangeAreaSquareMeters: analysis.summary.retainedChangeAreaSquareMeters,
      retainedChangeAreaHectares: analysis.summary.retainedChangeAreaHectares
    },
    masks: {
      retainedChangeMask: analysis.rasters.retainedChangeMask,
      candidateChangeMask: analysis.rasters.candidateChangeMask,
      invalidMask: analysis.rasters.invalidMask,
      commonValidMask: analysis.rasters.commonValidMask,
      classificationMask: analysis.rasters.classificationMask,
      componentLabelMask: analysis.rasters.componentLabelMask
    }
  };

  return JSON.stringify(payload, null, 2);
}
