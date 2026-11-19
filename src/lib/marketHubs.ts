import type {
  AnalyticalLiquidityZone,
  CandleBar,
  FinancialHub,
  SymbolCategory,
} from '../types/trading.ts';

export const GLOBAL_FINANCIAL_HUBS: FinancialHub[] = [
  {
    id: 'london',
    name: 'London FX & Metals Hub',
    city: 'London',
    lat: 51.5074,
    lon: -0.1278,
    exchange: 'LSE / LME / LD4 Equinix',
    primaryCategories: ['Forex', 'Metals', 'Commodities', 'Indices'],
    sessionHoursUtc: '07:00 - 16:00 UTC',
  },
  {
    id: 'newyork',
    name: 'New York Institutional Core',
    city: 'New York',
    lat: 40.7128,
    lon: -74.006,
    exchange: 'NYSE / NASDAQ / NY4 Equinix',
    primaryCategories: ['Forex', 'Indices', 'Stocks', 'Commodities'],
    sessionHoursUtc: '12:00 - 21:00 UTC',
  },
  {
    id: 'chicago',
    name: 'Chicago Derivatives Gateway',
    city: 'Chicago',
    lat: 41.8781,
    lon: -87.6298,
    exchange: 'CME / CBOT',
    primaryCategories: ['Commodities', 'Indices', 'Metals'],
    sessionHoursUtc: '13:30 - 20:00 UTC',
  },
  {
    id: 'frankfurt',
    name: 'Frankfurt Eurozone Liquidity',
    city: 'Frankfurt',
    lat: 50.1109,
    lon: 8.6821,
    exchange: 'Xetra / Eurex / FR2',
    primaryCategories: ['Forex', 'Indices', 'Stocks'],
    sessionHoursUtc: '07:00 - 16:30 UTC',
  },
  {
    id: 'zurich',
    name: 'Zurich Bullion & CHF Desk',
    city: 'Zurich',
    lat: 47.3769,
    lon: 8.5417,
    exchange: 'SIX Swiss Exchange',
    primaryCategories: ['Metals', 'Forex', 'Stocks'],
    sessionHoursUtc: '07:00 - 16:00 UTC',
  },
  {
    id: 'dubai',
    name: 'Dubai MENA Energy & Gold',
    city: 'Dubai',
    lat: 25.2048,
    lon: 55.2708,
    exchange: 'DGCX / DIFX',
    primaryCategories: ['Commodities', 'Metals', 'Forex'],
    sessionHoursUtc: '04:00 - 13:00 UTC',
  },
  {
    id: 'singapore',
    name: 'Singapore APAC Crypto & FX',
    city: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    exchange: 'SGX / SG1 APAC Liquidity',
    primaryCategories: ['Crypto', 'Forex', 'Commodities'],
    sessionHoursUtc: '00:00 - 09:00 UTC',
  },
  {
    id: 'tokyo',
    name: 'Tokyo JPY Matching Engine',
    city: 'Tokyo',
    lat: 35.6762,
    lon: 139.6503,
    exchange: 'TSE / TY3 Equinix',
    primaryCategories: ['Forex', 'Indices', 'Crypto'],
    sessionHoursUtc: '00:00 - 09:00 UTC',
  },
  {
    id: 'hongkong',
    name: 'Hong Kong East Asia Hub',
    city: 'Hong Kong',
    lat: 22.3193,
    lon: 114.1694,
    exchange: 'HKEX / HK1',
    primaryCategories: ['Indices', 'Stocks', 'Crypto'],
    sessionHoursUtc: '01:30 - 08:00 UTC',
  },
  {
    id: 'sydney',
    name: 'Sydney Pacific Open',
    city: 'Sydney',
    lat: -33.8688,
    lon: 151.2093,
    exchange: 'ASX / SY1',
    primaryCategories: ['Forex', 'Commodities'],
    sessionHoursUtc: '22:00 - 06:00 UTC',
  },
];

