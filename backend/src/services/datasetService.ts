import fs from 'fs';
import path from 'path';
import { LandChangeDataset } from '../types/landChange';
import {
  buildCloudMaskedDataset,
  buildIncompatibleDataset,
  buildMultiComponentDataset,
  buildRectangularChangeDataset,
  buildUnchangedDataset
} from '../utils/generateSamples';

export interface DatasetCatalogEntry {
  datasetId: string;
  title: string;
  origin: string;
  description: string;
  beforeDate: string;
  afterDate: string;
  width: number;
  height: number;
  alignmentId: string;
  pixelWidthMeters: number;
  pixelHeightMeters: number;
  isValidDemo: boolean;
  recommendedConfig: {
    threshold: number;
    minComponentSize: number;
    connectivity: 4 | 8;
  };
}

const IN_MEMORY_DATASETS: Record<string, () => LandChangeDataset> = {
  'synthetic-unchanged-001': buildUnchangedDataset,
  'synthetic-rect-change-002': buildRectangularChangeDataset,
  'synthetic-cloud-mask-003': buildCloudMaskedDataset,
  'synthetic-multi-component-004': buildMultiComponentDataset,
  'synthetic-incompatible-005': buildIncompatibleDataset
};

function resolveSampleDataDirectory(): string {
  const candidates = [
    path.resolve(__dirname, '../../sample_data'),
    path.resolve(process.cwd(), 'sample_data'),
    path.resolve(process.cwd(), 'backend/sample_data')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0];
}

export function listExampleDatasets(): DatasetCatalogEntry[] {
  const orderedIds = [
    'synthetic-multi-component-004',
    'synthetic-rect-change-002',
    'synthetic-cloud-mask-003',
    'synthetic-unchanged-001',
    'synthetic-incompatible-005'
  ];

  return orderedIds.map((id) => {
    const ds = getExampleDatasetById(id)!;
    return {
      datasetId: ds.datasetId,
      title: ds.title ?? ds.datasetId,
      origin: ds.origin,
      description: ds.description,
      beforeDate: ds.before.date,
      afterDate: ds.after.date,
      width: ds.before.width,
      height: ds.before.height,
      alignmentId: ds.before.alignmentId,
      pixelWidthMeters: ds.before.pixelWidthMeters,
      pixelHeightMeters: ds.before.pixelHeightMeters,
      isValidDemo: id !== 'synthetic-incompatible-005',
      recommendedConfig: {
        threshold: ds.recommendedConfig?.threshold ?? 0.25,
        minComponentSize: ds.recommendedConfig?.minComponentSize ?? 6,
        connectivity: ds.recommendedConfig?.connectivity ?? 8
      }
    };
  });
}

export function getExampleDatasetById(datasetId: string): LandChangeDataset | null {
  const sampleDir = resolveSampleDataDirectory();
  const safeId = path.basename(datasetId);
  const filePath = path.join(sampleDir, `${safeId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as LandChangeDataset;
    } catch {
      // Fall back to deterministic builder if file read fails
    }
  }

  const builder = IN_MEMORY_DATASETS[safeId];
  if (builder) {
    return builder();
  }

  return null;
}
