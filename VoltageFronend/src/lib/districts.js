// Qashqadaryo tuman geometriyasi + nuqta bo'yicha tuman aniqlash (point-in-polygon)
import districtsGeo from '../qashqadaryo.geo.json'
import outlineGeo from '../qashqadaryo_outline.geo.json'

export { districtsGeo, outlineGeo }

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

// Tuman nomlari uchun nuqtalar (label layer)
export function districtLabels() {
  return {
    type: 'FeatureCollection',
    features: districtsGeo.features
      .filter((f) => f.properties.center && !f.properties.is_city)
      .map((f) => ({
        type: 'Feature',
        properties: { name: f.properties.name },
        geometry: {
          type: 'Point',
          // center [lat, lon] -> [lon, lat]
          coordinates: [f.properties.center[1], f.properties.center[0]],
        },
      })),
  }
}
