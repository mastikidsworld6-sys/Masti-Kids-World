import React, { useState } from 'react';
import {
  Bot,
  Play,
  Pause,
  OctagonAlert,
  ShieldAlert,
  Trash2,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { AutomatedStrategy, SessionFilter, StrategyTemplate } from '../types/trading.ts';

interface AutoTradingWorkspaceProps {
  initialMode?: 'ENGINE' | 'BUILDER';
}

export const AutoTradingWorkspace: React.FC<AutoTradingWorkspaceProps> = ({
  initialMode = 'ENGINE',
}) => {
  const {
    strategies,
    autoLogs,
    bridgeStatus,
    allSymbols,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    emergencyStopAll,
    setActiveSection,
  } = useTrading();

  const [tab, setTab] = useState<'ENGINE' | 'BUILDER'>(initialMode);
  const [activationTarget, setActivationTarget] = useState<AutomatedStrategy | null>(null);

  // Strategy Builder state
  const [name, setName] = useState('London Momentum EMA');
  const [template, setTemplate] = useState<StrategyTemplate>('EMA_CROSS');
  const [symbolsInput, setSymbolsInput] = useState('EURUSD, XAUUSD');
  const [timeframe, setTimeframe] = useState<AutomatedStrategy['timeframe']>('M15');
  const [lotSize, setLotSize] = useState(0.02);
  const [riskPerTradePct, setRiskPerTradePct] = useState(1.0);
  const [stopLossPips, setStopLossPips] = useState(25);
  const [takeProfitPips, setTakeProfitPips] = useState(50);
  const [trailingStopPips, setTrailingStopPips] = useState(15);
  const [maxSimultaneousPositions, setMaxSimultaneousPositions] = useState(3);
  const [maxSpreadPoints, setMaxSpreadPoints] = useState(30);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('LONDON_NY_OVERLAP');
  const [dailyLossLimitUsd, setDailyLossLimitUsd] = useState(250);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(5.0);
  const [maxTotalExposureLots, setMaxTotalExposureLots] = useState(0.5);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSymbols = symbolsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (parsedSymbols.length === 0) return;
    setSaving(true);
    try {
      await createStrategy({
        name: name.trim() || 'Deterministic Strategy',
        template,
        symbols: parsedSymbols,
        timeframe,
        lotSize,
        riskPerTradePct,
        stopLossPips,
        takeProfitPips,
        trailingStopPips,
        maxSimultaneousPositions,
        maxSpreadPoints,
        sessionFilter,
        dailyLossLimitUsd,
        maxDrawdownPct,
        maxTotalExposureLots,
        isLiveEnabled: false,
        status: 'PAUSED',
      });
      setTab('ENGINE');
    } finally {
      setSaving(false);
    }
  };

  const confirmLiveActivation = async () => {
    if (!activationTarget) return;
    await updateStrategy(activationTarget.id, {
      isLiveEnabled: true,
      status: 'ACTIVE',
    });
    setActivationTarget(null);
  };

  const pauseAll = async () => {
    await Promise.all(
      strategies.map((s) => updateStrategy(s.id, { isLiveEnabled: false, status: 'PAUSED' }))
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Automated Trading & Deterministic Risk Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            All automated orders are evaluated strictly by deterministic rules against live MT5 quotes and require explicit live activation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0B101B] border border-slate-800 p-0.5 rounded">
            <button
              type="button"
              onClick={() => setTab('ENGINE')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
                tab === 'ENGINE' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Engine ({strategies.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('BUILDER')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
                tab === 'BUILDER' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Strategy Builder
            </button>
          </div>

          <button
            type="button"
            onClick={() => void pauseAll()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
          >
            Pause All
          </button>
          <button
            type="button"
            onClick={() => void emergencyStopAll(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded cursor-pointer"
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            Stop All Automation
          </button>
        </div>
      </div>

      {!bridgeStatus.connected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 flex items-center justify-between gap-4 text-xs text-amber-200">
          <span>
            Exness MT5 Bridge is currently offline. Automated strategies remain safely paused and cannot submit orders until the broker bridge is connected.
          </span>
          <button
            type="button"
            onClick={() => setActiveSection('broker-connection')}
            className="px-3 py-1.5 bg-cyan-500 text-slate-950 font-semibold rounded shrink-0 cursor-pointer"
          >
            Connect MT5
          </button>
        </div>
      )}

      {tab === 'ENGINE' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Strategy Cards */}
          <div className="lg:col-span-7 space-y-3">
            {strategies.length === 0 ? (
              <div className="bg-[#0B101B] border border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Bot className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-sm font-semibold text-white">No Configured Strategies</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Create a deterministic rule template in the Strategy Builder with explicit spread filters, daily loss limits, and drawdown safeguards.
                </p>
                <button
                  type="button"
                  onClick={() => setTab('BUILDER')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 text-slate-950 font-semibold text-xs rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Strategy
                </button>
              </div>
            ) : (
              strategies.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#0B101B] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-white">{s.name}</span>
                        <span
                          className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded border ${
                            s.isLiveEnabled && s.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                              : s.status === 'HALTED'
                              ? 'bg-red-500/15 border-red-500/35 text-red-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {s.isLiveEnabled && s.status === 'ACTIVE' ? 'LIVE ACTIVE' : s.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {s.template} · {s.timeframe} · {s.symbols.join(', ')} · Session: {s.sessionFilter}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {s.isLiveEnabled && s.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() =>
                            void updateStrategy(s.id, { isLiveEnabled: false, status: 'PAUSED' })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-200 border border-amber-500/35 rounded text-xs cursor-pointer"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivationTarget(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 rounded text-xs cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          Enable Live
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteStrategy(s.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono-tabular">
                    <div>
                      <span className="text-slate-500 block font-sans">Lot / Risk</span>
                      <span className="text-slate-200">
                        {s.lotSize} lots · {s.riskPerTradePct}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">SL / TP / Trail</span>
                      <span className="text-slate-200">
                        {s.stopLossPips} / {s.takeProfitPips} / {s.trailingStopPips}p
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Max Spread / Pos</span>
                      <span className="text-slate-200">
                        {s.maxSpreadPoints} pts · {s.maxSimultaneousPositions}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Daily Loss / DD</span>
                      <span className="text-slate-200">
                        ${s.dailyLossLimitUsd} · {s.maxDrawdownPct}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Deterministic Execution & Risk Logs */}
          <div className="lg:col-span-5 bg-[#0B101B] border border-slate-800 rounded-xl p-4 flex flex-col max-h-[540px]">
            <div className="text-xs font-semibold text-white pb-2 border-b border-slate-800">
              Automation Signal & Risk Ledger
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs mt-1">
              {autoLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  No automated signals or executions logged in this session.
                </div>
              ) : (
                autoLogs.map((l) => (
                  <div key={l.id} className="py-2 space-y-0.5">
                    <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                      <span className="text-cyan-300 font-semibold">
                        {l.strategyName} · {l.symbol}
                      </span>
                      <span className="text-slate-500">
                        {new Date(l.timestamp).toISOString().slice(11, 19)} UTC
                      </span>
                    </div>
                    <div className="text-slate-300">{l.reason}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Strategy Builder Form */
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="bg-[#0B101B] border border-slate-800 rounded-xl p-6 space-y-5 max-w-4xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Strategy Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Deterministic Rule Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as StrategyTemplate)}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white"
              >
                <option value="EMA_CROSS">EMA (9/21) Momentum Crossover</option>
                <option value="RSI_REVERSION">RSI (14) Oversold/Overbought Reversion</option>
                <option value="MACD_MOMENTUM">MACD (12,26,9) Signal Cross</option>
                <option value="BB_BREAKOUT">Bollinger Band (20,2) Breakout</option>
                <option value="ATR_TREND">ATR Volatility Trend Following</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as AutomatedStrategy['timeframe'])}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white"
              >
                {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">
              Target Instruments (comma-separated, max 10 · Available:{' '}
              {allSymbols.slice(0, 6).map((s) => s.symbol).join(', ')})
            </label>
            <input
              type="text"
              required
              value={symbolsInput}
              onChange={(e) => setSymbolsInput(e.target.value)}
              className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Lot Size</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={lotSize}
                onChange={(e) => setLotSize(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Risk Per Trade (%)</label>
              <input
                type="number"
                step="0.1"
                min="0.05"
                max="10"
                value={riskPerTradePct}
                onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Stop Loss (Pips)</label>
              <input
                type="number"
                min="0"
                value={stopLossPips}
                onChange={(e) => setStopLossPips(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Take Profit (Pips)</label>
              <input
                type="number"
                min="0"
                value={takeProfitPips}
                onChange={(e) => setTakeProfitPips(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Trailing Stop (Pips)</label>
              <input
                type="number"
                min="0"
                value={trailingStopPips}
                onChange={(e) => setTrailingStopPips(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Max Simultaneous Pos</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxSimultaneousPositions}
                onChange={(e) => setMaxSimultaneousPositions(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Max Spread (Points)</label>
              <input
                type="number"
                min="0"
                value={maxSpreadPoints}
                onChange={(e) => setMaxSpreadPoints(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Session Filter</label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value as SessionFilter)}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white"
              >
                <option value="ALL">24/7 All Sessions</option>
                <option value="LONDON">London (07-16 UTC)</option>
                <option value="NEW_YORK">New York (12-21 UTC)</option>
                <option value="TOKYO">Tokyo (00-09 UTC)</option>
                <option value="LONDON_NY_OVERLAP">London/NY Overlap</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Daily Loss Limit ($)</label>
              <input
                type="number"
                min="1"
                value={dailyLossLimitUsd}
                onChange={(e) => setDailyLossLimitUsd(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Max Drawdown (%)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                value={maxDrawdownPct}
                onChange={(e) => setMaxDrawdownPct(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Max Total Exposure (Lots)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={maxTotalExposureLots}
                onChange={(e) => setMaxTotalExposureLots(Number(e.target.value))}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg cursor-pointer"
          >
            {saving ? 'Saving Strategy...' : 'Save Strategy (Paused by Default)'}
          </button>
        </form>
      )}

      {/* Explicit Live Automated Execution Authorization Modal */}
      {activationTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-amber-500/40 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-white">
                Authorize Live Automated Trading
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Review all risk parameters before authorizing <strong>{activationTarget.name}</strong> to transmit real MT5 orders when bridge connectivity and permissions are active:
            </p>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs border-t border-b border-slate-800 py-3 font-mono-tabular">
              <div className="text-slate-400 font-sans">Strategy</div>
              <div className="text-right text-white">{activationTarget.template}</div>
              <div className="text-slate-400 font-sans">Instruments</div>
              <div className="text-right text-cyan-300">{activationTarget.symbols.join(', ')}</div>
              <div className="text-slate-400 font-sans">Position Size / Risk</div>
              <div className="text-right text-white">
                {activationTarget.lotSize} lots ({activationTarget.riskPerTradePct}%)
              </div>
              <div className="text-slate-400 font-sans">Daily Loss Limit</div>
              <div className="text-right text-amber-300">${activationTarget.dailyLossLimitUsd}</div>
              <div className="text-slate-400 font-sans">Max Drawdown</div>
              <div className="text-right text-red-300">{activationTarget.maxDrawdownPct}%</div>
              <div className="text-slate-400 font-sans">Account Permissions</div>
              <div className="text-right font-sans text-slate-200">
                {bridgeStatus.account?.algoTradingAllowed ? 'Algo Allowed' : 'Requires MT5 Algo On'}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActivationTarget(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
              >
                Keep Paused
              </button>
              <button
                type="button"
                onClick={() => void confirmLiveActivation()}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enable Live Trading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
