# GeoVision — PS08 Satellite Land Change Detection Tool

**Cerevyn Chitkara University Round One Technical Assessment**  
**Problem Statement:** `PS08 — Satellite Land Change Detection Tool`

---

## Candidate Information

| Field | Value |
| :--- | :--- |
| **Candidate Name** | `<YOUR_FULL_NAME>` |
| **Roll Number** | `<YOUR_ROLL_NUMBER>` |
| **Branch / Department** | `<YOUR_BRANCH>` |
| **University** | Chitkara University |
| **GitHub Repository URL** | `https://github.com/rajat020-cloud/SATELLITE-LAND-CHANGE-DETECTION-TOOL` |
| **Frontend Deployment URL (Vercel)** | `https://satellite-land-change-detection-too.vercel.app` |
| **Backend Deployment URL (Render)** | `https://satellite-land-change-detection-tool.onrender.com` |
| **Demo Video Link** | `<YOUR_DEMO_VIDEO_URL>` |

---

## 1. Problem Description

Satellite and aerial monitoring teams must compare two aligned temporal images of the same geographical region to identify where spectral land characteristics have changed over time, exclude invalid pixels (such as clouds, cloud shadows, or sensor drop-outs), group adjacent changed pixels into contiguous spatial components, filter out small isolated noise speckles, and calculate the physical area of each changed region.

**GeoVision (PS08)** provides a complete, deterministic, full-stack web application in **TypeScript** (React + Vite + Tailwind CSS frontend and Node.js + Express + Zod backend) that:
1. Validates two aligned temporal grids ($\ge 20 \times 20$ pixels) along with their band definitions (`red`, `nir`), validity masks (`validMask`), alignment metadata (`alignmentId`), and physical pixel dimensions (`pixelWidthMeters`, `pixelHeightMeters`).
2. Computes per-date Normalized Difference Vegetation Index ($\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$), safely marking zero-denominator ($\text{NIR} + \text{Red} = 0$) or masked pixels as `INVALID` (`null`).
3. Constructs a **common eligible comparison mask** containing only pixels valid on *both* dates.
4. Evaluates absolute NDVI change ($\left|\text{NDVI}_{\text{after}} - \text{NDVI}_{\text{before}}\right| \ge \text{threshold}$).
5. Groups adjacent candidate changed pixels into connected components using deterministic row-major Breadth-First Search (**8-connectivity** default, **4-connectivity** optional).
6. Applies a configurable **minimum component size filter** (`minComponentSize` in pixels), preserving both candidate and filtered statistics separately.
7. Calculates physical affected areas in **square meters ($\text{m}^2$)**, **hectares ($\text{ha}$)**, and **square kilometers ($\text{km}^2$)** and reports change percentages using `eligiblePixelCount` as the denominator.
8. Visualizes Before NDVI, After NDVI, Change Detection Mask, and Invalid Pixel Mask side by side and exports reproducible **JSON**, **CSV**, and **PNG** reports.

---

## 2. Key Features

- **Strict Pre-Flight & Runtime Validation**: Rejects incompatible dimensions, mismatched `alignmentId` values, missing/unknown bands, negative pixel sizes, `NaN`/`Infinity` values, or out-of-range reflectance values with HTTP `400` and field-level error diagnostics.
- **Deterministic 10-Step Processing Pipeline**: Identical inputs and configurations always yield identical masks, component IDs, and area metrics.
- **Zero-Denominator & Cloud Mask Safety**: Never divides by zero and never silently assigns `0.0` change to invalid pixels.
- **Synchronized 4-Panel Raster Visualizer**: Side-by-side HTML5 Canvas views for `Before (NDVI)`, `After (NDVI)`, `Change Detection`, and `Invalid Pixel Mask` with synchronized hover telemetry, color/grayscale palette toggle, candidate-vs-filtered view switcher, and per-component isolation (`Eye` button).
- **Reproducible Exports**: One-click downloads for Analysis Summary (`JSON`), Pixel-Level Change Mask (`CSV` and `JSON`), and Annotated Change Mask (`PNG`).
- **5 Bundled Synthetic Datasets**: Stored in `backend/sample_data/` with verified expected outputs in `backend/sample_data/expected/`, all explicitly labelled `origin: "synthetic"`.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Recharts 2, Lucide React Icons |
| **Backend** | Node.js ($\ge 20$), Express 4, TypeScript 5.7, Zod 3.24 |
| **Testing** | Vitest 2.1, Supertest 7, React Testing Library, JSDOM |
| **DevOps & Packaging** | Docker (Multi-stage Alpine image), GitHub Actions CI (`ci.yml`), Render Blueprint (`render.yaml`), Vercel (`vercel.json`), Azure App Service OIDC (`deploy-azure.yml`) |

