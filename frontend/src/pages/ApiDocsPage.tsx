import React, { useEffect, useState } from 'react';
import { CheckCircle2, Code2, ExternalLink, Play, Server } from 'lucide-react';
import { API_BASE_URL, fetchHealthStatus, fetchOpenApiSpec } from '../services/api';

const ENDPOINTS_SUMMARY = [
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Returns service health status, version, and deterministic engine identifier (no credentials required).'
  },
  {
    method: 'GET',
    path: '/api/examples',
    summary: 'Lists all bundled synthetic demonstration datasets with dimensions, dates, and recommended parameters.'
  },
  {
    method: 'GET',
    path: '/api/examples/:datasetId',
    summary: 'Returns the complete temporal dataset JSON (including before/after red & nir bands and validity masks).'
  },
  {
    method: 'POST',
    path: '/api/validate',
    summary: 'Validates dataset schema, band definitions, minimum 20×20 dimensions, pixel size, and alignmentId without running full analysis.'
  },
  {
    method: 'POST',
    path: '/api/analyze',
    summary: 'Runs the full 10-step deterministic NDVI change detection, connected-component grouping, filtering, and area calculation.'
  },
  {
    method: 'GET',
    path: '/api/docs',
    summary: 'Returns the OpenAPI 3.0.3 JSON specification (or interactive Swagger UI HTML with ?format=html).'
  }
];

export const ApiDocsPage: React.FC = () => {
  const [healthJson, setHealthJson] = useState<string | null>(null);
  const [openApiSpec, setOpenApiSpec] = useState<Record<string, unknown> | null>(null);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    fetchOpenApiSpec()
      .then((spec) => setOpenApiSpec(spec))
      .catch(() => setOpenApiSpec(null));
  }, []);

  const handleProbeHealth = async () => {
    setProbing(true);
    try {
      const res = await fetchHealthStatus();
      setHealthJson(JSON.stringify(res, null, 2));
    } catch (err) {
      setHealthJson(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Health check failed' },
          null,
          2
        )
      );
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                REST API &amp; OpenAPI 3.0 Documentation
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Stateless Express + TypeScript + Zod backend API for PS08 Satellite Land Change Detection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProbeHealth}
              disabled={probing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Test GET /api/health
            </button>
            <a
              href={`${API_BASE_URL || ''}/api/docs?format=html`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span>Open Swagger UI</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {healthJson && (
          <div className="mt-4 rounded-xl bg-slate-900 p-4 font-mono text-xs text-emerald-300">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-sans font-semibold text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Live Response from GET /api/health:
            </div>
            <pre className="overflow-x-auto">{healthJson}</pre>
          </div>
        )}
      </div>

      {/* Endpoints Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h3 className="mb-4 text-base font-bold text-slate-900">Implemented API Endpoints</h3>
        <div className="space-y-3">
          {ENDPOINTS_SUMMARY.map((ep) => (
            <div
              key={ep.path}
              className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block w-16 rounded-lg py-1 text-center font-mono text-xs font-bold ${
                    ep.method === 'GET'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {ep.method}
                </span>
                <code className="font-mono text-xs font-bold text-slate-900 sm:text-sm">
                  {ep.path}
                </code>
              </div>
              <p className="text-xs text-slate-600 sm:max-w-xl sm:text-right">{ep.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Input Contract & OpenAPI Spec Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Code2 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm">Example POST /api/analyze Request Body</h3>
          </div>
          <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200">
{`{
  "config": {
    "threshold": 0.25,
    "minComponentSize": 6,
    "connectivity": 8
  },
  "dataset": {
    "schemaVersion": "1.0",
    "datasetId": "synthetic-demo-001",
    "origin": "synthetic",
    "description": "Synthetic land-change demonstration",
    "before": {
      "date": "2026-01-01",
      "width": 20,
      "height": 20,
      "alignmentId": "demo-grid-001",
      "pixelWidthMeters": 10,
      "pixelHeightMeters": 10,
      "bands": {
        "red": [[0.12, 0.14, "... (20x20 finite values in [0,1])"]],
        "nir": [[0.68, 0.70, "... (20x20 finite values in [0,1])"]]
      },
      "validMask": [[1, 1, "... (20x20 binary 0/1 values)"]]
    },
    "after": {
      "date": "2026-06-01",
      "width": 20,
      "height": 20,
      "alignmentId": "demo-grid-001",
      "pixelWidthMeters": 10,
      "pixelHeightMeters": 10,
      "bands": {
        "red": [[0.36, 0.35, "..."]],
        "nir": [[0.44, 0.45, "..."]]
      },
      "validMask": [[1, 1, "..."]]
    }
  }
}`}
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Code2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm">Live OpenAPI 3.0 Spec (from GET /api/docs)</h3>
          </div>
          <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
            {openApiSpec
              ? JSON.stringify(openApiSpec, null, 2)
              : 'Loading OpenAPI 3.0 specification from /api/docs...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
