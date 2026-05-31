import asyncio
import json
import logging
import time
import aiohttp
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from processor import DataProcessor
from paper_trading import PaperTradeEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dashboard")

BINANCE_REST = "https://api.binance.com"

SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT",
    "ADAUSDT", "XRPUSDT", "AVAXUSDT", "DOTUSDT",
]

DISPLAY_SYMBOLS = {s: s.replace("USDT", "/USDT") for s in SYMBOLS}

connected_clients: set[WebSocket] = set()
latest_prices: dict = {}
processor = DataProcessor(window=20)
trade_engine = PaperTradeEngine(initial_balance=100000.0)
cached_symbols: list[dict] = []
binance_session: aiohttp.ClientSession | None = None

async def get_binance_session() -> aiohttp.ClientSession:
    global binance_session
    if binance_session is None:
        binance_session = aiohttp.ClientSession()
    return binance_session

async def broadcast(message: str):
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.discard(ws)

async def cache_exchange_info():
    global cached_symbols
    try:
        info = await fetch_json(f"{BINANCE_REST}/api/v3/exchangeInfo")
        cached_symbols = []
        for s in info.get("symbols", []):
            if s.get("quoteAsset") == "USDT" and s.get("status") == "TRADING":
                cached_symbols.append({
                    "symbol": s["symbol"],
                    "baseAsset": s["baseAsset"],
                    "quoteAsset": s["quoteAsset"],
                })
        logger.info(f"Cached {len(cached_symbols)} USDT trading pairs")
    except Exception as e:
        logger.warning(f"Failed to cache exchangeInfo: {e}")

async def binance_ws_listener():
    streams = "/".join(f"{s.lower()}@miniTicker" for s in SYMBOLS)
    url = f"wss://stream.binance.com:9443/stream?streams={streams}"
    snapshot_counter = 0
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(url, heartbeat=30) as ws:
                    logger.info("Connected to Binance WebSocket")
                    async for msg in ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            try:
                                data = json.loads(msg.data)
                                payload = data.get("data", {})
                                symbol = payload.get("s", "")
                                if symbol not in SYMBOLS:
                                    continue
                                price = float(payload["c"])
                                open_p = float(payload["o"])
                                change = ((price - open_p) / open_p) * 100 if open_p else 0
                                entry = {
                                    "price": price,
                                    "open": open_p,
                                    "high": float(payload["h"]),
                                    "low": float(payload["l"]),
                                    "volume": float(payload["v"]),
                                    "quote_volume": float(payload["q"]),
                                    "change_24h": round(change, 2),
                                    "timestamp": int(time.time() * 1000),
                                }
                                latest_prices[symbol] = entry
                                processor.ingest(symbol, price)
                                enriched = {}
                                for sym in SYMBOLS:
                                    if sym in latest_prices:
                                        enriched[DISPLAY_SYMBOLS[sym]] = {
                                            **latest_prices[sym],
                                            "indicators": processor.compute_indicators(sym),
                                        }
                                msg_out = json.dumps({
                                    "type": "price_update",
                                    "data": enriched,
                                })
                                await broadcast(msg_out)

                                snapshot_counter += 1
                                trade_engine.tick(latest_prices)
                                if snapshot_counter % 5 == 0:
                                    trade_engine.snapshot_equity(extract_prices())

                            except Exception as e:
                                logger.warning(f"Error processing WS message: {e}")
                        elif msg.type == aiohttp.WSMsgType.ERROR:
                            break
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Binance WS error: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)

async def fetch_json(url: str, params: dict = None) -> dict | list:
    session = await get_binance_session()
    async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        return await resp.json()

