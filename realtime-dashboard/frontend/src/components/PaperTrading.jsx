import React, { useState, useEffect, useCallback } from 'react'

export default function PaperTrading({ activeSymbol, currentPrice }) {
  const [tab, setTab] = useState('trade')
  const [side, setSide] = useState('buy')
  const [qty, setQty] = useState('')
  const [portfolio, setPortfolio] = useState(null)
  const [trades, setTrades] = useState([])
  const [message, setMessage] = useState(null)

  const fetchPortfolio = useCallback(async () => {
    try {
      const r = await fetch('/api/trade/portfolio')
      setPortfolio(await r.json())
    } catch { /* skip */ }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/trade/history')
      const d = await r.json()
      setTrades(d.trades || [])
    } catch { /* skip */ }
  }, [])

  useEffect(() => {
    fetchPortfolio()
    fetchHistory()
    const interval = setInterval(fetchPortfolio, 3000)
    return () => clearInterval(interval)
  }, [fetchPortfolio, fetchHistory])

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  const placeOrder = async () => {
    const qtyNum = parseFloat(qty)
    if (!qtyNum || qtyNum <= 0) {
      showMessage({ type: 'error', text: 'Enter a valid quantity' })
      return
    }
    const rawSymbol = activeSymbol.replace('/', '')
    const endpoint = side === 'buy' ? '/api/trade/buy' : '/api/trade/sell'
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: rawSymbol, qty: qtyNum }),
      })
      const result = await r.json()
      if (result.error) {
        showMessage({ type: 'error', text: result.error })
      } else {
        const action = side === 'buy' ? 'Bought' : 'Sold'
        const pnlStr = result.pnl ? ` P&L: $${result.pnl}` : ''
        showMessage({ type: 'success', text: `${action} ${qtyNum} ${activeSymbol} @ $${currentPrice}${pnlStr}` })
        setQty('')
        fetchPortfolio()
        fetchHistory()
      }
    } catch (err) {
      showMessage({ type: 'error', text: 'Order failed' })
    }
  }

  const closePosition = async (symbol) => {
    try {
      const r = await fetch(`/api/trade/close_position?symbol=${symbol}`, { method: 'POST' })
      const result = await r.json()
      if (result.error) {
        showMessage({ type: 'error', text: result.error })
      } else {
        showMessage({ type: 'success', text: `Closed ${symbol} P&L: $${result.pnl}` })
        fetchPortfolio()
        fetchHistory()
      }
    } catch {
      showMessage({ type: 'error', text: 'Failed to close position' })
    }
  }

  const resetAccount = async () => {
    try {
      await fetch('/api/trade/reset', { method: 'POST' })
      showMessage({ type: 'success', text: 'Account reset to $100,000' })
      fetchPortfolio()
      fetchHistory()
    } catch { /* skip */ }
  }

  const setQtyPercent = (pct) => {
    if (!portfolio || !currentPrice) return
    const avail = side === 'buy' ? portfolio.balance : (portfolio.positions || [])
      .find((p) => p.symbol === activeSymbol.replace('/', ''))?.qty || 0
    const max = side === 'buy' ? avail / currentPrice : avail
    setQty((max * pct / 100).toFixed(8))
  }

  const rawSymbol = activeSymbol.replace('/', '')
  const currentPosition = portfolio?.positions?.find((p) => p.symbol === rawSymbol)
  const costEstimate = qty && currentPrice ? parseFloat(qty) * currentPrice : 0

  return (
    <div className="tv-paper-trading">
      {message && (
        <div className={`tv-paper-toast ${message.type}`}>{message.text}</div>
      )}

      <div className="tv-paper-balance">
        <div className="tv-paper-balance-row">
          <span>Balance</span>
          <span className="tv-paper-balance-val">
            ${portfolio?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}
          </span>
        </div>
        <div className="tv-paper-balance-row">
          <span>Equity</span>
          <span className={`tv-paper-balance-val ${(portfolio?.total_pnl || 0) >= 0 ? 'green' : 'red'}`}>
            ${portfolio?.total_equity?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}
          </span>
        </div>
        <div className="tv-paper-balance-row">
          <span>P&L</span>
          <span className={`tv-paper-balance-val ${(portfolio?.total_pnl || 0) >= 0 ? 'green' : 'red'}`}>
            {portfolio?.total_pnl >= 0 ? '+' : ''}
            ${portfolio?.total_pnl?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}
            ({portfolio?.total_pnl_pct?.toFixed(2) || '0'}%)
          </span>
        </div>
      </div>

      <div className="tv-paper-tabs">
        <button className={`tv-paper-tab ${tab === 'trade' ? 'active' : ''}`} onClick={() => setTab('trade')}>Trade</button>
        <button className={`tv-paper-tab ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>
          Positions {portfolio?.position_count > 0 ? `(${portfolio.position_count})` : ''}
        </button>
        <button className={`tv-paper-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      <div className="tv-paper-content">
        {tab === 'trade' && (
          <div className="tv-order-form">
            <div className="tv-order-side">
              <button
                className={`tv-order-side-btn buy ${side === 'buy' ? 'active' : ''}`}
                onClick={() => setSide('buy')}
              >Buy</button>
              <button
                className={`tv-order-side-btn sell ${side === 'sell' ? 'active' : ''}`}
                onClick={() => setSide('sell')}
              >Sell</button>
            </div>

            <div className="tv-order-row">
              <label>Quantity ({activeSymbol?.split('/')[0]})</label>
              <input
                className="tv-order-input"
                type="number"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="tv-order-quick">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} className="tv-order-quick-btn" onClick={() => setQtyPercent(pct)}>
                  {pct}%
                </button>
              ))}
            </div>

            <div className="tv-order-row">
              <label>Est. {side === 'buy' ? 'Cost' : 'Value'}</label>
              <span className="tv-order-estimate">
                ${costEstimate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {currentPosition && (
              <div className="tv-order-existing">
                Current: {currentPosition.qty} @ ${currentPosition.entry_price}
              </div>
            )}

            <button
              className={`tv-order-submit ${side}`}
              onClick={placeOrder}
            >
              {side === 'buy' ? 'Buy' : 'Sell'} {activeSymbol?.split('/')[0] || ''}
            </button>

            <button className="tv-order-reset" onClick={resetAccount}>
              Reset Account
            </button>
          </div>
        )}

        {tab === 'positions' && (
          <div className="tv-positions">
            {(!portfolio?.positions || portfolio.positions.length === 0) ? (
              <div className="tv-positions-empty">No open positions</div>
            ) : (
              portfolio.positions.map((pos) => (
                <div key={pos.symbol} className="tv-position-item">
                  <div className="tv-position-header">
                    <span className="tv-position-symbol">{pos.symbol.replace('USDT', '/USDT')}</span>
                    <span className={`tv-position-pnl ${pos.pnl >= 0 ? 'green' : 'red'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnl_pct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="tv-position-details">
                    <span>Qty: {pos.qty}</span>
                    <span>Entry: ${pos.entry_price}</span>
                    <span>Mark: ${pos.current_price}</span>
                  </div>
                  <button className="tv-position-close" onClick={() => closePosition(pos.symbol)}>
                    Close
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="tv-trade-history">
            {trades.length === 0 ? (
              <div className="tv-trade-empty">No trades yet</div>
            ) : (
              [...trades].reverse().slice(0, 50).map((t) => (
                <div key={t.id || t.timestamp + Math.random()} className="tv-trade-item">
                  <div className="tv-trade-item-left">
                    <span className={`tv-trade-item-side ${t.side === 'BUY' ? 'buy' : 'sell'}`}>
                      {t.side}
                    </span>
                    <span className="tv-trade-item-symbol">
                      {t.symbol.replace('USDT', '/USDT')}
                    </span>
                  </div>
                  <div className="tv-trade-item-right">
                    <span className="tv-trade-item-qty">{t.qty} @ ${t.price?.toFixed(2)}</span>
                    {t.pnl != null && (
                      <span className={`tv-trade-item-pnl ${t.pnl >= 0 ? 'green' : 'red'}`}>
                        ${t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                      </span>
                    )}
                    <span className="tv-trade-item-time">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
