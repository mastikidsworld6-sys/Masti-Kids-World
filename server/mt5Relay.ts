import WebSocket from 'ws';
import type {
  AccountInfo,
  BridgeStatus,
  CandleBar,
  MarketDepthData,
  OpenPosition,
  OrderCheckResult,
  OrderExecutionResult,
  PendingOrder,
  SymbolSpec,
  Timeframe,
  TradeDeal,
} from '../src/types/trading.ts';

interface UserBridgeSession {
  uid: string;
  bridgeUrl: string;
  bridgeToken: string;
  connected: boolean;
  stale: boolean;
  lastSync: string | null;
  error: string | null;
  account: AccountInfo | null;
  symbols: SymbolSpec[];
  positions: OpenPosition[];
  orders: PendingOrder[];
  deals: TradeDeal[];
  bridgeWs: WebSocket | null;
  pollTimer: NodeJS.Timeout | null;
}

export type BridgeEventCallback = (uid: string, event: { type: string; payload: unknown }) => void;

export class Mt5RelayManager {
  private sessions = new Map<string, UserBridgeSession>();
  private listeners = new Set<BridgeEventCallback>();

  onEvent(cb: BridgeEventCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(uid: string, type: string, payload: unknown): void {
    for (const cb of this.listeners) {
      cb(uid, { type, payload });
    }
  }

  getStatus(uid: string): BridgeStatus {
    const s = this.sessions.get(uid);
    if (!s) {
      return {
        connected: false,
        stale: false,
        bridgeUrl: null,
        lastSync: null,
        error: null,
        account: null,
      };
    }
    const stale =
      s.connected && s.lastSync
        ? Date.now() - new Date(s.lastSync).getTime() > 12000
        : false;
    return {
      connected: s.connected,
      stale,
      bridgeUrl: s.bridgeUrl,
      lastSync: s.lastSync,
      error: s.error,
      account: s.account,
    };
  }

  getSnapshot(uid: string) {
    const s = this.sessions.get(uid);
    return {
      status: this.getStatus(uid),
      symbols: s?.symbols || [],
      positions: s?.positions || [],
      orders: s?.orders || [],
      deals: s?.deals || [],
    };
  }

  private normalizeBridgeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error('Bridge URL must start with https:// or http://');
    }
    return trimmed;
  }

  private async callBridge<T>(
    bridgeUrl: string,
    bridgeToken: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const resp = await fetch(`${bridgeUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bridgeToken}`,
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!resp.ok) {
      let detail = `Bridge HTTP ${resp.status}`;
      try {
        const body = (await resp.json()) as { detail?: string; error?: string };
        detail = body.detail || body.error || detail;
      } catch {
        // ignore JSON parse failure
      }
      throw new Error(detail);
    }

    return (await resp.json()) as T;
  }

  async connect(
    uid: string,
    params: {
      bridgeUrl: string;
      bridgeToken: string;
      login?: string;
      password?: string;
      server?: string;
    }
  ): Promise<BridgeStatus> {
    const bridgeUrl = this.normalizeBridgeUrl(params.bridgeUrl);
    const bridgeToken = params.bridgeToken.trim();
    if (!bridgeToken) {
      throw new Error('MT5 Bridge authentication secret is required.');
    }

    await this.disconnect(uid, false);

    const connectBody: Record<string, unknown> = {};
    if (params.login && params.login.trim()) {
      connectBody.login = Number(params.login.trim());
    }
    if (params.password) {
      // Transmitted exclusively over authenticated request to user's bridge; never persisted or logged
      connectBody.password = params.password;
    }
    if (params.server && params.server.trim()) {
      connectBody.server = params.server.trim();
    }

    const res = await this.callBridge<{ connected: boolean; account: AccountInfo }>(
      bridgeUrl,
      bridgeToken,
      '/api/mt5/connect',
      {
        method: 'POST',
        body: JSON.stringify(connectBody),
      }
    );

    const session: UserBridgeSession = {
      uid,
      bridgeUrl,
      bridgeToken,
      connected: true,
      stale: false,
      lastSync: new Date().toISOString(),
      error: null,
      account: res.account,
      symbols: [],
      positions: [],
      orders: [],
      deals: [],
      bridgeWs: null,
      pollTimer: null,
    };

    this.sessions.set(uid, session);

    await this.refreshAll(uid);
    this.attachBridgeWebSocket(uid);
    this.startHealthWatchdog(uid);

    this.emit(uid, 'mt5:status', this.getStatus(uid));
    return this.getStatus(uid);
  }

  async disconnect(uid: string, notifyBridge = true): Promise<BridgeStatus> {
    const existing = this.sessions.get(uid);
    if (existing) {
      if (existing.pollTimer) clearInterval(existing.pollTimer);
      if (existing.bridgeWs) {
        existing.bridgeWs.removeAllListeners();
        existing.bridgeWs.close();
      }
      if (notifyBridge) {
        try {
          await this.callBridge(existing.bridgeUrl, existing.bridgeToken, '/api/mt5/disconnect', {
            method: 'POST',
          });
        } catch {
          // Bridge may already be offline
        }
      }
      this.sessions.delete(uid);
    }
    const status = this.getStatus(uid);
    this.emit(uid, 'mt5:status', status);
    return status;
  }

  private async refreshAll(uid: string): Promise<void> {
    const s = this.sessions.get(uid);
    if (!s) return;
    try {
      const [account, symRes, posRes, ordRes, histRes] = await Promise.all([
        this.callBridge<AccountInfo>(s.bridgeUrl, s.bridgeToken, '/api/mt5/account'),
        this.callBridge<{ symbols: SymbolSpec[] }>(s.bridgeUrl, s.bridgeToken, '/api/mt5/symbols'),
        this.callBridge<{ positions: OpenPosition[] }>(s.bridgeUrl, s.bridgeToken, '/api/mt5/positions'),
        this.callBridge<{ orders: PendingOrder[] }>(s.bridgeUrl, s.bridgeToken, '/api/mt5/orders'),
        this.callBridge<{ deals: TradeDeal[] }>(s.bridgeUrl, s.bridgeToken, '/api/mt5/history?days=30'),
      ]);

      s.account = account;
      s.symbols = symRes.symbols || [];
      s.positions = posRes.positions || [];
      s.orders = ordRes.orders || [];
      s.deals = histRes.deals || [];
      s.connected = true;
      s.stale = false;
      s.error = null;
      s.lastSync = new Date().toISOString();

      this.emit(uid, 'mt5:snapshot', this.getSnapshot(uid));
    } catch (err) {
      s.error = err instanceof Error ? err.message : 'MT5 synchronization error';
      s.stale = true;
      this.emit(uid, 'mt5:status', this.getStatus(uid));
    }
  }

  private attachBridgeWebSocket(uid: string): void {
    const s = this.sessions.get(uid);
    if (!s) return;
    const wsUrl = s.bridgeUrl.replace(/^http/i, 'ws') + `/ws/stream?token=${encodeURIComponent(s.bridgeToken)}`;

    try {
      const ws = new WebSocket(wsUrl);
      s.bridgeWs = ws;

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type: string;
            account?: AccountInfo;
            positions?: OpenPosition[];
            orders?: PendingOrder[];
            quotes?: Array<{
              symbol: string;
              bid: number;
              ask: number;
              spread: number;
              lastTickTime: string | null;
              changePct: number;
              sessionVolume: number;
            }>;
            error?: string;
            timestamp?: string;
          };

          if (msg.type === 'mt5:snapshot') {
            if (msg.account) s.account = msg.account;
            if (msg.positions) s.positions = msg.positions;
            if (msg.orders) s.orders = msg.orders;
            if (msg.quotes && s.symbols.length > 0) {
              const quoteMap = new Map(msg.quotes.map((q) => [q.symbol, q]));
              s.symbols = s.symbols.map((sym) => {
                const q = quoteMap.get(sym.symbol);
                return q ? { ...sym, ...q } : sym;
              });
            }
            s.connected = true;
            s.stale = false;
            s.error = null;
            s.lastSync = msg.timestamp || new Date().toISOString();
            this.emit(uid, 'mt5:tick', {
              status: this.getStatus(uid),
              positions: s.positions,
              orders: s.orders,
              quotes: msg.quotes || [],
            });
          } else if (msg.type === 'mt5:error') {
            s.error = msg.error || 'MT5 stream error';
            s.stale = true;
            this.emit(uid, 'mt5:status', this.getStatus(uid));
          }
        } catch {
          // ignore malformed bridge message
        }
      });

      ws.on('close', () => {
        if (this.sessions.get(uid) === s) {
          s.stale = true;
          s.error = 'Lost live WebSocket stream to Windows MT5 Bridge.';
          this.emit(uid, 'mt5:status', this.getStatus(uid));
        }
      });

      ws.on('error', (err) => {
        if (this.sessions.get(uid) === s) {
          s.stale = true;
          s.error = err.message;
          this.emit(uid, 'mt5:status', this.getStatus(uid));
        }
      });
    } catch (err) {
      s.error = err instanceof Error ? err.message : 'Unable to open bridge WebSocket';
    }
  }

  private startHealthWatchdog(uid: string): void {
    const s = this.sessions.get(uid);
    if (!s) return;
    s.pollTimer = setInterval(() => {
      const current = this.sessions.get(uid);
      if (!current) return;
      const last = current.lastSync ? new Date(current.lastSync).getTime() : 0;
      if (Date.now() - last > 8000) {
        void this.refreshAll(uid);
      }
    }, 10000);
  }

  private requireSession(uid: string): UserBridgeSession {
    const s = this.sessions.get(uid);
    if (!s || !s.connected) {
      throw new Error('No active Exness MT5 Bridge connection. Connect your Windows MT5 Bridge first.');
    }
    return s;
  }

  async getCandles(uid: string, symbol: string, timeframe: Timeframe, count = 300): Promise<CandleBar[]> {
    const s = this.requireSession(uid);
    const res = await this.callBridge<{ candles: CandleBar[] }>(
      s.bridgeUrl,
      s.bridgeToken,
      `/api/mt5/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&count=${count}`
    );
    return res.candles || [];
  }

  async getMarketDepth(uid: string, symbol: string): Promise<MarketDepthData> {
    const s = this.requireSession(uid);
    return this.callBridge<MarketDepthData>(
      s.bridgeUrl,
      s.bridgeToken,
      `/api/mt5/depth?symbol=${encodeURIComponent(symbol)}`
    );
  }

  async checkOrder(
    uid: string,
    payload: {
      symbol: string;
      side: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
      volume: number;
      price?: number;
      sl?: number;
      tp?: number;
    }
  ): Promise<OrderCheckResult> {
    const s = this.requireSession(uid);
    return this.callBridge<OrderCheckResult>(s.bridgeUrl, s.bridgeToken, '/api/mt5/order/check', {
      method: 'POST',
      body: JSON.stringify({
        symbol: payload.symbol,
        side: payload.side,
        order_type: payload.orderType,
        volume: payload.volume,
        price: payload.price,
        sl: payload.sl,
        tp: payload.tp,
      }),
    });
  }

  async sendOrder(
    uid: string,
    payload: {
      symbol: string;
      side: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
      volume: number;
      price?: number;
      sl?: number;
      tp?: number;
      comment?: string;
    }
  ): Promise<OrderExecutionResult> {
    const s = this.requireSession(uid);
    const sym = s.symbols.find((item) => item.symbol === payload.symbol);
    if (!sym) {
      throw new Error(`Symbol ${payload.symbol} is not available in your connected Exness MT5 account.`);
    }
    if (!sym.tradeable) {
      throw new Error(`Symbol ${payload.symbol} is currently not tradeable in Exness MT5.`);
    }
    if (payload.volume < sym.volumeMin || payload.volume > sym.volumeMax) {
      throw new Error(
        `Lot size ${payload.volume} is outside broker limits (${sym.volumeMin} - ${sym.volumeMax}).`
      );
    }
    const stepRemainder = Math.abs((payload.volume - sym.volumeMin) / sym.volumeStep);
    if (Math.abs(stepRemainder - Math.round(stepRemainder)) > 1e-4) {
      throw new Error(`Lot size ${payload.volume} must align with lot step ${sym.volumeStep}.`);
    }
    if (s.account && !s.account.tradeAllowed) {
      throw new Error('Trading permissions are disabled on this Exness MT5 account.');
    }

    const result = await this.callBridge<OrderExecutionResult>(s.bridgeUrl, s.bridgeToken, '/api/mt5/order/send', {
      method: 'POST',
      body: JSON.stringify({
        symbol: payload.symbol,
        side: payload.side,
        order_type: payload.orderType,
        volume: payload.volume,
        price: payload.price,
        sl: payload.sl,
        tp: payload.tp,
        comment: payload.comment || 'QUANTX',
      }),
    });

    await this.refreshAll(uid);
    return result;
  }

  async modifyPosition(uid: string, ticket: number, sl?: number, tp?: number) {
    const s = this.requireSession(uid);
    const res = await this.callBridge<{ modified: boolean; retcode: number; comment: string }>(
      s.bridgeUrl,
      s.bridgeToken,
      '/api/mt5/position/modify',
      {
        method: 'POST',
        body: JSON.stringify({ ticket, sl, tp }),
      }
    );
    await this.refreshAll(uid);
    return res;
  }

  async closePosition(uid: string, ticket: number, volume?: number) {
    const s = this.requireSession(uid);
    const res = await this.callBridge<{
      closed: boolean;
      retcode: number;
      ticket: number;
      price: number;
      volume: number;
      comment: string;
    }>(s.bridgeUrl, s.bridgeToken, '/api/mt5/position/close', {
      method: 'POST',
      body: JSON.stringify({ ticket, volume }),
    });
    await this.refreshAll(uid);
    return res;
  }

  async cancelOrder(uid: string, ticket: number) {
    const s = this.requireSession(uid);
    const res = await this.callBridge<{ cancelled: boolean; retcode: number; comment: string }>(
      s.bridgeUrl,
      s.bridgeToken,
      '/api/mt5/order/cancel',
      {
        method: 'POST',
        body: JSON.stringify({ ticket }),
      }
    );
    await this.refreshAll(uid);
    return res;
  }

  async refreshHistory(uid: string, days = 30): Promise<TradeDeal[]> {
    const s = this.requireSession(uid);
    const res = await this.callBridge<{ deals: TradeDeal[] }>(
      s.bridgeUrl,
      s.bridgeToken,
      `/api/mt5/history?days=${days}`
    );
    s.deals = res.deals || [];
    return s.deals;
  }
}

export const mt5Relay = new Mt5RelayManager();
