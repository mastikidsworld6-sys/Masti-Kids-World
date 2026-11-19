import React, { useMemo } from 'react';
import {
  PlugZap,
  CandlestickChart,
  Globe2,
  Bot,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';

export const OverviewView: React.FC = () => {
  const {
    bridgeStatus,
    allSymbols,
    positions,
    pendingOrders,
    deals,
    strategies,
    auditLogs,
    setActiveSection,
    setTerminalTab,
    openChartTab,
    setSelectedSymbol,
  } = useTrading();

  const acc = bridgeStatus.account;
  const activeStrategies = strategies.filter((s) => s.isLiveEnabled && s.status === 'ACTIVE');

  const topMovers = useMemo(() => {
    return [...allSymbols]
      .filter((s) => Number.isFinite(s.changePct))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 8);
  }, [allSymbols]);

  const realizedPnl = useMemo(
    () =>
      deals
        .filter((d) => d.side === 'BUY' || d.side === 'SELL')
        .reduce((sum, d) => sum + d.profit + d.commission + d.swap, 0),
    [deals]
  );

  return (
    <div className="h-full overflow-y-auto bg-[#060911] p-5 space-y-5">
      {/* Broker Account Strip */}
      {bridgeStatus.connected && acc ? (
        <section className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h1 className="font-display text-base font-semibold text-white">
                  {acc.broker} · {acc.accountType} #{acc.login}
                </h1>
                <p className="text-xs text-slate-400 font-mono-tabular">
                  Server: {acc.server} · Leverage 1:{acc.leverage} · Last Sync:{' '}
                  {new Date(acc.lastSync).toISOString().slice(11, 19)} UTC
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('terminal');
                  setTerminalTab('CHART');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer whitespace-nowrap"
              >
                <CandlestickChart className="w-3.5 h-3.5" />
                Open Terminal
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('globe')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#121A2B] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
              >
                <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
                Liquidity Globe
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 font-mono-tabular">
            <div>
              <div className="text-[11px] font-sans text-slate-400">Balance</div>
              <div className="text-base font-semibold text-white">
                {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs text-slate-400">{acc.currency}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Equity</div>
              <div className="text-base font-semibold text-cyan-300">
                {acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Floating P&amp;L</div>
              <div
                className={`text-base font-semibold ${
                  acc.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {acc.floatingPnl >= 0 ? '+' : ''}
                {acc.floatingPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Realized P&amp;L</div>
              <div
                className={`text-base font-semibold ${
                  realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {realizedPnl >= 0 ? '+' : ''}
                {realizedPnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Used Margin</div>
              <div className="text-base font-semibold text-slate-100">{acc.usedMargin.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Free Margin</div>
              <div className="text-base font-semibold text-slate-100">{acc.freeMargin.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-slate-400">Margin Level</div>
              <div className="text-base font-semibold text-slate-100">
                {acc.marginLevel > 0 ? `${acc.marginLevel.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-lg font-semibold text-white">
              Exness MT5 Account Not Connected
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Live balance, equity, margin, open positions, and MT5 order routing remain unavailable until your Windows Python MT5 Bridge session is authenticated. Live public crypto market feeds remain accessible across the terminal and 3D Liquidity Globe.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('broker-connection')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer whitespace-nowrap"
            >
              <PlugZap className="w-4 h-4" />
              Connect Exness MT5
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('globe')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#121A2B] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
            >
              <Globe2 className="w-4 h-4 text-cyan-400" />
              Explore Globe
            </button>
          </div>
        </section>
      )}

      {/* Operational Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Open Positions / Pending Orders</div>
            <div className="mt-1 font-mono-tabular text-xl font-semibold text-white">
              {positions.length} <span className="text-sm text-slate-500">/ {pendingOrders.length}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('positions')}
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Manage
          </button>
        </div>

        <div className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Automated Strategies</div>
            <div className="mt-1 font-mono-tabular text-xl font-semibold text-white">
              {activeStrategies.length} Active{' '}
              <span className="text-sm text-slate-500">of {strategies.length}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('auto-trading')}
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5" />
            Engine
          </button>
        </div>

        <div className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tradable &amp; Reference Instruments</div>
            <div className="mt-1 font-mono-tabular text-xl font-semibold text-white">
              {allSymbols.length}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('market-watch')}
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
          >
            Directory
          </button>
        </div>
      </div>

      {/* Two-Column Movers & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">
              Live Market Movers
            </h2>
            <span className="text-[11px] text-slate-400">
              {bridgeStatus.connected ? 'Exness MT5 + Binance Spot' : 'Binance Spot Public'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#080C15] text-slate-400 text-[11px]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Instrument</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-right px-3 py-2 font-medium">Bid</th>
                  <th className="text-right px-3 py-2 font-medium">24h / Session %</th>
                  <th className="text-right px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
                {topMovers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                      Waiting for live market ticks...
                    </td>
                  </tr>
                ) : (
                  topMovers.map((sym) => (
                    <tr key={sym.symbol} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-sans">
                        <div className="font-semibold text-white">{sym.symbol}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {sym.provider}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-sans text-slate-300">{sym.category}</td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {sym.bid.toFixed(sym.digits)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          sym.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {sym.changePct >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {sym.changePct >= 0 ? '+' : ''}
                          {sym.changePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-sans">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openChartTab(sym.symbol)}
                            className="text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
                          >
                            Chart
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(sym.symbol);
                              setActiveSection('globe');
                            }}
                            className="text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
                          >
                            Globe
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">Recent Audit Events</h2>
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No audit events recorded in this account yet.
              </div>
            ) : (
              auditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="px-4 py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100">{log.action}</span>
                    <span
                      className={`text-[10px] font-mono-tabular ${
                        log.severity === 'CRITICAL'
                          ? 'text-red-400'
                          : log.severity === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {log.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    <span className="font-mono-tabular text-slate-300 mr-1.5">{log.symbol}</span>
                    {log.details}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
