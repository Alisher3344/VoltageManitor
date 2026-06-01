// Qurilmalar statistikasi: jami / yoniq / o'chiq + tumanlar bo'yicha taqsimot
export default function DeviceStats({ devices }) {
  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length
  const off = total - on

  // Tumanlar bo'yicha
  const byDist = {}
  for (const d of devices) {
    const k = d.district || '— (tumansiz)'
    if (!byDist[k]) byDist[k] = { on: 0, total: 0 }
    byDist[k].total += 1
    if (d.last_value === 1) byDist[k].on += 1
  }
  const dists = Object.entries(byDist).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="card">
      <h3>📊 Statistika</h3>
      <div className="stats">
        <div className="stat">
          <div className="num">{total}</div>
          <div className="lbl">Jami</div>
        </div>
        <div className="stat on">
          <div className="num">{on}</div>
          <div className="lbl">Yoniq</div>
        </div>
        <div className="stat off">
          <div className="num">{off}</div>
          <div className="lbl">O'chiq</div>
        </div>
      </div>

      {dists.length > 0 && (
        <div className="dist-stats">
          <div className="muted small">Tumanlar bo'yicha</div>
          {dists.map(([name, s]) => (
            <div className="dist-row" key={name}>
              <span className="dist-name">{name}</span>
              <span className="dist-bar">
                <span
                  className="dist-fill"
                  style={{ width: s.total ? `${(s.on / s.total) * 100}%` : 0 }}
                />
              </span>
              <span className="muted small">
                {s.on}/{s.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
