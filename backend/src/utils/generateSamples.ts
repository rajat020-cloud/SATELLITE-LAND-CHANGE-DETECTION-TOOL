import fs from 'fs';
import path from 'path';
import { runLandChangeAnalysis } from '../algorithms/reportGenerator';
import { serializeAnalysisSummaryJson, serializeChangeMaskJson } from '../algorithms/exportSerializer';
import { LandChangeDataset } from '../types/landChange';

/**
 * Deterministic baseline reflectance generator for realistic-looking synthetic landscapes.
 * Produces repeatable Red and NIR values in [0.05, 0.85] based on row/col coordinates.
 */
function baseLandscapeReflectance(r: number, c: number, width: number, height: number): {
  red: number;
  nir: number;
} {
  // Create a gentle river-like dark channel near the left edge and vegetated terrain elsewhere
  const riverCenter = 3 + Math.sin(r * 0.35) * 1.4;
  const distToRiver = Math.abs(c - riverCenter);

  if (distToRiver < 1.15) {
    // Water-like low NIR / moderate Red (negative or near-zero NDVI)
    const red = Number((0.18 + 0.02 * Math.cos(r * 0.5)).toFixed(4));
    const nir = Number((0.10 + 0.02 * Math.sin(r * 0.5)).toFixed(4));
    return { red, nir };
  }

  // Vegetated canopy with smooth spatial texture
  const wave = Math.sin(r * 0.45 + c * 0.35) * 0.04 + Math.cos(r * 0.25 - c * 0.5) * 0.03;
  const red = Number(Math.max(0.06, Math.min(0.22, 0.11 - wave * 0.4)).toFixed(4));
  const nir = Number(Math.max(0.48, Math.min(0.82, 0.66 + wave)).toFixed(4));
  return { red, nir };
}

function createEmptyGrid(height: number, width: number, fillValue: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(fillValue));
}

/**
 * Dataset 1: Unchanged Synthetic Image Pair (24x24, 10m x 10m pixels)
 * Minor radiometric drift (|ΔNDVI| <= 0.03) everywhere, zero pixels >= 0.25 threshold.
 */
export function buildUnchangedDataset(): LandChangeDataset {
  const width = 24;
  const height = 24;
  const beforeRed = createEmptyGrid(height, width, 0);
  const beforeNir = createEmptyGrid(height, width, 0);
  const afterRed = createEmptyGrid(height, width, 0);
  const afterNir = createEmptyGrid(height, width, 0);
  const validMask = createEmptyGrid(height, width, 1);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const base = baseLandscapeReflectance(r, c, width, height);
      beforeRed[r][c] = base.red;
      beforeNir[r][c] = base.nir;

      // Subtle sub-threshold sensor drift (|ΔNDVI| < 0.03)
      const drift = ((r + c) % 3 === 0 ? 0.004 : -0.003);
      afterRed[r][c] = Number(Math.max(0.05, Math.min(0.9, base.red + drift)).toFixed(4));
      afterNir[r][c] = Number(Math.max(0.05, Math.min(0.9, base.nir - drift)).toFixed(4));
    }
  }

  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-unchanged-001',
    title: 'Unchanged Forest Baseline (Synthetic)',
    origin: 'synthetic',
    description:
      'Synthetic 24×24 image pair representing a stable vegetated basin with minor sub-threshold radiometric variation (|ΔNDVI| < 0.03) and zero land-cover change.',
    recommendedConfig: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    },
    before: {
      date: '2026-01-15',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-001',
      coordinateSystem: 'LOCAL-METRIC-GRID-01',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: beforeRed, nir: beforeNir },
      validMask: validMask.map((row) => [...row])
    },
    after: {
      date: '2026-06-15',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-001',
      coordinateSystem: 'LOCAL-METRIC-GRID-01',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: afterRed, nir: afterNir },
      validMask: validMask.map((row) => [...row])
    }
  };
}

/**
 * Dataset 2: Known Changed Rectangular Region (24x24, 10m x 10m pixels)
 * Exact 8x8 rectangular region (rows 6..13, cols 8..15 = 64 pixels = 6,400 m² = 0.64 ha)
 * transitioning from high NDVI (~0.75) to low NDVI (~0.125), |ΔNDVI| = 0.625.
 */
