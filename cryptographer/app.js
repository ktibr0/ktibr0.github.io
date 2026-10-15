import { loadQuotes } from './data.js';
import { createGame, selectCell, guessLetter, revealHint, restoreGame, cloneGame, LETTERS } from './game.js';

const SESSION_KEY = 'cryptographer.session.v2';
const DECK_KEY = 'cryptographer.deck.v2';
const KB_ROWS = ['ЙЦУКЕНГШЩЗХ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬЪБЮЁ'].map(row => [...row]);
let quotes = [], state = null, deck = [], generation = 0, animationTimer = null, locked = false;
const revealAnimationIds = new Set();
const $ = id => document.getElementById(id);

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }
function saveState() { if (state) safeSet(SESSION_KEY, JSON.stringify(state)); }
function persistDeck() { safeSet(DECK_KEY, JSON.stringify(deck)); }
function clearAnimation() { if (animationTimer !== null) clearTimeout(animationTimer); animationTimer = null; locked = false; revealAnimationIds.clear(); }
function setLoading(active) { document.querySelectorAll('[data-level]').forEach(button => { button.disabled = active; }); $('loading-state').classList.toggle('hidden', !active); }
function levelScreenOpen() { return !$('level-screen').classList.contains('hidden'); }
function setError(error) { setLoading(false); $('source-error-text').textContent = `Не удалось загрузить цитаты: ${error.message || error}`; $('source-error').classList.remove('hidden'); }
function loadSource() {
  setLoading(true); $('source-error').classList.add('hidden');
  return loadQuotes().then(rows => {
    quotes = rows; setLoading(false);
    try { const parsed = JSON.parse(safeGet(DECK_KEY) || '[]'); deck = Array.isArray(parsed) ? parsed.filter(id => quotes.some(q => q.id === id)) : []; } catch { deck = []; }
    persistDeck();
    const saved = safeGet(SESSION_KEY);
    if (saved) {
      try { state = restoreGame(saved); showGame(); if (state.result) showResult(); }
      catch { state = null; safeRemove(SESSION_KEY); }
    }
    if (!state) $('level-screen').classList.remove('hidden');
    return rows;
  }).catch(error => { setError(error); throw error; });
}
function showGame() {
  $('level-screen').classList.add('hidden'); $('source-error').classList.add('hidden');
  render();
}
function beginGame(difficulty) {
  clearAnimation(); generation++;
  if (!quotes.length) return;
  const validDeck = deck.filter(id => quotes.some(q => q.id === id));
  if (!validDeck.length) deck = shuffle(quotes.map(q => q.id)); else deck = validDeck;
  const id = deck.shift();
  const quote = quotes.find(q => q.id === id);
  if (!quote) return;
  state = createGame(quote, difficulty);
  persistDeck(); safeSet(SESSION_KEY, JSON.stringify(state));
  $('win-overlay').classList.remove('show'); $('lose-overlay').classList.remove('show');
  showGame();
  focusSelected();
}
function shuffle(items) { for (let i=items.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; } return items; }
function newGame() { clearAnimation(); generation++; $('win-overlay').classList.remove('show'); $('lose-overlay').classList.remove('show'); $('level-screen').classList.remove('hidden'); $('resume-btn').classList.toggle('hidden', !state); }
function restartGame() { newGame(); }
function showResult() {
  if (!state?.result) return;
  const win = state.result === 'win';
  $(`${win ? 'win' : 'lose'}-quote`).textContent = `«${state.quote}»`;
  $(`${win ? 'win' : 'lose'}-author`).textContent = `— ${state.author}`;
  $(`${win ? 'win' : 'lose'}-overlay`).classList.add('show');
}
function render() {
  if (!state) return;
  renderPuzzle(); renderKeyboard(); renderLives(); renderHints();
  $('author-label').textContent = state.author;
  if (state.result) showResult();
}
function renderLives() {
  const root = $('lives'); root.replaceChildren();
  for (let i=0;i<state.maxLives;i++) {
    const heart=document.createElement('span'); heart.className='heart'+(i>=state.lives?' lost':''); heart.setAttribute('aria-hidden','true');
    heart.textContent='♥'; root.append(heart);
  }
  root.setAttribute('aria-label', `Осталось жизней: ${state.lives}`);
}
function renderHints() {
  $('hint-count').textContent=`Подсказок: ${state.hintsLeft}`;
  $('hint-btn').disabled=state.hintsLeft<=0 || state.done;
  $('hint-btn').classList.toggle('disabled', $('hint-btn').disabled);
}
function renderKeyboard() {
  const present=new Set(state.tokens.filter(t=>t.type==='letter').map(t=>t.char));
  const revealed=new Set(state.tokens.filter(t=>t.type==='letter'&&t.revealed).map(t=>t.char));
  for (let ri=0;ri<KB_ROWS.length;ri++) {
    const row=$(`kb-row-${ri+1}`); row.replaceChildren();
    for (const key of KB_ROWS[ri]) {
      const button=document.createElement('button'); button.type='button'; button.className='kb-key'; button.textContent=key; button.dataset.key=key;
      const absent=!present.has(key), guessed=revealed.has(key);
      button.disabled=absent||state.done||locked;
      if(absent) button.classList.add('inactive'); if(guessed)button.classList.add('guessed');
      button.addEventListener('click',()=>onKeyPress(key)); row.append(button);
    }
  }
}
function renderPuzzle() {
  const root=$('puzzle'); root.replaceChildren();
  let group=document.createElement('div'); group.className='word-group';
  const appendGroup=()=>{if(group.childNodes.length)root.append(group);group=document.createElement('div');group.className='word-group';};
  for(const token of state.tokens) {
    if(token.type==='space'){appendGroup();continue;}
    if(token.type==='punct'){const p=document.createElement('span');p.className='punct';p.textContent=token.char;group.append(p);continue;}
    const allCode=state.tokens.filter(t=>t.type==='letter'&&t.num===token.num);
    const cell=document.createElement('button'); cell.type='button'; cell.className='cell'+(token.revealed?' open':''); cell.dataset.id=token.id; cell.dataset.code=token.num;
    if(!token.revealed&&state.selectedId===token.id)cell.classList.add('selected');
    if(state.selectedId!==null&&allCode.some(t=>t.id===state.selectedId))cell.classList.add('same-code');
    cell.disabled=token.revealed||state.done||locked; cell.setAttribute('aria-label', token.revealed?`Буква ${token.char}`:`Ячейка с числом ${token.num}`);
    const wrap=document.createElement('span');wrap.className='card-wrap'; const card=document.createElement('span');card.className='card'+(token.revealed?' revealed':'')+(revealAnimationIds.has(token.id)?' just-revealed':'');
    const front=document.createElement('span');front.className='card-front'; const back=document.createElement('span');back.className='card-back';const letter=document.createElement('span');letter.className='letter';letter.textContent=token.revealed?token.char:'';back.append(letter);revealAnimationIds.delete(token.id);card.append(front,back);wrap.append(card);
    const number=document.createElement('span');number.className='cell-num'+(allCode.every(t=>t.revealed)?' hidden':'');number.textContent=token.num;
    cell.append(wrap,number);cell.addEventListener('click',()=>onCellClick(token.id));group.append(cell);
  }
  if(group.childNodes.length)root.append(group);
}
function focusSelected() {
  if(state?.selectedId===null)return;
  const el=$('puzzle').querySelector(`[data-id="${state.selectedId}"]`);
  if(el) {
    const box=$('puzzle-wrap'), cell=el.getBoundingClientRect(), area=box.getBoundingClientRect();
    if(cell.top<area.top) box.scrollTop-=area.top-cell.top; else if(cell.bottom>area.bottom) box.scrollTop+=cell.bottom-area.bottom;
    if(cell.left<area.left) box.scrollLeft-=area.left-cell.left; else if(cell.right>area.right) box.scrollLeft+=cell.right-area.right;
  }
}
function scheduleRender(expectedGeneration, revealedId) {
  locked=true; revealAnimationIds.add(revealedId); saveState(); render();
  animationTimer=setTimeout(()=>{
    if(expectedGeneration!==generation)return;
    animationTimer=null;locked=false;renderKeyboard();
    for(const cell of $('puzzle').querySelectorAll('.cell')) {
      const token=state.tokens.find(item=>item.type==='letter'&&String(item.id)===cell.dataset.id);
      cell.disabled=state.done||!token||token.revealed;
    }
    focusSelected();
  },matchMedia('(prefers-reduced-motion: reduce)').matches?0:300);
}
function onCellClick(id) { if(!state||state.done||locked||levelScreenOpen())return; state=selectCell(state,id);saveState();render();focusSelected(); }
function onKeyPress(key) {
  if(!state||state.done||locked||levelScreenOpen())return;
  const selected=state.tokens.find(t=>t.type==='letter'&&t.id===state.selectedId&&!t.revealed);
  if(!selected||!state.tokens.some(t=>t.type==='letter'&&t.char===key))return;
  const wasCorrect=selected.char===key;
  const revealedId=selected.id;
  state=guessLetter(state,key);saveState();
  if(wasCorrect) scheduleRender(generation,revealedId); else {render();if(state.result){const expected=generation;setTimeout(()=>{if(expected===generation&&state?.result==='loss')showResult();},250);}}
}
function useHint() {
  if(!state||state.done||state.hintsLeft<=0||levelScreenOpen())return;
  clearAnimation(); generation++;
  const hintTarget=state.tokens.find(t=>t.type==='letter'&&t.id===state.selectedId&&!t.revealed)||state.tokens.find(t=>t.type==='letter'&&!t.revealed);
  if(hintTarget) revealAnimationIds.add(hintTarget.id);
  state=revealHint(state);saveState();render();focusSelected();

}
function getState() { return cloneGame(state); }
function startGame(level) { beginGame(level); }
function resume() { if(state){$('level-screen').classList.add('hidden');render();} }
for(const button of document.querySelectorAll('[data-level]'))button.addEventListener('click',()=>beginGame(button.dataset.level));
$('hint-btn').addEventListener('click',useHint);$('new-game-btn').addEventListener('click',newGame);
$('resume-btn').addEventListener('click',resume);$('retry-btn').addEventListener('click',()=>loadSource().catch(()=>{}));
for(const button of document.querySelectorAll('.restart-btn'))button.addEventListener('click',restartGame);
document.addEventListener('keydown',event=>{if(LETTERS.includes(event.key.toLocaleUpperCase('ru'))){event.preventDefault();onKeyPress(event.key.toLocaleUpperCase('ru'));}});
window.cryptographer={getState,getQuotes:()=>quotes.map(q=>({...q})),startGame,onKeyPress,onCellClick,useHint,newGame};
loadSource().then(()=>{$('resume-btn').classList.toggle('hidden',!state);}).catch(()=>{});
