const CACHE = 'eduai-waec-v4';
const STATIC = ['/', '/index.html', '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  // For Anthropic API calls - don't cache, just pass through with timeout
  if (e.request.url.includes('api.anthropic.com')) {
    e.respondWith(
      Promise.race([
        fetch(e.request.clone()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]).catch(err => {
        // Return an error response that the app can handle
        return new Response(JSON.stringify({
          error: { type: 'network_error', message: err.message === 'timeout' ? 'Request timed out. Please try again.' : 'Network error. Please check your connection.' }
        }), {
          status: 503,
          headers: {'Content-Type': 'application/json'}
        });
      })
    );
    return;
  }
  
  // For other requests - cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method==='GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => {
      // Return cached version or a simple offline page
      return cached || new Response('Offline', {status: 503});
    }))
  );
});

self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') e.waitUntil(Promise.resolve());
});
