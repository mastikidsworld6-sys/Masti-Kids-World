import React, { useState } from 'react';
import { Bell, ShieldCheck, Globe2, CandlestickChart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useTrading } from '../contexts/TradingContext.tsx';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const {
    auditLogs,
    bridgeStatus,
    terminalTab,
    setTerminalTab,
    globeMode,
    setGlobeMode,
    setActiveSection,
  } = useTrading();

  const [notifStatus, setNotifStatus] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#060911] p-5 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Session & Security */}
        <section className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
            <h1 className="font-display text-sm font-semibold text-white">
              Workstation Security &amp; Session
            </h1>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Authenticated Operator</span>
              <span className="text-slate-100 font-medium">{user?.email || user?.uid}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">MT5 Bridge State</span>
              <span className={bridgeStatus.connected ? 'text-emerald-400' : 'text-amber-400'}>
                {bridgeStatus.connected
                  ? `Connected (${bridgeStatus.account?.accountType} #${bridgeStatus.account?.login})`
                  : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
              <span className="text-slate-400">Credential Storage Policy</span>
              <span className="text-slate-200">Memory-only session · Never stored in browser</span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <div className="text-xs">
              <div className="text-slate-200 font-medium flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                Browser Alert Notifications
              </div>
              <div className="text-[11px] text-slate-400">Permission: {notifStatus}</div>
            </div>
            <button
              type="button"
              onClick={() => void requestNotifications()}
              className="px-3 py-1.5 text-xs font-medium bg-[#121A2B] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer whitespace-nowrap"
            >
              Enable Alerts
            </button>
          </div>
        </section>

        {/* Workspace Layout Defaults */}
        <section className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-white">
            Terminal &amp; Globe Preferences
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <div className="text-slate-400 mb-1.5">Active Terminal Center View</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTerminalTab('CHART');
                    setActiveSection('terminal');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer ${
                    terminalTab === 'CHART'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#060911] border-slate-800 text-slate-400'
                  }`}
                >
                  <CandlestickChart className="w-3.5 h-3.5" />
                  MT5 Charting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTerminalTab('GLOBE');
                    setActiveSection('terminal');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer ${
                    terminalTab === 'GLOBE'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#060911] border-slate-800 text-slate-400'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  3D Liquidity Globe
                </button>
              </div>
            </div>

            <div>
              <div className="text-slate-400 mb-1.5">3D Global Liquidity Globe Layer Mode</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['COMBINED', 'NETWORK', 'ACTIVITY', 'ACCOUNT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGlobeMode(m)}
                    className={`px-2.5 py-1 text-[11px] rounded border cursor-pointer ${
                      globeMode === m
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#060911] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Immutable Audit Log Viewer */}
      <section className="bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">
            Immutable Security &amp; Execution Audit Trail
          </h2>
          <span className="text-[11px] text-slate-400 font-mono-tabular">
            {auditLogs.length} entries
          </span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Symbol / Context</th>
                <th className="text-left px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono-tabular text-cyan-400">{log.category}</td>
                    <td
                      className={`px-3 py-2 font-mono-tabular ${
                        log.severity === 'CRITICAL'
                          ? 'text-red-400'
                          : log.severity === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.severity}
                    </td>
                    <td className="px-3 py-2 text-white font-medium">{log.action}</td>
                    <td className="px-3 py-2 font-mono-tabular text-slate-300">{log.symbol}</td>
                    <td className="px-4 py-2 text-slate-400">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
