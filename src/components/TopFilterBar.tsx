import React from 'react';
import { Users, User, Building2, RotateCcw, MapPin, X } from 'lucide-react';
import { DashboardFilters, MonthlyCommentPoint, RegionMapPoint } from '../types';
import { RegionMultiSelectDropdown } from './RegionMultiSelectDropdown';
import { MonthMultiSelectDropdown } from './MonthMultiSelectDropdown';

interface TopFilterBarProps {
  filters: DashboardFilters;
  monthlyComments?: MonthlyCommentPoint[];
  regionsMap: RegionMapPoint[];
  onSelectMonth?: (monthString: string) => void;
  onSelectPersontype: (pt: '1' | '2' | 'all') => void;
  onSelectRegion: (regionString: string) => void;
  onUpdateFilters: (filters: DashboardFilters) => void;
  forceMobileLayout?: boolean;
}

export const TopFilterBar: React.FC<TopFilterBarProps> = ({
  filters,
  monthlyComments = [],
  regionsMap,
  onSelectMonth,
  onSelectPersontype,
  onSelectRegion,
  onUpdateFilters,
  forceMobileLayout = false
}) => {
  const currentPersonType = filters.persontype || 'all';
  const currentRegion = filters.region || 'all';
  const currentMonth = filters.month || 'all';
  const hasHromada = !!filters.selectedHromada;

  const hasActiveFilters = currentPersonType !== 'all' || currentRegion !== 'all' || currentMonth !== 'all' || hasHromada;

  const handleResetFilters = () => {
    onUpdateFilters({
      ...filters,
      persontype: 'all',
      region: 'all',
      month: 'all',
      selectedHromada: null,
      selectedHromadaName: null
    });
  };

  const handleClearHromada = () => {
    onUpdateFilters({
      ...filters,
      selectedHromada: null,
      selectedHromadaName: null
    });
  };

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs mb-4">
      <div className={`flex flex-col sm:flex-row items-center gap-3 ${forceMobileLayout ? 'flex-col' : ''}`}>
        {/* ФОП / Юридична особа / Всі */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 h-[38px] items-center">
            <button
              type="button"
              onClick={() => onSelectPersontype('all')}
              className={`flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                currentPersonType === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Всі суб'єкти господарювання"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Всі суб'єкти</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectPersontype('2')}
              className={`flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                currentPersonType === '2'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
              title="Фізичні особи - підприємці"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">ФОП</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectPersontype('1')}
              className={`flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                currentPersonType === '1'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs ring-1 ring-amber-400'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
              title="Юридичні особи"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">ЮО</span>
            </button>
          </div>
        </div>

        {/* Область, Період & Hromada Chip */}
        <div className="flex-1 sm:flex-[2] w-full flex flex-col sm:flex-row items-center gap-2">
          {/* Вибір області */}
          <div className="flex-1 w-full min-w-0">
            <RegionMultiSelectDropdown
              regionsMap={regionsMap}
              selectedRegion={currentRegion}
              onSelectRegion={onSelectRegion}
              compact={false}
              className="w-full"
            />
          </div>

          {/* Вибір періоду (місяці / квартали / інтервал) - справа від "Всі області" */}
          <div className="flex-1 w-full min-w-0">
            <MonthMultiSelectDropdown
              monthlyComments={monthlyComments}
              selectedMonth={filters.month}
              onSelectMonth={(m) => onSelectMonth?.(m)}
              compact={false}
              className="w-full"
            />
          </div>

          {hasHromada && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-bold text-xs shadow-2xs shrink-0 h-[38px] animate-fadeIn">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate max-w-[160px]" title={filters.selectedHromadaName || filters.selectedHromada || ''}>
                {filters.selectedHromadaName || filters.selectedHromada}
              </span>
              <button
                type="button"
                onClick={handleClearHromada}
                className="ml-0.5 text-amber-800 hover:text-amber-950 hover:bg-amber-200/60 p-0.5 rounded-md transition-colors cursor-pointer"
                title="Скинути вибір громади"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200/80 cursor-pointer shrink-0 h-[38px] w-full sm:w-auto"
            title="Скинути всі фільтри"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Скинути</span>
          </button>
        )}
      </div>
    </div>
  );
};
