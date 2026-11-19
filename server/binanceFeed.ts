import WebSocket from 'ws';
import type { CandleBar, MarketDepthData, SymbolSpec, Timeframe } from '../src/types/trading.ts';

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
}

const TRACKED_BINANCE_PAIRS = [
  { symbol: 'BTCUSDT', description: 'Bitcoin / TetherUS Spot (Binance)', digits: 2 },
  { symbol: 'ETHUSDT', description: 'Ethereum / TetherUS Spot (Binance)', digits: 2 },
  { symbol: 'SOLUSDT', description: 'Solana / TetherUS Spot (Binance)', digits: 2 },
  { symbol: 'BNBUSDT', description: 'BNB / TetherUS Spot (Binance)', digits: 2 },
  { symbol: 'XRPUSDT', description: 'XRP / TetherUS Spot (Binance)', digits: 4 },
  { symbol: 'ADAUSDT', description: 'Cardano / TetherUS Spot (Binance)', digits: 4 },
  { symbol: 'DOGEUSDT', description: 'Dogecoin / TetherUS Spot (Binance)', digits: 5 },
  { symbol: 'AVAXUSDT', description: 'Avalanche / TetherUS Spot (Binance)', digits: 2 },
  { symbol: 'LINKUSDT', description: 'Chainlink / TetherUS Spot (Binance)', digits: 3 },
  { symbol: 'DOTUSDT', description: 'Polkadot / TetherUS Spot (Binance)', digits: 3 },
];

