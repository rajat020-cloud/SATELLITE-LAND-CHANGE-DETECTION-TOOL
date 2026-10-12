import {
  AnalysisConfig,
  AnalysisResponse,
  DatasetCatalogEntry,
  LandChangeDataset,
  ValidationResult
} from '../types/landChange';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

export const API_BASE_URL = getApiBaseUrl();

export class ApiValidationError extends Error {
  public readonly status: number;
  public readonly validationResult: ValidationResult;

  constructor(message: string, status: number, validationResult: ValidationResult) {
    super(message);
    this.name = 'ApiValidationError';
    this.status = status;
    this.validationResult = validationResult;
  }
}

export async function fetchHealthStatus(): Promise<{
  status: string;
  service: string;
  version: string;
  engine: string;
  timestamp: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchExampleCatalog(): Promise<DatasetCatalogEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/examples`);
  if (!res.ok) {
    throw new Error(`Failed to load example dataset catalog (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.datasets ?? [];
}

export async function fetchExampleDataset(datasetId: string): Promise<LandChangeDataset> {
  const res = await fetch(`${API_BASE_URL}/api/examples/${encodeURIComponent(datasetId)}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Failed to load dataset "${datasetId}" (HTTP ${res.status})`);
  }
  return res.json();
}

export async function validateDatasetOnServer(
  dataset: unknown,
  config?: Partial<AnalysisConfig>
): Promise<ValidationResult> {
  const res = await fetch(`${API_BASE_URL}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, config })
  });

  const body = await res.json().catch(() => ({
    valid: false,
    issues: [{ field: 'response', code: 'PARSE_ERROR', message: 'Invalid server response' }],
    warnings: []
  }));

  return {
    valid: Boolean(body.valid),
    issues: Array.isArray(body.issues) ? body.issues : [],
    warnings: Array.isArray(body.warnings) ? body.warnings : [],
    summary: body.summary
  };
}

export async function runAnalysisOnServer(
  dataset: unknown,
  config: AnalysisConfig
): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset, config })
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body) {
    const validationResult: ValidationResult = {
      valid: false,
      issues: Array.isArray(body?.issues)
        ? body.issues
        : [
            {
              field: 'dataset',
              code: body?.error || 'ANALYSIS_ERROR',
              message: body?.message || `Analysis failed with HTTP status ${res.status}`
            }
          ],
      warnings: Array.isArray(body?.warnings) ? body.warnings : []
    };
    throw new ApiValidationError(
      validationResult.issues[0]?.message || 'Dataset validation failed',
      res.status,
      validationResult
    );
  }

  return body as AnalysisResponse;
}

export async function fetchOpenApiSpec(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE_URL}/api/docs`);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI specification (HTTP ${res.status})`);
  }
  return res.json();
}
