// Public file acceptance, independent of the adapter implementation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=process.env.ARCOMAGE_BASE_URL||'https://ktibr0.github.io';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'arcomage-hd/build-manifest.json')));
const rows=manifest.adaptation.outputFiles;const evidence=path.join(root,'_work/arcomage/live');fs.mkdirSync(evidence,{recursive:true});
const results=[];const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 let cursor=0;
 await Promise.all(Array.from({length:8},async()=>{while(cursor<rows.length){const row=rows[cursor++];try{
  const response=await fetch(base+'/arcomage-hd/'+row.path+'?acceptance='+manifest.adaptation.serviceWorkerCache);assert.equal(response.status,200,row.path);
  const data=Buffer.from(await response.arrayBuffer());const rawMatch=hash(data)===row.sha256;
  // Pages checkout honors .gitattributes eol=crlf, so it may publish checkout
  // bytes rather than normalized Git blobs. Accept only exact bytes or the
  // separately recorded LF canonical form of a text file; binaries stay exact.
  const canonical=/\.(html|js|css|json|webmanifest|svg|txt|md)$/.test(row.path)?Buffer.from(data.toString().replace(/\r\n/g,'\n')):data;
  assert(rawMatch||hash(canonical)===row.publishedSha256,'public contents '+row.path);results.push({file:row.path,pass:true,rawMatch});
 }catch(e){results.push({file:row.path,pass:false,error:e.message})}}}));
 for(const page of ['/','/papergames/index.html']){const response=await fetch(base+page);assert.equal(response.status,200);const html=await response.text();assert(/href="(?:\.\.\/)?arcomage-hd\/"/.test(html),'local ArcoMage link '+page)}
 fs.writeFileSync(path.join(evidence,'public-files.json'),JSON.stringify(results,null,2));const failed=results.filter(r=>!r.pass);console.log(results.length-failed.length+'/'+results.length+' matching public files ('+results.filter(r=>r.rawMatch).length+' byte-identical); local links in both catalogs');if(failed.length){console.error(failed);process.exitCode=1}
})().catch(e=>{console.error(e);process.exitCode=1});
