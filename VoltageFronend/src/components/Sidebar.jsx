import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useDeviceStream } from '../hooks/useDeviceStream'
import Icon from './Icon'

// SCADA uslubidagi keng yon panel (elektrmonitoring dizayni): brend bloki +
// nomlangan navigatsiya + pastda "Tizim holati" (yoniq %) ko'rsatkichi.
// Publik "Xarita" (/) havolasi admin menyusida kerak emas.
const NAV = [{ to: '/stats', icon: 'chart', label: 'Boshqaruv paneli' }]

const itemClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '')

export default function Sidebar() {
  const { user, canManage, logout } = useAuth()
  const { devices } = useDeviceStream()

  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length
  const health = total ? Math.round((on / total) * 100) : 0
  const healthColor =
    health > 66 ? 'var(--on)' : health > 33 ? 'var(--warn)' : 'var(--off)'

  return (
    <nav className="sidebar">
      <div className="brand-block">
        <div className="brand" title="Chiroqbor Monitoring">
          <Icon name="zap" size={24} />
        </div>
        <div className="brand-text">
          <div className="brand-title">Chiroqbor Monitoring</div>
          <div className="brand-sub">SCADA · v1.0</div>
        </div>
      </div>

      <div className="nav">
        {NAV.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={itemClass}>
            <span className="nav-ico">
              <Icon name={it.icon} size={20} />
            </span>
            <span className="nav-lbl">{it.label}</span>
          </NavLink>
        ))}
        {canManage && (
          <NavLink to="/operatoroom" className={itemClass}>
            <span className="nav-ico">
              <Icon name="sliders" size={20} />
            </span>
            <span className="nav-lbl">Qurilmalar</span>
          </NavLink>
        )}
      </div>

      <div className="sidebar-foot">
        <div className="sys-health">
          <div className="sys-health-top">
            <span className="sys-health-lbl">Tizim holati</span>
            <span className="sys-health-num scada-num" style={{ color: healthColor }}>
              {health}%
            </span>
          </div>
          <div className="sys-health-bar">
            <span
              className="sys-health-fill"
              style={{ width: `${health}%`, background: healthColor }}
            />
          </div>
        </div>

        {user ? (
          <button
            className="nav-item foot-user"
            onClick={logout}
            title={`${user.username} — Chiqish`}
          >
            <span className="nav-ico avatar">
              {(user.username || '?')[0].toUpperCase()}
            </span>
            <span className="nav-lbl">{user.username} · Chiqish</span>
          </button>
        ) : (
          <NavLink to="/operatoroomLogin" className={itemClass}>
            <span className="nav-ico">
              <Icon name="user" size={20} />
            </span>
            <span className="nav-lbl">Kirish</span>
          </NavLink>
        )}
      </div>
    </nav>
  )
}
