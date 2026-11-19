export type NavSection =
  | 'overview'
  | 'terminal'
  | 'globe'
  | 'market-watch'
  | 'forex'
  | 'metals'
  | 'commodities'
  | 'indices'
  | 'stocks'
  | 'crypto'
  | 'auto-trading'
  | 'strategy-builder'
  | 'positions'
  | 'pending-orders'
  | 'history'
  | 'analytics'
  | 'news'
  | 'calendar'
  | 'broker-connection'
  | 'settings';

export type SymbolCategory =
  | 'Forex'
  | 'Metals'
  | 'Commodities'
  | 'Indices'
  | 'Stocks'
  | 'Crypto'
  | 'Other';

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN1';

export type ChartStyle = 'CANDLES' | 'BARS' | 'LINE';

export type GlobeMode = 'COMBINED' | 'NETWORK' | 'ACTIVITY' | 'ACCOUNT';

export type AccountType = 'Live Account' | 'Practice Account' | 'Contest Account' | 'Unverified';

export interface AccountInfo {
  login: string;
  broker: string;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  floatingPnl: number;
  realizedPnl?: number;
  credit: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  tradeAllowed: boolean;
  algoTradingAllowed: boolean;
  accountType: AccountType;
  connected: boolean;
  lastSync: string;
}

export interface BridgeStatus {
  connected: boolean;
  stale: boolean;
  bridgeUrl: string | null;
  lastSync: string | null;
  error: string | null;
  account: AccountInfo | null;
}

export interface SymbolSpec {
  symbol: string;
  description: string;
  category: SymbolCategory;
  path: string;
  bid: number;
  ask: number;
  spread: number;
  digits: number;
  point: number;
  lastTickTime: string | null;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  tickSize: number;
  tickValue: number;
  tradeMode: number;
  tradeable: boolean;
  marginInitial: number;
  sessionDeals: number;
  sessionVolume: number;
  changePct: number;
  provider: 'Exness MT5' | 'Binance Spot Public';
}

export interface QuoteTick {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  lastTickTime: string | null;
  changePct: number;
  sessionVolume: number;
  provider: string;
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  volume: number;
}

export interface MarketDepthData {
  symbol: string;
  available: boolean;
  message?: string;
  provider: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  isEstimate?: boolean;
}

export interface AnalyticalLiquidityZone {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE' | 'STOP_CLUSTER_ESTIMATE';
  strength: number;
  label: string;
}

export interface OpenPosition {
  ticket: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  swap: number;
  floatingPnl: number;
  magic: number;
  comment: string;
  openTime: string;
}

export interface PendingOrder {
  ticket: number;
  symbol: string;
  orderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | string;
  volume: number;
  price: number;
  sl: number;
  tp: number;
  comment: string;
  setupTime: string;
}

export interface TradeDeal {
  ticket: number;
  order: number;
  symbol: string;
  side: 'BUY' | 'SELL' | 'BALANCE';
  entry: number;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  comment: string;
  time: string;
}

export interface OrderCheckResult {
  valid: boolean;
  retcode: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  comment: string;
}

export interface OrderExecutionResult {
  executed: boolean;
  retcode: number;
  ticket: number;
  deal: number;
  order: number;
  price: number;
  volume: number;
  comment: string;
  timestamp: string;
}

export type StrategyTemplate =
  | 'EMA_CROSS'
  | 'RSI_REVERSION'
  | 'MACD_MOMENTUM'
  | 'BB_BREAKOUT'
  | 'ATR_TREND';

export type SessionFilter = 'ALL' | 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'LONDON_NY_OVERLAP';

export interface AutomatedStrategy {
  id: string;
  ownerId: string;
  name: string;
  template: StrategyTemplate;
  symbols: string[];
  timeframe: 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';
  lotSize: number;
  riskPerTradePct: number;
  stopLossPips: number;
  takeProfitPips: number;
  trailingStopPips: number;
  maxSimultaneousPositions: number;
  maxSpreadPoints: number;
  sessionFilter: SessionFilter;
  dailyLossLimitUsd: number;
  maxDrawdownPct: number;
  maxTotalExposureLots: number;
  isLiveEnabled: boolean;
  status: 'PAUSED' | 'ACTIVE' | 'HALTED';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StrategyRuntimeLog {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'RISK_BLOCK' | 'EXECUTED' | 'ERROR';
  reason: string;
  ticket?: number;
  price?: number;
  timestamp: string;
}

export interface TradingAlert {
  id: string;
  ownerId: string;
  symbol: string;
  alertType: 'PRICE' | 'SPREAD' | 'INDICATOR' | 'RISK_MARGIN' | 'CONNECTION';
  condition: 'ABOVE' | 'BELOW' | 'CROSS' | 'DROP';
  threshold: number;
  browserNotify: boolean;
  status: 'ARMED' | 'TRIGGERED' | 'DISMISSED';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  ownerId: string;
  category: 'CONNECTION' | 'EXECUTION' | 'AUTOMATION' | 'RISK' | 'SYSTEM';
  action: string;
  symbol: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt?: unknown;
}

export interface BridgeConfigProfile {
  id: string;
  ownerId: string;
  label: string;
  bridgeUrl: string;
  brokerName: string;
  mt5Server: string;
  mt5Login: string;
  accountType: 'Live Account' | 'Practice Account' | 'Unverified';
  isDefault: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: 'Forex' | 'Stocks' | 'Commodities' | 'Crypto' | 'Central Banks' | 'Macro';
  symbols: string[];
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  timeUtc: string;
  forecast: string;
  previous: string;
  actual: string;
  source: string;
}

export interface FinancialHub {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  exchange: string;
  primaryCategories: SymbolCategory[];
  sessionHoursUtc: string;
}

export interface ChartDrawing {
  id: string;
  type: 'HLINE' | 'TREND' | 'CHANNEL' | 'FIB' | 'RECT' | 'TEXT';
  symbol: string;
  points: { time: number; price: number }[];
  color: string;
  text?: string;
}
