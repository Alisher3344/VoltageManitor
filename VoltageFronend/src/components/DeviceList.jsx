import Icon from './Icon'
import { withBase } from '../api'
import { deviceStatus, STATUS_LABEL } from '../lib/status'

// Qurilmalar ro'yxati — ochiq (ko'rish/ochish) yoki admin (tahrir/o'chirish) uchun.
export default function DeviceList({
  devices,
  editable = false,
  canDelete = true,
  onSelect,
  onRemove,
  onOpen,
}) {
  const clickable = !editable && typeof onOpen === 'function'

  return (
    <div className="card">
      <h3>
        <Icon name="list" size={17} /> Qurilmalar{' '}
        <span className="count">{devices.length}</span>
      </h3>

      {devices.length === 0 && (
        <div className="muted small empty">
          {editable
            ? "Hozircha yo'q. \"Yangi qurilma\" bilan ID + manzil kiriting."
            : "Hozircha qurilma yo'q."}
        </div>
      )}

      <ul className="dev-list">
        {devices.map((d) => {
          const status = deviceStatus(d)
          return (
            <li
              key={d.id}
              className={
                (d.lat == null ? 'unplaced' : '') + (clickable ? ' clickable' : '')
              }
              onClick={clickable ? () => onOpen(d.id) : undefined}
            >
              <span className={'dot ' + status} />
              {d.image_url ? (
                <img className="dev-thumb-sm" src={withBase(d.image_url)} alt="" />
              ) : (
                <span className="dev-thumb-ph">
                  {(d.name || d.id)[0].toUpperCase()}
                </span>
              )}
              <span className="dev-name">
                <span className="dev-title">
                  {d.name || d.id} <span className="muted id">#{d.id}</span>
                </span>
                {d.address && <span className="muted small block">{d.address}</span>}
                {d.district && <span className="muted small block">{d.district}</span>}
                {editable && d.lat == null && (
                  <span className="warn small">joylashuvsiz</span>
                )}
              </span>
              <span className={'status-tag ' + status}>{STATUS_LABEL[status]}</span>
              {editable && (
                <span className="dev-actions">
                  <button
                    className="mini"
                    onClick={() => onSelect(d.id)}
                    title="Tahrirlash"
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  {canDelete && (
                    <button
                      className="mini danger"
                      onClick={() => onRemove(d.id)}
                      title="O'chirish"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
