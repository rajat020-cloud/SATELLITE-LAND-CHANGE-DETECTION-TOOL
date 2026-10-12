# 3–5 Minute Demonstration Script — PS08 Satellite Land Change Detection Tool (GeoVision)

## Prerequisites Before Starting Demo
Start the backend and frontend locally in two terminals:
```bash
# Terminal 1: Start Backend API on port 4000
npm run dev:backend

# Terminal 2: Start Frontend UI on port 5173
npm run dev:frontend
```
Open **`http://localhost:5173`** in your browser.

---

## Step-by-Step Speaking Script & Expected Outcomes

### Step 1: Opening the Application (0:00 – 0:25)
- **Action**: Open `http://localhost:5173` on the **Overview** dashboard. Point out the **Engine Online** badge in the top header and the **Origin: SYNTHETIC** badge.
- **Speaking Point**: *"This is GeoVision, our deterministic solution for Cerevyn PS08 — Satellite Land Change Detection. It is built entirely with React, TypeScript, and Tailwind CSS on the frontend and Node.js, Express, TypeScript, and Zod on the backend, operating locally without paid satellite APIs."*
- **Expected Outcome**: Dashboard loads with 5 KPI summary cards, 4 synchronized raster canvases (`Before (NDVI)`, `After (NDVI)`, `Change Detection`, `Invalid Pixel Mask`), configuration sliders, statistics, and export controls.

### Step 2 & 3: Loading the Unchanged Synthetic Dataset & Showing No Retained Change (0:25 – 0:50)
- **Action**: In the top-right **Dataset** dropdown (or **Sample Datasets** tab), select **`Unchanged Forest Baseline (Synthetic) (24×24)`** (`synthetic-unchanged-001`).
- **Speaking Point**: *"First, let's verify baseline stability using our 24×24 unchanged synthetic dataset. Both dates share minor sub-threshold radiometric drift (`|ΔNDVI| < 0.03`), well below our 0.25 threshold."*
- **Expected Outcome**:
  - **Valid Pixels**: `576 (100%)` of `576` total.
  - **Changed Pixels**: `0 (0%)` candidate and `0 (0%)` retained.
  - **Change Groups**: `0`.
  - **Total Change Area**: `0.00 ha (0 m²)`.

### Step 4, 5, 6 & 7: Known Changed-Region Dataset, Before/After Views, Change Mask & Threshold (0:50 – 1:40)
- **Action**: Select **`Known Rectangular Canopy Transition (Synthetic) (24×24)`** (`synthetic-rect-change-002`). Hover across the `Before (NDVI)`, `After (NDVI)`, and `Change Detection` canvases.
- **Speaking Point**: *"Next, we load the known rectangular calibration dataset. On the Before and After NDVI panels, rows 6–13 and columns 8–15 drop from NDVI 0.75 to 0.125—an absolute difference `|ΔNDVI| = 0.625`, which satisfies our `>= 0.25` threshold. Notice we compare the absolute difference between dates rather than treating a single NDVI value as proof of change."*
- **Expected Outcome**:
  - **Changed Pixels**: `64 (11.11%)` of `576` valid pixels.
  - **Change Groups**: `1` retained group (`#1`).
  - **Total Change Area**: `0.64 ha (6,400 m²)` using the supplied `10m × 10m` pixel size.

### Step 8 & 9: Connected-Component Grouping & Increasing the Minimum-Size Filter (1:40 – 2:30)
- **Action**: Select **`Multi-Cluster Clearing & Speckle Filtering (Synthetic) (30×30)`** (`synthetic-multi-component-004`).
  1. First observe the results at `Minimum Component Size = 6 pixels`: `102` candidate changed pixels across `6` candidate groups; `2` small speckle clusters (`2 px` and `3 px`) are shown in **amber** on the Change Detection canvas and excluded from the `4` retained groups (`97 px`, `0.97 ha`).
  2. Click the **Eye (`View`)** icon on Group `#1`, `#2`, `#3` in the **Change Groups** table to isolate each connected component on the map.
  3. Increase **Minimum Component Size** slider/input from `6` to `20` and click **`Run Analysis`**.
