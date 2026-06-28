import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading, canManage } = useAuth()

  if (loading) return <div className="center muted">Yuklanmoqda…</div>
  if (!user) return <Navigate to="/operatoroomLogin" replace />
  if (!canManage)
    return (
      <div className="center muted">
        Sizda ruxsat yo'q — admin yoki operator roli kerak.
      </div>
    )
  return children
}