export function buildRectangularChangeDataset(): LandChangeDataset {
  const width = 24;
  const height = 24;
  const beforeRed = createEmptyGrid(height, width, 0);
  const beforeNir = createEmptyGrid(height, width, 0);
  const afterRed = createEmptyGrid(height, width, 0);
  const afterNir = createEmptyGrid(height, width, 0);
  const validMask = createEmptyGrid(height, width, 1);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const base = baseLandscapeReflectance(r, c, width, height);
      beforeRed[r][c] = base.red;
      beforeNir[r][c] = base.nir;
      afterRed[r][c] = base.red;
      afterNir[r][c] = base.nir;

      // Known 8x8 rectangular change region (rows 6..13, cols 8..15 -> 64 pixels)
      if (r >= 6 && r <= 13 && c >= 8 && c <= 15) {
        beforeRed[r][c] = 0.10;
        beforeNir[r][c] = 0.70; // NDVI_before = (0.70 - 0.10)/0.80 = 0.75
        afterRed[r][c] = 0.35;
        afterNir[r][c] = 0.45; // NDVI_after = (0.45 - 0.35)/0.80 = 0.125 -> |ΔNDVI| = 0.625
      }
    }
  }

  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-rect-change-002',
    title: 'Known Rectangular Canopy Transition (Synthetic)',
    origin: 'synthetic',
    description:
      'Synthetic 24×24 calibration pair containing a single contiguous 8×8 rectangular changed region (64 pixels, 6,400 m² / 0.64 ha) at rows 6–13, columns 8–15 with |ΔNDVI| = 0.625.',
    recommendedConfig: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    },
    before: {
      date: '2026-02-01',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-002',
      coordinateSystem: 'LOCAL-METRIC-GRID-02',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: beforeRed, nir: beforeNir },
      validMask: validMask.map((row) => [...row])
    },
    after: {
      date: '2026-07-01',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-002',
      coordinateSystem: 'LOCAL-METRIC-GRID-02',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: afterRed, nir: afterNir },
      validMask: validMask.map((row) => [...row])
    }
  };
}

/**
 * Dataset 3: Cloud-Masked & Invalid Pixels Dataset (24x24, 10m x 10m pixels)
 * Demonstrates:
 * - Upper-right cloud bank on 'before' date (rows 1..6, cols 16..22 = 42 invalid pixels)
 * - Lower-left cloud shadow on 'after' date (rows 16..20, cols 2..8 = 35 invalid pixels)
 * - 2 zero-denominator sensor drop-out pixels at (12, 2) and (12, 3) on 'after' date
 * - Total invalid pixels = 42 + 35 + 2 = 79; eligible pixels = 576 - 79 = 497
 * - Known valid changed block of 6x6 = 36 pixels (rows 8..13, cols 9..14 = 3,600 m² / 0.36 ha)
 * - Unmasked vs masked verification: high reflectance values inside the invalid cloud bank are ignored.
 */
