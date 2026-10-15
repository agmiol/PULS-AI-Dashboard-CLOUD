import React, { useState, useEffect, useMemo } from 'react';
import { GeneralIssueFullItem, DetailedIssueFullItem, DashboardFilters, DashboardData } from '../types';
import { TargetIssueForComments } from './IssueCommentsModal';
import { CategoryBadgeList } from './CategoryBadgeList';
import { Search, Layers, ListFilter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CornerDownRight, Filter, MessageSquare, GitFork, X, TrendingUp, TrendingDown, Download, Loader2, Users, User, Building2 } from 'lucide-react';
import { exportCalibrationAuditToExcel } from '../utils/exportExcel';

const formatTrendDirection = (dir?: string | null): string => {
  if (!dir) return 'без тренду';
  if (dir === 'стабільний') return 'без тренду';
  if (dir === 'недостатньо даних') return 'Недостатньо даних для розрахунку тренду';
  return dir;
};

const formatRisingSignalBadge = (sig?: string | null): string => {
  if (!sig || sig === 'немає' || sig.toLowerCase().trim() === 'немає') return '';
  return 'Сплеск активності';
};

export const hasSpikeBadge = (item: any): boolean => {
  if (!item) return false;
  if (typeof item.activitySpike === 'boolean') {
    return item.activitySpike;
  }
  if (typeof item.hasActivitySpike === 'boolean') {
    return item.hasActivitySpike;
  }
  return Boolean(
    item.risingSignal &&
    item.risingSignal !== 'немає' &&
    item.risingSignal.toLowerCase().trim() !== 'немає'
  );
};

interface FullTablesSectionProps {
  fullGeneralIssues: GeneralIssueFullItem[];
  fullDetailedIssues: DetailedIssueFullItem[];
  dashboardData?: DashboardData;
  selectedGeneralIssueId?: number | null;
  selectedDetailedIssueId?: number | null;
  filters?: DashboardFilters;
  onUpdateFilters?: (filters: DashboardFilters) => void;
  forceMobileLayout?: boolean;
  isPdfExportMode?: boolean;
  onSelectGeneralIssue: (issueId: number) => void;
  onSelectDetailedIssue: (issueId: number) => void;
  onOpenCommentsForIssue: (issue: TargetIssueForComments) => void;
}

