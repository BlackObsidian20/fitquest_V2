// FitQuest offline support.
// Keeps a copy of the app on the phone so it opens with no signal (e.g. in a basement gym).
// The app page is checked online first so updates you push to GitHub show up on the next launch;
// if there's no answer within 3 seconds, the saved copy opens instead.
// Your workout data is NOT stored here — it lives in the app's own on-device storage.

const CACHE = 'fitquest-v1';   // change this name to force every phone to re-download icons/manifest
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(ms, promise) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;  // fonts etc. go straight to the network

  if (req.mode === 'navigate') {
    // App page: newest version when online, saved copy when offline or slow
    event.respondWith(
      withTimeout(3000, fetch(req))
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Icons and manifest: saved copy first, network as backup
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
