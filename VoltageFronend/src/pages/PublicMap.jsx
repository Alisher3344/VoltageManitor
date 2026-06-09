import { useState } from 'react'
import Layout, { LiveBadge } from '../components/Layout'
import MapView from '../components/MapView'
import StatCards from '../components/StatCards'
import DeviceList from '../components/DeviceList'
import DeviceDetail from '../components/DeviceDetail'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useNow } from '../hooks/useNow'

export default function PublicMap() {
  const { byId, devices } = useDeviceStream()
  const now = useNow()
  const [selId, setSelId] = useState(null)
  const selected = selId ? byId[selId] : null

  return (
    <Layout
      title="Qurilmalar monitoringi"
      subtitle="Qashqadaryo viloyati — real-time holat"
      actions={<LiveBadge />}
    >
      <StatCards devices={devices} />
      <div className="map-area">
        <div className="map-col">
          <MapView devices={devices} onSelect={setSelId} />
        </div>
        <aside className="side-panel">
          <DeviceList devices={devices} onOpen={setSelId} />
        </aside>
      </div>

      {selected && (
        <DeviceDetail device={selected} now={now} onClose={() => setSelId(null)} />
      )}
    </Layout>
  )
}
