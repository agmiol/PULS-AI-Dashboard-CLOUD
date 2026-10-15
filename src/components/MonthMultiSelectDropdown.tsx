import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  Check, 
  Search, 
  X, 
  Calendar, 
  CheckSquare, 
  RotateCcw,
  MessageSquare,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  Zap,
  Filter
} from 'lucide-react';
import { MonthlyCommentPoint } from '../types';

interface MonthMultiSelectDropdownProps {
  monthlyComments: MonthlyCommentPoint[];
  selectedMonth?: string;
  onSelectMonth: (monthString: string) => void;
  className?: string;
  compact?: boolean;
}

export const MonthMultiSelectDropdown: React.FC<MonthMultiSelectDropdownProps> = ({
  monthlyComments,
  selectedMonth,
  onSelectMonth,
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'presets' | 'range' | 'multi'>('range');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Chronological months array (ascending by YYYY-MM)
  const sortedMonthsAsc = React.useMemo(() => {
    if (!monthlyComments || monthlyComments.length === 0) return [];
    return [...monthlyComments].sort((a, b) => a.monthRaw.localeCompare(b.monthRaw));
  }, [monthlyComments]);

  // Chronological months array (descending by YYYY-MM, newest first)
  const sortedMonthsDesc = React.useMemo(() => {
    return [...sortedMonthsAsc].reverse();
  }, [sortedMonthsAsc]);

  // Range state: start month and end month YYYY-MM
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

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
    if (!selectedMonth || selectedMonth === 'all') return [];
    return selectedMonth.split(',').map(s => s.trim().substring(0, 7)).filter(Boolean);
  }, [selectedMonth]);

  const isAllSelected = selectedList.length === 0;

  // Initialize range inputs when dropdown opens or when selectedList changes
  useEffect(() => {
    if (sortedMonthsAsc.length > 0) {
      if (selectedList.length > 0) {
        const sortedSelected = [...selectedList].sort();
        setRangeStart(sortedSelected[0]);
        setRangeEnd(sortedSelected[sortedSelected.length - 1]);
      } else {
        setRangeStart(sortedMonthsAsc[0].monthRaw.substring(0, 7));
        setRangeEnd(sortedMonthsAsc[sortedMonthsAsc.length - 1].monthRaw.substring(0, 7));
      }
    }
  }, [isOpen, selectedMonth, sortedMonthsAsc]);

  // Format short label for month (e.g. "Травень 2025" -> "Тра '25")
  const formatShortName = (item?: MonthlyCommentPoint, rawYm?: string) => {
    if (!item) return rawYm || '';
    const parts = item.month.split(' ');
    if (parts.length === 2) {
      const mShort = parts[0].substring(0, 3);
      const yShort = parts[1].slice(-2);
      return `${mShort} '${yShort}`;
    }
    return item.month;
  };

  // Helper: Get label for a YYYY-MM code
  const getMonthLabel = (ym: string) => {
    const match = sortedMonthsAsc.find(m => m.monthRaw.startsWith(ym));
    return match ? match.month : ym;
  };

  // Check if current selection forms a contiguous interval
  const contiguousIntervalText = React.useMemo(() => {
    if (isAllSelected || selectedList.length <= 1) return null;
    
    const sortedSel = [...selectedList].sort();
    const indices = sortedSel.map(ym => sortedMonthsAsc.findIndex(m => m.monthRaw.startsWith(ym))).filter(idx => idx !== -1);
    
    if (indices.length !== selectedList.length) return null;
    
    let isContiguous = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) {
        isContiguous = false;
        break;
      }
    }

    if (isContiguous && sortedSel.length >= 2) {
      const startMatch = sortedMonthsAsc.find(m => m.monthRaw.startsWith(sortedSel[0]));
      const endMatch = sortedMonthsAsc.find(m => m.monthRaw.startsWith(sortedSel[sortedSel.length - 1]));
      return `${formatShortName(startMatch, sortedSel[0])} — ${formatShortName(endMatch, sortedSel[sortedSel.length - 1])}`;
    }

    return null;
  }, [isAllSelected, selectedList, sortedMonthsAsc]);

  // Available Quarters calculation
  const availableQuarters = React.useMemo(() => {
    if (!sortedMonthsAsc || sortedMonthsAsc.length === 0) return [];
    const map = new Map<string, { label: string; months: string[] }>();
    sortedMonthsAsc.forEach(m => {
      const ym = m.monthRaw.substring(0, 7);
      const parts = ym.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0], 10);
        const mNum = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(mNum)) {
          const qNum = Math.ceil(mNum / 3);
          const romanQ = qNum === 1 ? 'I' : qNum === 2 ? 'II' : qNum === 3 ? 'III' : 'IV';
          const key = `${year}-Q${qNum}`;
          const label = `${romanQ} кв. ${year}`;
          if (!map.has(key)) {
            map.set(key, { label, months: [] });
          }
          map.get(key)!.months.push(ym);
        }
      }
    });
    return Array.from(map.values()).reverse();
  }, [sortedMonthsAsc]);

  // Check if current selection matches a specific Quarter
  const matchedQuarterLabel = React.useMemo(() => {
    if (selectedList.length === 0) return null;
    const sortedSel = [...selectedList].sort().join(',');
    const qMatch = availableQuarters.find(q => [...q.months].sort().join(',') === sortedSel);
    return qMatch ? qMatch.label : null;
  }, [selectedList, availableQuarters]);

  // Button title display
  const buttonTitle = React.useMemo(() => {
    if (isAllSelected) {
      return `Весь період (${sortedMonthsAsc.length} міс.)`;
    }
    if (matchedQuarterLabel) {
      return matchedQuarterLabel;
    }
    if (contiguousIntervalText) {
      return contiguousIntervalText;
    }
    if (selectedList.length === 1) {
      return getMonthLabel(selectedList[0]);
    }
    return `Обрано: ${selectedList.length} міс.`;
  }, [isAllSelected, matchedQuarterLabel, contiguousIntervalText, selectedList, sortedMonthsAsc]);

  // ACTION 1: Select single month
  const handleSelectSingleMonth = (ym: string) => {
    onSelectMonth(ym);
    setIsOpen(false);
  };

  // ACTION 2: Select last N months
  const handleSelectLastNMonths = (count: number) => {
    if (sortedMonthsAsc.length === 0) return;
    if (count >= sortedMonthsAsc.length) {
      onSelectMonth('all');
      setIsOpen(false);
      return;
    }
    const recent = sortedMonthsAsc.slice(-count);
    const yms = recent.map(m => m.monthRaw.substring(0, 7));
    onSelectMonth(yms.join(','));
    setIsOpen(false);
  };

  // Matched months for current range selection
  const rangeMatchedMonths = React.useMemo(() => {
    if (!rangeStart || !rangeEnd || sortedMonthsAsc.length === 0) return [];
    const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    return sortedMonthsAsc.filter(m => {
      const ym = m.monthRaw.substring(0, 7);
      return ym >= start && ym <= end;
    });
  }, [rangeStart, rangeEnd, sortedMonthsAsc]);

  // ACTION 3: Apply Custom Range Interval
  const handleApplyRangeInterval = () => {
    if (rangeMatchedMonths.length === 0 || rangeMatchedMonths.length === sortedMonthsAsc.length) {
      onSelectMonth('all');
    } else {
      const yms = rangeMatchedMonths.map(m => m.monthRaw.substring(0, 7));
      onSelectMonth(yms.join(','));
    }
    setIsOpen(false);
  };

  // ACTION 4: Reset to All
  const handleSelectAll = () => {
    onSelectMonth('all');
    setIsOpen(false);
  };

  // Toggle month for multi-select checkboxes tab
  const toggleMultiMonth = (ym: string) => {
    let nextList: string[];
    if (selectedList.includes(ym)) {
      nextList = selectedList.filter(s => s !== ym);
    } else {
      nextList = [...selectedList, ym];
    }
    if (nextList.length === 0 || nextList.length === sortedMonthsAsc.length) {
      onSelectMonth('all');
    } else {
      onSelectMonth(nextList.join(','));
    }
  };

  // Search filter
  const filteredMonths = sortedMonthsDesc.filter(m => 
    m.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.monthRaw.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-1.5 rounded-xl border transition-all cursor-pointer select-none font-bold ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        } ${
          !isAllSelected
            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs hover:bg-amber-600 font-extrabold'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${!isAllSelected ? 'text-slate-950' : 'text-amber-600'}`} />
          <span className="truncate max-w-[150px] sm:max-w-[200px]">{buttonTitle}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {!isAllSelected && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-black rounded-full bg-slate-950 text-amber-300 shadow-2xs border border-amber-400">
              {selectedList.length}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-fadeIn text-slate-900">
          
          {/* Header Bar */}
          <div className="px-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Вибір періоду аналітики
              </span>
            </div>

            <button
              type="button"
              onClick={handleSelectAll}
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md transition-colors ${
                isAllSelected
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Весь період ({sortedMonthsAsc.length})
            </button>
          </div>

          {/* Navigation Tabs (4 Options) */}
          <div className="px-3 pt-2 pb-1">
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-[10px] font-extrabold">
              {/* Tab 1: Single Month */}
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-white text-slate-950 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Обрати один конкретний місяць"
              >
                <span>Місяць</span>
              </button>

              {/* Tab 2: Presets (3, 6, 9, 12) */}
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                  activeTab === 'presets'
                    ? 'bg-white text-amber-950 shadow-2xs font-black ring-1 ring-amber-300'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
                title="Останні 3, 6, 9, 12 місяців"
              >
                <span className="flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span>Останні N</span>
                </span>
              </button>

              {/* Tab 3: Interval (Start - End) */}
              <button
                type="button"
                onClick={() => setActiveTab('range')}
                className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                  activeTab === 'range'
                    ? 'bg-white text-blue-950 shadow-2xs font-black ring-1 ring-blue-300'
                    : 'text-slate-600 hover:text-blue-800'
                }`}
                title="Інтервал з місяця по місяць"
              >
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5 text-blue-600" />
                  <span>Інтервал</span>
                </span>
              </button>

              {/* Tab 4: Multi Checkboxes */}
              <button
                type="button"
                onClick={() => setActiveTab('multi')}
                className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                  activeTab === 'multi'
                    ? 'bg-white text-slate-950 shadow-2xs font-black ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Обрати декілька окремих місяців чекбоксами"
              >
                <span>Чекбокси</span>
              </button>
            </div>
          </div>

          {/* TAB 1: CONCRETE SINGLE MONTH */}
          {activeTab === 'single' && (
            <div className="p-3 space-y-2">
              <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>1. Оберіть конкретний місяць:</span>
                <span className="text-[10px] text-slate-400 font-normal">клік = миттєвий вибір</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                {sortedMonthsDesc.map((m) => {
                  const ym = m.monthRaw.substring(0, 7);
                  const isSelected = selectedList.length === 1 && selectedList[0] === ym;

                  return (
                    <button
                      key={`single-${m.monthRaw}`}
                      type="button"
                      onClick={() => handleSelectSingleMonth(ym)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-amber-600'}`} />
                        <span>{m.month}</span>
                        <span className="text-[9px] opacity-70 font-mono">({ym})</span>
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold ${
                        isSelected ? 'bg-slate-950 text-amber-300' : 'bg-white text-slate-600 border border-slate-200'
                      }`}>
                        {m.totalComments.toLocaleString('uk-UA')} коментарів
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PRESETS (Останні 3, 6, 9, 12 місяців) */}
          {activeTab === 'presets' && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                2. Оберіть швидкий період "Останні N місяців":
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* 3 months */}
                <button
                  type="button"
                  onClick={() => handleSelectLastNMonths(3)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/70 hover:from-amber-100 hover:to-amber-200/80 border border-amber-300 text-amber-950 transition-all cursor-pointer flex flex-col text-left group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase">Останні 3 місяці</span>
                    <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[10px] text-amber-800 font-bold mt-1">
                    {sortedMonthsAsc.length >= 3 
                      ? `${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 3])} — ${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 1])}`
                      : 'Всі місяці'}
                  </span>
                </button>

                {/* 6 months */}
                <button
                  type="button"
                  onClick={() => handleSelectLastNMonths(6)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/70 hover:from-blue-100 hover:to-blue-200/80 border border-blue-300 text-blue-950 transition-all cursor-pointer flex flex-col text-left group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase">Останні 6 місяців</span>
                    <Clock className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[10px] text-blue-800 font-bold mt-1">
                    {sortedMonthsAsc.length >= 6 
                      ? `${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 6])} — ${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 1])}`
                      : 'Всі місяці'}
                  </span>
                </button>

                {/* 9 months */}
                <button
                  type="button"
                  onClick={() => handleSelectLastNMonths(9)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/70 hover:from-sky-100 hover:to-sky-200/80 border border-sky-300 text-sky-950 transition-all cursor-pointer flex flex-col text-left group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase">Останні 9 місяців</span>
                    <Clock className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[10px] text-sky-800 font-bold mt-1">
                    {sortedMonthsAsc.length >= 9 
                      ? `${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 9])} — ${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 1])}`
                      : 'Всі місяці'}
                  </span>
                </button>

                {/* 12 months */}
                <button
                  type="button"
                  onClick={() => handleSelectLastNMonths(12)}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 hover:from-emerald-100 hover:to-emerald-200/80 border border-emerald-300 text-emerald-950 transition-all cursor-pointer flex flex-col text-left group shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase">Останні 12 місяців</span>
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-[10px] text-emerald-800 font-bold mt-1">
                    {sortedMonthsAsc.length >= 12 
                      ? `${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 12])} — ${formatShortName(sortedMonthsAsc[sortedMonthsAsc.length - 1])}`
                      : 'Всі місяці'}
                  </span>
                </button>
              </div>

              {/* Quarters Selection */}
              {availableQuarters.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Вибір за кварталами:</span>
                    <span className="text-[10px] text-slate-400 font-normal">I, II, III, IV кв.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-0.5">
                    {availableQuarters.map((q) => {
                      const isSelected = matchedQuarterLabel === q.label;
                      return (
                        <button
                          key={`preset-q-${q.label}`}
                          type="button"
                          onClick={() => {
                            onSelectMonth(q.months.join(','));
                            setIsOpen(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          <span>{q.label}</span>
                          <span className="text-[9px] font-mono opacity-80">({q.months.length} міс.)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full period quick reset */}
              <button
                type="button"
                onClick={handleSelectAll}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Скинути до «Весь період» ({sortedMonthsAsc.length} місяців)</span>
              </button>
            </div>
          )}

          {/* TAB 3: INTERVAL "З МІСЯЦЯ ПО МІСЯЦЬ" */}
          {activeTab === 'range' && (
            <div className="p-3 space-y-3">
              <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                3. Оберіть точний інтервал "з місяця по місяць":
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/90">
                {/* Start Month Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-600" />
                    <span>З місяця:</span>
                  </label>
                  <select
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-black rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    {sortedMonthsAsc.map(m => {
                      const ym = m.monthRaw.substring(0, 7);
                      return (
                        <option key={`range-start-${ym}`} value={ym}>
                          {m.month} ({ym})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* End Month Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>По місяць:</span>
                  </label>
                  <select
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-black rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    {sortedMonthsAsc.map(m => {
                      const ym = m.monthRaw.substring(0, 7);
                      return (
                        <option key={`range-end-${ym}`} value={ym}>
                          {m.month} ({ym})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Range Preview Card */}
              <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase text-amber-800">Обраний інтервал:</span>
                  <span className="font-black text-amber-950">
                    {rangeMatchedMonths.length > 0
                      ? `${getMonthLabel(rangeMatchedMonths[0].monthRaw.substring(0, 7))} — ${getMonthLabel(rangeMatchedMonths[rangeMatchedMonths.length - 1].monthRaw.substring(0, 7))}`
                      : 'Немає місяців'}
                  </span>
                </div>
                <span className="px-2 py-1 rounded-lg bg-amber-200/80 text-amber-950 font-black text-xs">
                  {rangeMatchedMonths.length} міс.
                </span>
              </div>

              {/* Single Apply Button */}
              <button
                type="button"
                onClick={handleApplyRangeInterval}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <span>Застосувати цей інтервал</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 4: MULTI CHECKBOXES */}
          {activeTab === 'multi' && (
            <div className="p-3 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Пошук місяця..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-extrabold text-amber-700 hover:underline cursor-pointer"
                >
                  Обрати всі
                </button>
                <span className="text-slate-400">
                  Обрано: <b className="text-slate-900">{isAllSelected ? 'Всі' : selectedList.length}</b>
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                {filteredMonths.map((m) => {
                  const ym = m.monthRaw.substring(0, 7);
                  const checked = selectedList.includes(ym);

                  return (
                    <button
                      key={`multi-${m.monthRaw}`}
                      type="button"
                      onClick={() => toggleMultiMonth(ym)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                        checked
                          ? 'bg-amber-50 text-amber-950 font-black border border-amber-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          checked ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300'
                        }`}>
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{m.month}</span>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono">
                        {m.totalComments.toLocaleString('uk-UA')}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer mt-1"
              >
                Готово
              </button>
            </div>
          )}

          {/* Footer Bar */}
          <div className="px-3.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-bold">
              Поточний фільтр: <b className="text-slate-900">{buttonTitle}</b>
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 font-bold underline cursor-pointer"
            >
              Закрити
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
