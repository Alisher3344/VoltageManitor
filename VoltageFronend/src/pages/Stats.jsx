import Layout, { LiveBadge } from '../components/Layout'
import StatCards from '../components/StatCards'
import DistrictStats from '../components/DistrictStats'
import DeviceList from '../components/DeviceList'
import DeviceTable from '../components/DeviceTable'
import { useDeviceStream } from '../hooks/useDeviceStream'
import { useAuth } from '../auth/AuthContext'

export default function Stats() {
  const { devices } = useDeviceStream()
  const { canManage } = useAuth()

  return (
    <Layout
      title="Statistika"
      subtitle="Umumiy ko'rsatkichlar va tumanlar kesimida"
      actions={<LiveBadge />}
    >
      <StatCards devices={devices} />
      <div className="stats-grid">
        <DistrictStats devices={devices} />
        <DeviceList devices={devices} />
      </div>

      {/* SIM ma'lumotlari + Excel — faqat admin/operator */}
      {canManage && <DeviceTable />}
    </Layout>
  )
}
