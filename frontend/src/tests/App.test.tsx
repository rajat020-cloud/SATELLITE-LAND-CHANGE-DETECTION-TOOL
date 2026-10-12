import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AnalysisResponse, DatasetCatalogEntry, LandChangeDataset } from '../types/landChange';
import { ndviToRgb } from '../utils/colorScales';
import {
  buildMaskCsvString,
  buildMaskJsonString,
  buildSummaryExportObject
} from '../utils/exportHelpers';

const MOCK_CATALOG: DatasetCatalogEntry[] = [
  {
    datasetId: 'synthetic-multi-component-004',
    title: 'Multi-Cluster Clearing & Speckle Filtering (Synthetic)',
    origin: 'synthetic',
    description: 'Synthetic 30x30 multi-region dataset.',
    beforeDate: '2026-01-10',
    afterDate: '2026-09-10',
    width: 20,
    height: 20,
    alignmentId: 'grid-utm-43n-synthetic-004',
    pixelWidthMeters: 10,
    pixelHeightMeters: 10,
    isValidDemo: true,
    recommendedConfig: { threshold: 0.25, minComponentSize: 6, connectivity: 8 }
  },
  {
    datasetId: 'synthetic-incompatible-005',
    title: 'Incompatible Grid & Alignment Demo (Synthetic)',
    origin: 'synthetic',
    description: 'Synthetic negative-test dataset.',
    beforeDate: '2026-01-01',
    afterDate: '2026-06-01',
    width: 20,
    height: 20,
    alignmentId: 'grid-zone-alpha-001',
    pixelWidthMeters: 10,
    pixelHeightMeters: 10,
    isValidDemo: false,
    recommendedConfig: { threshold: 0.25, minComponentSize: 6, connectivity: 8 }
  }
];

function createMockDataset(): LandChangeDataset {
  const grid = (v: number) => Array.from({ length: 20 }, () => Array<number>(20).fill(v));
  return {
    schemaVersion: '1.0',
    datasetId: 'synthetic-multi-component-004',
    title: 'Multi-Cluster Clearing & Speckle Filtering (Synthetic)',
    origin: 'synthetic',
    description: 'Synthetic 20x20 test dataset',
    recommendedConfig: { threshold: 0.25, minComponentSize: 6, connectivity: 8 },
    before: {
      date: '2026-01-10',
      width: 20,
      height: 20,
      alignmentId: 'grid-utm-43n-synthetic-004',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: grid(0.1), nir: grid(0.7) },
      validMask: grid(1)
    },
    after: {
      date: '2026-09-10',
      width: 20,
      height: 20,
      alignmentId: 'grid-utm-43n-synthetic-004',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10,
      bands: { red: grid(0.3), nir: grid(0.5) },
      validMask: grid(1)
    }
  };
}

