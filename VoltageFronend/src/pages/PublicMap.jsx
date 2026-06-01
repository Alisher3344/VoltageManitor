import { Link } from 'react-router-dom'
import MapView from '../components/MapView'
import DeviceStats from '../components/DeviceStats'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useAuth } from '../auth/AuthContext'

export default function PublicMap() {
  const { devices } = useDeviceStream()
  const { user } = useAuth()

  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length

  return (
    <div className="page">
      <header className="topbar">
        <h1>Qashqadaryo — Qurilmalar monitoringi</h1>
        <div className="spacer" />
        <span className="muted small">
          Jami {total} · <span className="dot on" /> {on} ·{' '}
          <span className="dot off" /> {total - on}
        </span>
        <Link to="/admin" className="btn">
          {user ? 'Admin panel' : 'Admin kirish'}
        </Link>
      </header>

      <div className="content admin">
        <div className="map-col">
          <MapView devices={devices} />
        </div>

        <aside className="panel">
          <DeviceStats devices={devices} />

          <div className="card">
            <h3>📡 Qurilmalar ({total})</h3>
            {total === 0 && (
              <div className="muted small">Hozircha qurilma yo'q.</div>
            )}
            <ul className="dev-list">
              {devices.map((d) => (
                <li key={d.id}>
                  <span className={'dot ' + (d.last_value === 1 ? 'on' : 'off')} />
                  {d.image_url && (
                    <img className="dev-thumb-sm" src={d.image_url} alt="" />
                  )}
                  <span className="dev-name">
                    {d.name || d.id}
                    <span className="muted small"> #{d.id}</span>
                    {d.address && <div className="muted small">{d.address}</div>}
                    {d.district && (
                      <span className="muted small">{d.district}</span>
                    )}
                  </span>
                  <span className={'status-tag ' + (d.last_value === 1 ? 'on' : 'off')}>
                    {d.last_value === 1 ? 'YONIQ' : "O'CHIQ"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
