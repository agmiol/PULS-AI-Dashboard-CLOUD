import React from 'react';
import { RefreshCw, Database, Filter, X, Sparkles, ShieldCheck, FileText, Loader2, Printer, TrendingUp, LogOut } from 'lucide-react';
import { DashboardFilters, DashboardData } from '../types';

interface HeaderProps {
  data: DashboardData | null;
  filters: DashboardFilters;
  onUpdateFilters: (newFilters: DashboardFilters) => void;
  onRefresh: () => void;
  isLoading: boolean;
  refreshInterval: number; // in seconds, 0 = off
  onChangeRefreshInterval: (interval: number) => void;
  onOpenDbModal: () => void;
  onOpenInspectorModal: () => void;
  onExportPdf?: () => void;
  isExportingPdf?: boolean;
  onNativePrint?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  filters,
  onUpdateFilters,
  onRefresh,
  isLoading,
  refreshInterval,
  onChangeRefreshInterval,
  onOpenDbModal,
  onOpenInspectorModal,
  onExportPdf,
  isExportingPdf = false,
  onNativePrint,
  onLogout
}) => {
  // Check active filter count
  const activeFilterList: { key: keyof DashboardFilters; label: string; value: string }[] = [];

  if (filters.month && filters.month !== 'all') {
    const list = filters.month.split(',').map(s => s.trim()).filter(Boolean);
    const mLabel = list.length > 2 ? `${list[0]}, ${list[1]} (+${list.length - 2})` : list.join(', ');
    activeFilterList.push({ key: 'month', label: list.length > 1 ? `Місяці (${list.length})` : 'Місяць', value: mLabel });
  }
  if (filters.region && filters.region !== 'all') {
    const list = filters.region.split(',').map(s => s.trim()).filter(Boolean);
    const regLabel = list.length > 2 ? `${list[0]}, ${list[1]} (+${list.length - 2})` : list.join(', ');
    activeFilterList.push({ key: 'region', label: list.length > 1 ? `Регіони (${list.length})` : 'Регіон', value: regLabel });
  }
  if (filters.selectedHromada) {
    const hName = filters.selectedHromadaName || filters.selectedHromada;
    activeFilterList.push({ key: 'selectedHromada', label: 'Громада', value: hName });
  }
  if (filters.persontype && filters.persontype !== 'all') {
    const ptLabel = filters.persontype === '1' ? 'Юридична особа' : filters.persontype === '2' ? 'ФОП' : 'Нема даних';
    activeFilterList.push({ key: 'persontype', label: 'Тип особи', value: ptLabel });
  }
  if (filters.sentiment && filters.sentiment !== 'all') {
    activeFilterList.push({ key: 'sentiment', label: 'Тональність', value: filters.sentiment });
  }
  if (filters.scoreCategory && filters.scoreCategory !== 'all') {
    const scLabel = filters.scoreCategory === 'positive' ? 'Позитивні (9-10)' : filters.scoreCategory === 'neutral' ? 'Нейтральні (7-8)' : 'Негативні (<7)';
    activeFilterList.push({ key: 'scoreCategory', label: 'Категорія оцінок', value: scLabel });
  }
  if (filters.generalIssueId) {
    const issueName = data?.fullGeneralIssues.find(i => i.generalIssueId === filters.generalIssueId)?.issueTitle || `Проблема #${filters.generalIssueId}`;
    activeFilterList.push({ key: 'generalIssueId', label: 'Загальна проблема', value: issueName });
  }
  if (filters.detailedIssueId) {
    const signalName = data?.fullDetailedIssues.find(i => i.detailedIssueId === filters.detailedIssueId)?.issueTitle || `Сигнал #${filters.detailedIssueId}`;
    activeFilterList.push({ key: 'detailedIssueId', label: 'Детальний сигнал', value: signalName });
  }
  if (filters.search) {
    activeFilterList.push({ key: 'search', label: 'Пошук', value: filters.search });
  }
  if (filters.trendDirection && filters.trendDirection !== 'all') {
    activeFilterList.push({ key: 'trendDirection', label: 'Напрям тренду', value: filters.trendDirection });
  }
  if (filters.trendStrength && filters.trendStrength !== 'all') {
    activeFilterList.push({ key: 'trendStrength', label: 'Сила тренду', value: filters.trendStrength });
  }
  if (filters.hasRisingSignal && filters.hasRisingSignal !== 'all') {
    activeFilterList.push({ key: 'hasRisingSignal', label: 'Сплеск активності', value: filters.hasRisingSignal === 'yes' ? 'Зі сплеском (⚡)' : 'Без сплеску' });
  }
  if (filters.hasCommentOnly) {
    activeFilterList.push({ key: 'hasCommentOnly', label: 'Коментарі', value: 'Тільки з текстовим відгуком' });
  }

  const removeFilter = (key: keyof DashboardFilters) => {
    const updated = { ...filters };
    if (key === 'generalIssueId' || key === 'detailedIssueId') {
      updated[key] = null;
    } else if (key === 'selectedHromada') {
      updated.selectedHromada = null;
      updated.selectedHromadaName = null;
    } else if (key === 'region') {
      updated.region = 'all';
      updated.selectedRegion = undefined;
    } else if (key === 'hasCommentOnly') {
      updated[key] = false;
    } else {
      updated[key] = 'all';
    }
    onUpdateFilters(updated);
  };

  const clearAllFilters = () => {
    onUpdateFilters({
      month: 'all',
      region: 'all',
      selectedRegion: undefined,
      selectedHromada: null,
      selectedHromadaName: null,
      persontype: 'all',
      sentiment: 'all',
      scoreCategory: 'all',
      generalIssueId: null,
      detailedIssueId: null,
      search: '',
      trendDirection: 'all',
      trendStrength: 'all',
      hasRisingSignal: 'all',
      hasCommentOnly: false
    });
  };

  return (
    <header className="sticky top-0 z-40 text-slate-900 shadow-xs" style={{ background: 'linear-gradient(90deg, #c8ecff 0%, #daf1fe 100%)', border: '1px solid #b9e4fa' }}>
      {/* Top Ukrainian Flag Strip */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-amber-400 to-blue-600 w-full" />

      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Logo & Platform Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-xs border border-blue-300/80 bg-white p-0.5 shrink-0">
            <img src="/Pulse_logo.svg" alt="Платформа Пульс" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-blue-900 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-400/30">
                PULSE.GOV.UA
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Аналітичний дашборд за результатами ШІ-аналізу
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2 mt-0.5">
              <span>ПЛАТФОРМА ПУЛЬС</span>
              <span className="text-slate-600 font-normal text-xs sm:text-sm">| ДЕРЖАВНО-ПРИВАТНИЙ ДІАЛОГ</span>
            </h1>
          </div>
        </div>

        {/* Real-time Status & Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Live Database Icon Button (Minimized to icon only) */}
          <button
            type="button"
            onClick={onOpenDbModal}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer shadow-2xs ${
              data?.dbInfo.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-800 hover:bg-amber-500/25'
            }`}
            title={
              data?.dbInfo.connected
                ? (data.dbInfo.mode === 'postgresql'
                    ? 'POSTGRESQL (PULS_COPY): ONLINE'
                    : 'ГУГЛ ТАБЛИЦЯ: ONLINE')
                : 'ДЖЕРЕЛО: КЕШ'
            }
          >
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
              data?.dbInfo.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
            }`} />
            <Database className="w-4 h-4 text-slate-800" />
          </button>

          {/* Auto-Refresh Timer Dropdown */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/80 border border-blue-200/90 rounded-lg text-xs text-slate-800 font-medium shadow-2xs">
            <span className="hidden md:inline text-slate-600 uppercase text-[10px] font-bold tracking-wider">Автооновлення:</span>
            <select
              value={refreshInterval}
              onChange={(e) => onChangeRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-blue-900 font-bold focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-white text-slate-900">Вимкнено</option>
              <option value={3} className="bg-white text-slate-900">3s</option>
              <option value={5} className="bg-white text-slate-900">5s</option>
              <option value={10} className="bg-white text-slate-900">10s</option>
              <option value={30} className="bg-white text-slate-900">30s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Оновити</span>
          </button>

          {/* Comment Inspector Trigger */}
          <button
            type="button"
            onClick={onOpenInspectorModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-2xs transition-all cursor-pointer border border-amber-600/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>База коментарів</span>
          </button>

          {/* Export Actions: PDF & Print */}
          <div className="flex items-center gap-2">
            {/* Export to PDF Button */}
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-extrabold text-xs shadow-2xs transition-all cursor-pointer border border-rose-500/30 disabled:opacity-50"
                title="Зберегти повний якісний багатосторінковий звіт у PDF (300 DPI)"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-rose-100" />
                )}
                <span className="hidden xl:inline">Експорт в PDF</span>
                <span className="xl:hidden">.PDF</span>
              </button>
            )}

            {/* Direct Vector Print Dialog */}
            {onNativePrint && (
              <button
                type="button"
                onClick={onNativePrint}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 font-extrabold text-xs shadow-2xs transition-all cursor-pointer border border-blue-200/90"
                title="Відкрити системний друк / Зберегти як векторний PDF через браузер (Ctrl+P)"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden 2xl:inline">Друк</span>
              </button>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-extrabold text-xs shadow-2xs transition-all cursor-pointer border border-blue-200/90 hover:border-rose-300"
                title="Вийти з системи ПУЛЬС"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600" />
                <span className="hidden sm:inline">Вийти</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Cross-Filters Ribbon */}
      {activeFilterList.length > 0 && (
        <div className="bg-white/70 border-t border-blue-200/80 py-2 px-4 sm:px-6 shadow-2xs animate-fadeIn transition-all duration-300">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-900 mr-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-blue-700" />
              <span>Активні фільтри ({activeFilterList.length}):</span>
            </div>

            {activeFilterList.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-slate-800 text-[11px] font-semibold transition-all hover:bg-blue-50/50 shadow-2xs"
              >
                <span className="text-slate-500 font-normal">{f.label}:</span>
                <span className="font-bold text-blue-900 max-w-[180px] truncate">{f.value}</span>
                <button
                  onClick={() => removeFilter(f.key)}
                  className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                  title={`Видалити фільтр ${f.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <button
              onClick={clearAllFilters}
              className="text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 hover:underline ml-auto flex items-center gap-1 cursor-pointer shrink-0 py-1 px-2 rounded hover:bg-rose-50 transition-colors"
            >
              <X className="w-3 h-3" />
              Скинути всі
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