*No Python, paid satellite APIs, or mandatory external databases are required.*

---

## 4. Architecture Overview & Repository Structure

See [`docs/architecture.md`](docs/architecture.md) for the complete 13-step dataflow diagram and module breakdown.

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated CI on push & pull_request
│       └── deploy-azure.yml       # Manually triggered Azure OIDC deployment workflow
├── backend/
│   ├── sample_data/               # 5 deterministic synthetic datasets (>= 20x20)
│   │   └── expected/              # Verified expected summary.json & mask.json outputs
│   ├── src/
│   │   ├── algorithms/            # Pure TypeScript NDVI, mask, BFS component & area modules
│   │   ├── controllers/           # Express route handlers
│   │   ├── routes/                # Express API router (/api/*)
│   │   ├── services/              # Bundled dataset loader service
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   ├── utils/                 # Deterministic sample generator & OpenAPI 3.0 spec
│   │   ├── validation/            # Input parser, Zod schema validator & compatibility checker
│   │   ├── app.ts                 # Express app & error handling middleware
│   │   └── server.ts              # HTTP entrypoint binding 0.0.0.0:PORT
│   ├── tests/                     # 22 unit & Supertest API integration tests
│   ├── Dockerfile                 # Production multi-stage backend Dockerfile
│   ├── .env.example               # Backend environment variable template
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/            # Sidebar, TopBar, KpiCards, RasterVisualizer
│   │   ├── pages/                 # Overview, NewAnalysis, Results, SampleDatasets, Methodology, ApiDocs
│   │   ├── services/              # Typed REST API client
│   │   ├── tests/                 # Vitest + React Testing Library frontend tests
│   │   ├── types/                 # Frontend TypeScript interfaces
│   │   └── utils/                 # Color scales & JSON/CSV/PNG export builders
│   ├── .env.example               # Frontend environment variable template
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── architecture.md            # System architecture & Mermaid flowchart
│   ├── algorithm.md               # Mathematical specification & complexity analysis
│   ├── testing.md                 # Test suite documentation & executed results
│   ├── azure-plan.md              # Azure App Service + OIDC enterprise deployment plan
│   ├── demo-script.md             # 3–5 minute step-by-step live demonstration script
│   └── assessment-compliance.md   # 29-point PS08 requirement compliance audit
├── render.yaml                    # Render backend Blueprint configuration
├── vercel.json                    # Vercel frontend deployment configuration
├── package.json                   # Root convenience scripts
└── README.md
```

---

## 5. Prerequisites, Installation & Environment Variables

### Prerequisites
- **Node.js**: `v20.0.0` or higher (verified on `v22.21.1`)
- **npm**: `v10.0.0` or higher (verified on `v10.9.4`)

### Installation
Clone the repository and install dependencies for both `backend` and `frontend`:

```bash
npm run install:all
```
Or install each workspace individually:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Environment Variables

1. **Backend (`backend/.env` — copy from `backend/.env.example`)**:
   ```env
   PORT=4000
   NODE_ENV=development
   CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173
   MAX_PAYLOAD_SIZE=15mb
   ```
2. **Frontend (`frontend/.env` — copy from `frontend/.env.example`)**:
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```

---

## 6. Local Setup, Run, Build & Test Commands

### Run in Development Mode
Open two terminals from the repository root:

```bash
# Terminal 1: Start Express Backend API on http://localhost:4000
npm run dev:backend

# Terminal 2: Start Vite React Frontend on http://localhost:5173
npm run dev:frontend
```

### Run Automated Tests (25 Tests Total)
```bash
# Run all backend (22) and frontend (3) tests
npm test

# Or individually:
npm run test:backend
npm run test:frontend
```

### Run TypeScript Type Checks & Production Builds
```bash
npm run typecheck
npm run build
```

### Regenerate Deterministic Sample Datasets & Expected Outputs
```bash
npm run generate:samples
```

