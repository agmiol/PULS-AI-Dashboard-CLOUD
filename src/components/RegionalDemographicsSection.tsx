import React, { useState } from 'react';
import { SafeReactECharts as ReactECharts } from './SafeReactECharts';
import { UkraineMap, matchRegion } from './UkraineMap';
import { AllRegionsModal } from './AllRegionsModal';
import { RegionMultiSelectDropdown } from './RegionMultiSelectDropdown';
import { MonthMultiSelectDropdown } from './MonthMultiSelectDropdown';
import { RegionMapPoint, HromadaStatItem, MonthlyCommentPoint, LegalFormDistributionPoint, DashboardFilters } from '../types';
import { ExternalLink, Star, MessageSquare, MapPin, Building2, BarChart2 } from 'lucide-react';

interface RegionalDemographicsSectionProps {
  regionsMap: RegionMapPoint[];
  hromadaStats?: HromadaStatItem[];
  monthlyComments: MonthlyCommentPoint[];
  legalFormDistribution: LegalFormDistributionPoint[];
  selectedRegion?: string;
  selectedHromada?: string;
  selectedMonth?: string;
  selectedPersontype?: string;
  forceMobileLayout?: boolean;
  isPdfExportMode?: boolean;
  filters?: DashboardFilters;
  onSelectRegion: (regionName: string) => void;
  onSelectHromada?: (katottg: string, hromadaName?: string) => void;
  onGranularityChange?: (granularity: 'oblast' | 'hromada') => void;
  onSelectMonth: (monthRaw: string) => void;
  onSelectPersontype: (persontype: string) => void;
}

