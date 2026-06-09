import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'

// Asosiy navigatsiya yo'llari (chap rail)
const NAV = [
  { to: '/', icon: 'map', label: 'Xarita', end: true },
  { to: '/stats', icon: 'chart', label: 'Statistika' },
]

const itemClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '')

export default function Sidebar() {
  const { user, canManage, logout } = useAuth()

  return (
    <nav className="sidebar">
      <div className="brand" title="Voltage Monitoring">
        <Icon name="zap" size={24} />
      </div>

      <div className="nav">
        {NAV.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={itemClass}>
            <span className="nav-ico">
              <Icon name={it.icon} size={21} />
            </span>
            <span className="nav-lbl">{it.label}</span>
          </NavLink>
        ))}
        {canManage && (
          <NavLink to="/admin" className={itemClass}>
            <span className="nav-ico">
              <Icon name="sliders" size={21} />
            </span>
            <span className="nav-lbl">Boshqaruv</span>
          </NavLink>
        )}
      </div>

      <div className="sidebar-foot">
        {user ? (
          <button
            className="nav-item"
            onClick={logout}
            title={`${user.username} — Chiqish`}
          >
            <span className="nav-ico avatar">
              {(user.username || '?')[0].toUpperCase()}
            </span>
            <span className="nav-lbl">Chiqish</span>
          </button>
        ) : (
          <NavLink to="/login" className={itemClass}>
            <span className="nav-ico">
              <Icon name="user" size={21} />
            </span>
            <span className="nav-lbl">Kirish</span>
          </NavLink>
        )}
      </div>
    </nav>
  )
}
