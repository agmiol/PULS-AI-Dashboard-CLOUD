import React, { useState, useMemo } from 'react';
import { SafeReactECharts as ReactECharts } from './SafeReactECharts';
import { MonthlyScorePoint, MonthlyDistributionPoint } from '../types';
import { TrendingUp, BarChart2, Calendar, BarChart3, Layers } from 'lucide-react';

interface MonthlyTrendsSectionProps {
  monthlyScores: MonthlyScorePoint[];
  monthlyDistribution: MonthlyDistributionPoint[];
  selectedMonth?: string;
  forceMobileLayout?: boolean;
  isPdfExportMode?: boolean;
  onSelectMonth: (monthRaw: string) => void;
  onSelectCategory?: (category: 'positive' | 'neutral' | 'negative' | 'all') => void;
}

// Helper to parse Year and Month from raw string YYYY-MM
const parseYearMonth = (monthRaw: string, monthStr?: string): { year: number; monthNum: number } => {
  if (monthRaw && monthRaw.length >= 7) {
    const ym = monthRaw.substring(0, 7);
    const parts = ym.split('-');
    if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      return { year: parseInt(parts[0], 10), monthNum: parseInt(parts[1], 10) };
    }
  }
  if (monthStr) {
    const parts = monthStr.split('-');
    if (parts.length === 2) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (!isNaN(p0) && !isNaN(p1)) {
        if (p0 > 12) return { year: 2000 + p0, monthNum: p1 };
        if (p1 > 12) return { year: 2000 + p1, monthNum: p0 };
        return { year: 2000 + p1, monthNum: p0 };
      }
    }
  }
  return { year: 2024, monthNum: 1 };
};

const getQuarterInfo = (monthRaw: string, monthStr?: string) => {
  const { year, monthNum } = parseYearMonth(monthRaw, monthStr);
  const qNum = Math.ceil(monthNum / 3);
  const romanQ = qNum === 1 ? 'I' : qNum === 2 ? 'II' : qNum === 3 ? 'III' : 'IV';
  const label = `${romanQ} кв. ${year}`;
  const key = `${year}-Q${qNum}`;
  return { key, label, year, qNum };
};

