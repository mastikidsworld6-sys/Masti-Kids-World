import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from './AuthContext.tsx';
import type {
  AuditLogEntry,
  AutomatedStrategy,
  BridgeConfigProfile,
  BridgeStatus,
  CandleBar,
  ChartDrawing,
  ChartStyle,
  EconomicEvent,
  GlobeMode,
  MarketDepthData,
  NavSection,
  NewsItem,
  OpenPosition,
  OrderCheckResult,
  OrderExecutionResult,
  PendingOrder,
  StrategyRuntimeLog,
  SymbolSpec,
  Timeframe,
  TradeDeal,
  TradingAlert,
} from '../types/trading.ts';

interface TradingContextValue {
  activeSection: NavSection;
  setActiveSection: (s: NavSection) => void;
  terminalTab: 'CHART' | 'GLOBE';
  setTerminalTab: (t: 'CHART' | 'GLOBE') => void;
  globeMode: GlobeMode;
  setGlobeMode: (m: GlobeMode) => void;

  selectedSymbol: string;
  setSelectedSymbol: (sym: string) => void;
  chartTabs: string[];
  openChartTab: (sym: string) => void;
  closeChartTab: (sym: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  chartStyle: ChartStyle;
  setChartStyle: (st: ChartStyle) => void;
  activeIndicators: string[];
  toggleIndicator: (ind: string) => void;
  drawings: ChartDrawing[];
  addDrawing: (d: ChartDrawing) => void;
  clearDrawingsForSymbol: (sym: string) => void;

  favorites: string[];
  toggleFavorite: (sym: string) => void;

  bridgeStatus: BridgeStatus;
  mt5Symbols: SymbolSpec[];
  binanceSymbols: SymbolSpec[];
  allSymbols: SymbolSpec[];
  positions: OpenPosition[];
  pendingOrders: PendingOrder[];
  deals: TradeDeal[];

  candles: CandleBar[];
  candlesProvider: string;
  candlesLoading: boolean;
  candlesError: string | null;
  reloadCandles: () => Promise<void>;

  marketDepth: MarketDepthData | null;
  depthLoading: boolean;
  refreshDepth: (sym?: string) => Promise<void>;

  strategies: AutomatedStrategy[];
  autoLogs: StrategyRuntimeLog[];
  alerts: TradingAlert[];
  auditLogs: AuditLogEntry[];
  bridgeConfigs: BridgeConfigProfile[];

  news: NewsItem[];
  newsErrors: string[];
  calendarEvents: EconomicEvent[];
  calendarError: string | null;
  refreshIntelligence: (force?: boolean) => Promise<void>;

  connectMt5Bridge: (params: {
    bridgeUrl: string;
    bridgeToken: string;
    login?: string;
    password?: string;
    server?: string;
    saveProfileLabel?: string;
  }) => Promise<BridgeStatus>;
  disconnectMt5Bridge: () => Promise<void>;
  checkOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
  }) => Promise<OrderCheckResult>;
  sendOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }) => Promise<OrderExecutionResult>;
  modifyPosition: (ticket: number, sl?: number, tp?: number) => Promise<void>;
  closePosition: (ticket: number, volume?: number) => Promise<void>;
  cancelOrder: (ticket: number) => Promise<void>;

  createStrategy: (
    strat: Omit<AutomatedStrategy, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateStrategy: (id: string, patch: Partial<AutomatedStrategy>) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  emergencyStopAll: (closePositions?: boolean) => Promise<void>;

  createAlert: (
    alert: Omit<TradingAlert, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateAlertStatus: (id: string, status: TradingAlert['status']) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;

  logAudit: (
    category: AuditLogEntry['category'],
    action: string,
    symbol: string,
    details: string,
    severity?: AuditLogEntry['severity']
  ) => Promise<void>;

  askAiAnalyst: (question: string) => Promise<string>;
}

const TradingContext = createContext<TradingContextValue | null>(null);

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady, getFreshToken } = useAuth();

  const [activeSection, setActiveSection] = useState<NavSection>('terminal');
  const [terminalTab, setTerminalTab] = useState<'CHART' | 'GLOBE'>('CHART');
  const [globeMode, setGlobeMode] = useState<GlobeMode>('COMBINED');

  const [selectedSymbol, setSelectedSymbolState] = useState<string>('BTCUSDT');
  const [chartTabs, setChartTabs] = useState<string[]>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('CANDLES');
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['EMA20', 'VOLUME']);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [favorites, setFavorites] = useState<string[]>(['BTCUSDT', 'ETHUSDT', 'EURUSD', 'XAUUSD']);

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    connected: false,
    stale: false,
    bridgeUrl: null,
    lastSync: null,
    error: null,
    account: null,
  });
  const [mt5Symbols, setMt5Symbols] = useState<SymbolSpec[]>([]);
  const [binanceSymbols, setBinanceSymbols] = useState<SymbolSpec[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [deals, setDeals] = useState<TradeDeal[]>([]);

  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [candlesProvider, setCandlesProvider] = useState<string>('Unavailable');
  const [candlesLoading, setCandlesLoading] = useState<boolean>(false);
  const [candlesError, setCandlesError] = useState<string | null>(null);

  const [marketDepth, setMarketDepth] = useState<MarketDepthData | null>(null);
  const [depthLoading, setDepthLoading] = useState<boolean>(false);

  const [strategies, setStrategies] = useState<AutomatedStrategy[]>([]);
  const [autoLogs, setAutoLogs] = useState<StrategyRuntimeLog[]>([]);
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [bridgeConfigs, setBridgeConfigs] = useState<BridgeConfigProfile[]>([]);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsErrors, setNewsErrors] = useState<string[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EconomicEvent[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const authFetch = useCallback(
    async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
      const token = await getFreshToken();
      if (!token) throw new Error('Authentication required');
      const resp = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error((body as { error?: string }).error || `Request failed (${resp.status})`);
      }
      return body as T;
    },
    [getFreshToken]
  );

  const logAudit = useCallback(
    async (
      category: AuditLogEntry['category'],
      action: string,
      symbol: string,
      details: string,
      severity: AuditLogEntry['severity'] = 'INFO'
    ) => {
      if (!user) return;
      const path = `users/${user.uid}/auditLogs`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'auditLogs'), {
          ownerId: user.uid,
          category,
          action: action.slice(0, 120),
          symbol: (symbol || 'SYSTEM').slice(0, 40),
          details: details.slice(0, 1000),
          severity,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  // Combined symbol directory: authoritative Exness MT5 symbols first, plus Binance Spot Public crypto reference
  const allSymbols = useMemo(() => {
    const map = new Map<string, SymbolSpec>();
    for (const s of mt5Symbols) {
      map.set(s.symbol, s);
    }
    for (const b of binanceSymbols) {
      if (!map.has(b.symbol)) {
        map.set(b.symbol, b);
      }
    }
    return Array.from(map.values());
  }, [mt5Symbols, binanceSymbols]);

  const setSelectedSymbol = useCallback((sym: string) => {
    setSelectedSymbolState(sym);
    setChartTabs((prev) => (prev.includes(sym) ? prev : [...prev.slice(-5), sym]));
  }, []);

  const openChartTab = useCallback((sym: string) => {
    setSelectedSymbolState(sym);
    setChartTabs((prev) => (prev.includes(sym) ? prev : [...prev.slice(-5), sym]));
    setActiveSection('terminal');
    setTerminalTab('CHART');
  }, []);

  const closeChartTab = useCallback(
    (sym: string) => {
      setChartTabs((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((item) => item !== sym);
        if (selectedSymbol === sym) {
          setSelectedSymbolState(next[0]);
        }
        return next;
      });
    },
    [selectedSymbol]
  );

  // Persist workspace preferences
  const persistWorkspace = useCallback(
    async (patch: {
      favorites?: string[];
      activeSymbol?: string;
      timeframe?: Timeframe;
      chartStyle?: ChartStyle;
      indicators?: string[];
      drawings?: ChartDrawing[];
    }) => {
      if (!user) return;
      const wsPath = `users/${user.uid}/workspaces/default`;
      const ref = doc(db, 'users', user.uid, 'workspaces', 'default');
      try {
        await setDoc(
          ref,
          {
            ownerId: user.uid,
            favorites: (patch.favorites ?? favorites).slice(0, 50),
            activeSymbol: patch.activeSymbol ?? selectedSymbol,
            timeframe: patch.timeframe ?? timeframe,
            chartStyle: patch.chartStyle ?? chartStyle,
            indicators: (patch.indicators ?? activeIndicators).slice(0, 10),
            drawingsJson: JSON.stringify(patch.drawings ?? drawings).slice(0, 19500),
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, wsPath);
      }
    },
    [user, favorites, selectedSymbol, timeframe, chartStyle, activeIndicators, drawings]
  );

  const toggleFavorite = useCallback(
    (sym: string) => {
      const next = favorites.includes(sym)
        ? favorites.filter((s) => s !== sym)
        : [...favorites, sym].slice(0, 50);
      setFavorites(next);
      void persistWorkspace({ favorites: next });
    },
    [favorites, persistWorkspace]
  );

  const toggleIndicator = useCallback(
    (ind: string) => {
      const next = activeIndicators.includes(ind)
        ? activeIndicators.filter((i) => i !== ind)
        : [...activeIndicators, ind].slice(0, 10);
      setActiveIndicators(next);
      void persistWorkspace({ indicators: next });
    },
    [activeIndicators, persistWorkspace]
  );

  const addDrawing = useCallback(
    (d: ChartDrawing) => {
      const next = [...drawings, d];
      setDrawings(next);
      void persistWorkspace({ drawings: next });
    },
    [drawings, persistWorkspace]
  );

  const clearDrawingsForSymbol = useCallback(
    (sym: string) => {
      const next = drawings.filter((d) => d.symbol !== sym);
      setDrawings(next);
      void persistWorkspace({ drawings: next });
    },
    [drawings, persistWorkspace]
  );

  // Firestore real-time listeners (strictly after authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubStrategies = onSnapshot(
      query(collection(db, 'users', user.uid, 'strategies'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AutomatedStrategy, 'id'>) }));
        setStrategies(list);
        void authFetch('/api/auto/sync', {
          method: 'POST',
          body: JSON.stringify({ strategies: list }),
        }).catch(() => {});
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/strategies`)
    );

    const unsubAlerts = onSnapshot(
      query(collection(db, 'users', user.uid, 'alerts'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAlerts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TradingAlert, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/alerts`)
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'users', user.uid, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/auditLogs`)
    );

    const unsubBridges = onSnapshot(
      query(collection(db, 'users', user.uid, 'bridgeConfigs'), orderBy('createdAt', 'desc')),
      (snap) => {
        setBridgeConfigs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BridgeConfigProfile, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/bridgeConfigs`)
    );

    const unsubWs = onSnapshot(
      doc(db, 'users', user.uid, 'workspaces', 'default'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          favorites?: string[];
          activeSymbol?: string;
          timeframe?: Timeframe;
          chartStyle?: ChartStyle;
          indicators?: string[];
          drawingsJson?: string;
        };
        if (data.favorites) setFavorites(data.favorites);
        if (data.activeSymbol) setSelectedSymbolState(data.activeSymbol);
        if (data.timeframe) setTimeframe(data.timeframe);
        if (data.chartStyle) setChartStyle(data.chartStyle);
        if (data.indicators) setActiveIndicators(data.indicators);
        if (data.drawingsJson) {
          try {
            setDrawings(JSON.parse(data.drawingsJson) as ChartDrawing[]);
          } catch {
            // ignore
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/workspaces/default`)
    );

    return () => {
      unsubStrategies();
      unsubAlerts();
      unsubLogs();
      unsubBridges();
      unsubWs();
    };
  }, [authReady, user, authFetch]);

  // Authenticated WebSocket stream to Node.js backend
  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;

    const connectWs = async () => {
      const token = await getFreshToken();
      if (!token || !active) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as {
            type: string;
            mt5?: {
              status: BridgeStatus;
              symbols: SymbolSpec[];
              positions: OpenPosition[];
              orders: PendingOrder[];
              deals: TradeDeal[];
            };
            binance?: SymbolSpec[];
            quotes?: SymbolSpec[];
            autoLogs?: StrategyRuntimeLog[];
            log?: StrategyRuntimeLog;
            payload?: unknown;
          };

          if (msg.type === 'init:snapshot') {
            if (msg.mt5) {
              setBridgeStatus(msg.mt5.status);
              setMt5Symbols(msg.mt5.symbols || []);
              setPositions(msg.mt5.positions || []);
              setPendingOrders(msg.mt5.orders || []);
              setDeals(msg.mt5.deals || []);
            }
            if (msg.binance) setBinanceSymbols(msg.binance);
            if (msg.autoLogs) setAutoLogs(msg.autoLogs);
          } else if (msg.type === 'binance:quotes' && msg.quotes) {
            setBinanceSymbols(msg.quotes);
          } else if (msg.type === 'mt5:status') {
            setBridgeStatus(msg.payload as BridgeStatus);
          } else if (msg.type === 'mt5:snapshot') {
            const p = msg.payload as {
              status: BridgeStatus;
              symbols: SymbolSpec[];
              positions: OpenPosition[];
              orders: PendingOrder[];
              deals: TradeDeal[];
            };
            setBridgeStatus(p.status);
            setMt5Symbols(p.symbols || []);
            setPositions(p.positions || []);
            setPendingOrders(p.orders || []);
            setDeals(p.deals || []);
          } else if (msg.type === 'mt5:tick') {
            const p = msg.payload as {
              status: BridgeStatus;
              positions: OpenPosition[];
              orders: PendingOrder[];
              quotes: Array<{
                symbol: string;
                bid: number;
                ask: number;
                spread: number;
                lastTickTime: string | null;
                changePct: number;
                sessionVolume: number;
              }>;
            };
            setBridgeStatus(p.status);
            setPositions(p.positions || []);
            setPendingOrders(p.orders || []);
            if (p.quotes && p.quotes.length > 0) {
              const qMap = new Map(p.quotes.map((q) => [q.symbol, q]));
              setMt5Symbols((prev) =>
                prev.map((sym) => {
                  const q = qMap.get(sym.symbol);
                  return q ? { ...sym, ...q } : sym;
                })
              );
            }
          } else if (msg.type === 'auto:log' && msg.log) {
            setAutoLogs((prev) => [msg.log!, ...prev].slice(0, 200));
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!active) return;
        reconnectTimerRef.current = window.setTimeout(() => {
          void connectWs();
        }, 4000);
      };
    };

    void connectWs();

    return () => {
      active = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [authReady, user, getFreshToken]);

  // Evaluate armed price/spread alerts on live symbol updates
  useEffect(() => {
    if (!user || alerts.length === 0) return;
    const symMap = new Map(allSymbols.map((s) => [s.symbol, s]));
    for (const alert of alerts) {
      if (alert.status !== 'ARMED') continue;
      const sym = symMap.get(alert.symbol);
      if (!sym) continue;
      const val = alert.alertType === 'SPREAD' ? sym.spread : sym.bid;
      const triggered =
        (alert.condition === 'ABOVE' && val >= alert.threshold) ||
        (alert.condition === 'BELOW' && val <= alert.threshold) ||
        (alert.condition === 'CROSS' && Math.abs(val - alert.threshold) <= sym.point * 10);

      if (triggered) {
        void updateDoc(doc(db, 'users', user.uid, 'alerts', alert.id), {
          status: 'TRIGGERED',
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        if (alert.browserNotify && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`CHARANJEET QUANTX Alert: ${alert.symbol}`, {
            body: `${alert.alertType} ${alert.condition} ${alert.threshold} (Current: ${val})`,
          });
        }
      }
    }
  }, [allSymbols, alerts, user]);

  // Load candles for selected symbol & timeframe
  const reloadCandles = useCallback(async () => {
    if (!user || !selectedSymbol) return;
    setCandlesLoading(true);
    setCandlesError(null);
    try {
      const res = await authFetch<{ symbol: string; provider: string; candles: CandleBar[] }>(
        `/api/mt5/candles?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(timeframe)}&count=300`
      );
      setCandles(res.candles || []);
      setCandlesProvider(res.provider);
    } catch (err) {
      setCandles([]);
      setCandlesProvider('Unavailable');
      setCandlesError(err instanceof Error ? err.message : 'Unable to fetch historical data');
    } finally {
      setCandlesLoading(false);
    }
  }, [user, selectedSymbol, timeframe, authFetch]);

  useEffect(() => {
    if (authReady && user) {
      void reloadCandles();
    }
  }, [authReady, user, reloadCandles]);

  // Refresh market depth for selected symbol
  const refreshDepth = useCallback(
    async (sym?: string) => {
      if (!user) return;
      const target = sym || selectedSymbol;
      if (!target) return;
      setDepthLoading(true);
      try {
        const res = await authFetch<MarketDepthData>(
          `/api/market/depth?symbol=${encodeURIComponent(target)}`
        );
        setMarketDepth(res);
      } catch {
        setMarketDepth({
          symbol: target,
          available: false,
          message: 'MARKET DEPTH NOT AVAILABLE',
          provider: 'Unavailable',
          timestamp: new Date().toISOString(),
          bids: [],
          asks: [],
        });
      } finally {
        setDepthLoading(false);
      }
    },
    [user, selectedSymbol, authFetch]
  );

  useEffect(() => {
    if (authReady && user) {
      void refreshDepth(selectedSymbol);
    }
  }, [authReady, user, selectedSymbol, refreshDepth]);

  // Refresh real financial news & economic calendar
  const refreshIntelligence = useCallback(
    async (force = false) => {
      if (!user) return;
      try {
        const [newsRes, calRes] = await Promise.all([
          authFetch<{ items: NewsItem[]; errors: string[] }>(`/api/intel/news?refresh=${force}`),
          authFetch<{ events: EconomicEvent[]; error: string | null }>(
            `/api/intel/calendar?refresh=${force}`
          ),
        ]);
        setNews(newsRes.items || []);
        setNewsErrors(newsRes.errors || []);
        setCalendarEvents(calRes.events || []);
        setCalendarError(calRes.error || null);
      } catch (err) {
        setCalendarError(err instanceof Error ? err.message : 'Intelligence feeds unavailable');
      }
    },
    [user, authFetch]
  );

  useEffect(() => {
    if (authReady && user) {
      void refreshIntelligence(false);
    }
  }, [authReady, user, refreshIntelligence]);

  // Broker connection actions
  const connectMt5Bridge = useCallback(
    async (params: {
      bridgeUrl: string;
      bridgeToken: string;
      login?: string;
      password?: string;
      server?: string;
      saveProfileLabel?: string;
    }) => {
      const status = await authFetch<BridgeStatus>('/api/mt5/connect', {
        method: 'POST',
        body: JSON.stringify({
          bridgeUrl: params.bridgeUrl,
          bridgeToken: params.bridgeToken,
          login: params.login,
          password: params.password,
          server: params.server,
        }),
      });
      setBridgeStatus(status);
      const snap = await authFetch<{
        status: BridgeStatus;
        symbols: SymbolSpec[];
        positions: OpenPosition[];
        orders: PendingOrder[];
        deals: TradeDeal[];
      }>('/api/mt5/status');
      setMt5Symbols(snap.symbols || []);
      setPositions(snap.positions || []);
      setPendingOrders(snap.orders || []);
      setDeals(snap.deals || []);
      if (snap.symbols && snap.symbols.length > 0) {
        setSelectedSymbolState(snap.symbols[0].symbol);
      }

      if (user && params.saveProfileLabel && status.account) {
        const path = `users/${user.uid}/bridgeConfigs`;
        try {
          await addDoc(collection(db, 'users', user.uid, 'bridgeConfigs'), {
            ownerId: user.uid,
            label: params.saveProfileLabel.slice(0, 80),
            bridgeUrl: params.bridgeUrl.slice(0, 300),
            brokerName: (status.account.broker || 'Exness').slice(0, 80),
            mt5Server: (status.account.server || params.server || 'Exness-MT5').slice(0, 120),
            mt5Login: (status.account.login || params.login || 'Session').slice(0, 32),
            accountType:
              status.account.accountType === 'Live Account' || status.account.accountType === 'Practice Account'
                ? status.account.accountType
                : 'Unverified',
            isDefault: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

      await logAudit(
        'CONNECTION',
        'MT5 Bridge Connected',
        status.account?.login || 'EXNESS',
        `Connected to ${status.account?.broker || 'Exness'} (${status.account?.server || 'N/A'}) as ${status.account?.accountType || 'Unverified'}`,
        'INFO'
      );
      return status;
    },
    [authFetch, user, logAudit]
  );

  const disconnectMt5Bridge = useCallback(async () => {
    const status = await authFetch<BridgeStatus>('/api/mt5/disconnect', { method: 'POST' });
    setBridgeStatus(status);
    setMt5Symbols([]);
    setPositions([]);
    setPendingOrders([]);
    setDeals([]);
    await logAudit('CONNECTION', 'MT5 Bridge Disconnected', 'EXNESS', 'User terminated MT5 bridge session.', 'INFO');
  }, [authFetch, logAudit]);

  const checkOrder = useCallback(
    async (payload: {
      symbol: string;
      side: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
      volume: number;
      price?: number;
      sl?: number;
      tp?: number;
    }) => {
      return authFetch<OrderCheckResult>('/api/mt5/order/check', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    [authFetch]
  );

  const sendOrder = useCallback(
    async (payload: {
      symbol: string;
      side: 'BUY' | 'SELL';
      orderType: 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';
      volume: number;
      price?: number;
      sl?: number;
      tp?: number;
      comment?: string;
    }) => {
      const result = await authFetch<OrderExecutionResult>('/api/mt5/order/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await logAudit(
        'EXECUTION',
        `${payload.side} ${payload.orderType}`,
        payload.symbol,
        result.executed
          ? `Confirmed Ticket #${result.ticket} · ${result.volume} lots @ ${result.price}`
          : `Rejected (${result.retcode}): ${result.comment}`,
        result.executed ? 'INFO' : 'WARNING'
      );
      return result;
    },
    [authFetch, logAudit]
  );

  const modifyPosition = useCallback(
    async (ticket: number, sl?: number, tp?: number) => {
      await authFetch('/api/mt5/position/modify', {
        method: 'POST',
        body: JSON.stringify({ ticket, sl, tp }),
      });
      await logAudit('EXECUTION', 'Modify Position SL/TP', `#${ticket}`, `SL=${sl ?? 'unchanged'} TP=${tp ?? 'unchanged'}`);
    },
    [authFetch, logAudit]
  );

  const closePosition = useCallback(
    async (ticket: number, volume?: number) => {
      await authFetch('/api/mt5/position/close', {
        method: 'POST',
        body: JSON.stringify({ ticket, volume }),
      });
      await logAudit('EXECUTION', 'Close Position', `#${ticket}`, `Volume=${volume ?? 'FULL'}`);
    },
    [authFetch, logAudit]
  );

  const cancelOrder = useCallback(
    async (ticket: number) => {
      await authFetch('/api/mt5/order/cancel', {
        method: 'POST',
        body: JSON.stringify({ ticket }),
      });
      await logAudit('EXECUTION', 'Cancel Pending Order', `#${ticket}`, 'Pending order cancelled');
    },
    [authFetch, logAudit]
  );

  const createStrategy = useCallback(
    async (strat: Omit<AutomatedStrategy, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
      if (!user) return;
      const path = `users/${user.uid}/strategies`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'strategies'), {
          ...strat,
          ownerId: user.uid,
          isLiveEnabled: false, // Never auto-activate live execution
          status: 'PAUSED',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAudit('AUTOMATION', 'Create Strategy', strat.symbols[0] || 'MULTI', `Created ${strat.name} (${strat.template}) in PAUSED state.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, logAudit]
  );

  const updateStrategy = useCallback(
    async (id: string, patch: Partial<AutomatedStrategy>) => {
      if (!user) return;
      const path = `users/${user.uid}/strategies/${id}`;
      try {
        const cleanPatch = { ...patch } as Record<string, unknown>;
        delete cleanPatch.id;
        delete cleanPatch.ownerId;
        delete cleanPatch.createdAt;
        cleanPatch.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'users', user.uid, 'strategies', id), cleanPatch);
        await logAudit('AUTOMATION', 'Update Strategy', id, `Updated fields: ${Object.keys(patch).join(', ')}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, logAudit]
  );

  const deleteStrategy = useCallback(
    async (id: string) => {
      if (!user) return;
      const path = `users/${user.uid}/strategies/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'strategies', id));
        await logAudit('AUTOMATION', 'Delete Strategy', id, 'Removed strategy configuration.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user, logAudit]
  );

  const emergencyStopAll = useCallback(
    async (closePositions = false) => {
      await authFetch('/api/auto/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ closeOpenPositions: closePositions }),
      });
      if (user) {
        await Promise.all(
          strategies.map((s) =>
            updateDoc(doc(db, 'users', user.uid, 'strategies', s.id), {
              isLiveEnabled: false,
              status: 'HALTED',
              updatedAt: serverTimestamp(),
            }).catch(() => {})
          )
        );
      }
      await logAudit(
        'RISK',
        'EMERGENCY STOP ALL',
        'ALL',
        `Halted all strategies${closePositions ? ' and requested liquidation of open positions' : ''}.`,
        'CRITICAL'
      );
    },
    [authFetch, user, strategies, logAudit]
  );

  const createAlert = useCallback(
    async (alert: Omit<TradingAlert, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => {
      if (!user) return;
      const path = `users/${user.uid}/alerts`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'alerts'), {
          ...alert,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const updateAlertStatus = useCallback(
    async (id: string, status: TradingAlert['status']) => {
      if (!user) return;
      const path = `users/${user.uid}/alerts/${id}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'alerts', id), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deleteAlert = useCallback(
    async (id: string) => {
      if (!user) return;
      const path = `users/${user.uid}/alerts/${id}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'alerts', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const askAiAnalyst = useCallback(
    async (question: string) => {
      const sym = allSymbols.find((s) => s.symbol === selectedSymbol);
      const lastCandles = candles.slice(-15);
      const recentCandlesSummary =
        lastCandles.length > 0
          ? `Last ${lastCandles.length} bars range from ${Math.min(...lastCandles.map((c) => c.low))} to ${Math.max(...lastCandles.map((c) => c.high))}, latest close ${lastCandles[lastCandles.length - 1].close}`
          : 'No chart candles loaded';

      const symPositions = positions.filter((p) => p.symbol === selectedSymbol);
      const openPositionsSummary =
        symPositions.length > 0
          ? symPositions
              .map((p) => `${p.side} ${p.volume} lots @ ${p.entryPrice}, Floating P&L ${p.floatingPnl.toFixed(2)}`)
              .join('; ')
          : 'No open positions on this symbol';

      const res = await authFetch<{ analysis: string }>('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          question,
          symbol: selectedSymbol,
          timeframe,
          bid: sym?.bid,
          ask: sym?.ask,
          spread: sym?.spread,
          provider: sym?.provider || candlesProvider,
          recentCandlesSummary,
          openPositionsSummary,
        }),
      });
      return res.analysis;
    },
    [allSymbols, selectedSymbol, candles, positions, timeframe, candlesProvider, authFetch]
  );

  return (
    <TradingContext.Provider
      value={{
        activeSection,
        setActiveSection,
        terminalTab,
        setTerminalTab,
        globeMode,
        setGlobeMode,
        selectedSymbol,
        setSelectedSymbol,
        chartTabs,
        openChartTab,
        closeChartTab,
        timeframe,
        setTimeframe,
        chartStyle,
        setChartStyle,
        activeIndicators,
        toggleIndicator,
        drawings,
        addDrawing,
        clearDrawingsForSymbol,
        favorites,
        toggleFavorite,
        bridgeStatus,
        mt5Symbols,
        binanceSymbols,
        allSymbols,
        positions,
        pendingOrders,
        deals,
        candles,
        candlesProvider,
        candlesLoading,
        candlesError,
        reloadCandles,
        marketDepth,
        depthLoading,
        refreshDepth,
        strategies,
        autoLogs,
        alerts,
        auditLogs,
        bridgeConfigs,
        news,
        newsErrors,
        calendarEvents,
        calendarError,
        refreshIntelligence,
        connectMt5Bridge,
        disconnectMt5Bridge,
        checkOrder,
        sendOrder,
        modifyPosition,
        closePosition,
        cancelOrder,
        createStrategy,
        updateStrategy,
        deleteStrategy,
        emergencyStopAll,
        createAlert,
        updateAlertStatus,
        deleteAlert,
        logAudit,
        askAiAnalyst,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export function useTrading(): TradingContextValue {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be used inside TradingProvider');
  return ctx;
}
