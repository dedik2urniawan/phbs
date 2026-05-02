import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SIM-PHBS Kabupaten Malang',
    short_name: 'SIM-PHBS',
    description: 'Sistem Informasi Manajemen PHBS Kabupaten Malang',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#064e3b',
    theme_color: '#059669',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
