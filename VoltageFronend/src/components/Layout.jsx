import Sidebar from './Sidebar'

// Umumiy app qobig'i: chap navigatsiya + sarlavhali asosiy ustun.
export default function Layout({ title, subtitle, actions, children }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <header className="main-header">
          <div className="title-wrap">
            <h1>{title}</h1>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          {actions && <div className="header-actions">{actions}</div>}
        </header>
        <div className="main-body">{children}</div>
      </div>
    </div>
  )
}

// Sarlavhada ishlatish uchun jonli ulanish belgisi
export function LiveBadge() {
  return (
    <span className="live">
      <span className="live-dot" /> Jonli
    </span>
  )
}
