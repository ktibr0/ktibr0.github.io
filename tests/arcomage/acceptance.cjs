// Independent integration acceptance, authored by the supervising agent.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');
const pw=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT||'C:/Users/alex_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','_resolve.cjs'))('playwright');
const live=process.env.ARCOMAGE_BASE_URL;
const evidence=path.join(root,'_work/arcomage',live?'live':'local',process.env.ARCOMAGE_RUN_ID||'initial');fs.mkdirSync(evidence,{recursive:true});
const results=[];const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff':'font/woff','.woff2':'font/woff2','.csv':'text/csv; charset=utf-8'};
async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+'\n'+e.stack)}}
async function waitForAsync(page,predicate){const deadline=Date.now()+30000;while(Date.now()<deadline){if(await page.evaluate(predicate))return;await page.waitForTimeout(100)}throw new Error('Asynchronous lifecycle condition did not complete');}
async function createServer(){
 let alteredWorker=false;
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(u.pathname);
  if(pathname==='/arcomage-hd')return res.writeHead(301,{Location:'/arcomage-hd/'}).end();
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end('missing');if(alteredWorker&&pathname==='/arcomage-hd/sw.js')data=Buffer.from(data.toString().replace(/gamecenter-arcomage-([a-f0-9]{20})/g,'gamecenter-arcomage-acceptance-update-$1'));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {server,url:'http://127.0.0.1:'+server.address().port,update:()=>alteredWorker=true,stop:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))}};
}
const ru=p=>p.getByRole('button',{name:'Настройки',exact:true});
async function ready(page){await page.locator('button.topbutton').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button.card')].some(e=>e.textContent.trim()));}
async function russian(page){await page.getByRole('button',{name:/^(Language|Язык|Sprache)$/}).click();await page.getByRole('button',{name:'Русский [Russian]',exact:true}).click();await ru(page).waitFor();await page.getByRole('button',{name:'Отмена',exact:true}).click();}
async function start(page){
 await ru(page).click();assert(await page.getByText('Вы играете против ИИ',{exact:true}).isVisible());
 await page.locator('#playerName').fill('Проверка');
 // Keep this two-action hosting smoke away from a random early victory:
 // ample resources make any drawn card playable, ample walls/towers survive it.
 await page.locator('#tower').fill('100');await page.locator('#wall').fill('100');
 for(const id of ['bricks','gems','recruits'])await page.locator('#'+id).fill('50');
 await page.locator('#winResource').fill('500');await page.locator('#winTower').fill('1000');
 await page.getByRole('button',{name:'Применить и начать игру',exact:true}).click();
 await page.locator('button.card.cursor-pointer.card-pos-m0').first().waitFor();
}
async function action(page,discard=false){
 let cards=page.locator('button.card.cursor-pointer.card-pos-m0:not(.pointer-events-none):not([disabled])');
 if(discard)cards=cards.filter({hasNotText:'Эту карту нельзя сбросить'});
 try{await cards.first().waitFor({timeout:45000})}catch(e){const id=Date.now();fs.writeFileSync(path.join(evidence,'action-failure-'+id+'.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(evidence,'action-failure-'+id+'.png')});throw e}
 const card=cards.first();const selected=await card.elementHandle();
 const text=await card.textContent();assert(text.trim(),'real face-up card');
 if(discard){
  // In touch mode upstream deliberately has no contextmenu handler. Exercise
  // its documented long-press timer, using DOM touch events in both engines.
  await selected.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:50,clientY:50}]});
  await page.waitForTimeout(650);await selected.dispatchEvent('touchend',{touches:[]});
 }else await card.tap();
 // Track the selected DOM node, not a live first-card locator: after a discard
 // React removes it, and after a play it moves through negative animation slots.
 await page.waitForFunction(el=>!el.isConnected||/\bcard-pos--\d+\b/.test(el.className),selected,{timeout:15000});
 await page.waitForTimeout(500);
}
async function sound(page){
 await page.getByRole('button',{name:'Звук и Графика',exact:true}).click();
 const mute=page.getByLabel('Заглушить',{exact:true});await mute.check();assert(await mute.isChecked());await mute.uncheck();assert(!(await mute.isChecked()));
 await page.getByLabel('Отключить анимацию',{exact:true}).check();await page.getByRole('button',{name:'Отмена',exact:true}).click();
}
async function scope(page,origin){
 await page.waitForFunction(()=>navigator.serviceWorker.controller);
 const state=await page.evaluate(async()=>({registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),keys:await caches.keys(),entries:await Promise.all((await caches.keys()).filter(k=>k.startsWith('gamecenter-arcomage-')).map(async k=>(await (await caches.open(k)).keys()).map(r=>r.url)))}));
 assert(state.registrations.includes(origin+'/arcomage-hd/'));assert(!state.registrations.includes(origin+'/'));
 assert(state.keys.includes('foreign-keep'));assert(!state.keys.includes('gamecenter-arcomage-obsolete'));
 for(const list of state.entries){assert(list.every(u=>u.startsWith(origin+'/arcomage-hd/')));assert.equal(list.filter(u=>u.endsWith('.mp3')).length,14,JSON.stringify(state));assert(list.filter(u=>/\/ru-[^/]+\.js$/.test(u)).length===3)}
}
(async()=>{
 for(const engine of (process.env.TEST_ENGINES||'chromium,webkit').split(',')){
  let host,browser,context,page,booted=false;const errors=[],missing=[],external=[],requests=[];let audioCapability;
  await check(engine+' setup and clean local boot with every external host blocked',async()=>{
   if(!live)host=await createServer();const origin=live||host.url;
   const executablePath=process.env['PLAYWRIGHT_'+engine.toUpperCase()+'_EXECUTABLE']||(engine==='chromium'?'C:/Users/alex_/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':'C:/Users/alex_/AppData/Local/ms-playwright/webkit-2359/Playwright.exe');
   browser=await pw[engine].launch({executablePath});context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true,locale:'ru-RU'});
   await context.addInitScript(()=>{if(window.AudioBufferSourceNode){const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__observedSoundStarts=(window.__observedSoundStarts||0)+1;return original.apply(this,args)}}});
   await context.route('**/*',route=>{const u=new URL(route.request().url());if(/^https?:/.test(u.protocol)&&u.origin!==new URL(origin).origin){
    // Neighboring games have their own optional web fonts. Keep blocking them,
    // but report only the ArcoMage document's external runtime dependencies.
    let frameURL='';try{frameURL=route.request().frame().url()}catch{}
    if(new URL(frameURL||origin).pathname.startsWith('/arcomage-hd/'))external.push(u.href);
    return route.abort();
   }return route.continue()});
   page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.status()+' '+r.url())});page.on('request',r=>requests.push(r.url()));
   // Keep the other application's document open. A separate no-app baseline
   // proved Windows WebKit loses CacheStorage entries when their creating
   // document navigates away, even though cache names remain. Holding an owner
   // tab tests foreign-data preservation without that runtime artifact.
   const owner=await context.newPage();await owner.goto(origin+'/');
   await owner.evaluate(async()=>{localStorage.setItem('arcomage-neighbor-sentinel','keep');window.__foreignCache=await caches.open('foreign-keep');await window.__foreignCache.put('/sentinel',new Response('keep'));await caches.open('gamecenter-arcomage-obsolete')});
   await page.goto(origin+'/arcomage-hd/');await ready(page);assert.equal(external.length,0);await russian(page);booted=true;audioCapability=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));
  });
  if(page&&booted){
   await check(engine+' Russian lazy chunks, audio/mute UI and AI game settings',async()=>{await sound(page);await start(page);assert((await page.locator('body').innerText()).includes('Кирпичи'));});
   await check(engine+' touch card play and discard reach real played-card state',async()=>{await action(page);await action(page,true);if(audioCapability)assert(await page.evaluate(()=>window.__observedSoundStarts>0),'native audio source actually started');await page.screenshot({path:path.join(evidence,engine+'-1180x820.png')});});
   await check(engine+' settings survive reload; isolated complete offline cache',async()=>{await page.reload();await ready(page);await ru(page).waitFor();await scope(page,new URL(live||host.url).origin);assert.equal(await page.evaluate(()=>localStorage.getItem('arcomage-neighbor-sentinel')),'keep');});
   await check(engine+' tablet/phone rotation, visible controls and screenshots',async()=>{
    for(const [width,height] of [[1024,768],[1024,600],[412,915],[360,800]]){
     await page.setViewportSize({width,height});await page.waitForTimeout(200);assert(await ru(page).isVisible());
     if(height>width){const rotate=page.getByRole('dialog',{name:'Пожалуйста, поверните устройство в альбомный режим',exact:true});assert(await rotate.isVisible());await page.screenshot({path:path.join(evidence,engine+'-'+width+'x'+height+'-rotate.png')});await rotate.getByRole('button',{name:'Отмена',exact:true}).click();}
     await ru(page).click();assert(await page.getByRole('button',{name:'Применить и начать игру',exact:true}).isVisible());await page.getByRole('dialog',{name:'Настройки',exact:true}).getByRole('button',{name:'Отмена',exact:true}).click();
     await page.screenshot({path:path.join(evidence,engine+'-'+width+'x'+height+'.png')});
    }await page.setViewportSize({width:1180,height:820});
   });
   await check(engine+' neighboring games retain storage and are not worker-controlled',async()=>{
    for(const slug of ['cryptographer','sumplete']){const neighbor=await context.newPage();await neighbor.goto((live||host.url)+'/'+slug+'/');await neighbor.waitForLoadState('load');assert.equal(await neighbor.evaluate(()=>navigator.serviceWorker.controller),null);assert.equal(await neighbor.evaluate(()=>localStorage.getItem('arcomage-neighbor-sentinel')),'keep');assert(!(await neighbor.locator('body').innerText()).includes('ArcoMage HD'));await neighbor.close();}
    assert(await page.evaluate(async()=>!!(await (await caches.open('foreign-keep')).match('/sentinel'))));
   });
   if(!live){
    await check(engine+' worker update retains foreign caches and installs new own version',async()=>{
     host.update();await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
     await waitForAsync(page,async()=>{const reg=await navigator.serviceWorker.getRegistration();if(reg.installing||reg.waiting||reg.active?.state!=='activated')return false;const keys=await caches.keys();const own=keys.filter(k=>k.startsWith('gamecenter-arcomage-'));if(own.length!==1||!own[0].startsWith('gamecenter-arcomage-acceptance-update-'))return false;return(await(await caches.open(own[0])).keys()).length===220});await scope(page,host.url);
    });
    await check(engine+' offline reopen and play with actual origin shut down',async()=>{
     await host.stop();host=null;const url=page.url();await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
     await page.goto(new URL('index.html',url).href);await ready(page);await ru(page).waitFor();await start(page);await action(page);await action(page,true);
     await page.getByRole('button',{name:'Язык',exact:true}).click();await page.getByRole('button',{name:'Deutsch [German]',exact:true}).click();await page.getByRole('button',{name:'Voreinstellungen',exact:true}).waitFor();
     await page.screenshot({path:path.join(evidence,engine+'-offline-german.png')});
    });
   }else if(engine==='webkit'){
    // Reproduced by this release and by an upstream literal-Response control:
    // https://github.com/microsoft/playwright/issues/42775 . The same engine
    // must still pass the local actual-origin-stopped scenario above.
    results.push({name:engine+' cached reload in browser offline mode',skipped:true,reason:'WebKit 2359 setOffline rejects even service-worker responses (Playwright #42775); actual-origin-stopped acceptance passed locally; physical iPad untested'});
    console.log('SKIP webkit public setOffline emulation: #42775; local actual-origin outage passed');
   }else{
    await check(engine+' cached reload in browser offline mode',async()=>{await context.setOffline(true);await page.reload();await ready(page);await ru(page).waitFor();await start(page);await action(page);await context.setOffline(false)});
   }
   await check(engine+' no missing assets, page errors or external runtime requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(external,[]);});
  }
  fs.writeFileSync(path.join(evidence,engine+'-network.json'),JSON.stringify({audioCapability,errors,missing,external,requests},null,2));
  if(context)await context.close();if(browser)await browser.close();if(host)await host.stop();
 }
 fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2));
 console.log(results.filter(r=>r.pass).length+' PASS / '+results.filter(r=>r.pass===false).length+' FAIL / '+results.filter(r=>r.skipped).length+' SKIP');if(results.some(r=>r.pass===false))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
