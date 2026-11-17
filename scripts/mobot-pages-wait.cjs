// Wait for this checkout's exact viewer bytes, not merely an HTTP 200 from an old deployment.
const fs=require('node:fs'),crypto=require('node:crypto');
const base='https://step3dlab.github.io/vr_anapa/';
const files=['mobot-demo.html','mobot-compare.html','mobot-assets/compare-v1.js','mobot-assets/compare-v1.css','mobot-assets/exhibition-v1.css','mobot-latest.html','mobot-demo-release-2026-11-18.json','mobot-roof.html','mobot-ch-hv-1986-research-v5.html','mobot-engineering-v20.html','mobot-assets/exhibition-v1.js','mobot-ch-hv-1986-research-v5-model.js','mobot-engineering-v20-model.js','mobot-backup.html','mobot-photo-measure-v2.html'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{for(let attempt=1;attempt<=20;attempt++){
 const checks=await Promise.all(files.map(async file=>{try{const r=await fetch(base+file+'?qa='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(15000),cache:'no-store'});const bytes=Buffer.from(await r.arrayBuffer());return {file,status:r.status,sha256:hash(bytes),matches:r.ok&&hash(bytes)===hash(fs.readFileSync(file))};}catch(e){return {file,matches:false,error:String(e)}}}));
 if(checks.every(c=>c.matches)){fs.writeFileSync('mobot-qa/demo-2026-11-18/published-byte-check.json',JSON.stringify({base,commit:process.env.GITHUB_SHA,checked:new Date().toISOString(),checks},null,2));console.log('Published viewer files match checkout');return;}
 console.log('Waiting for Pages deployment',attempt,checks.filter(c=>!c.matches).map(c=>c.file));if(attempt<20)await new Promise(r=>setTimeout(r,15000));
 }throw Error('Published files did not match this checkout within deployment window');})().catch(e=>{console.error(e);process.exitCode=1});
