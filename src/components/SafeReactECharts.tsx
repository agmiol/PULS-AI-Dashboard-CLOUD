import React, { useEffect, useRef, useState, forwardRef } from 'react';
import ReactECharts from 'echarts-for-react';

export interface SafeReactEChartsProps {
  option: any;
  style?: React.CSSProperties;
  className?: string;
  onEvents?: Record<string, any>;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  theme?: string | object;
  opts?: {
    devicePixelRatio?: number;
    renderer?: 'canvas' | 'svg';
    width?: number | string | 'auto';
    height?: number | string | 'auto';
    locale?: string;
  };
  isPdfExportMode?: boolean;
}

export const SafeReactECharts = forwardRef<any, SafeReactEChartsProps>(({ isPdfExportMode, className, ...echartsProps }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkDimensions = () => {
      if (el.clientWidth > 0 || el.clientHeight > 0 || isPdfExportMode) {
        setIsReady(true);
      }
    };

    checkDimensions();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        setIsReady(true);
      });
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      const timer = setTimeout(checkDimensions, 100);
      return () => clearTimeout(timer);
    }
  }, [isPdfExportMode]);

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[1px] ${className || ''}`}>
      {isReady || isPdfExportMode ? (
        <ReactECharts ref={ref} {...echartsProps} />
      ) : null}
    </div>
  );
});

SafeReactECharts.displayName = 'SafeReactECharts';
