import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { NewAnalysisPage } from './pages/NewAnalysisPage';
import { OverviewPage } from './pages/OverviewPage';
import { ResultsPage } from './pages/ResultsPage';
import { SampleDatasetsPage } from './pages/SampleDatasetsPage';
import {
  ApiValidationError,
  fetchExampleCatalog,
  fetchExampleDataset,
  fetchHealthStatus,
  runAnalysisOnServer,
  validateDatasetOnServer
} from './services/api';
import {
  AnalysisConfig,
  AnalysisResponse,
  DatasetCatalogEntry,
  LandChangeDataset,
  NavigationTab,
  ValidationResult
} from './types/landChange';

const DEFAULT_CONFIG: AnalysisConfig = {
  threshold: 0.25,
  minComponentSize: 6,
  connectivity: 8
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<DatasetCatalogEntry[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('synthetic-multi-component-004');
  const [currentDataset, setCurrentDataset] = useState<LandChangeDataset | null>(null);
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const executeAnalysisForDataset = useCallback(
    async (dataset: LandChangeDataset, targetConfig: AnalysisConfig) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await runAnalysisOnServer(dataset, targetConfig);
        setAnalysis(result);
        setValidationStatus({
          valid: true,
          issues: [],
          warnings: result.warnings,
          summary: {
            datasetId: result.datasetMetadata.datasetId,
            origin: result.datasetMetadata.origin,
            width: result.datasetMetadata.width,
            height: result.datasetMetadata.height,
            alignmentId: result.datasetMetadata.alignmentId,
            pixelWidthMeters: result.datasetMetadata.pixelWidthMeters,
            pixelHeightMeters: result.datasetMetadata.pixelHeightMeters,
            beforeDate: result.datasetMetadata.beforeDate,
            afterDate: result.datasetMetadata.afterDate
          }
        });
      } catch (err) {
        if (err instanceof ApiValidationError) {
          setAnalysis(null);
          setValidationStatus(err.validationResult);
          setErrorMessage(err.message);
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to complete land-change analysis.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const loadBundledDatasetAndRun = useCallback(
    async (datasetId: string, runImmediately = true) => {
      setIsLoading(true);
      setErrorMessage(null);
      setValidationStatus(null);
      setSelectedDatasetId(datasetId);

      try {
        const dataset = await fetchExampleDataset(datasetId);
        setCurrentDataset(dataset);
        const nextConfig: AnalysisConfig = {
          threshold: dataset.recommendedConfig?.threshold ?? 0.25,
          minComponentSize: dataset.recommendedConfig?.minComponentSize ?? 6,
          connectivity: dataset.recommendedConfig?.connectivity ?? 8
        };
        setConfig(nextConfig);

        if (runImmediately) {
          await executeAnalysisForDataset(dataset, nextConfig);
        } else {
          const valRes = await validateDatasetOnServer(dataset, nextConfig);
          setValidationStatus(valRes);
          if (!valRes.valid) {
            setAnalysis(null);
            setErrorMessage(valRes.issues[0]?.message || 'Dataset failed validation.');
          }
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : `Failed to load dataset "${datasetId}"`
        );
      } finally {
        setIsLoading(false);
      }
    },
    [executeAnalysisForDataset]
  );

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchHealthStatus();
        if (mounted) setApiOnline(true);
      } catch {
        if (mounted) setApiOnline(false);
      }

      try {
        const list = await fetchExampleCatalog();
        if (!mounted) return;
        setCatalog(list);
        const defaultId = list[0]?.datasetId ?? 'synthetic-multi-component-004';
        await loadBundledDatasetAndRun(defaultId, true);
      } catch (err) {
        if (mounted) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Unable to connect to backend API. Ensure the backend server is running.'
          );
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [loadBundledDatasetAndRun]);

  const handleValidateCurrent = async () => {
    if (!currentDataset) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await validateDatasetOnServer(currentDataset, config);
      setValidationStatus(res);
      if (!res.valid) {
        setErrorMessage(
          res.issues[0]?.message || 'Dataset failed schema or compatibility validation.'
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Validation request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCurrentAnalysis = async () => {
    if (!currentDataset) return;
    await executeAnalysisForDataset(currentDataset, config);
  };

  const handleUploadCustomDataset = async (rawObject: unknown, fileName: string) => {
    setErrorMessage(null);
    setValidationStatus(null);

    const record = (rawObject && typeof rawObject === 'object' ? rawObject : {}) as Record<
      string,
      unknown
    >;
    const customId =
      typeof record.datasetId === 'string' && record.datasetId.trim().length > 0
        ? `custom-${record.datasetId}`
        : `custom-${fileName.replace(/\.json$/i, '')}`;

    setSelectedDatasetId(customId);
    setCurrentDataset(rawObject as LandChangeDataset);

    setIsLoading(true);
    try {
      const valResult = await validateDatasetOnServer(rawObject, config);
      setValidationStatus(valResult);
      if (!valResult.valid) {
        setAnalysis(null);
        setErrorMessage(
          valResult.issues[0]?.message || `Uploaded file "${fileName}" failed validation.`
        );
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Validation request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadMalformedError = (msg: string) => {
    setAnalysis(null);
    setCurrentDataset(null);
    setValidationStatus({
      valid: false,
      issues: [{ field: 'file', code: 'MALFORMED_JSON', message: msg }],
      warnings: []
    });
    setErrorMessage(msg);
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        hasAnalysis={analysis !== null}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          catalog={catalog}
          selectedDatasetId={selectedDatasetId}
          onSelectDatasetId={(id) => loadBundledDatasetAndRun(id, true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          apiOnline={apiOnline}
          currentOrigin={analysis?.datasetMetadata.origin ?? currentDataset?.origin}
          isLoading={isLoading}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">
          {activeTab === 'overview' && (
            <OverviewPage
              analysis={analysis}
              config={config}
              onChangeConfig={setConfig}
              onRunAnalysis={handleRunCurrentAnalysis}
              onValidateDataset={handleValidateCurrent}
              validationStatus={validationStatus}
              errorMessage={errorMessage}
              isLoading={isLoading}
              onNavigate={setActiveTab}
              onLoadDefaultSample={() =>
                loadBundledDatasetAndRun('synthetic-multi-component-004', true)
              }
            />
          )}

          {activeTab === 'new-analysis' && (
            <NewAnalysisPage
              catalog={catalog}
              selectedDatasetId={selectedDatasetId}
              currentDataset={currentDataset}
              config={config}
              onChangeConfig={setConfig}
              onSelectBundledDataset={(id) => loadBundledDatasetAndRun(id, false)}
              onUploadCustomDataset={handleUploadCustomDataset}
              onUploadMalformedError={handleUploadMalformedError}
              onValidate={handleValidateCurrent}
              onStartAnalysis={async () => {
                await handleRunCurrentAnalysis();
                // Navigate to Overview if valid
              }}
              validationStatus={validationStatus}
              errorMessage={errorMessage}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'results' && (
            <ResultsPage analysis={analysis} onNavigate={setActiveTab} />
          )}

          {activeTab === 'sample-datasets' && (
            <SampleDatasetsPage
              catalog={catalog}
              selectedDatasetId={selectedDatasetId}
              onSelectAndAnalyze={async (id) => {
                await loadBundledDatasetAndRun(id, true);
                setActiveTab('overview');
              }}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'methodology' && <MethodologyPage />}

          {activeTab === 'api-docs' && <ApiDocsPage />}
        </main>
      </div>
    </div>
  );
};

export default App;
