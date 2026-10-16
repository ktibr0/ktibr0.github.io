(function () {
  "use strict";
  const Game = window.SumpleteGame;
  const Generator = window.SumpleteGenerator;
  const SAVE_KEY = "sumplete.save.v1";
  const LEGACY_KEY = "loadgame";
  const byId = id => document.getElementById(id);
  const status = byId("status");
  const storageStatus = byId("storage-status");
  const grid = byId("grid");
  const boardScroll = byId("board-scroll");
  let save;
  let activeMode = "cycle";
  let selectedIndex = null;
  let storageFailed = false;
  let savedDataNotice = "";
  let ratedPuzzle = null;
  let cachedLogicRating = "";

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function setStatus(message) { status.textContent = message || ""; }
  function storageWarning(message) {
    storageFailed = true;
    storageStatus.textContent = message || "Не удалось сохранить партию в этом браузере. Играть можно, но после закрытия вкладки прогресс может потеряться.";
  }
  function safeGet(key) {
    try { return { ok: true, value: localStorage.getItem(key) }; }
    catch (_) { storageWarning(); return { ok: false, value: null }; }
  }
  function safeWrite(value) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(value));
      storageFailed = false;
      storageStatus.textContent = savedDataNotice;
      return true;
    } catch (_) {
      storageWarning("Не удалось сохранить партию (возможно, хранилище браузера заполнено или запрещено). Игра продолжится без надёжного сохранения.");
      return false;
    }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { storageWarning(); return false; }
  }

  function makeSave(puzzle, states, history, revealed) {
    return { version: 1, puzzle, states, history: history || [], revealed: !!revealed };
  }
  function isUnsavedProgress() {
    return save.states.some((v, i) => v !== save.puzzle.initial[i]) || save.history.length > 0 || save.revealed;
  }

  function parseLegacy(html) {
    if (typeof html !== "string" || html.length > 250000) return null;
    let doc;
    try { doc = new DOMParser().parseFromString(html, "text/html"); }
    catch (_) { return null; }
    const numbers = Array.from(doc.querySelectorAll(".grid .number"));
    const rowCells = Array.from(doc.querySelectorAll(".grid .hanswer"));
    const columnCells = Array.from(doc.querySelectorAll(".grid .vanswer"));
    const diagonalCell = doc.querySelector(".grid .canswer");
    const size = rowCells.length;
    if (!Number.isInteger(size) || size < 3 || size > 9 || numbers.length !== size * size || columnCells.length !== size || !diagonalCell) return null;
    const numberValues = numbers.map(cell => Number(cell.textContent.trim()));
    const rowTargets = rowCells.map(cell => Number(cell.textContent.trim()));
    const columnTargets = columnCells.map(cell => Number(cell.textContent.trim()));
    const diagonalTarget = Number(diagonalCell.textContent.trim());
    if (numberValues.some(v => !Number.isInteger(v) || v < 1 || v > 9) ||
        [...rowTargets, ...columnTargets, diagonalTarget].some(v => !Number.isSafeInteger(v) || v < 0)) return null;
    const states = numbers.map(cell => cell.classList.contains("delete") ? -1 : cell.classList.contains("circle") ? 1 : 0);
    const puzzle = {
      size,
      numbers: Array.from({ length: size }, (_, r) => numberValues.slice(r * size, (r + 1) * size)),
      rowTargets, columnTargets, diagonalTarget, initial: Array(size * size).fill(0)
    };
    const revealedElement = doc.querySelector(".revealed");
    const revealed = !!revealedElement && !revealedElement.classList.contains("hidden");
    try {
      Game.validatePuzzle(puzzle);
      Game.validateSave(makeSave(puzzle, states, [], revealed));
      return makeSave(puzzle, states, [], revealed);
    } catch (_) { return null; }
  }

  function createPuzzle(size) {
    const puzzle = Generator.generate(size);
    save = makeSave(puzzle, puzzle.initial.slice(), [], false);
    const notice = byId("generation-notice");
    if (puzzle.generation === "fallback") {
      notice.textContent = "Создано простое поле по гарантированно разрешимой схеме.";
      notice.classList.remove("hidden");
    } else {
      notice.textContent = "";
      notice.classList.add("hidden");
    }
    safeWrite(save);
    render();
  }

  function loadGame() {
    const current = safeGet(SAVE_KEY);
    if (current.ok && current.value !== null) {
      try {
        const parsed = JSON.parse(current.value);
        Game.validateSave(parsed);
        save = parsed;
        byId("size").value = String(save.puzzle.size);
        render();
        return;
      } catch (_) {
        savedDataNotice = "Сохранённая партия повреждена. Начата новая партия.";
        storageWarning(savedDataNotice);
      }
    } else if (current.ok) {
      const legacy = safeGet(LEGACY_KEY);
      if (legacy.ok && legacy.value !== null) {
        const migrated = parseLegacy(legacy.value);
        if (migrated) {
          save = migrated;
          byId("size").value = String(save.puzzle.size);
          if (safeWrite(save)) safeRemove(LEGACY_KEY);
          else setStatus("Старая партия загружена, но миграцию сохранить не удалось. Старое сохранение оставлено.");
          render();
          return;
        }
        setStatus("Старое сохранение не распознано. Оно оставлено без изменений; начата новая партия.");
      }
    }
    createPuzzle(4);
  }

  function persist() {
    Game.validateSave(save);
    safeWrite(save);
  }
  function pushHistory() {
    save.history.push(save.states.slice());
    if (save.history.length > Game.MAX_HISTORY) save.history.splice(0, save.history.length - Game.MAX_HISTORY);
  }
  function currentSums() { return Game.targets(save.puzzle.numbers, save.states); }
  function fitBoard() {
    if (!save) return;
    const n = save.puzzle.size;
    const widthLimit = (boardScroll.clientWidth - 12 - n * 2) / (n + 1);
    const heightLimit = innerWidth > 760 ? (innerHeight - document.querySelector('header').offsetHeight - 90) / (n + 1) : 110;
    const cell = Math.max(44, Math.floor(Math.min(110, widthLimit, heightLimit)));
    grid.style.setProperty('--cell', cell + 'px');
    // Explicit tracks avoid stale intrinsic max-content sizing when both size
    // and the cell custom property change in the same rendering frame.
    grid.style.gridTemplateColumns = `repeat(${n + 1}, ${cell}px)`;
    grid.style.gridTemplateRows = `repeat(${n + 1}, ${cell}px)`;
    grid.style.width = ((n + 1) * cell + n * 2 + 8) + 'px';
  }
  window.addEventListener('resize', fitBoard);
  let observedBoardWidth = -1;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width === observedBoardWidth) return;
    observedBoardWidth = width;
    // Resize only after observer delivery; our own height changes need no fit.
    requestAnimationFrame(fitBoard);
  }).observe(boardScroll);

  function updateCompletion() {
    const solved = Game.isSolved(save.puzzle, save.states);
    byId("complete").classList.toggle("hidden", !solved || save.revealed);
    byId("revealed").classList.toggle("hidden", !save.revealed);
    byId("undo").disabled = save.history.length === 0;
  }

  function updateLogicRating() {
    if (ratedPuzzle !== save.puzzle) {
      ratedPuzzle = save.puzzle;
      try {
        const analysis = Game.analyzeLogic(save.puzzle, Array(save.puzzle.size * save.puzzle.size).fill(0), {
          maxPasses: save.puzzle.size * save.puzzle.size + 1,
          maxChecks: 180000,
          deadline: Date.now() + 80
        });
        if (analysis.exhausted || analysis.contradiction) cachedLogicRating = "Оценка логики временно недоступна.";
        else cachedLogicRating = analysis.solved ? "Прямые выводы по суммам" : "Совместный анализ нескольких сумм";
      } catch (_) {
        cachedLogicRating = "Оценка логики временно недоступна.";
      }
    }
    byId("logic-level").textContent = cachedLogicRating;
  }

  function render(focusIndex) {
    const n = save.puzzle.size;
    byId('generation-notice').classList.toggle('hidden', save.puzzle.generation !== 'fallback');
    byId('generation-notice').textContent = save.puzzle.generation === 'fallback' ? 'Создано простое поле с единственным решением.' : '';
    byId("size").value = String(n);
    grid.style.setProperty("--size", String(n));
    const sums = currentSums();
    const frag = document.createDocumentFragment();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const index = r * n + c;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell number";
        cell.dataset.index = String(index);
        cell.textContent = String(save.puzzle.numbers[r][c]);
        cell.setAttribute("aria-label", `Строка ${r + 1}, столбец ${c + 1}, число ${save.puzzle.numbers[r][c]}: ${save.states[index] === 1 ? "оставить" : save.states[index] === -1 ? "убрать" : "не отмечено"}`);
        cell.setAttribute("aria-pressed", String(save.states[index] !== 0));
        if (save.states[index] === 1) cell.classList.add("circle");
        if (save.states[index] === -1) cell.classList.add("delete");
        if (r === c) cell.classList.add('diagonal-cell');
        if (selectedIndex === index) cell.classList.add("selected");
        if (selectedIndex !== null) {
          if (Math.floor(selectedIndex / n) === r) cell.classList.add("row-selected");
          if (selectedIndex % n === c) cell.classList.add("column-selected");
        }
        frag.appendChild(cell);
      }
      const target = document.createElement("div");
      target.className = "cell target hanswer" + (sums.rowTargets[r] === save.puzzle.rowTargets[r] ? " correct" : "");
      target.innerHTML = `<span>${sums.rowTargets[r]}</span><small>цель ${save.puzzle.rowTargets[r]}</small>`;
      target.setAttribute("aria-label", `Сумма строки ${r + 1}: ${sums.rowTargets[r]}, цель ${save.puzzle.rowTargets[r]}`);
      frag.appendChild(target);
    }
    for (let c = 0; c < n; c++) {
      const target = document.createElement("div");
      target.className = "cell target vanswer" + (sums.columnTargets[c] === save.puzzle.columnTargets[c] ? " correct" : "");
      target.innerHTML = `<span>${sums.columnTargets[c]}</span><small>цель ${save.puzzle.columnTargets[c]}</small>`;
      target.setAttribute("aria-label", `Сумма столбца ${c + 1}: ${sums.columnTargets[c]}, цель ${save.puzzle.columnTargets[c]}`);
      frag.appendChild(target);
    }
    const diagonal = document.createElement("div");
    diagonal.className = "cell target canswer" + (sums.diagonalTarget === save.puzzle.diagonalTarget ? " correct" : "");
    diagonal.innerHTML = `<span>↘ ${sums.diagonalTarget}</span><small>цель ${save.puzzle.diagonalTarget}</small>`;
    diagonal.setAttribute("aria-label", `Главная диагональ: ${sums.diagonalTarget}, цель ${save.puzzle.diagonalTarget}`);
    frag.appendChild(diagonal);
    grid.replaceChildren(frag);
    fitBoard();
    updateLogicRating();
    updateCompletion();
    if (focusIndex !== undefined) {
      const focusTarget = grid.querySelector(`[data-index="${focusIndex}"]`);
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
  }

  function setCell(index) {
    const current = save.states[index];
    let next;
    if (activeMode === "keep") next = current === 1 ? 0 : 1;
    else if (activeMode === "remove") next = current === -1 ? 0 : -1;
    else if (activeMode === "clear") next = 0;
    else next = current === 0 ? -1 : current === -1 ? 1 : 0;
    if (next === current) return;
    pushHistory();
    save.states[index] = next;
    save.revealed = false;
    selectedIndex = index;
    persist();
    render(index);
  }

  grid.addEventListener("click", event => {
    const cell = event.target.closest(".number[data-index]");
    if (cell) setCell(Number(cell.dataset.index));
  });

  ["cycle", "keep", "remove", "clear"].forEach(mode => {
    byId(`mode-${mode}`).addEventListener("click", () => {
      activeMode = mode;
      ["cycle", "keep", "remove", "clear"].forEach(other => byId(`mode-${other}`).setAttribute("aria-pressed", String(other === mode)));
      setStatus(mode === "cycle" ? "Режим: цикл отметок." : mode === "keep" ? "Режим: оставить выбранное число. Повторное нажатие снимает отметку." : mode === "remove" ? "Режим: убрать выбранное число. Повторное нажатие снимает отметку." : "Режим: снять отметку.");
    });
  });

  byId("mistakes").addEventListener("click", () => {
    const budget = { maxNodes: 120000, deadline: Date.now() + 140 };
    const current = Game.solve(save.puzzle, { ...budget, states: save.states });
    if (current.exhausted) { setStatus("Проверка потребовала больше времени. Попробуйте ещё раз."); return; }
    if (current.count === 0) {
      const impossible = Game.mistakes(save.puzzle, save.states, budget);
      render();
      impossible.forEach(i => grid.querySelector(`[data-index="${i}"]`)?.classList.add("mistake"));
      setStatus(impossible.length ? `Эти отметки не подходят ни к одному решению: ${impossible.map(i => i + 1).join(", ")}.` : "Текущие отметки вместе противоречат суммам. Попробуйте снять несколько отметок и проверить снова.");
      return;
    }
    const impossible = Game.mistakes(save.puzzle, save.states, budget);
    render();
    impossible.forEach(i => grid.querySelector(`[data-index="${i}"]`)?.classList.add("mistake"));
    setStatus(impossible.length ? `Невозможные отметки: ${impossible.map(i => i + 1).join(", ")}.` : "Все текущие отметки совместимы хотя бы с одним решением.");
  });

  byId("hint").addEventListener("click", () => {
    const move = Game.hint(save.puzzle, save.states, { maxNodes: 180000, deadline: Date.now() + 160 });
    if (!move) { setStatus("Не удалось доказать обязательный следующий ход в отведённое время. Текущие отметки сохранены."); return; }
    pushHistory();
    save.states[move.index] = move.state;
    selectedIndex = move.index;
    persist();
    render(move.index);
    const row = Math.floor(move.index / save.puzzle.size) + 1;
    const column = move.index % save.puzzle.size + 1;
    setStatus(`${move.reason} (строка ${row}, столбец ${column}).`);
  });

  byId("undo").addEventListener("click", () => {
    if (!save.history.length) return;
    save.states = save.history.pop();
    save.revealed = false;
    persist();
    setStatus("Последнее действие отменено.");
    render(selectedIndex === null ? undefined : selectedIndex);
  });

  byId("restart").addEventListener("click", () => {
    if (isUnsavedProgress() && !confirm("Сбросить отметки и начать это поле заново?")) return;
    save.history = [];
    save.states = save.puzzle.initial.slice();
    save.revealed = false;
    selectedIndex = null;
    persist();
    setStatus("Поле сброшено к стартовым отметкам.");
    render();
  });

  byId("reveal").addEventListener("click", () => {
    if (!confirm("Показать одно из допустимых решений?")) return;
    const result = Game.solve(save.puzzle, { maxNodes: 250000, deadline: Date.now() + 220 });
    if (result.exhausted || result.count === 0) { setStatus("Решение не удалось доказать в отведённое время."); return; }
    pushHistory();
    save.states = result.solutions[0].slice();
    save.revealed = true;
    persist();
    setStatus("Показано одно допустимое решение.");
    render();
  });

  byId("new").addEventListener("click", () => {
    if (isUnsavedProgress() && !confirm("Начать новую головоломку? Текущая партия будет заменена.")) return;
    const size = Number(byId("size").value);
    setStatus("Подбираю головоломку с доказанным единственным решением…");
    createPuzzle(size);
    setStatus('Поле готово. Неотмеченные числа тоже входят в текущую сумму.');
  });

  window.sumplete = { getState: () => copy(save) };
  loadGame();
})();
