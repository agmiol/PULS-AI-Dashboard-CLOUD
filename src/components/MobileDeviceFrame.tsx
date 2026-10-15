import React, { useState } from 'react';
import { Smartphone, RotateCw, Sparkles, Check, Info } from 'lucide-react';

interface MobileDeviceFrameProps {
  children: React.ReactNode;
}

export type DevicePresetType = 'fhd-native' | 'fhd-standard' | 'qhd-2k' | 'iphone-pro';

export const MobileDeviceFrame: React.FC<MobileDeviceFrameProps> = ({ children }) => {
  const [deviceSize, setDeviceSize] = useState<DevicePresetType>('fhd-standard');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Width in portrait / landscape based on Device Pixel Ratio (DPR)
  // Full HD = 1080x1920 physical (412x915 CSS viewport @2.625x DPR)
  // Full HD Plus = 1080x2400 physical (412x924 CSS viewport @2.625x DPR)
  // 2K / QHD+ = 1440x3120 physical (480x1040 CSS viewport @3.0x DPR)
  // iPhone 15/16 Pro = 1179x2556 physical (393x852 CSS viewport @3.0x DPR)
  const getViewportWidth = () => {
    if (orientation === 'portrait') {
      switch (deviceSize) {
        case 'fhd-standard':
          return 'w-[412px]'; // Standard FHD 1080x1920
        case 'fhd-native':
          return 'w-[450px]'; // Wide FHD+ 1080x2400
        case 'qhd-2k':
          return 'w-[480px]'; // 2K / QHD 1440x3120
        case 'iphone-pro':
          return 'w-[393px]'; // iPhone 15/16 Pro Super Retina
        default:
          return 'w-[412px]';
      }
    } else {
      switch (deviceSize) {
        case 'fhd-standard':
          return 'w-[915px]';
        case 'fhd-native':
          return 'w-[960px]';
        case 'qhd-2k':
          return 'w-[1040px]';
        case 'iphone-pro':
          return 'w-[852px]';
        default:
          return 'w-[915px]';
      }
    }
  };

  const getPresetLabel = () => {
    switch (deviceSize) {
      case 'fhd-standard':
        return 'Full HD 1080 × 1920 px (Viewport 412 × 915 CSS)';
      case 'fhd-native':
        return 'Full HD+ 1080 × 2400 px (Viewport 450 × 1000 CSS)';
      case 'qhd-2k':
        return '2K / QHD+ 1440 × 3120 px (Viewport 480 × 1040 CSS)';
      case 'iphone-pro':
        return 'Super Retina 1179 × 2556 px (Viewport 393 × 852 CSS)';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 px-2 bg-slate-950 min-h-[80vh] rounded-3xl my-4 border border-slate-800">
      {/* Simulator Control Bar */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-2xl bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-800 mb-6 text-xs gap-3 shadow-lg">
        <div className="flex items-center gap-2 text-slate-200 font-bold">
          <Smartphone className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-amber-400 font-extrabold uppercase tracking-wide">Симулятор Смартфона</span>
          <span className="hidden md:inline-block text-[11px] text-slate-400 font-medium">
            (Матриці 1080×1920 Full HD та вище)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Resolution selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">Роздільність:</span>
            <select
              value={deviceSize}
              onChange={(e) => setDeviceSize(e.target.value as DevicePresetType)}
              className="bg-slate-800 text-amber-300 border border-slate-700 rounded-lg px-2.5 py-1 font-bold text-xs cursor-pointer hover:border-amber-400/50 transition-colors focus:ring-1 focus:ring-amber-400 outline-none"
            >
              <option value="fhd-standard">Full HD (1080 × 1920 px)</option>
              <option value="fhd-native">Full HD+ (1080 × 2400 px)</option>
              <option value="qhd-2k">2K / QHD+ (1440 × 3120 px)</option>
              <option value="iphone-pro">iPhone Retina (1179 × 2556 px)</option>
            </select>
          </div>

          {/* Orientation Toggle */}
          <button
            type="button"
            onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1 rounded-lg transition-all cursor-pointer shadow-sm border border-blue-400/30"
            title="Повернути екран (Книжкова / Альбомна)"
          >
            <RotateCw className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">
              {orientation === 'portrait' ? '1080×1920 (Книжкова)' : '1920×1080 (Альбомна)'}
            </span>
          </button>
        </div>
      </div>

      {/* Screen Specification Info Badge */}
      <div className="mb-3 text-[11px] font-bold text-slate-400 bg-slate-900/90 px-3.5 py-1 rounded-full border border-slate-800 flex items-center gap-2 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Фізична матриця: {getPresetLabel()}</span>
      </div>

      {/* Realistic Smartphone Chassis Frame */}
      <div
        className={`transition-all duration-300 ease-in-out ${getViewportWidth()} bg-slate-900 rounded-[48px] p-4 shadow-2xl border-4 border-slate-700/80 ring-1 ring-slate-800 relative`}
      >
        {/* Dynamic Island / Notch */}
        {orientation === 'portrait' && (
          <div className="w-28 h-4 bg-slate-950 rounded-full mx-auto mb-3 flex items-center justify-center gap-1.5 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-900/80" />
          </div>
        )}

        {/* Screen Viewport Wrapper */}
        <div className="bg-slate-100 rounded-[36px] overflow-hidden max-h-[750px] h-[750px] text-slate-900 border border-slate-800/20 shadow-inner relative flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </div>
        </div>

        {/* Home Indicator Bar */}
        {orientation === 'portrait' && (
          <div className="w-32 h-1 bg-slate-600/60 rounded-full mx-auto mt-3" />
        )}
      </div>
    </div>
  );
};
