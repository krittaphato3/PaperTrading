import React, { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import TickerTape from './TickerTape'
import EnhancedChart from './EnhancedChart'
import MarketWatch from './MarketWatch'
import TradePanel from './TradePanel'
import OrderBook from './OrderBook'
import RecentTrades from './RecentTrades'
import MarketStats from './MarketStats'
import SearchBar from './SearchBar'
import PortfolioChart from './PortfolioChart'

export default function Dashboard() {
  const [prices, setPrices] = useState({})
  const [activeSymbol, setActiveSymbol] = useState('BTC/USDT')
  const [searchOpen, setSearchOpen] = useState(false)
  const [rightTab, setRightTab] = useState('trading')
  const [showLeft, setShowLeft] = useState(true)
  const [showRight, setShowRight] = useState(true)
  const [showTicker, setShowTicker] = useState(true)
  const [showStats, setShowStats] = useState(true)
  const [showPortfolio, setShowPortfolio] = useState(true)

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'price_update') {
      setPrices((prev) => ({ ...prev, ...msg.data }))
    }
  }, [])

  const { connected } = useWebSocket(handleMessage)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const currentData = prices[activeSymbol]
  const currentPrice = currentData?.price
  const change24h = currentData?.change_24h

  return (
    <div className="tv-layout">
      <div className={`tv-top-bar ${showTicker ? '' : 'tv-top-bar-collapsed'}`}>
        <TickerTape
          prices={prices}
          activeSymbol={activeSymbol}
          onSelect={setActiveSymbol}
        />
        <div className="tv-top-bar-actions">
          <button className="tv-top-bar-toggle" onClick={() => setShowTicker(v => !v)} title={showTicker ? 'Hide ticker' : 'Show ticker'}>
            {showTicker ? '▲' : '▼'}
          </button>
          <button className="tv-search-btn" onClick={() => setSearchOpen(true)}>
            <span className="tv-search-btn-icon">⌕</span>
            <span className="tv-search-btn-text">Search</span>
            <span className="tv-search-btn-kbd">Ctrl+K</span>
          </button>
          <span className={`tv-conn-badge ${connected ? 'connected' : ''}`} title={connected ? 'Live' : 'Disconnected'}>
            {connected ? '●' : '○'}
          </span>
        </div>
      </div>

      <SearchBar
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={setActiveSymbol}
      />

      <div className="tv-main tv-main-threecol">
        <button className="tv-col-toggle tv-col-toggle-left" onClick={() => setShowLeft(v => !v)} title={showLeft ? 'Hide watchlist' : 'Show watchlist'}>
          {showLeft ? '◀' : '▶'}
        </button>

        <div className={`tv-left-col ${showLeft ? 'tv-left-col-open' : 'tv-left-col-closed'}`}>
          <MarketWatch
            prices={prices}
            activeSymbol={activeSymbol}
            onSelect={setActiveSymbol}
          />
        </div>

        <div className="tv-center-col">
          <EnhancedChart
            symbol={activeSymbol}
            lastPrice={currentPrice}
            change24h={change24h}
          />
          {showStats && (
            <div className="tv-collapsible">
              <div className="tv-collapsible-header" onClick={() => setShowStats(v => !v)}>
                <span className="tv-collapsible-icon">▼</span>
                <span>Market Stats</span>
              </div>
              <div className="tv-collapsible-body">
                <MarketStats symbol={activeSymbol} liveData={currentData} />
              </div>
            </div>
          )}
          {!showStats && (
            <div className="tv-collapsible tv-collapsible-closed">
              <div className="tv-collapsible-header" onClick={() => setShowStats(prev => !prev)}>
                <span className="tv-collapsible-icon">▶</span>
                <span>Market Stats</span>
              </div>
            </div>
          )}
          {showPortfolio && (
            <div className="tv-collapsible">
              <div className="tv-collapsible-header" onClick={() => setShowPortfolio(v => !v)}>
                <span className="tv-collapsible-icon">▼</span>
                <span>Portfolio</span>
              </div>
              <div className="tv-collapsible-body">
                <PortfolioChart />
              </div>
            </div>
          )}
          {!showPortfolio && (
            <div className="tv-collapsible tv-collapsible-closed">
              <div className="tv-collapsible-header" onClick={() => setShowPortfolio(prev => !prev)}>
                <span className="tv-collapsible-icon">▶</span>
                <span>Portfolio</span>
              </div>
            </div>
          )}
        </div>

        <button className="tv-col-toggle tv-col-toggle-right" onClick={() => setShowRight(v => !v)} title={showRight ? 'Hide panel' : 'Show panel'}>
          {showRight ? '▶' : '◀'}
        </button>

        <div className={`tv-right-col ${showRight ? 'tv-right-col-open' : 'tv-right-col-closed'}`}>
          <div className="tv-right-tabs">
            <button className={`tv-right-tab ${rightTab === 'trading' ? 'active' : ''}`} onClick={() => setRightTab('trading')}>Trade</button>
            <button className={`tv-right-tab ${rightTab === 'orderbook' ? 'active' : ''}`} onClick={() => setRightTab('orderbook')}>Book</button>
            <button className={`tv-right-tab ${rightTab === 'trades' ? 'active' : ''}`} onClick={() => setRightTab('trades')}>Trades</button>
          </div>
          <div className="tv-right-content">
            {rightTab === 'trading' ? (
              <TradePanel activeSymbol={activeSymbol} currentPrice={currentPrice} />
            ) : rightTab === 'orderbook' ? (
              <OrderBook symbol={activeSymbol} />
            ) : (
              <RecentTrades symbol={activeSymbol} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
