import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitFork,
  Layers,
  Ruler
} from 'lucide-react';
import { AnalysisResponse } from '../types/landChange';

interface KpiCardsProps {
  analysis: AnalysisResponse;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ analysis }) => {
  const { datasetMetadata, summary } = analysis;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Image Size */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Image Size</div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {datasetMetadata.width} × {datasetMetadata.height}
          </div>
          <div className="text-xs text-slate-500">
            pixels ({datasetMetadata.pixelWidthMeters}m × {datasetMetadata.pixelHeightMeters}m)
          </div>
        </div>
      </div>

      {/* 2. Valid Pixels */}
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 shadow-xs">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Valid Pixels</div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {summary.eligiblePixelCount.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-emerald-700">
              ({summary.validCoveragePercentage}%)
            </span>
          </div>
          <div className="text-xs text-slate-500">
            of total {summary.totalPixels.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 3. Changed Pixels */}
      <div className="flex items-center gap-4 rounded-2xl border border-rose-200/70 bg-rose-50/40 p-4 shadow-xs">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Changed Pixels</div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {summary.retainedChangedPixelCount.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-rose-600">
              ({summary.retainedChangedPercentage !== null ? `${summary.retainedChangedPercentage}%` : 'N/A'})
            </span>
          </div>
          <div className="text-xs text-slate-500">
            of valid pixels ({summary.candidateChangedPixelCount.toLocaleString()} candidate)
          </div>
        </div>
      </div>

      {/* 4. Change Groups */}
      <div className="flex items-center gap-4 rounded-2xl border border-violet-200/70 bg-violet-50/40 p-4 shadow-xs">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <GitFork className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Change Groups</div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {summary.retainedComponentCount}
          </div>
          <div className="text-xs text-slate-500">
            after filtering ({summary.filteredOutComponentCount} removed)
          </div>
        </div>
      </div>

      {/* 5. Total Change Area */}
      <div className="flex items-center gap-4 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 shadow-xs">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Ruler className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Total Change Area</div>
          <div className="text-xl font-bold tracking-tight text-slate-900">
            {summary.retainedChangeAreaHectares.toFixed(2)} ha
          </div>
          <div className="text-xs text-slate-500">
            ({summary.retainedChangeAreaSquareMeters.toLocaleString()} m²)
          </div>
        </div>
      </div>
    </div>
  );
};
