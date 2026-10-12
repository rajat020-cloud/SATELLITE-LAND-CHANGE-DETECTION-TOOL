import React from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Database,
  Download,
  Play
} from 'lucide-react';
import { fetchExampleDataset } from '../services/api';
import { DatasetCatalogEntry } from '../types/landChange';

interface SampleDatasetsPageProps {
  catalog: DatasetCatalogEntry[];
  selectedDatasetId: string;
  onSelectAndAnalyze: (datasetId: string) => void;
  isLoading: boolean;
}

export const SampleDatasetsPage: React.FC<SampleDatasetsPageProps> = ({
  catalog,
  selectedDatasetId,
  onSelectAndAnalyze,
  isLoading
}) => {
  const handleDownloadRawDataset = async (datasetId: string) => {
    try {
      const ds = await fetchExampleDataset(datasetId);
      const blob = new Blob([JSON.stringify(ds, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${datasetId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download dataset JSON');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bundled Synthetic Demonstration Datasets
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              All bundled datasets are deterministically generated synthetic reflectance arrays (≥ 20×20 pixels) stored in <code>backend/sample_data/</code> with verified expected outputs in <code>backend/sample_data/expected/</code>. They are explicitly labelled as synthetic and do not represent actual satellite sensor imagery.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            <Database className="h-3.5 w-3.5" />
            100% Deterministic Synthetic Fixtures
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {catalog.map((item) => {
          const isCurrent = item.datasetId === selectedDatasetId;
          return (
            <div
              key={item.datasetId}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-xs transition ${
                isCurrent
                  ? 'border-indigo-500 ring-2 ring-indigo-500/15'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                    {item.datasetId}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-800">
                      {item.origin}
                    </span>
                    {item.isValidDemo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Valid Fixture
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                        <AlertOctagon className="h-3 w-3" />
                        Validation Rejection Demo
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {item.description}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-400">Dimensions</dt>
                    <dd className="font-mono font-bold text-slate-800">
                      {item.width} × {item.height} px
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Pixel Size</dt>
                    <dd className="font-mono font-bold text-slate-800">
                      {item.pixelWidthMeters}m × {item.pixelHeightMeters}m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Dates</dt>
                    <dd className="font-mono font-semibold text-slate-800">
                      {item.beforeDate} → {item.afterDate}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-slate-400">Alignment ID &amp; Recommended Config</dt>
                    <dd className="font-mono text-slate-700">
                      {item.alignmentId} • |ΔNDVI| ≥ {item.recommendedConfig.threshold} • Min Size:{' '}
                      {item.recommendedConfig.minComponentSize} px ({item.recommendedConfig.connectivity}-conn)
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onSelectAndAnalyze(item.datasetId)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition ${
                    item.isValidDemo
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {item.isValidDemo ? 'Load & Run Analysis' : 'Test Validation Rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadRawDataset(item.datasetId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Raw JSON
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
