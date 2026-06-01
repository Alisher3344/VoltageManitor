import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildMask, districtLabels, districtsGeo, outlineGeo, regionBounds } from '../lib/districts'

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
        [bounds[0][0] - 0.4, bounds[0][1] - 0.4],
        [bounds[1][0] + 0.4, bounds[1][1] + 0.4],
      ],
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('error', (e) => {
      if (e?.error?.message?.match(/style|fetch|load/i)) setStyleError(true)
    })

    map.on('load', () => {
      // Tashqarini xiralashtiruvchi maska
      map.addSource('mask', { type: 'geojson', data: buildMask() })
      map.addLayer({
        id: 'mask-fill',
        type: 'fill',
        source: 'mask',
        paint: { 'fill-color': '#0b1020', 'fill-opacity': 0.6 },
      })
      // Tuman chegaralari
      map.addSource('districts', { type: 'geojson', data: districtsGeo })
      map.addLayer({
        id: 'district-line',
        type: 'line',
        source: 'districts',
        paint: { 'line-color': '#8aa0c0', 'line-width': 1, 'line-opacity': 0.7 },
      })
      // Viloyat konturi
      map.addSource('outline', { type: 'geojson', data: outlineGeo })
      map.addLayer({
        id: 'outline-line',
        type: 'line',
        source: 'outline',
        paint: { 'line-color': '#818cf8', 'line-width': 2.5 },
      })
      // Tuman nomlari
      map.addSource('labels', { type: 'geojson', data: districtLabels() })
      map.addLayer({
        id: 'district-labels',
        type: 'symbol',
        source: 'labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#0f1117',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        },
      })
      setReady(true)
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
      if (d.lat == null || d.lon == null) continue
      present.add(d.id)
      let entry = markersRef.current[d.id]
      if (!entry) {
        const el = document.createElement('div')
        el.className = 'dev-marker'
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
        entry = { marker, el, popup }
        markersRef.current[d.id] = entry
      }

      entry.marker.setLngLat([d.lon, d.lat])
      entry.marker.setDraggable(editable)
      const on = d.last_value === 1
      entry.el.className = 'dev-marker ' + (on ? 'on' : 'off')
      entry.el.title = `${d.name || d.id} — ${on ? 'YONIQ' : "O'CHIQ"}`
      entry.popup.setHTML(
        (d.image_url ? `<img src="${escapeHtml(d.image_url)}" class="popup-img"/>` : '') +
          `<b>${escapeHtml(d.name || d.id)}</b> <span class="popup-sub">#${escapeHtml(d.id)}</span>` +
          `<br/>${on ? '🟢 YONIQ' : "⚫ O'CHIQ"}` +
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
        <div className="map-overlay">
          Xarita stili yuklanmadi (internet kerak). Tuman chegaralari baribir ko'rinadi.
        </div>
      )}
      {editable && (
        <div className="map-hint">Qurilma qo'yish uchun xaritaga bosing</div>
      )}
    </div>
  )
}