app = FastAPI(lifespan=lambda app: lifespan(app))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/klines")
async def get_klines(symbol: str = Query("BTCUSDT"), interval: str = Query("1m"), limit: int = Query(200)):
    raw = await fetch_json(f"{BINANCE_REST}/api/v3/klines", {
        "symbol": symbol.upper(),
        "interval": interval,
        "limit": min(limit, 1000),
    })
    klines = []
    for k in raw:
        klines.append({
            "time": k[0] // 1000,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })
    return {"symbol": symbol, "interval": interval, "klines": klines}

@app.get("/api/ticker24hr")
async def get_ticker24hr():
    raw = await fetch_json(f"{BINANCE_REST}/api/v3/ticker/24hr")
    result = {}
    for entry in raw:
        s = entry.get("symbol", "")
        if s in SYMBOLS:
            result[DISPLAY_SYMBOLS[s]] = {
                "symbol": DISPLAY_SYMBOLS[s],
                "priceChange": float(entry["priceChange"]),
                "priceChangePercent": float(entry["priceChangePercent"]),
                "lastPrice": float(entry["lastPrice"]),
                "highPrice": float(entry["highPrice"]),
                "lowPrice": float(entry["lowPrice"]),
                "volume": float(entry["volume"]),
                "quoteVolume": float(entry["quoteVolume"]),
                "count": entry["count"],
            }
    return result

@app.get("/api/depth")
async def get_depth(symbol: str = Query("BTCUSDT"), limit: int = Query(20)):
    raw = await fetch_json(f"{BINANCE_REST}/api/v3/depth", {
        "symbol": symbol.upper(),
        "limit": min(limit, 100),
    })
    bids = [[float(p), float(q)] for p, q in raw.get("bids", [])]
    asks = [[float(p), float(q)] for p, q in raw.get("asks", [])]
    return {"symbol": symbol, "bids": bids, "asks": asks, "timestamp": raw.get("lastUpdateId")}

@app.get("/api/trades")
async def get_trades(symbol: str = Query("BTCUSDT"), limit: int = Query(50)):
    raw = await fetch_json(f"{BINANCE_REST}/api/v3/trades", {
        "symbol": symbol.upper(),
        "limit": min(limit, 100),
    })
    return [{
        "id": t["id"],
        "price": float(t["price"]),
        "qty": float(t["qty"]),
        "time": t["time"],
        "isBuyerMaker": t["isBuyerMaker"],
    } for t in raw]

@app.get("/api/search")
async def search_pairs(q: str = Query(""), limit: int = Query(15)):
    query = q.upper().strip()
    if not query:
        return cached_symbols[:limit]

    matches = [
        s for s in cached_symbols
        if query in s["symbol"] or query in s["baseAsset"]
    ]
    matches = matches[:limit]

    try:
        ticker_data = await fetch_json(f"{BINANCE_REST}/api/v3/ticker/24hr")
        price_map = {}
        for t in ticker_data:
            sym = t.get("symbol", "")
            if sym in cached_symbols or sym in [m["symbol"] for m in matches]:
                price_map[sym] = {
                    "price": float(t.get("lastPrice", 0)),
                    "change24h": float(t.get("priceChangePercent", 0)),
                    "volume": float(t.get("volume", 0)),
                    "high": float(t.get("highPrice", 0)),
                    "low": float(t.get("lowPrice", 0)),
                }
        results = []
        for m in matches:
            p = price_map.get(m["symbol"], {})
            results.append({
                "symbol": m["symbol"],
                "display": m["symbol"].replace("USDT", "/USDT"),
                "baseAsset": m["baseAsset"],
                "price": p.get("price", 0),
                "change24h": p.get("change24h", 0),
                "volume": p.get("volume", 0),
                "high": p.get("high", 0),
                "low": p.get("low", 0),
            })
        return results
    except Exception as e:
        logger.warning(f"Search price fetch error: {e}")
        return matches

class OrderRequest(BaseModel):
    symbol: str
    qty: float
    sl: float | None = None
    tp: float | None = None

class LimitOrderRequest(BaseModel):
    symbol: str
    side: str
    qty: float
    limit_price: float
    sl: float | None = None
    tp: float | None = None

class StopOrderRequest(BaseModel):
    symbol: str
    side: str
    qty: float
    stop_price: float
    limit_price: float | None = None
    sl: float | None = None
    tp: float | None = None

@app.post("/api/trade/buy")
async def trade_buy(order: OrderRequest):
    sym = order.symbol
    price_data = latest_prices.get(sym)
    if not price_data:
        return {"error": f"No price data for {sym}"}
    return trade_engine.buy(sym, order.qty, price_data["price"], order.sl, order.tp)

@app.post("/api/trade/sell")
async def trade_sell(order: OrderRequest):
    sym = order.symbol
    price_data = latest_prices.get(sym)
    if not price_data:
        return {"error": f"No price data for {sym}"}
    return trade_engine.sell(sym, order.qty, price_data["price"])

@app.post("/api/trade/close_position")
async def close_position(symbol: str = Query(...), qty: float = Query(None)):
    price_data = latest_prices.get(symbol)
    if not price_data:
        return {"error": f"No price data for {symbol}"}
    return trade_engine.close_position(symbol, qty, price_data["price"])

@app.post("/api/trade/limit_order")
async def limit_order(order: LimitOrderRequest):
    return trade_engine.place_limit_order(order.symbol, order.side, order.qty, order.limit_price, order.sl, order.tp)

@app.post("/api/trade/stop_order")
async def stop_order(order: StopOrderRequest):
    return trade_engine.place_stop_order(order.symbol, order.side, order.qty, order.stop_price, order.limit_price, order.sl, order.tp)

@app.post("/api/trade/cancel_order")
async def cancel_order(order_id: int = Query(...)):
    return trade_engine.cancel_order(order_id)

@app.post("/api/trade/update_sltp")
async def update_sltp(symbol: str = Query(...), sl: float = Query(None), tp: float = Query(None)):
    return trade_engine.update_position_sltp(symbol, sl, tp)

def extract_prices():
    return {sym: data["price"] for sym, data in latest_prices.items() if "price" in data}

@app.get("/api/trade/portfolio")
async def get_portfolio():
    return trade_engine.get_portfolio(extract_prices())

@app.get("/api/trade/history")
async def get_trade_history():
    return {"trades": trade_engine.trades[-100:]}

@app.get("/api/trade/equity_history")
async def get_equity_history():
    return {"history": trade_engine.equity_snapshots[-500:]}

@app.post("/api/trade/reset")
async def reset_trading(balance: float = Query(100000.0)):
    trade_engine.reset(balance)
    return {"success": True, "balance": balance}

@app.post("/api/trade/leverage")
async def set_leverage(leverage: int = Query(1)):
    if leverage < 1 or leverage > 100:
        return {"error": "Leverage must be between 1 and 100"}
    trade_engine.leverage = leverage
    return {"success": True, "leverage": leverage}

@app.get("/api/trade/settings")
async def get_settings():
    return {"leverage": trade_engine.leverage, "balance": trade_engine.balance, "initial_balance": trade_engine.initial_balance}

@app.get("/api/market_overview")
async def get_market_overview():
    ticker_data = await fetch_json(f"{BINANCE_REST}/api/v3/ticker/24hr")
    usdt_pairs = []
    for t in ticker_data:
        if t.get("symbol", "").endswith("USDT"):
            try:
                usdt_pairs.append({
                    "symbol": t["symbol"],
                    "display": t["symbol"].replace("USDT", "/USDT"),
                    "lastPrice": float(t["lastPrice"]),
                    "priceChangePercent": float(t["priceChangePercent"]),
                    "volume": float(t["volume"]),
                    "quoteVolume": float(t["quoteVolume"]),
                })
            except (ValueError, KeyError):
                continue
    usdt_pairs.sort(key=lambda x: x["quoteVolume"], reverse=True)
    return {"pairs": usdt_pairs[:50]}

@app.get("/health")
async def health():
    return {"status": "ok", "clients": len(connected_clients), "pairs": len(latest_prices)}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    logger.info("Client connected. Total: %d", len(connected_clients))
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except (WebSocketDisconnect, json.JSONDecodeError):
        pass
    finally:
        connected_clients.discard(ws)
        logger.info("Client disconnected. Total: %d", len(connected_clients))

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Binance WebSocket listener")
    ws_task = asyncio.create_task(binance_ws_listener())
    await cache_exchange_info()
    yield
    ws_task.cancel()
    global binance_session
    if binance_session:
        await binance_session.close()
    logger.info("Shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8765, reload=True)
