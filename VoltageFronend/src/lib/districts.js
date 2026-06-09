// Qashqadaryo tuman geometriyasi + nuqta bo'yicha tuman aniqlash (point-in-polygon)
import districtsGeo from '../qashqadaryo.geo.json'
import outlineGeo from '../qashqadaryo_outline.geo.json'

export { districtsGeo, outlineGeo }

// Har bir tuman uchun farqli (sovuq/pushti) rang — yashil/qizil marker bilan
// chalkashmasligi uchun yashil va qizildan qochamiz.
const DISTRICT_PALETTE = [
  '#6366f1', '#06b6d4', '#8b5cf6', '#0ea5e9', '#14b8a6', '#ec4899', '#a78bfa',
  '#38bdf8', '#2dd4bf', '#818cf8', '#c084fc', '#22d3ee', '#f472b6',
]

// maplibre uchun 'match' ifodasi: name -> rang (faqat tumanlar)
export function districtColorMatch() {
  const expr = ['match', ['get', 'name']]
  let i = 0
  for (const f of districtsGeo.features) {
    if (f.properties.is_city) continue
    expr.push(f.properties.name, DISTRICT_PALETTE[i % DISTRICT_PALETTE.length])
    i += 1
  }
  expr.push('#8aa0c0') // default
  return expr
}

function ringsOf(geom) {
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}

function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// lon/lat bo'yicha tegishli tuman nomini qaytaradi (yoki null)
export function districtAt(lon, lat) {
  for (const f of districtsGeo.features) {
    for (const ring of ringsOf(f.geometry)) {
      if (pointInRing([lon, lat], ring)) return f.properties.name
    }
  }
  return null
}

// Nomi bo'yicha hudud (feature) topish
export function featureByName(name) {
  return districtsGeo.features.find((f) => f.properties.name === name) || null
}

// Nuqta shu hudud (feature) ichidami?
export function pointInFeature(lon, lat, feature) {
  if (!feature) return false
  for (const ring of ringsOf(feature.geometry)) {
    if (pointInRing([lon, lat], ring)) return true
  }
  return false
}

// Hududning chegara to'rtburchagi [[minLon,minLat],[maxLon,maxLat]]
export function bboxOfFeature(feature) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const ring of ringsOf(feature.geometry)) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

// [[minLon,minLat],[maxLon,maxLat]] — xaritani viloyatga moslash uchun
export function regionBounds() {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const f of districtsGeo.features) {
    for (const ring of ringsOf(f.geometry)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

// Viloyatdan tashqarini xiralashtiruvchi maska (dunyo to'rtburchagi + outline "teshik")
export function buildMask() {
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]
  const holes = ringsOf(outlineGeo.features[0].geometry)
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [world, ...holes] },
  }
}

// Hudud nomlari uchun nuqtalar (tuman + shahar). is_city orqali ajratiladi.
export function districtLabels() {
  return {
    type: 'FeatureCollection',
    features: districtsGeo.features
      .filter((f) => f.properties.center)
      .map((f) => ({
        type: 'Feature',
        properties: { name: f.properties.name, is_city: !!f.properties.is_city },
        geometry: {
          type: 'Point',
          // center [lat, lon] -> [lon, lat]
          coordinates: [f.properties.center[1], f.properties.center[0]],
        },
      })),
  }
}
