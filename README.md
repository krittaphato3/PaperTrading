# PaperTrading

A real-time cryptocurrency trading dashboard with a paper trading engine, technical analysis indicators, and live Binance market data.

## Features

- **Live Market Data** — Real-time price streaming via Binance WebSocket for BTC, ETH, SOL, DOGE, ADA, XRP, AVAX, DOT
- **Paper Trading** — Buy/sell with virtual balance, margin/leverage support, SL/TP orders, limit & stop orders
- **Technical Indicators** — SMA, EMA, WMA, VWMA, Bollinger Bands, Parabolic SAR, Ichimoku Cloud, RSI, MACD, Stochastic, ATR, ADX
- **Charting** — Candlestick/Bar/Line/Area/Heikin-Ashi charts with timeframe selection (1m–1d)
- **Drawing Tools** — Trendlines, horizontal/vertical lines, Fibonacci retracements
- **Order Book & Trade History** — Live depth and recent trades
- **Portfolio Tracking** — Real-time equity curve, P&L, margin usage

## Architecture

```
realtime-dashboard/
├── backend/
│   ├── main.py            # FastAPI server, WebSocket, REST API
│   ├── paper_trading.py   # Paper trading engine
│   ├── processor.py       # Technical indicator computation
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/    # React UI components
    │   ├── hooks/         # WebSocket hook
    │   └── utils/         # Indicators & drawing tools
    ├── package.json
    └── vite.config.js
```

## Getting Started

### Backend

```bash
cd realtime-dashboard/backend
pip install -r requirements.txt
python main.py
```

Server starts at `http://localhost:8765`

### Frontend

```bash
cd realtime-dashboard/frontend
npm install
npm run dev
```

Dashboard opens at `http://localhost:5173`

## API Endpoints

- `GET /api/klines?symbol=BTCUSDT&interval=5m` — OHLCV data
- `GET /api/depth?symbol=BTCUSDT` — Order book
- `GET /api/trades?symbol=BTCUSDT` — Recent trades
- `GET /api/search?q=BTC` — Pair search
- `POST /api/trade/buy` — Market buy
- `POST /api/trade/sell` — Market sell
- `POST /api/trade/limit_order` — Limit order
- `POST /api/trade/stop_order` — Stop/stop-limit order
- `GET /api/trade/portfolio` — Portfolio summary
- `GET /api/trade/equity_history` — Equity curve data
- `WS /ws` — Real-time price feed
