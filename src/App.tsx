import React, { useState, useEffect, useCallback } from 'react';
import { exportDashboardToPdf } from './utils/pdfExport';
import { Header } from './components/Header';
import { TopKpiSection } from './components/TopKpiSection';
import { TopFilterBar } from './components/TopFilterBar';
import { MonthlyTrendsSection } from './components/MonthlyTrendsSection';
import { RegionalDemographicsSection } from './components/RegionalDemographicsSection';
import { SignalsSection } from './components/SignalsSection';
import { FullTablesSection } from './components/FullTablesSection';
import { CommentInspectorModal } from './components/CommentInspectorModal';
import { DbStatusModal } from './components/DbStatusModal';
import { IssueCommentsModal, TargetIssueForComments } from './components/IssueCommentsModal';
import { PdfExportModal, PdfExportOptions } from './components/PdfExportModal';
import { LoginScreen } from './components/LoginScreen';
import { DashboardData, DashboardFilters } from './types';
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2, Download, X } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('puls_auth') === 'true' || sessionStorage.getItem('puls_auth') === 'true';
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    month: 'all',
    region: 'all',
    persontype: 'all',
    sentiment: 'all',
    scoreCategory: 'all',
    generalIssueId: null,
    detailedIssueId: null,
    search: '',
    trendDirection: 'all',
    trendStrength: 'all',
    hasRisingSignal: 'all',
    risingSignalIntensity: 'all',
    hasCommentOnly: false
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(0); // 0 = Off default
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [targetIssueForComments, setTargetIssueForComments] = useState<TargetIssueForComments | null>(null);
  const [isIssueCommentsModalOpen, setIsIssueCommentsModalOpen] = useState<boolean>(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('puls_auth');
    sessionStorage.removeItem('puls_auth');
    localStorage.removeItem('puls_user');
    sessionStorage.removeItem('puls_user');
    setIsAuthenticated(false);
  };

  const handleOpenIssueComments = (issue: TargetIssueForComments) => {
    setTargetIssueForComments(issue);
    setIsIssueCommentsModalOpen(true);
  };

  // Main data fetching function
  const fetchData = useCallback(async (currentFilters: DashboardFilters, isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    }
    try {
      // Force refresh if last state was disconnected or manual load
      const forceRefresh = !data?.dbInfo?.connected;
      const res = await fetch('/api/dashboard/data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        cache: 'no-store',
        body: JSON.stringify({
          ...currentFilters,
          refresh: forceRefresh || !isBackground
        })
      });

      if (res.status === 429) {
        console.warn('[Dashboard Warning] Rate limit encountered (429). Retrying on next cycle.');
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json: DashboardData = await res.json();
      setData(json);
      setIsError(false);
    } catch (err) {
      console.error('[Dashboard Error] Failed to fetch data:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and fetch when filters change
  useEffect(() => {
    if (isAuthenticated) {
      fetchData(filters);
    }
  }, [filters, fetchData, isAuthenticated]);

  // Real-time polling timer
  useEffect(() => {
    if (!isAuthenticated || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchData(filters, true);
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, filters, fetchData, isAuthenticated]);

  // PDF Export handling
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [pdfExportOptions, setPdfExportOptions] = useState<PdfExportOptions>({
    includeKpiSummary: true,
    includeMonthlyTrends: true,
    includeRegionalDemographics: true,
    includeSignalsAndTrends: true,
    includeCatalogTable: true
  });

  const handleOpenPdfModal = () => {
    setIsPdfModalOpen(true);
  };

  const handleConfirmPdfExport = async (chosenOptions: PdfExportOptions) => {
    setIsPdfModalOpen(false);
    setPdfExportOptions(chosenOptions);

    try {
      setIsExportingPdf(true);
      setPdfProgressText('Підготовка обраних розділів, стабілізація графіків та розгортання таблиць...');

      // Allow React to re-render DOM with selected sections and desktop view
      await new Promise((resolve) => setTimeout(resolve, 650));

      const fileName = await exportDashboardToPdf('pdf-export-container', (msg) => {
        setPdfProgressText(msg);
      });

      setPdfSuccessMessage(`Файл «${fileName}» успішно збережено у високій роздільній здатності в папку «Завантаження» (Downloads)!`);
    } catch (err: any) {
      console.error('[PDF Export Error]:', err);
      alert('Помилка при формуванні PDF: ' + (err.message || 'Спробуйте ще раз'));
    } finally {
      setIsExportingPdf(false);
      setPdfProgressText('');
    }
  };

  // Cross-filter handlers
  const handleUpdateFilters = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
  };

  const handleSelectMonth = (monthVal: string) => {
    if (!monthVal || monthVal === 'all') {
      setFilters(prev => ({ ...prev, month: 'all' }));
    } else {
      setFilters(prev => ({ ...prev, month: monthVal }));
    }
  };

  const handleSelectRegion = (regionName: string) => {
    setFilters(prev => ({
      ...prev,
      region: prev.region === regionName ? 'all' : regionName
    }));
  };

  const handleSelectHromada = (katottg: string, hromadaName?: string) => {
    setFilters(prev => {
      if (!katottg || prev.selectedHromada === katottg) {
        return {
          ...prev,
          selectedHromada: null,
          selectedHromadaName: null
        };
      }
      return {
        ...prev,
        selectedHromada: katottg,
        selectedHromadaName: hromadaName || katottg
      };
    });
  };

  const handleGranularityChange = (granularity: 'oblast' | 'hromada') => {
    setFilters(prev => ({
      ...prev,
      granularity
    }));
  };

  const handleSelectPersontype = (pt: string) => {
    setFilters(prev => ({
      ...prev,
      persontype: prev.persontype === pt ? 'all' : pt
    }));
  };

  const handleSelectCategory = (cat: 'positive' | 'neutral' | 'negative' | 'all') => {
    setFilters(prev => ({
      ...prev,
      scoreCategory: prev.scoreCategory === cat ? 'all' : cat
    }));
  };

  const handleToggleHasCommentOnly = () => {
    setFilters(prev => ({
      ...prev,
      hasCommentOnly: !prev.hasCommentOnly
    }));
  };

  const handleSelectGeneralIssue = (issueId: number) => {
    setFilters(prev => ({
      ...prev,
      generalIssueId: prev.generalIssueId === issueId ? null : issueId,
      detailedIssueId: null
    }));
  };

  const handleSelectDetailedIssue = (issueId: number) => {
    setFilters(prev => ({
      ...prev,
      detailedIssueId: prev.detailedIssueId === issueId ? null : issueId
    }));
  };

  const handleRecheckDb = async () => {
    await fetch('/api/dashboard/test-db');
    fetchData(filters);
  };

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Header & Cross-Filter Bar */}
      <Header
        data={data}
        filters={filters}
        onUpdateFilters={handleUpdateFilters}
        onRefresh={() => fetchData(filters)}
        isLoading={isLoading}
        refreshInterval={refreshInterval}
        onChangeRefreshInterval={setRefreshInterval}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        onOpenInspectorModal={() => setIsInspectorOpen(true)}
        onExportPdf={handleOpenPdfModal}
        isExportingPdf={isExportingPdf}
        onLogout={handleLogout}
      />

      {/* PDF Selection Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onConfirm={handleConfirmPdfExport}
        isLoading={isExportingPdf}
        totalIssuesCount={data?.fullGeneralIssues?.length || 0}
      />

      {/* Main Content Area */}
      <main className={isExportingPdf ? "flex-1 w-full mx-auto px-0 py-0 overflow-x-auto flex flex-col items-center" : "flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6"}>
        {/* PDF Success Toast */}
        {pdfSuccessMessage && (
          <div className="bg-emerald-50 border-2 border-emerald-500/80 rounded-2xl p-4 text-emerald-950 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-sm flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  PDF-звіт успішно сформовано та завантажено!
                </div>
                <div className="text-xs text-emerald-800 font-medium mt-0.5">
                  {pdfSuccessMessage} Перевірте папку <strong>«Завантаження» (Downloads)</strong> вашого комп'ютера або панель завантажень браузера.
                </div>
              </div>
            </div>
            <button
              onClick={() => setPdfSuccessMessage(null)}
              className="p-1.5 rounded-lg hover:bg-emerald-200/60 text-emerald-700 cursor-pointer ml-3"
              title="Закрити сповіщення"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PDF Generation Modal / Loading Overlay */}
        {isExportingPdf && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Генерація офіційного звіту PDF
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Формування повної версії звіту з усіма розгорнутими категоріями
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                {pdfProgressText || 'Обробка та рендеринг сторінок...'}
              </div>
              <p className="text-[11px] text-slate-400">
                Після завершення файл автоматично збережеться у вашій папці «Завантаження».
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <div>
                <span className="font-bold text-sm">Не вдалося завантажити дані</span>
                <p className="text-xs text-rose-600">
                  Виникла помилка зв'язку з сервером. Натисніть "Оновити", щоб спробувати ще раз.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchData(filters)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-all flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Повторити</span>
            </button>
          </div>
        )}

        {/* Initial Loading Screen */}
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
            <p className="font-bold text-slate-700 text-sm">Завантаження дашборда Пульс...</p>
          </div>
        ) : data ? (
          <>
            <div
              id="pdf-export-container"
              className={
                isExportingPdf
                  ? "w-[1440px] min-w-[1440px] max-w-[1440px] space-y-6 bg-white p-0 m-0 border-0 shadow-none rounded-none outline-none overflow-visible"
                  : "space-y-6 bg-slate-50/50 p-2 sm:p-4 rounded-2xl"
              }
              style={isExportingPdf ? { width: '1440px', minWidth: '1440px', maxWidth: '1440px' } : undefined}
            >
                {isExportingPdf ? (
                  <>
                    {/* ========================================================================= */}
                    {/* АРКУШ 1: Загальний огляд (KPIs + Динаміка по місяцях + Географія фідбеку) */}
                    {/* ========================================================================= */}
                    {(pdfExportOptions.includeKpiSummary || pdfExportOptions.includeMonthlyTrends || pdfExportOptions.includeRegionalDemographics) && (
                      <div
                        className="pdf-export-page space-y-4 bg-white p-2 border-0 shadow-none rounded-none outline-none w-[1440px] min-w-[1440px] max-w-[1440px]"
                        style={{ width: '1440px', minWidth: '1440px', maxWidth: '1440px' }}
                      >
                        {/* Header Banner for PDF Export */}
                        {(() => {
                          const activeFilterList: { label: string; value: string }[] = [];
                          if (filters.month && filters.month !== 'all') {
                            activeFilterList.push({ label: 'Період', value: filters.month });
                          }
                          if (filters.regions && filters.regions.length > 0) {
                            activeFilterList.push({ label: 'Області', value: filters.regions.join(', ') });
                          } else if (filters.region && filters.region !== 'all') {
                            activeFilterList.push({ label: 'Область', value: filters.region });
                          }
                          if (filters.persontype && filters.persontype !== 'all') {
                            activeFilterList.push({
                              label: 'Форма власності',
                              value: filters.persontype === '1' ? 'Юридичні особи (ЮО)' : filters.persontype === '2' ? 'ФОП' : 'Без даних'
                            });
                          }
                          if (filters.scoreCategory && filters.scoreCategory !== 'all') {
                            activeFilterList.push({
                              label: 'Оцінки',
                              value: filters.scoreCategory === 'positive' ? 'Позитивні (9-10)' : filters.scoreCategory === 'neutral' ? 'Нейтральні (7-8)' : 'Негативні (1-6)'
                            });
                          }
                          if (filters.sentiment && filters.sentiment !== 'all') {
                            activeFilterList.push({ label: 'Тональність', value: filters.sentiment });
                          }
                          if (filters.generalIssueId) {
                            const g = data?.fullGeneralIssues?.find(i => i.generalIssueId === filters.generalIssueId);
                            activeFilterList.push({ label: 'Загальна проблема', value: `#${filters.generalIssueId} ${g?.issueTitle || ''}` });
                          }
                          if (filters.detailedIssueId) {
                            const d = data?.fullDetailedIssues?.find(i => i.detailedIssueId === filters.detailedIssueId);
                            activeFilterList.push({ label: 'Детальний сигнал', value: `#${filters.detailedIssueId} ${d?.issueTitle || ''}` });
                          }
                          if (filters.search && filters.search.trim()) {
                            activeFilterList.push({ label: 'Пошук', value: `«${filters.search.trim()}»` });
                          }

                          return (
                            <div className="p-3.5 rounded-xl text-slate-900 shadow-2xs" style={{ background: 'linear-gradient(90deg, #c8ecff 0%, #daf1fe 100%)', border: '1px solid #b9e4fa' }}>
                              <div className="flex items-center justify-between border-b pb-2 border-blue-200">
                                <div>
                                  <div className="text-base font-black text-blue-950 uppercase tracking-tight">
                                    ДЕРЖАВНА АНАЛІТИЧНА СИСТЕМА «ПУЛЬС» (PULSE.GOV.UA)
                                  </div>
                                  <div className="text-xs text-slate-700 font-bold">
                                    Аналітичний дашборд за результатами ШІ-аналізу
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-700">
                                  <div>Дата експорту: <span className="font-bold text-slate-900">{new Date().toLocaleString('uk-UA')}</span></div>
                                </div>
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                <span className="font-extrabold uppercase text-[10px] text-blue-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded shadow-2xs">
                                  {activeFilterList.length > 0 ? `Накладено фільтрів (${activeFilterList.length}):` : 'Фільтри:'}
                                </span>
                                {activeFilterList.length > 0 ? (
                                  activeFilterList.map((f, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-white border border-blue-200 text-slate-800 text-xs px-2.5 py-0.5 rounded-md">
                                      <strong className="text-blue-900">{f.label}:</strong> {f.value}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-600 italic">
                                    Усі дані платформи (повна вибірка без додаткових фільтрів)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 1.1 Top Scorecard KPIs & Gauge */}
                        {pdfExportOptions.includeKpiSummary && (
                          <TopKpiSection
                            kpis={data.kpis}
                            monthlyScores={data.monthlyScores}
                            isPdfExportMode={true}
                            selectedCategory={filters.scoreCategory !== 'all' ? filters.scoreCategory : undefined}
                            selectedPersontype={filters.persontype !== 'all' ? filters.persontype : undefined}
                            selectedHasCommentOnly={filters.hasCommentOnly}
                          />
                        )}

                        {/* 1.2 Monthly Evolution Charts */}
                        {pdfExportOptions.includeMonthlyTrends && (
                          <MonthlyTrendsSection
                            monthlyScores={data.monthlyScores}
                            monthlyDistribution={data.monthlyDistribution}
                            selectedMonth={filters.month !== 'all' ? filters.month : undefined}
                            isPdfExportMode={true}
                          />
                        )}

                        {/* 1.3 Regional Map & Demographics */}
                        {pdfExportOptions.includeRegionalDemographics && (
                          <RegionalDemographicsSection
                            regionsMap={data.regionsMap}
                            hromadaStats={data.hromadaStats}
                            monthlyComments={data.monthlyComments}
                            legalFormDistribution={data.legalFormDistribution}
                            selectedRegion={filters.region !== 'all' ? filters.region : undefined}
                            selectedHromada={filters.selectedHromada || undefined}
                            selectedMonth={filters.month !== 'all' ? filters.month : undefined}
                            selectedPersontype={filters.persontype !== 'all' ? filters.persontype : undefined}
                            filters={filters}
                            isPdfExportMode={true}
                            onSelectRegion={handleSelectRegion}
                            onSelectHromada={handleSelectHromada}
                            onGranularityChange={handleGranularityChange}
                            onSelectMonth={handleSelectMonth}
                            onSelectPersontype={handleSelectPersontype}
                          />
                        )}
                      </div>
                    )}

                    {/* ========================================================================= */}
                    {/* АРКУШ 2: Нові сигнали за останні 30 днів + Зростаючі/спадаючі тренди       */}
                    {/* ========================================================================= */}
                    {pdfExportOptions.includeSignalsAndTrends && (
                      <div
                        className="pdf-export-page bg-white p-2 border-0 shadow-none rounded-none outline-none w-[1440px] min-w-[1440px] max-w-[1440px]"
                        style={{ width: '1440px', minWidth: '1440px', maxWidth: '1440px' }}
                      >
                        <SignalsSection
                          newSignals={data.newSignals}
                          growingIssues={data.growingIssues}
                          decliningIssues={data.decliningIssues}
                          selectedGeneralIssueId={filters.generalIssueId}
                          selectedDetailedIssueId={filters.detailedIssueId}
                          isPdfExportMode={true}
                          onSelectGeneralIssue={handleSelectGeneralIssue}
                          onSelectDetailedIssue={handleSelectDetailedIssue}
                          onOpenCommentsForIssue={handleOpenIssueComments}
                        />
                      </div>
                    )}

                    {/* ========================================================================= */}
                    {/* АРКУШ 3+: Повний каталог загальних та деталізованих проблем (без пікселів) */}
                    {/* ========================================================================= */}
                    {pdfExportOptions.includeCatalogTable && (
                      <FullTablesSection
                        fullGeneralIssues={data.fullGeneralIssues}
                        fullDetailedIssues={data.fullDetailedIssues}
                        selectedGeneralIssueId={filters.generalIssueId}
                        selectedDetailedIssueId={filters.detailedIssueId}
                        isPdfExportMode={true}
                        onSelectGeneralIssue={handleSelectGeneralIssue}
                        onSelectDetailedIssue={handleSelectDetailedIssue}
                        onOpenCommentsForIssue={handleOpenIssueComments}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* Section 1: Top Scorecard KPIs */}
                    <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <TopFilterBar
                        filters={filters}
                        monthlyComments={data.monthlyComments}
                        regionsMap={data.regionsMap}
                        onSelectMonth={handleSelectMonth}
                        onSelectPersontype={handleSelectPersontype}
                        onSelectRegion={handleSelectRegion}
                        onUpdateFilters={handleUpdateFilters}
                        forceMobileLayout={false}
                      />

                      <TopKpiSection
                        kpis={data.kpis}
                        monthlyScores={data.monthlyScores}
                        selectedCategory={filters.scoreCategory !== 'all' ? filters.scoreCategory : undefined}
                        selectedPersontype={filters.persontype !== 'all' ? filters.persontype : undefined}
                        selectedHasCommentOnly={filters.hasCommentOnly}
                        onSelectCategory={handleSelectCategory}
                        onSelectLegalForm={handleSelectPersontype}
                        onToggleHasCommentOnly={handleToggleHasCommentOnly}
                      />
                    </div>

                    {/* Section 2: Monthly Evolution Charts */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <MonthlyTrendsSection
                        monthlyScores={data.monthlyScores}
                        monthlyDistribution={data.monthlyDistribution}
                        selectedMonth={filters.month !== 'all' ? filters.month : undefined}
                        onSelectMonth={handleSelectMonth}
                        onSelectCategory={handleSelectCategory}
                      />
                    </div>

                    {/* Section 3: Regional Map & Demographics */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <RegionalDemographicsSection
                        regionsMap={data.regionsMap}
                        hromadaStats={data.hromadaStats}
                        monthlyComments={data.monthlyComments}
                        legalFormDistribution={data.legalFormDistribution}
                        selectedRegion={filters.region !== 'all' ? filters.region : undefined}
                        selectedHromada={filters.selectedHromada || undefined}
                        selectedMonth={filters.month !== 'all' ? filters.month : undefined}
                        selectedPersontype={filters.persontype !== 'all' ? filters.persontype : undefined}
                        filters={filters}
                        onSelectRegion={handleSelectRegion}
                        onSelectHromada={handleSelectHromada}
                        onGranularityChange={handleGranularityChange}
                        onSelectMonth={handleSelectMonth}
                        onSelectPersontype={handleSelectPersontype}
                      />
                    </div>

                    {/* Section 4: Signals & Issue Trends */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <SignalsSection
                        newSignals={data.newSignals}
                        growingIssues={data.growingIssues}
                        decliningIssues={data.decliningIssues}
                        selectedGeneralIssueId={filters.generalIssueId}
                        selectedDetailedIssueId={filters.detailedIssueId}
                        filters={filters}
                        onSelectGeneralIssue={handleSelectGeneralIssue}
                        onSelectDetailedIssue={handleSelectDetailedIssue}
                        onOpenCommentsForIssue={handleOpenIssueComments}
                      />
                    </div>

                    {/* Section 5: Full Catalogs Table */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <FullTablesSection
                        fullGeneralIssues={data.fullGeneralIssues}
                        fullDetailedIssues={data.fullDetailedIssues}
                        dashboardData={data}
                        selectedGeneralIssueId={filters.generalIssueId}
                        selectedDetailedIssueId={filters.detailedIssueId}
                        filters={filters}
                        onUpdateFilters={(newFilters) => setFilters(newFilters)}
                        isPdfExportMode={false}
                        onSelectGeneralIssue={handleSelectGeneralIssue}
                        onSelectDetailedIssue={handleSelectDetailedIssue}
                        onOpenCommentsForIssue={handleOpenIssueComments}
                      />
                    </div>
                  </>
                )}
              </div>
          </>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-[11px] py-4 px-6 mt-8">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-3 w-4 flex-col rounded-2xs overflow-hidden shadow-xs">
              <div className="h-1/2 bg-[#0057B7]" />
              <div className="h-1/2 bg-[#FFDD00]" />
            </div>
            <span className="font-extrabold text-white tracking-wider uppercase text-xs">PULSE.GOV.UA</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-medium">Державна аналітична система оцінки та фідбеку бізнесу</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[10px]">
            <span>© {new Date().getFullYear()} Pulse.gov.ua</span>
          </div>
        </div>
      </footer>

      {/* Issue Specific Comments Modal */}
      <IssueCommentsModal
        isOpen={isIssueCommentsModalOpen}
        onClose={() => setIsIssueCommentsModalOpen(false)}
        targetIssue={targetIssueForComments}
        existingComments={data?.sampleComments || []}
        filters={filters}
        isMobileSimulator={false}
        databaseName={data?.dbInfo?.databaseName}
      />

      {/* Comment Inspector Modal */}
      <CommentInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        filters={filters}
        isMobileSimulator={false}
        databaseName={data?.dbInfo?.databaseName}
      />

      {/* Database Status Modal */}
      <DbStatusModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        dbInfo={data?.dbInfo}
        onRecheckConnection={handleRecheckDb}
      />
    </div>
  );
}
