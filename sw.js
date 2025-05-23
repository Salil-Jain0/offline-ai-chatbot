const CACHE_NAME = 'offline-chatbot-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/chatbot.js',
    '/src/llama-worker.js',
    '/src/model-downloader.js',
    '/src/wasm-optimizer.js',
    '/wasm/main.wasm',
    '/wasm/main.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            }
        )
    );
});