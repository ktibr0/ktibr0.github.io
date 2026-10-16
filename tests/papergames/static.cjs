// Supervising agent's independent source/provenance and scope assertions.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const slugs=['sudoku','nonogram','kakuro','hashi','skyscrapers','klondike','freecell'];
const baseline=cp.execFileSync('git',['show','f24dfce:index.html'],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
const main=read('index.html').replace(/\r\n/g,'\n');
for(const href of ['cryptographer/index.html','https://arcomage.github.io/','rsvp/index.html','jellybattle/index.html','sumplete/index.html']){
 const block=html=>{const s=html.indexOf('<a class="card" href="'+href+'"');assert(s>=0,href);return html.slice(s,html.indexOf('</a>',s)+4);};
 assert.equal(block(main),block(baseline),'preserve existing card '+href);
}
const changed=cp.execFileSync('git',['diff','f24dfce','--name-only'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
for(const f of changed)assert(!/^(?:jellybattle\/|jellybattle\.zip$|rsvp\/|sumplete\/|cryptographer\/)/.test(f),'protected game modified '+f);
const fixture=JSON.parse(read('tests/papergames/upstream-hashes.json'));
for(const [file,expected] of Object.entries(fixture.files)){
 const content=Buffer.from(read('papergames/'+file).replace(/\r\n/g,'\n'));
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+content.length+'\0')).update(content).digest('hex');
 assert.equal(blob,expected,'unmodified upstream '+file);
}
const provenance=read('papergames/UPSTREAM.json');assert(provenance.includes(fixture.commit),'pinned provenance');
assert(read('papergames/LICENSE').includes('Copyright (c) 2025 Christopher Müller'));
for(const slug of slugs){
 const html=read('papergames/'+slug+'.html');assert(html.includes(slug+'-core.js'));assert(html.includes(slug+'-app.js'));
 assert(!/user-scalable\s*=\s*no/i.test(html));
 assert(fs.existsSync(path.join(root,'papergames',slug+'-rules.html')));
}
// Every static local HTML dependency must exist; external credit links are allowed.
for(const file of fs.readdirSync(path.join(root,'papergames')).filter(f=>f.endsWith('.html'))){
 const html=read('papergames/'+file);
 for(const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)){
  const value=m[1];if(/^(?:https?:|mailto:|tel:|data:|#)/.test(value))continue;
  const pathname=new URL(value,'http://local/papergames/'+file).pathname;
  const local=path.join(root,decodeURIComponent(pathname));
  assert(fs.existsSync(local),'missing local reference '+file+' -> '+value);
 }
}
console.log('PASS: protected cards/games, pinned original engines/licenses, seven pages, local dependencies');
