// A minimal service worker to satisfy PWABuilder installation requirements
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Basic pass-through fetch handler
    event.respondWith(fetch(event.request));
});
