import Icon from './Icon'

// Tumanlar bo'yicha taqsimot (yoniq/jami nisbati progress bar bilan)
export default function DistrictStats({ devices }) {
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
      <h3>
        <Icon name="layers" size={17} /> Tumanlar bo'yicha
      </h3>
      {dists.length === 0 ? (
        <div className="muted small empty">Ma'lumot yo'q.</div>
      ) : (
        <div className="dist-stats">
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
