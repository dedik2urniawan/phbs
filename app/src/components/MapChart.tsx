'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { AppUser } from '@/lib/types'

// Kabupaten Malang approximate bounding box (SW, NE) — used to lock map panning
const KAB_MALANG_BOUNDS: L.LatLngBoundsExpression = [
  [-9.05, 111.85],  // SW corner (south-west Kab. Malang)
  [-7.55, 113.10],  // NE corner (north-east Kab. Malang)
]

interface MapChartProps {
  appUser: AppUser
  selectedIndicator: string
  selectedIndicatorLabel: string
  selectedPuskesmas: string
  puskesmasList?: any[]
  regionalScores?: Record<string, { score: number, total: number }>
}

// Normalize string for fuzzy matching: lowercase, trim, collapse spaces
function normalize(s: string): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Fuzzy lookup for regionalScores keys — handles minor DB vs GeoJSON name mismatches
function findScore(
  regionName: string,
  scores: Record<string, { score: number, total: number }>
): { score: number, total: number } | undefined {
  if (!regionName) return undefined
  
  // 1. Exact match
  if (scores[regionName]) return scores[regionName]
  
  // 2. Case-insensitive / whitespace-normalized match
  const normRegion = normalize(regionName)
  for (const [key, value] of Object.entries(scores)) {
    if (normalize(key) === normRegion) return value
  }
  
  // 3. Contains match (e.g. "Puskesmas Gondanglegi" vs "Gondanglegi")
  for (const [key, value] of Object.entries(scores)) {
    const normKey = normalize(key)
    if (normKey.includes(normRegion) || normRegion.includes(normKey)) return value
  }
  
  return undefined
}

// Leaflet sub-component: auto fit-bounds whenever geoData changes
function FitBounds({ geoData }: { geoData: any }) {
  const map = useMap()
  const prevKey = useRef<string>('')

  useEffect(() => {
    if (!geoData?.features?.length) {
      // No features — fall back to Kabupaten Malang full view
      map.fitBounds(KAB_MALANG_BOUNDS as L.LatLngBoundsExpression, { animate: true })
      return
    }

    // Build a unique key from feature count + first feature name to detect real changes
    const firstName =
      geoData.features[0]?.properties?.nama_puskesmas ||
      geoData.features[0]?.properties?.nama_desa ||
      ''
    const key = `${geoData.features.length}::${firstName}`
    if (key === prevKey.current) return
    prevKey.current = key

    try {
      const layer = L.geoJSON(geoData)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        // Pad slightly and never zoom in beyond level 14
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14, animate: true })
      } else {
        map.fitBounds(KAB_MALANG_BOUNDS as L.LatLngBoundsExpression, { animate: true })
      }
    } catch {
      map.fitBounds(KAB_MALANG_BOUNDS as L.LatLngBoundsExpression, { animate: true })
    }
  }, [geoData, map])

  return null
}

// Color scale: 5-level gradient for IKS/indicator percentage
function getColor(score: number): string {
  if (score >= 80) return '#059669'  // emerald-600 — Sangat Baik
  if (score >= 60) return '#34d399'  // emerald-400 — Baik
  if (score >= 40) return '#fbbf24'  // amber-400   — Cukup
  if (score >= 20) return '#f97316'  // orange-500  — Kurang
  return '#ef4444'                   // red-500     — Sangat Kurang
}

// Leaflet sub-component: exposes map.fitBounds to a ref so parent can call it
function ResetViewControl({ resetRef }: { resetRef: React.MutableRefObject<(() => void) | null> }) {
  const map = useMap()
  useEffect(() => {
    resetRef.current = () => {
      map.fitBounds(KAB_MALANG_BOUNDS as L.LatLngBoundsExpression, { animate: true, duration: 0.6 })
    }
  }, [map, resetRef])
  return null
}

const LEGEND_ITEMS = [
  { color: '#059669', label: '≥ 80% (Sangat Baik)' },
  { color: '#34d399', label: '60–79% (Baik)' },
  { color: '#fbbf24', label: '40–59% (Cukup)' },
  { color: '#f97316', label: '20–39% (Kurang)' },
  { color: '#ef4444', label: '< 20% (Sangat Kurang)' },
  { color: '#d1d5db', label: 'Belum ada data' },
]

