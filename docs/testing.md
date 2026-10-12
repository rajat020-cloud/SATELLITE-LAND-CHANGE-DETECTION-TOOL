# Automated Testing Documentation — PS08 Satellite Land Change Detection Tool

## 1. Test Framework & Setup

- **Test Runner**: [Vitest](https://vitest.dev/) (`v2.1.x`) for both backend and frontend suites.
- **Backend Testing (`backend/tests/`)**:
  - Environment: `node`
  - HTTP Integration Testing: `supertest` (`v7.0.x`) against the Express application (`createApp()`).
  - Configuration: `backend/vitest.config.ts`
- **Frontend Testing (`frontend/src/tests/`)**:
  - Environment: `jsdom`
  - Component & DOM Testing: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
  - Configuration: `frontend/vite.config.ts` and `frontend/src/tests/setup.ts`.

No external paid APIs, satellite credentials, or external databases are required to run any test in the suite.

---

## 2. Test Execution Commands

From the repository root:
```bash
# Run all backend and frontend automated tests
npm test

# Run only backend unit & API integration tests (22 tests)
npm run test:backend

# Run only frontend component & workflow tests (3 tests)
npm run test:frontend

# Run TypeScript compiler checks across both workspaces
npm run typecheck
```

Or inside individual workspaces:
```bash
cd backend && npm test
cd frontend && npm test
```

---

## 3. Coverage of the 23 Mandatory Test Scenarios

### Backend Engine Unit Tests (`backend/tests/engine.test.ts` — 17 tests covering Scenarios 1–18)
1. **Scenario 1**: Correct NDVI calculation (`(NIR - Red) / (NIR + Red)`) for known reflectance inputs (`0.50`, `-0.60`, `0.75`).
2. **Scenario 2**: Zero-denominator handling (`NIR + Red = 0`) marks pixel `null` in NDVI, `0` in `effectiveValidMask`, `-1` in `classificationMask`, and increments `zeroDenominatorPixels` without dividing by zero or assigning `0.0`.
3. **Scenario 3**: Unchanged synthetic image pair (`synthetic-unchanged-001`) yields `0` candidate changes, `0` retained changes, and `0 m²` affected area.
4. **Scenario 4**: Known changed rectangular region (`synthetic-rect-change-002`, `8×8` block at rows `6..13`, cols `8..15`) detects exactly `64` pixels, `1` retained component, `6,400 m²` (`0.64 ha`).
5. **Scenario 5**: Invalid / cloud-masked pixels (`synthetic-cloud-mask-003`) are excluded from candidate/retained change counts even when masked pixels contain large band differences.
6. **Scenario 6**: Different validity masks between `before` (`42` masked) and `after` (`35` masked + `2` zero-denominator) combine into `79` invalid pixels and `497` common eligible pixels.
7. **Scenario 7**: Entirely invalid comparison area (`eligiblePixelCount = 0`) returns `null` percentages and a `ZERO_ELIGIBLE_PIXELS` warning without dividing by zero.
8. **Scenario 8**: Image dimension mismatch (`20×20` vs `22×20`) is rejected with `DIMENSION_MISMATCH`.
9. **Scenario 9**: Incompatible or unsupported band definitions (missing `nir`, undocumented `swir`) are rejected with `INCOMPATIBLE_BAND_DEFINITION` / `UNSUPPORTED_BAND_DEFINITION`.
10. **Scenario 10**: Incompatible alignment metadata (`before.alignmentId !== after.alignmentId`) is rejected with `ALIGNMENT_MISMATCH`.
11. **Scenario 11**: Negative, missing, or mismatched pixel-size metadata (`pixelWidthMeters`, `pixelHeightMeters`) is rejected with `INVALID_PIXEL_DIMENSIONS` / `PIXEL_RESOLUTION_MISMATCH`.
12. **Scenario 12**: Invalid numerical values (`NaN`, reflectance `> 1.0`, non-binary `validMask` value `2`) are rejected by schema validation.
13. **Scenario 13**: Threshold boundary behavior consistently enforces `>=` (`|ΔNDVI| = 0.25` with `threshold = 0.25` is classified as changed; `0.2499` is unchanged).
14. **Scenario 14**: Connected-component grouping merges diagonal neighbors into 1 cluster under `8`-connectivity and separates them into 3 clusters under `4`-connectivity.
15. **Scenario 15**: Minimum-size filtering (`synthetic-multi-component-004`) retains 4 groups (`97` px) and removes 2 noise groups (`5` px) at `minComponentSize = 6`, and retains 2 groups (`69` px) at `minComponentSize = 20`, while keeping candidate statistics (`6` groups, `102` px) intact.
16. **Scenario 16**: Square-meter (`m²`), hectare (`ha`), and square-kilometer (`km²`) calculations accurately multiply pixel counts by `pixelWidthMeters × pixelHeightMeters`.
17. **Scenario 17**: Change percentages use `eligiblePixelCount` (`840` px) as the denominator (`102 / 840 = 12.14%` candidate, `97 / 840 = 11.55%` retained).
18. **Scenario 18**: Exported Summary JSON, Mask JSON, and Mask CSV row counts and pixel totals strictly match the summary report metrics.

### Backend REST API Integration Tests (`backend/tests/api.test.ts` — 5 tests covering Scenarios 19–22 + OpenAPI Docs)
19. **Scenario 19**: `POST /api/validate` and `POST /api/analyze` return HTTP `400` with actionable validation issues on `synthetic-incompatible-005` and negative thresholds.
20. **Scenario 20**: `POST /api/analyze` returns HTTP `200` with complete deterministic metrics, rasters, and components on valid datasets.
21. **Scenario 21**: `GET /api/health` returns HTTP `200` with service status and version `1.0.0`.
22. **Scenario 22**: `GET /api/examples` and `GET /api/examples/:datasetId` return the synthetic dataset catalog and individual dataset payloads (`404` on unknown ID).
- **OpenAPI Spec Test**: `GET /api/docs` returns HTTP `200` with OpenAPI `3.0.3` specification.

### Frontend Component & Workflow Tests (`frontend/src/tests/App.test.tsx` — 3 tests covering Scenario 23)
23. **Scenario 23**:
    - Renders the GeoVision dashboard, loads the default synthetic dataset, displays the 4 raster canvas views (`Before (NDVI)`, `After (NDVI)`, `Change Detection`, `Invalid Pixel Mask`) and KPI metrics (`0.45 ha`, `4,500 m²`), and navigates across `New Analysis`, `Results`, and `Methodology`.
    - Surfaces actionable validation error banners (`ALIGNMENT_MISMATCH`) when the backend rejects an incompatible dataset.
    - Verifies frontend export builders (`buildSummaryExportObject`, `buildMaskCsvString`, `buildMaskJsonString`) and `ndviToRgb` color scale helpers.

---

## 4. Synthetic Fixtures & Expected Outputs

Located in `backend/sample_data/` and `backend/sample_data/expected/`:
- `synthetic-unchanged-001.json` → `expected/synthetic-unchanged-001.summary.json` & `.mask.json`
- `synthetic-rect-change-002.json` → `expected/synthetic-rect-change-002.summary.json` & `.mask.json`
- `synthetic-cloud-mask-003.json` → `expected/synthetic-cloud-mask-003.summary.json` & `.mask.json`
- `synthetic-multi-component-004.json` → `expected/synthetic-multi-component-004.summary.json` & `.mask.json`
- `synthetic-incompatible-005.json` → `expected/synthetic-incompatible-005.expected-error.json`

Regenerate deterministically at any time with:
```bash
npm --prefix backend run generate:samples
```

---

## 5. Actual Executed Test Results

All **25 automated tests** (22 backend tests across 2 test files + 3 frontend tests in 1 test file) were executed locally and **PASSED**:

- **Backend (`vitest run`)**: `2 passed (2 test files)`, `22 passed (22 tests)`, `0 failed`.
- **Frontend (`vitest run`)**: `1 passed (1 test file)`, `3 passed (3 tests)`, `0 failed`.

---

## 6. Known Testing Limitations

- **Canvas Pixel Rendering in JSDOM**: `jsdom` does not include a native C++ Cairo canvas backend, so `HTMLCanvasElement.prototype.getContext` is stubbed in `frontend/src/tests/setup.ts` during unit tests, while the underlying color-scale (`ndviToRgb`), classification, and export serialization functions are tested directly in both Node and JSDOM.