---

## 7. Bundled Synthetic Datasets (`backend/sample_data/`)

All bundled datasets are deterministically generated synthetic arrays (`origin: "synthetic"`):

| Dataset ID | Dimensions | Pixel Size | Description & Expected Behavior (`threshold = 0.25, minSize = 6`) |
| :--- | :--- | :--- | :--- |
| `synthetic-unchanged-001` | `24 × 24` (`576` px) | `10m × 10m` | Baseline vegetated pair with minor sub-threshold drift ($\|\Delta\text{NDVI}\| < 0.03$). **Expected**: `576` eligible px, `0` candidate px, `0` retained groups (`0 ha`). |
| `synthetic-rect-change-002` | `24 × 24` (`576` px) | `10m × 10m` | Calibration pair with a known $8 \times 8$ rectangular clearing at rows `6..13`, cols `8..15` ($\|\Delta\text{NDVI}\| = 0.625$). **Expected**: `64` retained px (`11.11%`), `1` group, `6,400 m²` (`0.64 ha`). |
| `synthetic-cloud-mask-003` | `24 × 24` (`576` px) | `10m × 10m` | `42` cloud-masked pixels in `before`, `35` shadow-masked pixels + `2` zero-denominator pixels in `after` (`79` invalid px, `497` eligible px), plus a $6 \times 6$ changed block. **Expected**: `36` retained px (`7.24%` of eligible), `1` group (`0.36 ha`). |
| `synthetic-multi-component-004` | `30 × 30` (`900` px) | `10m × 10m` | `60` cloud-masked pixels (`840` eligible px), `4` large changed clusters (`45, 24, 16, 12` px) and `2` small noise speckles (`3, 2` px). **Expected**: `102` candidate px (`6` groups) $\rightarrow$ `97` retained px (`11.55%`), `4` retained groups (`9,700 m²` / `0.97 ha`), `2` filtered groups (`5` px). |
| `synthetic-incompatible-005` | `20 × 20` vs `22 × 20` | `10m` vs `15m` | Negative-test fixture with mismatched dimensions, conflicting `alignmentId`, and mismatched pixel resolution. **Expected**: Rejected with HTTP `400` (`DIMENSION_MISMATCH`, `ALIGNMENT_MISMATCH`, `COORDINATE_SYSTEM_MISMATCH`, `PIXEL_RESOLUTION_MISMATCH`). |

---

## 8. Analysis Algorithm & Input JSON Schema

See [`docs/algorithm.md`](docs/algorithm.md) for the complete mathematical specification.

- **Index**: $\text{NDVI} = (\text{NIR} - \text{Red}) / (\text{NIR} + \text{Red})$ for finite normalized reflectance in $[0.0, 1.0]$.
- **Zero-Denominator Rule**: If $\text{NIR} + \text{Red} = 0$, the pixel is marked `INVALID` (`null`), never `0.0`.
- **Common Validity Mask**: A pixel is eligible (`commonValidMask[r][c] = 1`) iff it has a valid mask (`1`) and finite NDVI on *both* dates.
- **Change Measure & Threshold**: $\text{absoluteChange} = |\text{NDVI}_{\text{after}} - \text{NDVI}_{\text{before}}| \ge \text{threshold}$.
- **Connected Components & Filtering**: Deterministic row-major BFS (`8`-connectivity default, `4`-connectivity optional). Components with `pixelCount < minComponentSize` are removed from `retainedChangeMask` (`classificationMask = 1`) while components with `pixelCount >= minComponentSize` are retained (`classificationMask = 2`).
- **Area & Percentage Formulas**:
  - $\text{Area}_{\text{m}^2} = \text{pixelCount} \times \text{pixelWidthMeters} \times \text{pixelHeightMeters}$
  - $\text{Area}_{\text{ha}} = \text{Area}_{\text{m}^2} / 10{,}000$
  - $\text{Retained Changed \%} = (\text{retainedChangedPixelCount} / \text{eligiblePixelCount}) \times 100$

---

