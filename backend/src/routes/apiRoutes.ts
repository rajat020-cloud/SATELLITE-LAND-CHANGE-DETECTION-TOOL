import { Router } from 'express';
import {
  getDocs,
  getExampleById,
  getExamples,
  getHealth,
  postAnalyze,
  postExportMaskCsv,
  postExportMaskJson,
  postExportSummary,
  postValidate
} from '../controllers/apiController';

export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.get('/examples', getExamples);
apiRouter.get('/examples/:datasetId', getExampleById);
apiRouter.post('/validate', postValidate);
apiRouter.post('/analyze', postAnalyze);
apiRouter.post('/export/summary', postExportSummary);
apiRouter.post('/export/mask-csv', postExportMaskCsv);
apiRouter.post('/export/mask-json', postExportMaskJson);
apiRouter.get('/docs', getDocs);
