(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SumpleteGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_SIZE = 3;
  const MAX_SIZE = 9;
  const MAX_HISTORY = 100;

  function validatePuzzle(puzzle) {
    if (!puzzle || !Number.isInteger(puzzle.size) || puzzle.size < MIN_SIZE || puzzle.size > MAX_SIZE) {
      throw new TypeError("Размер поля должен быть от 3 до 9.");
    }
    const n = puzzle.size;
    if (!Array.isArray(puzzle.numbers) || puzzle.numbers.length !== n ||
        puzzle.numbers.some(row => !Array.isArray(row) || row.length !== n || row.some(v => !Number.isSafeInteger(v) || v < 1 || v > 9))) {
      throw new TypeError("Некорректная таблица чисел.");
    }
    if (!Array.isArray(puzzle.rowTargets) || puzzle.rowTargets.length !== n ||
        !Array.isArray(puzzle.columnTargets) || puzzle.columnTargets.length !== n ||
        [...puzzle.rowTargets, ...puzzle.columnTargets, puzzle.diagonalTarget].some(v => !Number.isSafeInteger(v) || v < 0)) {
      throw new TypeError("Некорректные целевые суммы.");
    }
    if (puzzle.initial !== undefined && (!Array.isArray(puzzle.initial) || puzzle.initial.length !== n * n || puzzle.initial.some(v => ![-1, 0, 1].includes(v)))) {
      throw new TypeError("Некорректные стартовые отметки.");
    }
    return puzzle;
  }

  function validateStates(puzzle, states) {
    const count = puzzle.size * puzzle.size;
    const result = states === undefined ? Array(count).fill(0) : states;
    if (!Array.isArray(result) || result.length !== count || result.some(v => ![-1, 0, 1].includes(v))) {
      throw new TypeError("Состояние клеток должно содержать только -1, 0 или 1.");
    }
    return result;
  }

  function targets(numbers, kept) {
    if (!Array.isArray(numbers) || numbers.length < MIN_SIZE || numbers.length > MAX_SIZE ||
        numbers.some(row => !Array.isArray(row) || row.length !== numbers.length || row.some(v => !Number.isSafeInteger(v) || v < 1 || v > 9))) {
      throw new TypeError("Некорректная таблица чисел.");
    }
    const n = numbers.length;
    if (!Array.isArray(kept) || kept.length !== n * n || kept.some(v => ![-1, 0, 1].includes(v))) {
      throw new TypeError("Некорректное решение.");
    }
    const rowTargets = Array(n).fill(0);
    const columnTargets = Array(n).fill(0);
    let diagonalTarget = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (kept[i * n + j] !== -1) {
        rowTargets[i] += numbers[i][j];
        columnTargets[j] += numbers[i][j];
        if (i === j) diagonalTarget += numbers[i][j];
      }
    }
    return { rowTargets, columnTargets, diagonalTarget };
  }

  function isSolved(puzzle, states) {
    validatePuzzle(puzzle);
    const values = validateStates(puzzle, states);
    const actual = targets(puzzle.numbers, values);
    return actual.diagonalTarget === puzzle.diagonalTarget &&
      actual.rowTargets.every((v, i) => v === puzzle.rowTargets[i]) &&
      actual.columnTargets.every((v, i) => v === puzzle.columnTargets[i]);
  }

  function solve(puzzle, options) {
    validatePuzzle(puzzle);
    options = options || {};
    const fixed = validateStates(puzzle, options.states);
    const n = puzzle.size;
    const maxNodes = options.maxNodes === undefined ? 1000000 : options.maxNodes;
    const deadline = options.deadline === undefined ? Infinity : options.deadline;
    if (!Number.isSafeInteger(maxNodes) || maxNodes < 0 || !(typeof deadline === "number")) {
      throw new TypeError("Бюджет поиска задан неверно.");
    }

    const rowOptions = [];
    for (let r = 0; r < n; r++) {
      const choices = [];
      for (let mask = 0; mask < (1 << n); mask++) {
        let sum = 0, compatible = true;
        for (let c = 0; c < n; c++) {
          const on = !!(mask & (1 << c));
          const state = fixed[r * n + c];
          if ((state === 1 && !on) || (state === -1 && on)) { compatible = false; break; }
          if (on) sum += puzzle.numbers[r][c];
        }
        if (compatible && sum === puzzle.rowTargets[r]) choices.push(mask);
      }
      rowOptions.push(choices);
    }

    const futureForced = Array.from({ length: n + 1 }, () => Array(n).fill(0));
    const futurePossible = Array.from({ length: n + 1 }, () => Array(n).fill(0));
    const futureDiagonalForced = Array(n + 1).fill(0);
    const futureDiagonalPossible = Array(n + 1).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      for (let c = 0; c < n; c++) {
        const v = puzzle.numbers[r][c], state = fixed[r * n + c];
        futureForced[r][c] = futureForced[r + 1][c] + (state === 1 ? v : 0);
        futurePossible[r][c] = futurePossible[r + 1][c] + (state === -1 ? 0 : v);
      }
      const state = fixed[r * n + r], v = puzzle.numbers[r][r];
      futureDiagonalForced[r] = futureDiagonalForced[r + 1] + (state === 1 ? v : 0);
      futureDiagonalPossible[r] = futureDiagonalPossible[r + 1] + (state === -1 ? 0 : v);
    }

    const solutions = [];
    const colSums = Array(n).fill(0);
    const picked = Array(n).fill(0);
    let nodes = 0, exhausted = false;
    function search(row, diagonalSum) {
      if (solutions.length >= 2 || exhausted) return;
      if (nodes >= maxNodes || Date.now() > deadline) { exhausted = true; return; }
      if (row === n) {
        if (diagonalSum === puzzle.diagonalTarget && colSums.every((v, c) => v === puzzle.columnTargets[c])) {
          const solution = Array(n * n);
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            solution[r * n + c] = picked[r] & (1 << c) ? 1 : -1;
          }
          solutions.push(solution);
        }
        return;
      }
      for (const mask of rowOptions[row]) {
        if (solutions.length >= 2 || exhausted) return;
        if (nodes >= maxNodes || Date.now() > deadline) { exhausted = true; return; }
        nodes++;
        let possible = true, nextDiagonal = diagonalSum;
        const nextColumns = colSums.slice();
        for (let c = 0; c < n; c++) {
          const on = !!(mask & (1 << c));
          const sum = nextColumns[c] + (on ? puzzle.numbers[row][c] : 0);
          if (sum > puzzle.columnTargets[c] ||
              sum + futureForced[row + 1][c] > puzzle.columnTargets[c] ||
              sum + futurePossible[row + 1][c] < puzzle.columnTargets[c]) { possible = false; break; }
          nextColumns[c] = sum;
          if (row === c && on) nextDiagonal += puzzle.numbers[row][c];
        }
        if (possible && (nextDiagonal + futureDiagonalForced[row + 1] <= puzzle.diagonalTarget) &&
            (nextDiagonal + futureDiagonalPossible[row + 1] >= puzzle.diagonalTarget)) {
          for (let c = 0; c < n; c++) colSums[c] = nextColumns[c];
          picked[row] = mask;
          search(row + 1, nextDiagonal);
          for (let c = 0; c < n; c++) colSums[c] = colSums[c] - (mask & (1 << c) ? puzzle.numbers[row][c] : 0);
        }
      }
    }
    if (rowOptions.some(list => list.length === 0)) return { count: 0, solutions, exhausted: false, nodes };
    search(0, 0);
    return { count: solutions.length, solutions, exhausted, nodes };
  }

  function mistakes(puzzle, states, options) {
    validatePuzzle(puzzle);
    const values = validateStates(puzzle, states);
    const searchOptions = options || { maxNodes: 100000, deadline: Date.now() + 100 };
    const current = solve(puzzle, { ...searchOptions, states: values });
    if (!current.exhausted && current.count > 0) return [];
    const wrong = [];
    for (let i = 0; i < values.length; i++) if (values[i] !== 0) {
      const partial = Array(values.length).fill(0); partial[i] = values[i];
      const result = solve(puzzle, { ...searchOptions, states: partial });
      if (!result.exhausted && result.count === 0) wrong.push(i);
    }
    return wrong;
  }

  function analyzeLogic(puzzle, states, options) {
    validatePuzzle(puzzle);
    const current = validateStates(puzzle, states).slice();
    options = options || {};
    const n = puzzle.size;
    const maxPasses = options.maxPasses === undefined ? n * n + 1 : options.maxPasses;
    const maxChecks = options.maxChecks === undefined ? 250000 : options.maxChecks;
    const deadline = options.deadline === undefined ? Date.now() + 100 : options.deadline;
    if (!Number.isSafeInteger(maxPasses) || maxPasses < 0 || !Number.isSafeInteger(maxChecks) || maxChecks < 0 || typeof deadline !== "number") {
      throw new TypeError("Бюджет логического анализа задан неверно.");
    }

    const lines = [];
    for (let r = 0; r < n; r++) lines.push({ kind: "row", line: r, target: puzzle.rowTargets[r], indices: Array.from({ length: n }, (_, c) => r * n + c) });
    for (let c = 0; c < n; c++) lines.push({ kind: "column", line: c, target: puzzle.columnTargets[c], indices: Array.from({ length: n }, (_, r) => r * n + c) });
    lines.push({ kind: "diagonal", line: 0, target: puzzle.diagonalTarget, indices: Array.from({ length: n }, (_, i) => i * n + i) });

    const steps = [];
    let checks = 0, exhausted = false, contradiction = false;
    for (let pass = 0; pass < maxPasses; pass++) {
      let changed = false;
      for (const line of lines) {
        if (Date.now() > deadline || checks >= maxChecks) { exhausted = true; break; }
        const candidates = [];
        for (let mask = 0; mask < (1 << n); mask++) {
          if (Date.now() > deadline || checks >= maxChecks) { exhausted = true; break; }
          checks++;
          let sum = 0, compatible = true;
          for (let slot = 0; slot < n; slot++) {
            const on = !!(mask & (1 << slot));
            const known = current[line.indices[slot]];
            if ((known === 1 && !on) || (known === -1 && on)) { compatible = false; break; }
            if (on) sum += puzzle.numbers[Math.floor(line.indices[slot] / n)][line.indices[slot] % n];
          }
          if (compatible && sum === line.target) candidates.push(mask);
        }
        if (exhausted) break;
        if (candidates.length === 0) { contradiction = true; break; }
        for (let slot = 0; slot < n; slot++) {
          const index = line.indices[slot];
          if (current[index] !== 0) continue;
          const keptEverywhere = candidates.every(mask => !!(mask & (1 << slot)));
          const removedEverywhere = candidates.every(mask => !(mask & (1 << slot)));
          if (!keptEverywhere && !removedEverywhere) continue;
          const state = keptEverywhere ? 1 : -1;
          current[index] = state;
          steps.push({ index, state, kind: line.kind, line: line.line, target: line.target });
          changed = true;
        }
        if (contradiction) break;
      }
      if (contradiction || exhausted || !changed) break;
      if (pass === maxPasses - 1) exhausted = true;
    }
    const solved = !contradiction && !exhausted && current.every(v => v !== 0) && isSolved(puzzle, current);
    return { solved, contradiction, exhausted, states: current, steps };
  }

  function lineName(kind, line) {
    if (kind === "row") return `Строка ${line + 1}`;
    if (kind === "column") return `Столбец ${line + 1}`;
    return "Главная диагональ";
  }

  function hint(puzzle, states, options) {
    validatePuzzle(puzzle);
    const values = validateStates(puzzle, states);
    const searchOptions = options || { maxNodes: 200000, deadline: Date.now() + 150 };
    const result = solve(puzzle, { ...searchOptions, states: values });
    if (result.exhausted || result.count === 0) return null;
    const logic = analyzeLogic(puzzle, values, {
      deadline: searchOptions.deadline === undefined ? Date.now() + 100 : searchOptions.deadline,
      maxChecks: searchOptions.maxLogicChecks
    });
    if (logic.steps.length > 0) {
      const step = logic.steps[0];
      return {
        ...step,
        reason: `${lineName(step.kind, step.line)}: среди всех вариантов с суммой ${step.target}, совместимых с текущими отметками, это число всегда нужно ${step.state === 1 ? "оставить" : "убрать"}.`
      };
    }
    for (let i = 0; i < values.length; i++) if (values[i] === 0) {
      const opposite = values.slice();
      opposite[i] = -result.solutions[0][i];
      const alternative = solve(puzzle, { ...searchOptions, states: opposite });
      if (!alternative.exhausted && alternative.count === 0) {
        return {
          index: i,
          state: result.solutions[0][i],
          reason: `Совместный анализ нескольких сумм подтверждает: во всех допустимых решениях это число нужно ${result.solutions[0][i] === 1 ? "оставить" : "убрать"}.`
        };
      }
    }
    return null;
  }

  function validateSave(value) {
    if (!value || value.version !== 1 || typeof value.revealed !== "boolean") throw new TypeError("Некорректное сохранение.");
    if (!Array.isArray(value.puzzle && value.puzzle.initial)) throw new TypeError("В сохранении отсутствуют стартовые отметки.");
    validatePuzzle(value.puzzle);
    if (!Array.isArray(value.states)) throw new TypeError('В сохранении отсутствуют отметки.');
    validateStates(value.puzzle, value.states);
    const p = value.puzzle, n = p.size;
    if (p.rowTargets.some((v,r)=>v>p.numbers[r].reduce((a,b)=>a+b,0)) ||
        p.columnTargets.some((v,c)=>v>p.numbers.reduce((a,row)=>a+row[c],0)) ||
        p.diagonalTarget>p.numbers.reduce((a,row,r)=>a+row[r],0) ||
        p.rowTargets.reduce((a,b)=>a+b,0)!==p.columnTargets.reduce((a,b)=>a+b,0)) {
      throw new TypeError('В сохранении невозможные суммы.');
    }
    if (value.revealed && !isSolved(p,value.states)) throw new TypeError('Показанное решение повреждено.');
    if (!Array.isArray(value.history) || value.history.length > MAX_HISTORY ||
        value.history.some(states => { try { validateStates(value.puzzle, states); return false; } catch (_) { return true; } })) {
      throw new TypeError("Некорректная история действий.");
    }
    return value;
  }

  return { MIN_SIZE, MAX_SIZE, MAX_HISTORY, validatePuzzle, validateStates, validateSave, targets, isSolved, solve, mistakes, analyzeLogic, hint };
});
