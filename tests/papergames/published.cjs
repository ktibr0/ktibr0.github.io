// Post-deployment artifact verification, authored by the supervising agent.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');const base=(process.env.PAPERGAMES_BASE_URL||'https://ktibr0.github.io').replace(/\/$/,'');
const output=path.join(root,'_work/papergames/published-files.json');
const collect=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?collect(dir+'/'+e.name):[dir+'/'+e.name]);
const files=['index.html',...collect('library'),...collect('papergames')];
const normalized=(buffer,file)=>/\.png$/.test(file)?buffer:Buffer.from(buffer.toString('utf8').replace(/\r\n/g,'\n'));
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
(async()=>{
 const queue=files.slice();const results=[];
 async function worker(){while(queue.length){const file=queue.shift();try{
  const res=await fetch(base+'/'+file+'?release='+encodeURIComponent(process.env.PAPERGAMES_RELEASE_SHA||'papergames-20261016'),{signal:AbortSignal.timeout(30000),cache:'no-store'});
  const body=Buffer.from(await res.arrayBuffer());const actual=hash(normalized(body,file));const expected=hash(normalized(fs.readFileSync(path.join(root,file)),file));
  results.push({file,status:res.status,pass:res.status===200&&actual===expected,actual,expected});
 }catch(e){results.push({file,pass:false,error:e.message});}}}
 await Promise.all(Array.from({length:6},worker));results.sort((a,b)=>a.file.localeCompare(b.file));
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({base,date:new Date().toISOString(),results},null,2));
 const failed=results.filter(x=>!x.pass);for(const x of failed)console.error('FAIL '+x.file+' '+(x.error||'HTTP '+x.status+' / hash mismatch'));
 console.log(JSON.stringify({verified:results.length-failed.length,failed:failed.length}));if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
