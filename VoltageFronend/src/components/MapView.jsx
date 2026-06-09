import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMask, outlineGeo, regionBounds } from '../lib/districts'
import { withBase } from '../api'
import { deviceStatus, STATUS_LABEL } from '../lib/status'

// Bepul vektor stil (Google EMAS, API kalit kerak emas)
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )

export default function MapView({
  devices = [],
  editable = false,
  onPlace,
  onMove,
  onSelect,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const [ready, setReady] = useState(false)
  const [styleError, setStyleError] = useState(false)

  // Eng so'nggi callback/flag'lar (stale closure'dan qochish)
  const refs = useRef({})
  refs.current = { editable, onPlace, onMove, onSelect }

  // --- Xaritani bir marta yaratish ---
  useEffect(() => {
    const bounds = regionBounds()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 24 },
      maxBounds: [
        [bounds[0][0] - 0.5, bounds[0][1] - 0.5],
        [bounds[1][0] + 0.5, bounds[1][1] + 0.5],
      ],
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('error', (e) => {
      if (e?.error?.message?.match(/style|fetch|load/i)) setStyleError(true)
    })

    map.on('load', () => {
      // Joy nomlarini o'zbek tiliga o'tkazish: vektor stildagi barcha matn
      // qatlamlarining text-field'ini name:uz ga almashtiramiz (fallback: latin/en/name).
      const UZ_LABEL = [
        'coalesce',
        ['get', 'name:uz'],
        ['get', 'name:uz-Latn'],
        ['get', 'name:latin'],
        ['get', 'name:en'],
        ['get', 'name'],
      ]
      for (const layer of map.getStyle().layers) {
        if (layer.type !== 'symbol') continue
        // text-field bor qatlamlarnigina o'zgartiramiz (ikona-only qatlamlarni emas)
        if (map.getLayoutProperty(layer.id, 'text-field') == null) continue
        try {
          map.setLayoutProperty(layer.id, 'text-field', UZ_LABEL)
        } catch {
          /* ba'zi qatlamlar o'zgarmasligi mumkin — e'tiborsiz */
        }
      }

      // Viloyatdan tashqarini xiralashtiruvchi maska
      map.addSource('mask', { type: 'geojson', data: buildMask() })
      map.addLayer({
        id: 'mask-fill',
        type: 'fill',
        source: 'mask',
        paint: { 'fill-color': '#0b1020', 'fill-opacity': 0.6 },
      })
      // Faqat Qashqadaryo viloyati konturi (ichki tuman bo'linishlarisiz)
      map.addSource('outline', { type: 'geojson', data: outlineGeo })
      map.addLayer({
        id: 'outline-line',
        type: 'line',
        source: 'outline',
        paint: { 'line-color': '#818cf8', 'line-width': 2.5 },
      })
      setReady(true)
      // Konteyner balandligi keyin hisoblansa ham xarita to'g'ri to'lsin
      map.resize()
      setTimeout(() => map.resize(), 150)
    })

    // Bo'sh joyga bosish -> qurilma qo'yish (admin)
    map.on('click', (e) => {
      if (refs.current.editable) refs.current.onPlace?.(e.lngLat)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = {}
    }
  }, [])

  // --- Markerlarni qurilmalar bilan moslashtirish ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const present = new Set()

    for (const d of devices) {
      // Noto'g'ri koordinatani o'tkazib yuboramiz (xarita yiqilmasligi uchun)
      if (
        d.lat == null ||
        d.lon == null ||
        d.lat < -90 || d.lat > 90 ||
        d.lon < -180 || d.lon > 180
      )
        continue
      present.add(d.id)
      let entry = markersRef.current[d.id]
      if (!entry) {
        // Tashqi element — maplibre faqat SHU elementni transform bilan joylashtiradi
        const el = document.createElement('div')
        el.className = 'dev-marker'
        // Ichki element — barcha vizual + hover/transition shu yerda (pozitsiyaga xalaqit bermaydi)
        const dot = document.createElement('div')
        dot.className = 'dev-marker-dot'
        el.appendChild(dot)
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          refs.current.onSelect?.(d.id)
        })
        const marker = new maplibregl.Marker({ element: el, draggable: editable })
          .setLngLat([d.lon, d.lat])
          .addTo(map)
        marker.on('dragend', () => {
          const ll = marker.getLngLat()
          refs.current.onMove?.(d.id, ll)
        })
        const popup = new maplibregl.Popup({ offset: 16, closeButton: false })
        marker.setPopup(popup)
        entry = { marker, el, dot, popup }
        markersRef.current[d.id] = entry
      }

      entry.marker.setLngLat([d.lon, d.lat])
      entry.marker.setDraggable(editable)
      const status = deviceStatus(d)
      entry.dot.className = 'dev-marker-dot ' + status
      entry.el.title = `${d.name || d.id} — ${STATUS_LABEL[status]}`
      entry.popup.setHTML(
        (d.image_url ? `<img src="${escapeHtml(withBase(d.image_url))}" class="popup-img"/>` : '') +
          `<b>${escapeHtml(d.name || d.id)}</b> <span class="popup-sub">#${escapeHtml(d.id)}</span>` +
          `<br/><span class="pop-dot ${status}"></span>${STATUS_LABEL[status]}` +
          (d.address ? `<br/><span class="popup-sub">${escapeHtml(d.address)}</span>` : '') +
          (d.district ? `<br/><span class="popup-sub">${escapeHtml(d.district)}</span>` : '')
      )
    }

    // Yo'q bo'lganlarni o'chirish
    for (const id of Object.keys(markersRef.current)) {
      if (!present.has(id)) {
        markersRef.current[id].marker.remove()
        delete markersRef.current[id]
      }
    }
  }, [devices, editable, ready])

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-legend">
        <span>
          <span className="dot on" /> Yoniq
        </span>
        <span>
          <span className="dot off" /> O'chiq
        </span>
      </div>
      {styleError && (
        <div className="map-overlay">Xarita stili yuklanmadi (internet kerak).</div>
      )}
      {editable && (
        <div className="map-hint">Qurilma qo'yish uchun xaritaga bosing</div>
      )}
    </div>
  )
}
