import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  buildIncompatibleDataset,
  buildMultiComponentDataset,
  buildRectangularChangeDataset
} from '../src/utils/generateSamples';

const app = createApp();

describe('PS08 Express REST API — Integration Tests (Scenarios 19–22 & Server Exports)', () => {
  it('Scenario 21: GET /api/health returns service status and version without external credentials', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.service).toBe('ps08-land-change-backend');
  });

  it('Scenario 22: GET /api/examples and GET /api/examples/:datasetId return bundled synthetic datasets', async () => {
    const listRes = await request(app).get('/api/examples');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.datasets)).toBe(true);
    expect(listRes.body.datasets.length).toBeGreaterThanOrEqual(4);

    const singleRes = await request(app).get('/api/examples/synthetic-rect-change-002');
    expect(singleRes.status).toBe(200);
    expect(singleRes.body.datasetId).toBe('synthetic-rect-change-002');
    expect(singleRes.body.origin).toBe('synthetic');
    expect(singleRes.body.before.width).toBe(24);

    const notFoundRes = await request(app).get('/api/examples/non-existent-dataset-999');
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error).toBe('DATASET_NOT_FOUND');
  });

  it('Scenario 20: POST /api/analyze returns complete deterministic report, masks, components, directional breakdown, and sensitivity profile', async () => {
    const dataset = buildMultiComponentDataset();
    const res = await request(app)
      .post('/api/analyze')
      .send({
        dataset,
        config: {
          threshold: 0.25,
          minComponentSize: 6,
          connectivity: 8
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.datasetMetadata.datasetId).toBe('synthetic-multi-component-004');
    expect(res.body.summary.totalPixels).toBe(900);
    expect(res.body.summary.retainedChangedPixelCount).toBe(97);
    expect(res.body.summary.retainedDecreasePixelCount).toBe(81); // 24 + 45 + 12
    expect(res.body.summary.retainedIncreasePixelCount).toBe(16); // 16-pixel South-East gain patch
    expect(res.body.summary.retainedChangeAreaSquareMeters).toBe(9700);
    expect(res.body.summary.retainedChangeAreaHectares).toBe(0.97);
    expect(res.body.components.retained.length).toBe(4);
    expect(Array.isArray(res.body.sensitivityProfile)).toBe(true);
    expect(res.body.sensitivityProfile.length).toBe(10);
    expect(Array.isArray(res.body.rasters.retainedChangeMask)).toBe(true);
    expect(Array.isArray(res.body.rasters.invalidMask)).toBe(true);
    expect(typeof res.body.processingDurationMs).toBe('number');
  });

  it('Scenario 19: POST /api/validate and POST /api/analyze return HTTP 400 with actionable issues on incompatible or invalid requests', async () => {
    const incompatibleDs = buildIncompatibleDataset();

    const valRes = await request(app).post('/api/validate').send({ dataset: incompatibleDs });
    expect(valRes.status).toBe(400);
    expect(valRes.body.valid).toBe(false);
    expect(valRes.body.issues.some((i: { code: string }) => i.code === 'DIMENSION_MISMATCH')).toBe(
      true
    );
    expect(valRes.body.issues.some((i: { code: string }) => i.code === 'ALIGNMENT_MISMATCH')).toBe(
      true
    );

    const analyzeRes = await request(app).post('/api/analyze').send({
      dataset: incompatibleDs,
      config: { threshold: 0.25, minComponentSize: 6, connectivity: 8 }
    });
    expect(analyzeRes.status).toBe(400);
    expect(analyzeRes.body.error).toBe('VALIDATION_FAILED');

    // Negative threshold should also be rejected with HTTP 400
    const validDs = buildRectangularChangeDataset();
    const badConfigRes = await request(app).post('/api/analyze').send({
      dataset: validDs,
      config: { threshold: -0.5, minComponentSize: 0, connectivity: 8 }
    });
    expect(badConfigRes.status).toBe(400);
    expect(
      badConfigRes.body.issues.some((i: { code: string }) => i.code === 'INVALID_CONFIGURATION')
    ).toBe(true);
  });

  it('POST /api/export/summary, /api/export/mask-csv, and /api/export/mask-json return downloadable attachments', async () => {
    const dataset = buildRectangularChangeDataset();
    const payload = {
      dataset,
      config: { threshold: 0.25, minComponentSize: 6, connectivity: 8 }
    };

    const sumRes = await request(app).post('/api/export/summary').send(payload);
    expect(sumRes.status).toBe(200);
    expect(sumRes.headers['content-disposition']).toContain('synthetic-rect-change-002-summary.json');

    const csvRes = await request(app).post('/api/export/mask-csv').send(payload);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text.split('\n').length).toBe(576 + 1);

    const maskJsonRes = await request(app).post('/api/export/mask-json').send(payload);
    expect(maskJsonRes.status).toBe(200);
    expect(maskJsonRes.body.summaryTotals.retainedChangedPixelCount).toBe(64);
  });

  it('GET /api/docs returns OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/api/analyze']).toBeDefined();
  });
});
