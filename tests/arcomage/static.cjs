// Authored by the supervising agent. Independent runner must not change assertions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),game=path.join(root,'arcomage-hd');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(game,'build-manifest.json')));
const read=p=>fs.readFileSync(path.join(game,p));
assert.equal(manifest.source.inputFileCount,219);
assert.equal(manifest.source.inputTreeSha256,'0421223b617ddf5fed9ffe179ea6ad6244b8bba792312f41d1c182e13ae463dc');
for(const row of manifest.source.inputFiles) assert.equal(hash(read('dist/'+row.path)),row.sha256,'preserved input '+row.path);
for(const row of manifest.adaptation.outputFiles){
 const data=read(row.path);assert.equal(hash(data),row.sha256,'output hash '+row.path);
 const published=/\.(html|js|css|json|webmanifest|svg|txt|md)$/.test(row.path)?Buffer.from(data.toString().replace(/\r\n/g,'\n')):data;
 assert.equal(hash(published),row.publishedSha256,'public blob hash '+row.path);
}
for(const row of manifest.source.inputFiles) {
 if(['index.html','sw.js','registerSW.js'].includes(row.path))continue;
 let expected=read('dist/'+row.path);
 if(/\.(html|js|css|json|webmanifest|svg|txt)$/.test(row.path)) {
  let text=expected.toString().replaceAll('/assets/','/arcomage-hd/assets/');
  if(row.path==='assets/index-KFx7dIeg.js'){
   text=text.replace('return"/"+e','return"/arcomage-hd/"+e');
   // Explicitly reviewed audio-only startup guards. No game rules changed.
   const guards=[
    ['const _i=new(window.AudioContext||window.webkitAudioContext)','const _i=(()=>{const Context=window.AudioContext||window.webkitAudioContext;try{return Context?new Context:null}catch{return null}})()'],
    ['xi=()=>{"suspended"===_i.state?_i.resume().then(()=>{wi()}):wi()}','xi=()=>{_i&&"suspended"===_i.state?_i.resume().then(()=>{wi()}):wi()}'],
    ['const vi=_i.createGain();vi.gain.value=.5,vi.connect(_i.destination);','const vi=_i?_i.createGain():{gain:{value:.5},connect(){}};vi.gain.value=.5,_i&&vi.connect(_i.destination);'],
    ['Ai=async e=>{const t=await fetch(e),n=await t.arrayBuffer();return await _i.decodeAudioData(n)}','Ai=async e=>{if(!_i)return null;const t=await fetch(e),n=await t.arrayBuffer();return await _i.decodeAudioData(n)}'],
    ['Hi[r].then(e=>{if("suspended"===_i.state)_i.resume();else if("running"===_i.state){','Hi[r].then(e=>{if(!_i||!e)return;if("suspended"===_i.state)_i.resume();else if("running"===_i.state){'],
   ];for(const [from,to]of guards){assert.equal(text.split(from).length-1,1);text=text.replace(from,to)}
  }
  expected=Buffer.from(text);
 }
 assert.deepEqual(read(row.path),expected,'only agreed URL changes: '+row.path);
}
const html=read('index.html').toString();
assert(!html.includes('https://arcomage.github.io/'));
for(const m of html.matchAll(/(?:src|href)="(\/[^"\s]+)"/g))assert(m[1].startsWith('/arcomage-hd/'),m[1]);
const webmanifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(new URL(webmanifest.scope,'https://test/arcomage-hd/manifest.webmanifest').pathname,'/arcomage-hd/');
assert(read('registerSW.js').toString().includes("scope: '/arcomage-hd/'"));
assert(read('CREDIT.md').toString().includes('3DO Copyright Notice'));
assert(read('LICENSES.txt').length>50000);
// Inspect the actual generated worker's lifecycle with real Request/Response and
// an in-memory CacheStorage. An unknown navigation must never receive the game.
const listeners={},deleted=[];let entries=[];
const cache={addAll:async urls=>{entries=urls},match:async request=>{
 const url=typeof request==='string'?request:request.url;
 return entries.includes(new URL(url,'https://test').pathname)?new Response('cached '+url):undefined;
}};
let pending;
const context={URL,Response,Request,console,fetch:async()=>new Response('network',{status:404}),caches:{open:async()=>cache,match:async request=>cache.match(request),keys:async()=>['papergames-v1','foreign-cache','gamecenter-arcomage-obsolete'],delete:async k=>{deleted.push(k)}},self:{location:{origin:'https://test'},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(n,fn)=>listeners[n]=fn}};
vm.runInNewContext(read('sw.js').toString(),context);
(async()=>{
 listeners.install({waitUntil:p=>pending=p});await pending;
 for(const row of manifest.adaptation.outputFiles.filter(r=>r.path!=='sw.js'))assert(entries.includes('/arcomage-hd/'+row.path),'precache '+row.path);
 assert(entries.every(p=>p.startsWith('/arcomage-hd/')&&!p.includes('/dist/')));
 assert.equal(entries.filter(p=>p.endsWith('.mp3')).length,14);
 listeners.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(deleted,['gamecenter-arcomage-obsolete']);
 for(const pathname of ['/sumplete/','/cryptographer/','/papergames/','/arcomage-hd/missing.html','/arcomage-hd/missing.js']){
  let intercepted=false;listeners.fetch({request:{method:'GET',url:'https://test'+pathname,mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,'no interception '+pathname);
 }
 console.log('PASS input/output hashes, exact adaptation boundaries, resource scope, notices, full precache, isolated activation/fetch');
})().catch(e=>{console.error(e);process.exitCode=1});
