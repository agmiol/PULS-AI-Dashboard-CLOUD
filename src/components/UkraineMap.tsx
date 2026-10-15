import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as topojson from 'topojson-client';
import { SafeReactECharts as ReactECharts } from './SafeReactECharts';
import * as echarts from 'echarts';
import { Loader2, Layers, MapPin, Star, TrendingUp, BarChart2 } from 'lucide-react';
import { RegionMapPoint, HromadaStatItem, DashboardFilters } from '../types';

export type MapMetricMode = 'count' | 'avgScore' | 'npsBalance';

// Helper function to linearly interpolate between two hex colors
function interpolateColor(color1Hex: string, color2Hex: string, factor: number): string {
  const f = Math.min(1, Math.max(0, factor));
  const c1 = parseInt(color1Hex.replace('#', ''), 16);
  const c2 = parseInt(color2Hex.replace('#', ''), 16);

  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;

  const r = Math.round(r1 + f * (r2 - r1));
  const g = Math.round(g1 + f * (g2 - g1));
  const b = Math.round(b1 + f * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Average Score Color generator:
// Continuous clean rainbow spectrum gradient from reference image (Red -> Orange -> Pure Yellow -> Green):
// - Red to Pure Yellow (#ff0000 -> #ffdd00): Scores 1.0 to 6.99 (Red & Orange spectrum)
// - Pure Yellow spectrum (#ffdd00 -> #fde047): Scores 7.0 to 8.99 (Yellow spectrum)
// - Green starts at 9.0 (#22c55e -> #15803d): Scores 9.0 to 10.0 (Green spectrum)
export const getAvgScoreColor = (score: number): string => {
  if (!score || score <= 0) return '#f1f5f9';

  if (score >= 9.0) {
    const ratio = Math.min(1, (score - 9.0) / 1.0);
    return interpolateColor('#22c55e', '#15803d', ratio);
  } else if (score >= 7.0) {
    const ratio = Math.min(1, (score - 7.0) / 2.0);
    return interpolateColor('#ffdd00', '#fde047', ratio);
  } else {
    const ratio = Math.max(0, (score - 1.0) / 6.0);
    return interpolateColor('#ff0000', '#ffdd00', ratio);
  }
};

// Score Balance (NPS) Color generator:
// Spectrum aligned with reference scale:
// - Extreme Red (#ff0000) at -30% and below
// - Red -> Orange -> Yellow (#ff0000 -> #ffdd00) between -30% and 0%
// - Yellow -> Green (#ffdd00 -> #22c55e) between 0% and +30%
// - Green -> Emerald (#22c55e -> #15803d) at +30% and above
export const getNpsBalanceColor = (bal: number): string => {
  if (bal === undefined || bal === null) return '#f1f5f9';
  
  if (bal <= -30) {
    return '#ff0000';
  } else if (bal < 0) {
    const ratio = (bal + 30) / 30;
    return interpolateColor('#ff0000', '#ffdd00', ratio);
  } else if (bal < 30) {
    const ratio = bal / 30;
    return interpolateColor('#ffdd00', '#22c55e', ratio);
  } else {
    const ratio = Math.min(1, (bal - 30) / 70);
    return interpolateColor('#22c55e', '#15803d', ratio);
  }
};

interface UkraineMapProps {
  data: RegionMapPoint[];
  hromadaStats?: HromadaStatItem[];
  selectedRegion?: string;
  selectedHromada?: string;
  isMobileOnly?: boolean;
  filters?: DashboardFilters;
  mapMetric?: MapMetricMode;
  onSelectRegion: (regionName: string) => void;
  onSelectHromada?: (katottg: string, hromadaName?: string) => void;
  onGranularityChange?: (granularity: 'oblast' | 'hromada') => void;
  onMetricChange?: (metric: MapMetricMode) => void;
}

// Module-level caching to ensure TopoJSON fetch and map registration happen only once
let hromadasGeoJsonPromise: Promise<any> | null = null;
let registeredGeoJson: any = null;
let registeredOblastLines: any[] = [];

export async function loadAndRegisterHromadasMap(): Promise<any> {
  if (registeredGeoJson) {
    return registeredGeoJson;
  }
  if (!hromadasGeoJsonPromise) {
    hromadasGeoJsonPromise = (async () => {
      const res = await fetch('/assets/geo/ukr_admin3_simplified.json');
      if (!res.ok) {
        throw new Error(`Failed to fetch hromadas topojson: status ${res.status}`);
      }
      const topoData = await res.json();
      const objectKey = topoData.objects.ukr_admin3 ? 'ukr_admin3' : Object.keys(topoData.objects)[0];
      const geoJson = topojson.feature(topoData, topoData.objects[objectKey]) as any;

      if (geoJson && geoJson.features) {
        geoJson.features.forEach((f: any) => {
          if (!f.properties) f.properties = {};
          const p = f.properties;
          const kat = (p.adm3_pcode || p.katottg_short || p.KATOTTG || p.katottg || '').trim();
          const name = p.adm3_name1 || p.adm3_name || p.name || p.NAME_3 || p.HROMADA || kat;
          const oblast = p.adm1_name1 || p.oblast || p.OBLAST || p.NAME_1 || '';

          p.name = kat; // Critical for ECharts series.data[i].name matching
          p.katottg_short = kat;
          p.hromadaName = name;
          p.oblast = oblast;
        });
      }

      const mesh = topojson.mesh(topoData, topoData.objects[objectKey], (a: any, b: any) => {
        const obA = a?.properties?.oblast || a?.properties?.adm1_name1 || a?.properties?.OBLAST || a?.properties?.NAME_1 || '';
        const obB = b?.properties?.oblast || b?.properties?.adm1_name1 || b?.properties?.OBLAST || b?.properties?.NAME_1 || '';
        return obA !== obB;
      });

      registeredOblastLines = (mesh.coordinates || []).map((coords: number[][]) => ({
        coords
      }));

      echarts.registerMap('ukraine_hromadas', geoJson as any);
      registeredGeoJson = geoJson;
      return geoJson;
    })();
  }
  return hromadasGeoJsonPromise;
}

export function matchRegion(r1?: string, r2?: string): boolean {
  if (!r1 || !r2) return false;
  const norm1 = r1.trim().toLowerCase();
  const norm2 = r2.trim().toLowerCase();
  if (norm1 === norm2) return true;

  // Exact distinction between Kyiv City and Kyiv Oblast
  const isKyivCity1 = norm1 === 'київ' || norm1 === 'м. київ' || norm1 === 'м.київ';
  const isKyivCity2 = norm2 === 'київ' || norm2 === 'м. київ' || norm2 === 'м.київ';
  if (isKyivCity1 || isKyivCity2) {
    return isKyivCity1 && isKyivCity2;
  }

  const isKyivOblast1 = norm1.includes('київська');
  const isKyivOblast2 = norm2.includes('київська');
  if (isKyivOblast1 || isKyivOblast2) {
    return isKyivOblast1 && isKyivOblast2;
  }

  // Exact distinction between Sevastopol and Crimea
  const isSevastopol1 = norm1.includes('севастополь');
  const isSevastopol2 = norm2.includes('севастополь');
  if (isSevastopol1 || isSevastopol2) {
    return isSevastopol1 && isSevastopol2;
  }

  const clean1 = norm1.replace(/область|обл\.|м\.|автономна республіка/g, '').trim();
  const clean2 = norm2.replace(/область|обл\.|м\.|автономна республіка/g, '').trim();
  return clean1 === clean2;
}

// Ukraine Oblast SVG Paths (schematic accurate geographic relative layout for Ukraine map)
const OBLAST_PATHS: { id: string; name: string; displayName?: string; iso?: string; path: string; labelX: number; labelY: number }[] = [
  { id: "UA-30", name: "Київ", displayName: "м. Київ", iso: "UA-30", labelX: 520, labelY: 171, path: "M 510,138 L 520,139 L 530,143 L 539,148 L 540,158 L 535,168 L 525,178 L 515,176 L 506,168 L 501,157 L 503,147 L 508,140 Z" },
  { id: "UA-32", name: "Київська", iso: "UA-32", labelX: 520, labelY: 125, path: "M 460,110 L 550,100 L 570,140 L 550,210 L 480,200 L 450,150 Z" },
  { id: "UA-74", name: "Чернігівська", iso: "UA-74", labelX: 570, labelY: 80, path: "M 520,30 L 610,40 L 620,110 L 550,110 L 510,70 Z" },
  { id: "UA-59", name: "Сумська", iso: "UA-59", labelX: 680, labelY: 90, path: "M 620,40 L 740,60 L 730,130 L 630,120 Z" },
  { id: "UA-63", name: "Харківська", iso: "UA-63", labelX: 740, labelY: 170, path: "M 690,130 L 800,140 L 810,220 L 700,210 Z" },
  { id: "UA-12", name: "Дніпропетровська", iso: "UA-12", labelX: 680, labelY: 250, path: "M 600,210 L 730,220 L 750,290 L 620,290 Z" },
  { id: "UA-53", name: "Полтавська", iso: "UA-53", labelX: 620, labelY: 165, path: "M 560,130 L 680,130 L 680,210 L 570,210 Z" },
  { id: "UA-71", name: "Черкаська", iso: "UA-71", labelX: 500, labelY: 215, path: "M 460,190 L 560,190 L 550,250 L 450,230 Z" },
  { id: "UA-35", name: "Кіровоградська", iso: "UA-35", labelX: 530, labelY: 270, path: "M 480,240 L 610,240 L 600,300 L 470,290 Z" },
  { id: "UA-05", name: "Вінницька", iso: "UA-05", labelX: 410, labelY: 220, path: "M 360,180 L 460,190 L 460,260 L 370,250 Z" },
  { id: "UA-18", name: "Житомирська", iso: "UA-18", labelX: 420, labelY: 125, path: "M 370,80 L 470,90 L 460,180 L 360,170 Z" },
  { id: "UA-56", name: "Рівненська", iso: "UA-56", labelX: 310, labelY: 110, path: "M 270,70 L 370,80 L 360,160 L 270,150 Z" },
  { id: "UA-07", name: "Волинська", iso: "UA-07", labelX: 210, labelY: 100, path: "M 160,60 L 270,70 L 260,150 L 160,140 Z" },
  { id: "UA-46", name: "Львівська", iso: "UA-46", labelX: 180, labelY: 180, path: "M 120,140 L 240,150 L 230,230 L 120,210 Z" },
  { id: "UA-61", name: "Тернопільська", iso: "UA-61", labelX: 280, labelY: 200, path: "M 240,160 L 310,160 L 300,240 L 240,230 Z" },
  { id: "UA-26", name: "Івано-Франківська", iso: "UA-26", labelX: 200, labelY: 260, path: "M 150,220 L 240,230 L 230,300 L 150,280 Z" },
  { id: "UA-21", name: "Закарпатська", iso: "UA-21", labelX: 110, labelY: 260, path: "M 60,220 L 150,230 L 140,290 L 60,270 Z" },
  { id: "UA-73", name: "Чернівецька", iso: "UA-73", labelX: 280, labelY: 270, path: "M 240,240 L 320,250 L 310,290 L 240,280 Z" },
  { id: "UA-68", name: "Хмельницька", iso: "UA-68", labelX: 335, labelY: 190, path: "M 310,160 L 370,160 L 360,240 L 310,240 Z" },
  { id: "UA-51", name: "Одеська", iso: "UA-51", labelX: 430, labelY: 330, path: "M 380,260 L 480,270 L 460,420 L 380,380 Z" },
  { id: "UA-48", name: "Миколаївська", iso: "UA-48", labelX: 520, labelY: 330, path: "M 480,280 L 570,290 L 560,360 L 470,350 Z" },
  { id: "UA-65", name: "Херсонська", iso: "UA-65", labelX: 610, labelY: 350, path: "M 560,320 L 680,320 L 670,390 L 560,390 Z" },
  { id: "UA-23", name: "Запорізька", iso: "UA-23", labelX: 720, labelY: 310, path: "M 660,280 L 780,280 L 770,350 L 650,340 Z" },
  { id: "UA-14", name: "Донецька", path: "M 760,210 L 860,210 L 850,300 L 750,290 Z", labelX: 810, labelY: 250 },
  { id: "UA-44", name: "Луганська", path: "M 800,130 L 910,130 L 900,220 L 800,210 Z", labelX: 860, labelY: 180 },
  { id: "UA-43", name: "Автономна Республіка Крим", displayName: "АР Крим", path: "M 630,390 L 725,390 L 710,460 L 630,450 Z", labelX: 680, labelY: 420 },
  { id: "UA-40", name: "Севастополь", displayName: "м. Севастополь", path: "M 595,425 L 630,425 L 630,460 L 595,460 Z", labelX: 612, labelY: 445 }
];

export const UkraineMap: React.FC<UkraineMapProps> = ({
  data,
  hromadaStats,
  selectedRegion,
  selectedHromada,
  isMobileOnly = false,
  filters,
  mapMetric: propMapMetric,
  onSelectRegion,
  onSelectHromada,
  onGranularityChange,
  onMetricChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<any>(null);
  const zoomRef = useRef<number | null>(null);
  const centerRef = useRef<[number, number] | null>(null);
  
  // Local state for Geo map mode: 'oblast' or 'hromada'
  const [geoMode, setGeoMode] = useState<'oblast' | 'hromada'>(filters?.granularity || 'oblast');
  const [isLoadingGeo, setIsLoadingGeo] = useState<boolean>(false);
  const [hromadaGeoJson, setHromadaGeoJson] = useState<any | null>(registeredGeoJson);
  const [localHromadaStats, setLocalHromadaStats] = useState<HromadaStatItem[]>([]);

  // Map metric state: 'count' | 'avgScore' | 'npsBalance'
  const [mapMetric, setMapMetric] = useState<MapMetricMode>(propMapMetric || 'count');

  useEffect(() => {
    if (propMapMetric && propMapMetric !== mapMetric) {
      setMapMetric(propMapMetric);
    }
  }, [propMapMetric]);

  const handleMetricChange = (metric: MapMetricMode) => {
    setMapMetric(metric);
    if (onMetricChange) {
      onMetricChange(metric);
    }
  };

  const [hoveredRegion, setHoveredRegion] = useState<{
    name: string;
    fullName: string;
    point?: RegionMapPoint;
    x: number;
    y: number;
  } | null>(null);

  // Load and register Hromadas TopoJSON upon mode switch
  const handleSwitchMode = async (mode: 'oblast' | 'hromada') => {
    setGeoMode(mode);
    if (onGranularityChange) {
      onGranularityChange(mode);
    }
    if (mode === 'hromada' && !registeredGeoJson) {
      setIsLoadingGeo(true);
      try {
        const gJson = await loadAndRegisterHromadasMap();
        setHromadaGeoJson(gJson);
      } catch (err) {
        console.error('[UkraineMap] Error loading hromada map:', err);
      } finally {
        setIsLoadingGeo(false);
      }
    }
  };

  // Fetch or update hromada stats when hromada mode is selected
  useEffect(() => {
    if (geoMode === 'hromada') {
      if (hromadaStats && hromadaStats.length > 0) {
        setLocalHromadaStats(hromadaStats);
      } else {
        fetch('/api/dashboard/regional-stats?granularity=hromada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filters || {})
        })
          .then(res => {
            if (res.status === 429) return null;
            return res.json();
          })
          .then(resData => {
            if (resData && resData.items) {
              setLocalHromadaStats(resData.items);
            }
          })
          .catch(err => console.error('[UkraineMap] Failed to fetch hromada stats:', err));
      }
    }
  }, [geoMode, hromadaStats, filters]);

  // Max count for color intensity calculation in oblast mode
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Helper to parse selected regions
  const selectedList = useMemo(() => {
    if (!selectedRegion || selectedRegion === 'all') return [];
    return selectedRegion.split(',').map(s => s.trim()).filter(Boolean);
  }, [selectedRegion]);

  const isAnyRegionSelected = selectedList.length > 0;

  const isRegionSelected = (oblastName: string, displayName?: string) => {
    if (!isAnyRegionSelected) return false;
    return selectedList.some(sel => matchRegion(sel, oblastName) || matchRegion(sel, displayName));
  };

  const findDataPoint = (oblastName: string, displayName?: string) => {
    return data.find(d => matchRegion(d.oblast, oblastName) || matchRegion(d.fullName, displayName) || matchRegion(d.fullName, oblastName));
  };

  // Helper to get color shade based on selection & selected metric in oblast mode
  const getFillColor = (oblastName: string, displayName?: string) => {
    const isSelected = isRegionSelected(oblastName, displayName);
    if (isSelected) {
      return '#f59e0b'; // Vibrant amber-orange highlight for active selected region
    }

    const point = findDataPoint(oblastName, displayName);
    if (!point || point.count === 0) {
      return '#f1f5f9';
    }

    if (mapMetric === 'count') {
      const ratio = Math.min(1, point.count / maxCount);
      if (ratio > 0.7) return '#0d9488';
      if (ratio > 0.4) return '#14b8a6';
      if (ratio > 0.2) return '#2dd4bf';
      if (ratio > 0.05) return '#99f6e4';
      return '#ccfbf1';
    } else if (mapMetric === 'avgScore') {
      return getAvgScoreColor(point.avgScore ?? 0);
    } else { // mapMetric === 'npsBalance'
      return getNpsBalanceColor(point.npsBalance ?? 0);
    }
  };

  const handleRegionClick = (name: string, displayName?: string) => {
    const targetName = name;
    let nextList: string[];
    const isCurrentlySelected = selectedList.some(sel => matchRegion(sel, targetName) || matchRegion(sel, displayName));

    if (isCurrentlySelected) {
      nextList = selectedList.filter(sel => !matchRegion(sel, targetName) && !matchRegion(sel, displayName));
    } else {
      nextList = [...selectedList, targetName];
    }

    if (nextList.length === 0 || nextList.length === OBLAST_PATHS.length) {
      onSelectRegion('all');
    } else {
      onSelectRegion(nextList.join(','));
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, name: string, displayName?: string) => {
    const point = findDataPoint(name, displayName);
    const fullName = point ? point.fullName : (displayName || (name === 'Київ' ? 'м. Київ' : name === 'Севастополь' ? 'м. Севастополь' : `${name} область`));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHoveredRegion({ name, fullName, point, x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !hoveredRegion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHoveredRegion(prev => prev ? { ...prev, x, y } : null);
  };

  const handleMouseLeave = () => {
    setHoveredRegion(null);
  };

  const handleTouchStart = (e: React.TouchEvent, name: string, displayName?: string) => {
    const point = findDataPoint(name, displayName);
    const fullName = point ? point.fullName : (displayName || (name === 'Київ' ? 'м. Київ' : name === 'Севастополь' ? 'м. Севастополь' : `${name} область`));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch ? touch.clientX - rect.left : 0;
    const y = touch ? touch.clientY - rect.top : 0;

    setHoveredRegion({ name, fullName, point, x, y });
    handleRegionClick(name, displayName);
  };

  const handleHromadaMapClick = useCallback((params: any) => {
    const chart = echartsRef.current?.getEchartsInstance();
    if (chart) {
      const opt = chart.getOption();
      if (opt && opt.geo && opt.geo[0]) {
        const cz = opt.geo[0].zoom;
        const cc = opt.geo[0].center;
        if (cz != null) zoomRef.current = cz;
        if (cc != null) centerRef.current = cc;
      }
    }

    const d = params.data || {};
    const p = params.properties || {};
    const kat = d.katottg_short || p.katottg_short || p.adm3_pcode || '';
    const name = d.hromadaName || p.hromadaName || p.adm3_name1 || p.adm3_name || params.name || '';
    const oblast = d.oblast || p.oblast || p.adm1_name1 || '';

    let displayName = name;
    if (oblast && !displayName.includes('(')) {
      displayName = `${name} (${oblast})`;
    }

    if (kat) {
      if (onSelectHromada) {
        onSelectHromada(kat, displayName);
      } else {
        onSelectRegion(kat);
      }
    }
  }, [onSelectHromada, onSelectRegion]);

  const echartsOnEvents = useMemo(() => ({
    click: handleHromadaMapClick,
    georoam: () => {
      const chart = echartsRef.current?.getEchartsInstance();
      if (chart) {
        const opt = chart.getOption();
        if (opt && opt.geo && opt.geo[0]) {
          const currentZoom = opt.geo[0].zoom;
          const currentCenter = opt.geo[0].center;
          if (currentZoom != null) zoomRef.current = currentZoom;
          if (currentCenter != null) centerRef.current = currentCenter;
        }
      }
    }
  }), [handleHromadaMapClick]);

  const activeSelectedHromada = useMemo(() => {
    return selectedHromada || filters?.selectedHromada || null;
  }, [selectedHromada, filters?.selectedHromada]);

  useEffect(() => {
    if (!activeSelectedHromada) {
      const chart = echartsRef.current?.getEchartsInstance();
      if (chart) {
        try {
          chart.dispatchAction({ type: 'unselect', seriesIndex: 0, all: true });
          chart.dispatchAction({ type: 'geoUnSelect', geoIndex: 0, all: true });
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [activeSelectedHromada]);

  const selectedHromadaDisplay = useMemo(() => {
    if (!activeSelectedHromada) return '';
    if (filters?.selectedHromadaName && filters.selectedHromadaName !== activeSelectedHromada && filters.selectedHromadaName.includes('(')) {
      return filters.selectedHromadaName;
    }
    if (hromadaGeoJson?.features) {
      const feat = hromadaGeoJson.features.find((f: any) => {
        const p = f.properties || {};
        const k = (p.katottg_short || p.adm3_pcode || p.KATOTTG || p.katottg || '').trim();
        return k === activeSelectedHromada;
      });
      if (feat) {
        const p = feat.properties || {};
        const name = p.hromadaName || p.adm3_name1 || p.adm3_name || activeSelectedHromada;
        const oblast = p.oblast || p.adm1_name1 || '';
        return oblast && !name.includes('(') ? `${name} (${oblast})` : name;
      }
    }
    if (filters?.selectedHromadaName && filters.selectedHromadaName !== activeSelectedHromada) {
      return filters.selectedHromadaName;
    }
    return activeSelectedHromada;
  }, [activeSelectedHromada, filters?.selectedHromadaName, hromadaGeoJson]);

  // Compute geographical centroid for the selected hromada feature to position high-z badge label
  const selectedFeatureCentroid = useMemo(() => {
    if (!activeSelectedHromada || !hromadaGeoJson?.features) return null;
    const feat = hromadaGeoJson.features.find((f: any) => {
      const p = f.properties || {};
      const k = (p.katottg_short || p.adm3_pcode || p.KATOTTG || p.katottg || '').trim();
      return k === activeSelectedHromada;
    });
    if (!feat || !feat.geometry) return null;
    const geom = feat.geometry;
    let sumX = 0, sumY = 0, count = 0;
    const processRing = (ring: number[][]) => {
      for (const pt of ring) {
        if (Array.isArray(pt) && pt.length >= 2) {
          sumX += pt[0];
          sumY += pt[1];
          count++;
        }
      }
    };
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) processRing(ring);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) processRing(ring);
      }
    }
    if (count === 0) return null;
    return [sumX / count, sumY / count] as [number, number];
  }, [activeSelectedHromada, hromadaGeoJson]);

  // Continuous sampled color stops for ECharts visualMap
  const avgScoreColorStops = useMemo(() => {
    const stops: string[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const val = 1 + (i / steps) * 9;
      stops.push(getAvgScoreColor(val));
    }
    return stops;
  }, []);

  const npsBalanceColorStops = useMemo(() => {
    const stops: string[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const val = -100 + (i / steps) * 200;
      stops.push(getNpsBalanceColor(val));
    }
    return stops;
  }, []);

  // Prepare ECharts Option for Hromadas Mode
  const hromadaEchartsOption = useMemo(() => {
    if (!hromadaGeoJson || !hromadaGeoJson.features) return null;

    const statsMap = new Map<string, HromadaStatItem>();
    (hromadaStats || []).forEach(s => statsMap.set(s.katottg_short, s));
    (localHromadaStats || []).forEach(s => statsMap.set(s.katottg_short, s));

    const features = hromadaGeoJson.features || [];
    let maxCount = 0;

    const hromadaNameMap = new Map<string, string>();
    features.forEach((f: any) => {
      const props = f.properties || {};
      const katottg = props.katottg_short || (props.adm3_pcode || props.KATOTTG || props.katottg || '').trim();
      const name = props.hromadaName || props.adm3_name1 || props.adm3_name || katottg;
      const oblast = props.oblast || props.adm1_name1 || '';
      const displayName = oblast && !name.includes('(') ? `${name} (${oblast})` : name;
      if (katottg) hromadaNameMap.set(katottg, displayName);

      const stat = statsMap.get(katottg);
      if (stat && stat.count > maxCount) {
        maxCount = stat.count;
      }
    });

    const maxLogVal = Math.log10(maxCount + 1);

    const seriesData = features.map((f: any) => {
      const props = f.properties || {};
      const katottg = props.katottg_short || (props.adm3_pcode || props.KATOTTG || props.katottg || '').trim();
      const name = props.hromadaName || props.adm3_name1 || props.adm3_name || katottg;
      const oblast = props.oblast || props.adm1_name1 || '';
      const stat = statsMap.get(katottg);
      const count = stat ? stat.count : 0;
      const avgScore = stat ? stat.avg_score : 0;
      const npsBalance = stat ? (stat.nps_balance ?? 0) : 0;

      let metricVal: number | undefined = undefined;
      if (count > 0) {
        if (mapMetric === 'count') {
          metricVal = Math.log10(count + 1);
        } else if (mapMetric === 'avgScore') {
          metricVal = avgScore;
        } else if (mapMetric === 'npsBalance') {
          metricVal = npsBalance;
        }
      }

      const isSelected = !!activeSelectedHromada && (activeSelectedHromada === katottg);

      const item: any = {
        name: katottg, // MUST match feature name
        value: isSelected ? undefined : metricVal,
        katottg_short: katottg,
        hromadaName: name,
        oblast: oblast,
        count: count,
        avgScore: avgScore,
        npsBalance: npsBalance,
        commentsCount: stat ? stat.comments_count : 0,
        fopCount: stat ? stat.fop_count : 0,
        legalCount: stat ? stat.legal_count : 0,
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: {
            areaColor: isSelected ? '#d97706' : '#f59e0b',
            borderColor: isSelected ? '#7c2d12' : '#b45309',
            borderWidth: 2
          }
        },
        select: {
          disabled: true,
          label: { show: false },
          itemStyle: {
            areaColor: isSelected ? '#f59e0b' : undefined,
            borderColor: isSelected ? '#b45309' : undefined,
            borderWidth: isSelected ? 2 : undefined
          }
        }
      };

      if (isSelected) {
        item.itemStyle = {
          areaColor: '#f59e0b',
          borderColor: '#b45309',
          borderWidth: 2
        };
      }

      return item;
    });

    return {
      geo: {
        map: 'ukraine_hromadas',
        roam: true,
        selectedMode: false,
        select: {
          disabled: true,
          label: { show: false },
          itemStyle: {
            areaColor: '#f59e0b',
            borderColor: '#b45309',
            borderWidth: 2
          }
        },
        ...(zoomRef.current != null ? { zoom: zoomRef.current } : {}),
        ...(centerRef.current != null ? { center: centerRef.current } : {}),
        scaleLimit: { min: 0.8, max: 12 },
        label: {
          show: false
        },
        itemStyle: {
          borderColor: '#94a3b8',
          borderWidth: 0.2,
          areaColor: '#f8fafc'
        },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: '#f59e0b', borderColor: '#b45309', borderWidth: 1 }
        },
        regions: activeSelectedHromada ? [
          {
            name: activeSelectedHromada,
            itemStyle: {
              areaColor: '#f59e0b',
              borderColor: '#b45309',
              borderWidth: 2.5
            },
            emphasis: {
              itemStyle: {
                areaColor: '#d97706',
                borderColor: '#7c2d12',
                borderWidth: 2.5
              }
            },
            select: {
              disabled: true,
              itemStyle: {
                areaColor: '#f59e0b',
                borderColor: '#b45309',
                borderWidth: 2.5
              }
            }
          }
        ] : [],
        z: 2
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#ffffff', fontSize: 12 },
        extraCssText: 'border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); backdrop-filter: blur(8px);',
        formatter: (params: any) => {
          if (params.seriesType === 'lines' || params.seriesType === 'scatter') return '';
          const d = params.data || {};
          const p = params.properties || {};
          const name = d.hromadaName || p.hromadaName || p.adm3_name1 || 'Територіальна громада';
          const oblast = d.oblast || p.oblast || p.adm1_name1 || '';
          const kat = d.katottg_short || p.katottg_short || p.adm3_pcode || '';
          const count = d.count ?? 0;
          const avgScore = d.avgScore != null ? Number(d.avgScore).toFixed(2) : '0.00';
          const npsBal = d.npsBalance != null ? Number(d.npsBalance).toFixed(1) : '0.0';
          const comments = d.commentsCount ?? 0;
          const fop = d.fopCount ?? 0;
          const legal = d.legalCount ?? 0;

          const isCountActive = mapMetric === 'count';
          const isScoreActive = mapMetric === 'avgScore';
          const isBalActive = mapMetric === 'npsBalance';

          return `
            <div style="font-family: system-ui, -apple-system, sans-serif;">
              <div style="font-weight: 800; color: #fcd34d; font-size: 13px; margin-bottom: 2px;">
                ${name} ${oblast ? `<span style="color: #cbd5e1; font-weight: 500;">(${oblast})</span>` : ''}
              </div>
              ${kat ? `<div style="font-size: 10px; color: #94a3b8; font-family: monospace; margin-bottom: 6px;">КАТОТТГ: ${kat}</div>` : ''}
              <div style="border-top: 1px solid #334155; padding-top: 6px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px; font-size: 11px;">
                <div style="display: flex; justify-content: space-between; gap: 16px; ${isCountActive ? 'background: rgba(251,191,36,0.2); padding: 2px 4px; border-radius: 4px;' : ''}">
                  <span style="color: #94a3b8;">Кількість оцінок:</span>
                  <b style="color: #ffffff;">${count.toLocaleString('uk-UA')}</b>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; ${isScoreActive ? 'background: rgba(251,191,36,0.2); padding: 2px 4px; border-radius: 4px;' : ''}">
                  <span style="color: #94a3b8;">Середній бал:</span>
                  <b style="color: #fbbf24;">⭐ ${avgScore} / 10</b>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; ${isBalActive ? 'background: rgba(251,191,36,0.2); padding: 2px 4px; border-radius: 4px;' : ''}">
                  <span style="color: #94a3b8;">Баланс оцінок:</span>
                  <b style="${Number(npsBal) >= 0 ? 'color: #34d399;' : 'color: #f87171;'}">${Number(npsBal) > 0 ? `+${npsBal}%` : `${npsBal}%`}</b>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #94a3b8;">Кількість коментарів:</span>
                  <b style="color: #7dd3fc;">💬 ${comments.toLocaleString('uk-UA')}</b>
                </div>
                ${(fop > 0 || legal > 0) ? `
                <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 2px; padding-top: 4px; border-top: 1px dashed #334155; font-size: 10px; color: #cbd5e1;">
                  <span>🏢 ЮО: ${legal}</span>
                  <span>👤 ФОП: ${fop}</span>
                </div>
                ` : ''}
              </div>
            </div>
          `;
        }
      },
      visualMap: mapMetric === 'count' ? {
        seriesIndex: 0,
        min: 0,
        max: Math.max(maxLogVal, 0.1),
        left: 'right',
        bottom: '2%',
        text: [maxCount > 0 ? `${maxCount.toLocaleString('uk-UA')}` : 'Макс', '0'],
        formatter: (val: number) => {
          const count = Math.max(0, Math.round(Math.pow(10, val) - 1));
          return count.toLocaleString('uk-UA');
        },
        realtime: true,
        calculable: true,
        show: true,
        inRange: {
          color: ['#f1f5f9', '#dcfce7', '#a7f3d0', '#2dd4bf', '#14b8a6', '#0d9488', '#047857']
        },
        outOfRange: {
          color: '#f59e0b'
        },
        textStyle: { color: '#475569', fontSize: 10, fontWeight: 'bold' }
      } : mapMetric === 'avgScore' ? {
        seriesIndex: 0,
        min: 1,
        max: 10,
        left: 'right',
        bottom: '2%',
        text: ['10.0 (Висока)', '1.0 (Низька)'],
        formatter: (val: number) => val.toFixed(1),
        realtime: true,
        calculable: true,
        show: true,
        inRange: {
          color: avgScoreColorStops
        },
        outOfRange: {
          color: '#f59e0b'
        },
        textStyle: { color: '#475569', fontSize: 10, fontWeight: 'bold' }
      } : {
        seriesIndex: 0,
        min: -100,
        max: 100,
        left: 'right',
        bottom: '2%',
        text: ['+100%', '-100%'],
        formatter: (val: number) => (val > 0 ? `+${Math.round(val)}%` : `${Math.round(val)}%`),
        realtime: true,
        calculable: true,
        show: true,
        inRange: {
          color: npsBalanceColorStops
        },
        outOfRange: {
          color: '#f59e0b'
        },
        textStyle: { color: '#475569', fontSize: 10, fontWeight: 'bold' }
      },
      series: [
        {
          name: 'Громади України',
          type: 'map',
          geoIndex: 0,
          selectedMode: false,
          select: {
            disabled: true,
            label: { show: false },
            itemStyle: {
              areaColor: '#f59e0b',
              borderColor: '#b45309',
              borderWidth: 2
            }
          },
          label: { show: false },
          emphasis: {
            label: { show: false }
          },
          data: seriesData
        },
        ...(registeredOblastLines && registeredOblastLines.length > 0 ? [
          {
            type: 'lines',
            coordinateSystem: 'geo',
            geoIndex: 0,
            polyline: true,
            data: registeredOblastLines,
            silent: true,
            lineStyle: {
              color: '#1e293b',
              width: 1.8,
              opacity: 0.85
            },
            z: 5
          }
        ] : []),
        ...(selectedFeatureCentroid && selectedHromadaDisplay ? [
          {
            type: 'scatter',
            coordinateSystem: 'geo',
            geoIndex: 0,
            data: [
              {
                name: selectedHromadaDisplay,
                value: [...selectedFeatureCentroid, 1]
              }
            ],
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: {
              color: '#d97706',
              borderColor: '#ffffff',
              borderWidth: 1.5
            },
            label: {
              show: true,
              position: 'top',
              formatter: '{b}',
              color: '#451a03',
              fontSize: 11,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              padding: [5, 8],
              borderRadius: 7,
              borderColor: '#d97706',
              borderWidth: 1.5,
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.3)',
              distance: 4
            },
            emphasis: {
              disabled: true
            },
            z: 30
          }
        ] : [])
      ]
    };
  }, [hromadaGeoJson, hromadaStats, localHromadaStats, activeSelectedHromada, selectedFeatureCentroid, selectedHromadaDisplay, mapMetric]);

  // Sort paths so Kyiv City and selected paths render on top
  const sortedPaths = useMemo(() => {
    return [...OBLAST_PATHS].sort((a, b) => {
      const aSel = isRegionSelected(a.name, a.displayName) ? 1 : 0;
      const bSel = isRegionSelected(b.name, b.displayName) ? 1 : 0;
      if (aSel !== bSel) return aSel - bSel;
      if (a.id === "UA-30") return 1;
      if (b.id === "UA-30") return -1;
      return 0;
    });
  }, [selectedList]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col items-center">
      {/* Mode Switcher Tabs Header */}
      <div className="w-full flex items-center justify-between mb-3 flex-wrap gap-2">
        {/* Left: Granularity Switcher ('oblast' vs 'hromada') */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => handleSwitchMode('oblast')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              geoMode === 'oblast'
                ? 'bg-white text-slate-900 shadow-xs font-extrabold border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>По областях</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('hromada')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              geoMode === 'hromada'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {isLoadingGeo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-amber-950" />
            )}
            <span>По територіальних громадах</span>
          </button>
        </div>

        {/* Right: Metric Color Switcher ('count', 'avgScore', 'npsBalance') */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-black px-1.5 hidden sm:inline">
            Показник:
          </span>

          <button
            type="button"
            onClick={() => handleMetricChange('count')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
              mapMetric === 'count'
                ? 'bg-white text-emerald-800 shadow-xs font-extrabold border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Забарвлювати карту за кількістю оцінок"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Кількість</span>
          </button>

          <button
            type="button"
            onClick={() => handleMetricChange('avgScore')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
              mapMetric === 'avgScore'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Забарвлювати карту за середньою оцінкою (0-10)"
          >
            <Star className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
            <span>Середня оцінка</span>
          </button>

          <button
            type="button"
            onClick={() => handleMetricChange('npsBalance')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
              mapMetric === 'npsBalance'
                ? 'bg-white text-blue-900 shadow-xs font-extrabold border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            title="Забарвлювати карту за балансом оцінок (+/- %)"
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Баланс оцінок</span>
          </button>
        </div>

        {geoMode === 'hromada' && activeSelectedHromada && (
          <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg font-bold animate-fadeIn">
            <span>Обрано громаду: {selectedHromadaDisplay}</span>
            <button
              onClick={() => onSelectHromada ? onSelectHromada('') : onSelectRegion('all')}
              className="text-amber-700 hover:text-amber-950 ml-1 font-black cursor-pointer"
              title="Скинути вибір громади"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Map Content Container */}
      <div className="relative w-full aspect-[16/10] max-h-[500px]">
        {/* Loading Overlay */}
        {isLoadingGeo && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center rounded-2xl p-4 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-extrabold text-slate-700">
              Завантаження геоданих територіальних громад...
            </span>
          </div>
        )}

        {/* Mode 'hromada': ECharts TopoJSON Interactive Map */}
        {geoMode === 'hromada' ? (
          <div className="w-full h-full min-h-[380px]">
            {hromadaEchartsOption ? (
              <ReactECharts
                ref={echartsRef}
                option={hromadaEchartsOption}
                notMerge={true}
                lazyUpdate={false}
                style={{ height: '100%', width: '100%' }}
                onEvents={echartsOnEvents}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 italic">
                Підготовка інтерактивної карти громад...
              </div>
            )}
          </div>
        ) : (
          /* Mode 'oblast': Ukraine SVG Vector Map */
          <svg
            viewBox="0 0 960 480"
            className="w-full h-full drop-shadow-sm transition-all"
          >
            <g>
              {sortedPaths.map((obs) => {
                const isSelected = isRegionSelected(obs.name, obs.displayName);
                const isKyivCity = obs.id === "UA-30";

                return (
                  <g
                    key={obs.id}
                    className="group cursor-pointer"
                    onClick={() => handleRegionClick(obs.name, obs.displayName)}
                    onTouchStart={(e) => handleTouchStart(e, obs.name, obs.displayName)}
                    onMouseEnter={(e) => handleMouseEnter(e, obs.name, obs.displayName)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <path
                      d={obs.path}
                      fill={getFillColor(obs.name, obs.displayName)}
                      stroke={isSelected ? '#b45309' : isKyivCity ? '#0284c7' : '#0f766e'}
                      strokeWidth={isSelected ? 3.5 : isKyivCity ? 2 : 1.2}
                      className="transition-colors duration-150 hover:stroke-amber-600 hover:stroke-[3]"
                    />

                    {/* Capital Marker Pin for Kyiv City */}
                    {isKyivCity && (
                      <circle
                        cx="520"
                        cy="154"
                        r="3.2"
                        fill={isSelected ? '#7c2d12' : '#ffffff'}
                        stroke={isSelected ? '#ffffff' : '#0284c7'}
                        strokeWidth="1.5"
                        className="pointer-events-none transition-transform group-hover:scale-125"
                      />
                    )}

                    <text
                      x={obs.labelX}
                      y={obs.labelY}
                      textAnchor="middle"
                      className={`select-none transition-all ${
                        isSelected
                          ? 'text-[11px] font-black fill-slate-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]'
                          : isKyivCity
                          ? 'text-[10px] font-extrabold fill-slate-900 group-hover:fill-sky-900'
                          : 'text-[11px] font-semibold fill-slate-800 group-hover:fill-sky-950'
                      }`}
                    >
                      {obs.displayName || obs.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Floating Tooltip for Oblast Mode on Desktop */}
        {geoMode === 'oblast' && !isMobileOnly && hoveredRegion && (
          <div
            className="hidden lg:block absolute z-30 pointer-events-none bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl border border-slate-700/80 text-xs w-64 backdrop-blur-md transition-all duration-150 ease-out animate-fadeIn"
            style={{
              left: Math.min(Math.max(10, hoveredRegion.x - 128), (containerRef.current?.clientWidth || 300) - 270),
              top: Math.max(10, hoveredRegion.y - 120),
            }}
          >
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700">
              <span className="font-extrabold text-sm text-amber-300 truncate">
                {hoveredRegion.fullName}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
                {hoveredRegion.point?.count ? `${hoveredRegion.point.count} оц.` : 'Немає оцінок'}
              </span>
            </div>

            {hoveredRegion.point ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Середня оцінка:</span>
                  <span className="font-black text-amber-400 flex items-center gap-1">
                    ⭐ {(hoveredRegion.point.avgScore ?? 0).toFixed(2)} / 10
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Баланс оцінок:</span>
                  <span className={`font-black ${(hoveredRegion.point.npsBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(hoveredRegion.point.npsBalance ?? 0) > 0 ? `+${hoveredRegion.point.npsBalance}%` : `${hoveredRegion.point.npsBalance ?? 0}%`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Коментарі:</span>
                  <span className="font-extrabold text-sky-300">
                    💬 {hoveredRegion.point.commentsCount.toLocaleString('uk-UA')}
                  </span>
                </div>
                <div className="text-[10px] text-amber-400/90 font-medium pt-1 border-t border-slate-800 text-center">
                  Клікніть для фільтрації дашборду
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-xs italic">
                Немає зафіксованих оцінок для цього регіону за поточними фільтрами
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map Legend for Oblast Mode */}
      {geoMode === 'oblast' && (
        <div className="mt-2 flex items-center justify-between w-full px-2 text-xs text-slate-500 border-t border-slate-100 pt-2">
          {mapMetric === 'count' ? (
            <>
              <span className="font-medium text-slate-600">Кількість оцінок:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Мін</span>
                <div className="flex items-center gap-0.5">
                  <span className="w-3.5 h-3.5 rounded bg-[#ccfbf1] border border-teal-300" title="До 5%" />
                  <span className="w-3.5 h-3.5 rounded bg-[#99f6e4] border border-teal-300" title="5% - 20%" />
                  <span className="w-3.5 h-3.5 rounded bg-[#2dd4bf] border border-teal-400" title="20% - 40%" />
                  <span className="w-3.5 h-3.5 rounded bg-[#14b8a6] border border-teal-500" title="40% - 70%" />
                  <span className="w-3.5 h-3.5 rounded bg-[#0d9488] border border-teal-600" title="Понад 70%" />
                </div>
                <span className="text-[11px] font-semibold text-teal-800">Макс ({maxCount.toLocaleString('uk-UA')})</span>
              </div>
            </>
          ) : mapMetric === 'avgScore' ? (
            <>
              <span className="font-semibold text-slate-700">Середня оцінка (ESS):</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-rose-700">&lt; 7.0</span>
                  <div className="w-10 h-3 rounded-xs border border-rose-200" style={{ background: 'linear-gradient(to right, #ff0000, #ffdd00)' }} title="Червоний спектр: 1.0 - 6.99 (Червоний -> Жовтий)" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-amber-700">7.0 - 8.9</span>
                  <div className="w-12 h-3 rounded-xs border border-amber-200" style={{ background: 'linear-gradient(to right, #ffdd00, #fde047)' }} title="Жовтий спектр: 7.0 - 8.99" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-emerald-800">9.0 - 10.0</span>
                  <div className="w-10 h-3 rounded-xs border border-emerald-200" style={{ background: 'linear-gradient(to right, #22c55e, #15803d)' }} title="Зелений спектр: 9.0 - 10.0 (Висока оцінка)" />
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-700">Баланс оцінок:</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-rose-700">&le; -30%</span>
                  <div className="w-6 h-3 rounded-xs border border-rose-300 bg-[#ff0000]" title="Крайній червоний (-30% і нижче)" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-rose-600">-30% ... 0%</span>
                  <div className="w-10 h-3 rounded-xs border border-amber-200" style={{ background: 'linear-gradient(to right, #ff0000, #ffdd00)' }} title="Червоний -> Жовтий (-30% ... 0%)" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-amber-600">0% ... +30%</span>
                  <div className="w-10 h-3 rounded-xs border border-amber-200" style={{ background: 'linear-gradient(to right, #ffdd00, #22c55e)' }} title="Жовтий -> Зелений (0% ... +30%)" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold text-emerald-800">&ge; +30%</span>
                  <div className="w-10 h-3 rounded-xs border border-emerald-200" style={{ background: 'linear-gradient(to right, #22c55e, #15803d)' }} title="Зелений -> Смарагдовий (+30% і вище)" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile Details Panel for Oblast Mode */}
      {geoMode === 'oblast' && isMobileOnly && (
        <div className="mt-3 w-full">
          {(() => {
            const activePoint = hoveredRegion?.point || data.find(d => matchRegion(d.oblast, selectedRegion) || matchRegion(d.fullName, selectedRegion));
            const activeName = hoveredRegion ? hoveredRegion.fullName : (activePoint ? activePoint.fullName : (selectedRegion && selectedRegion !== 'all' ? selectedRegion : null));

            if (activeName && activePoint) {
              return (
                <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl border border-slate-700/80 flex flex-col gap-2.5 animate-fadeIn">
                  <div className="pb-2 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                      <h4 className="text-sm font-black text-amber-300 truncate leading-tight">
                        {activePoint.fullName}
                      </h4>
                    </div>
                    <span className="text-[10px] bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-md font-bold shrink-0 border border-amber-400/25">
                      Статистика регіону
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700 text-center flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Середня оцінка</span>
                      <span className="text-amber-400 font-black text-sm flex items-center justify-center gap-1 mt-0.5">
                        ⭐ {(activePoint.avgScore ?? 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700 text-center flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Баланс оцінок</span>
                      <span className={`font-black text-sm block mt-0.5 ${(activePoint.npsBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(activePoint.npsBalance ?? 0) > 0 ? `+${activePoint.npsBalance}%` : `${activePoint.npsBalance ?? 0}%`}
                      </span>
                    </div>

                    <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700 text-center flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Коментарі</span>
                      <span className="text-sky-300 font-black text-sm block mt-0.5">
                        💬 {activePoint.commentsCount.toLocaleString('uk-UA')}
                      </span>
                    </div>

                    <div className="bg-slate-800/90 p-2 rounded-xl border border-slate-700 text-center flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 font-semibold block uppercase">Всього оцінок</span>
                      <span className="text-white font-extrabold text-sm block mt-0.5">
                        {activePoint.count.toLocaleString('uk-UA')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 text-center text-xs text-slate-600 font-medium flex items-center justify-center gap-2 shadow-inner">
                <span className="text-amber-500 font-bold">👉</span>
                <span>Торкніться або наведіть на будь-яку область України для відображення її показників</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

