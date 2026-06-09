// Qurilma holati: faqat yoniq (on) yoki o'chiq (off).
export function deviceStatus(d) {
  return d && d.last_value === 1 ? 'on' : 'off'
}

export const STATUS_LABEL = {
  on: 'YONIQ',
  off: "O'CHIQ",
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
]

// "9 iyun, 14:32" ko'rinishidagi sana-vaqt
export function formatDateTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "2 daqiqa oldin" ko'rinishidagi nisbiy vaqt (oxirgi aloqa uchun)
export function timeAgo(ts, now = Date.now()) {
  if (!ts) return 'hech qachon'
  const s = Math.max(0, Math.round((now - new Date(ts).getTime()) / 1000))
  if (s < 10) return 'hozir'
  if (s < 60) return `${s} soniya oldin`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} daqiqa oldin`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} soat oldin`
  const days = Math.round(h / 24)
  return `${days} kun oldin`
}
