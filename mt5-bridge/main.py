"""
CHARANJEET QUANTX — Official Windows Python MT5 Bridge
Connects a locally running Exness MetaTrader 5 Desktop Terminal to the
CHARANJEET QUANTX Node.js backend via authenticated HTTPS/REST and WebSocket.

IMPORTANT:
- Run this bridge ONLY on a trusted Windows PC or Windows VPS with MetaTrader 5 installed.
- Always configure a strong MT5_BRIDGE_SECRET and restrict ALLOWED_ORIGINS.
- Never expose this bridge publicly without TLS (HTTPS/WSS) and token authentication.
"""

import asyncio
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import MetaTrader5 as mt5
    MT5_IMPORT_ERROR: Optional[str] = None
except Exception as exc:  # pragma: no cover - non-Windows dev environments
    mt5 = None
    MT5_IMPORT_ERROR = str(exc)

load_dotenv()

BRIDGE_SECRET = os.getenv("MT5_BRIDGE_SECRET", "")
MT5_TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "").strip()
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(
    title="CHARANJEET QUANTX MT5 Bridge",
    version="1.0.0",
    description="Authenticated bridge between Windows MetaTrader 5 terminal and CHARANJEET QUANTX.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectRequest(BaseModel):
    login: Optional[int] = Field(default=None, description="Exness MT5 account login number")
    password: Optional[str] = Field(default=None, description="Exness MT5 master password (never logged)")
    server: Optional[str] = Field(default=None, description="Exness MT5 server name, e.g. Exness-MT5Real")
    path: Optional[str] = Field(default=None, description="Optional terminal64.exe path")


class OrderCheckPayload(BaseModel):
    symbol: str
    side: str = Field(pattern="^(BUY|SELL)$")
    order_type: str = Field(default="MARKET", pattern="^(MARKET|BUY_LIMIT|SELL_LIMIT|BUY_STOP|SELL_STOP)$")
    volume: float = Field(gt=0)
    price: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None
    deviation: int = Field(default=20, ge=0, le=500)
    comment: str = Field(default="QUANTX", max_length=31)


class ModifyPositionPayload(BaseModel):
    ticket: int
    sl: Optional[float] = None
    tp: Optional[float] = None


class ClosePositionPayload(BaseModel):
    ticket: int
    volume: Optional[float] = None
    deviation: int = Field(default=20, ge=0, le=500)
    comment: str = Field(default="QUANTX Close", max_length=31)


class CancelOrderPayload(BaseModel):
    ticket: int


def verify_bridge_token(authorization: Optional[str] = Header(default=None)) -> None:
    if not BRIDGE_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MT5_BRIDGE_SECRET is not configured on the bridge host.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token.",
        )
    provided = authorization.split("Bearer ", 1)[1].strip()
    if not secrets.compare_digest(provided, BRIDGE_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bridge authentication token.",
        )


def ensure_mt5_ready() -> None:
    if mt5 is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MetaTrader5 Python package unavailable on this OS/environment: {MT5_IMPORT_ERROR}",
        )
    terminal = mt5.terminal_info()
    if terminal is None:
        init_ok = mt5.initialize(path=MT5_TERMINAL_PATH) if MT5_TERMINAL_PATH else mt5.initialize()
        if not init_ok:
            err = mt5.last_error()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to attach to Windows MetaTrader 5 terminal: {err}",
            )


def map_account_type(trade_mode: int) -> str:
    if mt5 is None:
        return "Unverified"
    if trade_mode == mt5.ACCOUNT_TRADE_MODE_REAL:
        return "Live Account"
    if trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO:
        return "Practice Account"
    if trade_mode == mt5.ACCOUNT_TRADE_MODE_CONTEST:
        return "Contest Account"
    return "Unverified"


def categorize_symbol(path: str, name: str) -> str:
    p = (path or "").lower()
    n = name.upper()
    if "crypto" in p or any(c in n for c in ("BTC", "ETH", "SOL", "XRP", "LTC", "BNB", "ADA", "DOGE")):
        return "Crypto"
    if "metal" in p or any(m in n for m in ("XAU", "XAG", "XPT", "XPD")):
        return "Metals"
    if "energy" in p or "oil" in p or "commodit" in p or any(e in n for e in ("USOIL", "UKOIL", "XNGUSD", "NGAS")):
        return "Commodities"
    if "ind" in p or any(idx in n for idx in ("US30", "US500", "USTEC", "NAS100", "DE40", "UK100", "JP225", "HK50")):
        return "Indices"
    if "stock" in p or "equit" in p or "share" in p:
        return "Stocks"
    if "forex" in p or "fx" in p or (len(n) >= 6 and n[:3].isalpha() and n[3:6].isalpha()):
        return "Forex"
    return "Other"


