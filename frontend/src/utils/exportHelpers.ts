import { AnalysisResponse, PixelClassificationCode } from '../types/landChange';
import { getComponentColor, hexToRgb } from './colorScales';

export function classificationCodeToLabel(code: PixelClassificationCode): string {
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

export function buildSummaryExportObject(analysis: AnalysisResponse) {
  return {
    reportSchemaVersion: '1.0',
    analysisId: analysis.analysisId,
    generatedAt: analysis.timestamp,
    datasetMetadata: analysis.datasetMetadata,
    configuration: analysis.config,
    indexSummaries: analysis.indexSummaries,
    summaryStatistics: analysis.summary,
    retainedComponents: analysis.components.retained.map(({ pixels: _p, ...rest }) => rest),
    filteredOutComponents: analysis.components.filteredOut.map(({ pixels: _p, ...rest }) => rest),
    warnings: analysis.warnings,
    limitations: analysis.limitations
  };
}

export function buildMaskCsvString(analysis: AnalysisResponse): string {
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

export function buildMaskJsonString(analysis: AnalysisResponse): string {
  const payload = {
    reportSchemaVersion: '1.0',
    analysisId: analysis.analysisId,
    datasetMetadata: analysis.datasetMetadata,
    configuration: analysis.config,
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

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadSummaryJson(analysis: AnalysisResponse): void {
  const json = JSON.stringify(buildSummaryExportObject(analysis), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerFileDownload(blob, `${analysis.datasetMetadata.datasetId}-summary.json`);
}

export function downloadChangeMaskCsv(analysis: AnalysisResponse): void {
  const csv = buildMaskCsvString(analysis);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerFileDownload(blob, `${analysis.datasetMetadata.datasetId}-change-mask.csv`);
}

export function downloadChangeMaskJson(analysis: AnalysisResponse): void {
  const json = buildMaskJsonString(analysis);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerFileDownload(blob, `${analysis.datasetMetadata.datasetId}-change-mask.json`);
}

export function downloadChangeMaskPng(analysis: AnalysisResponse): void {
  const { width, height, datasetId, beforeDate, afterDate } = analysis.datasetMetadata;
  const { classificationMask, componentLabelMask } = analysis.rasters;

  const scale = Math.max(12, Math.floor(480 / Math.max(width, height)));
  const headerHeight = 64;
  const footerHeight = 48;
  const canvasWidth = Math.max(480, width * scale);
  const canvasHeight = height * scale + headerHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#0b1323';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Header metadata
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(`PS08 Change Mask — ${datasetId} (${beforeDate} → ${afterDate})`, 16, 26);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(
    `Threshold: |ΔNDVI| >= ${analysis.config.threshold} | Min Size: ${analysis.config.minComponentSize} px | Retained: ${analysis.summary.retainedChangedPixelCount} px (${analysis.summary.retainedChangeAreaHectares} ha)`,
    16,
    46
  );

  const offsetX = Math.floor((canvasWidth - width * scale) / 2);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const code = classificationMask[r][c];
      let rgb: [number, number, number] = [10, 46, 36];
      if (code === -1) {
        rgb = [148, 163, 184]; // Invalid
      } else if (code === 0) {
        rgb = [12, 58, 42]; // Unchanged eligible
      } else if (code === 1) {
        rgb = [245, 158, 11]; // Filtered candidate
      } else if (code === 2) {
        const compId = componentLabelMask[r][c];
        rgb = compId > 0 ? hexToRgb(getComponentColor(compId)) : [239, 68, 68];
      }
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(offsetX + c * scale, headerHeight + r * scale, scale, scale);
    }
  }

  // Footer Legend
  const legendY = headerHeight + height * scale + 28;
  const items = [
    { label: 'Retained Change', color: '#ef4444' },
    { label: 'Filtered (< Min Size)', color: '#f59e0b' },
    { label: 'Unchanged Eligible', color: '#0c3a2a' },
    { label: 'Invalid / Masked', color: '#94a3b8' }
  ];
  let curX = 16;
  ctx.font = '11px Inter, sans-serif';
  for (const item of items) {
    ctx.fillStyle = item.color;
    ctx.fillRect(curX, legendY - 10, 12, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(item.label, curX + 18, legendY);
    curX += ctx.measureText(item.label).width + 38;
  }

  canvas.toBlob((blob) => {
    if (blob) {
      triggerFileDownload(blob, `${datasetId}-change-mask.png`);
    }
  }, 'image/png');
}
