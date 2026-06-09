import { Routes, Route, Navigate } from 'react-router-dom'
import PublicMap from './pages/PublicMap'
import Stats from './pages/Stats'
import Login from './pages/Login'
import Admin from './pages/Admin'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicMap />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
