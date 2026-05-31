import React, { useState, useEffect, useCallback } from 'react'

export default function TradePanel({ activeSymbol, currentPrice }) {
  const [tab, setTab] = useState('trade')
  const [side, setSide] = useState('buy')
  const [orderType, setOrderType] = useState('market')
  const [qty, setQty] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [slPrice, setSlPrice] = useState('')
  const [tpPrice, setTpPrice] = useState('')
  const [portfolio, setPortfolio] = useState(null)
  const [message, setMessage] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [newBalance, setNewBalance] = useState('')
  const [leverage, setLeverage] = useState(1)
  const [leverageInput, setLeverageInput] = useState('1')
  const [useValueMode, setUseValueMode] = useState(false)

  const fetchPortfolio = useCallback(async () => {
    try { const r = await fetch('/api/trade/portfolio'); setPortfolio(await r.json()) }
    catch {}
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const r = await fetch('/api/trade/settings'); const d = await r.json()
      setLeverage(d.leverage); setLeverageInput(String(d.leverage))
    } catch {}
  }, [])

  useEffect(() => {
    fetchPortfolio(); fetchSettings()
    const i = setInterval(fetchPortfolio, 3000)
    return () => clearInterval(i)
  }, [fetchPortfolio, fetchSettings])

  const showMessage = (text, type = 'success') => { setMessage({ text, type }); setTimeout(() => setMessage(null), 3000) }

  const placeOrder = async () => {
    let qtyNum = parseFloat(qty)
    if (!qtyNum || qtyNum <= 0) { showMessage('Enter valid quantity', 'error'); return }
    const rawSymbol = activeSymbol.replace('/', '')
    const sl = parseFloat(slPrice) || null
    const tp = parseFloat(tpPrice) || null

    if (orderType === 'market') {
      const endpoint = side === 'buy' ? '/api/trade/buy' : '/api/trade/sell'
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: rawSymbol, qty: qtyNum, sl, tp }) })
        const result = await r.json()
        if (result.error) { showMessage(result.error, 'error') }
        else { showMessage(`${side === 'buy' ? 'Bought' : 'Sold'} ${qtyNum} @ $${currentPrice}`); setQty(''); fetchPortfolio() }
      } catch { showMessage('Order failed', 'error') }
    } else if (orderType === 'limit') {
      const lp = parseFloat(limitPrice)
      if (!lp || lp <= 0) { showMessage('Enter limit price', 'error'); return }
      try {
        const r = await fetch('/api/trade/limit_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: rawSymbol, side: side.toUpperCase(), qty: qtyNum, limit_price: lp, sl, tp }) })
        const result = await r.json()
        if (result.error) { showMessage(result.error, 'error') }
        else { showMessage(`Limit ${side.toUpperCase()} @ $${lp} placed`); setQty(''); setLimitPrice(''); fetchPortfolio() }
      } catch { showMessage('Order failed', 'error') }
    } else if (orderType === 'stop') {
      const sp = parseFloat(stopPrice)
      if (!sp || sp <= 0) { showMessage('Enter stop price', 'error'); return }
      try {
        const r = await fetch('/api/trade/stop_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: rawSymbol, side: side.toUpperCase(), qty: qtyNum, stop_price: sp, sl, tp }) })
        const result = await r.json()
        if (result.error) { showMessage(result.error, 'error') }
        else { showMessage(`Stop ${side.toUpperCase()} @ $${sp} placed`); setQty(''); setStopPrice(''); fetchPortfolio() }
      } catch { showMessage('Order failed', 'error') }
    }
  }

  const closePosition = async (symbol) => {
    try {
      const r = await fetch(`/api/trade/close_position?symbol=${symbol}`, { method: 'POST' })
      const result = await r.json()
      if (result.error) { showMessage(result.error, 'error') }
      else { showMessage(`Closed ${symbol} P&L: $${result.pnl}`); fetchPortfolio() }
    } catch { showMessage('Failed to close', 'error') }
  }

  const cancelPendingOrder = async (id) => {
    try { await fetch(`/api/trade/cancel_order?order_id=${id}`, { method: 'POST' }); showMessage('Order cancelled'); fetchPortfolio() }
    catch { showMessage('Failed to cancel', 'error') }
  }

  const applySettings = async () => {
    const bal = parseFloat(newBalance)
    if (bal && bal > 0) {
      await fetch(`/api/trade/reset?balance=${bal}`, { method: 'POST' })
      showMessage(`Account reset to $${bal.toLocaleString()}`)
      setNewBalance('')
    }
    const lev = parseInt(leverageInput)
    if (lev >= 1 && lev <= 100) {
      await fetch(`/api/trade/leverage?leverage=${lev}`, { method: 'POST' })
      setLeverage(lev)
      showMessage(`Leverage set to 1:${lev}`)
    }
    fetchPortfolio()
    fetchSettings()
    setShowSettings(false)
  }

  const setQtyPercent = (pct) => {
    if (!portfolio || !currentPrice) return
    const rawSymbol = activeSymbol.replace('/', '')
    if (side === 'buy') {
      const buyingPower = (portfolio.balance * leverage) * pct / 100
      if (useValueMode) {
        setQty(buyingPower.toFixed(2))
      } else {
        setQty((buyingPower / currentPrice).toFixed(8))
      }
    } else {
      const pos = portfolio.positions?.find(p => p.symbol === rawSymbol)
      if (pos) {
        const sellQty = pos.qty * pct / 100
        if (useValueMode) {
          setQty((sellQty * currentPrice).toFixed(2))
        } else {
          setQty(sellQty.toFixed(8))
        }
      }
    }
  }

  const rawSymbol = activeSymbol.replace('/', '')
  const currentPosition = portfolio?.positions?.find(p => p.symbol === rawSymbol)
  const qtyNum = parseFloat(qty) || 0
  const costEstimate = useValueMode ? qtyNum : (qtyNum * (currentPrice || 0))
  const baseAsset = activeSymbol?.split('/')[0] || ''

  const LEVERAGE_OPTIONS = [1, 2, 5, 10, 25, 50, 100]

  return (
    <div className="tv-trade-panel">
      {message && <div className={`tv-trade-toast ${message.type}`}>{message.text}</div>}

      <div className="tv-trade-balance">
        <div className="tv-trade-balance-header">
          <span>Account</span>
          <button className="tv-trade-settings-btn" onClick={() => setShowSettings(v => !v)} title="Account settings">⚙</button>
        </div>
        {showSettings && (
          <div className="tv-trade-settings">
            <div className="tv-trade-setting-row">
              <label>Leverage</label>
              <div className="tv-lev-selector">
                <input type="number" min="1" max="100" value={leverageInput} onChange={e => setLeverageInput(e.target.value)} className="tv-lev-input" />
                <span className="tv-lev-label">:1</span>
                <div className="tv-lev-options">
                  {LEVERAGE_OPTIONS.map(l => (
                    <button key={l} className={`tv-lev-opt ${leverage === l ? 'active' : ''}`} onClick={() => { setLeverageInput(String(l)); setLeverage(l) }}>{l}x</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="tv-trade-setting-row">
              <label>Reset Balance ($)</label>
              <div className="tv-reset-row">
                <input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="100000" className="tv-lev-input" />
                <button className="tv-reset-btn" onClick={applySettings}>Apply</button>
              </div>
            </div>
          </div>
        )}
        <div className="tv-trade-balance-grid">
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">Balance</span>
            <span className="tv-tb-value">${portfolio?.balance?.toLocaleString(undefined, { minFractionDigits: 2 }) || '---'}</span>
          </div>
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">Equity</span>
            <span className={`tv-tb-value ${(portfolio?.total_pnl || 0) >= 0 ? 'green' : 'red'}`}>
              ${portfolio?.total_equity?.toLocaleString(undefined, { minFractionDigits: 2 }) || '---'}
            </span>
          </div>
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">P&L</span>
            <span className={`tv-tb-value ${(portfolio?.total_pnl || 0) >= 0 ? 'green' : 'red'}`}>
              {portfolio?.total_pnl >= 0 ? '+' : ''}${portfolio?.total_pnl?.toLocaleString(undefined, { minFractionDigits: 2 }) || '0'}
            </span>
          </div>
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">Leverage</span>
            <span className="tv-tb-value">1:{leverage}</span>
          </div>
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">Margin</span>
            <span className="tv-tb-value">{portfolio ? `${((portfolio.margin_used / (portfolio.margin_used + portfolio.margin_free)) * 100 || 0).toFixed(1)}%` : '---'}</span>
          </div>
          <div className="tv-trade-balance-item">
            <span className="tv-tb-label">Free</span>
            <span className="tv-tb-value">${portfolio?.margin_free?.toLocaleString(undefined, { minFractionDigits: 2 }) || '---'}</span>
          </div>
        </div>
      </div>

      <div className="tv-trade-section-tabs">
        <button className={`tv-trade-section-tab ${tab === 'trade' ? 'active' : ''}`} onClick={() => setTab('trade')}>Order</button>
        <button className={`tv-trade-section-tab ${tab === 'positions' ? 'active' : ''}`} onClick={() => setTab('positions')}>
          Positions{portfolio?.position_count > 0 ? ` (${portfolio.position_count})` : ''}
        </button>
        <button className={`tv-trade-section-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending{portfolio?.pending_orders?.length > 0 ? ` (${portfolio.pending_orders.length})` : ''}
        </button>
      </div>

      <div className="tv-trade-section-content">
        {tab === 'trade' && (
          <div className="tv-order-form">
            <div className="tv-order-side">
              <button className={`tv-order-side-btn buy ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>Buy</button>
              <button className={`tv-order-side-btn sell ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')}>Sell</button>
            </div>

            <div className="tv-order-type-row">
              {['market', 'limit', 'stop'].map(t => (
                <button key={t} className={`tv-order-type-btn ${orderType === t ? 'active' : ''}`} onClick={() => setOrderType(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="tv-order-qty-mode">
              <button className={`tv-qty-mode-btn ${!useValueMode ? 'active' : ''}`} onClick={() => setUseValueMode(false)}>{baseAsset}</button>
              <button className={`tv-qty-mode-btn ${useValueMode ? 'active' : ''}`} onClick={() => setUseValueMode(true)}>USDT</button>
            </div>

            <div className="tv-order-field">
              <label>{useValueMode ? `Value (USDT)` : `Qty (${baseAsset})`}</label>
              <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="0.00" />
            </div>

            <div className="tv-order-quick">
              {[10, 25, 50, 75, 100].map(p => (
                <button key={p} onClick={() => setQtyPercent(p)}>{p}%</button>
              ))}
            </div>

            {orderType === 'limit' && (
              <div className="tv-order-field">
                <label>Limit Price ($)</label>
                <input type="number" step="any" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={currentPrice?.toString()} />
              </div>
            )}
            {orderType === 'stop' && (
              <div className="tv-order-field">
                <label>Stop Price ($)</label>
                <input type="number" step="any" value={stopPrice} onChange={e => setStopPrice(e.target.value)} placeholder={currentPrice?.toString()} />
              </div>
            )}

            <div className="tv-order-sltp">
              <div className="tv-order-field">
                <label>Stop Loss ($)</label>
                <input type="number" step="any" value={slPrice} onChange={e => setSlPrice(e.target.value)} placeholder="Optional" />
              </div>
              <div className="tv-order-field">
                <label>Take Profit ($)</label>
                <input type="number" step="any" value={tpPrice} onChange={e => setTpPrice(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className="tv-order-field">
              <label>Est. {side === 'buy' ? 'Cost' : 'Value'} (1:{leverage})</label>
              <span className="tv-order-estimate">${costEstimate.toLocaleString(undefined, { minFractionDigits: 2 })}</span>
            </div>

            {useValueMode && currentPrice && qtyNum > 0 && (
              <div className="tv-order-equiv">≈ {baseAsset} {(qtyNum / currentPrice).toFixed(6)}</div>
            )}

            {currentPosition && <div className="tv-order-current-pos">Current: {currentPosition.qty} @ ${currentPosition.entry_price}</div>}

            <button className={`tv-order-execute ${side}`} onClick={placeOrder}>
              {side === 'buy' ? 'Buy' : 'Sell'} {baseAsset}
              {orderType !== 'market' ? ` (${orderType.toUpperCase()})` : ''}
            </button>

            <button className="tv-order-reset" onClick={() => { fetch(`/api/trade/reset`, { method: 'POST' }); showMessage('Account reset to $100,000'); fetchPortfolio(); fetchSettings() }}>
              Reset Account
            </button>
          </div>
        )}

        {tab === 'positions' && (
          <div className="tv-positions-list">
            {(!portfolio?.positions || portfolio.positions.length === 0) ? (
              <div className="tv-positions-empty">No open positions</div>
            ) : (
              portfolio.positions.map(pos => (
                <div key={pos.symbol} className="tv-pos-item">
                  <div className="tv-pos-top">
                    <span className="tv-pos-sym">{pos.symbol.replace('USDT', '/USDT')}</span>
                    <span className={`tv-pos-pnl ${pos.pnl >= 0 ? 'green' : 'red'}`}>
                      ${pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="tv-pos-details">
                    <span><em>Size</em> {pos.qty}</span>
                    <span><em>Entry</em> ${pos.entry_price}</span>
                    <span><em>Mark</em> ${pos.current_price}</span>
                  </div>
                  <div className="tv-pos-details">
                    <span><em>Value</em> ${pos.market_value?.toLocaleString(undefined, { minFractionDigits: 2 })}</span>
                    <span className={pos.pnl >= 0 ? 'green' : 'red'}>{pos.pnl_pct.toFixed(2)}%</span>
                  </div>
                  {pos.sl || pos.tp ? (
                    <div className="tv-pos-sltp">
                      <span>{pos.sl ? `SL: $${pos.sl}` : ''}{pos.sl && pos.tp ? ' | ' : ''}{pos.tp ? `TP: $${pos.tp}` : ''}</span>
                    </div>
                  ) : null}
                  <button className="tv-pos-close" onClick={() => closePosition(pos.symbol)}>Close</button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'pending' && (
          <div className="tv-orders-pending">
            {(!portfolio?.pending_orders || portfolio.pending_orders.length === 0) ? (
              <div className="tv-positions-empty">No pending orders</div>
            ) : (
              portfolio.pending_orders.map(o => (
                <div key={o.id} className="tv-pending-item">
                  <div className="tv-pending-top">
                    <span className={`tv-pending-side ${o.side === 'BUY' ? 'buy' : 'sell'}`}>{o.side}</span>
                    <span className="tv-pending-type">{o.type}</span>
                    <span className="tv-pending-sym">{o.symbol.replace('USDT', '/USDT')}</span>
                    <span className="tv-pending-status">{o.status}</span>
                  </div>
                  <div className="tv-pending-details">
                    <span>Qty: {o.qty}</span>
                    <span>{o.type === 'LIMIT' ? `Limit: $${o.limit_price}` : `Stop: $${o.stop_price}`}</span>
                  </div>
                  <button className="tv-pending-cancel" onClick={() => cancelPendingOrder(o.id)}>Cancel</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
