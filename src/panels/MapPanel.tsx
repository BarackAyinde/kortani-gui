import { useCallback, useState } from 'react'
import Map, { type MapMouseEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export default function MapPanel() {
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null)

  const onMouseMove = useCallback((e: MapMouseEvent) => {
    setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
  }, [])

  const onMouseLeave = useCallback(() => {
    setCoords(null)
  }, [])

  return (
    <div className="map-panel">
      <Map
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 1.8 }}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
      {coords && (
        <div className="map-coords">
          {coords.lat.toFixed(4)}° {coords.lat >= 0 ? 'N' : 'S'} &nbsp;
          {Math.abs(coords.lng).toFixed(4)}° {coords.lng >= 0 ? 'E' : 'W'}
        </div>
      )}
    </div>
  )
}
