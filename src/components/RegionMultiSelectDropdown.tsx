import React, { useState, useRef, useEffect } from 'react';
import { RegionMapPoint } from '../types';
import { matchRegion } from './UkraineMap';
import { 
  ChevronDown, 
  Check, 
  Search, 
  X, 
  MapPin, 
  CheckSquare, 
  Square, 
  Star, 
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';

interface RegionMultiSelectDropdownProps {
  regionsMap: RegionMapPoint[];
  selectedRegion?: string;
  onSelectRegion: (regionString: string) => void;
  className?: string;
  compact?: boolean;
}

// Canonical list of all 27 Ukrainian administrative units
const ALL_REGIONS_CANONICAL = [
  { id: 'UA-30', oblast: 'Київ', fullName: 'м. Київ', shortName: 'м. Київ' },
  { id: 'UA-32', oblast: 'Київська', fullName: 'Київська область', shortName: 'Київська' },
  { id: 'UA-05', oblast: 'Вінницька', fullName: 'Вінницька область', shortName: 'Вінницька' },
  { id: 'UA-07', oblast: 'Волинська', fullName: 'Волинська область', shortName: 'Волинська' },
  { id: 'UA-12', oblast: 'Дніпропетровська', fullName: 'Дніпропетровська область', shortName: 'Дніпропетровська' },
  { id: 'UA-14', oblast: 'Донецька', fullName: 'Донецька область', shortName: 'Донецька' },
  { id: 'UA-18', oblast: 'Житомирська', fullName: 'Житомирська область', shortName: 'Житомирська' },
  { id: 'UA-21', oblast: 'Закарпатська', fullName: 'Закарпатська область', shortName: 'Закарпатська' },
  { id: 'UA-23', oblast: 'Запорізька', fullName: 'Запорізька область', shortName: 'Запорізька' },
  { id: 'UA-26', oblast: 'Івано-Франківська', fullName: 'Івано-Франківська область', shortName: 'Івано-Франківська' },
  { id: 'UA-35', oblast: 'Кіровоградська', fullName: 'Кіровоградська область', shortName: 'Кіровоградська' },
  { id: 'UA-44', oblast: 'Луганська', fullName: 'Луганська область', shortName: 'Луганська' },
  { id: 'UA-46', oblast: 'Львівська', fullName: 'Львівська область', shortName: 'Львівська' },
  { id: 'UA-48', oblast: 'Миколаївська', fullName: 'Миколаївська область', shortName: 'Миколаївська' },
  { id: 'UA-51', oblast: 'Одеська', fullName: 'Одеська область', shortName: 'Одеська' },
  { id: 'UA-53', oblast: 'Полтавська', fullName: 'Полтавська область', shortName: 'Полтавська' },
  { id: 'UA-56', oblast: 'Рівненська', fullName: 'Рівненська область', shortName: 'Рівненська' },
  { id: 'UA-59', oblast: 'Сумська', fullName: 'Сумська область', shortName: 'Сумська' },
  { id: 'UA-61', oblast: 'Тернопільська', fullName: 'Тернопільська область', shortName: 'Тернопільська' },
  { id: 'UA-63', oblast: 'Харківська', fullName: 'Харківська область', shortName: 'Харківська' },
  { id: 'UA-65', oblast: 'Херсонська', fullName: 'Херсонська область', shortName: 'Херсонська' },
  { id: 'UA-68', oblast: 'Хмельницька', fullName: 'Хмельницька область', shortName: 'Хмельницька' },
  { id: 'UA-71', oblast: 'Черкаська', fullName: 'Черкаська область', shortName: 'Черкаська' },
  { id: 'UA-73', oblast: 'Чернівецька', fullName: 'Чернівецька область', shortName: 'Чернівецька' },
  { id: 'UA-74', oblast: 'Чернігівська', fullName: 'Чернігівська область', shortName: 'Чернігівська' },
  { id: 'UA-43', oblast: 'Автономна Республіка Крим', fullName: 'Автономна Республіка Крим', shortName: 'АР Крим' },
  { id: 'UA-40', oblast: 'Севастополь', fullName: 'м. Севастополь', shortName: 'м. Севастополь' },
];

export const RegionMultiSelectDropdown: React.FC<RegionMultiSelectDropdownProps> = ({
  regionsMap,
  selectedRegion,
  onSelectRegion,
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse active selected list from comma-separated string
  const selectedList = React.useMemo(() => {
    if (!selectedRegion || selectedRegion === 'all') return [];
    return selectedRegion.split(',').map(s => s.trim()).filter(Boolean);
  }, [selectedRegion]);

  const isAllSelected = selectedList.length === 0;

  const isChecked = (oblastName: string, fullName?: string) => {
    if (isAllSelected) return false;
    return selectedList.some(sel => matchRegion(sel, oblastName) || matchRegion(sel, fullName));
  };

  // Toggle single region
  const toggleRegion = (oblastName: string, fullName?: string) => {
    let nextList: string[];
    const alreadySelected = isChecked(oblastName, fullName);

    if (alreadySelected) {
      nextList = selectedList.filter(sel => !matchRegion(sel, oblastName) && !matchRegion(sel, fullName));
    } else {
      nextList = [...selectedList, oblastName];
    }

    if (nextList.length === 0 || nextList.length === ALL_REGIONS_CANONICAL.length) {
      onSelectRegion('all');
    } else {
      onSelectRegion(nextList.join(','));
    }
  };

  const selectAll = () => {
    onSelectRegion('all');
  };

  const clearAll = () => {
    onSelectRegion('all');
  };

  // Search filter
  const filteredRegions = ALL_REGIONS_CANONICAL.filter(r => 
    r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.oblast.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to find data point from regionsMap
  const getDataForRegion = (oblastName: string, fullName: string) => {
    return regionsMap.find(d => matchRegion(d.oblast, oblastName) || matchRegion(d.fullName, fullName) || matchRegion(d.fullName, oblastName));
  };

  // Button title display
  const buttonTitle = React.useMemo(() => {
    if (isAllSelected) {
      return 'Всі області (27)';
    }
    if (selectedList.length === 1) {
      const match = ALL_REGIONS_CANONICAL.find(r => matchRegion(r.oblast, selectedList[0]) || matchRegion(r.fullName, selectedList[0]));
      return match ? match.shortName : selectedList[0];
    }
    if (selectedList.length <= 2) {
      return selectedList.map(s => {
        const match = ALL_REGIONS_CANONICAL.find(r => matchRegion(r.oblast, s) || matchRegion(r.fullName, s));
        return match ? match.shortName : s;
      }).join(', ');
    }
    return `Обрано: ${selectedList.length} областей`;
  }, [isAllSelected, selectedList]);

  return (
    <div ref={dropdownRef} className={`relative text-left ${className}`}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1 w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer shadow-xs w-full ${
            !isAllSelected
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/20'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          }`}
          title="Вибрати одну або декілька областей"
        >
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${!isAllSelected ? 'text-amber-400' : 'text-blue-600'}`} />
            <span className="truncate">
              {buttonTitle}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {!isAllSelected && (
              <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black shrink-0">
                {selectedList.length}
              </span>
            )}

            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-amber-400' : 'text-slate-400'}`} />
          </div>
        </button>

        {/* Quick Reset Button when filtered */}
        {!isAllSelected && (
          <button
            type="button"
            onClick={clearAll}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
            title="Скинути фільтр регіонів (показати всі)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
          {/* Panel Header */}
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider">
                Вибір областей України
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-bold">
              {!isAllSelected ? (
                <span className="text-amber-400 font-extrabold">{selectedList.length} з {ALL_REGIONS_CANONICAL.length} обрано</span>
              ) : (
                <span>Всі 27 регіонів</span>
              )}
            </div>
          </div>

          {/* Search Box */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Швидкий пошук області..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 placeholder:text-slate-400"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions Buttons */}
            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/70 text-[11px] font-bold">
              <button
                type="button"
                onClick={selectAll}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  isAllSelected
                    ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                <span>Обрати всі (27)</span>
              </button>

              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Скинути</span>
              </button>
            </div>
          </div>

          {/* Checkboxes List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredRegions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Областей за запитом «{searchTerm}» не знайдено
              </div>
            ) : (
              filteredRegions.map((reg) => {
                const checked = isChecked(reg.oblast, reg.fullName);
                const dataPoint = getDataForRegion(reg.oblast, reg.fullName);
                const isKyiv = reg.id === 'UA-30';

                return (
                  <label
                    key={reg.id}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs select-none ${
                      checked
                        ? 'bg-slate-900 text-white font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRegion(reg.oblast, reg.fullName)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                        checked
                          ? 'bg-amber-400 border-amber-400 text-slate-950'
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className={`truncate ${checked ? 'text-white font-extrabold' : 'text-slate-800 font-bold'}`}>
                            {reg.fullName}
                          </span>
                          {isKyiv && (
                            <span className={`text-[9px] px-1 py-0.2 rounded font-black tracking-tight ${
                              checked ? 'bg-amber-400 text-slate-950' : 'bg-sky-100 text-sky-800'
                            }`}>
                              СТОЛИЦЯ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats Pill */}
                    {dataPoint && (
                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                        <span className={`font-mono ${checked ? 'text-slate-300' : 'text-slate-500'}`}>
                          {dataPoint.count ? `${dataPoint.count.toLocaleString('uk-UA')} оц.` : '—'}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[10px] ${
                          checked
                            ? 'bg-slate-800 text-amber-400 border border-slate-700'
                            : dataPoint.avgScore >= 9.0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : dataPoint.avgScore >= 7.0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <Star className="w-2.5 h-2.5 fill-current" />
                          {(dataPoint.avgScore ?? 0).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Panel Footer with Apply Button */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              Клікніть область на карті для швидкого перемикання
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
