(function (global) {
  "use strict";
  const SCOPE = '/papergames/';
  const SCRIPT = '/papergames/sw.js';
  global.PaperGamesRegister = {
    register: function () {
      if (!('serviceWorker' in navigator)) return Promise.reject(new Error('Этот браузер не поддерживает офлайн-режим.'));
      return navigator.serviceWorker.register(SCRIPT, {scope: SCOPE});
    }
  };
})(window);
