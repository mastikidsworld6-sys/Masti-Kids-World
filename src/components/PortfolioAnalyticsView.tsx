import React, { useMemo } from 'react';
import { PieChart, PlugZap } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';

export const PortfolioAnalyticsView: React.FC = () => {
  const { bridgeStatus, positions, pendingOrders, deals, setActiveSection } = useTrading();
  const acc = bridgeStatus.account;

  const stats = useMemo(() => {
    const tradeDeals = deals.filter((d) => d.side === 'BUY' || d.side === 'SELL');
    const wins = tradeDeals.filter((d) => d.profit > 0);
    const losses = tradeDeals.filter((d) => d.profit < 0);
    const realizedPnl = tradeDeals.reduce((sum, d) => sum + d.profit + d.commission + d.swap, 0);
    const winRate = tradeDeals.length > 0 ? (wins.length / tradeDeals.length) * 100 : null;
    const avgProfit = wins.length > 0 ? wins.reduce((s, d) => s + d.profit, 0) / wins.length : null;
    const avgLoss = losses.length > 0 ? losses.reduce((s, d) => s + d.profit, 0) / losses.length : null;

    // Group exposure by instrument
    const bySymbol = new Map<string, { lots: number; pnl: number }>();
    for (const p of positions) {
      const cur = bySymbol.get(p.symbol) || { lots: 0, pnl: 0 };
      cur.lots += p.volume;
      cur.pnl += p.floatingPnl;
      bySymbol.set(p.symbol, cur);
    }

    return {
      tradeCount: tradeDeals.length,
      realizedPnl,
      winRate,
      avgProfit,
      avgLoss,
      totalExposureLots: positions.reduce((s, p) => s + p.volume, 0),
      bySymbol: Array.from(bySymbol.entries()),
    };
  }, [deals, positions]);

  if (!bridgeStatus.connected || !acc) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-[#0B101B] border border-slate-800 rounded-xl text-center space-y-4">
        <PieChart className="w-8 h-8 text-cyan-400 mx-auto" />
        <h2 className="font-display text-lg font-bold text-white">
          Portfolio Analytics Requires Live MT5 Synchronization
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          CHARANJEET QUANTX never fabricates historical performance, win rates, or drawdown figures. Connect your Exness MT5 Bridge to analyze actual account equity and broker deal history.
        </p>
        <button
          type="button"
          onClick={() => setActiveSection('broker-connection')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded cursor-pointer"
        >
          <PlugZap className="w-3.5 h-3.5" />
          Connect Exness MT5
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Portfolio Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">
            {acc.accountType} #{acc.login} · {acc.broker} ({acc.server}) · Last Sync{' '}
            {new Date(acc.lastSync).toISOString().slice(11, 19)} UTC
          </p>
        </div>
      </div>

      {/* Authoritative Account Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Balance', `${acc.balance.toFixed(2)} ${acc.currency}`],
          ['Equity', `${acc.equity.toFixed(2)} ${acc.currency}`],
          ['Floating P&L', `${acc.floatingPnl >= 0 ? '+' : ''}${acc.floatingPnl.toFixed(2)} ${acc.currency}`],
          ['Realized P&L (30d)', `${stats.realizedPnl >= 0 ? '+' : ''}${stats.realizedPnl.toFixed(2)} ${acc.currency}`],
          ['Used Margin', `${acc.usedMargin.toFixed(2)} ${acc.currency}`],
          ['Free Margin', `${acc.freeMargin.toFixed(2)} ${acc.currency}`],
          ['Margin Level', acc.marginLevel > 0 ? `${acc.marginLevel.toFixed(1)}%` : '—'],
          ['Total Exposure', `${stats.totalExposureLots.toFixed(2)} lots (${positions.length} pos / ${pendingOrders.length} ord)`],
        ].map(([label, val]) => (
          <div key={label} className="bg-[#0B101B] border border-slate-800 rounded-lg p-4 space-y-1">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="font-mono-tabular text-base font-bold text-white">{val}</div>
          </div>
        ))}
      </div>

      {/* Realized Deal Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-xs font-semibold text-white">Broker Deal Performance (30 Days)</div>
          <div className="divide-y divide-slate-800/70 text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-slate-400">Closed Trades</span>
              <span className="font-mono-tabular text-white">{stats.tradeCount}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-400">Win Rate</span>
              <span className="font-mono-tabular text-cyan-300">
                {stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : 'No closed trades'}
              </span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-400">Average Winning Trade</span>
              <span className="font-mono-tabular text-emerald-400">
                {stats.avgProfit !== null ? `+${stats.avgProfit.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-400">Average Losing Trade</span>
              <span className="font-mono-tabular text-red-400">
                {stats.avgLoss !== null ? stats.avgLoss.toFixed(2) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="text-xs font-semibold text-white">Instrument-Wise Open Exposure</div>
          {stats.bySymbol.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No active open exposure on this account.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70 text-xs font-mono-tabular">
              {stats.bySymbol.map(([sym, data]) => (
                <div key={sym} className="py-2 flex items-center justify-between">
                  <span className="font-sans font-semibold text-white">{sym}</span>
                  <span className="text-slate-300">{data.lots.toFixed(2)} lots</span>
                  <span className={data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {data.pnl >= 0 ? '+' : ''}
                    {data.pnl.toFixed(2)} {acc.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
