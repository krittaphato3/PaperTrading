import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

function computeSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

function computeEMA(data, period) {
  const multiplier = 2 / (period + 1)
  const result = []
  let ema = data[0].close
  for (let i = 0; i < data.length; i++) {
    if (i === period - 1) {
      let sum = 0
      for (let j = 0; j < period; j++) sum += data[j].close
      ema = sum / period
    } else if (i >= period) {
      ema = (data[i].close - ema) * multiplier + ema
    }
    result.push({ time: data[i].time, value: parseFloat(ema.toFixed(2)) })
  }
  return result.filter((r) => r.value > 0)
}

export default function ChartPane({ symbol, lastPrice, indicators }) {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const smaSeriesRef = useRef(null)
  const emaSeriesRef = useRef(null)
  const [timeframe, setTimeframe] = useState('5m')

  const fetchKlines = useCallback(async (sym, tf) => {
    try {
      const res = await fetch(`/api/klines?symbol=${sym.replace('/', '')}&interval=${tf}&limit=200`)
      const data = await res.json()
      return data.klines || []
    } catch {
      return []
    }
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a33',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#f0ad4e',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const emaSeries = chart.addSeries(LineSeries, {
      color: '#5bc0de',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    const handleResize = () => {
      const r = container.parentElement.getBoundingClientRect()
      chart.applyOptions({ width: r.width, height: r.height })
    }

    const ro = new ResizeObserver(handleResize)
    ro.observe(container.parentElement)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current) return
    const rawSymbol = symbol.replace('/', '')
    const tf = timeframe
    let cancelled = false

    fetchKlines(rawSymbol, tf).then((klines) => {
      if (cancelled || !candleSeriesRef.current) return
      const candles = klines.map((k) => ({
        time: k.time, open: k.open, high: k.high, low: k.low, close: k.close,
      }))
      const volumes = klines.map((k) => ({
        time: k.time, value: k.volume,
        color: k.close >= k.open ? '#26a69a44' : '#ef535044',
      }))
      candleSeriesRef.current.setData(candles)
      volumeSeriesRef.current.setData(volumes)

      if (smaSeriesRef.current && candles.length >= 20) {
        smaSeriesRef.current.setData(computeSMA(candles, 20))
      }
      if (emaSeriesRef.current && candles.length >= 20) {
        emaSeriesRef.current.setData(computeEMA(candles, 20))
      }
      chartRef.current?.timeScale().fitContent()
    })

    return () => { cancelled = true }
  }, [symbol, timeframe, fetchKlines])

  useEffect(() => {
    const cs = candleSeriesRef.current
    if (!cs || !lastPrice) return
    try {
      const bars = cs.data()
      if (bars.length === 0) return
      const last = bars[bars.length - 1]
      cs.update({
        time: last.time,
        open: last.open,
        high: Math.max(last.high, lastPrice),
        low: Math.min(last.low, lastPrice),
        close: lastPrice,
      })
    } catch { /* data() not available yet */ }
  }, [lastPrice])

  const isUp = indicators?.priceChangePercent >= 0

  return (
    <>
      <div className="tv-chart-toolbar">
        <span className="tv-chart-symbol">{symbol}</span>
        {lastPrice != null && (
          <span className={`tv-last-price ${isUp ? 'green' : 'red'}`}>
            ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
        )}
        {indicators?.sma != null && <span className="tv-indicator-chip" style={{ borderLeft: '2px solid #f0ad4e' }}>SMA(20) {indicators.sma}</span>}
        {indicators?.ema != null && <span className="tv-indicator-chip" style={{ borderLeft: '2px solid #5bc0de' }}>EMA(20) {indicators.ema}</span>}
        {indicators?.rsi != null && (
          <span className="tv-indicator-chip" style={{ color: indicators.rsi > 70 ? '#ef5350' : indicators.rsi < 30 ? '#26a69a' : undefined }}>
            RSI(14) {indicators.rsi}
          </span>
        )}
        <div className="tv-timeframe-tabs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`tv-timeframe-tab ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="tv-chart-container">
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}
