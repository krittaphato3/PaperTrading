import React, { useState, useRef, useEffect, useCallback } from 'react'

let searchCache = {}

export default function SearchBar({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState([])
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      inputRef.current?.focus()
      fetchTrending()
    }
  }, [open])

  const fetchTrending = async () => {
    try {
      const r = await fetch('/api/market_overview')
      const d = await r.json()
      const sorted = [...(d.pairs || [])]
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 8)
      setTrending(sorted)
    } catch { /* skip */ }
  }

  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); return }
    const cacheKey = trimmed.toLowerCase()
    if (searchCache[cacheKey]) { setResults(searchCache[cacheKey]); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=15`)
      const d = await r.json()
      searchCache[cacheKey] = d
      setResults(d)
    } catch { setResults([]) }
    setLoading(false)
  }, [])

  const handleInput = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  const handleSelect = (sym) => {
    const display = sym.replace('USDT', '/USDT')
    onSelect(display)
    onClose()
  }

  const fmtPrice = (p) => {
    if (!p) return '---'
    return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
  }

  if (!open) return null

  return (
    <div className="tv-search-overlay" onClick={onClose}>
      <div className="tv-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="tv-search-input-wrap">
          <span className="tv-search-icon">⌕</span>
          <input
            ref={inputRef}
            className="tv-search-input"
            placeholder='Search pairs... (e.g. "BTC", "ETH", "SOL")'
            value={query}
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && results.length > 0) handleSelect(results[0].symbol)
            }}
          />
          <span className="tv-search-shortcut">ESC</span>
        </div>

        {!query.trim() && trending.length > 0 && (
          <div className="tv-search-section">
            <div className="tv-search-section-title">Trending Pairs</div>
            <div className="tv-search-grid">
              {trending.map((p) => (
                <div
                  key={p.symbol}
                  className="tv-search-grid-item"
                  onClick={() => handleSelect(p.symbol)}
                >
                  <span className="tv-search-grid-symbol">{p.display}</span>
                  <span className={`tv-search-grid-change ${p.priceChangePercent >= 0 ? 'green' : 'red'}`}>
                    {p.priceChangePercent >= 0 ? '+' : ''}{p.priceChangePercent.toFixed(2)}%
                  </span>
                  <span className="tv-search-grid-price">${fmtPrice(p.lastPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {query.trim() && (
          <div className="tv-search-section">
            <div className="tv-search-section-title">
              {loading ? 'Searching...' : `${results.length} results for "${query}"`}
            </div>
            {results.map((r) => (
              <div
                key={r.symbol}
                className="tv-search-result"
                onClick={() => handleSelect(r.symbol)}
              >
                <div className="tv-search-result-left">
                  <span className="tv-search-result-symbol">{r.display}</span>
                  <span className="tv-search-result-name">{r.baseAsset}</span>
                </div>
                <div className="tv-search-result-right">
                  <span className="tv-search-result-price">${fmtPrice(r.price)}</span>
                  <span className={`tv-search-result-change ${r.change24h >= 0 ? 'green' : 'red'}`}>
                    {r.change24h >= 0 ? '+' : ''}{r.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
            {!loading && results.length === 0 && (
              <div className="tv-search-empty">No pairs found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
