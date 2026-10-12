# Algorithm Specification — PS08 Satellite Land Change Detection

## 1. Input Format & Data Contract

The engine accepts a validated JSON dataset conforming to `schemaVersion: "1.0"`. Both `before` and `after` temporal image slices must represent the same co-registered geographic grid (`alignmentId`) with dimensions of at least **20 × 20 pixels**:

```json
{
  "schemaVersion": "1.0",
  "datasetId": "synthetic-rect-change-002",
  "origin": "synthetic",
  "description": "Synthetic land-change demonstration",
  "before": {
    "date": "2026-02-01",
    "width": 24,
    "height": 24,
    "alignmentId": "grid-utm-43n-synthetic-002",
    "pixelWidthMeters": 10,
    "pixelHeightMeters": 10,
    "bands": {
      "red": [[0.10, 0.12, "..."]],
      "nir": [[0.70, 0.68, "..."]]
    },
    "validMask": [[1, 1, "..."]]
  },
  "after": {
    "date": "2026-07-01",
    "width": 24,
    "height": 24,
    "alignmentId": "grid-utm-43n-synthetic-002",
    "pixelWidthMeters": 10,
    "pixelHeightMeters": 10,
    "bands": {
      "red": [[0.35, 0.12, "..."]],
      "nir": [[0.45, 0.68, "..."]]
    },
    "validMask": [[1, 1, "..."]]
  }
}
```

### Band Definitions & Source Conversion
- **`red`**: Visible Red surface reflectance band, normalized to finite floating-point values in `[0.0, 1.0]`.
- **`nir`**: Near-Infrared surface reflectance band, normalized to finite floating-point values in `[0.0, 1.0]`.
- **Converting External Formats**: Raw integer Digital Numbers (e.g., Sentinel-2 L2A `UINT16` reflectance divided by `10,000`, or Landsat Collection 2 Surface Reflectance multiplied by `0.0000275` with `-0.2` offset) must be radiometrically scaled and clipped to `[0.0, 1.0]`, and cloud/shadow QA bitmasks must be converted to binary `0/1` `validMask` arrays prior to ingestion.

---

## 2. Spectral Index Calculation (NDVI)

For every pixel `(r, c)` on each acquisition date where `validMask[r][c] === 1`, the Normalized Difference Vegetation Index (NDVI) is calculated as:

$$\text{NDVI}_{r,c} = \frac{\text{NIR}_{r,c} - \text{Red}_{r,c}}{\text{NIR}_{r,c} + \text{Red}_{r,c}}$$

### Zero-Denominator & Invalid-Pixel Treatment
1. If `validMask[r][c] === 0` on a given date, the pixel is immediately marked invalid (`ndviGrid[r][c] = null`, `effectiveValidMask[r][c] = 0`).
2. If `validMask[r][c] === 1` but $\text{NIR}_{r,c} + \text{Red}_{r,c} = 0$ (within floating-point epsilon $10^{-12}$), the division is undefined. The pixel is marked invalid (`ndviGrid[r][c] = null`, `effectiveValidMask[r][c] = 0`) and counted in `zeroDenominatorPixels`.
3. **No Silent Zero Assignment**: Invalid pixels are never assigned `0.0` NDVI or `0.0` change; they remain `null` and are excluded from all change comparisons and percentage denominators.

---

## 3. Common Validity Mask

A pixel `(r, c)` belongs to the **common eligible comparison set** (`commonValidMask[r][c] = 1`) if and only if it is valid and has a finite, calculable NDVI on **both** dates:

$$\text{commonValidMask}[r][c] = \begin{cases} 1 & \text{if } \text{effectiveValid}_{\text{before}}[r][c] = 1 \land \text{effectiveValid}_{\text{after}}[r][c] = 1 \\ 0 & \text{otherwise} \end{cases}$$

The complementary invalid mask is $\text{invalidMask}[r][c] = 1 - \text{commonValidMask}[r][c]$.

---

## 4. Change Measure & Threshold Semantics

A single NDVI value does not prove land change. For each pixel in the common eligible set (`commonValidMask[r][c] === 1`), the signed and absolute temporal NDVI changes are computed as:

$$\Delta\text{NDVI}_{r,c} = \text{NDVI}_{\text{after}, r, c} - \text{NDVI}_{\text{before}, r, c}$$

$$\text{absoluteChange}_{r,c} = \left|\text{NDVI}_{\text{after}, r, c} - \text{NDVI}_{\text{before}, r, c}\right|$$

### Threshold Rule (`GREATER_THAN_OR_EQUAL >=`)
A pixel is classified as a **candidate changed pixel** (`candidateChangeMask[r][c] = 1`) when it is eligible and its absolute change is **greater than or equal to** the configured threshold $T \in [0.0, 2.0]$:

$$\text{candidateChangeMask}[r][c] = 1 \iff \text{commonValidMask}[r][c] = 1 \land \text{absoluteChange}_{r,c} \ge T$$

---

## 5. Connected-Component Labeling & Minimum-Size Filtering

