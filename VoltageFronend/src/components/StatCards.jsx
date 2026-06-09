import Icon from './Icon'

// Umumiy ko'rsatkichlar: jami / yoniq / o'chiq / faollik %
export default function StatCards({ devices }) {
  const total = devices.length
  const on = devices.filter((d) => d.last_value === 1).length
  const off = total - on
  const pct = total ? Math.round((on / total) * 100) : 0

  const cards = [
    { key: 'total', icon: 'cpu', label: 'Jami qurilma', value: total, tone: '' },
    { key: 'on', icon: 'power', label: 'Yoniq', value: on, tone: 'on' },
    { key: 'off', icon: 'power', label: "O'chiq", value: off, tone: 'off' },
    { key: 'pct', icon: 'activity', label: 'Faollik', value: `${pct}%`, tone: 'accent' },
  ]

  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.key} className={'stat-card ' + c.tone}>
          <div className="stat-top">
            <span className="stat-lbl">{c.label}</span>
            <span className="stat-ico">
              <Icon name={c.icon} size={19} />
            </span>
          </div>
          <div className="stat-num">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
