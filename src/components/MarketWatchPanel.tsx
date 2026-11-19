import React, { useMemo, useState } from 'react';
import { Search, Star, Info, X, ArrowUpDown, RefreshCw } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { SymbolCategory, SymbolSpec } from '../types/trading.ts';

type SortKey = 'symbol' | 'changePct' | 'spread' | 'sessionVolume';

const CATEGORIES: ('All' | 'Favorites' | SymbolCategory)[] = [
  'All',
  'Favorites',
  'Forex',
  'Metals',
  'Commodities',
  'Indices',
  'Stocks',
  'Crypto',
  'Other',
];

export const MarketWatchPanel: React.FC = () => {
  const {
    allSymbols,
    selectedSymbol,
    openChartTab,
    favorites,
    toggleFavorite,
    bridgeStatus,
    setActiveSection,
  } = useTrading();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | 'Favorites' | SymbolCategory>('All');
  const [sortBy, setSortBy] = useState<SortKey>('symbol');
  const [sortAsc, setSortAsc] = useState(true);
  const [specModalSymbol, setSpecModalSymbol] = useState<SymbolSpec | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSymbols
      .filter((s) => {
        if (category === 'Favorites' && !favorites.includes(s.symbol)) return false;
        if (category !== 'All' && category !== 'Favorites' && s.category !== category) return false;
        if (q) {
          return (
            s.symbol.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol) * dir;
        return ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * dir;
      });
  }, [allSymbols, category, favorites, search, sortBy, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc((v) => !v);
    else {
      setSortBy(key);
      setSortAsc(key === 'symbol');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#080C15] border-r border-slate-800/80 min-w-0">
      {/* Header & Search */}
      <div className="p-2.5 border-b border-slate-800/80 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Market Watch</span>
          <span className="text-[11px] font-mono-tabular text-slate-400">
            {filtered.length} / {allSymbols.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or description..."
            className="w-full bg-[#060911] border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
          />
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                category === cat
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
          <button
            type="button"
            onClick={() => handleSort('symbol')}
            className="inline-flex items-center gap-1 hover:text-slate-300 cursor-pointer"
          >
            Symbol <ArrowUpDown className="w-2.5 h-2.5" />
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSort('spread')}
              className="hover:text-slate-300 cursor-pointer"
            >
              Spread
            </button>
            <button
              type="button"
              onClick={() => handleSort('changePct')}
              className="hover:text-slate-300 cursor-pointer"
            >
              24h %
            </button>
          </div>
        </div>
      </div>

      {/* MT5 Disconnected Notice */}
      {!bridgeStatus.connected && (
        <div className="px-2.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between gap-2 shrink-0">
          <span className="truncate">Connect Exness MT5 for Forex/CFD symbols</span>
          <button
            type="button"
            onClick={() => setActiveSection('broker-connection')}
            className="text-cyan-300 hover:underline font-medium shrink-0 cursor-pointer"
          >
            Setup
          </button>
        </div>
      )}

      {/* Symbol Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {filtered.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <RefreshCw className="w-5 h-5 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400">No matching instruments</div>
            <div className="text-[11px] text-slate-500">
              {bridgeStatus.connected
                ? 'Adjust your search or category filter.'
                : 'Connect your Exness MT5 Bridge to load all broker instruments.'}
            </div>
          </div>
        ) : (
          filtered.map((sym) => {
            const isSelected = sym.symbol === selectedSymbol;
            const isFav = favorites.includes(sym.symbol);
            return (
              <div
                key={sym.symbol}
                onClick={() => openChartTab(sym.symbol)}
                className={`px-2.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSelected ? 'bg-cyan-500/10' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(sym.symbol);
                    }}
                    aria-label={`Toggle favorite ${sym.symbol}`}
                    className={`p-0.5 cursor-pointer shrink-0 ${
                      isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <Star className="w-3 h-3" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">
                        {sym.symbol}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSpecModalSymbol(sym);
                        }}
                        aria-label={`Inspect ${sym.symbol} specifications`}
                        className="text-slate-500 hover:text-cyan-300 cursor-pointer shrink-0"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {sym.provider} · {sym.category}
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono-tabular shrink-0">
                  <div className="text-xs text-slate-100">
                    {sym.bid.toFixed(sym.digits)} / {sym.ask.toFixed(sym.digits)}
                  </div>
                  <div className="text-[10px] flex items-center justify-end gap-2">
                    <span className="text-slate-400">Sp {sym.spread}</span>
                    <span className={sym.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {sym.changePct >= 0 ? '+' : ''}
                      {sym.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Symbol Specification Modal */}
      {specModalSymbol && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  {specModalSymbol.symbol} Specification
                </h3>
                <p className="text-xs text-slate-400">
                  {specModalSymbol.description} · {specModalSymbol.provider}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSpecModalSymbol(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs border-t border-b border-slate-800 py-3">
              <div className="text-slate-400">Category</div>
              <div className="text-right text-slate-100 font-medium">{specModalSymbol.category}</div>

              <div className="text-slate-400">Tradeable in MT5</div>
              <div
                className={`text-right font-medium ${
                  specModalSymbol.tradeable ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {specModalSymbol.tradeable ? 'Authorized' : 'Market Feed Only'}
              </div>

              <div className="text-slate-400">Contract Size</div>
              <div className="text-right font-mono-tabular text-slate-100">
                {specModalSymbol.contractSize}
              </div>

              <div className="text-slate-400">Min / Max Lot</div>
              <div className="text-right font-mono-tabular text-slate-100">
                {specModalSymbol.volumeMin} / {specModalSymbol.volumeMax}
              </div>

              <div className="text-slate-400">Lot Step</div>
              <div className="text-right font-mono-tabular text-slate-100">
                {specModalSymbol.volumeStep}
              </div>

              <div className="text-slate-400">Tick Size / Value</div>
              <div className="text-right font-mono-tabular text-slate-100">
                {specModalSymbol.tickSize} / {specModalSymbol.tickValue}
              </div>

              <div className="text-slate-400">Initial Margin</div>
              <div className="text-right font-mono-tabular text-slate-100">
                {specModalSymbol.marginInitial}
              </div>

              <div className="text-slate-400">Last Tick</div>
              <div className="text-right font-mono-tabular text-slate-300">
                {specModalSymbol.lastTickTime
                  ? new Date(specModalSymbol.lastTickTime).toISOString().slice(11, 19) + ' UTC'
                  : 'Unavailable'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                openChartTab(specModalSymbol.symbol);
                setSpecModalSymbol(null);
              }}
              className="w-full py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded transition-colors cursor-pointer"
            >
              Open {specModalSymbol.symbol} in Terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
