import React, { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'

export default function PortfolioChart() {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const [data, setData] = useState([])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: '#2a2e39' },
      width: containerRef.current.clientWidth,
      height: 180,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#2962ff',
      topColor: '#2962ff44',
      bottomColor: '#2962ff04',
      lineWidth: 2,
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(containerRef.current)

    const fetchHistory = async () => {
      try {
        const r = await fetch('/api/trade/equity_history')
        const d = await r.json()
        const points = (d.history || []).map((h) => ({
          time: Math.floor(h.timestamp / 1000),
          value: h.equity,
        }))
        setData(points)
        if (points.length > 0) {
          series.setData(points)
          chart.timeScale().fitContent()
        }
      } catch { /* skip */ }
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 5000)
    return () => {
      ro.disconnect()
      clearInterval(interval)
      chart.remove()
    }
  }, [])

  return (
    <div className="tv-portfolio-chart">
      <div className="tv-portfolio-chart-header">
        <span>Portfolio Equity</span>
        {data.length > 0 && (
          <span className="tv-portfolio-chart-value">
            ${data[data.length - 1].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <div ref={containerRef} />
    </div>
  )
}
