import React, { useState } from 'react';
import { FileText, CheckSquare, Square, X, Download, BarChart2, TrendingUp, MapPin, Radio, Layers, Check, SlidersHorizontal } from 'lucide-react';

export interface PdfExportOptions {
  includeKpiSummary: boolean;         // Загальний огляд (KPI + Спідометр)
  includeMonthlyTrends: boolean;       // Динаміка по місяцях (Середня оцінка + Розподіл)
  includeRegionalDemographics: boolean;// Географія (Мапа регіонів + ЮО/ФОП)
  includeSignalsAndTrends: boolean;    // Нові сигнали (30 днів) та зростаючі/спадаючі тренди
  includeCatalogTable: boolean;        // Повний каталог проблем з розгорнутими дочірніми
}

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: PdfExportOptions) => void;
  isLoading?: boolean;
  totalIssuesCount?: number;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  totalIssuesCount = 0
}) => {
  const [options, setOptions] = useState<PdfExportOptions>({
    includeKpiSummary: true,
    includeMonthlyTrends: true,
    includeRegionalDemographics: true,
    includeSignalsAndTrends: true,
    includeCatalogTable: true
  });

  if (!isOpen) return null;

  const toggleOption = (key: keyof PdfExportOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectAll = () => {
    setOptions({
      includeKpiSummary: true,
      includeMonthlyTrends: true,
      includeRegionalDemographics: true,
      includeSignalsAndTrends: true,
      includeCatalogTable: true
    });
  };

  const handleDeselectAll = () => {
    setOptions({
      includeKpiSummary: false,
      includeMonthlyTrends: false,
      includeRegionalDemographics: false,
      includeSignalsAndTrends: false,
      includeCatalogTable: false
    });
  };

  const totalSelected = Object.values(options).filter(Boolean).length;
  const isAllSelected = totalSelected === 5;
  const isNoneSelected = totalSelected === 0;

  const handleStartExport = () => {
    if (isNoneSelected) return;
    onConfirm(options);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-export-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pdf-export-modal-title" className="text-base font-extrabold tracking-tight">
                Налаштування експорту в PDF
              </h2>
              <p className="text-xs text-slate-300">
                Оберіть розділи аналітичного звіту для формування файлу
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action toolbar to select/deselect all */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">
            Обрано розділів: <strong className="text-blue-700 font-bold">{totalSelected}</strong> з 5
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isAllSelected}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                isAllSelected 
                  ? 'text-slate-400 cursor-not-allowed' 
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              Вибрати всі
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={isNoneSelected}
              className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                isNoneSelected 
                  ? 'text-slate-400 cursor-not-allowed' 
                  : 'text-slate-600 bg-slate-200 hover:bg-slate-300'
              }`}
            >
              Зняти всі
            </button>
          </div>
        </div>

        {/* Body: Checkboxes */}
        <div className="p-6 overflow-y-auto space-y-3">
          {/* Section 1: KPI & Satisfaction Gauge */}
          <label 
            onClick={() => toggleOption('includeKpiSummary')}
            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              options.includeKpiSummary 
                ? 'bg-blue-50/60 border-blue-300 shadow-2xs' 
                : 'bg-white border-slate-200 hover:bg-slate-50 opacity-75'
            }`}
          >
            <div className="mt-0.5 text-blue-600 shrink-0">
              {options.includeKpiSummary ? (
                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  Ключові показники (KPI) та Спідометр
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Середня оцінка, кількість фідбеку, ЮО/ФОП розподіл, індекс NPS та темпи росту за 30 днів
              </p>
            </div>
          </label>

          {/* Section 2: Monthly Evolution */}
          <label 
            onClick={() => toggleOption('includeMonthlyTrends')}
            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              options.includeMonthlyTrends 
                ? 'bg-blue-50/60 border-blue-300 shadow-2xs' 
                : 'bg-white border-slate-200 hover:bg-slate-50 opacity-75'
            }`}
          >
            <div className="mt-0.5 text-blue-600 shrink-0">
              {options.includeMonthlyTrends ? (
                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  Помісячні графіки динаміки
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Графіки «Середня оцінка по місяцях» та «Розподіл оцінок по місяцях (позитивні / нейтральні / негативні)»
              </p>
            </div>
          </label>

          {/* Section 3: Regional Map & Demographics */}
          <label 
            onClick={() => toggleOption('includeRegionalDemographics')}
            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              options.includeRegionalDemographics 
                ? 'bg-blue-50/60 border-blue-300 shadow-2xs' 
                : 'bg-white border-slate-200 hover:bg-slate-50 opacity-75'
            }`}
          >
            <div className="mt-0.5 text-blue-600 shrink-0">
              {options.includeRegionalDemographics ? (
                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  Географія та структура фідбеку
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Інтерактивна мапа України з оцінками по областях, динаміка коментарів та кругова діаграма ЮО / ФОП
              </p>
            </div>
          </label>

          {/* Section 4: Signals & Issue Trends */}
          <label 
            onClick={() => toggleOption('includeSignalsAndTrends')}
            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              options.includeSignalsAndTrends 
                ? 'bg-blue-50/60 border-blue-300 shadow-2xs' 
                : 'bg-white border-slate-200 hover:bg-slate-50 opacity-75'
            }`}
          >
            <div className="mt-0.5 text-blue-600 shrink-0">
              {options.includeSignalsAndTrends ? (
                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  Нові сигнали (30 днів) та Тренди
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Картки щойно зафіксованих сигналів бізнесу + рейтинги проблем із найбільшим зростанням і спадом
              </p>
            </div>
          </label>

          {/* Section 5: Full Catalog Table with Expanded Children */}
          <label 
            onClick={() => toggleOption('includeCatalogTable')}
            className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              options.includeCatalogTable 
                ? 'bg-blue-50/60 border-blue-300 shadow-2xs' 
                : 'bg-white border-slate-200 hover:bg-slate-50 opacity-75'
            }`}
          >
            <div className="mt-0.5 text-blue-600 shrink-0">
              {options.includeCatalogTable ? (
                <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  Повний каталог проблем з усіма дочірніми сигналами
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Детальний реєстр проблем ({totalIssuesCount} шт.) з повністю розкритими дочірніми механізмами, частками (%) та кількістю згадок
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleStartExport}
            disabled={isNoneSelected || isLoading}
            className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              isNoneSelected || isLoading
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Сформувати та завантажити PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
