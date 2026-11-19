import React, { useEffect, useState } from 'react';
import { OctagonAlert, PlugZap, LogOut, CandlestickChart, Globe2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { NavSection } from '../types/trading.ts';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Account Overview',
  terminal: 'Trading Terminal',
  globe: 'Global Liquidity Globe',
  'market-watch': 'Market Watch',
  forex: 'Forex Markets',
  metals: 'Precious Metals',
  commodities: 'Energy & Commodities',
  indices: 'Global Indices',
  stocks: 'Global Equity CFDs',
  crypto: 'Digital Assets & Crypto',
  'auto-trading': 'Automated Trading Engine',
  'strategy-builder': 'Deterministic Strategy Builder',
  positions: 'Open Positions',
  'pending-orders': 'Pending Orders',
  history: 'Account & Execution History',
  analytics: 'Portfolio Analytics',
  news: 'Market News Intelligence',
  calendar: 'Economic Calendar',
  'broker-connection': 'Exness MT5 Bridge Connection',
  settings: 'Workstation Settings',
};

export const TopBar: React.FC = () => {
  const { user, signOut } = useAuth();
  const {
    activeSection,
    setActiveSection,
    terminalTab,
    setTerminalTab,
    bridgeStatus,
    emergencyStopAll,
    strategies,
    positions,
  } = useTrading();

  const [utcClock, setUtcClock] = useState<string>(() => new Date().toISOString().slice(11, 19));
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setUtcClock(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const acc = bridgeStatus.account;
  const activeAutoCount = strategies.filter((s) => s.isLiveEnabled && s.status === 'ACTIVE').length;

  const handleEmergencyStop = async (closePositions: boolean) => {
    setStopping(true);
    try {
      await emergencyStopAll(closePositions);
      setConfirmStopOpen(false);
    } finally {
      setStopping(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-[#080C15] border-b border-slate-800/80 px-4 flex items-center justify-between gap-4 shrink-0">
        {/* Left: Section Context & Quick Workspace Switcher */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
            <span className="font-semibold text-white">{SECTION_TITLES[activeSection]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-400">{utcClock} UTC</span>
          </div>

          {activeSection === 'terminal' && (
            <div className="hidden sm:flex items-center gap-1 p-0.5 bg-[#0D1322] border border-slate-800 rounded">
              <button
                type="button"
                onClick={() => setTerminalTab('CHART')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  terminalTab === 'CHART'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CandlestickChart className="w-3.5 h-3.5" />
                MT5 Charting
              </button>
              <button
                type="button"
                onClick={() => setTerminalTab('GLOBE')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  terminalTab === 'GLOBE'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                3D Liquidity Globe
              </button>
            </div>
          )}
        </div>

        {/* Center/Right: Authentic Account Telemetry & Safety Actions */}
        <div className="flex items-center gap-4 shrink-0">
          {bridgeStatus.connected && acc ? (
            <div className="hidden xl:flex items-center gap-4 text-xs font-mono-tabular border-r border-slate-800 pr-4">
              <div>
                <span className="text-slate-500 mr-1.5">{acc.accountType}</span>
                <span className="text-slate-200 font-medium">#{acc.login}</span>
              </div>
              <div>
                <span className="text-slate-500 mr-1.5">Bal</span>
                <span className="text-slate-100">
                  {acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.currency}
                </span>
              </div>
              <div>
                <span className="text-slate-500 mr-1.5">Eq</span>
                <span className="text-white font-semibold">
                  {acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 mr-1.5">PnL</span>
                <span className={acc.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {acc.floatingPnl >= 0 ? '+' : ''}
                  {acc.floatingPnl.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 mr-1.5">Margin Lvl</span>
                <span className={acc.marginLevel > 0 && acc.marginLevel < 150 ? 'text-amber-400' : 'text-slate-200'}>
                  {acc.marginLevel > 0 ? `${acc.marginLevel.toFixed(0)}%` : '—'}
                </span>
              </div>
              {bridgeStatus.stale && (
                <span className="text-amber-400 font-sans text-[11px] font-medium">STALE SYNC</span>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-r border-slate-800 pr-4">
              <span>Exness MT5:</span>
              <span className="text-amber-400 font-medium">Disconnected</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmStopOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            Emergency Stop{activeAutoCount > 0 ? ` (${activeAutoCount})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('broker-connection')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
              bridgeStatus.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 border-cyan-400 text-slate-950 font-semibold'
            }`}
          >
            <PlugZap className="w-3.5 h-3.5" />
            {bridgeStatus.connected ? 'MT5 Connected' : 'Connect MT5'}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            title={`Signed in as ${user?.email || 'Trader'}`}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Emergency Stop Confirmation Modal */}
      {confirmStopOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-red-500/40 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <OctagonAlert className="w-5 h-5" />
              <h2 className="font-display text-base font-semibold text-white">
                Confirm Emergency Stop All
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will immediately halt all automated strategies ({activeAutoCount} currently active) and prevent any new automated order submissions. You can optionally request closure of all open MT5 positions ({positions.length} open).
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={stopping}
                onClick={() => void handleEmergencyStop(false)}
                className="w-full py-2 px-4 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded transition-colors cursor-pointer"
              >
                {stopping ? 'Halting...' : 'Halt All Automation Only'}
              </button>
              <button
                type="button"
                disabled={stopping}
                onClick={() => void handleEmergencyStop(true)}
                className="w-full py-2 px-4 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded transition-colors cursor-pointer"
              >
                {stopping
                  ? 'Executing Emergency Liquidation...'
                  : `Halt Automation & Close All Open Positions (${positions.length})`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmStopOpen(false)}
                className="w-full py-2 px-4 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
