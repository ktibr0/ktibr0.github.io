const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const results = [];
async function moduleAt(name){const source=fs.readFileSync(path.join(root,'cryptographer',name),'utf8');return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
function check(name,fn){try{fn();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+' '+e.message);}}
(async()=>{
const data=await moduleAt('data.js');const game=await moduleAt('game.js');
const quotes=data.parseCSV(fs.readFileSync(path.join(root,'cryptographer/quotes.csv'),'utf8'));
check('baseline migration keeps 710 unique phrases with stable unique IDs',()=>{assert.equal(quotes.length,710);assert.equal(new Set(quotes.map(q=>q.id)).size,710);assert(quotes.some(q=>q.text.includes('ё')));});
check('migration preserves original wording and first retained attribution',()=>{
 const original=require('node:child_process').execFileSync('git',['show','9fbe121:cryptographer/index.html'],{cwd:root,encoding:'utf8'});
 const normalize=text=>text.toLowerCase().replaceAll('ё','е').replace(/[^а-я0-9]/g,'');const expected=new Map();
 for(const match of original.matchAll(/\{\s*text:\s*"([^"]*)",\s*author:\s*"([^"]*)"\s*\}/g))if(!expected.has(normalize(match[1])))expected.set(normalize(match[1]),{text:match[1],author:match[2]});
 assert.equal(expected.size,quotes.length);for(const q of quotes)assert.deepEqual({text:q.text,author:q.author},expected.get(normalize(q.text)));
});
check('CSV BOM, comma, escaped quote, multiline and CRLF',()=>{
 const rows=data.parseCSV('\ufeffid,text,author,category\r\n1,"Мир, \"\"дружба\"\"!","Имя, фамилия",Тест\r\n2,"Первая строка\nВторая строка",Автор,\r\n');
 assert.equal(rows[0].text,'Мир, "дружба"!');assert.equal(rows[0].author,'Имя, фамилия');assert.equal(rows[1].text,'Первая строка\nВторая строка');
});
check('CSV normalization deduplicates punctuation, case and yo',()=>{const rows=data.parseCSV('id,text,author,category\na,Всё хорошо!,Автор,\nb,ВСЕ ХОРОШО,Автор,\n');assert.equal(rows.length,1);assert.equal(rows[0].id,'a');});
check('CSV invalid data is rejected explicitly',()=>{for(const csv of ['', 'id,text,author,category\n', 'text,author\nМир,Автор', 'id,text,author,category\na,"Мир,Автор,', 'id,text,author,category\na,"Мир"лишнее,Автор,', 'id,text,author,category\na,12345,Автор,', 'id,text,author,category\na,Мир,Автор,\na,Труд,Автор,'])assert.throws(()=>data.parseCSV(csv),'invalid CSV '+csv);});
check('all 710 phrases across 3 levels remain playable and internally consistent',()=>{
 for(const q of quotes)for(const level of ['easy','medium','hard']){
  const s=game.createGame(q,level,()=>0.37);const letters=s.tokens.filter(t=>t.type==='letter');assert(letters.some(t=>!t.revealed),q.id+' '+level);assert(letters.find(t=>t.id===s.selectedId&&!t.revealed));assert.equal(s.lives,3);assert.equal(s.hintsLeft,{easy:5,medium:3,hard:2}[level]);assert.equal(new Set(letters.map(t=>t.id)).size,letters.length);
  const mapping=new Map(),reverse=new Map();for(const t of letters){assert(Number.isInteger(t.num)&&t.num>0);if(mapping.has(t.char))assert.equal(mapping.get(t.char),t.num);if(reverse.has(t.num))assert.equal(reverse.get(t.num),t.char);mapping.set(t.char,t.num);reverse.set(t.num,t.char);}
 }
});
check('easy reveals the highest-frequency letters, hard withholds the most frequent',()=>{
 const q={id:'frequency',text:'ААААААААА БББББББ ВВВВВ ГГГГ ДДД ЕЕ Ж З И К Л',author:'Тест',category:''};
 for(const r of [0,0.2,0.6,0.99]){
  const easy=game.createGame(q,'easy',()=>r);const freq=new Map();for(const t of easy.tokens.filter(t=>t.type==='letter'))freq.set(t.char,(freq.get(t.char)||0)+1);const revealed=new Set(easy.tokens.filter(t=>t.revealed).map(t=>t.char));for(const a of revealed)for(const [b,count]of freq)if(!revealed.has(b))assert(freq.get(a)>=count,'easy must prefer frequent letters');
  const hard=game.createGame(q,'hard',()=>r);assert(!hard.tokens.some(t=>t.char==='А'&&t.revealed));
 }
});
check('correct guess opens only selected occurrence, missing keys do nothing',()=>{
 let s=game.createGame({id:'repeat',text:'ААА БББ ВВВ',author:'Тест'},'hard',()=>0.5);const target=s.tokens.find(t=>t.type==='letter'&&!t.revealed);s=game.selectCell(s,target.id);const before=s.tokens.filter(t=>t.revealed).length;const original=JSON.stringify(s);assert.deepEqual(game.guessLetter(s,'Щ'),s);const next=game.guessLetter(s,target.char);assert.equal(next.tokens.filter(t=>t.revealed).length,before+1);assert.equal(JSON.stringify(s),original,'rules must not mutate input snapshot');assert.equal(next.lives,3);
});
check('three wrong answers lose and terminal inputs cannot change state',()=>{
 let s=game.createGame({id:'loss',text:'ААА БББ',author:'Тест'},'hard',()=>0.5);const target=s.tokens.find(t=>t.id===s.selectedId);const wrong=target.char==='А'?'Б':'А';for(let i=0;i<3;i++)s=game.guessLetter(s,wrong);assert.equal(s.lives,0);assert(s.done);assert.equal(s.result,'loss');assert.deepEqual(game.guessLetter(s,target.char),s);assert.deepEqual(game.revealHint(s),s);
});
check('selected hint opens one cell, respects limit and can win',()=>{
 let s=game.createGame({id:'hint',text:'АБ',author:'Тест'},'easy',()=>0.3);const target=s.tokens.find(t=>t.type==='letter'&&!t.revealed);s=game.selectCell(s,target.id);const next=game.revealHint(s);assert(next.tokens.find(t=>t.id===target.id).revealed);assert.equal(next.hintsLeft,4);assert(next.done);assert.equal(next.result,'win');assert.deepEqual(game.revealHint({...s,hintsLeft:0}),{...s,hintsLeft:0});
});
check('restore roundtrip preserves saved puzzle independently of current CSV',()=>{const s=game.createGame(quotes[0],'medium',()=>0.4);assert.deepEqual(game.restoreGame(game.serializeGame(s)),s);});
check('malformed but valid JSON saves fail safely at validation',()=>{
 const good=game.createGame(quotes[0],'medium',()=>0.4);const invalid=[null,{}, {...good,tokens:[{type:'letter'}]}, {...good,lives:-1},{...good,hintsLeft:99},{...good,selectedId:99999},{...good,done:true,result:null},{...good,tokens:good.tokens.map(t=>t.type==='letter'?{...t,num:0}:t)}];for(const value of invalid)assert.throws(()=>game.restoreGame(JSON.stringify(value)),'reject malformed save');
});
fs.mkdirSync(path.join(root,'_work/cryptographer'),{recursive:true});fs.writeFileSync(path.join(root,'_work/cryptographer/rules-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(results.filter(r=>r.pass).length+'/'+results.length+' passed');process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
