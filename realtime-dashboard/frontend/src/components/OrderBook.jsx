import React, { useEffect, useState, useRef } from 'react'

export default function OrderBook({ symbol }) {
  const [bids, setBids] = useState([])
  const [asks, setAsks] = useState([])
  const [spread, setSpread] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    const fetchDepth = async () => {
      try {
        const rawSymbol = symbol.replace('/', '')
        const res = await fetch(`/api/depth?symbol=${rawSymbol}&limit=15`)
        const data = await res.json()
        if (data.bids?.length && data.asks?.length) {
          setBids(data.bids.slice(0, 15))
          setAsks(data.asks.slice(0, 15))
          const bestBid = data.bids[0][0]
          const bestAsk = data.asks[0][0]
          setSpread(((bestAsk - bestBid) / bestBid) * 100)
        }
      } catch { /* ignore */ }
    }

    fetchDepth()
    pollRef.current = setInterval(fetchDepth, 3000)

    return () => { clearInterval(pollRef.current) }
  }, [symbol])

  const maxTotal = bids.length > 0 || asks.length > 0
    ? Math.max(
        ...bids.map((b) => b[0] * b[1]),
        ...asks.map((a) => a[0] * a[1]),
      )
    : 1

  const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  const fmtQty = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })

  return (
    <div className="tv-orderbook">
      <div className="tv-ob-header">
        <span>Price ({symbol.split('/')[1] || 'USDT'})</span>
        <span>Amount ({symbol.split('/')[0] || 'BTC'})</span>
        <span>Total</span>
      </div>
      {[...asks].reverse().map(([price, qty], i) => {
        const total = price * qty
        return (
          <div className="tv-ob-row" key={`a-${i}`}>
            <span className="tv-ob-price ask">{fmt(price)}</span>
            <span className="tv-ob-qty">{fmtQty(qty)}</span>
            <span className="tv-ob-total">{fmt(total)}</span>
            <div className="tv-ob-bar ask" style={{ width: `${(total / maxTotal) * 100}%` }} />
          </div>
        )
      })}
      {spread != null && (
        <div className="tv-ob-spread">
          Spread: {spread.toFixed(3)}%
        </div>
      )}
      {bids.map(([price, qty], i) => {
        const total = price * qty
        return (
          <div className="tv-ob-row" key={`b-${i}`}>
            <span className="tv-ob-price bid">{fmt(price)}</span>
            <span className="tv-ob-qty">{fmtQty(qty)}</span>
            <span className="tv-ob-total">{fmt(total)}</span>
            <div className="tv-ob-bar bid" style={{ width: `${(total / maxTotal) * 100}%` }} />
          </div>
        )
      })}
    </div>
  )
}
