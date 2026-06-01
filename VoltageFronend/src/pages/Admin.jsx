import { useState } from 'react'
import { Link } from 'react-router-dom'
import MapView from '../components/MapView'
import DeviceStats from '../components/DeviceStats'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'
import { districtAt } from '../lib/districts'

const emptyForm = {
  mode: null,
  id: '',
  name: '',
  address: '',
  district: '',
  image_url: null,
  lat: null,
  lon: null,
}

export default function Admin() {
  const { user, logout } = useAuth()
  const { devices, refetch } = useDeviceStream()
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setForm(emptyForm)
    setImageFile(null)
  }

  // SIM800L orqali ro'yxatdan o'tgan, lekin hali joylashtirilmagan ID'lar
  const unplacedIds = devices.filter((d) => d.lat == null).map((d) => d.id)

  // Bo'sh forma (qo'lda ID + manzil kiritish uchun)
  const newDevice = () => {
    setError(null)
    setImageFile(null)
    setForm({ ...emptyForm, mode: 'create' })
  }

  // Xaritaga bosish -> joylashuv to'ldiriladi (manzil qo'lda qoladi)
  const onPlace = ({ lng, lat }) => {
    setError(null)
    setForm((f) => ({
      ...(f.mode ? f : emptyForm),
      mode: f.mode || 'create',
      district: districtAt(lng, lat) || f.district || '',
      lat,
      lon: lng,
    }))
  }

  const onMove = async (id, { lng, lat }) => {
    try {
      await api.updateDevice(id, { lat, lon: lng, district: districtAt(lng, lat) })
      await refetch()
    } catch (e) {
      setError(e.message)
    }
  }

  const onSelect = (id) => {
    const d = devices.find((x) => x.id === id)
    if (!d) return
    setImageFile(null)
    setForm({
      mode: 'edit',
      id: d.id,
      name: d.name || '',
      address: d.address || '',
      district: d.district || '',
      image_url: d.image_url || null,
      lat: d.lat,
      lon: d.lon,
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // Tuman koordinatadan avtomatik (formada ko'rsatilmaydi)
      const district =
        form.lat != null && form.lon != null ? districtAt(form.lon, form.lat) : null
      const fields = {
        name: form.name.trim() || null,
        district,
        lat: form.lat,
        lon: form.lon,
      }
      const id = form.mode === 'create' ? form.id.trim() : form.id
      if (form.mode === 'create') {
        try {
          await api.createDevice({ id, ...fields })
        } catch (err) {
          // SIM800L allaqachon shu ID bilan ulangan bo'lsa -> yangilaymiz
          if (err.status === 409) await api.updateDevice(id, fields)
          else throw err
        }
      } else {
        await api.updateDevice(id, fields)
      }
      // Rasm tanlangan bo'lsa — yuklaymiz
      if (imageFile) await api.uploadImage(id, imageFile)
      await refetch()
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Koordinatani qo'lda kiritish (bo'sh -> null), tuman bo'sh bo'lsa avtomatik taklif
  const setCoord = (key, raw) => {
    const v = raw === '' ? null : parseFloat(raw)
    setForm((f) => {
      const next = { ...f, [key]: Number.isNaN(v) ? null : v }
      if (next.lat != null && next.lon != null && !f.district) {
        next.district = districtAt(next.lon, next.lat) || ''
      }
      return next
    })
  }

  const remove = async (id) => {
    if (!confirm(`"${id}" qurilmasi o'chirilsinmi?`)) return
    setError(null)
    try {
      await api.deleteDevice(id)
      await refetch()
      if (form.id === id) resetForm()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Admin panel</h1>
        <div className="spacer" />
        <span className="muted small">
          {user?.username} ({user?.role?.name})
        </span>
        <Link to="/" className="btn">
          Xarita
        </Link>
        <button className="btn ghost" onClick={logout}>
          Chiqish
        </button>
      </header>

      <div className="content admin">
        <div className="map-col">
          <MapView
            devices={devices}
            editable
            onPlace={onPlace}
            onMove={onMove}
            onSelect={onSelect}
          />
        </div>

        <aside className="panel">
          {error && <div className="form-error">{error}</div>}

          <DeviceStats devices={devices} />

          {form.mode ? (
            <form className="card" onSubmit={submit}>
              <h3>{form.mode === 'create' ? 'Yangi qurilma' : 'Tahrirlash'}</h3>
              <label>
                ID — ESP32-C3 / SIM800L raqami
                <input
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  disabled={form.mode === 'edit'}
                  list="dev-ids"
                  placeholder="apparatdagi ID bilan bir xil"
                  required
                />
                <datalist id="dev-ids">
                  {unplacedIds.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
              </label>
              <label>
                Nomi
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="masalan: Nasos-1"
                />
              </label>
              <div className="row">
                <label>
                  Kenglik (lat)
                  <input
                    type="number"
                    step="any"
                    value={form.lat ?? ''}
                    onChange={(e) => setCoord('lat', e.target.value)}
                    placeholder="38.8600"
                  />
                </label>
                <label>
                  Uzunlik (lon)
                  <input
                    type="number"
                    step="any"
                    value={form.lon ?? ''}
                    onChange={(e) => setCoord('lon', e.target.value)}
                    placeholder="65.7900"
                  />
                </label>
              </div>
              <div className="muted small">
                Koordinatani qo'lda yozing yoki xaritaga bosing.
              </div>
              <label>
                Rasm
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>
              {(imageFile || form.image_url) && (
                <img
                  className="dev-thumb"
                  src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                  alt=""
                />
              )}
              <div className="row">
                <button type="submit" disabled={busy}>
                  {busy ? '…' : 'Saqlash'}
                </button>
                <button type="button" className="ghost" onClick={resetForm}>
                  Bekor
                </button>
              </div>
            </form>
          ) : (
            <button onClick={newDevice}>+ Yangi qurilma</button>
          )}

          <div className="card">
            <h3>📡 Qurilmalar ({devices.length})</h3>
            {devices.length === 0 && (
              <div className="muted small">
                Hozircha yo'q. "Yangi qurilma" bilan ID + manzil kiriting.
              </div>
            )}
            <ul className="dev-list">
              {devices.map((d) => (
                <li key={d.id} className={d.lat == null ? 'unplaced' : ''}>
                  <span className={'dot ' + (d.last_value === 1 ? 'on' : 'off')} />
                  {d.image_url && (
                    <img className="dev-thumb-sm" src={d.image_url} alt="" />
                  )}
                  <span className="dev-name">
                    {d.name || d.id}
                    <span className="muted small"> #{d.id}</span>
                    {d.address && <div className="muted small">{d.address}</div>}
                    {d.lat == null && (
                      <span className="warn small">joylashuvsiz</span>
                    )}
                  </span>
                  <span className={'status-tag ' + (d.last_value === 1 ? 'on' : 'off')}>
                    {d.last_value === 1 ? 'YONIQ' : "O'CHIQ"}
                  </span>
                  <button className="mini" onClick={() => onSelect(d.id)}>
                    ✎
                  </button>
                  <button className="mini danger" onClick={() => remove(d.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