def serialize_account() -> Dict[str, Any]:
    ensure_mt5_ready()
    info = mt5.account_info()
    term = mt5.terminal_info()
    if info is None:
        raise HTTPException(status_code=404, detail=f"No MT5 account logged in: {mt5.last_error()}")
    return {
        "login": str(info.login),
        "broker": info.company,
        "server": info.server,
        "currency": info.currency,
        "balance": float(info.balance),
        "equity": float(info.equity),
        "floatingPnl": float(info.profit),
        "credit": float(info.credit),
        "usedMargin": float(info.margin),
        "freeMargin": float(info.margin_free),
        "marginLevel": float(info.margin_level),
        "leverage": int(info.leverage),
        "tradeAllowed": bool(info.trade_allowed and (term.trade_allowed if term else True)),
        "algoTradingAllowed": bool(info.trade_expert and (term.tradeapi_disabled is False if term else True)),
        "accountType": map_account_type(info.trade_mode),
        "connected": bool(term.connected if term else True),
        "lastSync": datetime.now(timezone.utc).isoformat(),
    }


def serialize_symbols(limit: int = 1500) -> List[Dict[str, Any]]:
    ensure_mt5_ready()
    raw = mt5.symbols_get()
    if raw is None:
        return []
    result: List[Dict[str, Any]] = []
    for s in raw[:limit]:
        tick = mt5.symbol_info_tick(s.name)
        bid = float(tick.bid) if tick else float(s.bid)
        ask = float(tick.ask) if tick else float(s.ask)
        spread = round((ask - bid) / s.point) if s.point > 0 and ask >= bid else int(s.spread)
        result.append({
            "symbol": s.name,
            "description": s.description or s.name,
            "category": categorize_symbol(s.path, s.name),
            "path": s.path,
            "bid": bid,
            "ask": ask,
            "spread": spread,
            "digits": int(s.digits),
            "point": float(s.point),
            "lastTickTime": datetime.fromtimestamp(tick.time, tz=timezone.utc).isoformat() if tick and tick.time else None,
            "contractSize": float(s.trade_contract_size),
            "volumeMin": float(s.volume_min),
            "volumeMax": float(s.volume_max),
            "volumeStep": float(s.volume_step),
            "tickSize": float(s.trade_tick_size),
            "tickValue": float(s.trade_tick_value),
            "tradeMode": int(s.trade_mode),
            "tradeable": bool(s.trade_mode != mt5.SYMBOL_TRADE_MODE_DISABLED),
            "marginInitial": float(s.margin_initial),
            "sessionDeals": int(s.session_deals),
            "sessionVolume": float(s.session_volume),
            "changePct": float(s.price_change) if hasattr(s, "price_change") else 0.0,
            "provider": "Exness MT5",
        })
    return result


TIMEFRAME_MAP_NAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]


def get_mt5_timeframe(tf: str) -> int:
    ensure_mt5_ready()
    mapping = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
        "W1": mt5.TIMEFRAME_W1,
        "MN1": mt5.TIMEFRAME_MN1,
    }
    if tf not in mapping:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {tf}")
    return mapping[tf]


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "CHARANJEET QUANTX MT5 Bridge",
        "mt5PackageAvailable": mt5 is not None,
        "mt5ImportError": MT5_IMPORT_ERROR,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/mt5/connect", dependencies=[Depends(verify_bridge_token)])
def connect_mt5(payload: ConnectRequest) -> Dict[str, Any]:
    if mt5 is None:
        raise HTTPException(
            status_code=503,
            detail=f"MetaTrader5 Python library unavailable: {MT5_IMPORT_ERROR}",
        )
    terminal_path = (payload.path or MT5_TERMINAL_PATH or "").strip()
    kwargs: Dict[str, Any] = {}
    if terminal_path:
        kwargs["path"] = terminal_path
    if payload.login and payload.password and payload.server:
        kwargs["login"] = payload.login
        kwargs["password"] = payload.password
        kwargs["server"] = payload.server

    ok = mt5.initialize(**kwargs)
    if not ok:
        err = mt5.last_error()
        raise HTTPException(status_code=401, detail=f"MT5 initialize failed: {err}")

    if payload.login and payload.password and payload.server:
        login_ok = mt5.login(payload.login, password=payload.password, server=payload.server)
        if not login_ok:
            err = mt5.last_error()
            raise HTTPException(status_code=401, detail=f"MT5 login rejected by broker: {err}")

    return {"connected": True, "account": serialize_account()}


