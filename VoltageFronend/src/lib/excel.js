// Qurilmalarni Excel (.xls) fayl qilib brauzerda yuklab olish — kutubxonasiz.
// HTML jadval + ms-excel MIME: Excel ustunlarga ajratib ochadi.
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// mso-number-format:'@' — matn sifatida (uzun ICCID/telefon ilmiy yozuvga aylanmasin)
const cell = (v, asText = false) =>
  `<td${asText ? " style=\"mso-number-format:'\\@'\"" : ''}>${esc(v)}</td>`

export function downloadDevicesExcel(rows, filename = 'qurilmalar.xls') {
  const header = ['ID', 'Nomi', 'Telefon', 'ICCID', 'Kenglik', 'Uzunlik']
  const head = '<tr>' + header.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr>'
  const body = rows
    .map(
      (d) =>
        '<tr>' +
        cell(d.id, true) +
        cell(d.name || '') +
        cell(d.phone || '', true) +
        cell(d.iccid || '', true) +
        cell(d.lat ?? '') +
        cell(d.lon ?? '') +
        '</tr>'
    )
    .join('')

  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<head><meta charset="utf-8"></head><body>' +
    `<table border="1">${head}${body}</table></body></html>`

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
