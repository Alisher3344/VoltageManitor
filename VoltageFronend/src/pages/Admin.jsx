import { useState } from 'react'
import Layout from '../components/Layout'
import MapView from '../components/MapView'
import DeviceList from '../components/DeviceList'
import AlertToasts from '../components/AlertToasts'
import Icon from '../components/Icon'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useAuth } from '../auth/AuthContext'
import { api, withBase } from '../api'
import { districtAt } from '../lib/districts'

const emptyForm = {
  mode: null,
  id: '',
  name: '',
  address: '',
  district: '',
  image_url: null,
  iccid: null,
  phone: null,
  lat: null,
  lon: null,
}

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const { devices, refetch } = useDeviceStream()
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [mapsLink, setMapsLink] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setForm(emptyForm)
    setImageFile(null)
    setMapsLink('')
  }

  // Google Maps havolasidan koordinatani olish (backend redirect'ni ochadi)
  const resolveLink = async () => {
    const u = mapsLink.trim()
    if (!u) return
    setGeoBusy(true)
    setError(null)
    try {
      const { lat, lon } = await api.resolveGeo(u)
      setForm((f) => ({ ...f, lat, lon, district: districtAt(lon, lat) || f.district || '' }))
    } catch (e) {
      setError(e.message || 'Havoladan koordinata olinmadi')
    } finally {
      setGeoBusy(false)
    }
  }

  // SIM800L orqali ro'yxatdan o'tgan, lekin hali joylashtirilmagan ID'lar
  const unplacedIds = devices.filter((d) => d.lat == null).map((d) => d.id)

  // Bo'sh forma (qo'lda ID + manzil kiritish uchun)
  const newDevice = () => {
    setError(null)
    setImageFile(null)
    setMapsLink('')
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
    setMapsLink('')
    setForm({
      mode: 'edit',
      id: d.id,
      name: d.name || '',
      address: d.address || '',
      district: d.district || '',
      image_url: d.image_url || null,
      iccid: d.iccid || null,
      phone: d.phone || null,
      lat: d.lat,
      lon: d.lon,
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      // Operator faqat nomni o'zgartiradi; admin joylashuvni ham
      let fields
      if (isAdmin) {
        const district =
          form.lat != null && form.lon != null ? districtAt(form.lon, form.lat) : null
        fields = {
          name: form.name.trim() || null,
          district,
          lat: form.lat,
          lon: form.lon,
        }
      } else {
        fields = { name: form.name.trim() || null }
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

  // Rasmni o'chirish: tanlangani (saqlanmagan) -> bekor; saqlangani -> API orqali
  const removeImage = async () => {
    if (imageFile) {
      setImageFile(null)
      return
    }
    if (!form.image_url) return
    setError(null)
    try {
      await api.deleteImage(form.id)
      setForm((f) => ({ ...f, image_url: null }))
      await refetch()
    } catch (e) {
      setError(e.message)
    }
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
    <Layout
      title="Boshqaruv paneli"
      subtitle={user ? `${user.username} · ${user.role?.name}` : null}
    >
      {error && <div className="form-error">{error}</div>}

      <div className="map-area">
        <div className="map-col">
          <MapView
            devices={devices}
            editable={isAdmin}
            onPlace={onPlace}
            onMove={onMove}
            onSelect={onSelect}
          />
        </div>

        <aside className="side-panel">
          {form.mode ? (
            <form className="card" onSubmit={submit}>
              <h3>
                <Icon name={form.mode === 'create' ? 'plus' : 'edit'} size={17} />
                {form.mode === 'create' ? 'Yangi qurilma' : 'Tahrirlash'}
              </h3>
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
              {isAdmin && (
                <>
                  <label>
                    Google Maps havolasi
                    <div className="row">
                      <input
                        value={mapsLink}
                        onChange={(e) => setMapsLink(e.target.value)}
                        placeholder="https://maps.app.goo.gl/..."
                      />
                      <button
                        type="button"
                        className="ghost"
                        onClick={resolveLink}
                        disabled={geoBusy}
                      >
                        {geoBusy ? '…' : 'Olish'}
                      </button>
                    </div>
                  </label>
                  <div className="muted small">
                    {form.lat != null && form.lon != null
                      ? `📍 Joylashuv: ${form.lat.toFixed(5)}, ${form.lon.toFixed(5)}`
                      : 'Google Maps havolasini joylang yoki xaritaga bosing.'}
                  </div>
                </>
              )}
              <label>
                Rasm
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </label>
              {(imageFile || form.image_url) && (
                <>
                  <img
                    className="dev-thumb"
                    src={imageFile ? URL.createObjectURL(imageFile) : withBase(form.image_url)}
                    alt=""
                  />
                  <button type="button" className="ghost" onClick={removeImage}>
                    <Icon name="trash" size={15} /> Rasmni o'chirish
                  </button>
                </>
              )}
              <div className="row">
                <button type="submit" disabled={busy} className="full">
                  {busy ? '…' : 'Saqlash'}
                </button>
                <button type="button" className="ghost" onClick={resetForm}>
                  Bekor
                </button>
              </div>
            </form>
          ) : isAdmin ? (
            <button onClick={newDevice} className="full">
              <Icon name="plus" size={17} /> Yangi qurilma
            </button>
          ) : (
            <div className="card muted small">
              Tahrirlash uchun ro'yxatdan yoki xaritadan qurilmani tanlang.
            </div>
          )}

          <DeviceList
            devices={devices}
            editable
            canDelete={isAdmin}
            onSelect={onSelect}
            onRemove={remove}
          />
        </aside>
      </div>

      {/* Holat o'zgarganda yuqori-o'ngda bildirishnoma */}
      <AlertToasts devices={devices} />
    </Layout>
  )
}
