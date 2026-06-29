import { useMemo } from 'react'
import { deviceStatus } from '../lib/status'

// TARMOQ SXEMASI (one-line diagram) — REAL qurilmalar tugun, rang = yoniq/o'chiq.
// Joylashuv lat/lon'dan proyeksiya qilinadi, ulanish chiziqlari MST bilan
// avtomatik chiziladi (qurilmalarda elektr-ulanish ma'lumoti yo'q).
const HEX = { on: '#22c55e', off: '#ef4444' }
const W = 100
const H = 80
const PAD = 9

// Qurilmalarni viewBox koordinatasiga joylashtirish
function useLayout(devices) {
  return useMemo(() => {
    const pts = {}
    const placed = devices.filter((d) => d.lat != null && d.lon != null)
    if (placed.length >= 2) {
      const lons = placed.map((d) => d.lon)
      const lats = placed.map((d) => d.lat)
      let minLon = Math.min(...lons)
      let maxLon = Math.max(...lons)
      let minLat = Math.min(...lats)
      let maxLat = Math.max(...lats)
      if (maxLon - minLon < 1e-6) { minLon -= 0.01; maxLon += 0.01 }
      if (maxLat - minLat < 1e-6) { minLat -= 0.01; maxLat += 0.01 }
      const sx = (W - 2 * PAD) / (maxLon - minLon)
      const sy = (H - 2 * PAD) / (maxLat - minLat)
      for (const d of placed) {
        pts[d.id] = {
          x: PAD + (d.lon - minLon) * sx,
          y: PAD + (maxLat - d.lat) * sy, // shimol tepada
        }
      }
    }
    // Joylashuvsiz (yoki <2 ta joylangan) qurilmalar — pastki qatorga teng tarqatamiz
    const rest = devices.filter((d) => !pts[d.id])
    rest.forEach((d, i) => {
      const n = rest.length
      pts[d.id] = {
        x: PAD + (n <= 1 ? (W - 2 * PAD) / 2 : (i / (n - 1)) * (W - 2 * PAD)),
        y: H - PAD * 0.7,
      }
    })
    return pts
  }, [devices])
}

// Prim MST — barcha tugunlarni daraxt qilib ulaydi
function useEdges(devices, pts) {
  return useMemo(() => {
    const ids = devices.map((d) => d.id).filter((id) => pts[id])
    if (ids.length < 2) return []
    const dist = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)
    const inTree = new Set([ids[0]])
    const edges = []
    while (inTree.size < ids.length) {
      let best = null
      for (const a of inTree) {
        for (const b of ids) {
          if (inTree.has(b)) continue
          const dd = dist(a, b)
          if (!best || dd < best.d) best = { a, b, d: dd }
        }
      }
      if (!best) break
      edges.push([best.a, best.b])
      inTree.add(best.b)
    }
    return edges
  }, [devices, pts])
}

export default function NetworkMap({ devices, selId, onSelect }) {
  const pts = useLayout(devices)
  const edges = useEdges(devices, pts)
  const byId = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices])

  return (
    <div className="net-wrap grid-bg">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="net-svg">
        {/* Ulanish liniyalari */}
        {edges.map(([a, b], i) => {
          const pa = pts[a]
          const pb = pts[b]
          const sa = deviceStatus(byId[a])
          const sb = deviceStatus(byId[b])
          const bothOn = sa === 'on' && sb === 'on'
          const color = bothOn ? HEX.on : HEX.off
          return (
            <g key={i}>
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={bothOn ? 0.35 : 0.55} strokeOpacity={0.5} />
              {bothOn && (
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={0.28} strokeOpacity={0.95} className="net-flow" />
              )}
            </g>
          )
        })}

        {/* Qurilma tugunlari */}
        {devices.map((d) => {
          const p = pts[d.id]
          if (!p) return null
          const st = deviceStatus(d)
          const color = HEX[st]
          const isSel = selId === d.id
          return (
            <g key={d.id} transform={`translate(${p.x}, ${p.y})`} onClick={() => onSelect(d.id)} style={{ cursor: 'pointer' }}>
              {isSel && <circle r={3.2} fill="none" stroke="#00d9c0" strokeWidth={0.4} opacity={0.9} />}
              {st === 'off' && (
                <circle r={2.4} fill="none" stroke={color} strokeWidth={0.3}>
                  <animate attributeName="r" from="1.8" to="4" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.85" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Qurilma belgisi (ikki halqa) */}
              <circle cy={-0.5} r={1.15} fill="none" stroke={color} strokeWidth={0.35} />
              <circle cy={0.6} r={1.15} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={0.35} />
              <circle r={0.5} fill={color} />
              <text y={4} textAnchor="middle" fontSize={1.5} fill={isSel ? '#00d9c0' : '#cbd5e1'} fontWeight={isSel ? 700 : 500} style={{ fontFamily: 'Manrope, sans-serif' }}>
                {(d.name || d.id).replace(/^PS /, '')}
              </text>
              <text y={5.7} textAnchor="middle" fontSize={1.2} fill={color} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {st === 'on' ? 'YONIQ' : "O'CHIQ"}
              </text>
            </g>
          )
        })}
      </svg>

      {devices.length === 0 && <div className="net-empty muted">Hozircha qurilma yo'q.</div>}

      <div className="net-legend">
        <span><span className="led on" /> Yoniq</span>
        <span><span className="led off" /> O'chiq</span>
      </div>
    </div>
  )
}
