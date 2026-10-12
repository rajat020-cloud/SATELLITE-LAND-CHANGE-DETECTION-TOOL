import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Download,
  FileUp,
  FolderOpen,
  Play,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  AnalysisConfig,
  ConnectivityType,
  DatasetCatalogEntry,
  LandChangeDataset,
  ValidationResult
} from '../types/landChange';

interface NewAnalysisPageProps {
  catalog: DatasetCatalogEntry[];
  selectedDatasetId: string;
  currentDataset: LandChangeDataset | null;
  config: AnalysisConfig;
  onChangeConfig: (newConfig: AnalysisConfig) => void;
  onSelectBundledDataset: (datasetId: string) => void;
  onUploadCustomDataset: (rawObject: unknown, fileName: string) => void;
  onUploadMalformedError: (errorMsg: string) => void;
  onValidate: () => void;
  onStartAnalysis: () => void;
  validationStatus: ValidationResult | null;
  errorMessage: string | null;
  isLoading: boolean;
}

export const NewAnalysisPage: React.FC<NewAnalysisPageProps> = ({
  catalog,
  selectedDatasetId,
  currentDataset,
  config,
  onChangeConfig,
  onSelectBundledDataset,
  onUploadCustomDataset,
  onUploadMalformedError,
  onValidate,
  onStartAnalysis,
  validationStatus,
  errorMessage,
  isLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Interactive Scenario Builder state
  const [genDim, setGenDim] = useState<number>(24);
  const [genPixelMeters, setGenPixelMeters] = useState<number>(10);
  const [genPatchSize, setGenPatchSize] = useState<number>(6);
  const [genCloudRows, setGenCloudRows] = useState<number>(3);
  const [genInjectFault, setGenInjectFault] = useState<'none' | 'dimension' | 'alignment'>('none');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        onUploadMalformedError(
          `Malformed JSON file "${file.name}": ${
            parseErr instanceof Error ? parseErr.message : 'Unable to parse JSON syntax.'
          }`
        );
        return;
      }
      onUploadCustomDataset(parsed, file.name);
    } catch (readErr) {
      onUploadMalformedError(
        `Failed to read file "${file.name}": ${
          readErr instanceof Error ? readErr.message : 'Unknown file error'
        }`
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const buildCustomScenarioDataset = (): LandChangeDataset => {
    const width = genDim;
    const height = genDim;
    const afterWidth = genInjectFault === 'dimension' ? width + 2 : width;

    const makeGrid = (h: number, w: number, val: number) =>
      Array.from({ length: h }, () => Array<number>(w).fill(val));

    const beforeRed = makeGrid(height, width, 0.11);
    const beforeNir = makeGrid(height, width, 0.69);
    const beforeMask = makeGrid(height, width, 1);

    const afterRed = makeGrid(height, afterWidth, 0.11);
    const afterNir = makeGrid(height, afterWidth, 0.69);
    const afterMask = makeGrid(height, afterWidth, 1);

    // Inject deterministic changed patch starting at row 6, col 6
    const startR = 5;
    const startC = 5;
    for (let r = startR; r < Math.min(height - 1, startR + genPatchSize); r++) {
      for (let c = startC; c < Math.min(afterWidth - 1, startC + genPatchSize); c++) {
        afterRed[r][c] = 0.37;
        afterNir[r][c] = 0.43; // NDVI drops from 0.725 to 0.075 -> |ΔNDVI| = 0.65
      }
    }

    // Also inject a 2-pixel isolated speckle at (2, 12..13) to demonstrate min-size filtering
    if (width >= 15) {
      afterRed[2][12] = 0.36;
      afterNir[2][12] = 0.44;
      afterRed[2][13] = 0.36;
      afterNir[2][13] = 0.44;
    }

    // Cloud mask in upper-right corner on 'before' slice
    for (let r = 0; r < genCloudRows; r++) {
      for (let c = width - 5; c < width; c++) {
        if (r >= 0 && r < height && c >= 0 && c < width) {
          beforeMask[r][c] = 0;
        }
      }
    }

    return {
      schemaVersion: '1.0',
      datasetId: `synthetic-builder-${width}x${height}`,
      title: `Custom Synthetic Scenario (${width}×${height} px, ${genPatchSize}×${genPatchSize} Patch)`,
      origin: 'synthetic',
      description: `Deterministically generated ${width}×${height} synthetic scenario with a ${genPatchSize}×${genPatchSize} changed patch (${genPatchSize * genPatchSize} px), a 2-pixel noise speckle, and ${genCloudRows * 5} cloud-masked pixels.`,
      recommendedConfig: {
        threshold: config.threshold,
        minComponentSize: config.minComponentSize,
        connectivity: config.connectivity
      },
      before: {
        date: '2026-01-15',
        width,
        height,
        alignmentId: 'grid-custom-scenario-01',
        coordinateSystem: 'LOCAL-METRIC-CUSTOM',
        pixelWidthMeters: genPixelMeters,
        pixelHeightMeters: genPixelMeters,
        bands: { red: beforeRed, nir: beforeNir },
        validMask: beforeMask
      },
      after: {
        date: '2026-07-15',
        width: afterWidth,
        height,
        alignmentId:
          genInjectFault === 'alignment' ? 'grid-mismatched-999' : 'grid-custom-scenario-01',
        coordinateSystem: 'LOCAL-METRIC-CUSTOM',
        pixelWidthMeters: genPixelMeters,
        pixelHeightMeters: genPixelMeters,
        bands: { red: afterRed, nir: afterNir },
        validMask: afterMask
      }
    };
  };

  const handleLoadBuiltScenario = () => {
    const scenario = buildCustomScenarioDataset();
    onUploadCustomDataset(scenario, `${scenario.datasetId}.json`);
  };

  const handleDownloadBuiltScenario = () => {
    const scenario = buildCustomScenarioDataset();
    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.datasetId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const beforeSlice = currentDataset?.before;
  const afterSlice = currentDataset?.after;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">New Land-Change Analysis</h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Load a deterministic synthetic dataset, upload a custom JSON temporal dataset, or build a custom synthetic test scenario in-browser, then validate and execute the processing pipeline.
        </p>

        {/* Options A, B, and C */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Option A: Bundled Sample Selector */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-3 flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Option A: Bundled Synthetic Dataset
              </h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Select from our 5 verified synthetic datasets (unchanged, rectangular change, cloud-masked, multi-cluster, or incompatible demo).
            </p>
            <label htmlFor="bundled-dataset-select" className="sr-only">
              Select bundled dataset
            </label>
            <select
              id="bundled-dataset-select"
              value={selectedDatasetId}
              disabled={isLoading}
              onChange={(e) => onSelectBundledDataset(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none"
            >
              {catalog.map((item) => (
                <option key={item.datasetId} value={item.datasetId}>
                  {item.title} ({item.width}×{item.height})
                </option>
              ))}
              {selectedDatasetId.startsWith('custom-') && (
                <option value={selectedDatasetId}>Custom Loaded JSON ({selectedDatasetId})</option>
              )}
            </select>
          </div>

          {/* Option B: Custom JSON File Upload */}
          <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/30 p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileUp className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Option B: Upload Custom Dataset (.json)
              </h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Upload a JSON file following the PS08 schema (<code>schemaVersion: "1.0"</code>, minimum 20×20 pixels, normalized <code>red</code> and <code>nir</code> bands, and <code>validMask</code>).
            </p>
            <input
              ref={fileInputRef}
              id="json-file-upload"
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-700"
            />
          </div>

          {/* Option C: Interactive Synthetic Scenario Generator */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Option C: Interactive Scenario Builder
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Grid Size</label>
                <select
                  value={genDim}
                  onChange={(e) => setGenDim(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value={20}>20 × 20 px</option>
                  <option value={24}>24 × 24 px</option>
                  <option value={30}>30 × 30 px</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Pixel Size</label>
                <select
                  value={genPixelMeters}
                  onChange={(e) => setGenPixelMeters(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value={10}>10m × 10m</option>
                  <option value={20}>20m × 20m</option>
                  <option value={30}>30m × 30m</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Changed Patch</label>
                <select
                  value={genPatchSize}
                  onChange={(e) => setGenPatchSize(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value={4}>4×4 (16 px)</option>
                  <option value={6}>6×6 (36 px)</option>
                  <option value={8}>8×8 (64 px)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Fault Injection</label>
                <select
                  value={genInjectFault}
                  onChange={(e) =>
                    setGenInjectFault(e.target.value as 'none' | 'dimension' | 'alignment')
                  }
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value="none">None (Valid)</option>
                  <option value="dimension">Dimension Mismatch</option>
                  <option value="alignment">Alignment Mismatch</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleLoadBuiltScenario}
                className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Generate &amp; Load
              </button>
              <button
                type="button"
                onClick={handleDownloadBuiltScenario}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                title="Download Generated Scenario as JSON"
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Status & Actionable Errors */}
      {(errorMessage || (validationStatus && !validationStatus.valid)) && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 font-bold text-rose-800">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            <span>Validation Failure — Incompatible or Malformed Dataset</span>
          </div>
          {errorMessage && <p className="mt-1.5 text-xs text-rose-700">{errorMessage}</p>}
          {validationStatus && validationStatus.issues.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-3.5 text-xs">
              <div className="font-semibold text-rose-900">
                Detected {validationStatus.issues.length} Validation Issue(s):
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {validationStatus.issues.map((issue, i) => (
                  <li key={i}>
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-rose-800">
                      {issue.code}
                    </span>{' '}
                    <strong className="font-mono text-slate-800">{issue.field}:</strong>{' '}
                    <span className="text-slate-700">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {validationStatus && validationStatus.valid && !errorMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Validation Passed — Dataset Is Ready for Deterministic Change Detection</span>
          </div>
          {validationStatus.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-6 text-emerald-800">
              {validationStatus.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dataset Metadata Review & Parameter Configuration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Dataset Metadata Inspector */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-7">
          <h3 className="text-base font-bold text-slate-900">Dataset Metadata Inspector</h3>
          {currentDataset ? (
            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 sm:grid-cols-3">
                <div>
                  <div className="text-slate-400">Dataset ID</div>
                  <div className="mt-0.5 font-mono font-bold text-slate-800">
                    {currentDataset.datasetId}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Schema Version</div>
                  <div className="mt-0.5 font-mono font-bold text-slate-800">
                    {String(currentDataset.schemaVersion)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Data Origin</div>
                  <div className="mt-0.5 font-semibold uppercase text-amber-700">
                    {String(currentDataset.origin)}
                  </div>
                </div>
              </div>

              <p className="text-slate-600">{currentDataset.description}</p>

              {/* Side-by-side Before vs After Slice Comparison */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Before Slice
                  </div>
                  <dl className="space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Acquisition Date:</dt>
                      <dd className="font-mono font-semibold text-slate-800">
                        {beforeSlice?.date ?? 'Missing'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Dimensions:</dt>
                      <dd className="font-mono font-semibold text-slate-800">
                        {beforeSlice?.width} × {beforeSlice?.height} px
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Alignment ID:</dt>
                      <dd className="font-mono text-slate-800">
                        {beforeSlice?.alignmentId ?? 'Missing'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Pixel Size:</dt>
                      <dd className="font-mono text-slate-800">
                        {beforeSlice?.pixelWidthMeters}m × {beforeSlice?.pixelHeightMeters}m
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Bands Present:</dt>
                      <dd className="font-mono text-emerald-700">
                        {beforeSlice?.bands ? Object.keys(beforeSlice.bands).join(', ') : 'None'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    After Slice
                  </div>
                  <dl className="space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Acquisition Date:</dt>
                      <dd className="font-mono font-semibold text-slate-800">
                        {afterSlice?.date ?? 'Missing'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Dimensions:</dt>
                      <dd
                        className={`font-mono font-semibold ${
                          beforeSlice?.width !== afterSlice?.width ||
                          beforeSlice?.height !== afterSlice?.height
                            ? 'text-rose-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {afterSlice?.width} × {afterSlice?.height} px
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Alignment ID:</dt>
                      <dd
                        className={`font-mono ${
                          beforeSlice?.alignmentId !== afterSlice?.alignmentId
                            ? 'font-bold text-rose-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {afterSlice?.alignmentId ?? 'Missing'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Pixel Size:</dt>
                      <dd className="font-mono text-slate-800">
                        {afterSlice?.pixelWidthMeters}m × {afterSlice?.pixelHeightMeters}m
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Bands Present:</dt>
                      <dd className="font-mono text-emerald-700">
                        {afterSlice?.bands ? Object.keys(afterSlice.bands).join(', ') : 'None'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">No dataset currently loaded.</p>
          )}
        </div>

        {/* Parameter Configuration & Execution */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-5">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Threshold &amp; Filtering Parameters
              </h3>
            </div>

            <div>
              <label
                htmlFor="new-threshold-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Absolute NDVI Change Threshold (|ΔNDVI| ≥ T)
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  id="new-threshold-input"
                  type="number"
                  min="0"
                  max="2.0"
                  step="0.01"
                  value={config.threshold}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) {
                      onChangeConfig({ ...config, threshold: v });
                    }
                  }}
                  className="w-28 rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  Valid range: <code>0.00</code> to <code>2.00</code> (default <code>0.25</code>)
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-minsize-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Minimum Connected-Component Size (pixels)
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  id="new-minsize-input"
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={config.minComponentSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) {
                      onChangeConfig({ ...config, minComponentSize: v });
                    }
                  }}
                  className="w-28 rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-slate-900"
                />
                <span className="text-xs text-slate-500">
                  Removes isolated speckles smaller than <code>{config.minComponentSize} px</code>
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-connectivity-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Adjacency / Connectivity Rule
              </label>
              <select
                id="new-connectivity-select"
                value={config.connectivity}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    connectivity: Number(e.target.value) as ConnectivityType
                  })
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value={8}>8-Connectivity (Orthogonal + Diagonal Neighbors)</option>
                <option value={4}>4-Connectivity (Orthogonal Neighbors Only)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 pt-4 sm:flex-row">
            <button
              type="button"
              disabled={isLoading || !currentDataset}
              onClick={onValidate}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4 text-indigo-600" />
              Run Pre-Flight Validation
            </button>
            <button
              type="button"
              disabled={isLoading || !currentDataset}
              onClick={onStartAnalysis}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              Start Full Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
