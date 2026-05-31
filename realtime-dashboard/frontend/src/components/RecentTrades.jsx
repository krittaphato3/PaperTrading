import React, { useEffect, useState, useRef } from 'react'

export default function RecentTrades({ symbol, tradeFeed }) {
  const [trades, setTrades] = useState([])
  const pollRef = useRef(null)

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const rawSymbol = symbol.replace('/', '')
        const res = await fetch(`/api/trades?symbol=${rawSymbol}&limit=50`)
        const data = await res.json()
        if (Array.isArray(data)) setTrades(data)
      } catch { /* ignore */ }
    }

    fetchTrades()
    pollRef.current = setInterval(fetchTrades, 5000)
    return () => { clearInterval(pollRef.current) }
  }, [symbol])

  useEffect(() => {
    if (!tradeFeed) return
    setTrades((prev) => {
      const next = [tradeFeed, ...prev]
      return next.slice(0, 100)
    })
  }, [tradeFeed])

  const fmtPrice = (p) => p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  const fmtQty = (q) => q.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })

  return (
    <div className="tv-trades">
      {trades.slice(0, 30).map((t, i) => (
        <div className="tv-trade-row" key={t.id || i}>
          <span className={`tv-trade-price ${t.isBuyerMaker ? 'sell' : 'buy'}`}>
            {fmtPrice(t.price)}
          </span>
          <span className="tv-trade-qty">{fmtQty(t.qty)}</span>
          <span className="tv-trade-time">
            {new Date(t.time).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  )
}