export const FullTablesSection: React.FC<FullTablesSectionProps> = ({
  fullGeneralIssues,
  fullDetailedIssues,
  dashboardData,
  selectedGeneralIssueId,
  selectedDetailedIssueId,
  filters,
  onUpdateFilters,
  forceMobileLayout = false,
  isPdfExportMode = false,
  onSelectGeneralIssue,
  onSelectDetailedIssue,
  onOpenCommentsForIssue
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'detailed'>('general');
  const [viewMode, setViewMode] = useState<'both' | 'general' | 'detailed'>('both');
  const [trendMode, setTrendMode] = useState<'all' | 'growing' | 'falling'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [generalPage, setGeneralPage] = useState(1);
  const [detailedPage, setDetailedPage] = useState(1);
  const pageSize = 10;
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Local fallback state if filters/onUpdateFilters are managed inside component
  const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters || {
    trendDirection: 'all',
    trendStrength: 'all',
    hasRisingSignal: 'all'
  });

  const activeFilters = filters || localFilters;

  const updateTrendFilter = (key: keyof DashboardFilters, val: string) => {
    const updated = { ...activeFilters, [key]: val };
    setLocalFilters(updated);
    if (onUpdateFilters) {
      onUpdateFilters(updated);
    }
    setGeneralPage(1);
    setDetailedPage(1);
  };

  // Track expanded general issue details (downward metadata expansion)
  const [expandedDetailsIds, setExpandedDetailsIds] = useState<Set<number>>(new Set());

  // Track opened child issues (дочірні проблеми)
  const [openedChildrenIds, setOpenedChildrenIds] = useState<Set<number>>(new Set());

  // Track expanded child issue details in detailed tab or sub-list
  const [expandedChildDetailsIds, setExpandedChildDetailsIds] = useState<Set<number>>(new Set());

  // Sync searchQuery with filters if passed from parent
  useEffect(() => {
    if (filters?.search !== undefined && filters.search !== searchQuery) {
      setSearchQuery(filters.search || '');
    }
  }, [filters?.search]);

  useEffect(() => {
    if (selectedGeneralIssueId) {
      setActiveTab('general');
      setOpenedChildrenIds(prev => new Set(prev).add(selectedGeneralIssueId));
      setExpandedDetailsIds(prev => new Set(prev).add(selectedGeneralIssueId));
    } else if (selectedDetailedIssueId) {
      const det = fullDetailedIssues.find(d => d.detailedIssueId === selectedDetailedIssueId);
      if (det) {
        setOpenedChildrenIds(prev => new Set(prev).add(det.parentGeneralIssueId));
      }
    }
  }, [selectedGeneralIssueId, selectedDetailedIssueId, fullDetailedIssues]);

  const toggleDetailsExpand = (issueId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedDetailsIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  const toggleChildrenOpen = (issueId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenedChildrenIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  const toggleChildDetailsExpand = (childId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedChildDetailsIds(prev => {
      const next = new Set(prev);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  };

  // Helper matching functions for local issue search with Ukrainian stemming support
  const getUkrainianStem = (word: string): string => {
    let w = word.toLowerCase().trim();
    if (w.length <= 3) return w;
    return w.replace(/(ами|ями|ях|ах|ів|їв|ей|ем|єм|ом|ові|еві|єю|ою|ий|ого|ому|им|их|ія|ію|ії|ям|ями|их|ій|и|а|я|е|є|у|ю|і|ї|ь)$/g, '');
  };

  const matchId = (id?: number | string | null, q?: string) => {
    if (id === undefined || id === null || !q) return false;
    const cleanQ = q.trim().toLowerCase().replace(/^[#№]\s*/, '');
    if (!cleanQ) return false;
    const idStr = String(id).toLowerCase();
    return idStr === cleanQ || idStr.includes(cleanQ);
  };

  const getQueryTerms = (q: string) => {
    return q.trim().toLowerCase().replace(/^[#№]\s*/, '').split(/\s+/).filter(Boolean);
  };

  const matchUkrainianTerm = (textLower: string, term: string): boolean => {
    if (!term) return true;
    if (textLower.includes(term)) return true;
    const termStem = getUkrainianStem(term);
    if (termStem.length >= 3 && textLower.includes(termStem)) return true;
    return false;
  };

  const matchGeneralSearch = (g: GeneralIssueFullItem, q: string) => {
    if (!q || !q.trim()) return true;
    if (matchId(g.generalIssueId, q)) return true;

    const terms = getQueryTerms(q);
    if (terms.length === 0) return true;

    const combined = [
      g.issueTitle || '',
      g.mechanism || '',
      ...(g.scopeTags || [])
    ].join(' ').toLowerCase();

    return terms.every(term => matchUkrainianTerm(combined, term));
  };

  const matchDetailedSearch = (d: DetailedIssueFullItem, q: string) => {
    if (!q || !q.trim()) return true;
    if (matchId(d.detailedIssueId, q) || matchId(d.parentGeneralIssueId, q)) return true;

    const terms = getQueryTerms(q);
    if (terms.length === 0) return true;

    const combined = [
      d.issueTitle || '',
      d.mechanism || '',
      d.signalName || '',
      d.generalIssueTitle || '',
      ...(d.scopeTags || [])
    ].join(' ').toLowerCase();

    return terms.every(term => matchUkrainianTerm(combined, term));
  };

  const matchTrendAndSignal = (
    trendDir?: string,
    trendStr?: string | null,
    itemOrSig?: any,
    f?: DashboardFilters
  ) => {
    const hasSurge = typeof itemOrSig === 'object' && itemOrSig !== null
      ? hasSpikeBadge(itemOrSig)
      : typeof itemOrSig === 'boolean'
      ? itemOrSig
      : Boolean(
          itemOrSig &&
          itemOrSig !== 'немає' &&
          itemOrSig.toLowerCase().trim() !== 'немає'
        );

    if (trendMode === 'growing') {
      const isGrowingTrend = trendDir === 'зростаючий';
      if (!isGrowingTrend && !hasSurge) return false;
    } else if (trendMode === 'falling') {
      if (trendDir !== 'спадаючий') return false;
    }

    const currentF = f || activeFilters;
    if (!currentF) return true;

    if (currentF.trendDirection && currentF.trendDirection !== 'all') {
      const dir = trendDir || 'без тренду';
      if (dir !== currentF.trendDirection) return false;
    }

    if (currentF.trendStrength && currentF.trendStrength !== 'all') {
      const str = trendStr || '';
      if (str !== currentF.trendStrength) return false;
    }

    if (currentF.hasRisingSignal && currentF.hasRisingSignal !== 'all') {
      if (currentF.hasRisingSignal === 'yes' && !hasSurge) return false;
      if (currentF.hasRisingSignal === 'no' && hasSurge) return false;
    }

    return true;
  };

  const isTrendFilterActive = Boolean(
    trendMode !== 'all' ||
    (activeFilters && (
      (activeFilters.trendDirection && activeFilters.trendDirection !== 'all') ||
      (activeFilters.trendStrength && activeFilters.trendStrength !== 'all') ||
      (activeFilters.hasRisingSignal && activeFilters.hasRisingSignal !== 'all')
    ))
  );

  // Map of parentGeneralIssueId -> DetailedIssueFullItem[]
  const childrenMap = useMemo(() => {
    const map = new Map<number, DetailedIssueFullItem[]>();
    fullDetailedIssues.forEach(d => {
      const list = map.get(d.parentGeneralIssueId) || [];
      list.push(d);
      map.set(d.parentGeneralIssueId, list);
    });
    return map;
  }, [fullDetailedIssues]);

  // Matching General Issues for count badges (independent of current viewMode)
  const matchingGeneralCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fullGeneralIssues.filter(g => {
      const gSearchMatch = matchGeneralSearch(g, q);
      const gTrendMatch = matchTrendAndSignal(g.trendDirection, g.trendStrength, g, filters);
      const gDirectMatch = gSearchMatch && gTrendMatch;

      const children = childrenMap.get(g.generalIssueId) || [];
      const hasMatchingChild = children.some(d => {
        const dSearchMatch = matchDetailedSearch(d, q);
        const dTrendMatch = matchTrendAndSignal(d.trendType, d.trendPower, d, filters);
        return dSearchMatch && dTrendMatch;
      });

      return gDirectMatch || hasMatchingChild;
    }).length;
  }, [fullGeneralIssues, childrenMap, searchQuery, filters, trendMode]);

  // Matching Detailed Issues for count badges (independent of current viewMode)
  const matchingDetailedCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fullDetailedIssues.filter(d => {
      const dSearchMatch = matchDetailedSearch(d, q);
      const dTrendMatch = matchTrendAndSignal(d.trendType || (d as any).trendDirection, d.trendPower || (d as any).trendStrength, d, filters);

      return dSearchMatch && dTrendMatch;
    }).length;
  }, [fullDetailedIssues, searchQuery, filters, trendMode]);

  // Hierarchical Filtered General Issues
  const filteredGeneral = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (viewMode === 'detailed') {
      return [];
    }

    return fullGeneralIssues.filter(g => {
      const gSearchMatch = matchGeneralSearch(g, q);
      const gTrendMatch = matchTrendAndSignal(g.trendDirection, g.trendStrength, g, filters);
      const gDirectMatch = gSearchMatch && gTrendMatch;

      if (viewMode === 'general') {
        // Search strictly only in General issues fields
        return gDirectMatch;
      }

      // viewMode === 'both': matches if direct match OR any child detailed issue matches search
      const children = childrenMap.get(g.generalIssueId) || [];
      const hasMatchingChild = children.some(d => {
        const dSearchMatch = matchDetailedSearch(d, q);
        const dTrendMatch = matchTrendAndSignal(d.trendType, d.trendPower, d, filters);
        return dSearchMatch && dTrendMatch;
      });

      return gDirectMatch || hasMatchingChild;
    });
  }, [fullGeneralIssues, childrenMap, searchQuery, filters, viewMode, trendMode]);

  // Track previous search query and trend filter state
  const prevSearchQueryRef = React.useRef<string>('');

  // Auto-open children when search query or trend/signal filters are active
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const prevQ = prevSearchQueryRef.current.trim().toLowerCase();
    prevSearchQueryRef.current = searchQuery;

    if (viewMode === 'general') {
      setOpenedChildrenIds(new Set());
      return;
    }

    if (!q && !isTrendFilterActive) {
      if (prevQ !== '' || isTrendFilterActive) {
        if (selectedGeneralIssueId) {
          setOpenedChildrenIds(new Set([selectedGeneralIssueId]));
        } else if (selectedDetailedIssueId) {
          const det = fullDetailedIssues.find(d => d.detailedIssueId === selectedDetailedIssueId);
          setOpenedChildrenIds(det ? new Set([det.parentGeneralIssueId]) : new Set());
        } else {
          setOpenedChildrenIds(new Set());
        }
      }
      return;
    }

    // Expand rows that have matching child detailed issues (only in 'both' mode)
    const newChildrenOpen = new Set<number>();
    filteredGeneral.forEach(g => {
      const children = childrenMap.get(g.generalIssueId) || [];
      const hasMatchingChild = children.some(d => {
        const dSearchMatch = matchDetailedSearch(d, q);
        const dTrendMatch = matchTrendAndSignal(d.trendType, d.trendPower, d, filters);
        return dSearchMatch && dTrendMatch;
      });
      if (hasMatchingChild) {
        newChildrenOpen.add(g.generalIssueId);
      }
    });

    if (selectedGeneralIssueId) {
      newChildrenOpen.add(selectedGeneralIssueId);
    }
    if (selectedDetailedIssueId) {
      const det = fullDetailedIssues.find(d => d.detailedIssueId === selectedDetailedIssueId);
      if (det) newChildrenOpen.add(det.parentGeneralIssueId);
    }

    setOpenedChildrenIds(newChildrenOpen);
  }, [searchQuery, isTrendFilterActive, filteredGeneral, childrenMap, selectedGeneralIssueId, selectedDetailedIssueId, fullDetailedIssues, filters, viewMode, trendMode]);

  // Filtered Detailed Issues for Detailed View / Search
  const filteredDetailed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (viewMode === 'general') {
      return [];
    }

    return fullDetailedIssues.filter(d => {
      const dSearchMatch = matchDetailedSearch(d, q);
      const dTrendMatch = matchTrendAndSignal(d.trendType || (d as any).trendDirection, d.trendPower || (d as any).trendStrength, d, filters);

      return dSearchMatch && dTrendMatch;
    });
  }, [fullDetailedIssues, searchQuery, filters, viewMode, trendMode]);

  const totalGeneralPages = Math.max(1, Math.ceil(filteredGeneral.length / pageSize));
  const totalDetailedPages = Math.max(1, Math.ceil(filteredDetailed.length / pageSize));

  const effectiveActiveTab = isPdfExportMode ? 'general' : (viewMode === 'detailed' ? 'detailed' : 'general');
  const pagedGeneral = isPdfExportMode ? filteredGeneral : filteredGeneral.slice((generalPage - 1) * pageSize, generalPage * pageSize);
  const pagedDetailed = filteredDetailed.slice((detailedPage - 1) * pageSize, detailedPage * pageSize);

  const renderCategoryBadges = (tags?: string[]) => {
    return <CategoryBadgeList tags={tags} />;
  };

  // Dedicated High-DPI Chunked PDF Export View (Chunked DOM containers prevent browser GPU canvas height limits & pixelation)
  if (isPdfExportMode) {
    const totalDetailedCount = filteredGeneral.reduce(
      (acc, g) => acc + (childrenMap.get(g.generalIssueId) || []).length,
      0
    );

    const CHUNK_SIZE = 3; // 3 general issues with expanded children per discrete pdf-export-page container
    const chunks: GeneralIssueFullItem[][] = [];
    for (let i = 0; i < filteredGeneral.length; i += CHUNK_SIZE) {
      chunks.push(filteredGeneral.slice(i, i + CHUNK_SIZE));
    }

    const safeChunks = chunks.length > 0 ? chunks : [[]];

    return (
      <div className="space-y-6">
        {safeChunks.map((chunkIssues, chunkIdx) => (
          <div
            key={`pdf-catalog-chunk-${chunkIdx}`}
            className="pdf-export-page bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
            style={{ width: '1200px', maxWidth: '1200px', boxSizing: 'border-box' }}
          >
            {/* Section Header Banner for Chunk (Web-style light header) */}
            <div className="pdf-item-card flex items-center justify-between border-b pb-3.5 border-slate-200">
              <div>
                <h3 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                  Повний каталог загальних та деталізованих проблем
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Реєстр проблем бізнесу за результатами ШІ-аналізу (загальних проблем: {filteredGeneral.length}, детальних сигналів: {totalDetailedCount})
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider shadow-2xs">
                  PULSE.GOV.UA
                </span>
              </div>
            </div>

            {/* Catalog List for this Chunk */}
            <div className="space-y-4">
              {chunkIssues.map((g) => {
                const children = childrenMap.get(g.generalIssueId) || [];
                return (
                  <div key={`general-block-${g.generalIssueId}`} className="space-y-3">
                    {/* General Issue Card (Marked for Smart Canvas Cut, styled with soft blue fill) */}
                    <div className="pdf-item-card bg-blue-50/70 border-2 border-blue-200/90 rounded-xl p-4 shadow-2xs space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className="font-mono text-blue-900 font-extrabold text-xs px-2 py-0.5 bg-blue-100/90 rounded border border-blue-200 shrink-0 mt-0.5">
                            #{g.generalIssueId}
                          </span>
                          <div className="space-y-1">
                            <h4 className="text-base font-black text-slate-950 leading-snug break-words whitespace-normal">
                              {g.issueTitle}
                            </h4>
                            {children.length > 0 && (
                              <div className="text-xs text-blue-800 font-extrabold">
                                Дочірніх сигналів бізнесу: {children.length}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-slate-800 text-xs font-extrabold text-right">
                          {/* Trend & Spike Badges beside Mentions */}
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-tight border ${
                              g.trendDirection === 'зростаючий'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : g.trendDirection === 'спадаючий'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              Тренд: {g.trendDirection || 'без тренду'}
                            </span>

                            {hasSpikeBadge(g) && (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                                ⚡ Сплеск
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="text-slate-500 text-[11px] uppercase font-bold">Згадок</div>
                            <div className="text-sm font-black text-slate-950">{g.totalMentions.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 text-[11px] uppercase font-bold">Частка</div>
                            <div className="text-sm font-black text-blue-700">{((g.shareRatio || 0) * 100).toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>

                      {/* Mechanism description */}
                      {g.mechanism && (
                        <div className="text-sm text-slate-900 leading-relaxed font-medium bg-white p-3 rounded-lg border border-blue-100 break-words whitespace-normal shadow-2xs">
                          <strong className="text-slate-950 font-bold">Механізм проблеми: </strong>
                          {g.mechanism}
                        </div>
                      )}
                    </div>

                    {/* Child Signals List (Each marked as an individual pdf-item-card) */}
                    {children.length > 0 && (
                      <div className="pl-5 border-l-2 border-blue-200 space-y-2.5">
                        {children.map((child, cIdx) => (
                          <div
                            key={`child-block-${child.detailedIssueId}`}
                            className="pdf-item-card bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-3.5 shadow-2xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="font-mono text-slate-600 font-extrabold text-xs mt-0.5 shrink-0">
                                  #{child.detailedIssueId}
                                </span>
                                <div>
                                  <h5 className="text-sm font-extrabold text-slate-950 leading-snug break-words whitespace-normal">
                                    {child.issueTitle}
                                  </h5>
                                  {child.isNewIssue === 'Так' && (
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 uppercase tracking-wider">
                                      Новий сигнал
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-slate-700 text-xs font-extrabold text-right">
                                {/* Trend & Spike Badges beside Mentions */}
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-tight border ${
                                  (child.trendType || (child as any).trendDirection) === 'зростаючий'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : (child.trendType || (child as any).trendDirection) === 'спадаючий'
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  Тренд: {(child.trendType || (child as any).trendDirection) || 'без тренду'}
                                </span>

                                {hasSpikeBadge(child) && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                                    ⚡ Сплеск
                                  </span>
                                )}

                                <div>
                                  <span className="text-slate-950 font-black">{child.totalMentions.toLocaleString()} згадок</span>
                                  <span className="mx-1 text-slate-300">•</span>
                                  <span className="text-blue-700 font-black">Частка: {((child.shareRatio || 0) * 100).toFixed(2)}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Complete Mechanism Description */}
                            {child.mechanism && (
                              <div className="text-sm text-slate-900 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 break-words whitespace-normal">
                                <strong className="text-slate-950 font-bold">Опис деталізованого механізму: </strong>
                                {child.mechanism}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="full-tables-section" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
      {/* Header & Tab Switcher & Search Bar */}
      <div className={`border-b pb-4 border-slate-100 print:border-b-2 print:border-slate-800 ${
        forceMobileLayout 
          ? 'flex flex-col gap-3' 
          : 'flex flex-col xl:flex-row xl:items-center justify-between gap-4'
      }`}>
        {/* 1. Title & Subtitle */}
        <div className={forceMobileLayout ? 'w-full' : 'max-w-xl'}>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-tight w-full leading-snug">
            Повний каталог загальних та деталізованих проблем
          </h3>
          <p className="text-xs text-slate-500 mt-1 w-full leading-relaxed print:hidden">
            Переглядайте текст проблеми, розгортайте деталі та відкривайте дочірні проблеми окремою кнопкою
          </p>
          <p className="hidden print:block text-xs font-bold text-slate-700 mt-1">
            Повний реєстр: {filteredGeneral.length} загальних проблем з усіма дочірніми механізмами
          </p>
        </div>

        {/* 2. Controls: Tab Switcher & Search Input */}
        <div className={`w-full max-w-full print:hidden flex flex-col gap-2.5 ${
          forceMobileLayout ? 'w-full' : 'xl:w-auto'
        }`}>
          {/* Row 1: View Mode / Scope Switcher (розширений, всі варіанти повністю видно) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
            <div className={`flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-2xs max-w-full ${
              forceMobileLayout ? 'w-full' : 'w-full sm:w-auto shrink-0'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('both');
                  setActiveTab('general');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'both'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Відображати загальні і детальні проблеми"
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Загальні і детальні</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('general');
                  setActiveTab('general');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'general'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Відображати тільки загальні проблеми"
              >
                <Layers className="w-3.5 h-3.5 opacity-70 shrink-0" />
                <span className="whitespace-nowrap">Тільки загальні ({matchingGeneralCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('detailed');
                  setActiveTab('detailed');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'detailed'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Відображати тільки детальні проблеми"
              >
                <ListFilter className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Тільки детальні ({matchingDetailedCount})</span>
              </button>
            </div>
          </div>

          {/* Row 2: Trend & Surge Switcher & Excel Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-start gap-3 w-full">
            {/* Trend & Surge Switcher */}
            <div className={`flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-2xs ${
              forceMobileLayout ? 'w-full flex-col sm:flex-row' : 'w-full sm:w-auto shrink-0'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setTrendMode('all');
                  setGeneralPage(1);
                  setDetailedPage(1);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  trendMode === 'all'
                    ? 'bg-slate-800 text-white shadow-xs ring-2 ring-slate-400/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Всі проблеми без обмеження тренду"
              >
                <span>Всі</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrendMode('growing');
                  setGeneralPage(1);
                  setDetailedPage(1);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  trendMode === 'growing'
                    ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/30'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
                title="Зростаючий тренд або сплеск активності"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Зростаючі</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrendMode('falling');
                  setGeneralPage(1);
                  setDetailedPage(1);
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  trendMode === 'falling'
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/30'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
                title="Спадаючий тренд"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Спадаючі</span>
              </button>
            </div>

            {/* Excel Export Button */}
            <button
              type="button"
              onClick={async () => {
                if (!dashboardData) return;
                try {
                  setIsExportingExcel(true);
                  await exportCalibrationAuditToExcel(dashboardData);
                } catch (err: any) {
                  console.error('Excel Export Error:', err);
                  alert('Помилка при експорті Excel: ' + (err.message || 'Спробуйте ще раз'));
                } finally {
                  setIsExportingExcel(false);
                }
              }}
              disabled={isExportingExcel || !dashboardData}
              className={`hidden sm:flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer border border-emerald-500/40 disabled:opacity-50 shrink-0 ${
                forceMobileLayout ? '!hidden' : 'w-full sm:w-auto max-w-full'
              }`}
              title="Експортувати повну Excel-таблицю з розрахунками трендів, схилів та сигналів"
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              ) : (
                <Download className="w-4 h-4 text-emerald-200" />
              )}
              <span>Експорт в Excel</span>
            </button>
          </div>

          {/* Row 3: Person Type Switcher (Всі/ФОП/Юридичні особи) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-3 w-full">
            <div className={`flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-2xs ${
              forceMobileLayout ? 'w-full flex-col sm:flex-row' : 'w-full sm:w-auto shrink-0'
            }`}>
              <button
                type="button"
                onClick={() => updateTrendFilter('persontype', 'all')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  (activeFilters.persontype || 'all') === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Показувати коментарі всіх суб'єктів"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Всі</span>
              </button>

              <button
                type="button"
                onClick={() => updateTrendFilter('persontype', '2')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  activeFilters.persontype === '2'
                    ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/30'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
                title="Фільтрувати по коментарям від Фізичних осіб - підприємців (persontype = 2)"
              >
                <User className="w-3.5 h-3.5" />
                <span>ФОП</span>
              </button>

              <button
                type="button"
                onClick={() => updateTrendFilter('persontype', '1')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  activeFilters.persontype === '1'
                    ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400/30'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
                title="Фільтрувати по коментарям від Юридичних осіб (persontype = 1)"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Юридичні особи</span>
              </button>
            </div>
          </div>

          {/* Row 4: Search Field (під перемикачем "Всі/ФОП/Юридичні особи" і в ПК, і в мобільній версії) */}
          <div className="relative w-full max-w-2xl pt-0.5">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-blue-600" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setGeneralPage(1);
                setDetailedPage(1);
              }}
              placeholder="🔍 Пошук проблеми за ID (#123), назвою або механізмом..."
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 text-xs bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setGeneralPage(1);
                  setDetailedPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Очистити пошук"
              >
                <X className="w-4 h-4 bg-slate-100 rounded-full p-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Trend & Rising Signal Filters Block in Catalog */}
      <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 sm:p-3.5 space-y-2.5 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-tight">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Детальні фільтри:</span>
          </div>
          {(isTrendFilterActive || viewMode !== 'both') && (
            <button
              onClick={() => {
                setViewMode('both');
                setActiveTab('general');
                setTrendMode('all');
                updateTrendFilter('trendDirection', 'all');
                updateTrendFilter('trendStrength', 'all');
                updateTrendFilter('hasRisingSignal', 'all');
              }}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/80 transition-all cursor-pointer shadow-2xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Скинути фільтри</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {/* 1. Напрям тренду */}
          <div className="flex flex-col gap-1 bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs hover:border-slate-300 transition-all">
            <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Напрям тренду:</label>
            <select
              value={activeFilters.trendDirection || 'all'}
              onChange={(e) => updateTrendFilter('trendDirection', e.target.value)}
              className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">Всі напрями</option>
              <option value="зростаючий" className="font-bold text-amber-700">Зростаючий</option>
              <option value="спадаючий" className="font-bold text-emerald-700">Спадаючий</option>
              <option value="без тренду">Без тренду</option>
              <option value="недостатньо даних">Недостатньо даних</option>
            </select>
          </div>

          {/* 2. Сила тренду */}
          <div className="flex flex-col gap-1 bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs hover:border-slate-300 transition-all">
            <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Сила тренду:</label>
            <select
              value={activeFilters.trendStrength || 'all'}
              onChange={(e) => updateTrendFilter('trendStrength', e.target.value)}
              className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">Всі проблеми</option>
              <option value="сильний" className="font-bold text-amber-700">Сильний</option>
              <option value="помірний" className="text-sky-700 font-bold">Помірний</option>
              <option value="слабкий" className="text-slate-600 font-bold">Слабкий</option>
            </select>
          </div>

          {/* 3. Сплеск активності */}
          <div className="flex flex-col gap-1 bg-white border border-slate-200/90 rounded-lg p-2 shadow-2xs hover:border-slate-300 transition-all">
            <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Сплеск активності:</label>
            <select
              value={activeFilters.hasRisingSignal || 'all'}
              onChange={(e) => updateTrendFilter('hasRisingSignal', e.target.value)}
              className="bg-transparent text-slate-900 font-extrabold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">Всі проблеми</option>
              <option value="yes" className="font-bold text-rose-700">⚡ Зі сплеском активності</option>
              <option value="no">Без сплеску активності</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab 1: General Issues */}
      {effectiveActiveTab === 'general' && (
        <div className="space-y-4">
          {/* 📱 Mobile / Compact Card View with Accordion Expansion */}
          <div className={forceMobileLayout ? "block space-y-3" : "block lg:hidden space-y-3"}>
            {pagedGeneral.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-medium text-xs">
                За вказаним пошуковим запитом «{searchQuery}» проблем не знайдено
              </div>
            ) : (
              pagedGeneral.map((issue) => {
                const isSelected = selectedGeneralIssueId === issue.generalIssueId;
                const children = childrenMap.get(issue.generalIssueId) || [];
                const isDetailsExpanded = isPdfExportMode || expandedDetailsIds.has(issue.generalIssueId);
                const isChildrenOpen = isPdfExportMode || openedChildrenIds.has(issue.generalIssueId);
                const q = searchQuery.trim().toLowerCase();
                const gMatchedDirectly = (q === '' || matchGeneralSearch(issue, q)) && matchTrendAndSignal(issue.trendDirection, issue.trendStrength, issue, filters);
                const matchingChildren = children.filter(d => {
                  const dSearchMatch = isPdfExportMode || q === '' || viewMode === 'general' || gMatchedDirectly || matchDetailedSearch(d, q);
                  const dTrendMatch = matchTrendAndSignal(d.trendType, d.trendPower, d, filters);
                  return dSearchMatch && dTrendMatch;
                });

                return (
                  <div
                    key={issue.generalIssueId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300 shadow-sm'
                        : 'bg-white border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    {/* General Problem Card Header */}
                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-slate-400 mt-0.5 shrink-0">
                            #{issue.generalIssueId}
                          </span>
                          <div className="font-extrabold text-xs text-slate-900 leading-snug break-words">
                            {issue.issueTitle}
                          </div>
                        </div>

                        {/* Mentions count and Comments button underneath it */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80">
                            {issue.totalMentions.toLocaleString()} згадок
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenCommentsForIssue({
                              id: issue.generalIssueId,
                              title: issue.issueTitle,
                              mechanism: issue.mechanism,
                              type: 'general',
                              totalMentions: issue.totalMentions
                            })}
                            className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Коментарі</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Bar: Details, Children, and Icon-only Filter on the far right in one row */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                          {/* Details Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleDetailsExpand(issue.generalIssueId)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {isDetailsExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5 text-blue-600 font-extrabold" />
                                <span>Згорнути</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                <span>Деталі</span>
                              </>
                            )}
                          </button>

                          {/* Open Children Button (if children exist) */}
                          {children.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleChildrenOpen(issue.generalIssueId)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer border ${
                                isChildrenOpen
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              <GitFork className="w-3 h-3" />
                              <span>Дочірні ({children.length})</span>
                              {isChildrenOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>

                        {/* Far right icon-only Filter Button */}
                        <button
                          type="button"
                          onClick={() => onSelectGeneralIssue(issue.generalIssueId)}
                          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                          title={isSelected ? 'Обрано' : 'Фільтрувати дашборд за цією загальною проблемою'}
                        >
                          <Filter className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Downward Details Section */}
                    {isDetailsExpanded && (
                      <div className="p-3.5 bg-slate-50/90 border-t border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                            Категорія:
                          </span>
                          {renderCategoryBadges(issue.scopeTags)}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                            Опис:
                          </span>
                          <p className="text-xs text-slate-800 font-normal leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                            {issue.mechanism}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] font-semibold">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Частка (доля):</span>
                            <span className="font-extrabold text-blue-700">
                              {((issue.shareRatio || 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Трендовий напрямок:</span>
                            <span className={`font-bold ${
                              issue.trendDirection === 'зростаючий'
                                ? 'text-amber-700'
                                : issue.trendDirection === 'спадаючий'
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                            }`}>
                              {formatTrendDirection(issue.trendDirection)}
                            </span>
                            {issue.trendDirection !== 'стабільний' && issue.trendDirection !== 'без тренду' && issue.trendDirection !== 'недостатньо даних' && issue.trendStrength && issue.trendStrength !== 'н/д' && issue.trendStrength !== 'відсутня' && (
                              <span className="text-[9px] text-slate-500 font-medium ml-1.5">
                                (сила: {issue.trendStrength})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expandable Child Issues Section (Opened via 'Дочірні проблеми' button) */}
                    {isChildrenOpen && (
                      <div className="p-3 bg-slate-100/90 border-t-2 border-blue-500 space-y-2 animate-fadeIn">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900 uppercase tracking-tight">
                            <CornerDownRight className="w-3.5 h-3.5 text-blue-600" />
                            <span>Дочірні точкові сигнали ({matchingChildren.length})</span>
                          </div>
                        </div>

                        {matchingChildren.length === 0 ? (
                          <div className="text-xs text-slate-400 py-2 italic text-center">
                            Немає дочірніх сигналів
                          </div>
                        ) : (
                          matchingChildren.map((child) => {
                            const isChildSelected = selectedDetailedIssueId === child.detailedIssueId;
                            const isChildDetailsExpanded = expandedChildDetailsIds.has(child.detailedIssueId);

                            return (
                              <div
                                key={child.detailedIssueId}
                                className={`rounded-xl border p-2.5 transition-all ${
                                  isChildSelected
                                    ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-bold text-slate-400">
                                        #{child.detailedIssueId}
                                      </span>
                                      <span className="font-bold text-xs text-slate-900">
                                        {child.issueTitle}
                                      </span>
                                      {child.isNewIssue === 'Так' && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 uppercase">
                                          Новий
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[10px] font-black text-slate-700 shrink-0">
                                      {child.totalMentions.toLocaleString()} зг.
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-tight ${
                                      child.trendType === 'зростаючий'
                                        ? 'bg-amber-100 text-amber-800'
                                        : child.trendType === 'спадаючий'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {formatTrendDirection(child.trendType)}
                                    </span>
                                    {child.trendType !== 'стабільний' && child.trendType !== 'без тренду' && child.trendType !== 'недостатньо даних' && child.trendPower && child.trendPower !== 'н/д' && child.trendPower !== 'відсутня' && (
                                      <span className="text-[8px] text-slate-400 font-medium">
                                        сила: {child.trendPower}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-1.5 pt-1.5 mt-1.5 border-t border-slate-100 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => toggleChildDetailsExpand(child.detailedIssueId)}
                                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    {isChildDetailsExpanded ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        <span>Сховати</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        <span>Деталі</span>
                                      </>
                                    )}
                                  </button>

                                  <div className="flex items-center gap-1 ml-auto">
                                    <button
                                      type="button"
                                      onClick={() => onSelectDetailedIssue(child.detailedIssueId)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                        isChildSelected
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <Filter className="w-2.5 h-2.5" />
                                      <span>Фільтр</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => onOpenCommentsForIssue({
                                        id: child.detailedIssueId,
                                        title: child.issueTitle,
                                        mechanism: child.mechanism,
                                        type: 'detailed',
                                        totalMentions: child.totalMentions
                                      })}
                                      className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 cursor-pointer flex items-center gap-1"
                                    >
                                      <MessageSquare className="w-2.5 h-2.5" />
                                      <span>Коментарі</span>
                                    </button>
                                  </div>
                                </div>

                                {isChildDetailsExpanded && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] space-y-1.5 text-slate-600 animate-fadeIn">
                                    <div>{renderCategoryBadges(child.scopeTags)}</div>
                                    <p className="bg-slate-50 p-2 rounded-lg text-slate-700">{child.mechanism}</p>
                                    <div className="flex items-center justify-between text-[10px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                      <span className="text-blue-700 font-bold">
                                        Доля: {((child.shareRatio || 0) * 100).toFixed(2)}%
                                      </span>
                                      <span className="font-semibold text-slate-700">
                                        Напрямок тренду: <b className="text-slate-900 uppercase text-[9px]">{formatTrendDirection(child.trendType)}</b>
                                        {child.trendType !== 'стабільний' && child.trendType !== 'без тренду' && child.trendType !== 'недостатньо даних' && child.trendPower && child.trendPower !== 'н/д' && child.trendPower !== 'відсутня' && (
                                          <span className="text-slate-500 font-medium ml-1">
                                            (сила: {child.trendPower})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 💻 Desktop Table View */}
          <div className={forceMobileLayout ? "hidden" : "hidden lg:block overflow-x-auto rounded-xl border border-slate-200/90 print:border-slate-300"}>
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-600 text-[10px] uppercase font-extrabold tracking-wider print:bg-slate-200 print:text-slate-900">
                  <th className="py-2.5 px-3 w-14"># ID</th>
                  <th className="py-2.5 px-3 max-w-[200px]">Загальна проблема</th>
                  <th className="py-2.5 px-3 max-w-[180px]">Категорія</th>
                  <th className="py-2.5 px-3 max-w-[320px]">Опис</th>
                  <th className="py-2.5 px-3 text-right">Згадок</th>
                  <th className="py-2.5 px-3 text-right">Доля (%)</th>
                  <th className="py-2.5 px-3 text-center">Трендовий напрямок</th>
                  <th className="py-2.5 px-3 text-center w-48 print:hidden">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                {pagedGeneral.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      За вказаним пошуковим запитом «{searchQuery}» проблем не знайдено
                    </td>
                  </tr>
                ) : (
                  pagedGeneral.map((issue) => {
                    const isSelected = selectedGeneralIssueId === issue.generalIssueId;
                    const children = childrenMap.get(issue.generalIssueId) || [];
                    const isChildrenOpen = isPdfExportMode || openedChildrenIds.has(issue.generalIssueId);
                    const q = searchQuery.trim().toLowerCase();
                    const gMatchedDirectly = (q === '' || matchGeneralSearch(issue, q)) && matchTrendAndSignal(issue.trendDirection, issue.trendStrength, issue, filters);
                    const matchingChildren = children.filter(d => {
                      const dSearchMatch = isPdfExportMode || q === '' || viewMode === 'general' || gMatchedDirectly || matchDetailedSearch(d, q);
                      const dTrendMatch = matchTrendAndSignal(d.trendType, d.trendPower, d, filters);
                      return dSearchMatch && dTrendMatch;
                    });

                    return (
                      <React.Fragment key={issue.generalIssueId}>
                        <tr
                          className={`transition-all print:bg-white print:break-inside-avoid ${
                            isSelected
                              ? 'bg-blue-50 font-bold border-l-4 border-l-blue-600'
                              : 'hover:bg-slate-50/90 bg-white'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] print:text-slate-700">
                            #{issue.generalIssueId}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[200px]">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span>{issue.issueTitle}</span>
                              {children.length > 0 && !isPdfExportMode && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleChildrenOpen(issue.generalIssueId, e)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 border print:hidden ${
                                    isChildrenOpen
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                                  }`}
                                  title="Відкрити дочірні проблеми"
                                >
                                  <GitFork className="w-2.5 h-2.5" />
                                  <span>Дочірні ({children.length})</span>
                                  {isChildrenOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                </button>
                              )}
                              {children.length > 0 && isPdfExportMode && (
                                <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  Дочірніх механізмів: {children.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[180px]">
                            {renderCategoryBadges(issue.scopeTags)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 leading-relaxed font-normal text-xs max-w-[320px] print:text-slate-800">
                            {issue.mechanism}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {issue.totalMentions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-blue-700">
                            {((issue.shareRatio || 0) * 100).toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                                issue.trendDirection === 'зростаючий'
                                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                                  : issue.trendDirection === 'спадаючий'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {formatTrendDirection(issue.trendDirection)}
                              </span>
                              {issue.trendDirection !== 'стабільний' && issue.trendDirection !== 'без тренду' && issue.trendDirection !== 'недостатньо даних' && issue.trendStrength && issue.trendStrength !== 'н/д' && issue.trendStrength !== 'відсутня' && (
                                <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                                  сила: {issue.trendStrength}
                                </span>
                              )}
                              {hasSpikeBadge(issue) && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap">
                                  ⚡ {formatRisingSignalBadge(issue.risingSignal)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center print:hidden">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => onSelectGeneralIssue(issue.generalIssueId)}
                                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                                }`}
                                title="Фільтрувати дашборд за цією загальною проблемою"
                              >
                                <Filter className="w-3 h-3 text-blue-600" />
                                <span>Фільтр</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenCommentsForIssue({
                                  id: issue.generalIssueId,
                                  title: issue.issueTitle,
                                  mechanism: issue.mechanism,
                                  type: 'general',
                                  totalMentions: issue.totalMentions
                                })}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-all cursor-pointer flex items-center gap-1"
                                title="Відкрити коментарі"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>Коментарі</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Child Rows */}
                        {isChildrenOpen && (
                          <tr className="bg-slate-50/90 border-b border-slate-200/90 print:bg-slate-50 print:break-inside-avoid">
                            <td colSpan={8} className="p-0">
                              <div className="py-3 px-6 bg-slate-50/90 border-l-4 border-l-blue-600 shadow-inner print:border-l-blue-600 print:shadow-none">
                                <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-200/80">
                                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-800 tracking-wider">
                                    <CornerDownRight className="w-4 h-4 text-blue-600" />
                                    <span>Дочірні деталізовані механізми ({matchingChildren.length})</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Материнська проблема #{issue.generalIssueId} «{issue.issueTitle}»
                                  </span>
                                </div>

                                {matchingChildren.length === 0 ? (
                                  <div className="text-xs text-slate-400 py-3 italic">
                                    Для цієї загальної проблеми не знайдено прив'язаних дочірніх механізмів.
                                  </div>
                                ) : (
                                  <div className="space-y-1.5 my-1">
                                    {matchingChildren.map((child) => (
                                      <div
                                        key={child.detailedIssueId}
                                        className="flex flex-col lg:flex-row lg:items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all gap-3 print:border-slate-300 print:shadow-none print:break-inside-avoid"
                                      >
                                        <div className="flex items-start gap-2.5 flex-1">
                                          <span className="font-mono text-[11px] font-bold text-slate-400 mt-0.5 shrink-0 print:text-slate-700">
                                            #{child.detailedIssueId}
                                          </span>
                                          <div className="space-y-1">
                                            <div className="font-bold text-xs text-slate-900 flex items-center gap-2 flex-wrap">
                                              <span>{child.issueTitle}</span>
                                              {child.isNewIssue === 'Так' && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 uppercase">
                                                  Новий сигнал
                                                </span>
                                              )}
                                            </div>

                                            {renderCategoryBadges(child.scopeTags)}

                                            <div className="text-xs text-slate-600 leading-relaxed font-normal print:text-slate-800">
                                              Механізм: <span className="text-slate-800 font-medium">{child.mechanism}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                                          {/* Trend Direction Badge */}
                                          <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                                              child.trendType === 'зростаючий'
                                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                                : child.trendType === 'спадаючий'
                                                ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                            }`}>
                                              {formatTrendDirection(child.trendType)}

                                            </span>
                                            {child.trendType !== 'стабільний' && child.trendType !== 'без тренду' && child.trendType !== 'недостатньо даних' && child.trendPower && child.trendPower !== 'н/д' && child.trendPower !== 'відсутня' && (
                                              <span className="text-[9px] text-slate-500 font-bold">
                                                сила: {child.trendPower}
                                              </span>
                                            )}
                                            {hasSpikeBadge(child) && (
                                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap">
                                                ⚡ {formatRisingSignalBadge(child.risingSignal)}
                                              </span>
                                            )}
                                          </div>

                                          <div className="text-right">
                                            <span className="text-xs font-black text-slate-900 block">
                                              {child.totalMentions.toLocaleString()} згадок
                                            </span>
                                            <span className="text-[11px] font-extrabold text-blue-700">
                                              Доля: {((child.shareRatio || 0) * 100).toFixed(2)}%
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1.5 print:hidden">
                                            <button
                                              onClick={() => onSelectDetailedIssue(child.detailedIssueId)}
                                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                            >
                                              <Filter className="w-3 h-3" />
                                              <span>Фільтр</span>
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenCommentsForIssue({
                                                  id: child.detailedIssueId,
                                                  title: child.issueTitle,
                                                  mechanism: child.mechanism,
                                                  type: 'detailed',
                                                  totalMentions: child.totalMentions
                                                });
                                              }}
                                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-all cursor-pointer flex items-center gap-1"
                                            >
                                              <MessageSquare className="w-3 h-3" />
                                              <span>Коментарі</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isPdfExportMode && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium print:hidden">
              <span>Показано {pagedGeneral.length} з {filteredGeneral.length} загальних проблем</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={generalPage === 1}
                  onClick={() => setGeneralPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700">
                  Сторінка {generalPage} з {totalGeneralPages}
                </span>
                <button
                  disabled={generalPage === totalGeneralPages}
                  onClick={() => setGeneralPage(p => Math.min(totalGeneralPages, p + 1))}
                  className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Detailed Signals */}
      {activeTab === 'detailed' && (
        <div className="space-y-4">
          {/* 📱 Mobile Accordion Card View */}
          <div className={forceMobileLayout ? "block space-y-3" : "block lg:hidden space-y-3"}>
            {pagedDetailed.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-medium text-xs">
                За вказаним пошуковим запитом «{searchQuery}» сигналів не знайдено
              </div>
            ) : (
              pagedDetailed.map((det) => {
                const isSelected = selectedDetailedIssueId === det.detailedIssueId;
                const isExpanded = expandedChildDetailsIds.has(det.detailedIssueId);

                return (
                  <div
                    key={det.detailedIssueId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-300 shadow-sm'
                        : 'bg-white border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    <div className="p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-slate-400 mt-0.5 shrink-0">
                            #{det.detailedIssueId}
                          </span>
                          <div className="font-extrabold text-xs text-slate-900 leading-snug break-words">
                            {det.issueTitle}
                          </div>
                        </div>

                        {/* Mentions count and Comments button underneath it */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80">
                            {det.totalMentions.toLocaleString()} згадок
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenCommentsForIssue({
                              id: det.detailedIssueId,
                              title: det.issueTitle,
                              mechanism: det.mechanism,
                              type: 'detailed',
                              totalMentions: det.totalMentions
                            })}
                            className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Коментарі</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Bar: Details & Icon-only Filter button on the far right */}
                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleChildDetailsExpand(det.detailedIssueId)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 text-blue-600 font-extrabold" />
                              <span>Згорнути</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              <span>Деталі</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectDetailedIssue(det.detailedIssueId)}
                          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                          title={isSelected ? 'Обрано' : 'Фільтрувати дашборд за цим сигналом'}
                        >
                          <Filter className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3.5 bg-slate-50/90 border-t border-slate-200/80 space-y-2.5 text-xs text-slate-700 animate-fadeIn">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                            Материнська загальна проблема:
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold text-[11px] inline-block border border-blue-200">
                            {det.generalIssueTitle}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                            Категорія:
                          </span>
                          {renderCategoryBadges(det.scopeTags)}
                        </div>

                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">
                            Опис:
                          </span>
                          <p className="text-xs text-slate-800 font-normal leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                            {det.mechanism}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] font-semibold">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Частка (доля):</span>
                            <span className="font-extrabold text-blue-700">
                              {((det.shareRatio || 0) * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Трендовий напрямок:</span>
                            <span className={`font-bold ${
                              det.trendType === 'зростаючий'
                                ? 'text-amber-700'
                                : det.trendType === 'спадаючий'
                                ? 'text-emerald-700'
                                : 'text-slate-600'
                            }`}>
                              {formatTrendDirection(det.trendType)}
                            </span>
                            {det.trendType !== 'стабільний' && det.trendType !== 'без тренду' && det.trendType !== 'недостатньо даних' && det.trendPower && det.trendPower !== 'н/д' && det.trendPower !== 'відсутня' && (
                              <span className="text-[9px] text-slate-500 font-medium ml-1.5">
                                (сила: {det.trendPower})
                              </span>
                            )}
                            {hasSpikeBadge(det) && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap mt-1">
                                ⚡ {formatRisingSignalBadge(det.risingSignal)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 💻 Desktop Table View */}
          <div className={forceMobileLayout ? "hidden" : "hidden lg:block overflow-x-auto rounded-xl border border-slate-200/90"}>
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-600 text-[10px] uppercase font-extrabold tracking-wider">
                  <th className="py-2.5 px-3 w-14"># ID</th>
                  <th className="py-2.5 px-3 max-w-[180px]">Детальна проблема</th>
                  <th className="py-2.5 px-3 max-w-[180px]">Материнська загальна проблема</th>
                  <th className="py-2.5 px-3 max-w-[160px]">Категорія</th>
                  <th className="py-2.5 px-3 max-w-[280px]">Опис</th>
                  <th className="py-2.5 px-3 text-right">Згадок</th>
                  <th className="py-2.5 px-3 text-right">Доля (%)</th>
                  <th className="py-2.5 px-3 text-center">Трендовий напрямок</th>
                  <th className="py-2.5 px-3 text-center w-28">Дія</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedDetailed.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                      За вказаним пошуковим запитом «{searchQuery}» сигналів не знайдено
                    </td>
                  </tr>
                ) : (
                  pagedDetailed.map((det) => {
                    const isSelected = selectedDetailedIssueId === det.detailedIssueId;
                    return (
                      <tr
                        key={det.detailedIssueId}
                        className={`transition-all ${
                          isSelected
                            ? 'bg-blue-50 font-bold border-l-4 border-l-blue-600 text-blue-950'
                            : 'hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          #{det.detailedIssueId}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 max-w-[180px]">
                          {det.issueTitle}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-[180px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold inline-block">
                            {det.generalIssueTitle}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[160px]">
                          {renderCategoryBadges(det.scopeTags)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 leading-relaxed font-normal text-xs max-w-[280px]">
                          {det.mechanism}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {det.totalMentions.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-blue-700">
                          {((det.shareRatio || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                              det.trendType === 'зростаючий'
                                ? 'bg-amber-100 text-amber-800'
                                : det.trendType === 'спадаючий'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {formatTrendDirection(det.trendType)}
                            </span>
                            {det.trendType !== 'стабільний' && det.trendType !== 'без тренду' && det.trendType !== 'недостатньо даних' && det.trendPower && det.trendPower !== 'н/д' && det.trendPower !== 'відсутня' && (
                              <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                                сила: {det.trendPower}
                              </span>
                            )}
                            {hasSpikeBadge(det) && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5 whitespace-nowrap mt-0.5">
                                ⚡ {formatRisingSignalBadge(det.risingSignal)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onSelectDetailedIssue(det.detailedIssueId)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Фільтрувати дашборд"
                            >
                              <Filter className="w-3 h-3" />
                              <span>Фільтр</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCommentsForIssue({
                                  id: det.detailedIssueId,
                                  title: det.issueTitle,
                                  mechanism: det.mechanism,
                                  type: 'detailed',
                                  totalMentions: det.totalMentions
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
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

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
            <span>Показано {pagedDetailed.length} з {filteredDetailed.length} детальних сигналів</span>
            <div className="flex items-center gap-2">
              <button
                disabled={detailedPage === 1}
                onClick={() => setDetailedPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700">
                Сторінка {detailedPage} з {totalDetailedPages}
              </span>
              <button
                disabled={detailedPage === totalDetailedPages}
                onClick={() => setDetailedPage(p => Math.min(totalDetailedPages, p + 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
