import { useState } from 'react'
import MapView from '../components/MapView'
import DeviceDetail from '../components/DeviceDetail'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useNow } from '../hooks/useNow'

// Publik bosh sahifa: butun ekran xarita (chap menyu, stat-kartalar va yon ro'yxat
// yo'q). Admin paneliga /operatoroomLogin orqali kiradi. Markerga bosilsa detallari
// o'ng tomondan drawer bo'lib ochiladi.
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
      <MapView devices={devices} onSelect={setSelId} />
      {selected && (
        <DeviceDetail device={selected} now={now} onClose={() => setSelId(null)} />
      )}
    </div>
  )
}