## 9. REST API Endpoints & Examples

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service status, version (`1.0.0`), and engine identifier. |
| `GET` | `/api/examples` | List of bundled synthetic datasets with metadata and recommended config. |
| `GET` | `/api/examples/:datasetId` | Full JSON dataset payload for `:datasetId`. |
| `POST` | `/api/validate` | Pre-flight schema, band, dimension, and alignment validation without full analysis. |
| `POST` | `/api/analyze` | Executes the 10-step deterministic change detection and returns masks, components, and summary. |
| `GET` | `/api/docs` | OpenAPI 3.0.3 JSON specification (or interactive Swagger UI HTML at `/api/docs?format=html`). |

### Example Request (`POST /api/analyze`)
```bash
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -d @backend/sample_data/synthetic-rect-change-002.json
```

### Example Response Excerpt (`200 OK`)
```json
{
  "analysisId": "ps08-synthetic-rect-change-002-t0.25-m6-c8",
  "datasetMetadata": {
    "datasetId": "synthetic-rect-change-002",
    "origin": "synthetic",
    "beforeDate": "2026-02-01",
    "afterDate": "2026-07-01",
    "width": 24,
    "height": 24,
    "alignmentId": "grid-utm-43n-synthetic-002",
    "pixelWidthMeters": 10,
    "pixelHeightMeters": 10
  },
  "summary": {
    "totalPixels": 576,
    "eligiblePixelCount": 576,
    "invalidPixelCount": 0,
    "candidateChangedPixelCount": 64,
    "retainedChangedPixelCount": 64,
    "retainedChangedPercentage": 11.11,
    "retainedComponentCount": 1,
    "retainedChangeAreaSquareMeters": 6400,
    "retainedChangeAreaHectares": 0.64
  }
}
```

---

## 10. Result Exports

From the **Overview** or **Results** page, users can download:
1. **Analysis Summary (`<datasetId>-summary.json`)**: Reproducible JSON report containing metadata, configuration, index summaries, validity stats, retained/filtered components, warnings, and limitations.
2. **Pixel-Level Change Mask (`<datasetId>-change-mask.csv`)**: Row-by-row tabular CSV (`row,col,common_valid,before_ndvi,after_ndvi,signed_change,absolute_change,candidate_changed,retained_changed,classification_code,classification_label,component_id`).
3. **Pixel-Level Change Mask (`<datasetId>-change-mask.json`)**: Structured 2D arrays (`retainedChangeMask`, `candidateChangeMask`, `invalidMask`, `commonValidMask`, `classificationMask`, `componentLabelMask`).
4. **Annotated Change Mask (`<datasetId>-change-mask.png`)**: High-contrast raster PNG with header telemetry and color legend.

---

## 11. Docker Packaging Instructions

A multi-stage production Dockerfile is located at [`backend/Dockerfile`](backend/Dockerfile).

```bash
# 1. Build the backend Docker image from the backend/ directory
docker build -t ps08-land-change-backend:1.0.0 ./backend

# 2. Run the container on port 4000
docker run --rm -p 4000:4000 -e PORT=4000 -e NODE_ENV=production ps08-land-change-backend:1.0.0

# 3. Verify the container health endpoint
curl http://localhost:4000/api/health
```
*(Note: During local automated audit, Docker CLI `v29.4.1` was present but the local `dockerDesktopLinuxEngine` daemon was not running, so container runtime execution is marked `NOT VERIFIED` in [`docs/assessment-compliance.md`](docs/assessment-compliance.md) until Docker Desktop is started).*

---

## 12. GitHub Actions Continuous Integration (CI)

- Workflow file: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- Triggers on every `push` and `pull_request`.
- Runs `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` across both `backend` and `frontend` on `ubuntu-latest` with Node.js 22.
- **Inspecting Real CI Results**: Push the repository to GitHub and open the **Actions** tab (`https://github.com/<username>/<repo>/actions`) to inspect the live workflow run logs.

---

## 13. Render Backend Deployment Guide

The repository includes [`render.yaml`](render.yaml) for one-click Blueprint deployment or manual Web Service setup:

