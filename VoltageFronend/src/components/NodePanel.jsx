import { useEffect, useState } from 'react'
import { api, withBase } from '../api'
import Icon from './Icon'
import { deviceStatus, STATUS_LABEL, timeAgo, formatDateTime } from '../lib/status'

// Dashboard o'ng ustunidagi BATAFSIL panel (inline, drawer emas) — real ma'lumot:
// holat, oxirgi aloqa, joylashuv, 24 soatlik yoniqlik va hodisalar jurnali.
// Qurilma tanlanmagan bo'lsa — umumiy ko'rsatkichlar ko'rsatiladi.
export default function NodePanel({ device, now, summary }) {
  const [hist, setHist] = useState(null)
  const [state, setState] = useState('idle')
  const id = device?.id

  useEffect(() => {
    if (!id) {
      setHist(null)
      setState('idle')
      return
    }
    let alive = true
    setState('loading')
    api
      .deviceHistory(id)
      .then((h) => alive && (setHist(h), setState('ok')))
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [id])

  if (!device) {
    return (
      <div className="node-panel np-empty">
        <Icon name="cpu" size={30} />
        <div className="muted small">Batafsil ma'lumot uchun sxemadan qurilmani tanlang.</div>
        {summary && (
          <div className="np-summary">
            <div className="nps-row">
              <span className="muted small">Jami qurilma</span>
              <b className="scada-num">{summary.total}</b>
            </div>
            <div className="nps-row">
              <span className="muted small"><span className="dot on" /> Yoniq</span>
              <b className="scada-num" style={{ color: 'var(--on)' }}>{summary.on}</b>
            </div>
            <div className="nps-row">
              <span className="muted small"><span className="dot off" /> O'chiq</span>
              <b className="scada-num" style={{ color: 'var(--off)' }}>{summary.off}</b>
            </div>
          </div>
        )}
      </div>
    )
  }

  const status = deviceStatus(device)

  return (
    <div className="node-panel">
      <div className="np-head">
        <h3>{device.name || device.id}</h3>
        <span className={'status-tag ' + status}>{STATUS_LABEL[status]}</span>
      </div>

      {device.image_url && <img className="dev-thumb" src={withBase(device.image_url)} alt="" />}

      <div className="detail-meta">
        <div className="row2"><span className="k">ID</span><span className="scada-num">#{device.id}</span></div>
        <div className="row2"><span className="k">Oxirgi aloqa</span><span>{timeAgo(device.last_seen, now)}</span></div>
        {device.district && <div className="row2"><span className="k">Tuman</span><span>{device.district}</span></div>}
        {device.address && <div className="row2"><span className="k">Manzil</span><span>{device.address}</span></div>}
      </div>

      {state === 'loading' && <div className="muted small">Tarix yuklanmoqda…</div>}
      {state === 'error' && <div className="muted small">Tarix yuklanmadi.</div>}
      {state === 'ok' && hist && (
        <>
          <div className="tl-summary">
            <span><b>{hist.uptime_pct}%</b> yoniq</span>
            <span><b>{hist.outages}</b> marta o'chgan</span>
          </div>
          <Timeline hist={hist} />
          <div className="np-log">
            <div className="np-log-head muted small">So'nggi hodisalar</div>
            {hist.log && hist.log.length > 0 ? (
              <ul className="evlog">
                {hist.log.slice(0, 8).map((e, i) => (
                  <li key={i}>
                    <span className={'dot ' + (e.value === 1 ? 'on' : 'off')} />
                    <span className="evlog-act">{e.value === 1 ? 'Yondi' : "O'chdi"}</span>
                    <span className="muted small">{formatDateTime(e.ts)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted small">So'nggi 24 soatda o'zgarish yo'q.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Timeline({ hist }) {
  const fromT = new Date(hist.from).getTime()
  const toT = new Date(hist.to).getTime()
  const span = toT - fromT || 1
  const segs = hist.events.map((e, i) => {
    const s = new Date(e.ts).getTime()
    const en = i + 1 < hist.events.length ? new Date(hist.events[i + 1].ts).getTime() : toT
    return { value: e.value, w: Math.max(0, ((en - s) / span) * 100) }
  })
  if (!segs.length) return null
  return (
    <>
      <div className="tl-bar">
        {segs.map((s, i) => (
          <span key={i} className={'tl-seg ' + (s.value === 1 ? 'on' : 'off')} style={{ width: s.w + '%' }} />
        ))}
      </div>
      <div className="tl-axis"><span>24 soat oldin</span><span>hozir</span></div>
    </>
  )
}
