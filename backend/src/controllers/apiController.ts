import { Request, Response } from 'express';
import {
  serializeAnalysisSummaryJson,
  serializeChangeMaskCsv,
  serializeChangeMaskJson
} from '../algorithms/exportSerializer';
import { runLandChangeAnalysis } from '../algorithms/reportGenerator';
import {
  getExampleDatasetById,
  listExampleDatasets
} from '../services/datasetService';
import { OPENAPI_SPEC } from '../utils/openApiSpec';
import { validateCompletePayload } from '../validation/compatibilityChecker';

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'ps08-land-change-backend',
    version: '1.0.0',
    engine: 'deterministic-ndvi-connected-components',
    timestamp: new Date().toISOString()
  });
}

export function getExamples(_req: Request, res: Response): void {
  const datasets = listExampleDatasets();
  res.status(200).json({
    count: datasets.length,
    datasets
  });
}

export function getExampleById(req: Request, res: Response): void {
  const { datasetId } = req.params;
  if (!datasetId) {
    res.status(400).json({
      error: 'MISSING_DATASET_ID',
      message: 'datasetId path parameter is required.'
    });
    return;
  }

  const dataset = getExampleDatasetById(datasetId);
  if (!dataset) {
    res.status(404).json({
      error: 'DATASET_NOT_FOUND',
      message: `Synthetic dataset "${datasetId}" was not found.`
    });
    return;
  }

  res.status(200).json(dataset);
}

export function postValidate(req: Request, res: Response): void {
  const { result } = validateCompletePayload(req.body, false);

  if (!result.valid) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      ...result
    });
    return;
  }

  res.status(200).json(result);
}

export function postAnalyze(req: Request, res: Response): void {
  const { result, dataset, config } = validateCompletePayload(req.body, true);

  if (!result.valid || !dataset || !config) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      valid: false,
      issues: result.issues,
      warnings: result.warnings
    });
    return;
  }

  const analysisResponse = runLandChangeAnalysis(dataset, config);
  res.status(200).json(analysisResponse);
}

export function postExportSummary(req: Request, res: Response): void {
  const { result, dataset, config } = validateCompletePayload(req.body, true);
  if (!result.valid || !dataset || !config) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      valid: false,
      issues: result.issues,
      warnings: result.warnings
    });
    return;
  }

  const analysis = runLandChangeAnalysis(dataset, config);
  const json = serializeAnalysisSummaryJson(analysis);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${dataset.datasetId}-summary.json"`
  );
  res.status(200).send(json);
}

export function postExportMaskCsv(req: Request, res: Response): void {
  const { result, dataset, config } = validateCompletePayload(req.body, true);
  if (!result.valid || !dataset || !config) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      valid: false,
      issues: result.issues,
      warnings: result.warnings
    });
    return;
  }

  const analysis = runLandChangeAnalysis(dataset, config);
  const csv = serializeChangeMaskCsv(analysis);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${dataset.datasetId}-change-mask.csv"`
  );
  res.status(200).send(csv);
}

export function postExportMaskJson(req: Request, res: Response): void {
  const { result, dataset, config } = validateCompletePayload(req.body, true);
  if (!result.valid || !dataset || !config) {
    res.status(400).json({
      error: 'VALIDATION_FAILED',
      valid: false,
      issues: result.issues,
      warnings: result.warnings
    });
    return;
  }

  const analysis = runLandChangeAnalysis(dataset, config);
  const json = serializeChangeMaskJson(analysis);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${dataset.datasetId}-change-mask.json"`
  );
  res.status(200).send(json);
}

export function getDocs(req: Request, res: Response): void {
  if (req.query.format === 'html') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GeoVision PS08 — OpenAPI Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body style="margin:0;background:#f8fafc;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui'
      });
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
    return;
  }

  res.status(200).json(OPENAPI_SPEC);
}
