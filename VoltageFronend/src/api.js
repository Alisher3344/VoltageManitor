// Backend API yordamchilari + token boshqaruvi (JWT localStorage'da)
const TOKEN_KEY = 'voltage_token'

// Subpath qo'llab-quvvatlash: prod'da '/Voltage/', dev'da '/'.
// Barcha API/SSE/rasm so'rovlari shu prefiks bilan yuboriladi; nginx esa
// /Voltage/ prefiksini kesib backendga (root yo'llarga) uzatadi.
export const withBase = (p) =>
  import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + String(p).replace(/^\//, '')

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(withBase(path), { ...opts, headers })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      /* ignore */
    }
    const err = new Error(detail || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json()
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  login: async (username, password) => {
    const body = new URLSearchParams({ username, password })
    const res = await fetch(withBase('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      let d
      try {
        d = (await res.json()).detail
      } catch {
        /* ignore */
      }
      const e = new Error(d || 'Login xatosi')
      e.status = res.status
      throw e
    }
    return res.json() // { access_token, token_type }
  },
  me: () => req('/auth/me'),
  listDevices: () => req('/devices'),
  listDevicesManage: () => req('/devices/manage'),
  deviceHistory: (id, hours = 24) =>
    req(`/devices/${encodeURIComponent(id)}/history?hours=${hours}`),
  resolveGeo: (url) => req(`/geo/resolve?url=${encodeURIComponent(url)}`),
  createDevice: (data) => req('/devices', json('POST', data)),
  updateDevice: (id, data) => req(`/devices/${encodeURIComponent(id)}`, json('PATCH', data)),
  deleteDevice: (id) => req(`/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setState: (id, value) =>
    req(`/devices/${encodeURIComponent(id)}/state`, json('POST', { value })),
  uploadImage: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    // Content-Type bermaymiz — brauzer multipart boundary'ni o'zi qo'yadi
    return req(`/devices/${encodeURIComponent(id)}/image`, { method: 'POST', body: fd })
  },
  deleteImage: (id) => req(`/devices/${encodeURIComponent(id)}/image`, { method: 'DELETE' }),
}
