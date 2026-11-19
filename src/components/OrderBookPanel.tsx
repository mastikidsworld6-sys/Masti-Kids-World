import React, { useMemo } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import { computeAnalyticalLiquidityZones } from '../lib/marketHubs.ts';

export const OrderBookPanel: React.FC = () => {
  const { selectedSymbol, marketDepth, depthLoading, refreshDepth, candles, allSymbols } =
    useTrading();

  const symSpec = useMemo(
    () => allSymbols.find((s) => s.symbol === selectedSymbol),
    [allSymbols, selectedSymbol]
  );

  const zones = useMemo(() => computeAnalyticalLiquidityZones(candles), [candles]);
  const digits = symSpec?.digits ?? 4;

  return (
    <div className="bg-[#080C15] border-t border-slate-800/80 p-3 space-y-3">
      {/* Actual Broker / Exchange Market Depth */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Actual Market Depth · {selectedSymbol}</span>
          </div>
          <button
            type="button"
            onClick={() => void refreshDepth(selectedSymbol)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
            title="Refresh depth"
          >
            <RefreshCw className={`w-3 h-3 ${depthLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="text-[10px] text-slate-400 flex items-center justify-between">
          <span>Source: {marketDepth?.provider || 'Unavailable'}</span>
          {marketDepth?.timestamp && (
            <span className="font-mono-tabular">
              {new Date(marketDepth.timestamp).toISOString().slice(11, 19)} UTC
            </span>
          )}
        </div>

        {marketDepth?.available && marketDepth.bids.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tabular">
            <div className="space-y-0.5">
              <div className="text-[10px] text-emerald-400 font-sans font-medium pb-0.5 border-b border-slate-800">
                Bids (Actual)
              </div>
              {marketDepth.bids.slice(0, 6).map((b, i) => (
                <div key={i} className="flex justify-between text-slate-200">
                  <span className="text-emerald-400">{b.price.toFixed(digits)}</span>
                  <span className="text-slate-400">{b.volume.toFixed(3)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-red-400 font-sans font-medium pb-0.5 border-b border-slate-800">
                Asks (Actual)
              </div>
              {marketDepth.asks.slice(0, 6).map((a, i) => (
                <div key={i} className="flex justify-between text-slate-200">
                  <span className="text-red-400">{a.price.toFixed(digits)}</span>
                  <span className="text-slate-400">{a.volume.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#060911] border border-slate-800 rounded p-2.5 text-center space-y-1">
            <div className="text-[11px] font-semibold text-amber-300">
              MARKET DEPTH NOT AVAILABLE
            </div>
            <div className="text-[10px] text-slate-500">
              OTC Forex/CFDs do not have a consolidated global order book unless supplied by your connected broker or licensed exchange feed.
            </div>
          </div>
        )}
      </div>

      {/* Clearly Separated Analytical Estimates */}
      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-violet-300">
            Analytical Liquidity Estimates
          </span>
          <span className="text-[10px] text-slate-500">Model-Derived</span>
        </div>

        {zones.length > 0 ? (
          <div className="space-y-1 text-[11px]">
            {zones.map((z, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-300">
                <span className="truncate text-slate-400">{z.label}</span>
                <span className="font-mono-tabular text-violet-300">{z.price.toFixed(digits)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">
            Load historical candles to compute analytical pivot zones.
          </div>
        )}
      </div>
    </div>
  );
};
