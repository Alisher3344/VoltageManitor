import { useState } from 'react'
import MapView from '../components/MapView'
import NodePanel from '../components/NodePanel'
import StatCards from '../components/StatCards'
import AlertToasts from '../components/AlertToasts'
import Icon from '../components/Icon'
import { LiveBadge } from '../components/Layout'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useNow } from '../hooks/useNow'

// Publik bosh sahifa — SCADA dashboard ko'rinishi (elektrmonitoring dizayni):
// chap brend rail + tepa KPI kartalar + markazda TARMOQ SXEMASI (real qurilmalar,
// yoniq/o'chiq) + o'ngda batafsil panel. Holat o'zgarsa yuqori-o'ngda toast.
// Admin paneliga /operatoroomLogin orqali kiradi.
export default function PublicMap() {
  const { byId, devices } = useDeviceStream()
  const now = useNow()
  const [selId, setSelId] = useState(null)
  const selected = selId ? byId[selId] : null

  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length
  const off = total - on
  const health = total ? Math.round((on / total) * 100) : 0
  const healthColor = health > 66 ? 'var(--on)' : health > 33 ? 'var(--warn)' : 'var(--off)'

  return (
    <div className="scada-dash">
      <aside className="sidebar dash-rail">
        <div className="brand-block">
          <div className="brand" title="Chiroqbor Monitoring">
            <Icon name="zap" size={22} />
          </div>
          <div className="brand-text">
            <div className="brand-title">Chiroqbor Monitoring</div>
            <div className="brand-sub">SCADA · Qashqadaryo</div>
          </div>
        </div>
        <div className="nav">
          <span className="nav-item active">
            <span className="nav-ico"><Icon name="map" size={20} /></span>
            <span className="nav-lbl">Tarmoq sxemasi</span>
          </span>
        </div>
        <div className="sidebar-foot">
          <div className="sys-health">
            <div className="sys-health-top">
              <span className="sys-health-lbl">Tizim holati</span>
              <span className="sys-health-num scada-num" style={{ color: healthColor }}>{health}%</span>
            </div>
            <div className="sys-health-bar">
              <span className="sys-health-fill" style={{ width: `${health}%`, background: healthColor }} />
            </div>
          </div>
        </div>
      </aside>

      <div className="main dash-main">
        <header className="main-header">
          <h1>Hududiy elektr taqsimlash tizimi</h1>
          <div className="header-actions">
            <span className="online-pill"><span className="led" /> Tarmoqda</span>
          </div>
        </header>

        <div className="main-body dash-body">
          <StatCards devices={devices} />
          <div className="dash-grid">
            <section className="panel net-panel">
              <div className="panel-head">
                <h3><Icon name="map" size={16} /> Tarmoq xaritasi</h3>
                <LiveBadge />
              </div>
              <div className="net-wrap">
                <MapView devices={devices} onSelect={setSelId} />
              </div>
            </section>
            <aside className="panel side-detail">
              <NodePanel device={selected} now={now} summary={{ total, on, off }} />
            </aside>
          </div>
        </div>
      </div>

      <AlertToasts devices={devices} />
    </div>
  )
}
