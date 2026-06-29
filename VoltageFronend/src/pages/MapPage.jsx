import { useState } from 'react'
import Layout, { LiveBadge } from '../components/Layout'
import MapView from '../components/MapView'
import DeviceDetail from '../components/DeviceDetail'
import AlertToasts from '../components/AlertToasts'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useNow } from '../hooks/useNow'

// Admin "Xarita" bo'limi — qurilmalar joylashuvi + jonli holat (faqat ko'rish).
// Markerga bosilsa o'ngdan batafsil drawer ochiladi. Holat o'zgarsa toast.
export default function MapPage() {
  const { byId, devices } = useDeviceStream()
  const now = useNow()
  const [selId, setSelId] = useState(null)
  const selected = selId ? byId[selId] : null

  return (
    <Layout
      title="Xarita"
      subtitle="Qurilmalar joylashuvi · jonli holat"
      actions={<LiveBadge />}
    >
      <section className="panel net-panel">
        <div className="net-wrap">
          <MapView devices={devices} onSelect={setSelId} />
        </div>
      </section>

      {selected && (
        <DeviceDetail device={selected} now={now} onClose={() => setSelId(null)} />
      )}
      <AlertToasts devices={devices} />
    </Layout>
  )
}
