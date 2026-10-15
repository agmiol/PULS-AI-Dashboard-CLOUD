import React, { useState } from 'react';
import { RegionMapPoint } from '../types';
import { matchRegion } from './UkraineMap';
import { X, Search, MapPin, MessageSquare, Star, ArrowUpDown, TrendingUp, Check, CheckSquare, RotateCcw } from 'lucide-react';

interface AllRegionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionsMap: RegionMapPoint[];
  selectedRegion?: string;
  onSelectRegion: (regionName: string) => void;
}

type SortField = 'commentsCount' | 'count' | 'avgScore' | 'npsBalance' | 'fullName';

export const AllRegionsModal: React.FC<AllRegionsModalProps> = ({
  isOpen,
  onClose,
  regionsMap,
  selectedRegion,
  onSelectRegion
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('commentsCount');
  const [sortAsc, setSortAsc] = useState(false);

  if (!isOpen) return null;

  const selectedList = (selectedRegion && selectedRegion !== 'all')
    ? selectedRegion.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const isChecked = (oblast: string, fullName: string) => {
    if (selectedList.length === 0) return false;
    return selectedList.some(r => matchRegion(r, oblast) || matchRegion(r, fullName));
  };

  const handleToggle = (oblast: string, fullName: string) => {
    let nextList: string[];
    if (isChecked(oblast, fullName)) {
      nextList = selectedList.filter(r => !matchRegion(r, oblast) && !matchRegion(r, fullName));
    } else {
      nextList = [...selectedList, oblast];
    }
    if (nextList.length === 0 || nextList.length === regionsMap.length) {
      onSelectRegion('all');
    } else {
      onSelectRegion(nextList.join(','));
    }
  };

  const filteredRegions = regionsMap.filter(r =>
    r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.oblast.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedRegions = [...filteredRegions].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined) valA = 0;
    if (valB === undefined) valB = 0;

    if (typeof valA === 'string') {
      const cmp = (valA as string).localeCompare(valB as string, 'uk');
      return sortAsc ? cmp : -cmp;
    }

    const numA = valA as number;
    const numB = valB as number;
    return sortAsc ? numA - numB : numB - numA;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider">
                Дані по регіонам України
              </h2>
              <p className="text-xs text-slate-400">
                {selectedList.length > 0 ? `Обрано: ${selectedList.length} з ${regionsMap.length}` : 'Показано всі регіони'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onSelectRegion('all')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold flex items-center gap-1 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Обрати всі</span>
            </button>
            <button
              onClick={() => onSelectRegion('all')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Скинути</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Пошук області або міста..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider bg-slate-50/80 sticky top-0 z-10">
                <th className="py-2.5 px-3 w-10 text-center">Вибір</th>
                <th className="py-2.5 px-3">#</th>
                <th
                  onClick={() => toggleSort('fullName')}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Регіон</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('commentsCount')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Коментарів</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('avgScore')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Середня оцінка</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('npsBalance')}
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Баланс оцінок</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('count')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Оцінок</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedRegions.map((reg, idx) => {
                const checked = isChecked(reg.oblast, reg.fullName);
                const npsVal = reg.npsBalance ?? 0;

                return (
                  <tr
                    key={reg.oblast}
                    onClick={() => handleToggle(reg.oblast, reg.fullName)}
                    className={`group cursor-pointer transition-colors ${
                      checked ? 'bg-slate-900 text-white font-semibold' : 'hover:bg-slate-50/80 text-slate-700'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <div className={`w-4 h-4 rounded mx-auto flex items-center justify-center border transition-colors ${
                        checked ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-slate-300 bg-white text-transparent'
                      }`}>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 font-mono text-[11px] ${checked ? 'text-slate-400' : 'text-slate-400'}`}>{idx + 1}</td>
                    <td className={`py-2.5 px-3 font-bold flex items-center gap-2 ${checked ? 'text-white' : 'text-slate-900'}`}>
                      <span>{reg.fullName}</span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-extrabold ${checked ? 'text-sky-300' : 'text-sky-700'}`}>
                      <div className="flex items-center justify-end gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{reg.commentsCount.toLocaleString('uk-UA')}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                        checked
                          ? 'bg-slate-800 text-amber-400 border border-slate-700'
                          : reg.avgScore >= 9.0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : reg.avgScore >= 7.0
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <Star className="w-3 h-3 fill-current" />
                        {(reg.avgScore ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-extrabold text-[11px] ${
                        checked
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : npsVal >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <TrendingUp className={`w-3 h-3 ${npsVal >= 0 ? 'text-emerald-500' : 'text-rose-500 rotate-180'}`} />
                        {npsVal > 0 ? `+${(npsVal ?? 0).toFixed(1)}%` : `${(npsVal ?? 0).toFixed(1)}%`}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-semibold ${checked ? 'text-slate-200' : 'text-slate-800'}`}>
                      {reg.count.toLocaleString('uk-UA')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Клікніть на рядок для перемикання галочки вибору регіону</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold transition-all cursor-pointer shadow-xs"
          >
            Готово
          </button>
        </div>

      </div>
    </div>
  );
};