### Connected-Component Labeling
Candidate changed pixels (`candidateChangeMask[r][c] === 1`) are grouped into connected components using deterministic row-major Breadth-First Search (BFS):
- **8-connectivity (default)**: Two candidate changed pixels are adjacent if they share an edge or a corner ($8$ neighbors: $(\pm 1, 0), (0, \pm 1), (\pm 1, \pm 1)$).
- **4-connectivity (optional)**: Two candidate changed pixels are adjacent only if they share a horizontal or vertical edge ($4$ neighbors: $(\pm 1, 0), (0, \pm 1)$).
- Invalid pixels (`commonValidMask[r][c] === 0`) can never belong to or bridge any connected component.

### Minimum-Size Filtering
Given user-configured `minComponentSize` $M \ge 1$ (in pixels):
- If a component has `pixelCount >= M`, it is marked **RETAINED**, assigned a deterministic sequential `componentId` ($1, 2, \dots, K$ in row-major scan order), and its pixels are set to `1` in `retainedChangeMask` and `2` (`RETAINED_CHANGE`) in `classificationMask`.
- If a component has `pixelCount < M`, it is marked **FILTERED OUT** (`retained = false`). Its pixels are set to `0` in `retainedChangeMask` and `1` (`FILTERED_CANDIDATE_CHANGE`) in `classificationMask`. Filtered-out components do not contribute to `retainedComponentCount` or `retainedChangeArea`.

---

## 6. Area Calculations & Statistical Denominators

### Physical Area Calculation
Using the supplied pixel dimensions (`pixelWidthMeters` $W_p$ and `pixelHeightMeters` $H_p$):

$$\text{componentArea}_{\text{m}^2} = \text{componentPixelCount} \times W_p \times H_p$$

$$\text{componentArea}_{\text{ha}} = \frac{\text{componentArea}_{\text{m}^2}}{10{,}000}, \qquad \text{componentArea}_{\text{km}^2} = \frac{\text{componentArea}_{\text{m}^2}}{1{,}000{,}000}$$

### Percentage Denominators
- **Candidate Changed Percentage**:
  $$\text{candidateChangedPercentage} = \frac{\text{candidateChangedPixelCount}}{\text{eligiblePixelCount}} \times 100$$
- **Retained Changed Percentage**:
  $$\text{retainedChangedPercentage} = \frac{\text{retainedChangedPixelCount}}{\text{eligiblePixelCount}} \times 100$$
- **Grid Coverage Percentages (`validCoveragePercentage`, `invalidPercentage`)**:
  Use `totalPixels = width × height` as the denominator.
- **Zero-Eligible Protection**: If `eligiblePixelCount === 0`, both `candidateChangedPercentage` and `retainedChangedPercentage` are returned as `null` alongside a `ZERO_ELIGIBLE_PIXELS` warning instead of dividing by zero.

---

## 7. Time & Space Complexity

Let $N = \text{width} \times \text{height}$ be the total number of pixels in each temporal slice:
- **Time Complexity**: $\mathcal{O}(N)$. Schema matrix checks, per-pixel NDVI calculation, common validity mask construction, thresholding, and BFS connected-component labeling (where each pixel is enqueued at most once and checks at most 8 neighbors) all execute in strictly linear time $\mathcal{O}(N)$.
- **Auxiliary Space Complexity**: $\mathcal{O}(N)$ to store the 2D output rasters (`beforeNdvi`, `afterNdvi`, `absoluteChange`, `commonValidMask`, `retainedChangeMask`, `classificationMask`, `componentLabelMask`) and the flat `Uint8Array(N)` visited array for BFS.

---

## 8. Known Limitations & Interpretation Warnings

1. **Image Difference ≠ Verified Real-World Event**: The output identifies spectral index differences between two digital arrays. It does **not** prove deforestation, urban construction, agricultural clearing, or disaster damage without independent ground-truth verification.
2. **Clouds and Cloud Shadows**: Unmasked thin clouds or cast shadows alter Red and NIR reflectance and can cause false-positive change components if not captured in `validMask`.
3. **Lighting and Viewing Geometry**: Differences in solar zenith/azimuth angles and sensor viewing angles (BRDF effects) between acquisition dates can shift NDVI values.
4. **Seasonal and Phenological Variation**: Natural seasonal vegetation cycles (e.g., dry-season leaf drop vs. monsoon green-up) produce large `|ΔNDVI|` values without permanent land-cover change.
5. **Image Alignment Errors**: Sub-pixel misregistration between `before` and `after` images introduces false change streaks along high-contrast edges.
6. **Noise and Threshold Selection**: Lower thresholds increase sensitivity to sensor noise; higher `minComponentSize` filters suppress noise speckles but may also remove genuine small-scale changes.
7. **Changes Missed by NDVI**: Transitions between non-vegetated surfaces with similar Red/NIR contrast (e.g., bare soil graded into concrete or asphalt) may produce negligible `|ΔNDVI|` and remain undetected.
