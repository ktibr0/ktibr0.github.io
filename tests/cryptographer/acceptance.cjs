// Acceptance scenarios authored by the supervising agent before implementation.
// Run: node tests/cryptographer/acceptance.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
let pw;
try { pw = require('playwright'); } catch {
  pw = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT || 'C:/Users/alex_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', '_resolve.cjs'))('playwright');
}
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, '_work/cryptographer');
fs.mkdirSync(evidence, {recursive:true});
const results = [];
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const server = http.createServer((req,res) => {
  let target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!target.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target=path.join(target,'index.html');
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
const state = p => p.evaluate(()=>window.cryptographer.getState());
const api = (p,name,...args)=>p.evaluate(([name,args])=>window.cryptographer[name](...args),[name,args]);
const fixture = '\ufeffid,text,author,category\r\nalpha,"ААААА БББ ВВ Г Д Е Ж З И К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я Ё",Автор,Тест\r\nbeta,"Домомучительниц прислуживаться сберегательной",Автор,Тест\r\ngamma,"Мир, труд и май!",Автор,Тест\r\n';
async function fresh(browser,url,{csv,storageBlocked=false,viewport={width:1024,height:768}}={}) {
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(csv!==undefined) await page.route('**/quotes.csv*',r=>r.fulfill({status:200,contentType:'text/csv; charset=utf-8',body:csv}));
  if(storageBlocked)await page.addInitScript(()=>{for(const method of ['getItem','setItem','removeItem'])Storage.prototype[method]=()=>{throw new DOMException('Blocked','SecurityError');};});
  await page.goto(url);
  await page.waitForFunction(()=>window.cryptographer && window.cryptographer.getQuotes().length>0);
  return {context,page,errors};
}
async function start(page,level='medium'){await api(page,'startGame',level);await page.waitForFunction(()=>window.cryptographer.getState()?.tokens?.length>0);}
async function settle(page){await page.waitForTimeout(850);}
async function check(name,fn){try {await fn();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+' '+e.message);}}
async function runEngine(engine,url){
 const executablePath=process.env['PLAYWRIGHT_'+engine.toUpperCase()+'_EXECUTABLE'];
 const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
 try{
 await check(engine+' production CSV, Unicode, cipher and disabled absent letters',async()=>{
   const {context,page,errors}=await fresh(browser,url);
   try{
    const quotes=await api(page,'getQuotes');assert.equal(quotes.length,710,'normalized unique baseline count');
    await start(page);const s=await state(page);assert.equal(s.lives,3);assert.equal(s.hintsLeft,3);
    const letters=s.tokens.filter(t=>t.type==='letter');const codes=new Map();const reverse=new Map();
    for(const t of letters){if(codes.has(t.char))assert.equal(codes.get(t.char),t.num);if(reverse.has(t.num))assert.equal(reverse.get(t.num),t.char);codes.set(t.char,t.num);reverse.set(t.num,t.char);}
    const alphabet='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';const missing=[...alphabet].find(c=>!codes.has(c));assert(missing,'fixture requires absent letter');
    const key=page.locator('.kb-key').filter({hasText:new RegExp('^'+missing+'$')});assert(await key.isDisabled(),'absent-letter DOM button disabled');
    await api(page,'onKeyPress',missing);assert.equal((await state(page)).lives,3,'handler also rejects absent letter');
    const selected=letters.find(t=>t.id===s.selectedId);const wrong=[...codes.keys()].find(c=>c!==selected.char);await api(page,'onKeyPress',wrong);assert.equal((await state(page)).lives,2);
    await settle(page);const before=await state(page);await api(page,'onKeyPress',selected.char);await settle(page);const after=await state(page);assert.equal(after.tokens.filter(t=>t.revealed).length,before.tokens.filter(t=>t.revealed).length+1,'exactly one cell opens');assert.equal(after.lives,2);assert.deepEqual(errors,[]);
   }finally{await context.close();}
 });
 await check(engine+' selected hint and complete session survive reload',async()=>{
  const {context,page}=await fresh(browser,url);try{
   await start(page,'hard');let s=await state(page);const closed=s.tokens.filter(t=>t.type==='letter'&&!t.revealed);const chosen=closed.at(-1);await api(page,'onCellClick',chosen.id);await api(page,'useHint');await settle(page);s=await state(page);assert(s.tokens.find(t=>t.id===chosen.id).revealed);assert.equal(s.hintsLeft,1);
   const snapshot=JSON.parse(JSON.stringify(s));await page.reload();await page.waitForFunction(()=>window.cryptographer);const resume=page.getByRole('button',{name:/Продолжить/});if(await resume.count() && await resume.first().isVisible())await resume.first().click();await page.waitForFunction(()=>window.cryptographer.getState()?.tokens?.length>0);const restored=await state(page);
   for(const field of ['tokens','quote','lives','hintsLeft','difficulty','selectedId'])assert.deepEqual(restored[field],snapshot[field],'restores '+field);
  }finally{await context.close();}
 });
 await check(engine+' no repeats before exhaustion including refresh',async()=>{
  const {context,page}=await fresh(browser,url,{csv:fixture});try{
   const seen=[];await start(page);seen.push((await state(page)).quote);await start(page);seen.push((await state(page)).quote);await page.reload();await page.waitForFunction(()=>window.cryptographer&&window.cryptographer.getQuotes().length>0);await start(page);seen.push((await state(page)).quote);assert.equal(new Set(seen).size,3);
  }finally{await context.close();}
 });
 await check(engine+' rapid hints and transition cannot overdraw or cross games',async()=>{
  const {context,page,errors}=await fresh(browser,url);try{
   await start(page,'easy');await page.evaluate(()=>{window.cryptographer.useHint();window.cryptographer.useHint();window.cryptographer.useHint();});await settle(page);assert((await state(page)).hintsLeft>=2);
   const old=await state(page);const t=old.tokens.find(t=>t.id===old.selectedId);await api(page,'onKeyPress',t.char);await start(page,'hard');const next=await state(page);await settle(page);const later=await state(page);assert.equal(later.quote,next.quote);assert.deepEqual(later.tokens,next.tokens);assert.equal(later.hintsLeft,2);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await check(engine+' corrupt saves and denied storage preserve play',async()=>{
  const {context,page}=await fresh(browser,url);try{await start(page);await page.evaluate(()=>{for(const k of Object.keys(localStorage))localStorage.setItem(k,'{broken');});await page.reload();await page.waitForFunction(()=>window.cryptographer&&window.cryptographer.getQuotes().length>0);await start(page);assert.equal((await state(page)).lives,3);}finally{await context.close();}
  const denied=await fresh(browser,url,{storageBlocked:true});try{await start(denied.page);await api(denied.page,'useHint');await settle(denied.page);assert.equal((await state(denied.page)).hintsLeft,2);assert.deepEqual(denied.errors,[]);}finally{await denied.context.close();}
 });
 await check(engine+' real UI controls and hidden-game input protection',async()=>{
  const {context,page}=await fresh(browser,url);try{
   await page.getByRole('button',{name:/Средне/}).click();await page.waitForFunction(()=>window.cryptographer.getState()?.tokens?.length>0);
   let s=await state(page);const t=s.tokens.find(t=>t.id===s.selectedId);const before=s.tokens.filter(t=>t.revealed).length;
   const wrong=s.tokens.find(x=>x.type==='letter'&&x.char!==t.char).char;await page.locator('.kb-key[data-key="'+wrong+'"]').click();assert.equal((await state(page)).lives,2,'real wrong key click must cost a life');
   await page.locator('.kb-key[data-key="'+t.char+'"]').click();await settle(page);assert.equal((await state(page)).tokens.filter(t=>t.revealed).length,before+1);
   s=await state(page);const chosen=s.tokens.filter(t=>t.type==='letter'&&!t.revealed).at(-1);await page.locator('.cell[data-id="'+chosen.id+'"]').click();await page.locator('#hint-btn').click();await settle(page);assert((await state(page)).tokens.find(t=>t.id===chosen.id).revealed);
   await page.locator('#new-game-btn').click();const snapshot=await state(page);await api(page,'onKeyPress',snapshot.tokens.find(t=>t.id===snapshot.selectedId).char);await api(page,'useHint');assert.deepEqual(await state(page),snapshot,'hidden game cannot be altered');await page.getByRole('button',{name:'Продолжить игру',exact:true}).click();assert.deepEqual(await state(page),snapshot);
  }finally{await context.close();}
 });
 await check(engine+' changed CSV keeps saved snapshot and supplies new phrases',async()=>{
  const {context,page}=await fresh(browser,url,{csv:fixture});try{
   await start(page);const saved=await state(page);
   await page.unroute('**/quotes.csv*');await page.route('**/quotes.csv*',r=>r.fulfill({status:200,contentType:'text/csv',body:'id,text,author,category\nnew,Совершенно новая фраза,Новый автор,Тест\n'}));
   await page.reload();await page.waitForFunction(()=>window.cryptographer&&window.cryptographer.getQuotes().length>0);
   assert.equal((await state(page)).quote,saved.quote,'removed phrase snapshot survives');
   await start(page);assert.equal((await state(page)).quote,'Совершенно новая фраза');
  }finally{await context.close();}
 });
 await check(engine+' CSV error and retry are visible and recoverable',async()=>{
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let fail=true;
  try{
   await page.route('**/quotes.csv*',r=>r.fulfill({status:fail?503:200,contentType:'text/csv',body:fail?'Unavailable':fixture}));
   await page.goto(url);await page.locator('#source-error').waitFor({state:'visible'});assert(await page.getByRole('button',{name:'Повторить',exact:true}).isVisible());
   fail=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.waitForFunction(()=>window.cryptographer?.getQuotes().length===3);await start(page);assert.equal((await state(page)).lives,3);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
 await check(engine+' win, loss and reload completed state',async()=>{
  const {context,page}=await fresh(browser,url,{csv:'id,text,author,category\ntiny,АА ББ,Автор,Тест\n'});try{
   await start(page,'hard');for(let i=0;i<100;i++){const s=await state(page);if(s.done)break;const t=s.tokens.find(t=>t.id===s.selectedId);assert(t);await api(page,'onKeyPress',t.char);await settle(page);}assert.equal((await state(page)).done,true);assert(await page.locator('#win-overlay').isVisible());
   await page.reload();await page.waitForFunction(()=>window.cryptographer&&window.cryptographer.getQuotes().length>0);assert.equal((await state(page)).done,true);await start(page);let s=await state(page);for(let i=0;i<3;i++){const t=s.tokens.find(t=>t.id===s.selectedId);const candidates=s.tokens.filter(t=>t.type==='letter');const key=candidates.find(x=>x.char!==t.char).char;await api(page,'onKeyPress',key);await settle(page);s=await state(page);}assert.equal(s.lives,0);assert(s.done);assert(await page.locator('#lose-overlay').isVisible());
  }finally{await context.close();}
 });
 for(const viewport of [{width:1024,height:768},{width:1180,height:820},{width:412,height:915},{width:360,height:800},{width:1024,height:600}]){
  await check(engine+' layout '+viewport.width+'x'+viewport.height,async()=>{
   const {context,page,errors}=await fresh(browser,url,{csv:fixture,viewport});try{
    // Second game guarantees the long-word fixture regardless of shuffle order.
    for(let n=0;n<3;n++){await start(page);if((await state(page)).quote.includes('Домомучительниц'))break;}
    await page.emulateMedia({reducedMotion:'reduce'});
    const geometry=await page.evaluate(()=>{
     const wrap=document.getElementById('puzzle-wrap');const keyboard=document.getElementById('keyboard');const keys=[...keyboard.querySelectorAll('button')];const r=keyboard.getBoundingClientRect();
     return {pageOverflow:document.documentElement.scrollWidth>innerWidth+1,fieldOverflow:wrap.scrollWidth>wrap.clientWidth+1,keyboardBottom:r.bottom,keyboardTop:r.top,keyRects:keys.map(k=>{const r=k.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})};
    });assert.equal(geometry.pageOverflow,false);assert.equal(geometry.fieldOverflow,false,'long words not hidden by horizontal clipping');assert(geometry.keyboardBottom<=viewport.height+1);assert(geometry.keyboardTop>=0);assert.equal(geometry.keyRects.length,33);for(const r of geometry.keyRects){assert(r.x>=-1&&r.right<=viewport.width+1);assert(r.h>=40);}
    const cardGeometry=await page.evaluate(()=>[...document.querySelectorAll('.card-wrap, .card, .card-front, .card-back')].map(el=>{const r=el.getBoundingClientRect();return {class:el.className,w:r.width,h:r.height,hidden:getComputedStyle(el).display==='none'};}));
    assert(cardGeometry.length>0);for(const r of cardGeometry.filter(r=>!r.hidden)){assert(r.w>=28,r.class+' width collapsed');assert(r.h>=38,r.class+' height collapsed');}
    const secrets=await page.locator('.cell:not(.open) .letter').allTextContents();assert(secrets.every(text=>text===''),'unrevealed letters must not be exposed in card DOM');
    const heartSize=await page.locator('.heart').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert(heartSize>=24,'hearts must be readable');
    await page.screenshot({path:path.join(evidence,engine+'-'+viewport.width+'x'+viewport.height+'.png'),fullPage:true});assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
 }
 }finally{await browser.close();}
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/cryptographer/';try{for(const engine of (process.env.TEST_ENGINES||'chromium,webkit').split(','))await runEngine(engine,url);}finally{server.close();fs.writeFileSync(path.join(evidence,'acceptance-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));}console.log(results.filter(r=>r.pass).length+'/'+results.length+' passed');process.exitCode=results.some(r=>!r.pass)?1:0;})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
