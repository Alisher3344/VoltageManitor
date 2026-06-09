import { useEffect, useState } from 'react'

// Vaqtga bog'liq holatlarni (masalan "oflayn") qayta hisoblash uchun
// joriy vaqtni davriy yangilab turadigan hook.
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
