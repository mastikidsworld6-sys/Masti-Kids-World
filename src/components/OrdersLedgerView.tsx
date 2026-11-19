import React, { useMemo, useState } from 'react';
import { Edit3, Trash2, X, Download, PlugZap } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { OpenPosition } from '../types/trading.ts';

interface OrdersLedgerViewProps {
  mode: 'POSITIONS' | 'ORDERS' | 'HISTORY';
}

export const OrdersLedgerView: React.FC<OrdersLedgerViewProps> = ({ mode }) => {
  const {
    bridgeStatus,
    positions,
    pendingOrders,
    deals,
    modifyPosition,
    closePosition,
    cancelOrder,
    openChartTab,
    setActiveSection,
  } = useTrading();

  const [editing, setEditing] = useState<OpenPosition | null>(null);
  const [slInput, setSlInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [partialVol, setPartialVol] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const historyTotals = useMemo(() => {
    const trades = deals.filter((d) => d.side === 'BUY' || d.side === 'SELL');
    const netProfit = trades.reduce((sum, d) => sum + d.profit + d.commission + d.swap, 0);
    return { count: trades.length, netProfit };
  }, [deals]);

  const openEditModal = (pos: OpenPosition) => {
    setEditing(pos);
    setSlInput(pos.sl ? String(pos.sl) : '');
    setTpInput(pos.tp ? String(pos.tp) : '');
    setPartialVol(String(pos.volume));
    setErrorMsg(null);
  };

  const handleModify = async () => {
    if (!editing) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await modifyPosition(
        editing.ticket,
        slInput ? Number(slInput) : 0,
        tpInput ? Number(tpInput) : 0
      );
      setEditing(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Modification rejected');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async (ticket: number, volume?: number) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await closePosition(ticket, volume);
      setEditing(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Position close rejected');
    } finally {
      setBusy(false);
    }
  };

  const exportDealsCsv = () => {
    const header = 'Ticket,Order,Symbol,Side,Volume,Price,Profit,Commission,Swap,Time,Comment\n';
    const body = deals
      .map((d) =>
        [
          d.ticket,
          d.order,
          d.symbol,
          d.side,
          d.volume,
          d.price,
          d.profit,
          d.commission,
          d.swap,
          d.time,
          `"${(d.comment || '').replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantx-mt5-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#060911] p-5 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="font-display text-lg font-semibold text-white">
            {mode === 'POSITIONS'
              ? 'Open MT5 Positions'
              : mode === 'ORDERS'
              ? 'Pending MT5 Orders'
              : 'Account Deal & Execution History'}
          </h1>
          <p className="text-xs text-slate-400">
            {bridgeStatus.connected
              ? `Synchronized live with Exness MT5 Account #${bridgeStatus.account?.login}`
              : 'Connect your Exness MT5 Bridge to view and manage live account records.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'HISTORY' && deals.length > 0 && (
            <button
              type="button"
              onClick={exportDealsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0B101B] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {!bridgeStatus.connected && (
            <button
              type="button"
              onClick={() => setActiveSection('broker-connection')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer whitespace-nowrap"
            >
              <PlugZap className="w-3.5 h-3.5" />
              Connect MT5
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-2 text-xs text-red-300 shrink-0">
          {errorMsg}
        </div>
      )}

      <div className="flex-1 bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-auto">
        {mode === 'POSITIONS' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="text-left px-4 py-2.5">Ticket</th>
                <th className="text-left px-3 py-2.5">Symbol</th>
                <th className="text-left px-3 py-2.5">Side</th>
                <th className="text-right px-3 py-2.5">Lots</th>
                <th className="text-right px-3 py-2.5">Entry</th>
                <th className="text-right px-3 py-2.5">Current</th>
                <th className="text-right px-3 py-2.5">SL / TP</th>
                <th className="text-right px-3 py-2.5">Swap</th>
                <th className="text-right px-3 py-2.5">Floating P&amp;L</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 font-sans">
                    {bridgeStatus.connected
                      ? 'No open positions on this MT5 account.'
                      : 'Connect Exness MT5 Bridge to synchronize open positions.'}
                  </td>
                </tr>
              ) : (
                positions.map((p) => (
                  <tr key={p.ticket} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-300">#{p.ticket}</td>
                    <td className="px-3 py-2.5 font-sans">
                      <button
                        type="button"
                        onClick={() => openChartTab(p.symbol)}
                        className="font-semibold text-white hover:text-cyan-300 cursor-pointer"
                      >
                        {p.symbol}
                      </button>
                    </td>
                    <td
                      className={`px-3 py-2.5 font-semibold ${
                        p.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.side}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-100">{p.volume}</td>
                    <td className="px-3 py-2.5 text-right text-slate-200">{p.entryPrice}</td>
                    <td className="px-3 py-2.5 text-right text-slate-200">{p.currentPrice}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {p.sl || '—'} / {p.tp || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{p.swap.toFixed(2)}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold ${
                        p.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.floatingPnl >= 0 ? '+' : ''}
                      {p.floatingPnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Modify
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleClose(p.ticket)}
                          className="px-2 py-1 text-[11px] bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {mode === 'ORDERS' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="text-left px-4 py-2.5">Ticket</th>
                <th className="text-left px-3 py-2.5">Symbol</th>
                <th className="text-left px-3 py-2.5">Type</th>
                <th className="text-right px-3 py-2.5">Lots</th>
                <th className="text-right px-3 py-2.5">Trigger Price</th>
                <th className="text-right px-3 py-2.5">SL / TP</th>
                <th className="text-left px-3 py-2.5">Setup Time</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-sans">
                    No active pending orders on this MT5 account.
                  </td>
                </tr>
              ) : (
                pendingOrders.map((o) => (
                  <tr key={o.ticket} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-300">#{o.ticket}</td>
                    <td className="px-3 py-2.5 font-sans font-semibold text-white">{o.symbol}</td>
                    <td className="px-3 py-2.5 text-cyan-300">{o.orderType}</td>
                    <td className="px-3 py-2.5 text-right text-slate-100">{o.volume}</td>
                    <td className="px-3 py-2.5 text-right text-slate-100">{o.price}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {o.sl || '—'} / {o.tp || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{o.setupTime}</td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => void cancelOrder(o.ticket)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {mode === 'HISTORY' && (
          <>
            <div className="px-4 py-2.5 bg-[#080C15] border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Executed Deals: <strong className="text-white">{historyTotals.count}</strong>
              </span>
              <span className="font-mono-tabular">
                Net Realized P&amp;L:{' '}
                <strong
                  className={historyTotals.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}
                >
                  {historyTotals.netProfit >= 0 ? '+' : ''}
                  {historyTotals.netProfit.toFixed(2)}
                </strong>
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2.5">Deal</th>
                  <th className="text-left px-3 py-2.5">Symbol</th>
                  <th className="text-left px-3 py-2.5">Side</th>
                  <th className="text-right px-3 py-2.5">Volume</th>
                  <th className="text-right px-3 py-2.5">Price</th>
                  <th className="text-right px-3 py-2.5">Comm / Swap</th>
                  <th className="text-right px-3 py-2.5">Profit</th>
                  <th className="text-right px-4 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500 font-sans">
                      No deal history returned by the connected MT5 account.
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => (
                    <tr key={d.ticket} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-300">#{d.ticket}</td>
                      <td className="px-3 py-2 font-sans font-semibold text-white">
                        {d.symbol || 'ACCOUNT'}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{d.side}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{d.volume}</td>
                      <td className="px-3 py-2 text-right text-slate-200">{d.price}</td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {d.commission.toFixed(2)} / {d.swap.toFixed(2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          d.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {d.profit >= 0 ? '+' : ''}
                        {d.profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400">{d.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Modify / Partial Close Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-display text-sm font-semibold text-white">
                Manage Position #{editing.ticket} · {editing.symbol} ({editing.side})
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Stop Loss</span>
                <input
                  type="number"
                  step="any"
                  value={slInput}
                  onChange={(e) => setSlInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#060911] border border-slate-800 rounded font-mono-tabular text-white"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Take Profit</span>
                <input
                  type="number"
                  step="any"
                  value={tpInput}
                  onChange={(e) => setTpInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#060911] border border-slate-800 rounded font-mono-tabular text-white"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleModify()}
                className="flex-1 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer"
              >
                Update SL / TP
              </button>
            </div>
            <div className="border-t border-slate-800 pt-3 flex items-end gap-2">
              <label className="flex-1 space-y-1 text-xs">
                <span className="text-slate-400">Close Volume (Lots)</span>
                <input
                  type="number"
                  step="0.01"
                  max={editing.volume}
                  min={0.01}
                  value={partialVol}
                  onChange={(e) => setPartialVol(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#060911] border border-slate-800 rounded font-mono-tabular text-white"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClose(editing.ticket, Number(partialVol) || undefined)}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer whitespace-nowrap"
              >
                Close Lots
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
