import React, { useState } from 'react';
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  CheckSquare,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  Image as ImageIcon,
  Info,
  Play,
  Settings,
  Users
} from 'lucide-react';
import { KpiCards } from '../components/KpiCards';
import { RasterVisualizer } from '../components/RasterVisualizer';
import {
  AnalysisConfig,
  AnalysisResponse,
  ConnectivityType,
  NavigationTab,
  ValidationResult
} from '../types/landChange';
import { getComponentColor } from '../utils/colorScales';
import {
  downloadChangeMaskCsv,
  downloadChangeMaskJson,
  downloadChangeMaskPng,
  downloadSummaryJson
} from '../utils/exportHelpers';

interface OverviewPageProps {
  analysis: AnalysisResponse | null;
  config: AnalysisConfig;
  onChangeConfig: (newConfig: AnalysisConfig) => void;
  onRunAnalysis: () => void;
  onValidateDataset: () => void;
  validationStatus: ValidationResult | null;
  errorMessage: string | null;
  isLoading: boolean;
  onNavigate: (tab: NavigationTab) => void;
  onLoadDefaultSample: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  analysis,
  config,
  onChangeConfig,
  onRunAnalysis,
  onValidateDataset,
  validationStatus,
  errorMessage,
  isLoading,
  onNavigate,
  onLoadDefaultSample
}) => {
  const [highlightedComponentId, setHighlightedComponentId] = useState<number | null>(null);
  const [showFilteredOutTab, setShowFilteredOutTab] = useState(false);

  const handleThresholdInput = (val: string) => {
    const parsed = parseFloat(val);
    if (!Number.isNaN(parsed)) {
      onChangeConfig({ ...config, threshold: Math.max(0, Math.min(2, parsed)) });
    }
  };

  const handleMinSizeInput = (val: string) => {
    const parsed = parseInt(val, 10);
    if (!Number.isNaN(parsed)) {
      onChangeConfig({ ...config, minComponentSize: Math.max(1, parsed) });
    }
  };

  if (!analysis && !isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <BarChart2 className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">No Active Land Change Analysis</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-slate-500">
          Select one of the bundled deterministic synthetic datasets or upload your own aligned temporal dataset JSON to run NDVI change detection and connected-component area analysis.
        </p>
        {errorMessage && (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-xs text-rose-800">
            <div className="font-semibold">Validation / Analysis Error:</div>
            <div className="mt-1">{errorMessage}</div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onLoadDefaultSample}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            <Play className="h-4 w-4" />
            Load Demo Dataset &amp; Analyze
          </button>
          <button
            type="button"
            onClick={() => onNavigate('new-analysis')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Upload or Configure Dataset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Error / Validation Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-1">
            <div className="font-bold">Validation or Analysis Rejected</div>
            <p className="text-xs text-rose-700">{errorMessage}</p>
            {validationStatus && validationStatus.issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {validationStatus.issues.map((issue, idx) => (
                  <li key={idx}>
                    <span className="font-mono font-semibold">[{issue.code}]</span>{' '}
                    <span className="font-semibold">{issue.field}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {validationStatus && validationStatus.valid && !errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Dataset schema, bands (red, nir), grid dimensions, and alignmentId verified compatible.
          </span>
          <span className="font-mono text-[11px] text-emerald-700">
            {validationStatus.summary?.width}×{validationStatus.summary?.height} px •{' '}
            {validationStatus.summary?.alignmentId}
          </span>
        </div>
      )}

      {analysis && (
        <>
          {/* 5 Top KPI Cards */}
          <KpiCards analysis={analysis} />

          {/* 4 Side-by-Side Raster Visualizations */}
          <RasterVisualizer
            analysis={analysis}
            highlightedComponentId={highlightedComponentId}
            onClearHighlight={() => setHighlightedComponentId(null)}
          />

          {/* Bottom 3-Column Section matching the GeoVision Dashboard */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* LEFT COLUMN: Analysis Configuration */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs lg:col-span-4">
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Settings className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Analysis Configuration</h2>
                </div>

                {/* Change Threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="threshold-input"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Change Threshold (NDVI difference)
                    </label>
                    <input
                      id="threshold-input"
                      type="number"
                      step="0.01"
                      min="0"
                      max="2.0"
                      value={config.threshold}
                      onChange={(e) => handleThresholdInput(e.target.value)}
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <input
                    type="range"
                    aria-label="Change threshold slider"
                    min="0.05"
                    max="1.0"
                    step="0.01"
                    value={Math.min(1.0, config.threshold)}
                    onChange={(e) => handleThresholdInput(e.target.value)}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-indigo-100 accent-indigo-600"
                  />
                  <p className="text-[11px] text-slate-500">
                    Pixels with <code className="font-mono font-semibold text-slate-700">|ΔNDVI| ≥ {config.threshold}</code> are marked as candidate changes.
                  </p>
                </div>

                {/* Minimum Component Size */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="min-size-input"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Minimum Component Size (pixels)
                    </label>
                    <input
                      id="min-size-input"
                      type="number"
                      step="1"
                      min="1"
                      max="500"
                      value={config.minComponentSize}
                      onChange={(e) => handleMinSizeInput(e.target.value)}
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <input
                    type="range"
                    aria-label="Minimum component size slider"
                    min="1"
                    max="50"
                    step="1"
                    value={Math.min(50, config.minComponentSize)}
                    onChange={(e) => handleMinSizeInput(e.target.value)}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-indigo-100 accent-indigo-600"
                  />
                  <p className="text-[11px] text-slate-500">
                    Connected groups with fewer than <strong className="text-slate-700">{config.minComponentSize} pixels</strong> ({config.minComponentSize * analysis.summary.pixelAreaSquareMeters} m²) are filtered out.
                  </p>
                </div>

                {/* Connectivity Convention */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="connectivity-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Connectivity Convention
                  </label>
                  <select
                    id="connectivity-select"
                    value={config.connectivity}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        connectivity: Number(e.target.value) as ConnectivityType
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={8}>8-connected (default — orthogonal + diagonal)</option>
                    <option value={4}>4-connected (orthogonal neighbors only)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-2.5 pt-4">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onRunAnalysis}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isLoading ? 'Running Analysis...' : 'Run Analysis'}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onValidateDataset}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  Validate Dataset
                </button>
              </div>
            </div>

            {/* CENTER COLUMN: Change Statistics + Interpretation Notes */}
            <div className="flex flex-col gap-5 lg:col-span-4">
              {/* Change Statistics Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <BarChart2 className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Change Statistics</h2>
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Total Grid Pixels</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {analysis.summary.totalPixels.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Valid Pixels (both dates / eligible)</dt>
                    <dd className="font-mono font-bold text-emerald-700">
                      {analysis.summary.eligiblePixelCount.toLocaleString()} ({analysis.summary.validCoveragePercentage}%)
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Invalid / Cloud-Masked Pixels</dt>
                    <dd className="font-mono font-bold text-slate-700">
                      {analysis.summary.invalidPixelCount.toLocaleString()} ({analysis.summary.invalidPercentage}%)
                    </dd>
                  </div>

                  <div className="my-2 border-t border-slate-100" />

                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Candidate Changed Pixels</dt>
                    <dd className="font-mono font-bold text-amber-700">
                      {analysis.summary.candidateChangedPixelCount.toLocaleString()}{' '}
                      ({analysis.summary.candidateChangedPercentage !== null ? `${analysis.summary.candidateChangedPercentage}%` : 'N/A'})
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Removed by Min-Size Filter</dt>
                    <dd className="font-mono font-semibold text-slate-600">
                      {analysis.summary.filteredOutChangedPixelCount.toLocaleString()} px ({analysis.summary.filteredOutComponentCount} groups)
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Retained Changed Pixels</dt>
                    <dd className="font-mono font-bold text-rose-600">
                      {analysis.summary.retainedChangedPixelCount.toLocaleString()}{' '}
                      ({analysis.summary.retainedChangedPercentage !== null ? `${analysis.summary.retainedChangedPercentage}%` : 'N/A'})
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-600">Number of Retained Change Groups</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {analysis.summary.retainedComponentCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <dt className="font-semibold text-slate-800">Total Retained Change Area</dt>
                    <dd className="font-mono font-bold text-indigo-700">
                      {analysis.summary.retainedChangeAreaHectares.toFixed(2)} ha ({analysis.summary.retainedChangeAreaSquareMeters.toLocaleString()} m²)
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
                  <strong className="text-slate-700">Denominator Rule:</strong> Candidate and retained change percentages use <code>eligiblePixelCount</code> ({analysis.summary.eligiblePixelCount.toLocaleString()} px valid on both dates) as the denominator—never including invalid pixels.
                </div>
              </div>

              {/* Interpretation Notes Card */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-2xs">
                <div className="mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900">Interpretation Notes &amp; Limitations</h3>
                </div>
                <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-slate-600">
                  <li>
                    <strong>Image difference ≠ verified event:</strong> Detected changes indicate spectral index (NDVI) differences between the two dates. They do not automatically confirm deforestation, construction, or hazard damage.
                  </li>
                  <li>
                    Results are sensitive to unmasked clouds, cloud shadows, seasonal phenology, solar illumination differences, and sub-pixel co-registration errors.
                  </li>
                  <li>
                    Threshold (<code>|ΔNDVI| ≥ {analysis.config.threshold}</code>) and minimum component size (<code>{analysis.config.minComponentSize} px</code>) directly govern the reported change area.
                  </li>
                </ul>
              </div>
            </div>

            {/* RIGHT COLUMN: Change Groups Table + Export Results */}
            <div className="flex flex-col gap-5 lg:col-span-4">
              {/* Change Groups Table Card */}
              <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900">
                      Change Groups ({showFilteredOutTab ? 'Filtered Out' : 'After Filtering'})
                    </h2>
                  </div>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setShowFilteredOutTab(false)}
                      className={`rounded-md px-2 py-0.5 transition ${
                        !showFilteredOutTab
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Retained ({analysis.components.retained.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilteredOutTab(true)}
                      className={`rounded-md px-2 py-0.5 transition ${
                        showFilteredOutTab
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Removed ({analysis.components.filteredOut.length})
                    </button>
                  </div>
                </div>

                {!showFilteredOutTab ? (
                  analysis.components.retained.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No retained change groups meet the threshold ({analysis.config.threshold}) and minimum size ({analysis.config.minComponentSize} px).
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                            <th className="pb-2">#</th>
                            <th className="pb-2">Pixel Count</th>
                            <th className="pb-2">Area (m²)</th>
                            <th className="pb-2">Area (ha)</th>
                            <th className="pb-2 text-center">Color</th>
                            <th className="pb-2 text-right">View</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analysis.components.retained.map((comp) => {
                            const isHighlighted = highlightedComponentId === comp.componentId;
                            return (
                              <tr
                                key={comp.componentId}
                                className={`transition ${
                                  isHighlighted ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="py-2 font-mono font-bold text-slate-800">
                                  {comp.componentId}
                                </td>
                                <td className="py-2 font-mono text-slate-700">
                                  {comp.pixelCount}
                                </td>
                                <td className="py-2 font-mono text-slate-700">
                                  {comp.areaSquareMeters.toLocaleString()}
                                </td>
                                <td className="py-2 font-mono font-semibold text-slate-900">
                                  {comp.areaHectares.toFixed(2)}
                                </td>
                                <td className="py-2 text-center">
                                  <span
                                    className="inline-block h-3.5 w-6 rounded-sm border border-black/10 align-middle"
                                    style={{ backgroundColor: getComponentColor(comp.componentId) }}
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setHighlightedComponentId(
                                        isHighlighted ? null : comp.componentId
                                      )
                                    }
                                    className={`inline-flex items-center justify-center rounded-lg p-1 transition ${
                                      isHighlighted
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'
                                    }`}
                                    title={`Highlight Component #${comp.componentId} on map`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : analysis.components.filteredOut.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No candidate groups were removed by the current minimum-size filter ({analysis.config.minComponentSize} px).
                  </div>
                ) : (
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400">
                          <th className="pb-2">Cand #</th>
                          <th className="pb-2">Pixels</th>
                          <th className="pb-2">Area (m²)</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analysis.components.filteredOut.map((comp) => (
                          <tr key={comp.componentId} className="text-slate-600">
                            <td className="py-2 font-mono">F-{comp.componentId}</td>
                            <td className="py-2 font-mono font-semibold text-amber-700">
                              {comp.pixelCount} px
                            </td>
                            <td className="py-2 font-mono">
                              {comp.areaSquareMeters.toLocaleString()} m²
                            </td>
                            <td className="py-2">
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                Excluded (&lt; {analysis.config.minComponentSize} px)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Export Results Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center gap-2">
                  <Download className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Export Results</h3>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => downloadSummaryJson(analysis)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <FileJson className="h-4 w-4 text-emerald-600" />
                    Download Summary (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadChangeMaskCsv(analysis)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-sky-600" />
                    Download Change Mask (CSV)
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => downloadChangeMaskPng(analysis)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-100"
                    >
                      <ImageIcon className="h-4 w-4 text-violet-600" />
                      Mask (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadChangeMaskJson(analysis)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <FileJson className="h-4 w-4 text-slate-600" />
                      Mask (JSON)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
