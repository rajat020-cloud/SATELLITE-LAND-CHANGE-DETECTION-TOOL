import React from 'react';
import {
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  ShieldAlert,
  TrendingDown
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { AnalysisResponse, NavigationTab } from '../types/landChange';
import { getComponentColor } from '../utils/colorScales';
import {
  downloadChangeMaskCsv,
  downloadChangeMaskJson,
  downloadChangeMaskPng,
  downloadSummaryJson
} from '../utils/exportHelpers';

interface ResultsPageProps {
  analysis: AnalysisResponse | null;
  onNavigate: (tab: NavigationTab) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ analysis, onNavigate }) => {
  if (!analysis) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">No Analysis Results Available</h2>
        <p className="mt-1 text-sm text-slate-500">
          Run an analysis from the Overview or New Analysis page to inspect full statistical and component-level results.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('new-analysis')}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          Configure New Analysis
        </button>
      </div>
    );
  }

  const {
    datasetMetadata,
    config,
    summary,
    components,
    sensitivityProfile,
    warnings,
    limitations
  } = analysis;

  const pixelClassificationData = [
    {
      name: 'Unchanged Eligible',
      pixels: summary.unchangedEligiblePixelCount,
      color: '#15803d'
    },
    {
      name: 'Retained Change',
      pixels: summary.retainedChangedPixelCount,
      color: '#ef4444'
    },
    {
      name: 'Filtered (< Min Size)',
      pixels: summary.filteredOutChangedPixelCount,
      color: '#f59e0b'
    },
    {
      name: 'Invalid / Masked',
      pixels: summary.invalidPixelCount,
      color: '#94a3b8'
    }
  ];

  const componentChartData = components.retained.map((c) => ({
    name: `Group #${c.componentId}`,
    areaSqm: c.areaSquareMeters,
    areaHa: c.areaHectares,
    pixels: c.pixelCount,
    color: getComponentColor(c.componentId)
  }));

  return (
    <div className="space-y-6">
      {/* Header & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-700">
              {analysis.analysisId}
            </span>
            <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold uppercase text-amber-800">
              Origin: {datasetMetadata.origin}
            </span>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-slate-900">
            {datasetMetadata.title} — Detailed Analytical Report
          </h2>
          <p className="text-xs text-slate-500">
            Temporal Interval: {datasetMetadata.beforeDate} → {datasetMetadata.afterDate} • Grid:{' '}
            {datasetMetadata.width}×{datasetMetadata.height} px ({datasetMetadata.pixelWidthMeters}m ×{' '}
            {datasetMetadata.pixelHeightMeters}m) • Alignment: {datasetMetadata.alignmentId}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadSummaryJson(analysis)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <FileJson className="h-4 w-4 text-emerald-600" />
            Summary (JSON)
          </button>
          <button
            type="button"
            onClick={() => downloadChangeMaskCsv(analysis)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
          >
            <FileSpreadsheet className="h-4 w-4 text-sky-600" />
            Mask (CSV)
          </button>
          <button
            type="button"
            onClick={() => downloadChangeMaskJson(analysis)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Download className="h-4 w-4 text-slate-600" />
            Mask (JSON)
          </button>
          <button
            type="button"
            onClick={() => downloadChangeMaskPng(analysis)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            <ImageIcon className="h-4 w-4 text-violet-600" />
            Mask (PNG)
          </button>
        </div>
      </div>

      {/* Comprehensive Metrics Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Card 1: Per-Date & Common Validity Accounting */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="border-b border-slate-100 pb-2.5 text-sm font-bold text-slate-900">
            1. Validity &amp; Eligibility Accounting
          </h3>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total Grid Pixels ({datasetMetadata.width}×{datasetMetadata.height}):</dt>
              <dd className="font-mono font-bold text-slate-900">{summary.totalPixels.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Before ({summary.beforeValidity.date}) Valid Pixels:</dt>
              <dd className="font-mono font-semibold text-slate-800">
                {summary.beforeValidity.effectiveValidPixels.toLocaleString()} ({summary.beforeValidity.validCoveragePercentage}%)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">After ({summary.afterValidity.date}) Valid Pixels:</dt>
              <dd className="font-mono font-semibold text-slate-800">
                {summary.afterValidity.effectiveValidPixels.toLocaleString()} ({summary.afterValidity.validCoveragePercentage}%)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Zero-Denominator Pixels (Before / After):</dt>
              <dd className="font-mono text-slate-700">
                {summary.beforeValidity.zeroDenominatorPixels} / {summary.afterValidity.zeroDenominatorPixels}
              </dd>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <dt className="font-semibold text-emerald-800">Common Eligible Comparison Pixels:</dt>
              <dd className="font-mono font-bold text-emerald-700">
                {summary.eligiblePixelCount.toLocaleString()} ({summary.validCoveragePercentage}%)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-slate-600">Excluded Invalid Pixels:</dt>
              <dd className="font-mono font-bold text-slate-700">
                {summary.invalidPixelCount.toLocaleString()} ({summary.invalidPercentage}%)
              </dd>
            </div>
          </dl>
        </div>

        {/* Card 2: Candidate vs Retained Change Metrics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="border-b border-slate-100 pb-2.5 text-sm font-bold text-slate-900">
            2. Candidate vs. Retained Change Statistics
          </h3>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Configured Change Threshold:</dt>
              <dd className="font-mono font-bold text-indigo-700">
                |ΔNDVI| ≥ {config.threshold}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Minimum Component Size Filter:</dt>
              <dd className="font-mono font-bold text-indigo-700">
                ≥ {config.minComponentSize} px ({config.connectivity}-connected)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Candidate Changed Pixels:</dt>
              <dd className="font-mono font-bold text-amber-700">
                {summary.candidateChangedPixelCount.toLocaleString()} ({summary.candidateChangedPercentage !== null ? `${summary.candidateChangedPercentage}%` : 'N/A'})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Filtered-Out Candidate Pixels:</dt>
              <dd className="font-mono font-semibold text-slate-700">
                {summary.filteredOutChangedPixelCount.toLocaleString()} px ({summary.filteredOutComponentCount} groups)
              </dd>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <dt className="font-semibold text-rose-800">Final Retained Changed Pixels:</dt>
              <dd className="font-mono font-bold text-rose-600">
                {summary.retainedChangedPixelCount.toLocaleString()} ({summary.retainedChangedPercentage !== null ? `${summary.retainedChangedPercentage}%` : 'N/A'})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-slate-700">Retained Change Groups:</dt>
              <dd className="font-mono font-bold text-slate-900">
                {summary.retainedComponentCount} (of {summary.candidateComponentCount} candidate)
              </dd>
            </div>
          </dl>
        </div>

        {/* Card 3: Physical Area & Directional Breakdown */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="border-b border-slate-100 pb-2.5 text-sm font-bold text-slate-900">
            3. Physical Area &amp; Directional Shift
          </h3>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Single Pixel Area:</dt>
              <dd className="font-mono font-semibold text-slate-800">
                {summary.pixelAreaSquareMeters.toLocaleString()} m² ({datasetMetadata.pixelWidthMeters}m × {datasetMetadata.pixelHeightMeters}m)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Candidate Change Area:</dt>
              <dd className="font-mono font-semibold text-amber-700">
                {summary.candidateChangeAreaHectares.toFixed(2)} ha ({summary.candidateChangeAreaSquareMeters.toLocaleString()} m²)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-indigo-900">Retained Change Area (ha / m²):</dt>
              <dd className="font-mono font-bold text-indigo-700">
                {summary.retainedChangeAreaHectares.toFixed(4)} ha ({summary.retainedChangeAreaSquareMeters.toLocaleString()} m²)
              </dd>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between">
              <dt className="text-rose-700">Retained NDVI Decrease (ΔNDVI &lt; 0):</dt>
              <dd className="font-mono font-semibold text-rose-600">
                {(summary.retainedDecreasePixelCount ?? 0).toLocaleString()} px ({(summary.retainedDecreaseAreaHectares ?? 0).toFixed(2)} ha)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cyan-700">Retained NDVI Increase (ΔNDVI &gt; 0):</dt>
              <dd className="font-mono font-semibold text-cyan-700">
                {(summary.retainedIncreasePixelCount ?? 0).toLocaleString()} px ({(summary.retainedIncreaseAreaHectares ?? 0).toFixed(2)} ha)
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Retained Change Area (km²):</dt>
              <dd className="font-mono font-semibold text-slate-800">
                {summary.retainedChangeAreaSquareKilometers.toFixed(6)} km²
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Analytical Charts Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Chart 1: Pixel Classification Distribution */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">
            Pixel Classification Breakdown
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Distribution of all {summary.totalPixels.toLocaleString()} pixels across the 4 PS08 classes.
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pixelClassificationData} margin={{ top: 10, right: 15, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="pixels" name="Pixel Count" radius={[6, 6, 0, 0]}>
                  {pixelClassificationData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Retained Component Area Distribution */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">
            Retained Component Areas (m²)
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Area of each retained group (≥ {config.minComponentSize} px) in deterministic scan order.
          </p>
          {componentChartData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-xs text-slate-400">
              No retained change components to plot for the current configuration.
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentChartData} margin={{ top: 10, right: 15, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="areaSqm" name="Area (m²)" radius={[6, 6, 0, 0]}>
                    {componentChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 3: Threshold Sensitivity Profile */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Threshold Sensitivity Profile
            </h3>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Candidate vs. Retained pixels across thresholds (T = 0.10 → 0.75) at minSize = {config.minComponentSize}.
          </p>
          {sensitivityProfile && sensitivityProfile.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sensitivityProfile} margin={{ top: 10, right: 15, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="threshold" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="candidatePixels"
                    name="Candidate Px"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="retainedPixels"
                    name="Retained Px"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-60 items-center justify-center text-xs text-slate-400">
              Sensitivity curve unavailable.
            </div>
          )}
        </div>
      </div>

      {/* Complete Connected-Component Catalog Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">
            Connected-Component Catalog (Retained &amp; Filtered-Out)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Component ID</th>
                <th className="px-3 py-2.5">Pixel Count</th>
                <th className="px-3 py-2.5">Area (m²)</th>
                <th className="px-3 py-2.5">Area (ha)</th>
                <th className="px-3 py-2.5">% of Eligible</th>
                <th className="px-3 py-2.5">Mean |ΔNDVI|</th>
                <th className="px-3 py-2.5">Direction</th>
                <th className="px-3 py-2.5">Bounding Box (Rows, Cols)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.allCandidate.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    No candidate changed components detected.
                  </td>
                </tr>
              ) : (
                components.allCandidate.map((comp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      {comp.retained ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: getComponentColor(comp.componentId) }}
                          />
                          RETAINED
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                          FILTERED (&lt; {config.minComponentSize} px)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                      {comp.retained ? `#${comp.componentId}` : `Removed-${comp.componentId}`}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">
                      {comp.pixelCount} px
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-800">
                      {comp.areaSquareMeters.toLocaleString()} m²
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-indigo-700">
                      {comp.areaHectares.toFixed(4)} ha
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">
                      {comp.percentageOfEligible.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-800">
                      {comp.meanAbsoluteChange.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          comp.dominantDirection === 'decrease'
                            ? 'bg-rose-50 text-rose-700'
                            : comp.dominantDirection === 'increase'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {comp.dominantDirection === 'decrease'
                          ? 'NDVI Decrease'
                          : comp.dominantDirection === 'increase'
                          ? 'NDVI Increase'
                          : 'Mixed'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">
                      R[{comp.boundingBox.minRow}..{comp.boundingBox.maxRow}], C[
                      {comp.boundingBox.minCol}..{comp.boundingBox.maxCol}]
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings and Scientific Limitations */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="mb-2.5 flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm">Analysis Run Warnings</h3>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-2.5 flex items-center gap-2 font-bold text-slate-900">
            <ShieldAlert className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm">Methodological &amp; Interpretation Limitations</h3>
          </div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-600">
            {limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
