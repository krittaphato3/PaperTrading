import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries } from 'lightweight-charts'
import { computeSMA, computeEMA, computeRSI, computeMACD, computeStochastic, computeATR, computeADX } from '../utils/indicators'

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
const CHART_TYPES = ['candle', 'bar', 'line', 'area', 'ha']
const PANEL_INDICATORS = [
  { id: 'rsi', name: 'RSI', height: 100, params: { period: 14 }, yRange: [0, 100] },
  { id: 'macd', name: 'MACD', height: 150, params: { fast: 12, slow: 26, signal: 9 }, yRange: null },
  { id: 'stoch', name: 'Stochastic', height: 100, params: { k: 14, d: 3 }, yRange: [0, 100] },
  { id: 'atr', name: 'ATR', height: 80, params: { period: 14 }, yRange: null },
  { id: 'adx', name: 'ADX', height: 100, params: { period: 14 }, yRange: [0, 100] },
]

function computeHeikinAshi(candles) {
  const ha = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const prevHA = ha[i - 1] || { open: c.open, close: c.open }
    const haOpen = (prevHA.open + prevHA.close) / 2
    const haHigh = Math.max(c.high, haOpen, haClose)
    const haLow = Math.min(c.low, haOpen, haClose)
    ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose })
  }
  return ha
}

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const cb = (e) => { if (ref.current && !ref.current.contains(e.target)) handler() }
    document.addEventListener('mousedown', cb)
    return () => document.removeEventListener('mousedown', cb)
  }, [ref, handler])
}