export const MonthlyTrendsSection: React.FC<MonthlyTrendsSectionProps> = ({
  monthlyScores,
  monthlyDistribution,
  selectedMonth,
  forceMobileLayout = false,
  isPdfExportMode = false,
  onSelectMonth,
  onSelectCategory
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [timeGranularity, setTimeGranularity] = useState<'monthly' | 'quarterly'>('monthly');

  // Parse multi-month selection
  const selectedMonthsList = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return [];
    return selectedMonth.split(',').map(s => s.trim().substring(0, 7)).filter(Boolean);
  }, [selectedMonth]);

  const isMonthSelected = (monthRaw: string, label?: string) => {
    if (selectedMonthsList.length === 0) return false;
    const ym = monthRaw.substring(0, 7);
    return selectedMonthsList.some(sel => sel === ym || sel === label || monthRaw.startsWith(sel));
  };

  const handleToggleMonth = (monthRaw: string) => {
    const ym = monthRaw.substring(0, 7);
    let nextList: string[];
    if (selectedMonthsList.includes(ym)) {
      nextList = selectedMonthsList.filter(s => s !== ym);
    } else {
      nextList = [...selectedMonthsList, ym];
    }
    if (nextList.length === 0 || nextList.length === monthlyScores.length) {
      onSelectMonth('all');
    } else {
      onSelectMonth(nextList.join(','));
    }
  };

  // Quarterly scores aggregation
  const quarterlyScores = useMemo(() => {
    if (!monthlyScores || monthlyScores.length === 0) return [];

    const map = new Map<string, {
      key: string;
      label: string;
      year: number;
      qNum: number;
      weightedScoreSum: number;
      totalScores: number;
      totalComments: number;
      monthsRawList: string[];
    }>();

    monthlyScores.forEach(m => {
      const { key, label, year, qNum } = getQuarterInfo(m.monthRaw, m.month);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          year,
          qNum,
          weightedScoreSum: 0,
          totalScores: 0,
          totalComments: 0,
          monthsRawList: []
        });
      }
      const q = map.get(key)!;
      q.weightedScoreSum += (m.avgScore || 0) * (m.totalScores || 0);
      q.totalScores += m.totalScores || 0;
      q.totalComments += m.totalComments || 0;
      q.monthsRawList.push(m.monthRaw.substring(0, 7));
    });

    return Array.from(map.values()).map(q => {
      const avgScore = q.totalScores > 0 ? Number((q.weightedScoreSum / q.totalScores).toFixed(2)) : 0;
      return {
        quarterKey: q.key,
        label: q.label,
        avgScore,
        totalScores: q.totalScores,
        totalComments: q.totalComments,
        monthsRawList: q.monthsRawList
      };
    });
  }, [monthlyScores]);

  // Quarterly distribution aggregation
  const quarterlyDistribution = useMemo(() => {
    if (!monthlyDistribution || monthlyDistribution.length === 0) return [];

    const map = new Map<string, {
      quarterKey: string;
      label: string;
      positiveCount: number;
      neutralCount: number;
      negativeCount: number;
      monthsRawList: string[];
    }>();

    monthlyDistribution.forEach(m => {
      const { key, label } = getQuarterInfo(m.monthRaw, m.month);
      if (!map.has(key)) {
        map.set(key, {
          quarterKey: key,
          label,
          positiveCount: 0,
          neutralCount: 0,
          negativeCount: 0,
          monthsRawList: []
        });
      }
      const q = map.get(key)!;
      q.positiveCount += m.positiveCount || 0;
      q.neutralCount += m.neutralCount || 0;
      q.negativeCount += m.negativeCount || 0;
      q.monthsRawList.push(m.monthRaw.substring(0, 7));
    });

    return Array.from(map.values());
  }, [monthlyDistribution]);

  const isQuarterSelected = (monthsRawList: string[]) => {
    if (selectedMonthsList.length === 0) return false;
    return monthsRawList.some(ym => selectedMonthsList.includes(ym));
  };

  const handleToggleQuarter = (monthsRawList: string[]) => {
    const allInQuarterSelected = monthsRawList.every(ym => selectedMonthsList.includes(ym));
    let nextList: string[];
    if (allInQuarterSelected) {
      nextList = selectedMonthsList.filter(s => !monthsRawList.includes(s));
    } else {
      const set = new Set([...selectedMonthsList, ...monthsRawList]);
      nextList = Array.from(set);
    }

    if (nextList.length === 0 || nextList.length >= monthlyScores.length) {
      onSelectMonth('all');
    } else {
      onSelectMonth(nextList.join(','));
    }
  };

  // Chart 110 Option: Average score evolution (Month vs Quarter)
  const chart110Option = useMemo(() => {
    const isQuarterly = timeGranularity === 'quarterly';
    const xAxisLabels = isQuarterly ? quarterlyScores.map(q => q.label) : monthlyScores.map(m => m.month);

    const seriesData = isQuarterly
      ? quarterlyScores.map(q => {
          const selected = isQuarterSelected(q.monthsRawList);
          return {
            value: q.totalScores > 0 ? q.avgScore : null,
            itemStyle: selected ? {
              color: '#f59e0b',
              borderColor: '#fef08a',
              borderWidth: 3
            } : undefined
          };
        })
      : monthlyScores.map(m => {
          const selected = isMonthSelected(m.monthRaw, m.month);
          return {
            value: m.totalScores > 0 ? m.avgScore : null,
            itemStyle: selected ? {
              color: '#f59e0b',
              borderColor: '#fef08a',
              borderWidth: 3
            } : undefined
          };
        });

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = params[0];
          if (!item) return '';
          if (isQuarterly) {
            const q = quarterlyScores[item.dataIndex];
            return `<div class="font-sans text-xs">
              <div class="font-bold border-b pb-1 mb-1 text-slate-800">${item.name} (${q?.monthsRawList.length || 3} міс.)</div>
              <div class="text-sky-600 font-semibold">Середня оцінка: <b>${item.value}</b> / 10</div>
              <div class="text-slate-500 text-[11px] mt-0.5">Всього оцінок: ${q?.totalScores.toLocaleString('uk-UA')}</div>
              <div class="text-slate-400 text-[10px]">Коментарів: ${q?.totalComments.toLocaleString('uk-UA')}</div>
            </div>`;
          }
          return `<div class="font-sans text-xs">
            <div class="font-bold border-b pb-1 mb-1 text-slate-800">${item.name}</div>
            <div class="text-sky-600 font-semibold">Середня оцінка: <b>${item.value}</b> / 10</div>
          </div>`;
        }
      },
      grid: {
        top: '15%',
        left: '3%',
        right: '4%',
        bottom: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisLabels,
        axisLabel: {
          fontSize: 10,
          fontWeight: (val: string) => {
            if (isQuarterly) {
              const q = quarterlyScores.find(item => item.label === val);
              return (q && isQuarterSelected(q.monthsRawList)) ? 'bold' : 'normal';
            }
            const point = monthlyScores.find(m => m.month === val);
            return (point && isMonthSelected(point.monthRaw, val)) ? 'bold' : 'normal';
          },
          color: (val: string) => {
            if (isQuarterly) {
              const q = quarterlyScores.find(item => item.label === val);
              return (q && isQuarterSelected(q.monthsRawList)) ? '#d97706' : '#64748b';
            }
            const point = monthlyScores.find(m => m.month === val);
            return (point && isMonthSelected(point.monthRaw, val)) ? '#d97706' : '#64748b';
          }
        },
        axisLine: { lineStyle: { color: '#cbd5e1' } }
      },
      yAxis: {
        type: 'value',
        min: 3,
        max: 10,
        interval: 1,
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
      },
      series: [
        {
          name: 'Середня оцінка',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbolSize: (value: any, params: any) => {
            if (isQuarterly) {
              const q = quarterlyScores[params.dataIndex];
              return (q && isQuarterSelected(q.monthsRawList)) ? 12 : 7;
            }
            const point = monthlyScores[params.dataIndex];
            return (point && isMonthSelected(point.monthRaw, point.month)) ? 12 : 6;
          },
          lineStyle: {
            width: 3,
            color: '#0284c7'
          },
          itemStyle: {
            color: '#0284c7'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(2, 132, 199, 0.35)' },
                { offset: 1, color: 'rgba(2, 132, 199, 0.02)' }
              ]
            }
          },
          data: seriesData
        }
      ]
    };
  }, [timeGranularity, monthlyScores, quarterlyScores, selectedMonthsList]);

  // Chart 111 Option: Ratings Distribution (Month vs Quarter)
  const chart111Option = useMemo(() => {
    const isQuarterly = timeGranularity === 'quarterly';
    const xAxisLabels = isQuarterly ? quarterlyDistribution.map(q => q.label) : monthlyDistribution.map(m => m.month);

    const posData = isQuarterly ? quarterlyDistribution.map(q => q.positiveCount) : monthlyDistribution.map(m => m.positiveCount);
    const neuData = isQuarterly ? quarterlyDistribution.map(q => q.neutralCount) : monthlyDistribution.map(m => m.neutralCount);
    const negData = isQuarterly ? quarterlyDistribution.map(q => q.negativeCount) : monthlyDistribution.map(m => m.negativeCount);

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Позитивні (9-10)', 'Нейтральні (7-8)', 'Негативні (1-6)'],
        top: '0%',
        right: '2%',
        textStyle: { fontSize: 11, color: '#475569' }
      },
      grid: {
        top: '18%',
        left: '3%',
        right: '4%',
        bottom: '12%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisLabels,
        axisLabel: {
          fontSize: 10,
          fontWeight: (val: string) => {
            if (isQuarterly) {
              const q = quarterlyDistribution.find(item => item.label === val);
              return (q && isQuarterSelected(q.monthsRawList)) ? 'bold' : 'normal';
            }
            return (selectedMonth && monthlyDistribution.find(m => m.month === val && m.monthRaw.startsWith(selectedMonth))) ? 'bold' : 'normal';
          },
          color: (val: string) => {
            if (isQuarterly) {
              const q = quarterlyDistribution.find(item => item.label === val);
              return (q && isQuarterSelected(q.monthsRawList)) ? '#d97706' : '#64748b';
            }
            return (selectedMonth && monthlyDistribution.find(m => m.month === val && m.monthRaw.startsWith(selectedMonth))) ? '#d97706' : '#64748b';
          }
        },
        axisLine: { lineStyle: { color: '#cbd5e1' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
      },
      series: [
        {
          name: 'Позитивні (9-10)',
          type: 'line',
          stack: 'Total',
          smooth: true,
          areaStyle: { opacity: 0.65 },
          lineStyle: { width: 1.5 },
          itemStyle: { color: '#10b981' },
          data: posData
        },
        {
          name: 'Нейтральні (7-8)',
          type: 'line',
          stack: 'Total',
          smooth: true,
          areaStyle: { opacity: 0.65 },
          lineStyle: { width: 1.5 },
          itemStyle: { color: '#f59e0b' },
          data: neuData
        },
        {
          name: 'Негативні (1-6)',
          type: 'line',
          stack: 'Total',
          smooth: true,
          areaStyle: { opacity: 0.65 },
          lineStyle: { width: 1.5 },
          itemStyle: { color: '#ef4444' },
          data: negData
        }
      ]
    };
  }, [timeGranularity, monthlyDistribution, quarterlyDistribution, selectedMonth]);

  const handleChart110Click = (params: any) => {
    if (params.dataIndex !== undefined) {
      if (timeGranularity === 'quarterly') {
        const q = quarterlyScores[params.dataIndex];
        if (q) handleToggleQuarter(q.monthsRawList);
      } else {
        const point = monthlyScores[params.dataIndex];
        if (point) handleToggleMonth(point.monthRaw);
      }
    }
  };

  const handleChart111Click = (params: any) => {
    if (params.seriesName) {
      if (params.seriesName.includes('Позитивні')) onSelectCategory?.('positive');
      else if (params.seriesName.includes('Нейтральні')) onSelectCategory?.('neutral');
      else if (params.seriesName.includes('Негативні')) onSelectCategory?.('negative');
    }
    if (params.dataIndex !== undefined) {
      if (timeGranularity === 'quarterly') {
        const q = quarterlyDistribution[params.dataIndex];
        if (q) handleToggleQuarter(q.monthsRawList);
      } else {
        const point = monthlyDistribution[params.dataIndex];
        if (point) handleToggleMonth(point.monthRaw);
      }
    }
  };

  return (
    <div>
      {/* 🎛️ Header Switcher Bar: "Дані помісячно" / "Дані поквартально" */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
              {timeGranularity === 'monthly' ? 'Динаміка оцінок по місяцям' : 'Динаміка оцінок по кварталам'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {timeGranularity === 'monthly'
              ? 'Аналіз середньої оцінки та розподілу за кожний місяць року'
              : 'Узагальнена аналітика та тренди по кварталах (I, II, III, IV кв.)'}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/90 shadow-2xs self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setTimeGranularity('monthly')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              timeGranularity === 'monthly'
                ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Відображати графіки в розрізі місяців"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Дані помісячно</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeGranularity('quarterly')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              timeGranularity === 'quarterly'
                ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Агрегувати дані та відображати поквартально"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Дані поквартально</span>
          </button>
        </div>
      </div>

      {/* 📱 Mobile / Simulator View: Show ONE chart at a time with tabs */}
      <div className={isPdfExportMode ? "hidden" : forceMobileLayout ? "block space-y-3" : "block lg:hidden space-y-3"}>
        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 0
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Середня оцінка</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 1
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Розподіл оцінок</span>
          </button>
        </div>

        {activeTab === 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                  {timeGranularity === 'monthly' ? 'Середня оцінка по місяцям' : 'Середня оцінка по кварталам'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Клік на точку для кросс-фільтрації
                </p>
              </div>
              {selectedMonth && (
                <span className="text-xs font-extrabold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/80 uppercase tracking-tight">
                  {selectedMonth}
                </span>
              )}
            </div>
            <div className="w-full h-[240px]">
              <ReactECharts
                option={chart110Option}
                style={{ height: '100%', width: '100%' }}
                onEvents={{ click: handleChart110Click }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                  {timeGranularity === 'monthly' ? 'Розподіл оцінок по місяцям' : 'Розподіл оцінок по кварталам'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Структура позитивних, нейтральних та негативних оцінок
                </p>
              </div>
              {selectedMonth && (
                <span className="text-xs font-extrabold px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-300 uppercase tracking-tight">
                  {selectedMonth}
                </span>
              )}
            </div>
            <div className="w-full h-[240px]">
              <ReactECharts
                option={chart111Option}
                style={{ height: '100%', width: '100%' }}
                onEvents={{ click: handleChart111Click }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* 💻 Desktop View: Full 2-column Grid */}
      <div className={isPdfExportMode ? "grid grid-cols-2 gap-6" : forceMobileLayout ? "hidden" : "hidden lg:grid lg:grid-cols-2 gap-6"}>
        {/* Chart 110: Average Score */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                {timeGranularity === 'monthly' ? 'Середня оцінка по місяцям' : 'Середня оцінка по кварталам'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Клік на точку для кросс-фільтрації
              </p>
            </div>
            {selectedMonth && (
              <span className="text-xs font-extrabold px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/80 uppercase tracking-tight">
                {selectedMonth}
              </span>
            )}
          </div>
          <div className="w-full h-[230px] min-h-[230px] relative">
            <ReactECharts
              option={chart110Option}
              style={{ height: '230px', width: '100%' }}
              onEvents={{ click: handleChart110Click }}
              isPdfExportMode={isPdfExportMode}
            />
          </div>
        </div>

        {/* Chart 111: Ratings Distribution */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                {timeGranularity === 'monthly' ? 'Розподіл оцінок по місяцям' : 'Розподіл оцінок по кварталам'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Структура позитивних, нейтральних та негативних оцінок
              </p>
            </div>
            {selectedMonth && (
              <span className="text-xs font-extrabold px-3 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-300 uppercase tracking-tight">
                {selectedMonth}
              </span>
            )}
          </div>
          <div className="w-full h-[230px] min-h-[230px] relative">
            <ReactECharts
              option={chart111Option}
              style={{ height: '230px', width: '100%' }}
              onEvents={{ click: handleChart111Click }}
              isPdfExportMode={isPdfExportMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