export default function MapChart({
  appUser,
  selectedIndicator,
  selectedIndicatorLabel,
  selectedPuskesmas,
  puskesmasList = [],
  regionalScores = {},
}: MapChartProps) {
  const [rawGeoData, setRawGeoData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isPuskesmasLevel = selectedPuskesmas === 'all'
  const resetViewRef = useRef<(() => void) | null>(null)

  // Load the correct GeoJSON file based on view level
  useEffect(() => {
    setIsLoading(true)
    setRawGeoData(null)
    const fileName = isPuskesmasLevel ? '/puskesmas_fix.geojson' : '/desa_fix.geojson'
    fetch(fileName)
      .then((res) => res.json())
      .then((data) => {
        setRawGeoData(data)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Error loading GeoJSON:', err)
        setIsLoading(false)
      })
  }, [isPuskesmasLevel])

  // Compute filtered/unfiltered GeoJSON features
  const geoData = useMemo(() => {
    if (!rawGeoData) return null

    // Superadmin + all puskesmas → show full puskesmas_fix.geojson
    if (isPuskesmasLevel) return rawGeoData

    // Specific puskesmas selected → filter desa_fix.geojson by puskesmas name
    const activePObj = puskesmasList.find(
      (p) => String(p.id) === String(selectedPuskesmas)
    )
    const activeName = activePObj?.nama || ''

    if (!activeName) return rawGeoData  // fallback: show all desas

    const normTarget = normalize(activeName)
    const filteredFeatures = rawGeoData.features.filter((f: any) => {
      const geoName = normalize(f.properties?.nama_puskesmas || '')
      return (
        geoName === normTarget ||
        geoName.includes(normTarget) ||
        normTarget.includes(geoName)
      )
    })

    // CRITICAL: if filter returns 0, fall back to all desas so map always shows polygons
    if (filteredFeatures.length === 0) {
      console.warn(`MapChart: no desas matched for puskesmas "${activeName}" — showing all desas`)
      return rawGeoData
    }

    return { ...rawGeoData, features: filteredFeatures }
  }, [rawGeoData, isPuskesmasLevel, selectedPuskesmas, puskesmasList])

  // Style each GeoJSON feature based on live regionalScores
  const styleFeature = (feature: any) => {
    const regionName = isPuskesmasLevel
      ? (feature.properties?.nama_puskesmas as string)
      : (feature.properties?.nama_desa as string)

    const data = findScore(regionName, regionalScores)
    const hasData = data !== undefined && data.total > 0

    return {
      fillColor: hasData ? getColor(data!.score) : '#d1d5db',
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: hasData ? 0.82 : 0.55,   // always visible, colored or gray
    }
  }

  // Interactive popups and hover effects
  const onEachFeature = (feature: any, layer: any) => {
    const regionName = isPuskesmasLevel
      ? (feature.properties?.nama_puskesmas as string)
      : (feature.properties?.nama_desa as string)

    const data = findScore(regionName, regionalScores)
    const hasData = data !== undefined && data.total > 0

    const scoreHtml = hasData
      ? `<strong style="font-size:15px;color:${getColor(data!.score)}">${data!.score}%</strong>
         <br/><span style="color:#6b7280;font-size:11px">${data!.total} KK disurvei</span>`
      : `<span style="color:#9ca3af;font-size:11px;font-style:italic">Belum ada data survei</span>`

    layer.bindPopup(
      `<div style="font-family:system-ui,sans-serif;min-width:170px;line-height:1.6">
        <div style="font-weight:700;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;padding-bottom:5px;margin-bottom:6px">${regionName}</div>
        <div style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:3px">${selectedIndicatorLabel}</div>
        ${scoreHtml}
      </div>`,
      { maxWidth: 210 }
    )

    layer.on({
      mouseover: () => {
        layer.setStyle({ weight: 2.5, color: '#2563eb', fillOpacity: 0.95 })
        layer.bringToFront()
      },
      mouseout: () => {
        layer.setStyle(styleFeature(feature))
      },
    })
  }

  // Lightweight key: only re-mount GeoJSON layer when indicator, puskesmas, or score set changes
  const geoJsonKey = useMemo(() => {
    const scoreKeys = Object.keys(regionalScores).sort().join(',')
    const scoreVals = Object.values(regionalScores).map(v => v.score).join(',')
    return `${selectedPuskesmas}|${selectedIndicator}|${scoreKeys}|${scoreVals}`
  }, [selectedPuskesmas, selectedIndicator, regionalScores])

  // ---- Render states ----
  if (isLoading) {
    return (
      <div className="w-full h-[450px] bg-gray-50 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Memuat data peta spasial...</p>
        </div>
      </div>
    )
  }

  if (!geoData) {
    return (
      <div className="w-full h-[450px] bg-gray-50 rounded-xl flex items-center justify-center">
        <p className="text-sm text-gray-400">Data peta tidak tersedia</p>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ height: '450px' }}>
      {/* Leaflet Map — inline style required for height in Next.js */}
      <MapContainer
        center={[-8.1333, 112.5667]}
        zoom={10}
        scrollWheelZoom={false}
        dragging={true}
        maxBounds={KAB_MALANG_BOUNDS}
        maxBoundsViscosity={1.0}
        minZoom={9}
        maxZoom={17}
        style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={geoJsonKey}
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
        <FitBounds geoData={geoData} />
        <ResetViewControl resetRef={resetViewRef} />
      </MapContainer>

      {/* Top-left: Area level badge */}
      <div
        className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-1.5 flex items-center gap-2"
        style={{ zIndex: 1000 }}
      >
        <div className={`w-2 h-2 rounded-full ${isPuskesmasLevel ? 'bg-blue-500' : 'bg-emerald-500'}`} />
        <span className="text-[11px] font-semibold text-gray-700">
          {isPuskesmasLevel ? 'Tingkat Kabupaten' : 'Tingkat Puskesmas'}
        </span>
      </div>

      {/* Top-right: Reset View button + scroll hint */}
      <div
        className="absolute top-3 right-3 flex flex-col items-end gap-1.5"
        style={{ zIndex: 1000 }}
      >
        <button
          onClick={() => resetViewRef.current?.()}
          className="bg-white/90 backdrop-blur-sm hover:bg-white border border-gray-200 shadow-md rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-700 flex items-center gap-1.5 transition-all hover:shadow-lg active:scale-95"
          title="Reset ke tampilan penuh Kabupaten Malang"
        >
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Reset View
        </button>
        <span className="bg-black/40 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm">
          Gunakan +/− untuk zoom
        </span>
      </div>

      {/* Legend — outside MapContainer so it sits above Leaflet's z-index stack */}
      <div
        className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-3"
        style={{ zIndex: 1000 }}
      >
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 truncate max-w-[140px]">
          {selectedIndicatorLabel}
        </p>
        {LEGEND_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
            <div
              className="w-4 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-600 font-medium whitespace-nowrap">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