export function buildCloudMaskedDataset(): LandChangeDataset {
  const width = 24;
  const height = 24;
  const beforeRed = createEmptyGrid(height, width, 0);
  const beforeNir = createEmptyGrid(height, width, 0);
  const afterRed = createEmptyGrid(height, width, 0);
  const afterNir = createEmptyGrid(height, width, 0);
  const beforeMask = createEmptyGrid(height, width, 1);
  const afterMask = createEmptyGrid(height, width, 1);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const base = baseLandscapeReflectance(r, c, width, height);
      beforeRed[r][c] = base.red;
      beforeNir[r][c] = base.nir;
      afterRed[r][c] = base.red;
      afterNir[r][c] = base.nir;

      // Valid changed region (rows 8..13, cols 9..14 -> 36 pixels)
      if (r >= 8 && r <= 13 && c >= 9 && c <= 14) {
        beforeRed[r][c] = 0.09;
        beforeNir[r][c] = 0.71; // NDVI = 0.775
        afterRed[r][c] = 0.38;
        afterNir[r][c] = 0.42; // NDVI = 0.05 -> |ΔNDVI| = 0.725
      }

      // Upper-right cloud bank on 'before' date (42 pixels: rows 1..6, cols 16..22)
      if (r >= 1 && r <= 6 && c >= 16 && c <= 22) {
        beforeMask[r][c] = 0;
        // Bright cloud reflectance that would trigger false change if not masked
        beforeRed[r][c] = 0.85;
        beforeNir[r][c] = 0.88;
      }

      // Lower-left cloud/shadow mask on 'after' date (35 pixels: rows 16..20, cols 2..8)
      if (r >= 16 && r <= 20 && c >= 2 && c <= 8) {
        afterMask[r][c] = 0;
        afterRed[r][c] = 0.80;
        afterNir[r][c] = 0.82;
      }
    }
  }

  // 2 zero-denominator pixels on 'after' date where validMask is 1 but Red=0, NIR=0
  afterRed[12][2] = 0;
  afterNir[12][2] = 0;
  afterRed[12][3] = 0;
  afterNir[12][3] = 0;

  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-cloud-mask-003',
    title: 'Cloud & Sensor-Dropout Exclusion (Synthetic)',
    origin: 'synthetic',
    description:
      'Synthetic 24×24 image pair demonstrating per-date cloud validity masks (42 masked pixels in before, 35 in after) and 2 zero-denominator pixels (79 total invalid pixels, 497 eligible pixels) alongside a 36-pixel changed zone.',
    recommendedConfig: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    },
    before: {
      date: '2026-03-10',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-003',
      coordinateSystem: 'LOCAL-METRIC-GRID-03',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: beforeRed, nir: beforeNir },
      validMask: beforeMask
    },
    after: {
      date: '2026-08-10',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-003',
      coordinateSystem: 'LOCAL-METRIC-GRID-03',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: afterRed, nir: afterNir },
      validMask: afterMask
    }
  };
}

/**
 * Dataset 4: Multi-Component & Minimum-Size Filtering Dataset (30x30, 10m x 10m pixels)
 * Demonstrates connected-component grouping and minimum-size filtering:
 * - Total pixels: 900 (30x30), pixel size: 10m x 10m (100 m²/pixel)
 * - Invalid cloud pixels: 60 (rows 1..4, cols 20..28 = 36 on before; rows 24..27, cols 2..7 = 24 on after)
 * - Eligible pixels: 840
 * - 6 candidate changed components:
 *   1. Component 1 (North-West patch, rows 2..5, cols 6..11): 4x6 = 24 pixels (2,400 m² / 0.24 ha)
 *   2. Speckle A (Isolated noise at row 3, cols 15..16): 2 pixels (filtered out when minComponentSize >= 3)
 *   3. Component 2 (Central main clearing, rows 9..17, cols 10..14): 9x5 = 45 pixels (4,500 m² / 0.45 ha)
 *   4. Component 3 (8-connected diagonal corridor, 12 pixels starting at row 10, col 18): 12 pixels (1,200 m² / 0.12 ha)
 *   5. Speckle B (Small 3-pixel L-cluster at rows 19..20, cols 6..7): 3 pixels (filtered out when minComponentSize >= 4)
 *   6. Component 4 (South-East regrowth/shift patch, rows 22..25, cols 19..22): 4x4 = 16 pixels (1,600 m² / 0.16 ha)
 * Total candidate changed pixels = 24 + 2 + 45 + 12 + 3 + 16 = 102 pixels across 6 candidate components.
 * With minComponentSize = 6:
 *   Retained components = 4 (24, 45, 12, 16 -> 97 pixels = 9,700 m² = 0.97 ha)
 *   Filtered-out components = 2 (2, 3 -> 5 pixels)
 */
