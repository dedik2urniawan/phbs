const CACHE_NAME = 'sim-phbs-v2'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/entry',
  '/manifest.json',
  '/promkes.png'
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

// Fetch: network-first for API, network-first for navigation, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin && !url.hostname.includes('supabase.co')) return

  // For API calls (supabase), always go network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    return
  }

  // For navigation requests (HTML), Network First with Cache Fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then(cached => {
            if (cached) return cached;
            return caches.match('/entry'); // Fallback to /entry if possible
        }))
    )
    return
  }

  // For static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        // ignore fetch error in swr
      })
      return cached || fetchPromise
    })
  )
})
