export const HINTS = Object.freeze({ easy: 5, medium: 3, hard: 2 });
export const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const isLetter = ch => /[А-ЯЁ]/u.test(ch);
const normalizedPhrase = text => text.toLocaleUpperCase('ru').replace(/\s+/gu, ' ').trim();
const shuffled = (items, random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};

export function createGame(quote, difficulty = 'medium', random = Math.random) {
  if (!HINTS[difficulty]) throw new Error('Unknown difficulty');
  const chars = [...normalizedPhrase(quote.text)];
  const letters = [...new Set(chars.filter(isLetter))];
  if (!letters.length) throw new Error('Phrase has no Russian letters');
  const codes = shuffled(Array.from({ length: letters.length }, (_, i) => i + 1), random);
  const letterToNum = Object.fromEntries(letters.map((letter, index) => [letter, codes[index]]));
  const tokens = [];
  let id = 0;
  for (const char of chars) {
    if (isLetter(char)) tokens.push({ type: 'letter', char, id: id++, num: letterToNum[char], revealed: false });
    else if (char === ' ') tokens.push({ type: 'space' });
    else tokens.push({ type: 'punct', char });
  }
  const frequency = Object.fromEntries(letters.map(letter => [letter, chars.filter(ch => ch === letter).length]));
  const ordered = [...letters].sort((a, b) => frequency[b] - frequency[a] || a.localeCompare(b, 'ru'));
  const pct = difficulty === 'easy' ? 0.55 : difficulty === 'medium' ? 0.3 : 0.15;
  let revealCount = Math.max(1, Math.min(letters.length - 1, Math.round(letters.length * pct)));
  if (letters.length === 1) revealCount = 0;
  let pool = difficulty === 'easy' ? ordered : difficulty === 'medium' ? ordered.slice(Math.min(2, Math.floor(letters.length * 0.2))) : ordered.slice(Math.floor(letters.length * 0.3));
  if (!pool.length) pool = ordered;
  const selectedLetters = difficulty === 'easy' ? pool.slice(0, revealCount) : shuffled(pool, random).slice(0, revealCount);
  for (const letter of selectedLetters) {
    const candidates = tokens.filter(token => token.type === 'letter' && token.char === letter);
    if (candidates.length) candidates[Math.floor(random() * candidates.length)].revealed = true;
  }
  const firstClosed = tokens.find(token => token.type === 'letter' && !token.revealed);
  return { quoteId: quote.id, quote: quote.text, author: quote.author, category: quote.category || '', tokens, letterToNum, lives: 3, maxLives: 3, selectedId: firstClosed?.id ?? null, done: false, result: null, hintsLeft: HINTS[difficulty], difficulty };
}

export function selectCell(state, id) {
  if (state.done) return state;
  const token = state.tokens.find(item => item.type === 'letter' && item.id === id && !item.revealed);
  return token ? { ...state, selectedId: id } : state;
}
export function guessLetter(state, letter) {
  if (state.done || state.selectedId === null) return state;
  const target = state.tokens.find(token => token.type === 'letter' && token.id === state.selectedId && !token.revealed);
  if (!target || !LETTERS.includes(letter) || !state.tokens.some(token => token.type === 'letter' && token.char === letter)) return state;
  if (target.char !== letter) {
    const lives = Math.max(0, state.lives - 1);
    return { ...state, lives, done: lives === 0, result: lives === 0 ? 'loss' : null };
  }
  const tokens = state.tokens.map(token => token.id === target.id ? { ...token, revealed: true } : token);
  const closed = tokens.filter(token => token.type === 'letter' && !token.revealed);
  const next = closed.find(token => token.id > target.id) || closed[0];
  return { ...state, tokens, selectedId: next?.id ?? null, done: closed.length === 0, result: closed.length === 0 ? 'win' : null };
}
export function revealHint(state) {
  if (state.done || state.hintsLeft <= 0) return state;
  let target = state.tokens.find(token => token.type === 'letter' && token.id === state.selectedId && !token.revealed);
  target ||= state.tokens.find(token => token.type === 'letter' && !token.revealed);
  if (!target) return state;
  const tokens = state.tokens.map(token => token.id === target.id ? { ...token, revealed: true } : token);
  const closed = tokens.filter(token => token.type === 'letter' && !token.revealed);
  const next = closed.find(token => token.id > target.id) || closed[0];
  return { ...state, tokens, hintsLeft: state.hintsLeft - 1, selectedId: next?.id ?? null, done: closed.length === 0, result: closed.length === 0 ? 'win' : null };
}
export function serializeGame(state) { return JSON.stringify(state); }
export function restoreGame(value) {
  const s = typeof value === 'string' ? JSON.parse(value) : value;
  const fail = () => { throw new Error('Invalid saved game'); };
  if (!s || typeof s !== 'object' || !Array.isArray(s.tokens) || !['easy', 'medium', 'hard'].includes(s.difficulty) ||
      !Number.isInteger(s.lives) || s.lives < 0 || s.lives > 3 || !Number.isInteger(s.hintsLeft) || s.hintsLeft < 0 || s.hintsLeft > HINTS[s.difficulty] ||
      !['win', 'loss', null].includes(s.result) || typeof s.done !== 'boolean' || typeof s.quote !== 'string' || typeof s.author !== 'string' ||
      typeof s.quoteId !== 'string' || !s.quoteId || !s.letterToNum || typeof s.letterToNum !== 'object') fail();
  const expected = [...normalizedPhrase(s.quote)];
  const tokenChars = s.tokens.map(t => t.type === 'space' ? ' ' : t.char);
  if (expected.length !== tokenChars.length || expected.some((ch, i) => ch !== tokenChars[i])) fail();
  const letters = s.tokens.filter(t => t.type === 'letter');
  if (!letters.length || letters.some(t => !Number.isInteger(t.id) || t.id < 0 || !isLetter(t.char) || !Number.isInteger(t.num) || t.num < 1 || typeof t.revealed !== 'boolean')) fail();
  if (new Set(letters.map(t => t.id)).size !== letters.length || new Set(letters.map(t => t.num)).size !== new Set(letters.map(t => t.char)).size) fail();
  const unique = [...new Set(letters.map(t => t.char))];
  if (Object.keys(s.letterToNum).length !== unique.length || unique.some(ch => s.letterToNum[ch] !== letters.find(t => t.char === ch).num)) fail();
  if (s.selectedId !== null && !letters.some(t => t.id === s.selectedId && !t.revealed)) fail();
  const allOpen = letters.every(t => t.revealed);
  if ((s.result === 'win' && (!s.done || !allOpen)) || (s.result === 'loss' && (!s.done || s.lives !== 0)) || (!s.done && (allOpen || s.lives === 0)) || (s.done && !s.result)) fail();
  return s;
}

export function cloneGame(state) { return state ? JSON.parse(JSON.stringify(state)) : null; }
