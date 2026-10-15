import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
  const chartRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => chartRef.current);

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

  useEffect(() => {
    if (isPdfExportMode) {
      const triggerResize = () => {
        if (chartRef.current) {
          const eInstance = chartRef.current.getEchartsInstance?.();
          if (eInstance && typeof eInstance.resize === 'function') {
            eInstance.resize();
          }
        }
      };

      const t1 = setTimeout(triggerResize, 100);
      const t2 = setTimeout(triggerResize, 350);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isPdfExportMode, echartsProps.option]);

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[1px] relative ${className || ''}`}>
      {isReady || isPdfExportMode ? (
        <ReactECharts ref={chartRef} {...echartsProps} />
      ) : null}
    </div>
  );
});

SafeReactECharts.displayName = 'SafeReactECharts';
