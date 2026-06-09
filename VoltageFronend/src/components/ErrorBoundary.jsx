import { Component } from 'react'

// Komponent xatosi butun sahifani oq qilib qo'ymasligi uchun — xatoni ko'rsatadi.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Konsolga ham chiqaramiz (F12 -> Console)
    console.error('UI xatosi:', error, info)
  }

  render() {
    if (this.state.error) {
      const e = this.state.error
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            color: '#e9ecf7',
            background: '#0a0e1a',
            minHeight: '100vh',
          }}
        >
          <h2 style={{ marginTop: 0 }}>⚠️ Sahifada xatolik</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              color: '#fda4af',
              background: '#10162a',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: 16,
              borderRadius: 12,
              overflow: 'auto',
            }}
          >
            {String(e?.stack || e?.message || e)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '9px 18px',
              border: 'none',
              borderRadius: 9,
              background: '#6366f1',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Qayta yuklash
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