@app.post("/api/mt5/disconnect", dependencies=[Depends(verify_bridge_token)])
def disconnect_mt5() -> Dict[str, Any]:
    if mt5 is not None:
        mt5.shutdown()
    return {"disconnected": True, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/mt5/account", dependencies=[Depends(verify_bridge_token)])
def get_account() -> Dict[str, Any]:
    return serialize_account()


@app.get("/api/mt5/symbols", dependencies=[Depends(verify_bridge_token)])
def get_symbols() -> Dict[str, Any]:
    symbols = serialize_symbols()
    return {"count": len(symbols), "symbols": symbols, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/mt5/candles", dependencies=[Depends(verify_bridge_token)])
def get_candles(
    symbol: str = Query(..., min_length=1, max_length=40),
    timeframe: str = Query(default="H1"),
    count: int = Query(default=300, ge=10, le=2000),
) -> Dict[str, Any]:
    ensure_mt5_ready()
    mt5.symbol_select(symbol, True)
    tf = get_mt5_timeframe(timeframe)
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if rates is None:
        raise HTTPException(status_code=404, detail=f"No historical rates for {symbol} ({timeframe}): {mt5.last_error()}")
    candles = [
        {
            "time": int(r["time"]),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low": float(r["low"]),
            "close": float(r["close"]),
            "volume": float(r["tick_volume"]),
        }
        for r in rates
    ]
    return {"symbol": symbol, "timeframe": timeframe, "provider": "Exness MT5", "candles": candles}


@app.get("/api/mt5/depth", dependencies=[Depends(verify_bridge_token)])
def get_market_depth(symbol: str = Query(..., min_length=1, max_length=40)) -> Dict[str, Any]:
    ensure_mt5_ready()
    mt5.symbol_select(symbol, True)
    added = mt5.market_book_add(symbol)
    if not added:
        return {
            "symbol": symbol,
            "available": False,
            "message": "MARKET DEPTH NOT AVAILABLE",
            "provider": "Exness MT5",
            "bids": [],
            "asks": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    book = mt5.market_book_get(symbol)
    if not book:
        return {
            "symbol": symbol,
            "available": False,
            "message": "MARKET DEPTH NOT AVAILABLE",
            "provider": "Exness MT5",
            "bids": [],
            "asks": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    bids = []
    asks = []
    for level in book:
        item = {"price": float(level.price), "volume": float(level.volume_real or level.volume)}
        if level.type in (mt5.BOOK_TYPE_BUY, mt5.BOOK_TYPE_BUY_MARKET):
            bids.append(item)
        else:
            asks.append(item)
    return {
        "symbol": symbol,
        "available": True,
        "provider": "Exness MT5 Market Book",
        "bids": sorted(bids, key=lambda x: x["price"], reverse=True),
        "asks": sorted(asks, key=lambda x: x["price"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/mt5/positions", dependencies=[Depends(verify_bridge_token)])
def get_positions() -> Dict[str, Any]:
    ensure_mt5_ready()
    raw = mt5.positions_get() or []
    positions = [
        {
            "ticket": int(p.ticket),
            "symbol": p.symbol,
            "side": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
            "volume": float(p.volume),
            "entryPrice": float(p.price_open),
            "currentPrice": float(p.price_current),
            "sl": float(p.sl),
            "tp": float(p.tp),
            "swap": float(p.swap),
            "floatingPnl": float(p.profit),
            "magic": int(p.magic),
            "comment": p.comment,
            "openTime": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
        }
        for p in raw
    ]
    return {"positions": positions, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/mt5/orders", dependencies=[Depends(verify_bridge_token)])
def get_orders() -> Dict[str, Any]:
    ensure_mt5_ready()
    raw = mt5.orders_get() or []
    type_names = {
        mt5.ORDER_TYPE_BUY_LIMIT: "BUY_LIMIT",
        mt5.ORDER_TYPE_SELL_LIMIT: "SELL_LIMIT",
        mt5.ORDER_TYPE_BUY_STOP: "BUY_STOP",
        mt5.ORDER_TYPE_SELL_STOP: "SELL_STOP",
    }
    orders = [
        {
            "ticket": int(o.ticket),
            "symbol": o.symbol,
            "orderType": type_names.get(o.type, str(o.type)),
            "volume": float(o.volume_current),
            "price": float(o.price_open),
            "sl": float(o.sl),
            "tp": float(o.tp),
            "comment": o.comment,
            "setupTime": datetime.fromtimestamp(o.time_setup, tz=timezone.utc).isoformat(),
        }
        for o in raw
    ]
    return {"orders": orders, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/mt5/history", dependencies=[Depends(verify_bridge_token)])
def get_history(days: int = Query(default=30, ge=1, le=365)) -> Dict[str, Any]:
    ensure_mt5_ready()
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    date_from = now - timedelta(days=days)
    raw_deals = mt5.history_deals_get(date_from, now) or []
    deals = [
        {
            "ticket": int(d.ticket),
            "order": int(d.order),
            "symbol": d.symbol,
            "side": "BUY" if d.type == mt5.DEAL_TYPE_BUY else ("SELL" if d.type == mt5.DEAL_TYPE_SELL else "BALANCE"),
            "entry": int(d.entry),
            "volume": float(d.volume),
            "price": float(d.price),
            "profit": float(d.profit),
            "commission": float(d.commission),
            "swap": float(d.swap),
            "comment": d.comment,
            "time": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
        }
        for d in raw_deals
    ]
    return {"deals": list(reversed(deals)), "timestamp": now.isoformat()}


def build_mt5_request(payload: OrderCheckPayload) -> Dict[str, Any]:
    ensure_mt5_ready()
    sym = mt5.symbol_info(payload.symbol)
    if sym is None:
        raise HTTPException(status_code=404, detail=f"Symbol {payload.symbol} not found in MT5.")
    if not sym.visible:
        mt5.symbol_select(payload.symbol, True)
    tick = mt5.symbol_info_tick(payload.symbol)
    if tick is None:
        raise HTTPException(status_code=503, detail=f"No active quote tick for {payload.symbol}.")

    if payload.order_type == "MARKET":
        action = mt5.TRADE_ACTION_DEAL
        order_type = mt5.ORDER_TYPE_BUY if payload.side == "BUY" else mt5.ORDER_TYPE_SELL
        price = float(tick.ask if payload.side == "BUY" else tick.bid)
    else:
        action = mt5.TRADE_ACTION_PENDING
        order_map = {
            "BUY_LIMIT": mt5.ORDER_TYPE_BUY_LIMIT,
            "SELL_LIMIT": mt5.ORDER_TYPE_SELL_LIMIT,
            "BUY_STOP": mt5.ORDER_TYPE_BUY_STOP,
            "SELL_STOP": mt5.ORDER_TYPE_SELL_STOP,
        }
        order_type = order_map[payload.order_type]
        if payload.price is None or payload.price <= 0:
            raise HTTPException(status_code=400, detail="Pending orders require a valid target price.")
        price = float(payload.price)

    req: Dict[str, Any] = {
        "action": action,
        "symbol": payload.symbol,
        "volume": float(payload.volume),
        "type": order_type,
        "price": price,
        "deviation": payload.deviation,
        "magic": 202611,
        "comment": payload.comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_FOK,
    }
    if payload.sl and payload.sl > 0:
        req["sl"] = float(payload.sl)
    if payload.tp and payload.tp > 0:
        req["tp"] = float(payload.tp)
    return req


@app.post("/api/mt5/order/check", dependencies=[Depends(verify_bridge_token)])
def check_order(payload: OrderCheckPayload) -> Dict[str, Any]:
    req = build_mt5_request(payload)
    res = mt5.order_check(req)
    if res is None:
        raise HTTPException(status_code=400, detail=f"MT5 order_check failed: {mt5.last_error()}")
    return {
        "valid": res.retcode == 0,
        "retcode": int(res.retcode),
        "margin": float(res.margin),
        "freeMargin": float(res.margin_free),
        "marginLevel": float(res.margin_level),
        "comment": res.comment,
    }


@app.post("/api/mt5/order/send", dependencies=[Depends(verify_bridge_token)])
def send_order(payload: OrderCheckPayload) -> Dict[str, Any]:
    req = build_mt5_request(payload)
    res = mt5.order_send(req)
    if res is None:
        raise HTTPException(status_code=500, detail=f"MT5 order_send returned None: {mt5.last_error()}")
    # Fallback to IOC if FOK unsupported by symbol filling mode
    if res.retcode == mt5.TRADE_RETCODE_INVALID_FILL:
        req["type_filling"] = mt5.ORDER_FILLING_IOC
        res = mt5.order_send(req)
    return {
        "executed": res.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED),
        "retcode": int(res.retcode),
        "ticket": int(res.order or res.deal),
        "deal": int(res.deal),
        "order": int(res.order),
        "price": float(res.price),
        "volume": float(res.volume),
        "comment": res.comment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/mt5/position/modify", dependencies=[Depends(verify_bridge_token)])
def modify_position(payload: ModifyPositionPayload) -> Dict[str, Any]:
    ensure_mt5_ready()
    pos_list = mt5.positions_get(ticket=payload.ticket)
    if not pos_list:
        raise HTTPException(status_code=404, detail=f"Position {payload.ticket} not found.")
    pos = pos_list[0]
    req = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": pos.symbol,
        "position": pos.ticket,
        "sl": float(payload.sl if payload.sl is not None else pos.sl),
        "tp": float(payload.tp if payload.tp is not None else pos.tp),
    }
    res = mt5.order_send(req)
    if res is None:
        raise HTTPException(status_code=500, detail=f"Modify failed: {mt5.last_error()}")
    return {
        "modified": res.retcode == mt5.TRADE_RETCODE_DONE,
        "retcode": int(res.retcode),
        "comment": res.comment,
    }


@app.post("/api/mt5/position/close", dependencies=[Depends(verify_bridge_token)])
def close_position(payload: ClosePositionPayload) -> Dict[str, Any]:
    ensure_mt5_ready()
    pos_list = mt5.positions_get(ticket=payload.ticket)
    if not pos_list:
        raise HTTPException(status_code=404, detail=f"Position {payload.ticket} not found.")
    pos = pos_list[0]
    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        raise HTTPException(status_code=503, detail=f"No active tick for {pos.symbol}.")
    close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price = float(tick.bid if pos.type == mt5.POSITION_TYPE_BUY else tick.ask)
    vol = float(payload.volume if payload.volume and payload.volume < pos.volume else pos.volume)
    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": vol,
        "type": close_type,
        "position": pos.ticket,
        "price": price,
        "deviation": payload.deviation,
        "magic": 202611,
        "comment": payload.comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    res = mt5.order_send(req)
    if res is None:
        raise HTTPException(status_code=500, detail=f"Close failed: {mt5.last_error()}")
    return {
        "closed": res.retcode == mt5.TRADE_RETCODE_DONE,
        "retcode": int(res.retcode),
        "ticket": int(res.deal or res.order),
        "price": float(res.price),
        "volume": float(res.volume),
        "comment": res.comment,
    }


@app.post("/api/mt5/order/cancel", dependencies=[Depends(verify_bridge_token)])
def cancel_order(payload: CancelOrderPayload) -> Dict[str, Any]:
    ensure_mt5_ready()
    req = {"action": mt5.TRADE_ACTION_REMOVE, "order": payload.ticket}
    res = mt5.order_send(req)
    if res is None:
        raise HTTPException(status_code=500, detail=f"Cancel failed: {mt5.last_error()}")
    return {"cancelled": res.retcode == mt5.TRADE_RETCODE_DONE, "retcode": int(res.retcode), "comment": res.comment}


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket, token: str = Query(default="")) -> None:
    if not BRIDGE_SECRET or not secrets.compare_digest(token, BRIDGE_SECRET):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        while True:
            try:
                account = serialize_account()
                positions = get_positions()["positions"]
                orders = get_orders()["orders"]
                symbols = serialize_symbols(limit=250)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "mt5:snapshot",
                            "account": account,
                            "positions": positions,
                            "orders": orders,
                            "quotes": [
                                {
                                    "symbol": s["symbol"],
                                    "bid": s["bid"],
                                    "ask": s["ask"],
                                    "spread": s["spread"],
                                    "lastTickTime": s["lastTickTime"],
                                    "changePct": s["changePct"],
                                    "sessionVolume": s["sessionVolume"],
                                }
                                for s in symbols
                            ],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                )
            except Exception as err:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "mt5:error",
                            "error": str(err),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                )
            await asyncio.sleep(0.75)
    except WebSocketDisconnect:
        return