export default function EnhancedChart({ symbol, lastPrice, change24h }) {
  const chartContainerRef = useRef(null)
  const panelRefs = useRef({})
  const chartRef = useRef(null)
  const panelsRef = useRef({})
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const overlaySeriesRef = useRef([])
  const mainTimeScaleRef = useRef(null)
  const typeRef = useRef(null)
  const indRef = useRef(null)
  const [timeframe, setTimeframe] = useState('5m')
  const [chartType, setChartType] = useState('candle')
  const [activePanels, setActivePanels] = useState({ rsi: true, macd: false, stoch: false, atr: false, adx: false })
  const [drawingTool, setDrawingTool] = useState(null)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false)
  const klineCacheRef = useRef([])
  const drawStartRef = useRef(null)

  useOutsideClick(typeRef, () => setShowTypeMenu(false))
  useOutsideClick(indRef, () => setShowIndicatorMenu(false))

  const fetchKlines = useCallback(async (sym, tf) => {
    try {
      const res = await fetch(`/api/klines?symbol=${sym.replace('/', '')}&interval=${tf}&limit=500`)
      const data = await res.json()
      return data.klines || []
    } catch { return [] }
  }, [])

  const buildCandles = useCallback((klines, type) => {
    const base = klines.map(k => ({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close }))
    if (type === 'ha') return computeHeikinAshi(base)
    return base
  }, [])

  const buildVolumes = useCallback((klines) => {
    return klines.map(k => ({
      time: k.time, value: k.volume,
      color: k.close >= k.open ? '#26a69a44' : '#ef535044',
    }))
  }, [])

  useEffect(() => {
    if (!chartContainerRef.current) return
    const container = chartContainerRef.current
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#555', style: 2, width: 1, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: '#555', style: 2, width: 1, labelBackgroundColor: '#2a2e39' },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => {
          const d = new Date(time * 1000)
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
        },
      },
      rightPriceScale: { borderColor: '#2a2e39', scaleMargins: { top: 0.05, bottom: 0.25 } },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
    })

    chartRef.current = chart
    mainTimeScaleRef.current = chart.timeScale()

    const handleResize = () => {
      const r = container.parentElement.getBoundingClientRect()
      chart.applyOptions({ width: Math.max(r.width, 100), height: Math.max(r.height, 100) })
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(container.parentElement)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      mainTimeScaleRef.current = null
    }
  }, [])

  const createChartSeries = useCallback((chart, type) => {
    if (candleSeriesRef.current) {
      try { chart.removeSeries(candleSeriesRef.current) } catch {}
      candleSeriesRef.current = null
    }
    if (volumeSeriesRef.current) {
      try { chart.removeSeries(volumeSeriesRef.current) } catch {}
      volumeSeriesRef.current = null
    }
    for (const s of overlaySeriesRef.current) {
      try { chart.removeSeries(s) } catch {}
    }
    overlaySeriesRef.current = []

    const upColor = '#26a69a', downColor = '#ef5350'

    let mainSeries
    switch (type) {
      case 'bar':
        mainSeries = chart.addSeries(BarSeries, { upColor, downColor, thinBars: true })
        break
      case 'line':
        mainSeries = chart.addSeries(LineSeries, { color: '#2196F3', lineWidth: 2 })
        break
      case 'area':
        mainSeries = chart.addSeries(AreaSeries, {
          lineColor: '#2196F3', topColor: '#2196F344', bottomColor: '#2196F300', lineWidth: 2,
        })
        break
      default:
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor, downColor, borderDownColor: downColor, borderUpColor: upColor,
          wickDownColor: downColor, wickUpColor: upColor,
        })
    }
    candleSeriesRef.current = mainSeries

    if (type !== 'line' && type !== 'area') {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        color: '#26a69a33', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    }

    return mainSeries
  }, [])

  const addOverlayIndicator = useCallback((chart, id, data, color) => {
    const series = chart.addSeries(LineSeries, {
      color: color || '#f0ad4e', lineWidth: 1, lastValueVisible: false, priceLineVisible: false,
    })
    series.setData(data)
    overlaySeriesRef.current.push(series)
    return series
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const rawSymbol = symbol.replace('/', '')
    let cancelled = false

    fetchKlines(rawSymbol, timeframe).then((klines) => {
      if (cancelled || !chart) return
      klineCacheRef.current = klines
      const candles = buildCandles(klines, chartType)
      const volumes = buildVolumes(klines)

      createChartSeries(chart, chartType)
      candleSeriesRef.current.setData(candles)
      if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumes)

      const sma20 = computeSMA(candles, 20)
      const ema20 = computeEMA(candles, 20)
      if (sma20.length > 0) addOverlayIndicator(chart, 'sma', sma20, '#f0ad4e')
      if (ema20.length > 0) addOverlayIndicator(chart, 'ema', ema20, '#5bc0de')

      chart.timeScale().fitContent()
      updatePanels(klines)
    })

    return () => { cancelled = true }
  }, [symbol, timeframe, chartType, fetchKlines, buildCandles, buildVolumes, createChartSeries, addOverlayIndicator])

  useEffect(() => {
    const cs = candleSeriesRef.current
    if (!cs || !lastPrice) return
    try {
      const bars = cs.data()
      if (bars.length === 0) return
      const last = bars[bars.length - 1]
      cs.update({
        time: last.time, open: last.open,
        high: Math.max(last.high, lastPrice),
        low: Math.min(last.low, lastPrice),
        close: lastPrice,
      })
    } catch {}
  }, [lastPrice])

  const createPanelChart = useCallback((panelId, container, height) => {
    if (panelsRef.current[panelId]) {
      try { panelsRef.current[panelId].remove() } catch {}
    }
    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#787b86' },
      grid: { vertLines: { color: '#2a2e39' }, horzLines: { color: '#2a2e39' } },
      crosshair: { mode: 0, vertLine: { color: '#555', style: 2, width: 1, labelBackgroundColor: '#2a2e39' }, horzLine: { color: '#555', style: 2, width: 1, labelBackgroundColor: '#2a2e39' } },
      timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false, visible: true },
      rightPriceScale: { borderColor: '#2a2e39' },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
      height,
    })
    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } })
    panelsRef.current[panelId] = chart
    return chart
  }, [])

  const updatePanels = useCallback((klines) => {
    const candles = klines.map(k => ({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume }))
    for (const [pid, enabled] of Object.entries(activePanels)) {
      if (!enabled) {
        if (panelsRef.current[pid]) {
          try { panelsRef.current[pid].remove() } catch {}
          delete panelsRef.current[pid]
        }
        const c = panelRefs.current[pid]
        if (c) c.innerHTML = ''
        continue
      }
      const def = PANEL_INDICATORS.find(p => p.id === pid)
      if (!def) continue
      const container = panelRefs.current[pid]
      if (!container) continue

      const chart = createPanelChart(pid, container, def.height)
      if (pid === 'rsi') {
        const data = computeRSI(candles, def.params.period)
        if (data.length > 0) {
          const line = chart.addSeries(LineSeries, { color: '#e67e22', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          line.setData(data)
          ;[70, 30].forEach((val, i) => {
            const s = chart.addLineSeries({ color: i === 0 ? '#ef535044' : '#26a69a44', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
            s.setData(data.map(d => ({ time: d.time, value: val })))
          })
        }
      } else if (pid === 'macd') {
        const r = computeMACD(candles, def.params.fast, def.params.slow, def.params.signal)
        if (r.histogram.length > 0) {
          const hist = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } })
          hist.setData(r.histogram)
          const macdLine = chart.addSeries(LineSeries, { color: '#2980b9', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          macdLine.setData(r.macdLine)
          const sigLine = chart.addSeries(LineSeries, { color: '#e74c3c', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          sigLine.setData(r.signalLine)
        }
      } else if (pid === 'stoch') {
        const r = computeStochastic(candles, def.params.k, def.params.d)
        if (r.kLine.length > 0) {
          const kLine = chart.addSeries(LineSeries, { color: '#2ecc71', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          kLine.setData(r.kLine)
          const dLine = chart.addSeries(LineSeries, { color: '#9b59b6', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          dLine.setData(r.dLine)
          ;[80, 20].forEach((val, i) => {
            const s = chart.addLineSeries({ color: i === 0 ? '#ef535044' : '#26a69a44', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
            s.setData(r.kLine.map(d => ({ time: d.time, value: val })))
          })
        }
      } else if (pid === 'atr') {
        const data = computeATR(candles, def.params.period)
        if (data.length > 0) {
          const line = chart.addSeries(LineSeries, { color: '#e74c3c', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          line.setData(data)
        }
      } else if (pid === 'adx') {
        const r = computeADX(candles, def.params.period)
        if (r.adx.length > 0) {
          const adxLine = chart.addSeries(LineSeries, { color: '#f1c40f', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          adxLine.setData(r.adx)
          const plusDI = chart.addSeries(LineSeries, { color: '#26a69a', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          plusDI.setData(r.plusDI)
          const minusDI = chart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
          minusDI.setData(r.minusDI)
        }
      }
      chart.timeScale().fitContent()
    }
  }, [activePanels, createPanelChart])

  useEffect(() => {
    if (!mainTimeScaleRef.current) return
    const vr = mainTimeScaleRef.current.getVisibleRange()
    if (!vr) return
    for (const [pid, enabled] of Object.entries(activePanels)) {
      if (!enabled) continue
      const panel = panelsRef.current[pid]
      if (!panel) continue
      try { panel.timeScale().setVisibleRange(vr) } catch {}
    }
  }, [activePanels])

  const isUp = (change24h || 0) >= 0
  const visiblePanels = PANEL_INDICATORS.filter(p => activePanels[p.id])
  const upDownClass = isUp ? 'green' : 'red'

  return (
    <>
      <div className="tv-chart-toolbar">
        <span className="tv-chart-symbol">{symbol}</span>
        {lastPrice != null && (
          <span className={`tv-last-price ${upDownClass}`} title={`24h: ${change24h >= 0 ? '+' : ''}${change24h?.toFixed(2) || '0'}%`}>
            ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
        )}

        <div className="tv-chart-type-wrap" ref={typeRef}>
          <button className="tv-ctrl-btn" onClick={() => setShowTypeMenu(v => !v)} title="Chart type">
            {chartType.toUpperCase()}
          </button>
          {showTypeMenu && (
            <div className="tv-dropdown-menu">
              {CHART_TYPES.map(t => (
                <button key={t} className={`tv-dropdown-item ${chartType === t ? 'active' : ''}`} onClick={() => { setChartType(t); setShowTypeMenu(false) }}>
                  {t === 'ha' ? 'HEIKIN ASHI' : t.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="tv-draw-tools">
          <button className={`tv-draw-btn ${drawingTool === 'trendline' ? 'active' : ''}`} onClick={() => setDrawingTool(drawingTool === 'trendline' ? null : 'trendline')} title="Trendline">╱</button>
          <button className={`tv-draw-btn ${drawingTool === 'horizontal' ? 'active' : ''}`} onClick={() => setDrawingTool(drawingTool === 'horizontal' ? null : 'horizontal')} title="Horizontal Line">―</button>
          <button className={`tv-draw-btn ${drawingTool === 'vertical' ? 'active' : ''}`} onClick={() => setDrawingTool(drawingTool === 'vertical' ? null : 'vertical')} title="Vertical Line">│</button>
          <button className={`tv-draw-btn ${drawingTool === 'fibonacci' ? 'active' : ''}`} onClick={() => setDrawingTool(drawingTool === 'fibonacci' ? null : 'fibonacci')} title="Fibonacci Retracement">Fib</button>
        </div>

        <div className="tv-indicator-menu-wrap" ref={indRef}>
          <button className="tv-ctrl-btn" onClick={() => setShowIndicatorMenu(v => !v)} title="Toggle indicators">
            Indicators
          </button>
          {showIndicatorMenu && (
            <div className="tv-dropdown-menu tv-indicator-dropdown">
              {PANEL_INDICATORS.map(p => (
                <label key={p.id} className="tv-dropdown-check">
                  <input type="checkbox" checked={!!activePanels[p.id]} onChange={() => setActivePanels(prev => ({ ...prev, [p.id]: !prev[p.id] }))} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="tv-oneclick-btns">
          <button className="tv-oneclick-buy" title="Market Buy" onClick={() => {
            const rawSymbol = symbol.replace('/', '')
            fetch('/api/trade/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: rawSymbol, qty: 0.001 }) }).catch(() => {})
          }}>Buy</button>
          <button className="tv-oneclick-sell" title="Market Sell" onClick={() => {
            const rawSymbol = symbol.replace('/', '')
            fetch('/api/trade/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: rawSymbol, qty: 0.001 }) }).catch(() => {})
          }}>Sell</button>
        </div>

        <div className="tv-timeframe-tabs">
          {TIMEFRAMES.map((tf) => (
            <button key={tf} className={`tv-timeframe-tab ${timeframe === tf ? 'active' : ''}`} onClick={() => setTimeframe(tf)} title={tf}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="tv-chart-main-area">
        <div className="tv-chart-container" ref={chartContainerRef} />

        {visiblePanels.map(p => (
          <div key={p.id} className="tv-panel-wrap">
            <div className="tv-panel-header">{p.name}</div>
            <div className="tv-panel-chart" ref={el => panelRefs.current[p.id] = el} style={{ height: p.height }} />
          </div>
        ))}
      </div>
    </>
  )
}
