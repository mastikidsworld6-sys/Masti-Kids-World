import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import {
  X,
  RefreshCw,
  Minus,
  TrendingUp,
  Square,
  Type as TypeIcon,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import {
  calculateAtrLatest,
  calculateBollingerSeries,
  calculateEmaSeries,
  calculateMacdSeries,
  calculateRsiSeries,
  calculateSmaSeries,
  calculateStochasticLatest,
} from '../lib/marketHubs.ts';
import type { ChartStyle, Timeframe } from '../types/trading.ts';

const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];

const INDICATORS = [
  { id: 'SMA20', label: 'SMA 20' },
  { id: 'EMA20', label: 'EMA 20' },
  { id: 'EMA50', label: 'EMA 50' },
  { id: 'BB', label: 'Bollinger (20,2)' },
  { id: 'RSI', label: 'RSI (14)' },
  { id: 'MACD', label: 'MACD (12,26,9)' },
  { id: 'VOLUME', label: 'Volume' },
];

type DrawTool = 'CURSOR' | 'HLINE' | 'TREND' | 'CHANNEL' | 'FIB' | 'RECT' | 'TEXT';

interface PixelDrawing {
  id: string;
  tool: Exclude<DrawTool, 'CURSOR'>;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
}

export const TradingChart: React.FC = () => {
  const {
    selectedSymbol,
    setSelectedSymbol,
    chartTabs,
    closeChartTab,
    timeframe,
    setTimeframe,
    chartStyle,
    setChartStyle,
    activeIndicators,
    toggleIndicator,
    candles,
    candlesProvider,
    candlesLoading,
    candlesError,
    reloadCandles,
    allSymbols,
    positions,
    pendingOrders,
    setActiveSection,
  } = useTrading();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>('CURSOR');
  const [pixelDrawings, setPixelDrawings] = useState<Record<string, PixelDrawing[]>>({});
  const [draftDraw, setDraftDraw] = useState<PixelDrawing | null>(null);
  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState(false);

  const symSpec = useMemo(
    () => allSymbols.find((s) => s.symbol === selectedSymbol),
    [allSymbols, selectedSymbol]
  );

  const atrLatest = useMemo(() => calculateAtrLatest(candles, 14), [candles]);
  const stochLatest = useMemo(() => calculateStochasticLatest(candles, 14), [candles]);
  const rsiLatest = useMemo(() => {
    const arr = calculateRsiSeries(candles, 14);
    return arr.length > 0 ? arr[arr.length - 1].value : null;
  }, [candles]);

  // Rebuild Lightweight Charts cleanly when candles / chartStyle / indicators / positions change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth || 720,
      height: el.clientHeight || 420,
      layout: {
        background: { color: '#060911' },
        textColor: '#94a3b8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.06)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.06)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(6, 182, 212, 0.45)', labelBackgroundColor: '#0f172a' },
        horzLine: { color: 'rgba(6, 182, 212, 0.45)', labelBackgroundColor: '#0f172a' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.14)',
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.14)',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    if (candles.length > 0) {
      const formatted = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const mainSeries =
        chartStyle === 'CANDLES'
          ? chart.addSeries(CandlestickSeries, {
              upColor: '#10b981',
              downColor: '#ef4444',
              borderUpColor: '#10b981',
              borderDownColor: '#ef4444',
              wickUpColor: '#10b981',
              wickDownColor: '#ef4444',
            })
          : chartStyle === 'BARS'
          ? chart.addSeries(BarSeries, {
              upColor: '#10b981',
              downColor: '#ef4444',
            })
          : chart.addSeries(LineSeries, {
              color: '#22d3ee',
              lineWidth: 2,
            });

      if (chartStyle === 'LINE') {
        mainSeries.setData(formatted.map((b) => ({ time: b.time, value: b.close })));
      } else {
        mainSeries.setData(formatted);
      }

      // Live Bid & Ask Lines
      if (symSpec) {
        mainSeries.createPriceLine({
          price: symSpec.bid,
          color: '#38bdf8',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'BID',
        });
        mainSeries.createPriceLine({
          price: symSpec.ask,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'ASK',
        });
      }

      // Open Position & Pending Order Price Lines + Entry Markers
      const markers: SeriesMarker<Time>[] = [];
      const symPositions = positions.filter((p) => p.symbol === selectedSymbol);
      for (const pos of symPositions) {
        mainSeries.createPriceLine({
          price: pos.entryPrice,
          color: pos.side === 'BUY' ? '#10b981' : '#ef4444',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${pos.side} ${pos.volume} #${pos.ticket}`,
        });
        if (pos.sl > 0) {
          mainSeries.createPriceLine({
            price: pos.sl,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: true,
            title: `SL #${pos.ticket}`,
          });
        }
        if (pos.tp > 0) {
          mainSeries.createPriceLine({
            price: pos.tp,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: true,
            title: `TP #${pos.ticket}`,
          });
        }
        const entryEpoch = Math.floor(new Date(pos.openTime).getTime() / 1000);
        const nearest = formatted.reduce((prev, curr) =>
          Math.abs((curr.time as number) - entryEpoch) < Math.abs((prev.time as number) - entryEpoch)
            ? curr
            : prev
        );
        markers.push({
          time: nearest.time,
          position: pos.side === 'BUY' ? 'belowBar' : 'aboveBar',
          color: pos.side === 'BUY' ? '#10b981' : '#ef4444',
          shape: pos.side === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: `${pos.side} ${pos.volume}`,
        });
      }

      const symOrders = pendingOrders.filter((o) => o.symbol === selectedSymbol);
      for (const ord of symOrders) {
        mainSeries.createPriceLine({
          price: ord.price,
          color: '#8b5cf6',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${ord.orderType} #${ord.ticket}`,
        });
      }

      if (markers.length > 0) {
        markers.sort((a, b) => Number(a.time) - Number(b.time));
        createSeriesMarkers(mainSeries, markers);
      }

      // Overlay Indicators
      if (activeIndicators.includes('SMA20')) {
        const s = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1, priceLineVisible: false });
        s.setData(calculateSmaSeries(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (activeIndicators.includes('EMA20')) {
        const s = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, priceLineVisible: false });
        s.setData(calculateEmaSeries(candles, 20).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (activeIndicators.includes('EMA50')) {
        const s = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, priceLineVisible: false });
        s.setData(calculateEmaSeries(candles, 50).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (activeIndicators.includes('BB')) {
        const bb = calculateBollingerSeries(candles, 20, 2);
        const u = chart.addSeries(LineSeries, {
          color: 'rgba(148,163,184,0.45)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
        });
        const l = chart.addSeries(LineSeries, {
          color: 'rgba(148,163,184,0.45)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
        });
        u.setData(bb.upper.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
        l.setData(bb.lower.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      }
      if (activeIndicators.includes('VOLUME')) {
        const vol = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        vol.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
          }))
        );
      }
      if (activeIndicators.includes('RSI')) {
        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          priceScaleId: 'osc',
          priceLineVisible: false,
        });
        chart.priceScale('osc').applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 } });
        rsiSeries.setData(
          calculateRsiSeries(candles, 14).map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }
      if (activeIndicators.includes('MACD')) {
        const macdSeries = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 1,
          priceScaleId: 'macd',
          priceLineVisible: false,
        });
        chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.8, bottom: 0.02 } });
        macdSeries.setData(
          calculateMacdSeries(candles).map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }

      chart.timeScale().fitContent();
    }

    const ro = new ResizeObserver(() => {
      if (!el) return;
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, chartStyle, activeIndicators, positions, pendingOrders, selectedSymbol, symSpec]);

  // Drawing layer pointer handlers
  const activeDrawings = pixelDrawings[selectedSymbol] || [];

  const handleSvgPointerDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drawTool === 'CURSOR') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (drawTool === 'TEXT') {
      const label = window.prompt('Enter chart annotation text:');
      if (label && label.trim()) {
        const item: PixelDrawing = {
          id: `${Date.now()}`,
          tool: 'TEXT',
          x1: x,
          y1: y,
          x2: x,
          y2: y,
          text: label.trim(),
        };
        setPixelDrawings((prev) => ({
          ...prev,
          [selectedSymbol]: [...(prev[selectedSymbol] || []), item],
        }));
      }
      setDrawTool('CURSOR');
      return;
    }
    setDraftDraw({ id: `${Date.now()}`, tool: drawTool, x1: x, y1: y, x2: x, y2: y });
  };

  const handleSvgPointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draftDraw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDraftDraw({
      ...draftDraw,
      x2: e.clientX - rect.left,
      y2: e.clientY - rect.top,
    });
  };

  const handleSvgPointerUp = () => {
    if (!draftDraw) return;
    setPixelDrawings((prev) => ({
      ...prev,
      [selectedSymbol]: [...(prev[selectedSymbol] || []), draftDraw],
    }));
    setDraftDraw(null);
    setDrawTool('CURSOR');
  };

  return (
    <div className="h-full flex flex-col bg-[#060911] min-w-0">
      {/* Multi-Instrument Chart Tabs */}
      <div className="h-9 px-2 bg-[#080C15] border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {chartTabs.map((sym) => (
            <div
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                sym === selectedSymbol
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{sym}</span>
              {chartTabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChartTab(sym);
                  }}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-slate-400 shrink-0">
          {symSpec && (
            <>
              <span>
                Bid <strong className="text-slate-100">{symSpec.bid.toFixed(symSpec.digits)}</strong>
              </span>
              <span>
                Ask <strong className="text-slate-100">{symSpec.ask.toFixed(symSpec.digits)}</strong>
              </span>
              <span>Sp {symSpec.spread}</span>
            </>
          )}
          <span className="font-sans text-cyan-400">{candlesProvider}</span>
        </div>
      </div>

      {/* Chart Toolbar: Timeframes, Series Styles, Indicators, Drawing Tools */}
      <div className="px-2.5 py-1.5 bg-[#080C15] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-[#060911] p-0.5 rounded border border-slate-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-[11px] font-mono-tabular rounded cursor-pointer transition-colors ${
                  timeframe === tf
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-[#060911] p-0.5 rounded border border-slate-800">
            {(['CANDLES', 'BARS', 'LINE'] as ChartStyle[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setChartStyle(st)}
                className={`px-2 py-0.5 text-[11px] rounded cursor-pointer transition-colors ${
                  chartStyle === st
                    ? 'bg-blue-500/20 text-blue-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIndicatorsMenu((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#060911] border border-slate-800 hover:border-slate-700 text-xs text-slate-200 rounded cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
              Indicators ({activeIndicators.length})
            </button>
            {showIndicatorsMenu && (
              <div className="absolute left-0 top-full mt-1 z-30 w-48 bg-[#0B101B] border border-slate-800 rounded-lg p-2 space-y-1">
                {INDICATORS.map((ind) => (
                  <label
                    key={ind.id}
                    className="flex items-center gap-2 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800/60 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={activeIndicators.includes(ind.id)}
                      onChange={() => toggleIndicator(ind.id)}
                    />
                    <span>{ind.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawing Tools + Live Oscillator Readout */}
        <div className="flex items-center gap-1.5">
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono-tabular text-slate-400 mr-2">
            {rsiLatest !== null && <span>RSI {rsiLatest.toFixed(1)}</span>}
            {atrLatest !== null && <span>ATR {atrLatest.toFixed(symSpec?.digits ?? 4)}</span>}
            {stochLatest !== null && <span>Stoch {stochLatest.toFixed(1)}</span>}
          </div>

          {(
            [
              ['HLINE', 'H-Line', Minus],
              ['TREND', 'Trend', TrendingUp],
              ['CHANNEL', 'Channel', TrendingUp],
              ['FIB', 'Fib', SlidersHorizontal],
              ['RECT', 'Rect', Square],
              ['TEXT', 'Text', TypeIcon],
            ] as [Exclude<DrawTool, 'CURSOR'>, string, React.FC<{ className?: string }>][]
          ).map(([toolId, label, Icon]) => (
            <button
              key={toolId}
              type="button"
              title={`Draw ${label}`}
              onClick={() => setDrawTool((prev) => (prev === toolId ? 'CURSOR' : toolId))}
              className={`px-2 py-1 text-[11px] rounded border cursor-pointer inline-flex items-center gap-1 ${
                drawTool === toolId
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-[#060911] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}

          {activeDrawings.length > 0 && (
            <button
              type="button"
              title="Clear drawings"
              onClick={() => setPixelDrawings((prev) => ({ ...prev, [selectedSymbol]: [] }))}
              className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => void reloadCandles()}
            title="Reload historical data"
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${candlesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Chart Viewport + Interactive SVG Drawing Layer */}
      <div className="relative flex-1 min-h-[280px]">
        <div ref={containerRef} className="w-full h-full" />

        {/* Interactive SVG Drawing Overlay */}
        <svg
          onMouseDown={handleSvgPointerDown}
          onMouseMove={handleSvgPointerMove}
          onMouseUp={handleSvgPointerUp}
          className={`absolute inset-0 w-full h-full ${
            drawTool === 'CURSOR' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
          }`}
        >
          {[...activeDrawings, ...(draftDraw ? [draftDraw] : [])].map((d) => {
            if (d.tool === 'HLINE') {
              return (
                <line
                  key={d.id}
                  x1={0}
                  y1={d.y2}
                  x2="100%"
                  y2={d.y2}
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              );
            }
            if (d.tool === 'TREND') {
              return (
                <line
                  key={d.id}
                  x1={d.x1}
                  y1={d.y1}
                  x2={d.x2}
                  y2={d.y2}
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                />
              );
            }
            if (d.tool === 'CHANNEL') {
              return (
                <g key={d.id}>
                  <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="#06b6d4" strokeWidth={1.5} />
                  <line
                    x1={d.x1}
                    y1={d.y1 + 36}
                    x2={d.x2}
                    y2={d.y2 + 36}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                </g>
              );
            }
            if (d.tool === 'FIB') {
              const levels = [0, 0.236, 0.382, 0.5, 0.618, 1];
              return (
                <g key={d.id}>
                  {levels.map((lvl) => {
                    const ly = d.y1 + (d.y2 - d.y1) * lvl;
                    return (
                      <g key={lvl}>
                        <line
                          x1={Math.min(d.x1, d.x2)}
                          y1={ly}
                          x2={Math.max(d.x1, d.x2)}
                          y2={ly}
                          stroke="#8b5cf6"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        <text x={Math.min(d.x1, d.x2) + 4} y={ly - 3} fill="#c4b5fd" fontSize={10}>
                          {(lvl * 100).toFixed(1)}%
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            }
            if (d.tool === 'RECT') {
              return (
                <rect
                  key={d.id}
                  x={Math.min(d.x1, d.x2)}
                  y={Math.min(d.y1, d.y2)}
                  width={Math.abs(d.x2 - d.x1)}
                  height={Math.abs(d.y2 - d.y1)}
                  fill="rgba(6, 182, 212, 0.1)"
                  stroke="#06b6d4"
                  strokeWidth={1.2}
                />
              );
            }
            return (
              <text key={d.id} x={d.x1} y={d.y1} fill="#f8fafc" fontSize={12} fontWeight={600}>
                {d.text}
              </text>
            );
          })}
        </svg>

        {/* Honest Error / Unavailable Overlay when MT5 Bridge not connected for broker-only symbols */}
        {candlesError && candles.length === 0 && (
          <div className="absolute inset-0 bg-[#060911]/92 flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-3 bg-[#0B101B] border border-slate-800 rounded-xl p-6">
              <div className="text-sm font-semibold text-white">
                Historical Broker Feed Unavailable for {selectedSymbol}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{candlesError}</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('broker-connection')}
                  className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded cursor-pointer"
                >
                  Configure Exness MT5 Bridge
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSymbol('BTCUSDT')}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
                >
                  View Public BTCUSDT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
