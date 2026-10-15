import React from 'react';
import { Smartphone, Monitor, Sparkles } from 'lucide-react';

export type MobileViewMode = 'desktop' | 'mobile-responsive';

interface MobileViewSwitcherProps {
  mode: MobileViewMode;
  onChangeMode: (mode: MobileViewMode) => void;
}

export const MobileViewSwitcher: React.FC<MobileViewSwitcherProps> = ({ mode, onChangeMode }) => {
  return (
    <div
      className="py-1.5 px-4 text-xs shadow-2xs print:hidden"
      style={{ background: 'linear-gradient(90deg, #c8ecff 0%, #daf1fe 100%)', borderBottom: '1px solid #b9e4fa' }}
    >
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-900 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-400/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-700" />
            Перемикач Версії
          </span>
          <span className="hidden sm:inline text-slate-700 text-[11px] font-semibold">
            (ПК макет / Адаптивна мобільна версія Full HD)
          </span>
        </div>

        <div className="flex items-center gap-1 bg-white/80 p-1 rounded-lg border border-blue-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => onChangeMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              mode === 'desktop'
                ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-blue-50/80'
            }`}
            title="Повнорозмірний ПК-макет дашборду"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>ПК Версія</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('mobile-responsive')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              mode === 'mobile-responsive'
                ? 'bg-indigo-600 text-white shadow-2xs font-extrabold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-blue-50/80'
            }`}
            title="Мобільна версія у симуляторі Full HD"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Мобільна Версія (Full HD)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