export function buildMultiComponentDataset(): LandChangeDataset {
  const width = 30;
  const height = 30;
  const beforeRed = createEmptyGrid(height, width, 0);
  const beforeNir = createEmptyGrid(height, width, 0);
  const afterRed = createEmptyGrid(height, width, 0);
  const afterNir = createEmptyGrid(height, width, 0);
  const beforeMask = createEmptyGrid(height, width, 1);
  const afterMask = createEmptyGrid(height, width, 1);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const base = baseLandscapeReflectance(r, c, width, height);
      beforeRed[r][c] = base.red;
      beforeNir[r][c] = base.nir;
      afterRed[r][c] = base.red;
      afterNir[r][c] = base.nir;
    }
  }

  const applyVegetationLoss = (r: number, c: number, intensity: 'strong' | 'moderate' = 'strong') => {
    beforeRed[r][c] = 0.09;
    beforeNir[r][c] = 0.71; // NDVI = 0.775
    if (intensity === 'strong') {
      afterRed[r][c] = 0.38;
      afterNir[r][c] = 0.42; // NDVI = 0.05 -> |ΔNDVI| = 0.725
    } else {
      afterRed[r][c] = 0.28;
      afterNir[r][c] = 0.52; // NDVI = 0.30 -> |ΔNDVI| = 0.475
    }
  };

  // Retained Component 1: North-West block (rows 2..5, cols 6..11 -> 24 pixels)
  for (let r = 2; r <= 5; r++) {
    for (let c = 6; c <= 11; c++) {
      applyVegetationLoss(r, c, 'moderate');
    }
  }

  // Filtered Speckle A: 2-pixel isolated noise at row 3, cols 15..16
  applyVegetationLoss(3, 15, 'moderate');
  applyVegetationLoss(3, 16, 'moderate');

  // Retained Component 2: Central clearing block (rows 9..17, cols 10..14 -> 45 pixels)
  for (let r = 9; r <= 17; r++) {
    for (let c = 10; c <= 14; c++) {
      applyVegetationLoss(r, c, 'strong');
    }
  }

  // Retained Component 3: 12-pixel 8-connected diagonal/stepped corridor (rows 10..15, cols 18..23)
  const corridorCoords: Array<[number, number]> = [
    [10, 18], [10, 19],
    [11, 19], [11, 20],
    [12, 20], [12, 21],
    [13, 21], [13, 22],
    [14, 22], [14, 23],
    [15, 23], [15, 24]
  ];
  for (const [r, c] of corridorCoords) {
    applyVegetationLoss(r, c, 'strong');
  }

  // Filtered Speckle B: 3-pixel noise cluster at (19, 6), (19, 7), (20, 6)
  applyVegetationLoss(19, 6, 'moderate');
  applyVegetationLoss(19, 7, 'moderate');
  applyVegetationLoss(20, 6, 'moderate');

  // Retained Component 4: South-East vegetation gain/shift patch (rows 22..25, cols 19..22 -> 16 pixels)
  for (let r = 22; r <= 25; r++) {
    for (let c = 19; c <= 22; c++) {
      beforeRed[r][c] = 0.36;
      beforeNir[r][c] = 0.44; // NDVI_before = 0.10
      afterRed[r][c] = 0.11;
      afterNir[r][c] = 0.69; // NDVI_after = 0.725 -> |ΔNDVI| = 0.625 (increase)
    }
  }

  // Cloud masks: 36 pixels on before (rows 1..4, cols 20..28) and 24 pixels on after (rows 24..27, cols 2..7)
  for (let r = 1; r <= 4; r++) {
    for (let c = 20; c <= 28; c++) {
      beforeMask[r][c] = 0;
    }
  }
  for (let r = 24; r <= 27; r++) {
    for (let c = 2; c <= 7; c++) {
      afterMask[r][c] = 0;
    }
  }

  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-multi-component-004',
    title: 'Multi-Cluster Clearing & Speckle Filtering (Synthetic)',
    origin: 'synthetic',
    description:
      'Synthetic 30×30 multi-region dataset containing 4 substantive change clusters (45, 24, 16, and 12 pixels), 2 small noise speckles (3 and 2 pixels) removed by minimum-size filtering, and 60 cloud-masked pixels.',
    recommendedConfig: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    },
    before: {
      date: '2026-01-10',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-004',
      coordinateSystem: 'LOCAL-METRIC-GRID-04',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: beforeRed, nir: beforeNir },
      validMask: beforeMask
    },
    after: {
      date: '2026-09-10',
      width,
      height,
      alignmentId: 'grid-utm-43n-synthetic-004',
      coordinateSystem: 'LOCAL-METRIC-GRID-04',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: afterRed, nir: afterNir },
      validMask: afterMask
    }
  };
}

