// Independent integration acceptance authored by the supervising agent.
// Execution belongs to a separate Luna 6 low agent. Never change expectations for PASS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../..');
const pw = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT || 'C:/Users/alex_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', '_resolve.cjs'))('playwright');
const live = !!process.env.PAPERGAMES_BASE_URL;
const evidence = path.join(root, '_work/papergames', live ? 'live' : 'local');
fs.mkdirSync(evidence, {recursive:true});
const slugs = ['sudoku','nonogram','kakuro','hashi','skyscrapers','klondike','freecell'];
const results = [];
let failedAsset = false;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.csv':'text/csv; charset=utf-8'};
const server = http.createServer((req,res) => {
 const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
 if (pathname === '/__foreign__/sw.js') return res.writeHead(200, {'Content-Type':'text/javascript'}).end('self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));');
 if (failedAsset && pathname.endsWith('/nonogram-core.js')) return res.writeHead(503).end('deliberate offline install failure');
 const target = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
 if (!target.startsWith(root + path.sep)) return res.writeHead(403).end();
 fs.readFile(target, (err,data) => {if(err) return res.writeHead(404).end();res.writeHead(200, {'Content-Type':mime[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);});
});
async function check(name, fn) {
 try {await fn();results.push({name,pass:true});console.log('PASS '+name);}
 catch(e) {results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+'\n'+e.stack);}
}
async function open(context, url) {
 const page=await context.newPage();const errors=[];const external=[];const missing=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).origin!==new URL(url).origin && /^https?:/.test(r.url())) external.push(r.url());});
 page.on('response',r=>{if(r.status()>=400)missing.push(r.status()+' '+r.url());});
 await page.goto(url, {waitUntil:'load'});return {page,errors,external,missing};
}
async function start(page, slug) {
 const picker=page.locator('#'+slug+'-level-inline');
 if(await picker.count()) await picker.selectOption('easy');
 await page.locator('#start-'+slug+'-game').click();
 await page.locator('#board-container').waitFor({state:'visible', timeout:45000});
 await page.waitForFunction(key=>!!localStorage.getItem(key),'einkchess_save_'+slug);
}
const save = (p, slug) => p.evaluate(s=>JSON.parse(localStorage.getItem('einkchess_save_'+s)),slug);
async function action(page,slug) {
 if(slug==='sudoku') {
  const s=await save(page,slug);const i=s.puzzle.findIndex(v=>!v);
  await page.locator('.sudoku-cell[data-index="'+i+'"]').click();
  await page.locator('#sudoku-numpad button').filter({hasText:new RegExp('^'+s.solution[i]+'$')}).click();
 } else if(slug==='kakuro') {
  const cell=page.locator('.kakuro-cell-white').first();const r=+(await cell.getAttribute('data-row'));const c=+(await cell.getAttribute('data-col'));const s=await save(page,slug);
  await cell.click();await page.locator('#kakuro-numpad button').filter({hasText:new RegExp('^'+s.solution[r][c]+'$')}).click();
 } else if(slug==='skyscrapers') {
  const s=await save(page,slug);await page.locator('.skyscrapers-cell-board[data-index="0"]').click();
  await page.locator('#skyscrapers-numpad button').filter({hasText:new RegExp('^'+s.solution[0]+'$')}).click();
 } else if(slug==='nonogram') {
  await page.locator('.nonogram-cell').first().click();
 } else if(slug==='hashi') {
  const ids=await page.evaluate(()=>{const e=AppStateHashi.board.edges[0];const is=AppStateHashi.board.islands;return [is.findIndex(i=>i.row===e.r1&&i.col===e.c1),is.findIndex(i=>i.row===e.r2&&i.col===e.c2)];});
  for(const id of ids) {assert(id>=0);await page.locator('.hashi-island[data-island="'+id+'"]').click();}
 } else if(slug==='klondike') {
  await page.locator('#klondike-stock').click();
 } else if(slug==='freecell') {
  await page.locator('.freecell-column[data-col="0"] .freecell-card').last().click();
  await page.locator('#freecell-freecells .freecell-cell').first().click();
 }
}
async function assertRU(page) {
 await page.waitForFunction(()=>document.documentElement.lang==='ru');
 assert.equal(await page.locator('html').getAttribute('lang'),'ru');
}
async function assertNoOverflow(page) {
 const sizes=await page.evaluate(()=>({screen:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert(sizes.scroll<=sizes.screen+2,JSON.stringify(sizes));
}
async function ready(page) {
 const btn=page.locator('#library-offline-save');
 if(await btn.isVisible() && await btn.isEnabled()) await btn.click();
 await page.waitForFunction(()=>document.querySelector('#library-offline-status')?.dataset.state==='ready',null,{timeout:120000});
}
async function run(engine,base) {
 const executablePath=process.env['PLAYWRIGHT_'+engine.toUpperCase()+'_EXECUTABLE'];
 const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
 try {
 await check(engine+' unified catalogs, seven direct links, credits and manifest',async()=>{
  const context=await browser.newContext({viewport:{width:1024,height:768}});
  try{
   const sets=[];
   for(const route of ['/', '/papergames/index.html']) {
    const {page,errors}=await open(context,base+route);await assertRU(page);
    for(const s of slugs) assert.equal(await page.locator('a.card[href$="papergames/'+s+'.html"], a.card[href="'+s+'.html"]').count(),1,s+' direct card');
    sets.push(await page.locator('a.card').evaluateAll(as=>as.map(a=>new URL(a.href).pathname).sort()));
    assert.equal(sets.at(-1).length,12);
    const credit=page.locator('.papergames-credit');assert(await credit.isVisible());assert.match(await credit.innerText(),/Christopher Müller/);
    assert(await credit.locator('a[href*="YourChaosChris/PaperGames"]').count());
    const manifest=page.locator('link[rel="manifest"]');assert.equal(await manifest.count(),1);
    const m=await (await context.request.get(new URL(await manifest.getAttribute('href'),page.url()).href)).json();
    assert(new URL(m.start_url,new URL(await manifest.getAttribute('href'),page.url())).pathname.startsWith('/papergames/'));
    await assertNoOverflow(page);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(evidence,engine+'-catalog-'+(route==='/'?'root':'offline')+'.png'),fullPage:true});await page.close();
   }
   assert.deepEqual(sets[0],sets[1],'same catalog routes');
  }finally{await context.close();}
 });
 for(const slug of slugs) await check(engine+' '+slug+' UI move, undo, reload, local rules, credits',async()=>{
  const context=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'});
  try{
   const {page,errors,external,missing}=await open(context,base+'/papergames/'+slug+'.html');await assertRU(page);
   assert(await page.locator('a.library-back').isVisible());assert(await page.locator('.papergames-credit').isVisible());
   await start(page,slug);const before=await save(page,slug);await action(page,slug);const after=await save(page,slug);
   assert.equal(after.moveCount,before.moveCount+1,'actual UI changed move counter');assert.notDeepEqual(after,before);
   await page.locator('#undo-btn').click();assert.deepEqual(await save(page,slug),before,'UI undo restores save');
   await action(page,slug);const persisted=await save(page,slug);await page.reload();await page.locator('#board-container').waitFor({state:'visible'});
   assert.deepEqual(await save(page,slug),persisted,'reload restores exact game');
   await assertNoOverflow(page);await page.screenshot({path:path.join(evidence,engine+'-'+slug+'-tablet.png'),fullPage:true});
   const rules=page.locator('a[href*="'+slug+'-rules.html"]').first();assert(await rules.count(),'reachable rules link');
   const rulesUrl=new URL(await rules.getAttribute('href'),page.url()).href;await page.goto(rulesUrl);await assertRU(page);
   assert(await page.locator('a.library-back').isVisible());assert.match(await page.locator('body').innerText(),/[А-Яа-яЁё]{4}/);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[],'no external runtime requests');assert.deepEqual(missing,[],'no missing local assets');
  }finally{await context.close();}
 });
 await check(engine+' small phone, landscape, rotation and reachable controls',async()=>{
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  try{
   for(const slug of slugs){const {page,errors}=await open(context,base+'/papergames/'+slug+'.html');await start(page,slug);
    for(const viewport of [{width:360,height:800},{width:412,height:915},{width:1180,height:820},{width:1024,height:600}]){
     await page.setViewportSize(viewport);await page.waitForTimeout(150);await assertNoOverflow(page);
     await page.locator('a.library-back').scrollIntoViewIfNeeded();assert(await page.locator('a.library-back').isVisible());
     if(viewport.width===360)await page.screenshot({path:path.join(evidence,engine+'-'+slug+'-phone.png'),fullPage:true});
    }
    const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[,.\s]|$)/i.test(viewport));assert.deepEqual(errors,[]);await page.close();}
  }finally{await context.close();}
 });
 await check(engine+' corrupt and denied storage keep all seven playable',async()=>{
  for(const blocked of [false,true]){
   const context=await browser.newContext();
   await context.addInitScript(({blocked,slugs})=>{
    if(blocked){for(const m of ['getItem','setItem','removeItem'])Storage.prototype[m]=()=>{throw new DOMException('Blocked','SecurityError');};}
    else if(!sessionStorage.getItem('corrupted')){for(const s of slugs)localStorage.setItem('einkchess_save_'+s,'{broken');sessionStorage.setItem('corrupted','yes');}
   },{blocked,slugs});
   try{for(const slug of slugs){const {page,errors}=await open(context,base+'/papergames/'+slug+'.html');const picker=page.locator('#'+slug+'-level-inline');if(await picker.count())await picker.selectOption('easy');await page.locator('#start-'+slug+'-game').click();await page.locator('#board-container').waitFor({state:'visible'});assert.deepEqual(errors,[]);await page.close();}}
   finally{await context.close();}
  }
 });
 await check(engine+' fresh install caches unopened games and rules for offline navigation',async()=>{
  const context=await browser.newContext({viewport:{width:1024,height:768}});
  try{
   const {page}=await open(context,base+'/papergames/index.html');await ready(page);
   const scopes=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname));
   assert.deepEqual(scopes,['/papergames/']);
   await context.setOffline(true);
   for(const slug of slugs){await page.goto(base+'/papergames/'+slug+'.html');await assertRU(page);await start(page,slug);await action(page,slug);const s=await save(page,slug);await page.reload();await page.locator('#board-container').waitFor({state:'visible'});assert.deepEqual(await save(page,slug),s);
    const rules=page.locator('a[href*="'+slug+'-rules.html"]').first();await rules.click();await assertRU(page);await page.locator('a.library-back').first().click();assert.equal(new URL(page.url()).pathname,'/papergames/index.html');}
   await page.close();const again=await context.newPage();await again.goto(base+'/papergames/index.html');assert.equal(await again.locator('a.card').count(),12);
  }finally{await context.close();}
 });
 if(!live){
 await check(engine+' failed initial precache never claims ready and recovers on retry',async()=>{
  const context=await browser.newContext();failedAsset=true;
  try{
   const {page}=await open(context,base+'/papergames/index.html');await page.locator('#library-offline-save').click();
   await page.waitForFunction(()=>document.querySelector('#library-offline-status')?.dataset.state==='error',null,{timeout:60000});
   assert.notEqual(await page.locator('#library-offline-status').getAttribute('data-state'),'ready');failedAsset=false;await ready(page);
  }finally{failedAsset=false;await context.close();}
 });
 await check(engine+' install and force update preserve foreign cache, registration and saves',async()=>{
  const context=await browser.newContext();
  try{
   const {page}=await open(context,base+'/');await page.evaluate(async()=>{await (await caches.open('foreign-application-v1')).put('/__foreign__/sentinel',new Response('keep'));await navigator.serviceWorker.register('/__foreign__/sw.js',{scope:'/__foreign__/'});localStorage.setItem('other-game-save','keep');});
   await ready(page);await page.goto(base+'/papergames/sudoku.html');await start(page,'sudoku');await action(page,'sudoku');const before=await save(page,'sudoku');
   await page.evaluate(()=>ForceUpdate.run(null,null));await page.waitForTimeout(1500);await page.waitForLoadState('load');
   const sentinel=await page.evaluate(async()=>({cache:await (await (await caches.open('foreign-application-v1')).match('/__foreign__/sentinel'))?.text(),scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname),save:localStorage.getItem('other-game-save')}));
   assert.equal(sentinel.cache,'keep');assert(sentinel.scopes.includes('/__foreign__/'));assert.equal(sentinel.save,'keep');assert.deepEqual(await save(page,'sudoku'),before);
   assert(!sentinel.scopes.includes('/'),'no root worker');
  }finally{await context.close();}
 });
 }
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=(process.env.PAPERGAMES_BASE_URL || 'http://127.0.0.1:'+server.address().port).replace(/\/$/,'');
 try{for(const engine of ['chromium','webkit'])await run(engine,base);}
 finally{server.close();fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({base,date:new Date().toISOString(),results},null,2));}
 const failed=results.filter(x=>!x.pass).length;console.log(JSON.stringify({passed:results.length-failed,failed}));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