- **Speaking Point**: *"Our 30×30 multi-component dataset contains 4 substantive change clusters (45, 24, 16, and 12 pixels) plus 2 isolated noise speckles (2 and 3 pixels). Using 8-connectivity and a minimum size of 6 pixels, the 2 speckles are filtered out while still tracked in candidate statistics. When we increase the minimum component size to 20 pixels and re-run, the 12-pixel and 16-pixel groups are also filtered out, leaving only the 2 largest groups (45 and 24 pixels = 69 pixels, 0.69 ha)."*
- **Expected Outcome**:
  - At `minComponentSize = 6`: `102` candidate pixels (`12.14%`), `97` retained pixels (`11.55%`), `4` retained groups (`0.97 ha`).
  - At `minComponentSize = 20`: `102` candidate pixels (`12.14%`), `69` retained pixels (`8.21%`), `2` retained groups (`0.69 ha`), `4` removed groups (`33 px`).

### Step 10: Loading the Cloud-Masked Dataset & Explaining Invalid Pixels (2:30 – 3:05)
- **Action**: Select **`Cloud & Sensor-Dropout Exclusion (Synthetic) (24×24)`** (`synthetic-cloud-mask-003`). Point to the **Invalid Pixel Mask** panel.
- **Speaking Point**: *"Here we demonstrate per-date validity masks and zero-denominator handling. The Before date has 42 cloud-masked pixels in the upper right; the After date has 35 shadow-masked pixels in the lower left plus 2 zero-denominator pixels where `Red + NIR = 0`. All 79 invalid pixels are excluded from the common eligible comparison set, leaving 497 eligible pixels as the percentage denominator (`36 / 497 = 7.24%`)."*
- **Expected Outcome**:
  - **Valid Pixels (both dates)**: `497 (86.28%)` of `576`.
  - **Invalid Pixels**: `79 (13.72%)`.
  - **Retained Changed Pixels**: `36 (7.24% of eligible)`.

### Step 11: Attempting Incompatible Dimensions & Showing Validation Failure (3:05 – 3:35)
- **Action**: Navigate to **`Sample Datasets`** (or **`New Analysis`**) and select **`Incompatible Grid & Alignment Demo (Synthetic)`** (`synthetic-incompatible-005`).
- **Speaking Point**: *"Instead of silently comparing unrelated pixels, our backend strictly validates dimensions, band definitions, pixel sizes, and alignment metadata. Selecting this incompatible dataset triggers HTTP 400 with field-level error codes (`DIMENSION_MISMATCH`, `ALIGNMENT_MISMATCH`, `COORDINATE_SYSTEM_MISMATCH`, `PIXEL_RESOLUTION_MISMATCH`)."*
- **Expected Outcome**: Red validation error alert lists all 4 specific incompatibility error codes without crashing the UI.

### Step 12: Downloading the Summary and Change Mask (3:35 – 4:00)
- **Action**: Switch back to `synthetic-multi-component-004` on **Overview** and click **`Download Summary (JSON)`**, **`Download Change Mask (CSV)`**, and **`Mask (PNG)`** in the **Export Results** card.
- **Speaking Point**: *"Analysts can export a reproducible JSON summary containing metadata, parameters, component areas, and interpretation warnings, as well as the pixel-level change mask in CSV, JSON, and annotated PNG formats."*
- **Expected Outcome**: Browser downloads `synthetic-multi-component-004-summary.json`, `synthetic-multi-component-004-change-mask.csv`, and `synthetic-multi-component-004-change-mask.png`.

### Step 13 & 14: Running Automated Tests & Inspecting CI (4:00 – 4:30)
- **Action**: Switch to the terminal and run `npm test`. Show `.github/workflows/ci.yml` and `.github/workflows/deploy-azure.yml`.
- **Speaking Point**: *"Finally, running `npm test` executes our 25 deterministic Vitest unit, API integration, and frontend tests covering all 23 assessment scenarios. These same checks run automatically in GitHub Actions CI on every push and pull request."*
- **Expected Outcome**: All 22 backend tests and 3 frontend tests pass with 0 failures.
