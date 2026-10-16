// Public file verification authored by supervisor, executed by Luna low after deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'_work/sumplete-rsvp');
fs.mkdirSync(dir,{recursive:true});
const files=['sumplete/index.html','sumplete/app.js','sumplete/style.css','sumplete/game.js','sumplete/generator.js','rsvp/index.html','rsvp/app.js','rsvp/style.css'];
(async()=>{const out=[];for(const file of files){const res=await fetch('https://ktibr0.github.io/'+file+'?verify='+Date.now(),{signal:AbortSignal.timeout(30000)});assert.equal(res.status,200,file+' HTTP');const remote=(await res.text()).replace(/\r\n/g,'\n');const local=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');assert.equal(remote,local,file+' published content');out.push({file,status:res.status,match:true});console.log('PASS public '+file);}fs.writeFileSync(path.join(dir,'published-files.json'),JSON.stringify(out,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
