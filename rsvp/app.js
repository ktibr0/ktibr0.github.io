(() => {
  "use strict";

  const frame = document.querySelector("#player-frame");
  const container = document.querySelector("#player");
  const cover = document.querySelector("#cover");
  const coverMessage = document.querySelector("#cover-message");
  const status = document.querySelector("#status");
  const startButton = document.querySelector("#start");
  const retryButton = document.querySelector("#retry");
  const soundButton = document.querySelector("#sound");
  const fullscreenButton = document.querySelector("#fullscreen");

  let player = null;
  let loading = false;
  let muted = false;
  let lastVolume = 1;
  let loadToken = 0;
  let timeoutId = 0;
  let ratio = 6 / 5;
  let request = null;

  function fitPlayer() {
    if (document.fullscreenElement === frame) return;
    const card = frame.parentElement;
    const css = getComputedStyle(card);
    const width = card.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const actions = document.querySelector('.game-actions');
    const available = Math.max(100, (window.visualViewport?.height || innerHeight) - frame.getBoundingClientRect().top - actions.getBoundingClientRect().height - parseFloat(css.paddingBottom) - 18);
    frame.style.width = Math.floor(Math.min(width, available * ratio, 900)) + 'px';
    frame.style.aspectRatio = String(ratio);
  }
  window.addEventListener('resize', fitPlayer);
  window.visualViewport?.addEventListener('resize', fitPlayer);
  document.addEventListener('fullscreenchange', fitPlayer);
  document.querySelector('#exit-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => setStatus('Для выхода используйте кнопку браузера.'));
  });
  new ResizeObserver(fitPlayer).observe(document.querySelector('.game-heading'));
  fitPlayer();

  function setStatus(message) {
    status.textContent = message;
  }

  function showFailure(message) {
    loading = false;
    window.clearTimeout(timeoutId);
    request?.abort();
    startButton.hidden = true;
    retryButton.hidden = false;
    soundButton.disabled = true;
    fullscreenButton.disabled = true;
    cover.hidden = false;
    coverMessage.textContent = message;
    setStatus(message);
    fitPlayer();
  }

  function applyMetadata() {
    if (!player || !player.metadata) return false;
    const metadata = player.metadata;
    const width = Number(metadata.width);
    const height = Number(metadata.height);
    if (width > 0 && height > 0) { ratio = width / height; fitPlayer(); }
    return true;
  }

  function handleLoaded(token) {
    if (token !== loadToken || !loading) return;
    loading = false;
    window.clearTimeout(timeoutId);
    applyMetadata();
    cover.hidden = true;
    startButton.hidden = true;
    retryButton.hidden = true;
    soundButton.disabled = false;
    fullscreenButton.disabled = false;
    setStatus("Игра загружена. Карты переставляются двумя касаниями: карта → место за столом.");
    fitPlayer();
  }

  async function startGame() {
    if (loading) return;
    if (!window.RufflePlayer || typeof window.RufflePlayer.newest !== "function") {
      showFailure("Не удалось запустить игровой модуль. Проверьте соединение и попробуйте ещё раз.");
      return;
    }

    loading = true;
    const token = ++loadToken;
    startButton.hidden = true;
    retryButton.hidden = true;
    soundButton.disabled = true;
    fullscreenButton.disabled = true;
    cover.hidden = false;
    coverMessage.textContent = "Загружаем игру… Это может занять несколько секунд.";
    setStatus("Загружаем игру…");
    container.replaceChildren();

    try {
      const ruffle = window.RufflePlayer.newest();
      player = ruffle.createPlayer();
      player.setAttribute("aria-label", "Игровое поле RSVP");
      player.style.width = "100%";
      player.style.height = "100%";
      container.appendChild(player);

      player.addEventListener("loadedmetadata", () => {
        if (token !== loadToken) return;
        applyMetadata();
        handleLoaded(token);
      });
      player.addEventListener("error", () => {
        if (token === loadToken) showFailure("Игра не загрузилась. Попробуйте ещё раз.");
      });

      timeoutId = window.setTimeout(() => {
        if (token === loadToken && loading) showFailure("Загрузка затянулась. Проверьте соединение и попробуйте ещё раз.");
      }, 45000);

      // Fetch explicitly so an HTTP failure becomes a shell error immediately.
      request = new AbortController();
      const response = await fetch('rsvp.swf', {signal: request.signal});
      if (!response.ok) throw new Error('SWF HTTP ' + response.status);
      const data = new Uint8Array(await response.arrayBuffer());
      if (token !== loadToken || !loading) return;
      const result = player.load({data, swfFileName: 'rsvp.swf'});
      if (result && typeof result.then === "function") {
        await result;
      }
      player.volume = muted ? 0 : lastVolume;

      // Some Ruffle builds expose load completion through the movie metadata event.
      const metadataPoll = window.setInterval(() => {
        if (token !== loadToken || !loading) {
          window.clearInterval(metadataPoll);
          return;
        }
        if (applyMetadata()) {
          window.clearInterval(metadataPoll);
          handleLoaded(token);
        }
      }, 250);
    } catch (error) {
      if (token === loadToken) showFailure("Не удалось загрузить игру. Попробуйте ещё раз.");
    }
  }

  startButton.addEventListener("click", startGame);
  retryButton.addEventListener("click", startGame);

  soundButton.addEventListener("click", () => {
    if (!player) return;
    try {
      if (muted) {
        player.volume = lastVolume || 1;
      } else {
        const currentVolume = Number(player.volume);
        if (currentVolume > 0) lastVolume = currentVolume;
        player.volume = 0;
      }
      muted = !muted;
      soundButton.textContent = muted ? "Звук: выкл." : "Звук: вкл.";
      soundButton.setAttribute("aria-pressed", String(muted));
      setStatus(muted ? "Звук выключен." : "Звук включён.");
    } catch (error) {
      setStatus("Управление звуком недоступно в этом браузере.");
    }
  });

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else if (player && typeof player.requestFullscreen === "function") {
        player.requestFullscreen();
      } else {
        setStatus("Полноэкранный режим не поддерживается этим браузером.");
      }
    } catch (error) {
      setStatus("Браузер не разрешил полноэкранный режим. Игра продолжает работать в окне.");
    }
  });
})();