export function mapSymbolToHubs(symbol: string, category: SymbolCategory): [FinancialHub, FinancialHub] {
  const upper = symbol.toUpperCase();
  if (category === 'Crypto' || /BTC|ETH|SOL|BNB|XRP|ADA|DOGE/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[6], GLOBAL_FINANCIAL_HUBS[1]]; // Singapore <-> New York
  }
  if (category === 'Metals' || /XAU|XAG|XPT|XPD/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[0], GLOBAL_FINANCIAL_HUBS[4]]; // London <-> Zurich
  }
  if (category === 'Commodities' || /OIL|NGAS|XNG/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[2], GLOBAL_FINANCIAL_HUBS[5]]; // Chicago <-> Dubai
  }
  if (/JPY|JP225/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[7], GLOBAL_FINANCIAL_HUBS[0]]; // Tokyo <-> London
  }
  if (/HK50|CN/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[8], GLOBAL_FINANCIAL_HUBS[6]]; // Hong Kong <-> Singapore
  }
  if (/AUD|NZD/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[9], GLOBAL_FINANCIAL_HUBS[6]]; // Sydney <-> Singapore
  }
  if (/DE40|EUR|DAX/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[3], GLOBAL_FINANCIAL_HUBS[0]]; // Frankfurt <-> London
  }
  if (/US30|US500|USTEC|NAS|AAPL|MSFT|NVDA|TSLA/.test(upper)) {
    return [GLOBAL_FINANCIAL_HUBS[1], GLOBAL_FINANCIAL_HUBS[2]]; // New York <-> Chicago
  }
  return [GLOBAL_FINANCIAL_HUBS[0], GLOBAL_FINANCIAL_HUBS[1]]; // London <-> New York
}

export function calculateSmaSeries(candles: CandleBar[], period: number) {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

export function calculateEmaSeries(candles: CandleBar[], period: number) {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: { time: number; value: number }[] = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    const val = i === 0 ? candles[0].close : candles[i].close * k + prev * (1 - k);
    prev = val;
    if (i >= period - 1) {
      result.push({ time: candles[i].time, value: val });
    }
  }
  return result;
}

export function calculateBollingerSeries(candles: CandleBar[], period = 20, mult = 2) {
  const upper: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b.close, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b.close - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    upper.push({ time: candles[i].time, value: mean + mult * std });
    lower.push({ time: candles[i].time, value: mean - mult * std });
  }
  return { upper, lower };
}

export function calculateRsiSeries(candles: CandleBar[], period = 14) {
  const result: { time: number; value: number }[] = [];
  if (candles.length <= period) return result;
  for (let i = period; i < candles.length; i++) {
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - candles[j - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = losses === 0 ? 100 : 100 - 100 / (1 + rs);
    result.push({ time: candles[i].time, value: rsi });
  }
  return result;
}

export function calculateMacdSeries(candles: CandleBar[]) {
  if (candles.length < 30) return [];
  const ema12 = calculateEmaSeries(candles, 12);
  const ema26 = calculateEmaSeries(candles, 26);
  const ema12Map = new Map(ema12.map((p) => [p.time, p.value]));
  const macdLine: { time: number; value: number }[] = [];
  for (const p of ema26) {
    const v12 = ema12Map.get(p.time);
    if (v12 !== undefined) {
      macdLine.push({ time: p.time, value: v12 - p.value });
    }
  }
  return macdLine;
}

export function calculateAtrLatest(candles: CandleBar[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    sum += tr;
  }
  return sum / period;
}

export function calculateStochasticLatest(candles: CandleBar[], period = 14): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const highest = Math.max(...slice.map((c) => c.high));
  const lowest = Math.min(...slice.map((c) => c.low));
  const last = slice[slice.length - 1].close;
  if (highest === lowest) return 50;
  return ((last - lowest) / (highest - lowest)) * 100;
}

export function computeAnalyticalLiquidityZones(candles: CandleBar[]): AnalyticalLiquidityZone[] {
  if (candles.length < 20) return [];
  const recent = candles.slice(-60);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const close = recent[recent.length - 1].close;
  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);

  return [
    { price: r2, type: 'STOP_CLUSTER_ESTIMATE', strength: 88, label: 'Estimated Buy-Side Liquidity (R2)' },
    { price: r1, type: 'RESISTANCE', strength: 74, label: 'Analytical Pivot Resistance (R1)' },
    { price: s1, type: 'SUPPORT', strength: 74, label: 'Analytical Pivot Support (S1)' },
    { price: s2, type: 'STOP_CLUSTER_ESTIMATE', strength: 86, label: 'Estimated Sell-Side Liquidity (S2)' },
  ];
}
