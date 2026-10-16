(function (root, factory) {
  const game = typeof module === "object" && module.exports ? require("./game.js") : root.SumpleteGame;
  const api = factory(game);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SumpleteGenerator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Game) {
  "use strict";

  function generate(size, options) {
    options = options || {};
    if (!Number.isInteger(size) || size < 3 || size > 9) throw new TypeError("Размер поля должен быть от 3 до 9.");
    const random = options.random || Math.random;
    if (typeof random !== "function") throw new TypeError("Источник случайных чисел задан неверно.");
    const maxAttempts = options.maxAttempts === undefined ? 24 : options.maxAttempts;
    const maxNodes = options.maxNodes === undefined ? 50000 : options.maxNodes;
    const timeBudgetMs = options.timeBudgetMs === undefined ? 180 : options.timeBudgetMs;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 0 || !Number.isSafeInteger(maxNodes) || maxNodes < 0 ||
        !Number.isFinite(timeBudgetMs) || timeBudgetMs < 0) throw new TypeError("Бюджет генерации задан неверно.");
    const deadline = Date.now() + timeBudgetMs;

    for (let attempt = 0; attempt < maxAttempts && Date.now() <= deadline; attempt++) {
      const numbers = Array.from({ length: size }, () => Array.from({ length: size }, () => 1 + Math.floor(random() * 9)));
      const solution = Array.from({ length: size * size }, () => random() < 0.5 ? 1 : -1);
      const totals = Game.targets(numbers, solution);
      const initial = solution.map(v => v === 1 && random() < 0.12 ? 1 : 0);
      const puzzle = { size, numbers, ...totals, initial, generation: "random" };
      const proof = Game.solve(puzzle, { maxNodes, deadline });
      if (!proof.exhausted && proof.count === 1) return puzzle;
    }

    return staircase(size, random);
  }

  function staircase(size, random) {
    const numbers = Array.from({ length: size }, () => Array.from({length:size},()=>1 + Math.floor(random() * 9)));
    const solution = Array(size * size).fill(-1);
    // Positive values suffice: the last row must retain everything, then the
    // last column's remaining sum is zero. The preceding row must retain every
    // remaining cell. Repeat upwards; induction forces every single decision.
    for (let r = 0; r < size; r++) for (let c = 0; c <= r; c++) solution[r * size + c] = 1;
    const totals = Game.targets(numbers, solution);
    const initial = solution.map((v, i) => v === 1 && i % Math.max(2, size) === 0 ? 1 : 0);
    return { size, numbers, ...totals, initial, generation: "fallback", fallbackType: "staircase" };
  }

  return { generate, staircase };
});
