import React from 'react';
import {
  BarChart3,
  BookOpen,
  FileCode2,
  FolderKanban,
  Globe2,
  Home,
  PlusSquare,
  Satellite,
  X
} from 'lucide-react';
import { NavigationTab } from '../types/landChange';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hasAnalysis: boolean;
}

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'new-analysis', label: 'New Analysis', icon: PlusSquare },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'sample-datasets', label: 'Sample Datasets', icon: FolderKanban },
  { id: 'methodology', label: 'Methodology', icon: BookOpen },
  { id: 'api-docs', label: 'API Documentation', icon: FileCode2 }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  hasAnalysis
}) => {
  const handleSelect = (id: NavigationTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary Navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col justify-between bg-[#091020] text-slate-200 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <Globe2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-white">GeoVision</div>
                <div className="text-xs font-medium text-slate-400">Land Change Detection</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="mt-4 space-y-1.5 px-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950/50'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.id === 'results' && hasAnalysis && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      Live
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Earth & Satellite Illustration Card */}
        <div className="p-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-[#060c18] p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                <Satellite className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Satellite Analysis</div>
                <div className="text-[11px] text-emerald-400">PS08 Deterministic Engine</div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Detect • Compare • Measure aligned temporal grids with validity masking &amp; connected-component filtering.
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[10px] text-slate-400">
              <span>NDVI + 8-Connectivity</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-300">v1.0</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