function createMockAnalysisResponse(): AnalysisResponse {
  const gridNum = (v: number) => Array.from({ length: 20 }, () => Array<number>(20).fill(v));
  return {
    analysisId: 'ps08-synthetic-multi-component-004-t0.25-m6-c8',
    timestamp: '2026-06-01T00:00:00.000Z',
    processingDurationMs: 4.2,
    datasetMetadata: {
      schemaVersion: '1.0',
      datasetId: 'synthetic-multi-component-004',
      title: 'Multi-Cluster Clearing & Speckle Filtering (Synthetic)',
      origin: 'synthetic',
      description: 'Synthetic 20x20 test dataset',
      beforeDate: '2026-01-10',
      afterDate: '2026-09-10',
      width: 20,
      height: 20,
      alignmentId: 'grid-utm-43n-synthetic-004',
      coordinateSystem: 'LOCAL-METRIC-GRID-04',
      pixelWidthMeters: 10,
      pixelHeightMeters: 10
    },
    config: {
      threshold: 0.25,
      minComponentSize: 6,
      connectivity: 8,
      comparisonOperator: 'GREATER_THAN_OR_EQUAL (>=)',
      indexFormula: 'NDVI = (NIR - Red) / (NIR + Red)',
      changeFormula: 'absoluteChange = |NDVI_after - NDVI_before|'
    },
    indexSummaries: {
      before: { min: 0.5, max: 0.75, mean: 0.65, validIndexPixels: 380, zeroDenominatorPixels: 0 },
      after: { min: 0.1, max: 0.75, mean: 0.52, validIndexPixels: 380, zeroDenominatorPixels: 0 }
    },
    summary: {
      totalPixels: 400,
      pixelAreaSquareMeters: 100,
      totalAreaSquareMeters: 40000,
      totalAreaHectares: 4.0,
      beforeValidity: {
        date: '2026-01-10',
        totalPixels: 400,
        maskValidPixels: 380,
        maskInvalidPixels: 20,
        zeroDenominatorPixels: 0,
        effectiveValidPixels: 380,
        validCoveragePercentage: 95
      },
      afterValidity: {
        date: '2026-09-10',
        totalPixels: 400,
        maskValidPixels: 380,
        maskInvalidPixels: 20,
        zeroDenominatorPixels: 0,
        effectiveValidPixels: 380,
        validCoveragePercentage: 95
      },
      eligiblePixelCount: 380,
      invalidPixelCount: 20,
      validCoveragePercentage: 95,
      invalidPercentage: 5,
      unchangedEligiblePixelCount: 330,
      candidateChangedPixelCount: 50,
      filteredOutChangedPixelCount: 5,
      retainedChangedPixelCount: 45,
      candidateChangedPercentage: 13.16,
      retainedChangedPercentage: 11.84,
      candidateChangeAreaSquareMeters: 5000,
      candidateChangeAreaHectares: 0.5,
      candidateChangeAreaSquareKilometers: 0.005,
      retainedChangeAreaSquareMeters: 4500,
      retainedChangeAreaHectares: 0.45,
      retainedChangeAreaSquareKilometers: 0.0045,
      candidateComponentCount: 2,
      filteredOutComponentCount: 1,
      retainedComponentCount: 1,
      percentageDenominatorDescription: 'Uses eligiblePixelCount as denominator'
    },
    components: {
      retained: [
        {
          componentId: 1,
          pixelCount: 45,
          areaSquareMeters: 4500,
          areaHectares: 0.45,
          areaSquareKilometers: 0.0045,
          percentageOfEligible: 11.84,
          meanAbsoluteChange: 0.55,
          maxAbsoluteChange: 0.65,
          meanSignedChange: -0.55,
          dominantDirection: 'decrease',
          boundingBox: { minRow: 4, maxRow: 12, minCol: 5, maxCol: 9 },
          centroid: { row: 8, col: 7 },
          retained: true,
          pixels: [[4, 5]]
        }
      ],
      filteredOut: [
        {
          componentId: 1,
          pixelCount: 5,
          areaSquareMeters: 500,
          areaHectares: 0.05,
          areaSquareKilometers: 0.0005,
          percentageOfEligible: 1.32,
          meanAbsoluteChange: 0.4,
          maxAbsoluteChange: 0.42,
          meanSignedChange: -0.4,
          dominantDirection: 'decrease',
          boundingBox: { minRow: 1, maxRow: 2, minCol: 1, maxCol: 3 },
          centroid: { row: 1.5, col: 2 },
          retained: false,
          pixels: [[1, 1]]
        }
      ],
      allCandidate: []
    },
    rasters: {
      beforeNdvi: gridNum(0.75),
      afterNdvi: gridNum(0.25),
      absoluteChange: gridNum(0.5),
      signedChange: gridNum(-0.5),
      commonValidMask: gridNum(1),
      invalidMask: gridNum(0),
      candidateChangeMask: gridNum(0),
      retainedChangeMask: gridNum(0),
      classificationMask: gridNum(0) as AnalysisResponse['rasters']['classificationMask'],
      componentLabelMask: gridNum(0)
    },
    warnings: ['Synthetic dataset warning'],
    limitations: ['Detected changes indicate spectral index differences, not verified ground events.']
  };
}

