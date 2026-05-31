import React, { useEffect, useState } from 'react'

export default function MarketStats({ symbol, liveData }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!liveData) return
    setStats(liveData)
  }, [liveData])

  if (!stats) return null

  const isUp = stats.change_24h >= 0

  return (
    <div className="tv-market-stats">
      <div className="tv-stat-item">
        <span className="tv-stat-label">24h Change</span>
        <span className={`tv-stat-value ${isUp ? 'green' : 'red'}`}>
          {isUp ? '+' : ''}{stats.change_24h.toFixed(2)}%
        </span>
      </div>
      <div className="tv-stat-item">
        <span className="tv-stat-label">24h High</span>
        <span className="tv-stat-value">
          ${stats.high?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </span>
      </div>
      <div className="tv-stat-item">
        <span className="tv-stat-label">24h Low</span>
        <span className="tv-stat-value">
          ${stats.low?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </span>
      </div>
      <div className="tv-stat-item">
        <span className="tv-stat-label">Volume</span>
        <span className="tv-stat-value">
          {stats.volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="tv-stat-item">
        <span className="tv-stat-label">Quote Vol</span>
        <span className="tv-stat-value">
          ${stats.quote_volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="tv-stat-item">
        <span className="tv-stat-label">Open</span>
        <span className="tv-stat-value">
          ${stats.open?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </span>
      </div>
    </div>
  )
}
