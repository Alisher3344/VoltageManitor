import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Holat o'zgarganda (real 0/1) ekranning yuqori-o'ng burchagida bildirishnoma
// chiqaradi. `devices` SSE orqali yangilanadi; oldingi holat bilan solishtirib,
// faqat HAQIQATAN o'zgargan qurilmalar uchun toast ko'rsatadi.
// Ikkala panelda ham (publik + admin) ishlatiladi.
const LIFETIME = 9000
const MAX = 4

export default function AlertToasts({ devices }) {
  const prev = useRef(null) // Map<id, last_value> — bazaviy holat
  const seq = useRef(0)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const cur = new Map(devices.map((d) => [d.id, d.last_value]))
    // Birinchi to'liq snapshot — bazaviy, toast chiqarmaymiz
    if (prev.current === null) {
      prev.current = cur
      return
    }
    const fresh = []
    for (const d of devices) {
      const before = prev.current.get(d.id)
      if (before !== undefined && before !== d.last_value) {
        fresh.push({
          key: ++seq.current,
          on: d.last_value === 1,
          name: d.name || `#${d.id}`,
          loc: d.district || d.address || '',
        })
      }
    }
    prev.current = cur
    if (fresh.length) {
      setToasts((t) => [...fresh, ...t].slice(0, MAX))
    }
  }, [devices])

  const dismiss = (key) => setToasts((t) => t.filter((x) => x.key !== key))

  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <Toast key={t.key} t={t} onClose={() => dismiss(t.key)} />
      ))}
    </div>
  )
}

function Toast({ t, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, LIFETIME)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <div className={'toast ' + (t.on ? 'on' : 'off')}>
      <span className="toast-ico">
        <Icon name={t.on ? 'power' : 'slash'} size={17} />
      </span>
      <div className="toast-body">
        <div className="toast-head">
          <span className="toast-title">{t.on ? 'Qurilma yondi' : "Qurilma o'chdi"}</span>
          <button className="toast-x" onClick={onClose} title="Yopish">
            <Icon name="x" size={13} />
          </button>
        </div>
        <div className="toast-name">{t.name}</div>
        <div className="toast-meta">
          {t.loc ? `${t.loc} · ` : ''}hozir
        </div>
      </div>
    </div>
  )
}
