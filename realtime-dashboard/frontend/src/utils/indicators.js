export function computeSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    result.push({ time: data[i].time, value: +(sum / period).toFixed(2) })
  }
  return result
}

export function computeEMA(data, period) {
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
    result.push({ time: data[i].time, value: +ema.toFixed(2) })
  }
  return result.filter(r => r.value > 0)
}

export function computeWMA(data, period) {
  const result = []
  const weightSum = period * (period + 1) / 2
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j].close * (j + 1)
    }
    result.push({ time: data[i].time, value: +(sum / weightSum).toFixed(2) })
  }
  return result
}

export function computeVWMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let pvSum = 0, volSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      pvSum += data[j].close * (data[j].volume || 1)
      volSum += (data[j].volume || 1)
    }
    result.push({ time: data[i].time, value: +(pvSum / volSum).toFixed(2) })
  }
  return result
}

export function computeBollinger(data, period = 20, stddev = 2) {
  const middle = computeSMA(data, period)
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    const mean = middle[i - period + 1].value
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j].close - mean) ** 2
    const sigma = Math.sqrt(sumSq / period) * stddev
    result.push({ time: data[i].time, middle: mean, upper: +(mean + sigma).toFixed(2), lower: +(mean - sigma).toFixed(2) })
  }
  return result
}

export function computeRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const result = []
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close
    if (diff >= 0) gains += diff; else losses -= diff
  }
  let avgGain = gains / period, avgLoss = losses / period
  result.push({ time: data[period].time, value: +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2) })
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close
    const gain = diff >= 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rsi = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)
    result.push({ time: data[i].time, value: rsi })
  }
  return result
}

export function computeMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = computeEMA(data, fast)
  const emaSlow = computeEMA(data, slow)
  const macdLine = []
  for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
    if (emaFast[i] && emaSlow[i]) {
      macdLine.push({ time: emaFast[i].time, value: +(emaFast[i].value - emaSlow[i].value).toFixed(4) })
    }
  }
  const signalLine = computeEMA(macdLine.map(m => ({ time: m.time, close: m.value })), signal)
  const histogram = []
  for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
    if (macdLine[i] && signalLine[i]) {
      histogram.push({ time: macdLine[i].time, value: +(macdLine[i].value - signalLine[i].value).toFixed(4), color: macdLine[i].value >= signalLine[i].value ? '#26a69a66' : '#ef535066' })
    }
  }
  return { macdLine, signalLine, histogram }
}

export function computeStochastic(data, kPeriod = 14, dPeriod = 3) {
  const kLine = []
  for (let i = kPeriod - 1; i < data.length; i++) {
    let high = -Infinity, low = Infinity
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > high) high = data[j].high
      if (data[j].low < low) low = data[j].low
    }
    const k = high === low ? 50 : +((data[i].close - low) / (high - low) * 100).toFixed(2)
    kLine.push({ time: data[i].time, value: k })
  }
  const dLine = computeSMA(kLine.map(k => ({ time: k.time, close: k.value })), dPeriod)
  return { kLine, dLine }
}

export function computeATR(data, period = 14) {
  if (data.length < 2) return []
  const tr = []
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low
    const hc = Math.abs(data[i].high - data[i - 1].close)
    const lc = Math.abs(data[i].low - data[i - 1].close)
    tr.push({ time: data[i].time, value: Math.max(hl, hc, lc) })
  }
  const result = []
  let atr = 0
  for (let i = 0; i < period && i < tr.length; i++) atr += tr[i].value
  atr /= period
  if (tr.length >= period) result.push({ time: tr[period - 1].time, value: +atr.toFixed(2) })
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i].value) / period
    result.push({ time: tr[i].time, value: +atr.toFixed(2) })
  }
  return result
}

