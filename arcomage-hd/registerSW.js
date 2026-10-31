if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/arcomage-hd/sw.js', { scope: '/arcomage-hd/' })
      .catch((error) => console.error('ArcoMage service worker registration failed:', error));
  });
}
