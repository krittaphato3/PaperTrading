import { useEffect, useRef, useCallback, useState } from 'react'

export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimerRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = location.host
    const ws = new WebSocket(`${protocol}//${host}/ws`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onclose = () => {
      setConnected(false)
      reconnectTimerRef.current = setTimeout(connect, 2000)
    }

    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessageRef.current(msg)
      } catch { /* skip */ }
    }
  }, [])

  useEffect(() => {
    connect()
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 15000)
    return () => {
      clearInterval(interval)
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
