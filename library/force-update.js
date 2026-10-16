(function (global) {
  "use strict";

  function setStatus(status, state, message) {
    if (!status) return;
    status.dataset.state = state;
    status.textContent = message;
  }

  async function registration() {
    if (!('serviceWorker' in navigator)) throw new Error('Этот браузер не поддерживает офлайн-режим.');
    if (global.PaperGamesRegister && typeof global.PaperGamesRegister.register === 'function') {
      return global.PaperGamesRegister.register();
    }
    return navigator.serviceWorker.register('/papergames/sw.js', {scope: '/papergames/'});
  }

  function waitForActivation(reg, timeoutMs, observedWorker) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      let observed = observedWorker || reg.installing || reg.waiting;
      let skipSent = false;
      const poll = () => {
        const worker = reg.installing || reg.waiting;
        if (worker) observed = worker;
        if (worker && worker.state === 'installed' && reg.waiting && !skipSent) {
          skipSent = true;
          reg.waiting.postMessage({type: 'SKIP_WAITING'});
        }
        if ((worker && worker.state === 'redundant') || (observed && observed.state === 'redundant')) return reject(new Error('Офлайн-копию не удалось установить. Проверьте соединение и повторите попытку.'));
        if (observed && observed.state === 'activated') return resolve(reg);
        if (reg.active && reg.active.state === 'activated' && !worker) return resolve(reg);
        if (Date.now() >= deadline) return reject(new Error('Установка офлайн-копии заняла слишком много времени. Проверьте соединение и повторите попытку.'));
        setTimeout(poll, 60);
      };
      poll();
    });
  }

  async function run(status, button) {
    if (button) button.disabled = true;
    setStatus(status, 'saving', 'Сохраняем игры и правила для офлайн-режима…');
    try {
      const reg = await registration();
      if (reg.waiting) reg.waiting.postMessage({type: 'SKIP_WAITING'});
      if (reg.installing || !reg.active) await waitForActivation(reg, 45000, reg.installing);
      else {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage({type: 'SKIP_WAITING'});
        if (reg.installing || reg.waiting) await waitForActivation(reg, 45000, reg.installing || reg.waiting);
      }
      if (global.PaperGamesOffline && !(await global.PaperGamesOffline.isReady())) {
        throw new Error('Не все файлы офлайн-копии сохранены. Проверьте соединение и повторите попытку.');
      }
      setStatus(status, 'ready', 'Семь игр, правила и каталог сохранены. Их можно открыть из Игротеки без сети.');
      return true;
    } catch (error) {
      setStatus(status, 'error', error && error.message ? error.message : 'Не удалось сохранить офлайн-копию. Проверьте соединение и повторите попытку.');
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  global.ForceUpdate = {run: run};
})(window);
