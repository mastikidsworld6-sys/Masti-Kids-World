import React, { useState } from 'react';
import { Bell, Check, Edit3, Trash2, X, GripHorizontal } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { OpenPosition, TradingAlert } from '../types/trading.ts';

type DockTab = 'POSITIONS' | 'ORDERS' | 'HISTORY' | 'LOGS' | 'ALERTS';

export const BottomDock: React.FC = () => {
  const {
    positions,
    pendingOrders,
    deals,
    autoLogs,
    auditLogs,
    alerts,
    selectedSymbol,
    modifyPosition,
    closePosition,
    cancelOrder,
    createAlert,
    updateAlertStatus,
    deleteAlert,
  } = useTrading();

  const [tab, setTab] = useState<DockTab>('POSITIONS');
  const [heightPx, setHeightPx] = useState(220);

  // Modify SL/TP modal state
  const [editingPos, setEditingPos] = useState<OpenPosition | null>(null);
  const [editSl, setEditSl] = useState('');
  const [editTp, setEditTp] = useState('');
  const [partialLots, setPartialLots] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // New Alert form
  const [alertType, setAlertType] = useState<TradingAlert['alertType']>('PRICE');
  const [alertCond, setAlertCond] = useState<TradingAlert['condition']>('ABOVE');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertBrowserNotify, setAlertBrowserNotify] = useState(true);

  const startResize = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startH = heightPx;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(150, Math.min(440, startH + (startY - ev.clientY)));
      setHeightPx(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSaveSlTp = async () => {
    if (!editingPos) return;
    setActionError(null);
    try {
      await modifyPosition(
        editingPos.ticket,
        editSl ? Number(editSl) : undefined,
        editTp ? Number(editTp) : undefined
      );
      setEditingPos(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Modify failed');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(alertThreshold);
    if (Number.isNaN(num)) return;
    if (alertBrowserNotify && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    await createAlert({
      symbol: selectedSymbol,
      alertType,
      condition: alertCond,
      threshold: num,
      browserNotify: alertBrowserNotify,
      status: 'ARMED',
    });
    setAlertThreshold('');
  };

  return (
    <div
      style={{ height: `${heightPx}px` }}
      className="bg-[#080C15] border-t border-slate-800/80 flex flex-col shrink-0"
    >
      {/* Drag Handle & Tab Bar */}
      <div className="h-9 px-3 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(
            [
              ['POSITIONS', `Open Positions (${positions.length})`],
              ['ORDERS', `Pending Orders (${pendingOrders.length})`],
              ['HISTORY', `Trade History (${deals.length})`],
              ['LOGS', `Trading Logs (${autoLogs.length + auditLogs.length})`],
              ['ALERTS', `Alerts (${alerts.length})`],
            ] as [DockTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onMouseDown={startResize}
          title="Drag to resize bottom panel"
          className="text-slate-500 hover:text-slate-300 cursor-ns-resize p-1"
        >
          <GripHorizontal className="w-4 h-4" />
        </button>
      </div>

      {actionError && (
        <div className="px-3 py-1.5 bg-red-500/15 border-b border-red-500/30 text-xs text-red-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab Body */}
      <div className="flex-1 overflow-auto">
        {tab === 'POSITIONS' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[#0A0F1A] text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-3">Ticket</th>
                <th className="py-1.5 px-3">Symbol</th>
                <th className="py-1.5 px-3">Side</th>
                <th className="py-1.5 px-3 text-right">Volume</th>
                <th className="py-1.5 px-3 text-right">Entry</th>
                <th className="py-1.5 px-3 text-right">Current</th>
                <th className="py-1.5 px-3 text-right">SL / TP</th>
                <th className="py-1.5 px-3 text-right">Floating P&L</th>
                <th className="py-1.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center font-sans text-slate-500">
                    No open MT5 positions.
                  </td>
                </tr>
              ) : (
                positions.map((p) => (
                  <tr key={p.ticket} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-3 text-slate-300">#{p.ticket}</td>
                    <td className="py-1.5 px-3 font-sans font-semibold text-white">{p.symbol}</td>
                    <td
                      className={`py-1.5 px-3 font-sans font-semibold ${
                        p.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.side}
                    </td>
                    <td className="py-1.5 px-3 text-right">{p.volume}</td>
                    <td className="py-1.5 px-3 text-right">{p.entryPrice}</td>
                    <td className="py-1.5 px-3 text-right">{p.currentPrice}</td>
                    <td className="py-1.5 px-3 text-right text-slate-400">
                      {p.sl || '—'} / {p.tp || '—'}
                    </td>
                    <td
                      className={`py-1.5 px-3 text-right font-semibold ${
                        p.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {p.floatingPnl >= 0 ? '+' : ''}
                      {p.floatingPnl.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-sans space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPos(p);
                          setEditSl(p.sl ? String(p.sl) : '');
                          setEditTp(p.tp ? String(p.tp) : '');
                          setPartialLots(String(p.volume));
                        }}
                        className="text-cyan-300 hover:underline cursor-pointer"
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void closePosition(p.ticket).catch((e) =>
                            setActionError(e instanceof Error ? e.message : 'Close failed')
                          );
                        }}
                        className="text-red-400 hover:underline cursor-pointer"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'ORDERS' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[#0A0F1A] text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-3">Ticket</th>
                <th className="py-1.5 px-3">Symbol</th>
                <th className="py-1.5 px-3">Type</th>
                <th className="py-1.5 px-3 text-right">Volume</th>
                <th className="py-1.5 px-3 text-right">Price</th>
                <th className="py-1.5 px-3 text-right">SL / TP</th>
                <th className="py-1.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-500">
                    No active pending orders.
                  </td>
                </tr>
              ) : (
                pendingOrders.map((o) => (
                  <tr key={o.ticket} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-3">#{o.ticket}</td>
                    <td className="py-1.5 px-3 font-sans font-semibold text-white">{o.symbol}</td>
                    <td className="py-1.5 px-3 text-cyan-300">{o.orderType}</td>
                    <td className="py-1.5 px-3 text-right">{o.volume}</td>
                    <td className="py-1.5 px-3 text-right">{o.price}</td>
                    <td className="py-1.5 px-3 text-right text-slate-400">
                      {o.sl || '—'} / {o.tp || '—'}
                    </td>
                    <td className="py-1.5 px-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => void cancelOrder(o.ticket)}
                        className="text-red-400 hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'HISTORY' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[#0A0F1A] text-[11px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-3">Time</th>
                <th className="py-1.5 px-3">Ticket</th>
                <th className="py-1.5 px-3">Symbol</th>
                <th className="py-1.5 px-3">Side</th>
                <th className="py-1.5 px-3 text-right">Volume</th>
                <th className="py-1.5 px-3 text-right">Price</th>
                <th className="py-1.5 px-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-sans text-slate-500">
                    No closed broker deals retrieved yet.
                  </td>
                </tr>
              ) : (
                deals.slice(0, 80).map((d) => (
                  <tr key={d.ticket} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-3 text-slate-400">
                      {new Date(d.time).toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-1.5 px-3">#{d.ticket}</td>
                    <td className="py-1.5 px-3 font-sans text-white">{d.symbol || 'ACCOUNT'}</td>
                    <td className="py-1.5 px-3 font-sans">{d.side}</td>
                    <td className="py-1.5 px-3 text-right">{d.volume}</td>
                    <td className="py-1.5 px-3 text-right">{d.price}</td>
                    <td
                      className={`py-1.5 px-3 text-right font-semibold ${
                        d.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {d.profit >= 0 ? '+' : ''}
                      {d.profit.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'LOGS' && (
          <div className="divide-y divide-slate-800/50 text-xs">
            {autoLogs.length === 0 && auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No execution or audit events recorded yet.</div>
            ) : (
              <>
                {autoLogs.map((l) => (
                  <div key={l.id} className="px-3 py-1.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-mono-tabular text-slate-500 mr-2">
                        {new Date(l.timestamp).toISOString().slice(11, 19)}
                      </span>
                      <span className="font-semibold text-cyan-300 mr-2">{l.strategyName}</span>
                      <span className="text-slate-300">{l.reason}</span>
                    </div>
                    <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                      {l.symbol} · {l.signal}
                    </span>
                  </div>
                ))}
                {auditLogs.map((a) => (
                  <div key={a.id} className="px-3 py-1.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-semibold text-white mr-2">{a.action}</span>
                      <span className="text-slate-400">{a.details}</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono-tabular shrink-0 ${
                        a.severity === 'CRITICAL'
                          ? 'text-red-400'
                          : a.severity === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {a.category} · {a.symbol}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'ALERTS' && (
          <div className="p-3 space-y-3">
            <form onSubmit={(e) => void handleCreateAlert(e)} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-white">{selectedSymbol}</span>
              <select
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as TradingAlert['alertType'])}
                className="bg-[#060911] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="PRICE">Price</option>
                <option value="SPREAD">Spread (pts)</option>
              </select>
              <select
                value={alertCond}
                onChange={(e) => setAlertCond(e.target.value as TradingAlert['condition'])}
                className="bg-[#060911] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="ABOVE">Above &ge;</option>
                <option value="BELOW">Below &le;</option>
                <option value="CROSS">Cross</option>
              </select>
              <input
                type="number"
                step="any"
                required
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="Threshold"
                className="w-28 bg-[#060911] border border-slate-800 rounded px-2 py-1 font-mono-tabular text-xs text-white"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertBrowserNotify}
                  onChange={(e) => setAlertBrowserNotify(e.target.checked)}
                />
                Browser Notify
              </label>
              <button
                type="submit"
                className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/35 text-cyan-300 text-xs font-medium rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Bell className="w-3 h-3" />
                Add Alert
              </button>
            </form>

            <div className="divide-y divide-slate-800/60 text-xs">
              {alerts.map((al) => (
                <div key={al.id} className="py-1.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 font-mono-tabular">
                    <span className="font-sans font-semibold text-white">{al.symbol}</span>
                    <span className="text-slate-400">
                      {al.alertType} {al.condition} {al.threshold}
                    </span>
                    <span
                      className={`font-sans text-[11px] ${
                        al.status === 'TRIGGERED'
                          ? 'text-amber-400 font-semibold'
                          : al.status === 'ARMED'
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {al.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {al.status === 'TRIGGERED' && (
                      <button
                        type="button"
                        onClick={() => void updateAlertStatus(al.id, 'DISMISSED')}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteAlert(al.id)}
                      className="text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modify / Partial Close Position Modal */}
      {editingPos && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#0B101B] border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Edit3 className="w-4 h-4" />
                <h3 className="font-display text-sm font-bold text-white">
                  Manage Position #{editingPos.ticket} ({editingPos.symbol})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPos(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={editSl}
                  onChange={(e) => setEditSl(e.target.value)}
                  className="w-full bg-[#060911] border border-slate-800 rounded px-2 py-1.5 font-mono-tabular text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={editTp}
                  onChange={(e) => setEditTp(e.target.value)}
                  className="w-full bg-[#060911] border border-slate-800 rounded px-2 py-1.5 font-mono-tabular text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveSlTp()}
              className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded cursor-pointer"
            >
              Update SL / TP on MT5
            </button>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-[11px] text-slate-400">Partial / Full Close Volume</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  max={editingPos.volume}
                  min={0.01}
                  value={partialLots}
                  onChange={(e) => setPartialLots(e.target.value)}
                  className="flex-1 bg-[#060911] border border-slate-800 rounded px-2 py-1.5 font-mono-tabular text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    void closePosition(editingPos.ticket, Number(partialLots))
                      .then(() => setEditingPos(null))
                      .catch((e) => setActionError(e instanceof Error ? e.message : 'Close failed'));
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded cursor-pointer"
                >
                  Close Lots
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
