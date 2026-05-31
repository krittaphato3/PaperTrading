import React from 'react'

const TICKER_ORDER = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT',
]

export default function TickerTape({ prices, activeSymbol, onSelect }) {
  return (
    <div className="tv-ticker-tape">
      {TICKER_ORDER.map((sym) => {
        const data = prices[sym]
        if (!data) {
          return (
            <div className="tv-ticker-item" key={sym}>
              <span className="tv-ticker-symbol">{sym}</span>
              <span className="tv-ticker-price">---</span>
            </div>
          )
        }
        const isUp = data.change_24h >= 0
        return (
          <div
            className={`tv-ticker-item ${activeSymbol === sym ? 'active' : ''}`}
            key={sym}
            onClick={() => onSelect(sym)}
          >
            <span className="tv-ticker-symbol">{sym}</span>
            <span className="tv-ticker-price">
              ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
            </span>
            <span className={`tv-ticker-change ${isUp ? 'green' : 'red'}`}>
              {isUp ? '+' : ''}{data.change_24h.toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