export function computeADX(data, period = 14) {
  if (data.length < period + 1) return { adx: [], plusDI: [], minusDI: [] }
  const tr = [], plusDM = [], minusDM = []
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low
    const hc = Math.abs(data[i].high - data[i - 1].close)
    const lc = Math.abs(data[i].low - data[i - 1].close)
    tr.push(Math.max(hl, hc, lc))
    const upMove = data[i].high - data[i - 1].high
    const downMove = data[i - 1].low - data[i].low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }
  const atr = [], plusDI = [], minusDI = [], dx = []
  let atrSum = 0, plusSum = 0, minusSum = 0
  for (let i = 0; i < period && i < tr.length; i++) {
    atrSum += tr[i]; plusSum += plusDM[i]; minusSum += minusDM[i]
  }
  for (let i = period - 1; i < tr.length; i++) {
    if (i === period - 1) {
      atr.push(atrSum / period); plusDI.push(plusSum / atrSum * 100); minusDI.push(minusSum / atrSum * 100)
    } else {
      const a = (atr[atr.length - 1] * (period - 1) + tr[i]) / period
      const p = (plusDI[plusDI.length - 1] * (period - 1) + plusDM[i]) / period
      const m = (minusDI[minusDI.length - 1] * (period - 1) + minusDM[i]) / period
      atr.push(a); plusDI.push(p); minusDI.push(m)
    }
    const diDiff = Math.abs(plusDI[plusDI.length - 1] - minusDI[minusDI.length - 1])
    const diSum = plusDI[plusDI.length - 1] + minusDI[minusDI.length - 1]
    dx.push(diSum === 0 ? 0 : diDiff / diSum * 100)
  }
  const adx = []
  let adxSum = 0
  for (let i = 0; i < period && i < dx.length; i++) adxSum += dx[i]
  if (dx.length >= period) adx.push({ time: data[period + period - 1].time, value: +(adxSum / period).toFixed(2) })
  for (let i = period; i < dx.length; i++) {
    const val = (adx[adx.length - 1].value * (period - 1) + dx[i]) / period
    adx.push({ time: data[period + i].time, value: +val.toFixed(2) })
  }
  const timeOffset = period
  return {
    adx, plusDI: plusDI.map((v, i) => ({ time: data[timeOffset + i].time, value: +v.toFixed(2) })),
    minusDI: minusDI.map((v, i) => ({ time: data[timeOffset + i].time, value: +v.toFixed(2) })),
  }
}

export function computeIchimoku(data, conversion = 9, base = 26, span = 52) {
  if (data.length < span) return { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] }
  const tenkan = [], kijun = [], senkouA = [], senkouB = [], chikou = []
  for (let i = conversion - 1; i < data.length; i++) {
    let h = -Infinity, l = Infinity
    for (let j = i - conversion + 1; j <= i; j++) { if (data[j].high > h) h = data[j].high; if (data[j].low < l) l = data[j].low }
    tenkan.push({ time: data[i].time, value: +((h + l) / 2).toFixed(2) })
  }
  for (let i = base - 1; i < data.length; i++) {
    let h = -Infinity, l = Infinity
    for (let j = i - base + 1; j <= i; j++) { if (data[j].high > h) h = data[j].high; if (data[j].low < l) l = data[j].low }
    kijun.push({ time: data[i].time, value: +((h + l) / 2).toFixed(2) })
  }
  const minLen = Math.min(tenkan.length, kijun.length)
  for (let i = 0; i < minLen; i++) {
    senkouA.push({ time: tenkan[i].time + base * 60, value: +((tenkan[i].value + kijun[i].value) / 2).toFixed(2) })
  }
  for (let i = span - 1; i < data.length; i++) {
    let h = -Infinity, l = Infinity
    for (let j = i - span + 1; j <= i; j++) { if (data[j].high > h) h = data[j].high; if (data[j].low < l) l = data[j].low }
    senkouB.push({ time: data[i].time + base * 60, value: +((h + l) / 2).toFixed(2) })
  }
  for (let i = base; i < data.length; i++) {
    chikou.push({ time: data[i - base].time, value: data[i].close })
  }
  return { tenkan, kijun, senkouA, senkouB, chikou }
}

