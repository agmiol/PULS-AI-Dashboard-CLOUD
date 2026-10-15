import React, { useState, useMemo } from 'react';
import { NewSignalItem, GeneralIssueTrendItem, DashboardFilters } from '../types';
import { TargetIssueForComments } from './IssueCommentsModal';
import { CategoryBadgeList } from './CategoryBadgeList';
import { hasSpikeBadge } from './FullTablesSection';
import { TrendingUp, TrendingDown, Sparkles, MessageSquare, Filter, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

const formatRisingSignalBadge = (sig?: string | null): string => {
  if (!sig || sig === 'немає' || sig.toLowerCase().trim() === 'немає') return '';
  return 'Сплеск активності';
};

interface SignalsSectionProps {
  newSignals: NewSignalItem[];
  growingIssues: GeneralIssueTrendItem[];
  decliningIssues: GeneralIssueTrendItem[];
  selectedGeneralIssueId?: number | null;
  selectedDetailedIssueId?: number | null;
  filters?: DashboardFilters;
  forceMobileLayout?: boolean;
  isPdfExportMode?: boolean;
  onSelectGeneralIssue: (issueId: number) => void;
  onSelectDetailedIssue: (issueId: number) => void;
  onOpenCommentsForIssue: (issue: TargetIssueForComments) => void;
}

type SignalPeriod = '30d' | '60d' | '90d' | 'custom';

export const SignalsSection: React.FC<SignalsSectionProps> = ({
  newSignals,
  growingIssues,
  decliningIssues,
  selectedGeneralIssueId,
  selectedDetailedIssueId,
  filters,
  forceMobileLayout = false,
  isPdfExportMode = false,
  onSelectGeneralIssue,
  onSelectDetailedIssue,
  onOpenCommentsForIssue
}) => {
  // Helper for trend and signal filter matching
  const matchTrendAndSignal = (
    trendDir?: string,
    trendStr?: string | null,
    itemOrSig?: any,
    f?: DashboardFilters
  ) => {
    if (!f) return true;

    if (f.trendDirection && f.trendDirection !== 'all') {
      const dir = trendDir || 'без тренду';
      if (dir !== f.trendDirection) return false;
    }

    if (f.trendStrength && f.trendStrength !== 'all') {
      const str = trendStr || '';
      if (str !== f.trendStrength) return false;
    }

    if (f.hasRisingSignal && f.hasRisingSignal !== 'all') {
      const hasSig = typeof itemOrSig === 'object' && itemOrSig !== null
        ? hasSpikeBadge(itemOrSig)
        : typeof itemOrSig === 'boolean'
        ? itemOrSig
        : Boolean(itemOrSig && itemOrSig !== 'немає' && itemOrSig.toLowerCase().trim() !== 'немає');
      if (f.hasRisingSignal === 'yes' && !hasSig) return false;
      if (f.hasRisingSignal === 'no' && hasSig) return false;
    }

    return true;
  };
  // Mobile accordion states
  const [expandedSignals, setExpandedSignals] = useState<Set<number>>(new Set());
  const [expandedGrowing, setExpandedGrowing] = useState<Set<number>>(new Set());
  const [expandedDeclining, setExpandedDeclining] = useState<Set<number>>(new Set());

  // Active tab for mobile trend issues (growing vs declining)
  const [activeTrendTab, setActiveTrendTab] = useState<'growing' | 'declining'>('growing');

  // Period filter for New Signals
  const [signalPeriod, setSignalPeriod] = useState<SignalPeriod>('30d');
  
  // Custom date interval state (default to today and 30 days prior)
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const defaultStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().substring(0, 10);
  }, []);
  const [customStartDate, setCustomStartDate] = useState<string>(defaultStartStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const toggleSignalExpand = (id: number) => {
    setExpandedSignals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGrowingExpand = (id: number) => {
    setExpandedGrowing(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDecliningExpand = (id: number) => {
    setExpandedDeclining(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter signals based on selected period
  const filteredSignals = useMemo(() => {
    let endD = new Date();
    if (signalPeriod === 'custom' && customEndDate) {
      endD = new Date(`${customEndDate}T23:59:59.999Z`);
    } else {
      let maxTimestamp = Date.now();
      newSignals.forEach(s => {
        if (s.firstSeenAt) {
          const t = new Date(s.firstSeenAt).getTime();
          if (!isNaN(t) && t > maxTimestamp) maxTimestamp = t;
        }
      });
      endD = new Date(maxTimestamp);
    }

    let startD: Date;
    if (signalPeriod === '30d') {
      startD = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (signalPeriod === '60d') {
      startD = new Date(endD.getTime() - 60 * 24 * 60 * 60 * 1000);
    } else if (signalPeriod === '90d') {
      startD = new Date(endD.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      startD = customStartDate ? new Date(`${customStartDate}T00:00:00.000Z`) : new Date(0);
    }

    const filtered = newSignals.filter(sig => {
      if (!sig.firstSeenAt) return false;
      const seenTime = new Date(sig.firstSeenAt).getTime();
      const inTimeRange = isNaN(seenTime) || (seenTime >= startD.getTime() && seenTime <= endD.getTime());
      const trendMatch = matchTrendAndSignal(sig.trendDirection, sig.trendStrength, sig, filters);
      return inTimeRange && trendMatch;
    });

    return filtered.sort((a, b) => {
      const aHasPriority = a.trendDirection === 'зростаючий' || hasSpikeBadge(a);
      const bHasPriority = b.trendDirection === 'зростаючий' || hasSpikeBadge(b);

      if (aHasPriority !== bHasPriority) {
        return aHasPriority ? -1 : 1;
      }

      return (b.mentionsCount || 0) - (a.mentionsCount || 0);
    });
  }, [newSignals, signalPeriod, customStartDate, customEndDate, filters]);

  const filteredGrowing = useMemo(() => {
    return growingIssues.filter(g => matchTrendAndSignal(g.trendDirection, g.trendStrength, g, filters));
  }, [growingIssues, filters]);

  const filteredDeclining = useMemo(() => {
    return decliningIssues.filter(d => matchTrendAndSignal(d.trendDirection, d.trendStrength, d, filters));
  }, [decliningIssues, filters]);

  const periodLabel = useMemo(() => {
    if (signalPeriod === '30d') return 'за останні 30 днів';
    if (signalPeriod === '60d') return 'за останні 60 днів';
    if (signalPeriod === '90d') return 'за останні 90 днів';
    return `за період ${customStartDate} — ${customEndDate}`;
  }, [signalPeriod, customStartDate, customEndDate]);

  // Render mini sparkline bar chart for mobile time_table slice
  const renderSparklineBars = (sparkline: number[] = [], isGrowing: boolean) => {
    const points = sparkline && sparkline.length > 0 ? sparkline : [0];
    const max = Math.max(...points.map(v => Number(v ?? 0)), 0.5);
    return (
      <div className="flex items-end gap-1 h-6 w-24">
        {points.map((val, i) => {
          const safeVal = Number(val ?? 0);
          const hPct = Math.max(15, Math.round((safeVal / max) * 100));
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-xs transition-all ${
                isGrowing ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'
              }`}
              style={{ height: `${hPct}%` }}
              title={`Місяць ${i + 1}: ${safeVal}%`}
            />
          );
        })}
      </div>
    );
  };

  // Render prominent 12-Month Bar Chart for Desktop Cards
  const renderDesktop12MonthBarChart = (sparkline: number[] = [], isGrowing: boolean, slope?: number | null) => {
    const safeSlope = Number(slope ?? 0);
    const points = sparkline && sparkline.length > 0 ? sparkline : [0];
    const max = Math.max(...points.map(v => Number(v ?? 0)), 0.5);
    return (
      <div className="flex flex-col items-end justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 shrink-0 w-[190px] select-none">
        <div className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500">
          <span>Динаміка (12 міс.)</span>
          <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
            isGrowing ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {safeSlope > 0 ? `+${safeSlope.toFixed(2)}` : safeSlope.toFixed(2)} в.п.
          </span>
        </div>
        <div className="flex items-end gap-1 h-11 w-full pt-1.5 pb-0.5">
          {points.map((val, i) => {
            const safeVal = Number(val ?? 0);
            const hPct = Math.max(14, Math.round((safeVal / max) * 100));
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
              >
                <div
                  className={`w-full rounded-t-xs transition-all ${
                    isGrowing
                      ? 'bg-amber-500 group-hover:bg-amber-400'
                      : 'bg-emerald-500 group-hover:bg-emerald-400'
                  }`}
                  style={{ height: `${hPct}%` }}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                  <div className="bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">
                    Міс {i + 1}: {safeVal.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between w-full text-[8px] font-semibold text-slate-400">
          <span>-12 міс</span>
          <span>поточний</span>
        </div>
      </div>
    );
  };

  // Render Growing Issues List for Mobile Accordion
  const renderGrowingIssuesListMobile = () => (
    <div className="space-y-3">
      {growingIssues.length === 0 ? (
        <div className="text-xs text-slate-400 py-6 text-center italic font-medium">
          Зростаючих проблем за обраними фільтрами не виявлено
        </div>
      ) : (
        growingIssues.map((issue) => {
          const isSelected = selectedGeneralIssueId === issue.generalIssueId;
          const isExpanded = expandedGrowing.has(issue.generalIssueId);

          return (
            <div
              key={issue.generalIssueId}
              className={`pdf-item-card rounded-2xl border transition-all overflow-hidden ${
                isSelected ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-sm' : 'border-slate-200/90 hover:border-amber-300 bg-white'
              }`}
            >
              {/* Main Problem Card Header */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 leading-snug flex-1">
                    <div>{issue.issueTitle}</div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 font-normal">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                        issue.trendDirection === 'зростаючий'
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : issue.trendDirection === 'спадаючий'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {issue.trendDirection || 'без тренду'}
                      </span>
                      {hasSpikeBadge(issue) && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                          ⚡ {formatRisingSignalBadge(issue.risingSignal)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right px-2 py-1 rounded-md shrink-0 bg-amber-100/90 border border-amber-200/80 leading-tight">
                    <span className="text-[11px] font-black text-amber-900">
                      {issue.currentMentions || issue.totalMentions} згадок
                    </span>
                    <span className="text-[9px] font-bold text-amber-700">
                      за 30 днів
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleGrowingExpand(issue.generalIssueId)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 text-amber-600 font-extrabold" />
                        <span>Згорнути деталі</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        <span>Деталі</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => onSelectGeneralIssue(issue.generalIssueId)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                      }`}
                      title="Фільтрувати дашборд за цією проблемою"
                    >
                      <Filter className="w-3 h-3" />
                      <span>{isSelected ? 'Обрано' : 'Фільтр'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCommentsForIssue({
                        id: issue.generalIssueId,
                        title: issue.issueTitle,
                        mechanism: issue.mechanism,
                        type: 'general',
                        totalMentions: issue.currentMentions || issue.totalMentions
                      })}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Коментарі</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Details Section */}
              {isExpanded && (
                <div className="p-3.5 bg-slate-50/90 border-t border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                      Опис:
                    </span>
                    <p className="text-xs text-slate-800 font-normal leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                      {issue.mechanism}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                        Доля серед коментарів:
                      </span>
                      <span className="text-xs font-extrabold text-amber-700">
                        {Number(issue.shareRatio || issue.currentShare || 0).toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                        Динаміка зростання (12 міс.):
                      </span>
                      {renderSparklineBars(issue.sparkline, true)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // Render Declining Issues List for Mobile Accordion
  const renderDecliningIssuesListMobile = () => (
    <div className="space-y-3">
      {decliningIssues.length === 0 ? (
        <div className="text-xs text-slate-400 py-6 text-center italic font-medium">
          Спадаючих проблем за обраними фільтрами не виявлено
        </div>
      ) : (
        decliningIssues.map((issue) => {
          const isSelected = selectedGeneralIssueId === issue.generalIssueId;
          const isExpanded = expandedDeclining.has(issue.generalIssueId);

          return (
            <div
              key={issue.generalIssueId}
              className={`pdf-item-card rounded-2xl border transition-all overflow-hidden ${
                isSelected ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-300 shadow-sm' : 'border-slate-200/90 hover:border-emerald-300 bg-white'
              }`}
            >
              {/* Main Problem Card Header */}
              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 leading-snug flex-1">
                    {issue.issueTitle}
                  </div>
                  <div className="flex flex-col items-end text-right px-2 py-1 rounded-md shrink-0 bg-emerald-100/90 border border-emerald-200/80 leading-tight">
                    <span className="text-[11px] font-black text-emerald-900">
                      {issue.currentMentions || issue.totalMentions} згадок
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700">
                      за 30 днів
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => toggleDecliningExpand(issue.generalIssueId)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 text-emerald-600 font-extrabold" />
                        <span>Згорнути деталі</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        <span>Деталі</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => onSelectGeneralIssue(issue.generalIssueId)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xs'
                      }`}
                      title="Фільтрувати дашборд за цією проблемою"
                    >
                      <Filter className="w-3 h-3" />
                      <span>{isSelected ? 'Обрано' : 'Фільтр'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCommentsForIssue({
                        id: issue.generalIssueId,
                        title: issue.issueTitle,
                        mechanism: issue.mechanism,
                        type: 'general',
                        totalMentions: issue.currentMentions || issue.totalMentions
                      })}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Коментарі</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Details Section */}
              {isExpanded && (
                <div className="p-3.5 bg-slate-50/90 border-t border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                      Опис:
                    </span>
                    <p className="text-xs text-slate-800 font-normal leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                      {issue.mechanism}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                        Доля серед коментарів:
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700">
                        {Number(issue.shareRatio || issue.currentShare || 0).toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                        Динаміка спадання (12 міс.):
                      </span>
                      {renderSparklineBars(issue.sparkline, false)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // Render Full Desktop Issues List with Side-by-Side 12-Month Bar Chart
  const renderDesktopIssuesList = (issues: GeneralIssueTrendItem[], isGrowing: boolean) => (
    <div className="space-y-3">
      {issues.length === 0 ? (
        <div className="text-xs text-slate-400 py-8 text-center italic font-medium">
          {isGrowing ? 'Зростаючих проблем за обраними фільтрами не виявлено' : 'Спадаючих проблем за обраними фільтрами не виявлено'}
        </div>
      ) : (
        issues.map((issue) => {
          const isSelected = selectedGeneralIssueId === issue.generalIssueId;

          return (
            <div
              key={issue.generalIssueId}
              className={`pdf-item-card rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 ${
                isSelected
                  ? isGrowing
                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                    : 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                  : isGrowing
                  ? 'border-slate-200/90 hover:border-amber-300 bg-white shadow-2xs'
                  : 'border-slate-200/90 hover:border-emerald-300 bg-white shadow-2xs'
              }`}
            >
              {/* Header: Title and Badge ('згадок за останні 30 днів') */}
              <div className="flex items-start justify-between gap-3">
                <div className="font-extrabold text-xs text-slate-900 leading-snug flex-1">
                  {issue.issueTitle}
                </div>
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg shrink-0 ${
                  isGrowing
                    ? 'text-amber-900 bg-amber-100 border border-amber-300/80'
                    : 'text-emerald-900 bg-emerald-100 border border-emerald-300/80'
                }`}>
                  {issue.currentMentions || issue.totalMentions} згадок за останні 30 днів
                </span>
              </div>

              {/* Body: Left side has Mechanism & Share + Actions, Right side has 12-Month Bar Chart */}
              <div className="flex items-stretch justify-between gap-3">
                <div className="flex flex-col justify-between flex-1 min-w-0 space-y-2">
                  <p className="text-xs text-slate-600 font-normal leading-relaxed line-clamp-5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 min-h-[4.5rem]">
                    {issue.mechanism}
                  </p>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                    <div className="text-[11px] font-bold text-slate-500">
                      Доля серед коментарів:{' '}
                      <span className={`font-black ${isGrowing ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {Number(issue.shareRatio || issue.currentShare || 0).toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectGeneralIssue(issue.generalIssueId)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? isGrowing ? 'bg-amber-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs'
                            : isGrowing
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xs'
                        }`}
                        title="Фільтрувати дашборд за цією проблемою"
                      >
                        <Filter className="w-3 h-3" />
                        <span>{isSelected ? 'Обрано' : 'Фільтр'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenCommentsForIssue({
                          id: issue.generalIssueId,
                          title: issue.issueTitle,
                          mechanism: issue.mechanism,
                          type: 'general',
                          totalMentions: issue.currentMentions || issue.totalMentions
                        })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                          isGrowing
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Коментарі</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 12-Month Bar Chart */}
                {renderDesktop12MonthBarChart(issue.sparkline, isGrowing, issue.trendSlope)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. New Signals with Period Selector */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-6 border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header Title Banner - Full width on top */}
        <div className="border-b pb-3.5 mb-3.5 border-slate-100 space-y-3">
          <div className="flex items-start justify-between gap-2.5 w-full">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-slate-900 uppercase text-xs sm:text-sm tracking-wider leading-snug break-words">
                  Нові сигнали {periodLabel}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Вперше зафіксовані деталізовані проблеми у коментарях бізнесу
                </p>
              </div>
            </div>

            <span className="text-[10px] sm:text-xs font-extrabold px-2 sm:px-3 py-1 rounded-xl border bg-amber-50 text-amber-900 border-amber-200 uppercase tracking-tight shrink-0 whitespace-nowrap">
              {filteredSignals.length} сигнал
            </span>
          </div>

          {/* Period Segmented Switcher - Placed cleanly below header, fully responsive & strictly contained */}
          <div className="w-full">
            <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl text-slate-600 gap-1 border border-slate-200/80 w-full max-w-full">
              <button
                type="button"
                onClick={() => setSignalPeriod('30d')}
                className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center text-[10px] sm:text-xs truncate ${
                  signalPeriod === '30d'
                    ? 'bg-white text-blue-900 shadow-xs font-black'
                    : 'hover:text-slate-900 font-semibold'
                }`}
              >
                30 днів
              </button>

              <button
                type="button"
                onClick={() => setSignalPeriod('60d')}
                className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center text-[10px] sm:text-xs truncate ${
                  signalPeriod === '60d'
                    ? 'bg-white text-blue-900 shadow-xs font-black'
                    : 'hover:text-slate-900 font-semibold'
                }`}
              >
                60 днів
              </button>

              <button
                type="button"
                onClick={() => setSignalPeriod('90d')}
                className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center text-[10px] sm:text-xs truncate ${
                  signalPeriod === '90d'
                    ? 'bg-white text-blue-900 shadow-xs font-black'
                    : 'hover:text-slate-900 font-semibold'
                }`}
              >
                90 днів
              </button>

              <button
                type="button"
                onClick={() => setSignalPeriod('custom')}
                className={`flex items-center justify-center gap-0.5 sm:gap-1 py-1.5 px-1 rounded-lg transition-all cursor-pointer text-center text-[10px] sm:text-xs truncate ${
                  signalPeriod === 'custom'
                    ? 'bg-white text-blue-900 shadow-xs font-black'
                    : 'hover:text-slate-900 font-semibold'
                }`}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span className="truncate">Інтервал</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Interval Inputs Bar (Shown when 'custom' is active) */}
        {signalPeriod === 'custom' && (
          <div className="mb-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
            <span className="font-extrabold text-blue-950 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Оберіть інтервал:</span>
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 text-slate-700 font-bold">
                <span>З:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </label>

              <label className="flex items-center gap-1.5 text-slate-700 font-bold">
                <span>По:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setCustomEndDate(todayStr);
                  setCustomStartDate(defaultStartStr);
                }}
                className="text-[11px] text-blue-700 hover:text-blue-900 underline font-bold cursor-pointer ml-1"
              >
                Скинути на сьогодні
              </button>
            </div>
          </div>
        )}

        {/* 📱 Mobile / Responsive Accordion Cards View */}
        <div className={isPdfExportMode ? "hidden" : forceMobileLayout ? "block space-y-3" : "block lg:hidden space-y-3"}>
          {filteredSignals.length === 0 ? (
            <div className="py-8 text-center text-slate-400 font-medium text-xs">
              За обраний період нових вперше зафіксованих сигналів не виявлено
            </div>
          ) : (
            filteredSignals.map((sig) => {
              const isSelected = selectedDetailedIssueId === sig.detailedIssueId;
              const isExpanded = expandedSignals.has(sig.detailedIssueId);

              return (
                <div
                  key={sig.detailedIssueId}
                  className={`pdf-item-card rounded-2xl border transition-all overflow-hidden ${
                    isSelected
                      ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                      : 'bg-white border-slate-200/90 hover:border-blue-300'
                  }`}
                >
                  {/* Problem Title Header */}
                  <div className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-slate-900 leading-snug flex-1">
                        {sig.issueTitle}
                      </div>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80 shrink-0">
                        {sig.mentionsCount} згадок
                      </span>
                    </div>

                    {/* Action Bar: Details Button, Filter Button, Comments Button */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleSignalExpand(sig.detailedIssueId)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600 font-extrabold" />
                            <span>Згорнути деталі</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            <span>Деталі</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => onSelectDetailedIssue(sig.detailedIssueId)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                          }`}
                          title="Фільтрувати дашборд за цим сигналом"
                        >
                          <Filter className="w-3 h-3" />
                          <span>{isSelected ? 'Обрано' : 'Фільтр'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenCommentsForIssue({
                            id: sig.detailedIssueId,
                            title: sig.issueTitle,
                            mechanism: sig.mechanism,
                            type: 'detailed',
                            totalMentions: sig.mentionsCount
                          })}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Коментарі</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div className="p-3.5 bg-slate-50/90 border-t border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                          Загальна проблема:
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-100/90 text-blue-900 text-[11px] font-extrabold uppercase tracking-tight border border-blue-200 inline-block">
                          {sig.generalIssueTitle}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                          Категорія:
                        </span>
                        <CategoryBadgeList tags={sig.scopeTags} />
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                          Опис:
                        </span>
                        <p className="text-xs text-slate-800 font-normal leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                          {sig.mechanism}
                        </p>
                      </div>

                      {/* Trend & Signal badges */}
                      <div className="pt-1 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                          Тренд / Сигнал:
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                          sig.trendDirection === 'зростаючий'
                            ? 'bg-amber-100 text-amber-900 border-amber-200'
                            : sig.trendDirection === 'спадаючий'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {sig.trendDirection || 'без тренду'}
                        </span>
                        {hasSpikeBadge(sig) && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                            ⚡ {formatRisingSignalBadge(sig.risingSignal)}
                          </span>
                        )}
                      </div>

                      {sig.firstSeenAt && (
                        <div className="text-[10px] font-bold text-slate-500 pt-1">
                          Вперше зафіксовано: <span className="text-slate-800 font-extrabold">{sig.firstSeenAt}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 💻 Desktop Table View */}
        <div className={isPdfExportMode ? "block overflow-x-auto" : forceMobileLayout ? "hidden" : "hidden lg:block overflow-x-auto"}>
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-white text-slate-400 text-[10px] uppercase font-bold sticky top-0">
                <th className="py-2.5 px-3">Проблема</th>
                <th className="py-2.5 px-3">Загальна проблема</th>
                <th className="py-2.5 px-3">Категорія</th>
                <th className="py-2.5 px-3">Опис</th>
                <th className="py-2.5 px-3 text-center">Тренд та Сигнал</th>
                <th className="py-2.5 px-3 text-center">Вперше зафіксовано</th>
                <th className="py-2.5 px-3 text-right">Згадок</th>
                <th className="py-2.5 px-3 text-center">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                    За обраний період нових вперше зафіксованих сигналів не виявлено
                  </td>
                </tr>
              ) : (
                filteredSignals.map((sig) => {
                  const isSelected = selectedDetailedIssueId === sig.detailedIssueId;
                  return (
                    <tr
                      key={sig.detailedIssueId}
                      onClick={() => onSelectDetailedIssue(sig.detailedIssueId)}
                      className={`pdf-item-card cursor-pointer transition-all group ${
                        isSelected ? 'bg-amber-100/70 border-l-4 border-amber-500 font-bold' : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 group-hover:text-blue-600 max-w-[220px]">
                        {sig.issueTitle}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[180px]">
                        <span className="px-2 py-1 rounded bg-blue-100/80 text-blue-800 text-[10px] font-extrabold uppercase tracking-tight border border-blue-200/50 inline-block">
                          {sig.generalIssueTitle}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <CategoryBadgeList tags={sig.scopeTags} />
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-normal text-xs leading-relaxed max-w-[360px]">
                        {sig.mechanism}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                            sig.trendDirection === 'зростаючий'
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : sig.trendDirection === 'спадаючий'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {sig.trendDirection || 'без тренду'}
                          </span>
                          {sig.trendDirection !== 'без тренду' && sig.trendDirection !== 'недостатньо даних' && sig.trendStrength && (
                            <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              сила: {sig.trendStrength}
                            </span>
                          )}
                          {hasSpikeBadge(sig) && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap">
                              ⚡ {formatRisingSignalBadge(sig.risingSignal)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-600 text-[11px] whitespace-nowrap">
                        {sig.firstSeenAt || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 text-sm">
                        {sig.mentionsCount}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDetailedIssue(sig.detailedIssueId);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Фільтрувати дашборд"
                          >
                            <Filter className="w-3 h-3" />
                            <span>Фільтр</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCommentsForIssue({
                                id: sig.detailedIssueId,
                                title: sig.issueTitle,
                                mechanism: sig.mechanism,
                                type: 'detailed',
                                totalMentions: sig.mentionsCount
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Переглянути коментарі"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Коментарі</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📱 MOBILE VIEW: Single Tabbed Card for Growing vs Declining Issues */}
      <div className={isPdfExportMode ? "hidden" : forceMobileLayout ? "block" : "block lg:hidden"}>
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
          {/* Header with Tab Switcher */}
          <div className="flex flex-col gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {activeTrendTab === 'growing' ? (
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 shrink-0">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shrink-0">
                  <TrendingDown className="w-5 h-5 text-emerald-600" />
                </div>
              )}
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                  {activeTrendTab === 'growing' ? 'Зростаючі загальні проблеми' : 'Спадаючі загальні проблеми'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Перемикайте вкладки для перегляду зростаючої або спадаючої динаміки
                </p>
              </div>
            </div>

            {/* Segmented Switcher Controls */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full">
              <button
                type="button"
                onClick={() => setActiveTrendTab('growing')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                  activeTrendTab === 'growing'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Зростаючі ({growingIssues.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTrendTab('declining')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
                  activeTrendTab === 'declining'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Спадаючі ({decliningIssues.length})</span>
              </button>
            </div>
          </div>

          {/* Active List Content */}
          <div className="animate-fadeIn">
            {activeTrendTab === 'growing' ? renderGrowingIssuesListMobile() : renderDecliningIssuesListMobile()}
          </div>
        </div>
      </div>

      {/* 💻 DESKTOP VIEW: Side-by-Side Grid for Chart 113 & Chart 114 */}
      <div className={isPdfExportMode ? "grid grid-cols-2 gap-6" : forceMobileLayout ? "hidden" : "hidden lg:grid lg:grid-cols-2 gap-6"}>
        {/* Chart 113: Growing General Issues */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-3 border-slate-100 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 shrink-0">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Зростаючі загальні проблеми
                  </h3>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              {growingIssues.length} проблем
            </span>
          </div>

          {renderDesktopIssuesList(growingIssues, true)}
        </div>

        {/* Chart 114: Declining General Issues */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-3 border-slate-100 gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shrink-0">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Спадаючі загальні проблеми
                  </h3>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {decliningIssues.length} проблем
            </span>
          </div>

          {renderDesktopIssuesList(decliningIssues, false)}
        </div>
      </div>
    </div>
  );
};
