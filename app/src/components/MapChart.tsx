'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AppUser } from '@/lib/types'

interface MapChartProps {
  appUser: AppUser
}

export default function MapChart({ appUser }: MapChartProps) {
  const [geoData, setGeoData] = useState<any>(null)
  const isSuperAdmin = appUser?.role === 'superadmin'

  useEffect(() => {
    // Muat GeoJSON berdasarkan role
    const fileName = isSuperAdmin ? '/puskesmas_fix.geojson' : '/desa_fix.geojson'
    fetch(fileName)
      .then((res) => res.json())
      .then((data) => {
        // Jika Admin Puskesmas, filter GeoJSON agar hanya menampilkan desanya
        if (!isSuperAdmin && appUser?.puskesmas_id) {
           // Asumsi properti nama puskesmas ada di geojson, tapi kita bisa tampilkan saja semua desa dan highlight, atau filter.
           // Untuk saat ini tampilkan data geojson default. Nanti bisa difilter jika ada properti puskesmas_id di dalamnya.
           setGeoData(data)
        } else {
           setGeoData(data)
        }
      })
      .catch(err => console.error("Error loading geojson", err))
  }, [isSuperAdmin, appUser?.puskesmas_id])

  const getColor = (iksScore: number) => {
    if (iksScore >= 80) return '#10b981' // Green
    if (iksScore >= 50) return '#f59e0b' // Yellow
    return '#ef4444' // Red
  }

  const styleFeature = (feature: any) => {
    // Simulasi nilai IKS random untuk visualisasi jika belum ada API agregasi
    // Nantinya kita bisa me-lookup ke data agregasi sungguhan berdasarkan ID/Nama desa
    const mockIks = Math.floor(Math.random() * 100)
    
    return {
      fillColor: getColor(mockIks),
      weight: 1,
      opacity: 1,
      color: 'white',
      fillOpacity: 0.7
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties?.NAMOBJ || feature.properties?.Puskesmas || 'Unknown Region'
    layer.bindPopup(`<b>${name}</b><br/>Estimasi IKS: Sekitar 50-100%`)
  }

  if (!geoData) {
    return <div className="w-full h-[400px] bg-gray-100 rounded-xl flex items-center justify-center animate-pulse">Memuat Peta...</div>
  }

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden shadow-sm border border-gray-100 relative z-0">
      <MapContainer 
        center={[-8.1333, 112.5667]} // Titik tengah estimasi Kab Malang
        zoom={9} 
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON 
          data={geoData} 
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
    </div>
  )
}
