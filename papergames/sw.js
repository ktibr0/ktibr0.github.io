/* PaperGames mirror worker. Its registration scope is /papergames/ only. */
const CACHE_NAME = 'papergames-mirror-20261016-v1';
const CACHE_PREFIX = 'papergames-mirror-';
const PRECACHE_URLS = [
  '/papergames/index.html','/papergames/credits.html','/papergames/manifest.json','/papergames/sw.js','/papergames/sw-register.js',
  '/papergames/sudoku.html','/papergames/sudoku-rules.html','/papergames/nonogram.html','/papergames/nonogram-rules.html',
  '/papergames/kakuro.html','/papergames/kakuro-rules.html','/papergames/hashi.html','/papergames/hashi-rules.html',
  '/papergames/skyscrapers.html','/papergames/skyscrapers-rules.html','/papergames/klondike.html','/papergames/klondike-rules.html',
  '/papergames/freecell.html','/papergames/freecell-rules.html',
  '/papergames/sudoku-app.js','/papergames/sudoku-core.js','/papergames/nonogram-app.js','/papergames/nonogram-core.js','/papergames/nonogram-puzzles.js',
  '/papergames/kakuro-app.js','/papergames/kakuro-core.js','/papergames/kakuro-puzzles.js','/papergames/hashi-app.js','/papergames/hashi-core.js','/papergames/hashi-puzzles.js',
  '/papergames/skyscrapers-app.js','/papergames/skyscrapers-core.js','/papergames/skyscrapers-puzzles.js','/papergames/klondike-app.js','/papergames/klondike-core.js','/papergames/freecell-app.js','/papergames/freecell-core.js',
  '/papergames/ai-pacing.js','/papergames/board-a11y.js','/papergames/card-faces.js','/papergames/confirm-actions.js','/papergames/daily-challenge.js',
  '/papergames/density.js','/papergames/error-banner.js','/papergames/font-size-toggle.js','/papergames/game-stats.js','/papergames/game-storage.js',
  '/papergames/high-contrast.js','/papergames/hint-engine.js','/papergames/i18n.js','/papergames/print-puzzle.js','/papergames/quick-rules.js',
  '/papergames/random-start.js','/papergames/result-modal.js','/papergames/rules-link.js','/papergames/settings-menu.js','/papergames/storage-warning.js',
  '/papergames/style.css','/papergames/favicon.png','/papergames/icon-192.png','/papergames/LICENSE','/papergames/NOTICE',
  '/papergames/i18n-text.js','/papergames/lang/ru.js','/papergames/lang/ru-text.js',
  '/library/catalog.css','/library/papergames-game.css','/library/force-update.js','/library/offline.js'
];
const SHARED_ALLOWED = new Set(['/library/catalog.css','/library/papergames-game.css','/library/force-update.js','/library/offline.js']);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE_URLS);
      const cached = await cache.keys();
      if (cached.length !== PRECACHE_URLS.length) throw new Error('Offline precache incomplete');
    } catch (error) {
      // Keep any prior complete package intact. A later save retries every URL;
      // the status checker reports ready only when the full manifest is present.
      throw error;
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const inApp = url.pathname.startsWith('/papergames/');
  if (!inApp && !SHARED_ALLOWED.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (error) {
      if (inApp && request.mode === 'navigate') {
        const mirror = await cache.match('/papergames/index.html');
        if (mirror) return mirror;
      }
      throw error;
    }
  })());
});
