import React, { useMemo, useState } from 'react';
import {
  Search,
  Star,
  CandlestickChart,
  Globe2,
  ArrowUpDown,
  Info,
  X,
  PlugZap,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { SymbolCategory, SymbolSpec } from '../types/trading.ts';

interface AssetCategoryViewProps {
  categoryFilter: 'ALL' | SymbolCategory;
  title: string;
  description: string;
}

type SortField = 'symbol' | 'bid' | 'spread' | 'changePct' | 'sessionVolume';

export const AssetCategoryView: React.FC<AssetCategoryViewProps> = ({
  categoryFilter,
  title,
  description,
}) => {
  const {
    allSymbols,
    favorites,
    toggleFavorite,
    openChartTab,
    setSelectedSymbol,
    setActiveSection,
    bridgeStatus,
  } = useTrading();

  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortAsc, setSortAsc] = useState(true);
  const [specModal, setSpecModal] = useState<SymbolSpec | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSymbols
      .filter((s) => {
        if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
        if (onlyFavorites && !favorites.includes(s.symbol)) return false;
        if (q) {
          return (
            s.symbol.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.path.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
        else cmp = (a[sortField] as number) - (b[sortField] as number);
        return sortAsc ? cmp : -cmp;
      });
  }, [allSymbols, categoryFilter, onlyFavorites, favorites, query, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(field === 'symbol');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#060911] p-5 gap-4 overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="font-display text-lg font-semibold text-white">{title}</h1>
          <p className="text-xs text-slate-400">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter symbol or description..."
              className="pl-8 pr-3 py-1.5 bg-[#0B101B] border border-slate-800 rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 w-60"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border cursor-pointer whitespace-nowrap ${
              onlyFavorites
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-[#0B101B] border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorites
          </button>
        </div>
      </div>

      {!bridgeStatus.connected && categoryFilter !== 'Crypto' && (
        <div className="bg-[#0B101B] border border-amber-500/30 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300">
            Exness MT5 Bridge is disconnected. Broker symbols for <span className="text-white font-semibold">{title}</span> synchronize automatically once your Windows MT5 terminal connects.
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('broker-connection')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer whitespace-nowrap"
          >
            <PlugZap className="w-3.5 h-3.5" />
            Connect Exness MT5
          </button>
        </div>
      )}

      {/* Instruments Table */}
      <div className="flex-1 bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="w-9 px-3 py-2.5 text-center" aria-label="Favorite" />
                <th className="text-left px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('symbol')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Symbol <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-2.5">Category</th>
                <th className="text-right px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('bid')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Bid <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2.5">Ask</th>
                <th className="text-right px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('spread')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Spread <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('changePct')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    Change % <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-2.5">Source</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-sans">
                    No instruments match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const isFav = favorites.includes(s.symbol);
                  return (
                    <tr key={s.symbol} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(s.symbol)}
                          aria-label={`Toggle favorite ${s.symbol}`}
                          className={`cursor-pointer ${
                            isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </td>
                      <td className="px-3 py-2 font-sans">
                        <div className="font-semibold text-white">{s.symbol}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                          {s.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-sans text-slate-300">{s.category}</td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {s.bid.toFixed(s.digits)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {s.ask.toFixed(s.digits)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">{s.spread} pts</td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          s.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {s.changePct >= 0 ? '+' : ''}
                        {s.changePct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 font-sans text-[11px] text-slate-400">
                        {s.provider}
                      </td>
                      <td className="px-4 py-2 text-right font-sans">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSpecModal(s)}
                            title="Contract Specifications"
                            className="p-1 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openChartTab(s.symbol)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded cursor-pointer whitespace-nowrap"
                          >
                            <CandlestickChart className="w-3 h-3" />
                            Trade / Chart
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(s.symbol);
                              setActiveSection('globe');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#121A2B] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
                          >
                            <Globe2 className="w-3 h-3" />
                            Globe
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Specifications Modal */}
      {specModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  {specModal.symbol} Specifications
                </h2>
                <p className="text-xs text-slate-400">{specModal.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSpecModal(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono-tabular">
              <div>
                <span className="text-slate-500 font-sans block">Feed Provider</span>
                <span className="text-slate-100 font-sans">{specModal.provider}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Broker Path</span>
                <span className="text-slate-100 font-sans">{specModal.path || specModal.category}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Contract Size</span>
                <span className="text-slate-100">{specModal.contractSize}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Digits / Point</span>
                <span className="text-slate-100">
                  {specModal.digits} / {specModal.point}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Volume Min / Max / Step</span>
                <span className="text-slate-100">
                  {specModal.volumeMin} / {specModal.volumeMax} / {specModal.volumeStep}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Tick Size / Value</span>
                <span className="text-slate-100">
                  {specModal.tickSize} / {specModal.tickValue}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Initial Margin</span>
                <span className="text-slate-100">{specModal.marginInitial}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Execution Status</span>
                <span className={specModal.tradeable ? 'text-emerald-400' : 'text-amber-400'}>
                  {specModal.tradeable ? 'Tradable on MT5' : 'Reference Quote Only'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