1. **Create Service**: Log in to [Render](https://dashboard.render.com/), click **New +** $\rightarrow$ **Web Service**, and connect your GitHub repository.
2. **Select Root Directory**: Set **Root Directory** to `backend`.
3. **Configure Build & Start Commands**:
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
4. **Set Environment Variables**:
   - `NODE_ENV` = `production`
   - `MAX_PAYLOAD_SIZE` = `15mb`
   - `CORS_ALLOWED_ORIGINS` = `https://<your-vercel-project>.vercel.app,http://localhost:5173`
   *(Render injects `PORT` automatically; `backend/src/server.ts` listens on `0.0.0.0:PORT`).*
5. **Configure Health Check Path**: Set **Health Check Path** to `/api/health`.
6. **Deploy Backend**: Click **Create Web Service** and monitor the build and runtime logs in the Render dashboard.
7. **Test `/api/health`**: Run `curl https://<your-render-service>.onrender.com/api/health`.
8. **Test Example & Analysis Endpoints**: Run `curl https://<your-render-service>.onrender.com/api/examples`.
9. **Troubleshooting CORS / Deployment Failures**: If browser requests fail with CORS errors, verify that `CORS_ALLOWED_ORIGINS` on Render matches your exact Vercel origin (with `https://` and no trailing slash).

---

## 14. Vercel Frontend Deployment Guide

The repository includes [`vercel.json`](vercel.json) and [`frontend/vercel.json`](frontend/vercel.json):

1. **Import Repository**: Log in to [Vercel](https://vercel.com/new) and import your GitHub repository.
2. **Select Root Directory**: Set **Root Directory** to `frontend`.
3. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Add Environment Variable**:
   - Key: `VITE_API_BASE_URL`
   - Value: `https://<your-actual-render-backend>.onrender.com` (no trailing slash).
5. **Redeploy**: Trigger a deployment (or redeploy after updating `VITE_API_BASE_URL` so Vite embeds the production URL at build time).
6. **Verify Connectivity**: Open your Vercel URL and confirm the top header badge displays **Engine Online** and sample datasets load.
7. **Troubleshooting**: If the badge shows **API Offline**, verify your Render service is awake, `/api/health` returns `200 OK`, and `CORS_ALLOWED_ORIGINS` on Render includes your Vercel domain.

---

## 15. Azure Enterprise Deployment Plan & OIDC Workflow

- Detailed Architecture & Operational Plan: [`docs/azure-plan.md`](docs/azure-plan.md)
- Manually Triggered OIDC Workflow: [`.github/workflows/deploy-azure.yml`](.github/workflows/deploy-azure.yml) (`workflow_dispatch` using `azure/login@v2` with OpenID Connect federated credentials—no long-lived client secrets).

---

## 16. Scientific Limitations & Interpretation Warnings

- **Image Difference $\ne$ Verified Ground Event**: Detected changes reflect pixel-level NDVI differences between the two aligned inputs and do **not** prove construction, deforestation, agricultural clearing, or hazard damage without independent ground-truth verification.
- **Environmental Sensitivity**: Results are sensitive to unmasked clouds, cloud shadows, illumination angle differences, seasonal phenology, sub-pixel co-registration errors, and user-selected threshold / minimum component size values.

---

## 17. Demonstration Instructions

See [`docs/demo-script.md`](docs/demo-script.md) for the complete 3–5 minute step-by-step live demonstration script covering all 14 assessment demo checkpoints.

---

## 18. AI-Assistance & Reused-Code Disclosure

- **AI Assistance**: AI coding assistance was used to scaffold TypeScript interfaces, React dashboard views, Vitest unit test structures, and technical documentation under human engineering review and verification.
- **Open-Source Libraries**: Built with standard open-source npm packages (`express`, `cors`, `zod`, `react`, `react-dom`, `recharts`, `lucide-react`, `tailwindcss`, `vite`, `vitest`, `supertest`). All NDVI, validity mask, connected-component BFS, and area calculation algorithms in `backend/src/algorithms/` are custom-written in TypeScript specifically for PS08.

---

## 19. Final Assessment-Compliance Status

See [`docs/assessment-compliance.md`](docs/assessment-compliance.md) for the full 29-item audit matrix:
- **Locally Verifiable Requirements (Items 1–21, 26, 28, 29)**: **PASS** (100% implemented and verified via 25 automated tests, TypeScript checks, production builds, and live local server checks).
- **External Cloud / Daemon Runtime Verification (Items 22–25, 27)**: **NOT VERIFIED** locally (configuration files `ci.yml`, `Dockerfile`, `render.yaml`, `vercel.json`, and `deploy-azure.yml` are complete and verified for build/syntax; live runtime verification requires starting Docker Desktop or pushing to the candidate's GitHub/Render/Vercel/Azure accounts).
