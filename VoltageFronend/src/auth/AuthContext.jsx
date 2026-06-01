import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api'

const AuthCtx = createContext(null)

const MANAGE_ROLES = ['admin', 'operator']

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const { access_token } = await api.login(username, password)
    setToken(access_token)
    const me = await api.me()
    setUser(me)
    return me
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  const canManage = !!user && MANAGE_ROLES.includes(user.role?.name)

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, canManage }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
