import type {
  AutomatedStrategy,
  CandleBar,
  StrategyRuntimeLog,
  Timeframe,
} from '../src/types/trading.ts';
import { mt5Relay } from './mt5Relay.ts';

function computeEma(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const val = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

function computeRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function isInSession(filter: AutomatedStrategy['sessionFilter']): boolean {
  if (filter === 'ALL') return true;
  const utcHour = new Date().getUTCHours();
  if (filter === 'TOKYO') return utcHour >= 0 && utcHour < 9;
  if (filter === 'LONDON') return utcHour >= 7 && utcHour < 16;
  if (filter === 'NEW_YORK') return utcHour >= 12 && utcHour < 21;
  if (filter === 'LONDON_NY_OVERLAP') return utcHour >= 12 && utcHour < 16;
  return true;
}

export class DeterministicAutoEngine {
  private activeStrategies = new Map<string, AutomatedStrategy[]>(); // uid -> strategies
  private runtimeLogs = new Map<string, StrategyRuntimeLog[]>(); // uid -> logs
  private executionLocks = new Set<string>(); // idempotency key: uid:strategyId:symbol:candleTime
  private timer: NodeJS.Timeout | null = null;
  private onLogListeners = new Set<(uid: string, log: StrategyRuntimeLog) => void>();

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.evaluateAll();
    }, 10000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onLog(cb: (uid: string, log: StrategyRuntimeLog) => void): () => void {
    this.onLogListeners.add(cb);
    return () => this.onLogListeners.delete(cb);
  }

  setStrategies(uid: string, strategies: AutomatedStrategy[]): void {
    this.activeStrategies.set(uid, strategies);
  }

  getStrategies(uid: string): AutomatedStrategy[] {
    return this.activeStrategies.get(uid) || [];
  }

  getLogs(uid: string): StrategyRuntimeLog[] {
    return this.runtimeLogs.get(uid) || [];
  }

  private pushLog(uid: string, entry: Omit<StrategyRuntimeLog, 'id' | 'timestamp'>): StrategyRuntimeLog {
    const full: StrategyRuntimeLog = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const list = this.runtimeLogs.get(uid) || [];
    const updated = [full, ...list].slice(0, 200);
    this.runtimeLogs.set(uid, updated);
    for (const listener of this.onLogListeners) {
      listener(uid, full);
    }
    return full;
  }

  async emergencyStopAll(uid: string, closeOpenPositions = false): Promise<{
    haltedCount: number;
    closedTickets: number[];
    errors: string[];
  }> {
    const strategies = this.getStrategies(uid).map((s) => ({
      ...s,
      isLiveEnabled: false,
      status: 'HALTED' as const,
    }));
    this.activeStrategies.set(uid, strategies);

    this.pushLog(uid, {
      strategyId: 'EMERGENCY_STOP',
      strategyName: 'Global Risk Guard',
      symbol: 'ALL',
      signal: 'RISK_BLOCK',
      reason: 'EMERGENCY STOP ALL triggered — all automated live strategies halted immediately.',
    });

    const closedTickets: number[] = [];
    const errors: string[] = [];

    if (closeOpenPositions) {
      const snap = mt5Relay.getSnapshot(uid);
      if (snap.status.connected) {
        for (const pos of snap.positions) {
          try {
            const res = await mt5Relay.closePosition(uid, pos.ticket);
            if (res.closed) closedTickets.push(pos.ticket);
            else errors.push(`Ticket ${pos.ticket}: ${res.comment}`);
          } catch (err) {
            errors.push(`Ticket ${pos.ticket}: ${err instanceof Error ? err.message : 'Close error'}`);
          }
        }
      }
    }

    return {
      haltedCount: strategies.length,
      closedTickets,
      errors,
    };
  }

  private evaluateSignal(template: AutomatedStrategy['template'], candles: CandleBar[]): 'BUY' | 'SELL' | 'HOLD' {
    if (candles.length < 35) return 'HOLD';
    const closes = candles.map((c) => c.close);
    const n = closes.length;

    if (template === 'EMA_CROSS' || template === 'ATR_TREND') {
      const fast = computeEma(closes, 9);
      const slow = computeEma(closes, 21);
      if (fast[n - 2] <= slow[n - 2] && fast[n - 1] > slow[n - 1]) return 'BUY';
      if (fast[n - 2] >= slow[n - 2] && fast[n - 1] < slow[n - 1]) return 'SELL';
      return 'HOLD';
    }

    if (template === 'RSI_REVERSION') {
      const rsiNow = computeRsi(closes, 14);
      const rsiPrev = computeRsi(closes.slice(0, -1), 14);
      if (rsiPrev <= 30 && rsiNow > 30) return 'BUY';
      if (rsiPrev >= 70 && rsiNow < 70) return 'SELL';
      return 'HOLD';
    }

    if (template === 'MACD_MOMENTUM') {
      const ema12 = computeEma(closes, 12);
      const ema26 = computeEma(closes, 26);
      const macd = ema12.map((v, i) => v - ema26[i]);
      const signal = computeEma(macd, 9);
      if (macd[n - 2] <= signal[n - 2] && macd[n - 1] > signal[n - 1]) return 'BUY';
      if (macd[n - 2] >= signal[n - 2] && macd[n - 1] < signal[n - 1]) return 'SELL';
      return 'HOLD';
    }

    if (template === 'BB_BREAKOUT') {
      const slice = closes.slice(-20);
      const mean = slice.reduce((acc, v) => acc + v, 0) / slice.length;
      const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);
      const upper = mean + 2 * std;
      const lower = mean - 2 * std;
      if (closes[n - 2] <= upper && closes[n - 1] > upper) return 'BUY';
      if (closes[n - 2] >= lower && closes[n - 1] < lower) return 'SELL';
      return 'HOLD';
    }

    return 'HOLD';
  }

  private async evaluateAll(): Promise<void> {
    for (const [uid, strategies] of this.activeStrategies.entries()) {
      const snap = mt5Relay.getSnapshot(uid);
      if (!snap.status.connected || snap.status.stale || !snap.status.account) {
        continue;
      }

      const account = snap.status.account;
      if (!account.tradeAllowed || !account.algoTradingAllowed) {
        continue;
      }

      for (const strat of strategies) {
        if (!strat.isLiveEnabled || strat.status !== 'ACTIVE') continue;
        if (!isInSession(strat.sessionFilter)) continue;

        // Enforce daily loss & drawdown limits before inspecting signals
        const totalExposure = snap.positions.reduce((acc, p) => acc + p.volume, 0);
        if (totalExposure >= strat.maxTotalExposureLots) {
          this.pushLog(uid, {
            strategyId: strat.id,
            strategyName: strat.name,
            symbol: strat.symbols[0] || 'ALL',
            signal: 'RISK_BLOCK',
            reason: `Total exposure ${totalExposure.toFixed(2)} lots reached max ${strat.maxTotalExposureLots} lots.`,
          });
          continue;
        }

        if (snap.positions.length >= strat.maxSimultaneousPositions) {
          continue;
        }

        if (account.floatingPnl <= -Math.abs(strat.dailyLossLimitUsd)) {
          strat.isLiveEnabled = false;
          strat.status = 'HALTED';
          this.pushLog(uid, {
            strategyId: strat.id,
            strategyName: strat.name,
            symbol: 'ALL',
            signal: 'RISK_BLOCK',
            reason: `Daily loss limit ($${strat.dailyLossLimitUsd}) breached; strategy halted.`,
          });
          continue;
        }

        const drawdownPct =
          account.balance > 0 && account.equity < account.balance
            ? ((account.balance - account.equity) / account.balance) * 100
            : 0;
        if (drawdownPct >= strat.maxDrawdownPct) {
          strat.isLiveEnabled = false;
          strat.status = 'HALTED';
          this.pushLog(uid, {
            strategyId: strat.id,
            strategyName: strat.name,
            symbol: 'ALL',
            signal: 'RISK_BLOCK',
            reason: `Drawdown ${drawdownPct.toFixed(2)}% reached limit ${strat.maxDrawdownPct}%; strategy halted.`,
          });
          continue;
        }

        for (const symbol of strat.symbols) {
          const symSpec = snap.symbols.find((s) => s.symbol === symbol);
          if (!symSpec || !symSpec.tradeable) continue;
          if (symSpec.spread > strat.maxSpreadPoints) continue;

          try {
            const candles = await mt5Relay.getCandles(uid, symbol, strat.timeframe as Timeframe, 60);
            if (candles.length < 35) continue;

            const signal = this.evaluateSignal(strat.template, candles);
            if (signal === 'HOLD') continue;

            const latestBarTime = candles[candles.length - 1].time;
            const lockKey = `${uid}:${strat.id}:${symbol}:${latestBarTime}:${signal}`;
            if (this.executionLocks.has(lockKey)) continue;
            this.executionLocks.add(lockKey);

            // Calculate SL & TP prices from pips
            const pipValue = symSpec.digits === 3 || symSpec.digits === 5 ? symSpec.point * 10 : symSpec.point;
            const entryRef = signal === 'BUY' ? symSpec.ask : symSpec.bid;
            const sl =
              strat.stopLossPips > 0
                ? Number(
                    (signal === 'BUY'
                      ? entryRef - strat.stopLossPips * pipValue
                      : entryRef + strat.stopLossPips * pipValue
                    ).toFixed(symSpec.digits)
                  )
                : undefined;
            const tp =
              strat.takeProfitPips > 0
                ? Number(
                    (signal === 'BUY'
                      ? entryRef + strat.takeProfitPips * pipValue
                      : entryRef - strat.takeProfitPips * pipValue
                    ).toFixed(symSpec.digits)
                  )
                : undefined;

            const result = await mt5Relay.sendOrder(uid, {
              symbol,
              side: signal,
              orderType: 'MARKET',
              volume: strat.lotSize,
              sl,
              tp,
              comment: `QX:${strat.name.slice(0, 20)}`,
            });

            this.pushLog(uid, {
              strategyId: strat.id,
              strategyName: strat.name,
              symbol,
              signal: result.executed ? 'EXECUTED' : 'ERROR',
              reason: result.executed
                ? `${signal} ${strat.lotSize} lots filled @ ${result.price} (Ticket #${result.ticket})`
                : `Broker rejected (${result.retcode}): ${result.comment}`,
              ticket: result.ticket,
              price: result.price,
            });
          } catch (err) {
            this.pushLog(uid, {
              strategyId: strat.id,
              strategyName: strat.name,
              symbol,
              signal: 'ERROR',
              reason: err instanceof Error ? err.message : 'Strategy evaluation failure',
            });
          }
        }
      }
    }
  }
}

export const autoEngine = new DeterministicAutoEngine();