export const RegionalDemographicsSection: React.FC<RegionalDemographicsSectionProps> = ({
  regionsMap,
  hromadaStats,
  monthlyComments,
  legalFormDistribution,
  selectedRegion,
  selectedHromada,
  selectedMonth,
  selectedPersontype,
  forceMobileLayout = false,
  isPdfExportMode = false,
  filters,
  onSelectRegion,
  onSelectHromada,
  onGranularityChange,
  onSelectMonth,
  onSelectPersontype
}) => {
  const [isAllRegionsOpen, setIsAllRegionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Parse multi-month selection
  const selectedMonthsList = React.useMemo(() => {
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
    if (nextList.length === 0 || nextList.length === monthlyComments.length) {
      onSelectMonth('all');
    } else {
      onSelectMonth(nextList.join(','));
    }
  };

  // Chart 118 Option: Monthly Comments Count (Timeseries Bar)
  const chart118Option = {
    animation: false,
    tooltip: {
      show: true,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0];
        if (!item) return '';
        return `<div class="font-sans text-xs">
          <div class="font-bold border-b pb-1 mb-1 text-slate-800">${item.name}</div>
          <div class="text-sky-600 font-semibold">Кількість коментарів: <b>${(item.value || 0).toLocaleString('uk-UA')}</b></div>
          <div class="text-[10px] text-slate-400 mt-1">Клікніть для вибору / зняття вибору цього місяця</div>
        </div>`;
      }
    },
    grid: {
      top: '15%',
      left: '3%',
      right: '3%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: monthlyComments.map(c => c.month),
      axisLabel: {
        fontSize: 10,
        fontWeight: (val: string) => {
          const point = monthlyComments.find(m => m.month === val);
          return (point && isMonthSelected(point.monthRaw, val)) ? 'bold' : 'normal';
        },
        color: (val: string) => {
          const point = monthlyComments.find(m => m.month === val);
          return (point && isMonthSelected(point.monthRaw, val)) ? '#d97706' : '#64748b';
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
        name: 'Кількість коментарів',
        type: 'bar',
        barWidth: '60%',
        data: monthlyComments.map(c => {
          const isSelected = isMonthSelected(c.monthRaw, c.month);
          return {
            value: c.totalComments,
            itemStyle: isSelected ? {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#f59e0b' },
                  { offset: 1, color: '#d97706' }
                ]
              },
              borderColor: '#fef08a',
              borderWidth: 2,
              borderRadius: [4, 4, 0, 0]
            } : {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#0284c7' },
                  { offset: 1, color: '#0369a1' }
                ]
              },
              borderRadius: [4, 4, 0, 0]
            }
          };
        })
      }
    ]
  };

  // Chart 119 Option: Donut Pie chart between Legal Entities (1) and FOP (2) and Unknown
  const chart119Option = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div class="font-sans text-xs">
          <div class="font-bold border-b pb-1 mb-1 text-slate-800">${params.name}</div>
          <div class="text-sky-600 font-semibold">Коментарів: <b>${params.value.toLocaleString('uk-UA')}</b> (${params.percent}%)</div>
          <div class="text-[10px] text-slate-400 mt-1">Натисніть для фільтрації за цією формою</div>
        </div>`;
      }
    },
    legend: {
      top: '2%',
      left: 'center',
      textStyle: { fontSize: 11, color: '#475569' }
    },
    series: [
      {
        name: 'Юридична форма',
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['50%', '56%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: (params: any) => `${params.name}\n${params.value.toLocaleString('uk-UA')} (${params.percent}%)`,
          fontSize: 10,
          fontWeight: 'bold',
          color: '#334155'
        },
        labelLine: {
          show: true,
          length: 6,
          length2: 6
        },
        data: legalFormDistribution.map(d => {
          const isSelected = selectedPersontype && selectedPersontype === d.persontype;
          return {
            value: d.count,
            name: d.label,
            persontype: d.persontype,
            selected: isSelected,
            itemStyle: {
              color: d.persontype === '2' ? '#0284c7'
                   : d.persontype === '1' ? '#0d9488'
                   : '#94a3b8',
              borderWidth: isSelected ? 3 : 2,
              borderColor: isSelected ? '#f59e0b' : '#fff'
            }
          };
        })
      }
    ]
  };

  const handleBarClick = (params: any) => {
    if (params.dataIndex !== undefined) {
      const point = monthlyComments[params.dataIndex];
      if (point) {
        handleToggleMonth(point.monthRaw);
      }
    }
  };

  const handlePieClick = (params: any) => {
    if (params.data && params.data.persontype) {
      onSelectPersontype(params.data.persontype);
    }
  };

  // Top Regions Leaderboard
  const sortedRegions = [...regionsMap].sort((a, b) => b.count - a.count).slice(0, 5);

  const handleToggleRegion = (oblast: string) => {
    const currentList = selectedRegion && selectedRegion !== 'all'
      ? selectedRegion.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const alreadySelected = currentList.some(r => matchRegion(r, oblast));
    let nextList: string[];
    if (alreadySelected) {
      nextList = currentList.filter(r => !matchRegion(r, oblast));
    } else {
      nextList = [...currentList, oblast];
    }
    onSelectRegion(nextList.length > 0 ? nextList.join(',') : 'all');
  };

  return (
    <>
      {/* 📱 Mobile / Simulator View: Show ONE item at a time (Map vs Comments vs Legal Form Pie) */}
      <div className={isPdfExportMode ? "hidden" : forceMobileLayout ? "block space-y-3" : "block lg:hidden space-y-3"}>
        <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 0
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Карта та Регіони</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 1
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Коментарі</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 2
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ЮО vs ФОП</span>
          </button>
        </div>

        {/* Tab 0: Ukraine Map & Top 5 Regions */}
        {activeTab === 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Оцінки за регіонами
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Клік на область або список для кросс-фільтрації
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <RegionMultiSelectDropdown
                    regionsMap={regionsMap}
                    selectedRegion={selectedRegion}
                    onSelectRegion={onSelectRegion}
                  />
                  <button
                    onClick={() => setIsAllRegionsOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 px-2.5 py-1.5 rounded-xl border border-sky-200/80 transition-all cursor-pointer"
                  >
                    <span>Таблиця</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="my-2 flex-1 flex items-center justify-center">
              <UkraineMap
                data={regionsMap}
                hromadaStats={hromadaStats}
                selectedRegion={selectedRegion}
                selectedHromada={selectedHromada}
                filters={filters}
                isMobileOnly={true}
                onSelectRegion={onSelectRegion}
                onSelectHromada={onSelectHromada}
                onGranularityChange={onGranularityChange}
              />
            </div>
          </div>
        )}

        {/* Tab 1: Monthly Comments Bar Chart */}
        {activeTab === 1 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Коментарів на місяць
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Клік на місяць для кросс-фільтрації
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MonthMultiSelectDropdown
                    monthlyComments={monthlyComments}
                    selectedMonth={selectedMonth}
                    onSelectMonth={onSelectMonth}
                    compact={true}
                  />
                </div>
              </div>
            </div>
            <div className="w-full h-[240px]">
              <ReactECharts
                option={chart118Option}
                style={{ height: '100%', width: '100%' }}
                onEvents={{ click: handleBarClick }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Legal Form Breakdown (Юридичні особи vs ФОП) */}
        {activeTab === 2 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Кількість коментарів: Юридичні особи VS ФОП
                  </h3>
                  {selectedPersontype && selectedPersontype !== 'all' && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-tight">
                      {selectedPersontype === '1' ? 'ЮО' : selectedPersontype === '2' ? 'ФОП' : 'Нема даних'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Клік на сегмент для кросс-фільтрації
                </p>
              </div>
            </div>
            <div className="w-full h-[250px]">
              <ReactECharts
                option={chart119Option}
                style={{ height: '100%', width: '100%' }}
                onEvents={{ click: handlePieClick }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>
        )}
      </div>

      {/* 💻 Desktop View: Full 12-Column Grid */}
      <div className={isPdfExportMode ? "grid grid-cols-12 gap-6" : forceMobileLayout ? "hidden" : "hidden lg:grid lg:grid-cols-12 gap-6"}>
        {/* Chart 117: Ukraine Map (Expanded to 8 Columns) */}
        <div className={isPdfExportMode ? "col-span-8 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between" : "lg:col-span-8 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between"}>
          <div>
            <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                  Оцінки за регіонами
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Клік на область або список для кросс-фільтрації
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Multi-Select Dropdown with Checkboxes */}
                <RegionMultiSelectDropdown
                  regionsMap={regionsMap}
                  selectedRegion={selectedRegion}
                  onSelectRegion={onSelectRegion}
                />

                <button
                  onClick={() => setIsAllRegionsOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl border border-sky-200/80 transition-all cursor-pointer shadow-2xs"
                >
                  <span>Таблиця регіонів</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="my-2 flex-1 flex items-center justify-center">
            <UkraineMap
              data={regionsMap}
              hromadaStats={hromadaStats}
              selectedRegion={selectedRegion}
              selectedHromada={selectedHromada}
              filters={filters}
              onSelectRegion={onSelectRegion}
              onSelectHromada={onSelectHromada}
              onGranularityChange={onGranularityChange}
            />
          </div>

          {/* Top 5 Regions Horizontal Cards Grid */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
              <span>Топ-5 регіонів за активністю:</span>
              <span className="text-[10px] text-slate-400 font-medium normal-case">Клікніть для вибору або додавання регіону</span>
            </div>
            <div className={isPdfExportMode ? "grid grid-cols-5 gap-2.5" : "grid grid-cols-2 sm:grid-cols-5 gap-2.5"}>
              {sortedRegions.map((reg) => {
                const isSelected = Boolean(
                  selectedRegion &&
                  selectedRegion !== 'all' &&
                  selectedRegion.split(',').some(r => matchRegion(r.trim(), reg.oblast) || matchRegion(r.trim(), reg.fullName))
                );

                return (
                  <div
                    key={reg.oblast}
                    onClick={() => handleToggleRegion(reg.oblast)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all border flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-blue-500/30 font-extrabold'
                        : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`font-extrabold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-900'}`} title={reg.fullName}>
                        {reg.fullName}
                      </span>
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.2 rounded shrink-0 ${
                        isSelected
                          ? 'bg-slate-800 text-amber-400 border border-slate-700'
                          : reg.avgScore >= 9.0
                          ? 'bg-emerald-100/90 text-emerald-800'
                          : reg.avgScore >= 7.0
                          ? 'bg-amber-100/90 text-amber-800'
                          : 'bg-rose-100/90 text-rose-800'
                      }`}>
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {(reg.avgScore ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between text-[11px] font-bold pt-1 border-t ${
                      isSelected ? 'border-slate-800 text-slate-300' : 'border-slate-200/60 text-slate-600'
                    }`}>
                      <span className={isSelected ? 'text-sky-300 flex items-center gap-1' : 'text-sky-700 flex items-center gap-1'} title="Коментарі">
                        <MessageSquare className="w-3 h-3" />
                        {reg.commentsCount.toLocaleString('uk-UA')}
                      </span>
                      <span className={isSelected ? 'text-slate-400 text-[10px]' : 'text-slate-500 text-[10px]'} title="Всього оцінок">
                        {reg.count.toLocaleString('uk-UA')} оц.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stacked Right Column: Monthly Comments & Legal Form Breakdown (4 Columns) */}
        <div className={isPdfExportMode ? "col-span-4 flex flex-col gap-6 justify-between" : "lg:col-span-4 flex flex-col gap-6 justify-between"}>
          {/* Chart 118: Monthly Comments Volume */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between flex-1">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Коментарів на місяць
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Клік на місяць для кросс-фільтрації
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MonthMultiSelectDropdown
                    monthlyComments={monthlyComments}
                    selectedMonth={selectedMonth}
                    onSelectMonth={onSelectMonth}
                    compact={true}
                  />
                </div>
              </div>
            </div>
            <div className="w-full h-[220px] min-h-[220px] relative">
              <ReactECharts
                option={chart118Option}
                style={{ height: '220px', width: '100%' }}
                onEvents={{ click: handleBarClick }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>

          {/* Chart 119: Legal Form Breakdown */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between flex-1">
            <div>
              <div className="border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 uppercase text-xs tracking-wider">
                    Кількість коментарів: Юридичні особи VS ФОП
                  </h3>
                  {selectedPersontype && selectedPersontype !== 'all' && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-tight">
                      {selectedPersontype === '1' ? 'ЮО' : selectedPersontype === '2' ? 'ФОП' : 'Нема даних'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Клік на сегмент для кросс-фільтрації
                </p>
              </div>
            </div>
            <div className="w-full h-[220px] min-h-[220px] relative">
              <ReactECharts
                option={chart119Option}
                style={{ height: '220px', width: '100%' }}
                onEvents={{ click: handlePieClick }}
                isPdfExportMode={isPdfExportMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* All Regions Modal Popup */}
      <AllRegionsModal
        isOpen={isAllRegionsOpen}
        onClose={() => setIsAllRegionsOpen(false)}
        regionsMap={regionsMap}
        selectedRegion={selectedRegion}
        onSelectRegion={onSelectRegion}
      />
    </>
  );
};
