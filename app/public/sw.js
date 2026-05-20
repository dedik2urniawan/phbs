self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(self.clients.claim());
});

// A fetch listener is required by Chromium to trigger the PWA install prompt.
self.addEventListener('fetch', (event) => {
  // Let the browser do its default thing for now.
  // The offline logic is handled by Dexie, so we don't strictly need to cache HTML here just for the install prompt.
});
