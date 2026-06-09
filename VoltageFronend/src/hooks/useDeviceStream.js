import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'

// Qurilmalar ro'yxati (/devices) + jonli holat (/events SSE).
// byId: { id -> device }, devices: massiv, refetch(): ro'yxatni qayta yuklash.
export function useDeviceStream() {
  const [byId, setById] = useState({})
  const mounted = useRef(true)
  // SSE effekti (deps []) eng so'nggi refetch'ga shu ref orqali kiradi
  const refetchRef = useRef(null)

  const refetch = useCallback(async () => {
    const list = await api.listDevices()
    if (!mounted.current) return
    setById(Object.fromEntries(list.map((d) => [d.id, d])))
  }, [])
  refetchRef.current = refetch

  useEffect(() => {
    mounted.current = true
    refetch().catch(() => {})
    return () => {
      mounted.current = false
    }
  }, [refetch])

  // SSE — last_value'ni jonli yangilaydi
  useEffect(() => {
    let es
    let closed = false
    let timer
    const apply = (id, value) =>
      setById((prev) => {
        // Noma'lum ID (qurilma endi ulandi) — to'liq yozuvni olish uchun qayta yuklaymiz
        if (!prev[id]) {
          refetchRef.current?.()
          return prev
        }
        return { ...prev, [id]: { ...prev[id], last_value: Number(value) } }
      })

    function connect() {
      es = new EventSource('/events')
      es.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.all) {
          setById((prev) => {
            const next = { ...prev }
            let missing = false
            for (const [id, v] of Object.entries(data.all)) {
              if (next[id]) next[id] = { ...next[id], last_value: Number(v) }
              else missing = true
            }
            // Snapshot'da hali ro'yxatda yo'q qurilma bo'lsa — qayta yuklaymiz
            if (missing) refetchRef.current?.()
            return next
          })
        } else if (data.id !== undefined) {
          apply(data.id, data.value)
        }
      }
      es.onerror = () => {
        es.close()
        if (!closed) timer = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      closed = true
      if (es) es.close()
      if (timer) clearTimeout(timer)
    }
  }, [])

  return { byId, devices: Object.values(byId), refetch }
}
