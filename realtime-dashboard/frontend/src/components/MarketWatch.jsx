import React, { useState, useEffect, useCallback } from 'react'

const WATCHLIST_DEFAULT = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT']

export default function MarketWatch({ prices, activeSymbol, onSelect, onAddPair }) {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tv_watchlist')) || WATCHLIST_DEFAULT }
    catch { return WATCHLIST_DEFAULT }
  })
  const [addMode, setAddMode] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])

  useEffect(() => {
    localStorage.setItem('tv_watchlist', JSON.stringify(watchlist))
  }, [watchlist])

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
      setSearchResults(await r.json())
    } catch { setSearchResults([]) }
  }, [])

  const addToWatchlist = (sym) => {
    const display = sym.replace('USDT', '/USDT')
    if (!watchlist.includes(display)) {
      setWatchlist(prev => [...prev, display])
    }
    setAddMode(false)
    setSearchQ('')
    setSearchResults([])
  }

  const removeFromWatchlist = (sym, e) => {
    e.stopPropagation()
    setWatchlist(prev => prev.filter(s => s !== sym))
  }

  const fmtPrice = (p) => {
    if (p == null) return '---'
    return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  }

  return (
    <div className="tv-watchlist">
      <div className="tv-watchlist-header">
        <span>Watchlist</span>
        <button className="tv-watchlist-add-btn" onClick={() => setAddMode(!addMode)}>+</button>
      </div>

      {addMode && (
        <div className="tv-watchlist-add">
          <input
            className="tv-watchlist-input"
            placeholder="Search pair..."
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); doSearch(e.target.value) }}
            autoFocus
          />
          {searchResults.map(r => (
            <div key={r.symbol} className="tv-watchlist-result" onClick={() => addToWatchlist(r.symbol)}>
              <span>{r.display}</span>
              <span className={r.change24h >= 0 ? 'green' : 'red'}>
                {r.change24h >= 0 ? '+' : ''}{r.change24h?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="tv-watchlist-items">
        {watchlist.map(sym => {
          const data = prices[sym]
          const isActive = sym === activeSymbol
          return (
            <div
              key={sym}
              className={`tv-watchlist-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(sym)}
            >
              <div className="tv-watchlist-item-left">
                <span className="tv-watchlist-symbol">{sym}</span>
                <span className="tv-watchlist-name">{sym.split('/')[0]}</span>
              </div>
              <div className="tv-watchlist-item-right">
                <span className="tv-watchlist-price">{fmtPrice(data?.price)}</span>
                <span className={`tv-watchlist-change ${(data?.change_24h || 0) >= 0 ? 'green' : 'red'}`}>
                  {data ? `${data.change_24h >= 0 ? '+' : ''}${data.change_24h?.toFixed(2)}%` : '---'}
                </span>
              </div>
              <button className="tv-watchlist-remove" onClick={(e) => removeFromWatchlist(sym, e)}>×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