export function computePSAR(data, acceleration = 0.02, maxAccel = 0.2) {
  if (data.length < 2) return []
  const result = []
  let isUp = data[1].high > data[0].high
  let sar = isUp ? data[0].low : data[0].high
  let ep = isUp ? data[1].high : data[1].low
  let af = acceleration
  result.push({ time: data[0].time, value: +sar.toFixed(2) })
  for (let i = 1; i < data.length; i++) {
    if (isUp) {
      sar = sar + af * (ep - sar)
      sar = Math.min(sar, data[i - 1].low, data[i].low)
      if (data[i].high > ep) { ep = data[i].high; af = Math.min(af + acceleration, maxAccel) }
      if (data[i].low < sar) { isUp = false; sar = ep; ep = data[i].low; af = acceleration }
    } else {
      sar = sar - af * (sar - ep)
      sar = Math.max(sar, data[i - 1].high, data[i].high)
      if (data[i].low < ep) { ep = data[i].low; af = Math.min(af + acceleration, maxAccel) }
      if (data[i].high > sar) { isUp = true; sar = ep; ep = data[i].high; af = acceleration }
    }
    result.push({ time: data[i].time, value: +Math.max(sar, 0).toFixed(2) })
  }
  return result
}

export const INDICATOR_DEFS = [
  { id: 'sma', name: 'SMA', type: 'overlay', params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 200 }], color: '#f0ad4e', compute: (d, p) => computeSMA(d, p.period) },
  { id: 'ema', name: 'EMA', type: 'overlay', params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 200 }], color: '#5bc0de', compute: (d, p) => computeEMA(d, p.period) },
  { id: 'wma', name: 'WMA', type: 'overlay', params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 200 }], color: '#e67e22', compute: (d, p) => computeWMA(d, p.period) },
  { id: 'vwma', name: 'VWMA', type: 'overlay', params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 200 }], color: '#9b59b6', compute: (d, p) => computeVWMA(d, p.period) },
  { id: 'bb', name: 'Bollinger Bands', type: 'overlay', params: [{ key: 'period', label: 'Period', default: 20, min: 2, max: 200 }, { key: 'stddev', label: 'StdDev', default: 2, min: 0.5, max: 5, step: 0.1 }], color: '#9b59b6', compute: (d, p) => computeBollinger(d, p.period, p.stddev) },
  { id: 'psar', name: 'Parabolic SAR', type: 'overlay', params: [{ key: 'accel', label: 'Acceleration', default: 0.02, min: 0.002, max: 0.2, step: 0.002 }], color: '#2ecc71', compute: (d, p) => computePSAR(d, p.accel) },
  { id: 'ichimoku', name: 'Ichimoku', type: 'overlay', params: [{ key: 'conversion', label: 'Conversion', default: 9, min: 2, max: 100 }, { key: 'base', label: 'Base', default: 26, min: 2, max: 100 }, { key: 'span', label: 'Span', default: 52, min: 2, max: 200 }], color: '#e74c3c', compute: (d, p) => computeIchimoku(d, p.conversion, p.base, p.span) },
  { id: 'rsi', name: 'RSI', type: 'panel', params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }], color: '#e67e22', height: 100, compute: (d, p) => computeRSI(d, p.period) },
  { id: 'macd', name: 'MACD', type: 'panel', params: [{ key: 'fast', label: 'Fast', default: 12, min: 2, max: 100 }, { key: 'slow', label: 'Slow', default: 26, min: 2, max: 200 }, { key: 'signal', label: 'Signal', default: 9, min: 2, max: 100 }], color: '#2980b9', height: 150, compute: (d, p) => computeMACD(d, p.fast, p.slow, p.signal) },
  { id: 'stoch', name: 'Stochastic', type: 'panel', params: [{ key: 'k', label: '%K Period', default: 14, min: 2, max: 100 }, { key: 'd', label: '%D Period', default: 3, min: 2, max: 50 }], color: '#2ecc71', height: 100, compute: (d, p) => computeStochastic(d, p.k, p.d) },
  { id: 'atr', name: 'ATR', type: 'panel', params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }], color: '#e74c3c', height: 80, compute: (d, p) => computeATR(d, p.period) },
  { id: 'adx', name: 'ADX', type: 'panel', params: [{ key: 'period', label: 'Period', default: 14, min: 2, max: 100 }], color: '#f1c40f', height: 100, compute: (d, p) => computeADX(d, p.period) },
]
