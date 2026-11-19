import React, { useMemo, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { OrderCheckResult, OrderExecutionResult } from '../types/trading.ts';

export const OrderEntryPanel: React.FC = () => {
  const {
    selectedSymbol,
    allSymbols,
    bridgeStatus,
    checkOrder,
    sendOrder,
    setActiveSection,
    askAiAnalyst,
  } = useTrading();

  const symSpec = useMemo(
    () => allSymbols.find((s) => s.symbol === selectedSymbol),
    [allSymbols, selectedSymbol]
  );

  const [orderType, setOrderType] = useState<'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP'>('MARKET');
  const [volume, setVolume] = useState<string>('0.01');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [sl, setSl] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [comment, setComment] = useState<string>('QUANTX');

  const [pendingSide, setPendingSide] = useState<'BUY' | 'SELL' | null>(null);
  const [preCheck, setPreCheck] = useState<OrderCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<OrderExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Read-only AI Market Analyst state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const numericVol = Number(volume) || 0;

  const validateClientSide = (): string | null => {
    if (!bridgeStatus.connected) {
      return 'Connect your Exness MT5 Bridge to execute orders.';
    }
    if (!symSpec || !symSpec.tradeable) {
      return `${selectedSymbol} is not tradeable on your connected Exness MT5 account.`;
    }
    if (numericVol <= 0) return 'Lot size must be positive.';
    if (numericVol < symSpec.volumeMin || numericVol > symSpec.volumeMax) {
      return `Lot size must be between ${symSpec.volumeMin} and ${symSpec.volumeMax}.`;
    }
    const stepRatio = (numericVol - symSpec.volumeMin) / symSpec.volumeStep;
    if (Math.abs(stepRatio - Math.round(stepRatio)) > 1e-4) {
      return `Lot size must increment by ${symSpec.volumeStep}.`;
    }
    if (orderType !== 'MARKET' && (!targetPrice || Number(targetPrice) <= 0)) {
      return 'Pending order requires a valid entry price.';
    }
    return null;
  };

  const initiateOrder = async (side: 'BUY' | 'SELL') => {
    setExecError(null);
    setExecResult(null);
    const err = validateClientSide();
    if (err) {
      setExecError(err);
      return;
    }

    setChecking(true);
    try {
      const check = await checkOrder({
        symbol: selectedSymbol,
        side,
        orderType,
        volume: numericVol,
        price: orderType === 'MARKET' ? undefined : Number(targetPrice),
        sl: sl ? Number(sl) : undefined,
        tp: tp ? Number(tp) : undefined,
      });
      setPreCheck(check);
      setPendingSide(side);
    } catch (e) {
      setExecError(e instanceof Error ? e.message : 'MT5 pre-trade margin check failed.');
    } finally {
      setChecking(false);
    }
  };

  const confirmExecution = async () => {
    if (!pendingSide) return;
    setSubmitting(true);
    setExecError(null);
    try {
      const res = await sendOrder({
        symbol: selectedSymbol,
        side: pendingSide,
        orderType,
        volume: numericVol,
        price: orderType === 'MARKET' ? undefined : Number(targetPrice),
        sl: sl ? Number(sl) : undefined,
        tp: tp ? Number(tp) : undefined,
        comment: comment.slice(0, 31),
      });
      setExecResult(res);
      setPendingSide(null);
      setPreCheck(null);
    } catch (e) {
      setExecError(e instanceof Error ? e.message : 'Broker order submission failed.');
      setPendingSide(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskAnalyst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const ans = await askAiAnalyst(aiQuestion.trim());
      setAiAnswer(ans);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI Analyst error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#080C15] border-l border-slate-800/80 overflow-y-auto">
      {/* Order Ticket Section */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">Order Execution</div>
            <div className="text-[11px] text-slate-400">
              {selectedSymbol} · {symSpec?.provider || 'No Broker Feed'}
            </div>
          </div>
          <span
            className={`text-[10px] font-mono-tabular font-semibold ${
              symSpec?.tradeable && bridgeStatus.connected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {symSpec?.tradeable && bridgeStatus.connected ? 'READY' : 'READ-ONLY'}
          </span>
        </div>

        {/* Live Bid / Ask Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#060911] border border-red-500/25 rounded p-2 text-center">
            <div className="text-[10px] text-red-400 font-medium">SELL / BID</div>
            <div className="font-mono-tabular text-sm font-bold text-white">
              {symSpec ? symSpec.bid.toFixed(symSpec.digits) : '—'}
            </div>
          </div>
          <div className="bg-[#060911] border border-emerald-500/25 rounded p-2 text-center">
            <div className="text-[10px] text-emerald-400 font-medium">BUY / ASK</div>
            <div className="font-mono-tabular text-sm font-bold text-white">
              {symSpec ? symSpec.ask.toFixed(symSpec.digits) : '—'}
            </div>
          </div>
        </div>

        {/* Order Type */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Execution Type</label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as typeof orderType)}
            className="w-full bg-[#060911] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="MARKET">Market Execution</option>
            <option value="BUY_LIMIT">Buy Limit (Pending)</option>
            <option value="SELL_LIMIT">Sell Limit (Pending)</option>
            <option value="BUY_STOP">Buy Stop (Pending)</option>
            <option value="SELL_STOP">Sell Stop (Pending)</option>
          </select>
        </div>

        {/* Lot Size */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <label className="text-slate-400">Volume (Lots)</label>
            {symSpec && (
              <span className="font-mono-tabular text-slate-500">
                Min {symSpec.volumeMin} · Step {symSpec.volumeStep}
              </span>
            )}
          </div>
          <input
            type="number"
            step={symSpec?.volumeStep ?? 0.01}
            min={symSpec?.volumeMin ?? 0.01}
            max={symSpec?.volumeMax ?? 100}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="w-full bg-[#060911] border border-slate-800 rounded px-2.5 py-1.5 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
          />
        </div>

        {orderType !== 'MARKET' && (
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Trigger Price</label>
            <input
              type="number"
              step={symSpec?.point ?? 0.0001}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              className="w-full bg-[#060911] border border-slate-800 rounded px-2.5 py-1.5 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>
        )}

        {/* SL & TP */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Stop Loss</label>
            <input
              type="number"
              step={symSpec?.point ?? 0.0001}
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="Optional"
              className="w-full bg-[#060911] border border-slate-800 rounded px-2 py-1.5 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Take Profit</label>
            <input
              type="number"
              step={symSpec?.point ?? 0.0001}
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder="Optional"
              className="w-full bg-[#060911] border border-slate-800 rounded px-2 py-1.5 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Order Comment</label>
          <input
            type="text"
            maxLength={31}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full bg-[#060911] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
          />
        </div>

        {/* Buy / Sell Controls */}
        {bridgeStatus.connected ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={checking || submitting}
              onClick={() => void initiateOrder('SELL')}
              className="py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              {checking ? 'Checking...' : 'Sell Order'}
            </button>
            <button
              type="button"
              disabled={checking || submitting}
              onClick={() => void initiateOrder('BUY')}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              {checking ? 'Checking...' : 'Buy Order'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveSection('broker-connection')}
            className="w-full py-2 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            Connect Exness MT5 to Trade
          </button>
        )}

        {execError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded p-2.5 text-[11px] text-red-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{execError}</span>
          </div>
        )}

        {execResult && (
          <div
            className={`rounded p-2.5 text-[11px] border flex items-start gap-2 ${
              execResult.executed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="space-y-0.5 font-mono-tabular">
              <div className="font-sans font-semibold">
                {execResult.executed ? 'Broker Execution Confirmed' : 'Broker Order Rejected'}
              </div>
              <div>
                Ticket #{execResult.ticket} · Price {execResult.price} · Vol {execResult.volume}
              </div>
              <div className="text-slate-300 font-sans">{execResult.comment}</div>
            </div>
          </div>
        )}
      </div>

      {/* Read-Only AI Market & Strategy Analyst */}
      <div className="p-3.5 space-y-2.5 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Market & Strategy Analyst</span>
          </div>
          <span className="text-[10px] text-violet-300">Read-Only</span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Advisory analysis grounded in live quotes and price action. Never places or modifies orders.
        </p>

        <form onSubmit={(e) => void handleAskAnalyst(e)} className="space-y-2">
          <textarea
            rows={2}
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            placeholder={`Ask about ${selectedSymbol} structure, volatility, or risk...`}
            className="w-full bg-[#060911] border border-slate-800 rounded p-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-violet-500 resize-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuestion.trim()}
            className="w-full py-1.5 px-3 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 border border-violet-500/35 text-violet-200 text-xs font-medium rounded transition-colors cursor-pointer"
          >
            {aiLoading ? 'Analyzing Context...' : 'Analyze Selected Market'}
          </button>
        </form>

        {aiError && <div className="text-[11px] text-red-400">{aiError}</div>}

        {aiAnswer && (
          <div className="bg-[#060911] border border-slate-800 rounded p-2.5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {aiAnswer}
          </div>
        )}
      </div>

      {/* Pre-Submission Order Confirmation Modal */}
      {pendingSide && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0B101B] border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-white">
                Confirm MT5 Order Submission
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-xs border-t border-b border-slate-800 py-3 font-mono-tabular">
              <div className="text-slate-400 font-sans">Instrument</div>
              <div className="text-right text-white font-semibold">{selectedSymbol}</div>

              <div className="text-slate-400 font-sans">Direction / Type</div>
              <div
                className={`text-right font-semibold ${
                  pendingSide === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {pendingSide} · {orderType}
              </div>

              <div className="text-slate-400 font-sans">Volume</div>
              <div className="text-right text-white">{numericVol} lots</div>

              <div className="text-slate-400 font-sans">Stop Loss / Take Profit</div>
              <div className="text-right text-slate-200">
                {sl || 'None'} / {tp || 'None'}
              </div>

              <div className="text-slate-400 font-sans">MT5 Pre-Check Margin</div>
              <div className="text-right text-cyan-300">
                {preCheck ? `${preCheck.margin.toFixed(2)} (Free: ${preCheck.freeMargin.toFixed(2)})` : '—'}
              </div>

              <div className="text-slate-400 font-sans">MT5 Check Status</div>
              <div
                className={`text-right font-sans ${
                  preCheck?.valid ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {preCheck?.valid ? 'Passed' : preCheck?.comment || 'Check warning'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingSide(null);
                  setPreCheck(null);
                }}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmExecution()}
                className={`flex-1 py-2 px-3 text-white text-xs font-semibold rounded cursor-pointer ${
                  pendingSide === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {submitting ? 'Awaiting MT5 Broker...' : `Transmit ${pendingSide} Order`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
