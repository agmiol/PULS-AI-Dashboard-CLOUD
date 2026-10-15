import React, { useState } from 'react';
import { SafeReactECharts as ReactECharts } from './SafeReactECharts';
import { KPIStats, MonthlyScorePoint } from '../types';
import { TrendingDown, TrendingUp, HelpCircle, ChevronLeft, ChevronRight, BarChart2, Star, UserCheck, Building2, Scale, MessageSquare } from 'lucide-react';

interface TopKpiSectionProps {
  kpis: KPIStats;
  monthlyScores?: MonthlyScorePoint[];
  forceMobileLayout?: boolean;
  isPdfExportMode?: boolean;
  selectedCategory?: string;
  selectedPersontype?: string;
  selectedHasCommentOnly?: boolean;
  onSelectCategory?: (category: 'positive' | 'neutral' | 'negative' | 'all') => void;
  onSelectLegalForm?: (persontype: '1' | '2' | 'all') => void;
  onToggleHasCommentOnly?: () => void;
}

export const TopKpiSection: React.FC<TopKpiSectionProps> = ({
  kpis,
  monthlyScores,
  forceMobileLayout = false,
  isPdfExportMode = false,
  selectedCategory,
  selectedPersontype,
  selectedHasCommentOnly = false,
  onSelectCategory,
  onSelectLegalForm,
  onToggleHasCommentOnly
}) => {
  const [activeMobileIndex, setActiveMobileIndex] = useState<number>(0);

  // Gauge ECharts option matching Superset slice 104 gauge_chart
  const gaugeOption = {
    animation: false,
    animationDuration: 0,
    series: [
      {
        type: 'gauge',
        animation: false,
        animationDuration: 0,
        center: ['50%', '62%'],
        radius: '85%',
        startAngle: 225,
        endAngle: -45,
        min: 1,
        max: 10,
        splitNumber: 9,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.6667, '#ef4444'],  // < 7 Red
              [0.8889, '#f59e0b'],  // < 9 Orange
              [1.0, '#10b981']     // <= 10 Green
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '65%',
          width: 8,
          offsetCenter: [0, '5%'],
          itemStyle: {
            color: '#0f172a'
          }
        },
        axisTick: {
          distance: -18,
          length: 5,
          lineStyle: { color: '#94a3b8', width: 1 }
        },
        splitLine: {
          distance: -22,
          length: 10,
          lineStyle: { color: '#64748b', width: 2 }
        },
        axisLabel: {
          distance: -10,
          color: '#475569',
          fontSize: 10,
          fontWeight: 'bold'
        },
        title: {
          show: false
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#0f172a',
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '38%']
        },
        data: [
          {
            value: kpis.averageScore,
            name: ''
          }
        ]
      }
    ]
  };

  const avgScoreGrowth = kpis.averageScoreGrowth30d ?? 0;

  // Last 12 months for sparkline trendlines
  const last12MonthsScores = React.useMemo(() => {
    if (!monthlyScores || monthlyScores.length === 0) return [];
    return monthlyScores.slice(-12);
  }, [monthlyScores]);

  // Sparkline mini generator
  const renderSparkline = (dataPoints: number[], isPositiveGrowth: boolean) => {
    if (!dataPoints || dataPoints.length === 0) return null;
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints, min + 1);
    const width = 120;
    const height = 28;

    const points = dataPoints.map((val, idx) => {
      const x = (idx / (dataPoints.length - 1)) * width;
      const y = height - ((val - min) / (max - min)) * height;
      return `${x},${y}`;
    }).join(' ');

    const strokeColor = '#0284c7';

    return (
      <svg className="w-[120px] h-[28px] overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const mobileKpiItems = [
    { id: 'ess', label: 'ESS', icon: Star },
    { id: 'total', label: 'Всього', icon: BarChart2 },
    { id: 'fop', label: 'ФОП', icon: UserCheck },
    { id: 'legal', label: 'ЮО', icon: Building2 },
    { id: 'nps', label: 'Баланс оцінок', icon: Scale },
    { id: 'comments', label: 'Відгуки', icon: MessageSquare }
  ];

  const handlePrevMobile = () => {
    setActiveMobileIndex((prev) => (prev === 0 ? mobileKpiItems.length - 1 : prev - 1));
  };

  const handleNextMobile = () => {
    setActiveMobileIndex((prev) => (prev === mobileKpiItems.length - 1 ? 0 : prev + 1));
  };

  return (
    <div>
      {/* 📱 MOBILE VIEW (Show 1 KPI Card at a time with tab pills & step navigation) */}
      <div className={isPdfExportMode ? "hidden" : forceMobileLayout ? "block bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3" : "block md:hidden bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3"}>
        {/* Mobile Header: Slide Counter + Arrow Controls */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Показник {activeMobileIndex + 1} з {mobileKpiItems.length}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {mobileKpiItems[activeMobileIndex].label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMobile}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Попередній KPI"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMobile}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Наступний KPI"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Switcher Buttons in 2 rows for Mobile (Fits all on one screen) */}
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
          {mobileKpiItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeMobileIndex === idx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMobileIndex(idx)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all cursor-pointer text-center ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-black ring-2 ring-blue-400/40'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60 font-semibold'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Card Content Slider */}
        <div className="pt-1">
          {/* Card 0: Gauge (ESS) */}
          {activeMobileIndex === 0 && (
            <div className="flex flex-col items-center justify-between min-h-[220px]">
              <div className="w-full flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                <span>Умови ведення бізнесу (ESS)</span>
                <span className="cursor-pointer group/tip relative text-slate-400">
                  <HelpCircle className="w-4 h-4" />
                  <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl z-50 font-normal normal-case leading-snug">
                    <strong>ESS (Entrepreneur satisfaction score)</strong> — середньозважена оцінка задоволеності за фільтрами.
                  </span>
                </span>
              </div>
              <div className="w-full h-[130px] my-1">
                <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} isPdfExportMode={isPdfExportMode} />
              </div>
              <div className="w-full border-t border-slate-100 pt-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">Динаміка ESS:</span>
                <div className={`text-xs font-bold flex items-center gap-1 ${avgScoreGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {avgScoreGrowth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{avgScoreGrowth > 0 ? `+${avgScoreGrowth}` : avgScoreGrowth} б. vs попер. 30д</span>
                </div>
              </div>
            </div>
          )}

          {/* Card 1: Total Scores */}
          {activeMobileIndex === 1 && (
            <div
              className="flex flex-col justify-between min-h-[180px] cursor-pointer"
              onClick={() => onSelectCategory && onSelectCategory('all')}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  <span>Всього оцінок</span>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {kpis.totalScores.toLocaleString('uk-UA')}
                </div>
                <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.totalScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpis.totalScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{kpis.totalScoresGrowth30d > 0 ? `+${kpis.totalScoresGrowth30d}` : kpis.totalScoresGrowth30d}% vs попер. 30д</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
                {renderSparkline(last12MonthsScores.map(m => m.totalScores), kpis.totalScoresGrowth30d >= 0)}
              </div>
            </div>
          )}

          {/* Card 2: FOP Scores */}
          {activeMobileIndex === 2 && (
            <div
              className="flex flex-col justify-between min-h-[180px] cursor-pointer"
              onClick={() => onSelectLegalForm && onSelectLegalForm('2')}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  <span className={selectedPersontype === '2' ? 'text-amber-800 font-black' : ''}>Оцінки від ФОП</span>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {kpis.fopScores.toLocaleString('uk-UA')}
                </div>
                <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.fopScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpis.fopScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{kpis.fopScoresGrowth30d > 0 ? `+${kpis.fopScoresGrowth30d}` : kpis.fopScoresGrowth30d}% vs попер. 30д</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
                {renderSparkline(last12MonthsScores.map(m => m.fopScores ?? Math.round(m.totalScores * 0.75)), kpis.fopScoresGrowth30d >= 0)}
              </div>
            </div>
          )}

          {/* Card 3: Legal Scores */}
          {activeMobileIndex === 3 && (
            <div
              className="flex flex-col justify-between min-h-[180px] cursor-pointer"
              onClick={() => onSelectLegalForm && onSelectLegalForm('1')}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  <span className={selectedPersontype === '1' ? 'text-teal-800 font-black' : ''}>Оцінки від ЮО</span>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {kpis.legalScores.toLocaleString('uk-UA')}
                </div>
                <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.legalScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpis.legalScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{kpis.legalScoresGrowth30d > 0 ? `+${kpis.legalScoresGrowth30d}` : kpis.legalScoresGrowth30d}% vs попер. 30д</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
                {renderSparkline(last12MonthsScores.map(m => m.legalScores ?? Math.round(m.totalScores * 0.25)), kpis.legalScoresGrowth30d >= 0)}
              </div>
            </div>
          )}

          {/* Card 4: Score Balance NPS */}
          {activeMobileIndex === 4 && (
            <div className="flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  <span>Баланс оцінок (NPS)</span>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                <div className={`text-3xl font-black tracking-tight mt-1 ${kpis.npsScoreBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {kpis.npsScoreBalance > 0 ? `+${kpis.npsScoreBalance}` : kpis.npsScoreBalance}%
                </div>
                <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${(kpis.npsScoreBalanceGrowth30d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {(kpis.npsScoreBalanceGrowth30d ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{(kpis.npsScoreBalanceGrowth30d ?? 0) > 0 ? `+${kpis.npsScoreBalanceGrowth30d}` : (kpis.npsScoreBalanceGrowth30d ?? 0)} п.п. vs попер. 30д</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
                {renderSparkline(last12MonthsScores.map(m => m.npsBalance ?? 0), (kpis.npsScoreBalanceGrowth30d ?? 0) >= 0)}
              </div>
            </div>
          )}

          {/* Card 5: Total Comments */}
          {activeMobileIndex === 5 && (
            <div
              className="flex flex-col justify-between min-h-[180px] cursor-pointer"
              onClick={() => onToggleHasCommentOnly && onToggleHasCommentOnly()}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  <span className={selectedHasCommentOnly ? 'text-blue-800 font-extrabold' : ''}>Всього коментарів</span>
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                  {kpis.totalComments.toLocaleString('uk-UA')}
                </div>
                <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.commentsGrowth30d >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                  {kpis.commentsGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{kpis.commentsGrowth30d > 0 ? `+${kpis.commentsGrowth30d}` : kpis.commentsGrowth30d}% vs попер. 30д</span>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
                {renderSparkline(last12MonthsScores.map(m => m.totalComments), kpis.commentsGrowth30d >= 0)}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Dot Indicators */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {mobileKpiItems.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveMobileIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeMobileIndex === idx ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 💻 DESKTOP VIEW (Full 6-column grid matching Superset layout) */}
      <div className={isPdfExportMode ? "grid grid-cols-6 gap-6" : forceMobileLayout ? "hidden" : "hidden md:grid md:grid-cols-2 lg:grid-cols-6 gap-6"}>
        {/* Gauge Widget (Chart 104) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between items-center relative">
          <div className="w-full flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1 min-w-0">
              <span className="leading-tight truncate" title="Умови ведення бізнесу (ESS - Entrepreneur satisfaction score)">
                Умови ведення бізнесу (ESS - Entrepreneur satisfaction score)
              </span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600 flex-shrink-0">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="absolute left-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Умови ведення бізнесу (ESS)</strong>
                  Entrepreneur satisfaction score — середньозважена оцінка задоволеності за обраними фільтрами.
                </span>
              </span>
            </div>
          </div>
          <div className="w-full h-[120px] my-1">
            <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} isPdfExportMode={isPdfExportMode} />
          </div>
          <div className="w-full border-t border-slate-100 pt-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400">Динаміка ESS:</span>
            <div className={`text-xs font-bold flex items-center gap-1 ${avgScoreGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {avgScoreGrowth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{avgScoreGrowth > 0 ? `+${avgScoreGrowth}` : avgScoreGrowth} б. vs попер. 30д</span>
            </div>
          </div>
        </div>

        {/* KPI Card 1: Total Scores (Chart 105) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative"
             onClick={() => onSelectCategory && onSelectCategory('all')}>
          <div>
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              <span>Оцінки</span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Формула динаміки оцінок:</strong>
                  <code>((Поточний період - Попередній) / Попередній) × 100%</code><br />
                  Динаміка автоматично перераховується відповідно до обраних фільтрів
                </span>
              </span>
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.totalScores.toLocaleString('uk-UA')}
            </div>
            <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.totalScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.totalScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{kpis.totalScoresGrowth30d > 0 ? `+${kpis.totalScoresGrowth30d}` : kpis.totalScoresGrowth30d}% vs попер. 30д</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
            <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
            {renderSparkline(last12MonthsScores.map(m => m.totalScores), kpis.totalScoresGrowth30d >= 0)}
          </div>
        </div>

        {/* KPI Card 2: FOP Scores (Chart 106) */}
        <div className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative ${
               selectedPersontype === '2' ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50/20' : 'border-slate-200/90'
             }`}
             onClick={() => onSelectLegalForm && onSelectLegalForm('2')}>
          <div>
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              <span className={selectedPersontype === '2' ? 'text-amber-800 font-extrabold' : ''}>Оцінки від ФОП</span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Формула динаміки оцінок ФОП:</strong>
                  <code>((Поточний період - Попередній) / Попередній) × 100%</code><br />
                  Динаміка автоматично перераховується відповідно до обраних фільтрів
                </span>
              </span>
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.fopScores.toLocaleString('uk-UA')}
            </div>
            <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.fopScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.fopScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{kpis.fopScoresGrowth30d > 0 ? `+${kpis.fopScoresGrowth30d}` : kpis.fopScoresGrowth30d}% vs попер. 30д</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
            <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
            {renderSparkline(last12MonthsScores.map(m => m.fopScores ?? Math.round(m.totalScores * 0.75)), kpis.fopScoresGrowth30d >= 0)}
          </div>
        </div>

        {/* KPI Card 3: Legal Scores (Chart 107) */}
        <div className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative ${
               selectedPersontype === '1' ? 'border-teal-500 ring-2 ring-teal-300 bg-teal-50/20' : 'border-slate-200/90'
             }`}
             onClick={() => onSelectLegalForm && onSelectLegalForm('1')}>
          <div>
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              <span className={selectedPersontype === '1' ? 'text-teal-800 font-extrabold' : ''}>Оцінки від ЮО</span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Формула динаміки оцінок ЮО:</strong>
                  <code>((Поточний період - Попередній) / Попередній) × 100%</code><br />
                  Динаміка автоматично перераховується відповідно до обраних фільтрів
                </span>
              </span>
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.legalScores.toLocaleString('uk-UA')}
            </div>
            <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.legalScoresGrowth30d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.legalScoresGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{kpis.legalScoresGrowth30d > 0 ? `+${kpis.legalScoresGrowth30d}` : kpis.legalScoresGrowth30d}% vs попер. 30д</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
            <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
            {renderSparkline(last12MonthsScores.map(m => m.legalScores ?? Math.round(m.totalScores * 0.25)), kpis.legalScoresGrowth30d >= 0)}
          </div>
        </div>

        {/* KPI Card 4: Score Balance (Chart 108) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all group relative">
          <div>
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              <span>Баланс оцінок</span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-72 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Формула Балансу оцінок:</strong>
                  <code>((Оцінки 9+10 / Всі оцінки) - (Оцінки 1..6 / Всі оцінки)) × 100%</code><br />
                  Різниця часток позитивних та негативних оцінок. Динаміка порівнює баланс оцінок за останні 30 днів із передостанніми 30 днями як абсолютний приріст або падіння у відсоткових пунктах (п.п.).
                </span>
              </span>
            </div>
            <div className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${kpis.npsScoreBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.npsScoreBalance > 0 ? `+${kpis.npsScoreBalance}` : kpis.npsScoreBalance}%
            </div>
            <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${(kpis.npsScoreBalanceGrowth30d ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(kpis.npsScoreBalanceGrowth30d ?? 0) >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{(kpis.npsScoreBalanceGrowth30d ?? 0) > 0 ? `+${kpis.npsScoreBalanceGrowth30d}` : (kpis.npsScoreBalanceGrowth30d ?? 0)} п.п. vs попер. 30д</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
            <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
            {renderSparkline(last12MonthsScores.map(m => m.npsBalance ?? 0), (kpis.npsScoreBalanceGrowth30d ?? 0) >= 0)}
          </div>
        </div>

        {/* KPI Card 5: Comments Count (Chart 109) */}
        <div className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative ${
               selectedHasCommentOnly ? 'border-blue-500 ring-2 ring-blue-300 bg-blue-50/20' : 'border-slate-200/90'
             }`}
             onClick={() => onToggleHasCommentOnly && onToggleHasCommentOnly()}>
          <div>
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
              <span className={selectedHasCommentOnly ? 'text-blue-800 font-extrabold' : ''}>Коментарів</span>
              <span className="cursor-pointer group/tip relative text-slate-400 hover:text-slate-600">
                <HelpCircle className="w-3.5 h-3.5" />
                <span className="absolute right-0 top-full mt-2 hidden group-hover/tip:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 font-normal normal-case leading-snug border border-slate-700 pointer-events-none">
                  <strong className="text-white block mb-1 text-xs">Підрахунок коментарів:</strong>
                  Простий count записів з наявним текстом (<code>processed_comment.length &gt; 0</code>).<br />
                  Динаміка розраховується відповідно до обраних фільтрів. Натисніть для кросс-фільтрації за наявністю коментарів.
                </span>
              </span>
            </div>
            <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.totalComments.toLocaleString('uk-UA')}
            </div>
            <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.commentsGrowth30d >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {kpis.commentsGrowth30d >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{kpis.commentsGrowth30d > 0 ? `+${kpis.commentsGrowth30d}` : kpis.commentsGrowth30d}% vs попер. 30д</span>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
            <span className="text-[10px] text-slate-400 font-medium">тренд (останні 12 міс.)</span>
            {renderSparkline(last12MonthsScores.map(m => m.totalComments), kpis.commentsGrowth30d >= 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

