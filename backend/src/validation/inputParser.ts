import { AnalysisConfig, ValidationIssue } from '../types/landChange';

export interface ParsedAnalyzeRequest {
  dataset: unknown;
  configInput: unknown;
  parseIssues: ValidationIssue[];
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  threshold: 0.25,
  minComponentSize: 6,
  connectivity: 8
};

/**
 * Parses raw input payload (either direct dataset object or { dataset, config } envelope)
 * and extracts dataset and configuration objects without mutating input.
 */
export function parseRawInput(payload: unknown): ParsedAnalyzeRequest {
  const parseIssues: ValidationIssue[] = [];

  if (payload === null || payload === undefined) {
    parseIssues.push({
      field: 'body',
      code: 'EMPTY_PAYLOAD',
      message: 'Request payload is missing or null.'
    });
    return { dataset: null, configInput: DEFAULT_ANALYSIS_CONFIG, parseIssues };
  }

  let parsedPayload = payload;
  if (typeof payload === 'string') {
    try {
      parsedPayload = JSON.parse(payload);
    } catch (err) {
      parseIssues.push({
        field: 'body',
        code: 'INVALID_JSON',
        message: `Malformed JSON string: ${err instanceof Error ? err.message : 'Unable to parse JSON'}`
      });
      return { dataset: null, configInput: DEFAULT_ANALYSIS_CONFIG, parseIssues };
    }
  }

  if (typeof parsedPayload !== 'object' || Array.isArray(parsedPayload) || parsedPayload === null) {
    parseIssues.push({
      field: 'body',
      code: 'INVALID_PAYLOAD_TYPE',
      message: 'Payload must be a JSON object.'
    });
    return { dataset: null, configInput: DEFAULT_ANALYSIS_CONFIG, parseIssues };
  }

  const record = parsedPayload as Record<string, unknown>;

  // Support both { dataset: {...}, config: {...} } and direct dataset payload with optional top-level config
  if ('dataset' in record && record.dataset !== undefined) {
    const rawDataset = record.dataset;
    const rawConfig = record.config ?? {
      threshold: record.threshold,
      minComponentSize: record.minComponentSize,
      connectivity: record.connectivity
    };
    return {
      dataset: rawDataset,
      configInput: rawConfig,
      parseIssues
    };
  }

  const rawConfig = record.config ?? {
    threshold: record.threshold ?? (record.recommendedConfig as Record<string, unknown> | undefined)?.threshold,
    minComponentSize:
      record.minComponentSize ?? (record.recommendedConfig as Record<string, unknown> | undefined)?.minComponentSize,
    connectivity:
      record.connectivity ?? (record.recommendedConfig as Record<string, unknown> | undefined)?.connectivity
  };

  return {
    dataset: record,
    configInput: rawConfig,
    parseIssues
  };
}
