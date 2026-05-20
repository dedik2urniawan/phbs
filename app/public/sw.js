const CACHE_NAME = 'sim-phbs-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/promkes.png',
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin except supabase
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin && !url.hostname.includes('supabase.co')) return

  // For API calls (supabase), always go network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    return
  }

  // For static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Only cache successful responses for static assets
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => cached || new Response('Not found', { status: 404 }))
    })
  )
})
