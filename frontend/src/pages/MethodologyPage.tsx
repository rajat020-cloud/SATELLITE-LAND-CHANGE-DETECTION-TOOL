import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  Cpu,
  GitFork,
  ShieldAlert
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              PS08 Algorithmic Methodology &amp; Scientific Limitations
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Deterministic multi-stage pipeline for aligned temporal NDVI comparison, validity masking, connected-component grouping, and physical area calculation.
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Stages Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 1. Input Contract & Validation */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm">1. Input Contract, Alignment &amp; Band Validation</h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Both temporal slices (<code>before</code> and <code>after</code>) must be at least <strong>20 × 20 pixels</strong>, share identical grid dimensions (<code>width</code>, <code>height</code>), identical physical pixel dimensions (<code>pixelWidthMeters</code>, <code>pixelHeightMeters</code>), and matching spatial registration metadata (<code>alignmentId</code>). Matching pixel counts alone never prove geographic co-registration.
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            <strong>Normalized Input Range &amp; Conversion:</strong> Input <code>red</code> and <code>nir</code> bands must contain finite surface reflectance values in <code>[0.0, 1.0]</code>. Raw 12-bit/16-bit integer Digital Numbers (e.g., Sentinel-2 L2A scaled by <code>10,000</code> or Landsat Collection 2 scaled by <code>0.0000275 - 0.2</code>) must be radiometrically scaled and clipped to <code>[0.0, 1.0]</code> and resampled onto a common co-registered grid before ingestion.
          </div>
        </div>

        {/* 2. NDVI & Zero-Denominator Handling */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Calculator className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm">2. Spectral Index (NDVI) &amp; Common Validity Mask</h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            For each pixel <code>(r, c)</code> marked valid (<code>validMask[r][c] === 1</code>), Normalized Difference Vegetation Index is computed as:
          </p>
          <div className="my-2.5 rounded-xl bg-slate-900 px-4 py-2.5 font-mono text-xs text-emerald-300">
            NDVI = (NIR - Red) / (NIR + Red)
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            If <code>validMask[r][c] === 0</code> on either date OR if <code>(NIR + Red) === 0</code> (zero denominator), the pixel is marked <strong>INVALID</strong> (<code>null</code> NDVI, never silently assigned <code>0.0</code>). The <strong>common eligible comparison set</strong> consists strictly of pixels valid with finite NDVI on <em>both</em> dates.
          </p>
        </div>

        {/* 3. Thresholding & Connected Components */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <GitFork className="h-5 w-5 text-violet-600" />
            <h3 className="text-sm">3. Change Thresholding, 8-Connectivity &amp; Filtering</h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            A single NDVI value does not prove land change. For every eligible pixel valid on both dates, the absolute difference is evaluated using a <strong>greater-than-or-equal (≥)</strong> comparison:
          </p>
          <div className="my-2.5 rounded-xl bg-slate-900 px-4 py-2.5 font-mono text-xs text-amber-300">
            absoluteChange = |NDVI_after - NDVI_before| &gt;= threshold
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Candidate changed pixels are grouped into connected components via deterministic row-major Breadth-First Search (BFS) using <strong>8-connectivity</strong> by default (orthogonal + diagonal neighbors; 4-connectivity optional). Components with <code>pixelCount &lt; minComponentSize</code> are filtered out from the final retained change mask while remaining tracked in candidate statistics.
          </p>
        </div>

        {/* 4. Area, Percentages & Complexity */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Cpu className="h-5 w-5 text-sky-600" />
            <h3 className="text-sm">4. Area Formulas, Denominators &amp; Complexity</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="rounded-xl bg-slate-900 px-4 py-2.5 font-mono text-xs text-sky-300">
              <div>componentArea_m2 = pixelCount × pixelWidthMeters × pixelHeightMeters</div>
              <div>hectares = componentArea_m2 / 10000</div>
              <div>retainedChangedPct = (retainedChangedPixels / eligiblePixelCount) × 100</div>
            </div>
            <p>
              <strong>Zero-Division Protection:</strong> If <code>eligiblePixelCount === 0</code>, percentages return <code>null</code> with a <code>ZERO_ELIGIBLE_PIXELS</code> warning.
            </p>
            <p>
              <strong>Computational Complexity:</strong> Both time and auxiliary space complexity are strictly linear <code>O(W × H)</code> where <code>W</code> is grid width and <code>H</code> is grid height.
            </p>
          </div>
        </div>
      </div>

      {/* Limitations & Interpretation Warnings */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-xs">
        <div className="mb-3 flex items-center gap-2.5 text-amber-900">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
          <h3 className="text-base font-bold">
            Critical Remote-Sensing Limitations &amp; Interpretation Warnings
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs leading-relaxed text-amber-950 md:grid-cols-2">
          <div className="rounded-xl bg-white/80 p-4">
            <div className="font-bold text-slate-900">
              1. Image Difference vs. Verified Real-World Event
            </div>
            <p className="mt-1 text-slate-600">
              A retained change component proves only that normalized Red/NIR index values differed between the two aligned arrays by at least the configured threshold. It does <strong>not</strong> independently prove deforestation, illegal construction, wildfire damage, or crop harvest without ground-truth or high-resolution optical verification.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-4">
            <div className="font-bold text-slate-900">
              2. Clouds, Cloud Shadows &amp; Atmospheric Haze
            </div>
            <p className="mt-1 text-slate-600">
              Unmasked cirrus clouds, sub-pixel cloud edges, and cast cloud shadows depress or distort NIR and Red reflectance. While supplied <code>validMask</code> grids exclude known cloud pixels, any unmasked residual shadow can mimic vegetation change.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-4">
            <div className="font-bold text-slate-900">
              3. Seasonal Phenology &amp; Illumination Geometry
            </div>
            <p className="mt-1 text-slate-600">
              Comparing acquisitions across different seasons (e.g., winter dry season vs. monsoon peak greenness) or different solar elevation angles introduces natural phenological and BRDF illumination shifts across agricultural and deciduous landscapes.
            </p>
          </div>
          <div className="rounded-xl bg-white/80 p-4">
            <div className="font-bold text-slate-900">
              4. Co-Registration Errors &amp; Spectrally Silent Changes
            </div>
            <p className="mt-1 text-slate-600">
              Even a 0.5–1.0 pixel spatial registration offset creates false ribbon-like change groups along high-contrast edges. Conversely, land-use changes that do not alter Red/NIR contrast (e.g., replacing bare soil with gravel or concrete of similar NDVI) will not be detected by an NDVI-based measure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
