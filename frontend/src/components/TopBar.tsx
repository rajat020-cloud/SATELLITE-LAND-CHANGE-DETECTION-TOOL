import React from 'react';
import { Activity, Database, Menu, ShieldCheck } from 'lucide-react';
import { DatasetCatalogEntry } from '../types/landChange';

interface TopBarProps {
  catalog: DatasetCatalogEntry[];
  selectedDatasetId: string;
  onSelectDatasetId: (datasetId: string) => void;
  onOpenMobileMenu: () => void;
  apiOnline: boolean | null;
  currentOrigin?: string;
  isLoading: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  catalog,
  selectedDatasetId,
  onSelectDatasetId,
  onOpenMobileMenu,
  apiOnline,
  currentOrigin,
  isLoading
}) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3.5 backdrop-blur-xs sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Satellite Land Change Detection
              </h1>
              {currentOrigin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <Database className="h-3 w-3" />
                  Origin: {currentOrigin.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">
              Compare aligned temporal grids, detect NDVI differences, exclude invalid pixels, and measure connected change areas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Dataset Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5">
            <div className="flex flex-col">
              <label
                htmlFor="top-dataset-select"
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                Dataset
              </label>
              <select
                id="top-dataset-select"
                value={selectedDatasetId}
                disabled={isLoading || catalog.length === 0}
                onChange={(e) => onSelectDatasetId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none sm:text-sm"
              >
                {catalog.map((item) => (
                  <option key={item.datasetId} value={item.datasetId}>
                    {item.title} ({item.width}×{item.height})
                  </option>
                ))}
                {selectedDatasetId.startsWith('custom-') && (
                  <option value={selectedDatasetId}>Custom Uploaded Dataset ({selectedDatasetId})</option>
                )}
              </select>
            </div>
          </div>

          {/* API Health Pill */}
          <div
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex ${
              apiOnline === true
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : apiOnline === false
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-100 text-slate-600'
            }`}
            title="Backend Deterministic Engine Health"
          >
            {apiOnline === true ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Engine Online</span>
              </>
            ) : (
              <>
                <Activity className="h-3.5 w-3.5" />
                <span>{apiOnline === false ? 'API Offline' : 'Checking API...'}</span>
              </>
            )}
          </div>

          {/* User / Assessment Badge */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs"
            title="PS08 — Satellite Land Change Detection Tool"
          >
            PS08
          </div>
        </div>
      </div>
    </header>
  );
};
