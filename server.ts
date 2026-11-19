import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { requireAuth, verifyIdTokenString, type AuthRequest } from './server/auth.ts';
import { binanceFeed } from './server/binanceFeed.ts';
import { getEconomicCalendar, getMarketNews } from './server/marketIntel.ts';
import { mt5Relay } from './server/mt5Relay.ts';
import { autoEngine } from './server/autoEngine.ts';
import { analyzeMarketContext } from './server/geminiAnalyst.ts';
import type { AutomatedStrategy, Timeframe } from './src/types/trading.ts';

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const userSockets = new Map<string, Set<WebSocket>>();

  function broadcastToUser(uid: string, message: unknown) {
    const sockets = userSockets.get(uid);
    if (!sockets) return;
    const raw = JSON.stringify(message);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  function broadcastAll(message: unknown) {
    const raw = JSON.stringify(message);
    for (const sockets of userSockets.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw);
        }
      }
    }
  }

  // Start background real-time feeds
  binanceFeed.start();
  autoEngine.start();

  binanceFeed.onUpdate((quotes) => {
    broadcastAll({ type: 'binance:quotes', quotes, timestamp: new Date().toISOString() });
  });

  mt5Relay.onEvent((uid, event) => {
    broadcastToUser(uid, event);
  });

  autoEngine.onLog((uid, log) => {
    broadcastToUser(uid, { type: 'auto:log', log });
  });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || '';
      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }
      const decoded = await verifyIdTokenString(token);
      const uid = decoded.uid;

      if (!userSockets.has(uid)) {
        userSockets.set(uid, new Set());
      }
      userSockets.get(uid)!.add(ws);

      // Push initial authoritative snapshot
      ws.send(
        JSON.stringify({
          type: 'init:snapshot',
          mt5: mt5Relay.getSnapshot(uid),
          binance: binanceFeed.getSymbols(),
          autoLogs: autoEngine.getLogs(uid),
          timestamp: new Date().toISOString(),
        })
      );

      ws.on('close', () => {
        const set = userSockets.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) userSockets.delete(uid);
        }
      });
    } catch {
      ws.close(1008, 'Invalid authentication token');
    }
  });

  // Public basic health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'CHARANJEET QUANTX',
      binanceFeed: binanceFeed.getStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  // --- Authenticated Exness MT5 Bridge Endpoints ---
  app.get('/api/mt5/status', requireAuth, (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    res.json(mt5Relay.getSnapshot(uid));
  });

  app.post('/api/mt5/connect', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const { bridgeUrl, bridgeToken, login, password, server } = req.body as {
        bridgeUrl: string;
        bridgeToken: string;
        login?: string;
        password?: string;
        server?: string;
      };
      const status = await mt5Relay.connect(uid, {
        bridgeUrl,
        bridgeToken,
        login,
        password,
        server,
      });
      res.json(status);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to connect to Windows Python MT5 Bridge.',
      });
    }
  });

  app.post('/api/mt5/disconnect', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const status = await mt5Relay.disconnect(uid);
    res.json(status);
  });

  app.get('/api/mt5/candles', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const symbol = String(req.query.symbol || '');
    const timeframe = (String(req.query.timeframe || 'H1') as Timeframe) || 'H1';
    const count = Math.min(Number(req.query.count || 300), 1000);

    try {
      const snap = mt5Relay.getSnapshot(uid);
      if (snap.status.connected) {
        const hasMt5Symbol = snap.symbols.some((s) => s.symbol === symbol);
        if (hasMt5Symbol) {
          const candles = await mt5Relay.getCandles(uid, symbol, timeframe, count);
          res.json({ symbol, timeframe, provider: 'Exness MT5', candles });
          return;
        }
      }
      // Fallback to Binance public candles ONLY for supported public crypto spot symbols
      const binanceCandles = await binanceFeed.getCandles(symbol, timeframe, count);
      if (binanceCandles) {
        res.json({ symbol, timeframe, provider: 'Binance Spot Public', candles: binanceCandles });
        return;
      }
      res.status(503).json({
        error: `Historical data for ${symbol} requires an active Exness MT5 Bridge connection.`,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to load candles from MT5 Bridge.',
      });
    }
  });

  app.get('/api/market/depth', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const symbol = String(req.query.symbol || '');
    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required.' });
      return;
    }

    try {
      const snap = mt5Relay.getSnapshot(uid);
      if (snap.status.connected && snap.symbols.some((s) => s.symbol === symbol)) {
        const mt5Book = await mt5Relay.getMarketDepth(uid, symbol);
        if (mt5Book.available) {
          res.json(mt5Book);
          return;
        }
      }
      const binanceBook = await binanceFeed.getOrderBook(symbol, 20);
      res.json(binanceBook);
    } catch (err) {
      res.status(502).json({
        symbol,
        available: false,
        message: 'MARKET DEPTH NOT AVAILABLE',
        provider: 'Unavailable',
        timestamp: new Date().toISOString(),
        bids: [],
        asks: [],
        error: err instanceof Error ? err.message : 'Depth query failed',
      });
    }
  });

  app.post('/api/mt5/order/check', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const result = await mt5Relay.checkOrder(uid, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Order check failed.' });
    }
  });

  app.post('/api/mt5/order/send', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const result = await mt5Relay.sendOrder(uid, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Order execution rejected.' });
    }
  });

  app.post('/api/mt5/position/modify', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const { ticket, sl, tp } = req.body as { ticket: number; sl?: number; tp?: number };
      const result = await mt5Relay.modifyPosition(uid, Number(ticket), sl, tp);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Position modify failed.' });
    }
  });

  app.post('/api/mt5/position/close', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const { ticket, volume } = req.body as { ticket: number; volume?: number };
      const result = await mt5Relay.closePosition(uid, Number(ticket), volume);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Position close failed.' });
    }
  });

  app.post('/api/mt5/order/cancel', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    try {
      const { ticket } = req.body as { ticket: number };
      const result = await mt5Relay.cancelOrder(uid, Number(ticket));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Cancel pending order failed.' });
    }
  });

  // --- Automated Strategy Sync & Emergency Stop ---
  app.post('/api/auto/sync', requireAuth, (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const strategies = (req.body.strategies || []) as AutomatedStrategy[];
    autoEngine.setStrategies(uid, strategies);
    res.json({ synced: strategies.length, logs: autoEngine.getLogs(uid) });
  });

  app.post('/api/auto/emergency-stop', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const closeOpenPositions = Boolean(req.body?.closeOpenPositions);
    const result = await autoEngine.emergencyStopAll(uid, closeOpenPositions);
    res.json(result);
  });

  // --- Real Market News & Economic Calendar ---
  app.get('/api/intel/news', requireAuth, async (req, res) => {
    const force = req.query.refresh === 'true';
    const data = await getMarketNews(force);
    res.json(data);
  });

  app.get('/api/intel/calendar', requireAuth, async (req, res) => {
    const force = req.query.refresh === 'true';
    const data = await getEconomicCalendar(force);
    res.json(data);
  });

  // --- Read-Only Gemini AI Market & Strategy Analyst ---
  app.post('/api/ai/analyze', requireAuth, async (req, res) => {
    try {
      const answer = await analyzeMarketContext(req.body);
      res.json({ analysis: answer, readOnly: true, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'AI market analyst request failed.',
      });
    }
  });

  // --- Vite Dev Middleware / Static Production Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CHARANJEET QUANTX server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap CHARANJEET QUANTX server:', err);
  process.exit(1);
});