/**
 * Dataset 5 (Optional validation failure demonstration):
 * Incompatible dimensions (20x20 vs 22x20) and mismatched alignmentId.
 */
export function buildIncompatibleDataset(): LandChangeDataset {
  const beforeWidth = 20;
  const beforeHeight = 20;
  const afterWidth = 22;
  const afterHeight = 20;

  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-incompatible-005',
    title: 'Incompatible Grid & Alignment Demo (Synthetic)',
    origin: 'synthetic',
    description:
      'Synthetic negative-test dataset with mismatched dimensions (20×20 vs 22×20) and conflicting alignmentId values to demonstrate strict validation rejection.',
    recommendedConfig: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    },
    before: {
      date: '2026-01-01',
      width: beforeWidth,
      height: beforeHeight,
      alignmentId: 'grid-zone-alpha-001',
      coordinateSystem: 'LOCAL-GRID-ALPHA',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: {
        red: createEmptyGrid(beforeHeight, beforeWidth, 0.15),
        nir: createEmptyGrid(beforeHeight, beforeWidth, 0.65)
      },
      validMask: createEmptyGrid(beforeHeight, beforeWidth, 1)
    },
    after: {
      date: '2026-06-01',
      width: afterWidth,
      height: afterHeight,
      alignmentId: 'grid-zone-beta-999',
      coordinateSystem: 'LOCAL-GRID-BETA',
      pixelWidthMeters: 15,
      pixelHeightMeters: 15,
      bands: {
        red: createEmptyGrid(afterHeight, afterWidth, 0.25),
        nir: createEmptyGrid(afterHeight, afterWidth, 0.55)
      },
      validMask: createEmptyGrid(afterHeight, afterWidth, 1)
    }
  };
}

export function generateAllSampleDataFiles(baseSampleDir?: string): void {
  const sampleDir = baseSampleDir ?? path.resolve(__dirname, '../../sample_data');
  const expectedDir = path.join(sampleDir, 'expected');

  fs.mkdirSync(sampleDir, { recursive: true });
  fs.mkdirSync(expectedDir, { recursive: true });

  const validDatasets: LandChangeDataset[] = [
    buildUnchangedDataset(),
    buildRectangularChangeDataset(),
    buildCloudMaskedDataset(),
    buildMultiComponentDataset()
  ];

  for (const ds of validDatasets) {
    const datasetFilePath = path.join(sampleDir, `${ds.datasetId}.json`);
    fs.writeFileSync(datasetFilePath, JSON.stringify(ds, null, 2), 'utf-8');

    const config = ds.recommendedConfig ?? {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8
    };
    const analysis = runLandChangeAnalysis(ds, config);
    // Use a fixed deterministic timestamp for committed expected outputs
    analysis.timestamp = '2026-06-01T00:00:00.000Z';
    analysis.processingDurationMs = 0;

    const expectedSummaryPath = path.join(expectedDir, `${ds.datasetId}.summary.json`);
    const expectedMaskPath = path.join(expectedDir, `${ds.datasetId}.mask.json`);

    fs.writeFileSync(expectedSummaryPath, serializeAnalysisSummaryJson(analysis), 'utf-8');
    fs.writeFileSync(expectedMaskPath, serializeChangeMaskJson(analysis), 'utf-8');
  }

  // Write the 5th incompatible dataset for validation failure demo
  const incompatible = buildIncompatibleDataset();
  fs.writeFileSync(
    path.join(sampleDir, `${incompatible.datasetId}.json`),
    JSON.stringify(incompatible, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(expectedDir, `${incompatible.datasetId}.expected-error.json`),
    JSON.stringify(
      {
        valid: false,
        expectedErrorCodes: [
          'DIMENSION_MISMATCH',
          'ALIGNMENT_MISMATCH',
          'COORDINATE_SYSTEM_MISMATCH',
          'PIXEL_RESOLUTION_MISMATCH'
        ]
      },
      null,
      2
    ),
    'utf-8'
  );
}

if (require.main === module) {
  generateAllSampleDataFiles();
  console.log('Successfully generated all synthetic datasets and expected outputs in backend/sample_data/');
}
