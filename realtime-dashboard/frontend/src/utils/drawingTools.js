let drawId = 0

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618]

export function createDrawingStore() {
  const drawings = []

  function add(type, data) {
    const id = ++drawId
    const d = { id, type, visible: true, ...data }
    drawings.push(d)
    return d
  }

  function remove(id) {
    const idx = drawings.findIndex(d => d.id === id)
    if (idx !== -1) drawings.splice(idx, 1)
  }

  function getAll() { return drawings }

  function clear() { drawings.length = 0 }

  return { add, remove, getAll, clear }
}

export function renderDrawings(chart, drawings, seriesMap) {
  for (const d of drawings) {
    if (!d.visible) continue
    switch (d.type) {
      case 'trendline':
        renderTrendline(chart, d, seriesMap)
        break
      case 'horizontal':
        renderHorizontalLine(chart, d, seriesMap)
        break
      case 'vertical':
        renderVerticalLine(chart, d, seriesMap)
        break
      case 'fibonacci':
        renderFibonacci(chart, d, seriesMap)
        break
    }
  }
}

function renderTrendline(chart, d, seriesMap) {
  if (seriesMap[d.id]) return
  const series = chart.addLineSeries({
    color: d.color || '#2962ff',
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  })
  series.setData([
    { time: d.startTime, value: d.startPrice },
    { time: d.endTime, value: d.endPrice },
  ])
  seriesMap[d.id] = series
}

function renderHorizontalLine(chart, d, seriesMap) {
  if (seriesMap[d.id]) return
  const series = chart.addLineSeries({
    color: d.color || '#f0ad4e',
    lineWidth: 1,
    lineStyle: 2,
    lastValueVisible: false,
    priceLineVisible: false,
  })
  series.setData([
    { time: d.startTime, value: d.price },
    { time: d.endTime, value: d.price },
  ])
  seriesMap[d.id] = series
}

function renderVerticalLine(chart, d, seriesMap) {
  if (seriesMap[d.id]) return
  const series = chart.addLineSeries({
    color: d.color || '#5bc0de',
    lineWidth: 1,
    lineStyle: 2,
    lastValueVisible: false,
    priceLineVisible: false,
  })
  const dataPoints = []
  const mainSeries = chart.serieses ? chart.serieses() : []
  let priceLow = 0, priceHigh = 0
  for (const s of mainSeries) {
    if (s.data) {
      const bars = s.data()
      if (bars.length > 0) {
        priceLow = Math.min(priceLow, bars.reduce((m, b) => Math.min(m, b.low || b.value || 0), Infinity))
        priceHigh = Math.max(priceHigh, bars.reduce((m, b) => Math.max(m, b.high || b.value || 0), -Infinity))
      }
    }
  }
  dataPoints.push({ time: d.time, value: priceLow || 0 })
  dataPoints.push({ time: d.time, value: priceHigh || 100 })
  series.setData(dataPoints)
  seriesMap[d.id] = series
}

function renderFibonacci(chart, d, seriesMap) {
  FIB_LEVELS.forEach((level, i) => {
    const sid = `${d.id}-fib-${i}`
    if (seriesMap[sid]) return
    const price = d.startPrice + (d.endPrice - d.startPrice) * level
    const series = chart.addLineSeries({
      color: d.color || '#9b59b6',
      lineWidth: 1,
      lineStyle: i === 0 || i === FIB_LEVELS.length - 1 ? 0 : 2,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    series.setData([
      { time: d.startTime, value: price },
      { time: d.endTime, value: price },
    ])
    seriesMap[sid] = series
  })
}

export function clearDrawings(chart, seriesMap) {
  for (const key of Object.keys(seriesMap)) {
    try { chart.removeSeries(seriesMap[key]) } catch {}
  }
  for (const key of Object.keys(seriesMap)) delete seriesMap[key]
}