export class BinancePublicFeed {
  private quotes = new Map<string, SymbolSpec>();
  private depthCache = new Map<string, MarketDepthData>();
  private ws: WebSocket | null = null;
  private restPollTimer: NodeJS.Timeout | null = null;
  private onQuoteListeners = new Set<(quotes: SymbolSpec[]) => void>();
  private lastError: string | null = null;
  private isStarted = false;

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    void this.fetch24hTickers();
    this.connectStream();
    this.restPollTimer = setInterval(() => {
      void this.fetch24hTickers();
    }, 15000);
  }

  stop(): void {
    this.isStarted = false;
    if (this.restPollTimer) {
      clearInterval(this.restPollTimer);
      this.restPollTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onUpdate(cb: (quotes: SymbolSpec[]) => void): () => void {
    this.onQuoteListeners.add(cb);
    return () => this.onQuoteListeners.delete(cb);
  }

  getSymbols(): SymbolSpec[] {
    return Array.from(this.quotes.values());
  }

  getStatus() {
    return {
      provider: 'Binance Spot Public',
      connected: this.quotes.size > 0,
      symbolCount: this.quotes.size,
      error: this.lastError,
    };
  }

  private emitQuotes(): void {
    const list = this.getSymbols();
    for (const listener of this.onQuoteListeners) {
      listener(list);
    }
  }

  private async fetch24hTickers(): Promise<void> {
    try {
      const symbolsParam = encodeURIComponent(JSON.stringify(TRACKED_BINANCE_PAIRS.map((p) => p.symbol)));
      const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        throw new Error(`Binance HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as BinanceTicker24h[];
      const nowIso = new Date().toISOString();

      for (const item of data) {
        const meta = TRACKED_BINANCE_PAIRS.find((p) => p.symbol === item.symbol);
        if (!meta) continue;
        const bid = Number(item.bidPrice) || Number(item.lastPrice);
        const ask = Number(item.askPrice) || Number(item.lastPrice);
        const point = Math.pow(10, -meta.digits);
        const spread = point > 0 ? Math.max(0, Math.round((ask - bid) / point)) : 0;

        this.quotes.set(item.symbol, {
          symbol: item.symbol,
          description: meta.description,
          category: 'Crypto',
          path: `Binance\\Spot\\${item.symbol}`,
          bid,
          ask,
          spread,
          digits: meta.digits,
          point,
          lastTickTime: nowIso,
          contractSize: 1,
          volumeMin: 0.001,
          volumeMax: 1000,
          volumeStep: 0.001,
          tickSize: point,
          tickValue: point,
          tradeMode: 0,
          tradeable: false, // Market reference only unless symbol exists on connected Exness MT5
          marginInitial: 0,
          sessionDeals: 0,
          sessionVolume: Number(item.volume) || 0,
          changePct: Number(item.priceChangePercent) || 0,
          provider: 'Binance Spot Public',
        });
      }
      this.lastError = null;
      this.emitQuotes();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Binance ticker fetch failed';
    }
  }

  private connectStream(): void {
    if (!this.isStarted) return;
    const streams = TRACKED_BINANCE_PAIRS.map((p) => `${p.symbol.toLowerCase()}@bookTicker`).join('/');
    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      this.ws = ws;

      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString()) as {
            data?: { s: string; b: string; a: string };
          };
          const d = parsed.data;
          if (!d || !d.s) return;
          const existing = this.quotes.get(d.s);
          if (!existing) return;
          const bid = Number(d.b);
          const ask = Number(d.a);
          const spread = existing.point > 0 ? Math.max(0, Math.round((ask - bid) / existing.point)) : 0;
          this.quotes.set(d.s, {
            ...existing,
            bid,
            ask,
            spread,
            lastTickTime: new Date().toISOString(),
          });
          this.emitQuotes();
        } catch {
          // Ignore malformed frame
        }
      });

      ws.on('error', (err) => {
        this.lastError = err.message;
      });

      ws.on('close', () => {
        this.ws = null;
        if (this.isStarted) {
          setTimeout(() => this.connectStream(), 5000);
        }
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Binance WebSocket error';
    }
  }

  async getOrderBook(symbol: string, limit = 20): Promise<MarketDepthData> {
    const normalized = this.normalizeBinanceSymbol(symbol);
    if (!normalized) {
      return {
        symbol,
        available: false,
        message: 'MARKET DEPTH NOT AVAILABLE',
        provider: 'Binance Spot Public',
        timestamp: new Date().toISOString(),
        bids: [],
        asks: [],
      };
    }

    try {
      const resp = await fetch(
        `https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(normalized)}&limit=${limit}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as {
        bids: [string, string][];
        asks: [string, string][];
      };
      const result: MarketDepthData = {
        symbol,
        available: true,
        provider: `Binance Spot L2 (${normalized})`,
        timestamp: new Date().toISOString(),
        bids: data.bids.map(([p, v]) => ({ price: Number(p), volume: Number(v) })),
        asks: data.asks.map(([p, v]) => ({ price: Number(p), volume: Number(v) })),
      };
      this.depthCache.set(normalized, result);
      return result;
    } catch (err) {
      const cached = this.depthCache.get(normalized);
      if (cached) return cached;
      return {
        symbol,
        available: false,
        message: `MARKET DEPTH NOT AVAILABLE (${err instanceof Error ? err.message : 'Feed unreachable'})`,
        provider: 'Binance Spot Public',
        timestamp: new Date().toISOString(),
        bids: [],
        asks: [],
      };
    }
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 300): Promise<CandleBar[] | null> {
    const normalized = this.normalizeBinanceSymbol(symbol);
    if (!normalized) return null;

    const intervalMap: Record<Timeframe, string> = {
      M1: '1m',
      M5: '5m',
      M15: '15m',
      M30: '30m',
      H1: '1h',
      H4: '4h',
      D1: '1d',
      W1: '1w',
      MN1: '1M',
    };

    try {
      const resp = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(normalized)}&interval=${intervalMap[timeframe]}&limit=${limit}`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (!resp.ok) return null;
      const raw = (await resp.json()) as unknown[][];
      return raw.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }));
    } catch {
      return null;
    }
  }

  normalizeBinanceSymbol(symbol: string): string | null {
    const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (TRACKED_BINANCE_PAIRS.some((p) => p.symbol === clean)) return clean;
    // Map Exness-style crypto symbols like BTCUSD / BTCUSDm / ETHUSD -> BTCUSDT / ETHUSDT
    const baseMatch = clean.match(/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|LINK|DOT)(USD|USDT)M?$/);
    if (baseMatch) {
      return `${baseMatch[1]}USDT`;
    }
    return null;
  }
}

export const binanceFeed = new BinancePublicFeed();
