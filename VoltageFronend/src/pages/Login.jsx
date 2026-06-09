import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Kirish amalga oshmadi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <div className="login-brand">
          <Icon name="zap" size={30} />
        </div>
        <h2>Boshqaruv paneli</h2>
        <p className="login-sub">Davom etish uchun tizimga kiring</p>
        <label>
          Login
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Parol
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={busy} className="full">
          {busy ? 'Kirilmoqda…' : 'Kirish'}
        </button>
        <Link to="/" className="link-quiet">
          ← Xaritaga qaytish
        </Link>
      </form>
    </div>
  )
}
