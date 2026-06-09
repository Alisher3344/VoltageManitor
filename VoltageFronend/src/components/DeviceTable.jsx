import { useEffect, useState } from 'react'
import Icon from './Icon'
import { api } from '../api'
import { downloadDevicesExcel } from '../lib/excel'

// Faqat admin/operator uchun: qurilmalar SIM ma'lumotlari jadvali + Excel yuklab olish.
export default function DeviceTable() {
  const [rows, setRows] = useState([])
  const [sel, setSel] = useState(() => new Set())
  const [state, setState] = useState('loading') // loading | ok | error

  useEffect(() => {
    let alive = true
    api
      .listDevicesManage()
      .then((r) => alive && (setRows(r), setState('ok')))
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [])

  const allChecked = rows.length > 0 && sel.size === rows.length
  const toggle = (id) =>
    setSel((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(rows.map((r) => r.id)))

  const download = () => {
    const chosen = sel.size ? rows.filter((r) => sel.has(r.id)) : rows
    downloadDevicesExcel(chosen)
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>
          <Icon name="list" size={17} /> Qurilmalar — SIM ma'lumotlari
        </h3>
        <button onClick={download} disabled={state !== 'ok' || rows.length === 0}>
          <Icon name="download" size={15} /> Excel yuklab olish
        </button>
      </div>

      {state === 'loading' && <div className="muted small">Yuklanmoqda…</div>}
      {state === 'error' && <div className="muted small">Ma'lumot yuklanmadi.</div>}
      {state === 'ok' && rows.length === 0 && (
        <div className="muted small">Qurilma yo'q.</div>
      )}

      {state === 'ok' && rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="dev-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th>ID</th>
                  <th>Nomi</th>
                  <th>Telefon</th>
                  <th>ICCID</th>
                  <th>Kenglik</th>
                  <th>Uzunlik</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className={sel.has(d.id) ? 'sel' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={sel.has(d.id)}
                        onChange={() => toggle(d.id)}
                      />
                    </td>
                    <td>#{d.id}</td>
                    <td>{d.name || '—'}</td>
                    <td>{d.phone || '—'}</td>
                    <td>{d.iccid || '—'}</td>
                    <td>{d.lat ?? '—'}</td>
                    <td>{d.lon ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted small">
            {sel.size ? `${sel.size} ta tanlandi` : 'Hammasi'} — "Excel yuklab olish" tanlanganlarni (yoki hammasini) yuklaydi
          </div>
        </>
      )}
    </div>
  )
}
