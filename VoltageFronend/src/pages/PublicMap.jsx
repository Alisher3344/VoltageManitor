import { useState } from 'react'
import MapView from '../components/MapView'
import DeviceDetail from '../components/DeviceDetail'
import Icon from '../components/Icon'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useNow } from '../hooks/useNow'

// Publik bosh sahifa: butun ekran xarita + tepada SCADA top-bar (brend + jonli
// sanoq + tarmoq indikatori). Admin paneliga /operatoroomLogin orqali kiradi.
// Markerga bosilsa detallari o'ng tomondan drawer bo'lib ochiladi.
export default function PublicMap() {
  const { byId, devices } = useDeviceStream()
  const now = useNow()
  const [selId, setSelId] = useState(null)
  const selected = selId ? byId[selId] : null

  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length
  const off = total - on

  return (
    <div className="fullmap">
      <header className="map-topbar">
        <div className="mtb-brand">
          <span className="brand">
            <Icon name="zap" size={20} />
          </span>
          <span className="mtb-brand-text">
            <span className="mtb-title">Chiroqbor Monitoring</span>
            <span className="mtb-sub">SCADA · Qashqadaryo</span>
          </span>
        </div>

        <div className="map-stats">
          <span className="ms-item">
            <span className="ms-num">{total}</span>
            <span className="ms-lbl">Qurilma</span>
          </span>
          <span className="ms-sep" />
          <span className="ms-item">
            <span className="ms-dot on" />
            <span className="ms-num">{on}</span>
            <span className="ms-lbl">Yoniq</span>
          </span>
          <span className="ms-sep" />
          <span className="ms-item">
            <span className="ms-dot off" />
            <span className="ms-num">{off}</span>
            <span className="ms-lbl">O'chiq</span>
          </span>
        </div>

        <span className="online-pill mtb-online">
          <span className="led" /> Tarmoqda
        </span>
      </header>

      <MapView devices={devices} onSelect={setSelId} />
      {selected && (
        <DeviceDetail device={selected} now={now} onClose={() => setSelId(null)} />
      )}
    </div>
  )
}
