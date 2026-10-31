// Checks actual catalog clicks after the migration has passed game acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');const root=path.resolve(__dirname,'../..');
const pw=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT||'C:/Users/alex_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','_resolve.cjs'))('playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');const file=path.resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(e?'missing':d)})});
const results=[];
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.ARCOMAGE_BASE_URL||'http://127.0.0.1:'+server.address().port;
try{for(const engine of ['chromium','webkit']){
 const browser=await pw[engine].launch({executablePath:process.env['PLAYWRIGHT_'+engine.toUpperCase()+'_EXECUTABLE']||(engine==='chromium'?'C:/Users/alex_/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe':'C:/Users/alex_/AppData/Local/ms-playwright/webkit-2359/Playwright.exe')});
 try{for(const entry of ['/','/papergames/index.html']){const context=await browser.newContext({viewport:{width:1180,height:820},hasTouch:true});try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+entry);
  const link=page.locator('a.card').filter({hasText:'ArcoMage HD'});assert.equal(await link.count(),1);assert.equal(new URL(await link.getAttribute('href'),page.url()).pathname,'/arcomage-hd/');assert.equal(await link.getAttribute('target'),null);
  await link.click();await page.waitForURL(base+'/arcomage-hd/');await page.locator('button.topbutton').first().waitFor();assert.deepEqual(errors,[]);results.push({engine,entry,pass:true});console.log('PASS '+engine+' catalog '+entry+' opens own ArcoMage in same tab');
 }finally{await context.close()}}}finally{await browser.close()}
}}finally{server.closeAllConnections();server.close();const dir=path.join(root,'_work/arcomage',process.env.ARCOMAGE_BASE_URL?'live':'local');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'navigation-results.json'),JSON.stringify(results,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
