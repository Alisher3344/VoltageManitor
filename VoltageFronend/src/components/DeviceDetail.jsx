import { useEffect, useState } from 'react'
import { api, withBase } from '../api'
import Icon from './Icon'
import { deviceStatus, STATUS_LABEL, timeAgo, formatDateTime } from '../lib/status'

// 24 soatlik holat tarixini segmentli timeline qilib chizadi
function Timeline({ hist }) {
  const fromT = new Date(hist.from).getTime()
  const toT = new Date(hist.to).getTime()
  const span = toT - fromT || 1
  const segs = hist.events.map((e, i) => {
    const s = new Date(e.ts).getTime()
    const en = i + 1 < hist.events.length ? new Date(hist.events[i + 1].ts).getTime() : toT
    return { value: e.value, w: Math.max(0, ((en - s) / span) * 100) }
  })

  return (
    <div className="card timeline-card">
      <h3>
        <Icon name="activity" size={16} /> So'nggi 24 soat
      </h3>
      <div className="tl-summary">
        <span>
          <b>{hist.uptime_pct}%</b> yoniq
        </span>
        <span>
          <b>{hist.outages}</b> marta o'chgan
        </span>
      </div>
      {segs.length ? (
        <div className="tl-bar">
          {segs.map((s, i) => (
            <span
              key={i}
              className={'tl-seg ' + (s.value === 1 ? 'on' : 'off')}
              style={{ width: s.w + '%' }}
            />
          ))}
        </div>
      ) : (
        <div className="muted small">Bu davrda ma'lumot yo'q.</div>
      )}
      <div className="tl-axis">
        <span>24 soat oldin</span>
        <span>hozir</span>
      </div>
    </div>
  )
}

export default function DeviceDetail({ device, now, onClose }) {
  const [hist, setHist] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | error

  useEffect(() => {
    let alive = true
    setState('loading')
    api
      .deviceHistory(device.id)
      .then((h) => {
        if (alive) {
          setHist(h)
          setState('ok')
        }
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [device.id])

  const status = deviceStatus(device)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{device.name || device.id}</h3>
          <button className="mini" onClick={onClose} title="Yopish">
            <Icon name="x" size={16} />
          </button>
        </div>

        {device.image_url && <img className="dev-thumb" src={withBase(device.image_url)} alt="" />}

        <div className="detail-status">
          <span className={'status-tag ' + status}>{STATUS_LABEL[status]}</span>
          <span className="muted small">Oxirgi aloqa: {timeAgo(device.last_seen, now)}</span>
        </div>

        {device.address && <div className="muted small">{device.address}</div>}

        {state === 'loading' && <div className="muted small">Tarix yuklanmoqda…</div>}
        {state === 'error' && <div className="muted small">Tarix yuklanmadi.</div>}
        {state === 'ok' && hist && <Timeline hist={hist} />}

        {state === 'ok' && hist && (
          <div className="card">
            <h3>
              <Icon name="list" size={16} /> Hodisalar jurnali
            </h3>
            {hist.log && hist.log.length > 0 ? (
              <ul className="evlog">
                {hist.log.map((e, i) => (
                  <li key={i}>
                    <span className={'dot ' + (e.value === 1 ? 'on' : 'off')} />
                    <span className="evlog-act">{e.value === 1 ? 'Yondi' : "O'chdi"}</span>
                    <span className="muted small">{formatDateTime(e.ts)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted small">So'nggi 24 soatda o'zgarish bo'lmagan.</div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
