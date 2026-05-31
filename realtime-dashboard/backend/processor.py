import pandas as pd
import numpy as np

SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT",
    "ADAUSDT", "XRPUSDT", "AVAXUSDT", "DOTUSDT",
]

class DataProcessor:
    def __init__(self, window: int = 20):
        self.window = window
        self.buffers = {sym: [] for sym in SYMBOLS}

    def ingest(self, symbol: str, price: float):
        if symbol not in self.buffers:
            return
        buf = self.buffers[symbol]
        buf.append(price)
        if len(buf) > self.window * 3:
            buf.pop(0)

    def compute_indicators(self, symbol: str) -> dict:
        if symbol not in self.buffers:
            return {"sma": None, "ema": None, "rsi": None, "volatility": None}
        buf = self.buffers[symbol]
        if len(buf) < 2:
            return {"sma": None, "ema": None, "rsi": None, "volatility": None}
        series = pd.Series(buf, dtype=float)
        sma = round(float(series.tail(self.window).mean()), 2) if len(series) >= self.window else None
        ema = round(float(series.tail(self.window).ewm(span=self.window, adjust=False).mean().iloc[-1]), 2) if len(series) >= self.window else None
        rsi = self._compute_rsi(series)
        vol = round(float(series.tail(self.window).std()), 4) if len(series) >= self.window else None
        return {"sma": sma, "ema": ema, "rsi": rsi, "volatility": vol}

    def _compute_rsi(self, series: pd.Series, period: int = 14):
        if len(series) < period + 1:
            return None
        delta = series.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = (-delta.where(delta < 0, 0.0))
        avg_gain = gain.tail(period).mean()
        avg_loss = loss.tail(period).mean()
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return round(100 - (100 / (1 + rs)), 2)
