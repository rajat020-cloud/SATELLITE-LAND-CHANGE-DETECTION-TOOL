import React, { useEffect, useRef, useState } from 'react';
import { Columns, Eye, Maximize2, X } from 'lucide-react';
import { AnalysisResponse } from '../types/landChange';
import { getComponentColor, hexToRgb, ndviToRgb } from '../utils/colorScales';
import { classificationCodeToLabel } from '../utils/exportHelpers';

export type ChangeViewMode =
  | 'filtered'
  | 'candidate-vs-filtered'
  | 'components'
  | 'direction'
  | 'magnitude';

interface RasterVisualizerProps {
  analysis: AnalysisResponse;
  highlightedComponentId: number | null;
  onClearHighlight: () => void;
}

type PanelType = 'before' | 'after' | 'change' | 'invalid';

export const RasterVisualizer: React.FC<RasterVisualizerProps> = ({
  analysis,
  highlightedComponentId,
  onClearHighlight
}) => {
  const [ndviPalette, setNdviPalette] = useState<'ndvi' | 'grayscale'>('ndvi');
  const [changeViewMode, setChangeViewMode] = useState<ChangeViewMode>('candidate-vs-filtered');
  const [hoverPixel, setHoverPixel] = useState<{ row: number; col: number } | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<PanelType | null>(null);
  const [splitSwipeOpen, setSplitSwipeOpen] = useState<boolean>(false);
  const [swipePercent, setSwipePercent] = useState<number>(50);
  const [swipeShowChangeOverlay, setSwipeShowChangeOverlay] = useState<boolean>(false);

  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const changeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const invalidCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const swipeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { width, height, beforeDate, afterDate } = analysis.datasetMetadata;
  const {
    beforeNdvi,
    afterNdvi,
    absoluteChange,
    signedChange,
    commonValidMask,
    classificationMask,
    componentLabelMask
  } = analysis.rasters;

  const renderPanelToCanvas = (
    canvas: HTMLCanvasElement | null,
    panel: PanelType,
    cellSize = 10
  ) => {
    if (!canvas) return;
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        let rgb: [number, number, number] = [15, 23, 42];

        if (panel === 'before') {
          rgb = ndviToRgb(beforeNdvi[r][c], ndviPalette);
        } else if (panel === 'after') {
          rgb = ndviToRgb(afterNdvi[r][c], ndviPalette);
        } else if (panel === 'invalid') {
          const isValid = commonValidMask[r][c] === 1;
          if (isValid) {
            const baseRgb = ndviToRgb(beforeNdvi[r][c], 'grayscale');
            rgb = [
              Math.round(baseRgb[0] * 0.22 + 8),
              Math.round(baseRgb[1] * 0.26 + 14),
              Math.round(baseRgb[2] * 0.32 + 24)
            ];
          } else {
            rgb = [241, 245, 249];
          }
        } else if (panel === 'change') {
          const code = classificationMask[r][c];
          const compId = componentLabelMask[r][c];

          if (code === -1) {
            rgb = [148, 163, 184];
          } else if (code === 0) {
            const base = ndviToRgb(beforeNdvi[r][c], 'ndvi');
            rgb = [
              Math.round(base[0] * 0.28 + 4),
              Math.round(base[1] * 0.35 + 14),
              Math.round(base[2] * 0.28 + 8)
            ];
          } else if (code === 1) {
            if (changeViewMode === 'filtered') {
              const base = ndviToRgb(beforeNdvi[r][c], 'ndvi');
              rgb = [
                Math.round(base[0] * 0.28 + 4),
                Math.round(base[1] * 0.35 + 14),
                Math.round(base[2] * 0.28 + 8)
              ];
            } else {
              rgb = [245, 158, 11];
            }
          } else if (code === 2) {
            if (changeViewMode === 'components') {
              rgb = hexToRgb(getComponentColor(compId));
            } else if (changeViewMode === 'direction') {
              const sig = signedChange[r][c] ?? 0;
              rgb = sig < 0 ? [239, 68, 68] : [6, 182, 212];
            } else if (changeViewMode === 'magnitude') {
              const mag = Math.min(1, (absoluteChange[r][c] ?? 0) / 1.0);
              rgb = [255, Math.round(200 * (1 - mag)), Math.round(40 * (1 - mag))];
            } else {
              rgb = [239, 68, 68];
            }
          }

          if (highlightedComponentId !== null) {
            if (compId === highlightedComponentId) {
              rgb = hexToRgb(getComponentColor(compId));
            } else {
              rgb = [
                Math.round(rgb[0] * 0.28),
                Math.round(rgb[1] * 0.28),
                Math.round(rgb[2] * 0.32)
              ];
            }
          }
        }

        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

        if (r % 5 === 0 || c % 5 === 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    if (hoverPixel && hoverPixel.row < height && hoverPixel.col < width) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.5, cellSize * 0.18);
      ctx.strokeRect(
        hoverPixel.col * cellSize + 0.5,
        hoverPixel.row * cellSize + 0.5,
        cellSize - 1,
        cellSize - 1
      );
    }
  };

  const renderSplitSwipeCanvas = (canvas: HTMLCanvasElement | null, cellSize = 16) => {
    if (!canvas) return;
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const splitX = (swipePercent / 100) * canvas.width;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const pxX = c * cellSize;
        const pxCenter = pxX + cellSize / 2;
        const isBeforeSide = pxCenter <= splitX;

        let rgb = isBeforeSide
          ? ndviToRgb(beforeNdvi[r][c], ndviPalette)
          : ndviToRgb(afterNdvi[r][c], ndviPalette);

        if (swipeShowChangeOverlay && classificationMask[r][c] === 2) {
          rgb = [239, 68, 68];
        }

        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(pxX, r * cellSize, cellSize, cellSize);
      }
    }

    // Draw split line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, canvas.height);
    ctx.stroke();
  };

  useEffect(() => {
    renderPanelToCanvas(beforeCanvasRef.current, 'before', 10);
    renderPanelToCanvas(afterCanvasRef.current, 'after', 10);
    renderPanelToCanvas(changeCanvasRef.current, 'change', 10);
    renderPanelToCanvas(invalidCanvasRef.current, 'invalid', 10);
    if (expandedPanel) {
      renderPanelToCanvas(modalCanvasRef.current, expandedPanel, 18);
    }
    if (splitSwipeOpen) {
      renderSplitSwipeCanvas(swipeCanvasRef.current, 16);
    }
  }, [
    analysis,
    ndviPalette,
    changeViewMode,
    hoverPixel,
    highlightedComponentId,
    expandedPanel,
    splitSwipeOpen,
    swipePercent,
    swipeShowChangeOverlay
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const col = Math.min(width - 1, Math.max(0, Math.floor((relX / rect.width) * width)));
    const row = Math.min(height - 1, Math.max(0, Math.floor((relY / rect.height) * height)));
    setHoverPixel({ row, col });
  };

  const inspectInfo =
    hoverPixel && hoverPixel.row < height && hoverPixel.col < width
      ? {
          row: hoverPixel.row,
          col: hoverPixel.col,
          bNdvi: beforeNdvi[hoverPixel.row][hoverPixel.col],
          aNdvi: afterNdvi[hoverPixel.row][hoverPixel.col],
          absDiff: absoluteChange[hoverPixel.row][hoverPixel.col],
          sigDiff: signedChange[hoverPixel.row][hoverPixel.col],
          code: classificationMask[hoverPixel.row][hoverPixel.col],
          compId: componentLabelMask[hoverPixel.row][hoverPixel.col]
        }
      : null;

  return (
    <div className="space-y-3">
      {/* Toolbar & Active Component Filter Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-700">Synchronized Spatial Grid:</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
            {analysis.datasetMetadata.alignmentId}
          </span>
          <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200/80">
            Synthetic Array ({width}×{height} px)
          </span>
          {highlightedComponentId !== null && (
            <button
              type="button"
              onClick={onClearHighlight}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
            >
              <Eye className="h-3.5 w-3.5" />
              Highlighting Group #{highlightedComponentId} — Click to Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSplitSwipeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <Columns className="h-3.5 w-3.5" />
            Split-Swipe Comparator
          </button>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">Index Palette:</span>
          <button
            type="button"
            onClick={() => setNdviPalette('ndvi')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              ndviPalette === 'ndvi'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            NDVI Color
          </button>
          <button
            type="button"
            onClick={() => setNdviPalette('grayscale')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              ndviPalette === 'grayscale'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Grayscale
          </button>
        </div>
      </div>

      {/* 4 Side-by-Side Raster Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1. Before (NDVI) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Before (NDVI)</h3>
              <p className="text-[11px] text-slate-500">
                Mean: {analysis.indexSummaries.before.mean?.toFixed(3) ?? 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {beforeDate}
              </span>
              <button
                type="button"
                onClick={() => setExpandedPanel('before')}
                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Expand Before (NDVI) View"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <canvas
              ref={beforeCanvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPixel(null)}
              className="h-full w-full cursor-crosshair object-contain"
              aria-label="Before NDVI raster canvas"
            />
          </div>

          <div className="mt-3">
            <div
              className={`h-2.5 w-full rounded-full ${
                ndviPalette === 'ndvi'
                  ? 'bg-gradient-to-r from-[#082f49] via-[#d2a454] to-[#116e26]'
                  : 'bg-gradient-to-r from-slate-950 via-slate-500 to-slate-100'
              }`}
            />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
              <span>-1.0 (Water)</span>
              <span>0.0 (Bare)</span>
              <span>+1.0 (Dense Canopy)</span>
            </div>
          </div>
        </div>

        {/* 2. After (NDVI) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">After (NDVI)</h3>
              <p className="text-[11px] text-slate-500">
                Mean: {analysis.indexSummaries.after.mean?.toFixed(3) ?? 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {afterDate}
              </span>
              <button
                type="button"
                onClick={() => setExpandedPanel('after')}
                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Expand After (NDVI) View"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <canvas
              ref={afterCanvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPixel(null)}
              className="h-full w-full cursor-crosshair object-contain"
              aria-label="After NDVI raster canvas"
            />
          </div>

          <div className="mt-3">
            <div
              className={`h-2.5 w-full rounded-full ${
                ndviPalette === 'ndvi'
                  ? 'bg-gradient-to-r from-[#082f49] via-[#d2a454] to-[#116e26]'
                  : 'bg-gradient-to-r from-slate-950 via-slate-500 to-slate-100'
              }`}
            />
            <div className="mt-1 flex justify-between text-[11px] font-medium text-slate-500">
              <span>-1.0 (Water)</span>
              <span>0.0 (Bare)</span>
              <span>+1.0 (Dense Canopy)</span>
            </div>
          </div>
        </div>

        {/* 3. Change Detection */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Detection</h3>
              <p className="text-[11px] text-slate-500">
                |ΔNDVI| ≥ {analysis.config.threshold}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Change mask view mode"
                value={changeViewMode}
                onChange={(e) => setChangeViewMode(e.target.value as ChangeViewMode)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="candidate-vs-filtered">Filtered + Candidate</option>
                <option value="filtered">Filtered Mask Only</option>
                <option value="components">Component Groups</option>
                <option value="direction">Loss vs. Gain Direction</option>
                <option value="magnitude">|ΔNDVI| Heatmap</option>
              </select>
              <button
                type="button"
                onClick={() => setExpandedPanel('change')}
                className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Expand Change Detection Mask"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <canvas
              ref={changeCanvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPixel(null)}
              className="h-full w-full cursor-crosshair object-contain"
              aria-label="Change detection mask canvas"
            />
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-medium text-slate-600">
            {changeViewMode === 'direction' ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#ef4444]" />
                  NDVI Loss ({analysis.summary.retainedDecreasePixelCount ?? 0})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#06b6d4]" />
                  NDVI Gain ({analysis.summary.retainedIncreasePixelCount ?? 0})
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#ef4444]" />
                Changed ({analysis.summary.retainedChangedPixelCount})
              </span>
            )}
            {changeViewMode !== 'filtered' && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#f59e0b]" />
                Filtered ({analysis.summary.filteredOutChangedPixelCount})
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#15803d]" />
              Unchanged
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#94a3b8]" />
              Invalid
            </span>
          </div>
        </div>

        {/* 4. Invalid Pixel Mask */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Invalid Pixel Mask</h3>
              <p className="text-[11px] text-slate-500">
                Excluded: {analysis.summary.invalidPixelCount} px ({analysis.summary.invalidPercentage}%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpandedPanel('invalid')}
              className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Expand Invalid Pixel Mask"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <canvas
              ref={invalidCanvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPixel(null)}
              className="h-full w-full cursor-crosshair object-contain"
              aria-label="Invalid pixel mask canvas"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-slate-900" />
              Valid ({analysis.summary.eligiblePixelCount} px)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs border border-slate-400 bg-slate-100" />
              Invalid / Cloud ({analysis.summary.invalidPixelCount} px)
            </span>
          </div>
        </div>
      </div>

      {/* Synchronized Pixel Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-900 px-4 py-2 text-xs text-slate-200">
        {inspectInfo ? (
          <div className="flex flex-wrap items-center gap-4 font-mono">
            <span className="text-sky-400">
              Pixel [Row {inspectInfo.row}, Col {inspectInfo.col}]
            </span>
            <span>
              NDVI Before:{' '}
              <strong className="text-white">
                {inspectInfo.bNdvi !== null ? inspectInfo.bNdvi.toFixed(4) : 'INVALID'}
              </strong>
            </span>
            <span>
              NDVI After:{' '}
              <strong className="text-white">
                {inspectInfo.aNdvi !== null ? inspectInfo.aNdvi.toFixed(4) : 'INVALID'}
              </strong>
            </span>
            <span>
              ΔNDVI:{' '}
              <strong className="text-sky-300">
                {inspectInfo.sigDiff !== null
                  ? (inspectInfo.sigDiff >= 0 ? '+' : '') + inspectInfo.sigDiff.toFixed(4)
                  : 'N/A'}
              </strong>
            </span>
            <span>
              |ΔNDVI|:{' '}
              <strong className="text-amber-300">
                {inspectInfo.absDiff !== null ? inspectInfo.absDiff.toFixed(4) : 'N/A'}
              </strong>
            </span>
            <span>
              Class:{' '}
              <strong className="text-emerald-300">
                {classificationCodeToLabel(inspectInfo.code)}
              </strong>
            </span>
            {inspectInfo.compId > 0 && (
              <span className="rounded bg-indigo-500/30 px-2 py-0.5 text-indigo-200">
                Group #{inspectInfo.compId}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">
            Hover over any pixel in the Before, After, Change Detection, or Invalid Mask grids to inspect synchronized pixel-level NDVI values and component membership.
          </span>
        )}
      </div>

      {/* Interactive Split-Swipe Comparator Modal */}
      {splitSwipeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          onClick={() => setSplitSwipeOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Interactive Temporal Split-Swipe Comparator
                </h3>
                <p className="text-xs text-slate-500">
                  Left: Before ({beforeDate}) • Right: After ({afterDate}) • Grid: {width}×{height} px
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSplitSwipeOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex flex-1 items-center gap-3">
                  <span className="font-semibold text-slate-700">Before ({beforeDate})</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={swipePercent}
                    onChange={(e) => setSwipePercent(Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-indigo-200 accent-indigo-600"
                    aria-label="Split swipe position"
                  />
                  <span className="font-semibold text-slate-700">After ({afterDate})</span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-rose-700">
                  <input
                    type="checkbox"
                    checked={swipeShowChangeOverlay}
                    onChange={(e) => setSwipeShowChangeOverlay(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  Overlay Retained Change Mask
                </label>
              </div>

              <div className="flex justify-center rounded-xl bg-slate-950 p-4">
                <canvas
                  ref={swipeCanvasRef}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Canvas Modal */}
      {expandedPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          onClick={() => setExpandedPanel(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {expandedPanel === 'before' && `Before (NDVI) — ${beforeDate}`}
                  {expandedPanel === 'after' && `After (NDVI) — ${afterDate}`}
                  {expandedPanel === 'change' && `Change Detection Mask (|ΔNDVI| ≥ ${analysis.config.threshold})`}
                  {expandedPanel === 'invalid' && `Invalid Pixel Mask (Cloud / Zero-Denominator Exclusion)`}
                </h3>
                <p className="text-xs text-slate-500">
                  Dataset: {analysis.datasetMetadata.title} • Grid: {width}×{height} px ({analysis.datasetMetadata.pixelWidthMeters}m × {analysis.datasetMetadata.pixelHeightMeters}m)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedPanel(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center rounded-xl bg-slate-950 p-4">
              <canvas
                ref={modalCanvasRef}
                onMouseMove={handleMouseMove}
                className="max-h-[65vh] w-auto cursor-crosshair object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
