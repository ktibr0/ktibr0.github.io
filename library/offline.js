(function (global) {
  "use strict";
  const CACHE_NAME = 'papergames-mirror-20261016-v1';
  const EXPECTED = [
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

  async function isReady() {
    if (!('caches' in global)) return false;
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration('/papergames/');
    if (!registration || !registration.active || registration.active.state !== 'activated' || new URL(registration.scope).pathname !== '/papergames/') return false;
    const keys = await caches.keys();
    if (!keys.includes(CACHE_NAME)) return false;
    const cache = await caches.open(CACHE_NAME);
    for (const url of EXPECTED) if (!await cache.match(url, {ignoreSearch: true})) return false;
    return true;
  }

  async function renderStatus(status, button) {
    if (!status) return;
    try {
      if (await isReady()) {
        status.dataset.state = 'ready';
        status.textContent = 'Семь игр, правила и каталог уже сохранены. Их можно открыть из Игротеки без сети.';
      } else if (!('serviceWorker' in navigator) || !('caches' in global)) {
        status.dataset.state = 'unsupported';
        status.textContent = 'Офлайн-сохранение недоступно в этом браузере.';
        if (button) button.disabled = true;
      } else {
        status.dataset.state = 'idle';
        status.textContent = 'Офлайн-копия ещё не сохранена. Нажмите кнопку, пока есть интернет.';
      }
    } catch (_) {
      status.dataset.state = 'error';
      status.textContent = 'Не удалось проверить офлайн-копию. Повторите попытку при подключении к интернету.';
    }
  }

  global.PaperGamesOffline = {cacheName: CACHE_NAME, urls: EXPECTED.slice(), isReady: isReady};
  document.addEventListener('DOMContentLoaded', function () {
    const status = document.getElementById('library-offline-status');
    const button = document.getElementById('library-offline-save');
    renderStatus(status, button);
    if (button) button.addEventListener('click', function () {
      if (global.ForceUpdate) global.ForceUpdate.run(status, button);
    });
  });
})(window);