describe('Scenario 23: Frontend Validation, Analysis Flow, and Export Consistency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Loads default dataset, renders Overview KPI cards, Before/After/Change/Invalid canvases, and navigates pages', async () => {
    const mockAnalysis = createMockAnalysisResponse();
    const mockDataset = createMockDataset();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'ps08-land-change-backend',
            version: '1.0.0',
            engine: 'deterministic',
            timestamp: '2026-06-01T00:00:00.000Z'
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/api/examples')) {
        return new Response(JSON.stringify({ datasets: MOCK_CATALOG }), { status: 200 });
      }
      if (url.includes('/api/examples/')) {
        return new Response(JSON.stringify(mockDataset), { status: 200 });
      }
      if (url.endsWith('/api/analyze')) {
        return new Response(JSON.stringify(mockAnalysis), { status: 200 });
      }
      if (url.endsWith('/api/validate')) {
        return new Response(
          JSON.stringify({
            valid: true,
            issues: [],
            warnings: ['Synthetic dataset']
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Before (NDVI)')).toBeInTheDocument();
      expect(screen.getByText('After (NDVI)')).toBeInTheDocument();
      expect(screen.getByText('Change Detection')).toBeInTheDocument();
      expect(screen.getByText('Invalid Pixel Mask')).toBeInTheDocument();
    });

    // Check KPI and statistics values from mock backend analysis
    expect(screen.getByText('0.45 ha')).toBeInTheDocument();
    expect(screen.getByText('(4,500 m²)')).toBeInTheDocument();

    // Navigate to New Analysis page
    fireEvent.click(screen.getByRole('button', { name: /New Analysis/i }));
    expect(screen.getByText('New Land-Change Analysis')).toBeInTheDocument();

    // Navigate to Results page
    fireEvent.click(screen.getByRole('button', { name: /Results/i }));
    expect(screen.getByText(/Detailed Analytical Report/i)).toBeInTheDocument();

    // Navigate to Methodology page
    fireEvent.click(screen.getByRole('button', { name: /Methodology/i }));
    expect(
      screen.getByText(/PS08 Algorithmic Methodology & Scientific Limitations/i)
    ).toBeInTheDocument();
  });

  it('Displays actionable validation error banner when backend rejects incompatible dataset', async () => {
    const mockDataset = createMockDataset();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/health')) {
        return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), { status: 200 });
      }
      if (url.endsWith('/api/examples')) {
        return new Response(JSON.stringify({ datasets: MOCK_CATALOG }), { status: 200 });
      }
      if (url.includes('/api/examples/')) {
        return new Response(JSON.stringify(mockDataset), { status: 200 });
      }
      if (url.endsWith('/api/analyze')) {
        return new Response(
          JSON.stringify({
            error: 'VALIDATION_FAILED',
            valid: false,
            issues: [
              {
                field: 'after.alignmentId',
                code: 'ALIGNMENT_MISMATCH',
                message: 'Incompatible alignmentId between before and after images.'
              }
            ],
            warnings: []
          }),
          { status: 400 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText(/Incompatible alignmentId between before and after images/i)
      ).toBeInTheDocument();
    });
  });

  it('Builds consistent summary JSON, CSV mask, JSON mask, and color scale mappings', () => {
    const mockAnalysis = createMockAnalysisResponse();
    const summaryObj = buildSummaryExportObject(mockAnalysis);
    expect(summaryObj.summaryStatistics.retainedChangedPixelCount).toBe(45);
    expect(summaryObj.retainedComponents.length).toBe(1);

    const csv = buildMaskCsvString(mockAnalysis);
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(401); // 1 header + 20x20 rows

    const maskJson = JSON.parse(buildMaskJsonString(mockAnalysis));
    expect(maskJson.summaryTotals.retainedChangeAreaHectares).toBe(0.45);

    // Verify NDVI color helper handles null (invalid) and valid ranges
    expect(ndviToRgb(null)).toEqual([216, 224, 234]);
    expect(ndviToRgb(0.8, 'ndvi').length).toBe(3);
    expect(ndviToRgb(-0.3, 'grayscale')[0]).toBe(ndviToRgb(-0.3, 'grayscale')[1]);
  });
});
