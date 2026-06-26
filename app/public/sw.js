// CACHE VERSION — bump ini setiap kali ada deployment besar untuk invalidate semua cache lama
const CACHE_NAME = 'sim-phbs-v3'

const STATIC_ASSETS = [
  '/manifest.json',
  '/promkes.png',
]

// Install: pre-cache minimal assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Activate: delete ALL old caches immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3, clearing old caches...')
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting old cache:', key)
          return caches.delete(key)
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch strategy per resource type
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // ── Supabase API: always network, never cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    )
    return
  }

  // ── Next.js RSC (Server Component) requests: Network-First with offline fallback
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Skip cross-origin requests (CDNs, tile servers, etc.)
  if (url.origin !== self.location.origin) return

  // ── Next.js JS/CSS chunks: Network-First (CRITICAL — prevents hydration mismatch)
  // These files change on every deployment. Always fetch fresh from network.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request)) // fallback to cache only if network fails
    )
    return
  }

  // ── HTML navigation: Network-First with offline fallback
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached
            return caches.match('/entry') // offline fallback untuk surveyor
          })
        )
    )
    return
  }

  // ── Static assets (images, fonts, geojson): Stale-While-Revalidate
  // Gambar & GeoJSON boleh dari cache, update di background
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => undefined)

      return cached || fetchPromise
    })
  )
})
