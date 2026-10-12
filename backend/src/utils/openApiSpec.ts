export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'GeoVision — PS08 Satellite Land Change Detection API',
    version: '1.0.0',
    description:
      'Deterministic geospatial land-change detection engine for Cerevyn PS08. Validates temporal image pairs, computes NDVI, applies per-date validity masks, thresholds |ΔNDVI|, labels connected change components (4/8-connectivity), filters small noise clusters, and calculates affected areas in square meters and hectares.'
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server'
    }
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Service health and version check',
        operationId: 'getHealth',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Service is operational',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  service: 'ps08-land-change-backend',
                  version: '1.0.0',
                  engine: 'deterministic-ndvi-connected-components',
                  timestamp: '2026-06-01T00:00:00.000Z'
                }
              }
            }
          }
        }
      }
    },
    '/api/examples': {
      get: {
        summary: 'List bundled synthetic demonstration datasets',
        operationId: 'listExamples',
        tags: ['Datasets'],
        responses: {
          '200': {
            description: 'Array of available synthetic datasets with metadata and recommended configuration'
          }
        }
      }
    },
    '/api/examples/{datasetId}': {
      get: {
        summary: 'Fetch a complete synthetic dataset by datasetId',
        operationId: 'getExampleById',
        tags: ['Datasets'],
        parameters: [
          {
            name: 'datasetId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'synthetic-multi-component-004'
          }
        ],
        responses: {
          '200': {
            description: 'Complete temporal dataset JSON including before and after bands and validity masks'
          },
          '404': {
            description: 'Dataset not found'
          }
        }
      }
    },
    '/api/validate': {
      post: {
        summary: 'Validate dataset schema, band definitions, dimensions, and temporal alignment',
        operationId: 'validateDataset',
        tags: ['Analysis'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Either a LandChangeDataset object directly or { dataset, config }'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Dataset and configuration passed all validation and compatibility checks'
          },
          '400': {
            description: 'Validation failed with actionable field-level and dataset-level issues'
          }
        }
      }
    },
    '/api/analyze': {
      post: {
        summary: 'Run deterministic NDVI land-change detection, connected-component grouping, and area calculation',
        operationId: 'analyzeDataset',
        tags: ['Analysis'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['dataset'],
                properties: {
                  dataset: { type: 'object' },
                  config: {
                    type: 'object',
                    properties: {
                      threshold: { type: 'number', minimum: 0, maximum: 2.0, default: 0.25 },
                      minComponentSize: { type: 'integer', minimum: 1, default: 6 },
                      connectivity: { type: 'integer', enum: [4, 8], default: 8 }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Full deterministic analysis report, component catalog, and pixel-level masks'
          },
          '400': {
            description: 'Malformed input, incompatible temporal slices, or invalid configuration'
          }
        }
      }
    },
    '/api/docs': {
      get: {
        summary: 'OpenAPI 3.0 specification for the PS08 API',
        operationId: 'getApiDocs',
        tags: ['System'],
        responses: {
          '200': {
            description: 'OpenAPI 3.0 JSON specification'
          }
        }
      }
    }
  }
};
