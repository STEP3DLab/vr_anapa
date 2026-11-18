import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://step3dlab.github.io/vr_anapa/',prefix='mobot-ch-hv-1986-research-v7';
const files=[prefix+'.html',prefix+'-model.js',prefix+'-passport.json',prefix+'-qa.json',
  ...['viewer.js','archive-camera.mjs','overview.jpg','comparison.jpg','whole-machine.jpg','registration/registration.json','experiments/track-photo.jpg','experiments/roadwheel-faces.jpg','experiments/roadwheel-faces.json','experiments/control-views.jpg','experiments/hanger-cage.jpg','experiments/hanger-cage.json'].map(n=>'research/mobot/1986/v7/'+n)];
const sha=b=>createHash('sha256').update(b).digest('hex');
let results=[];
for(let attempt=1;attempt<=20;attempt++){
  results=await Promise.all(files.map(async file=>{
    try{
      const res=await fetch(base+file+'?check='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(15000)});
      const actual=sha(Buffer.from(await res.arrayBuffer())),expected=sha(await fs.readFile(file));
      return {file,status:res.ok&&actual===expected?'PASS':'FAIL',http:res.status,actual,expected};
    }catch(e){return {file,status:'FAIL',error:String(e)};}
  }));
  if(results.every(r=>r.status==='PASS'))break;
  if(attempt<20)await new Promise(resolve=>setTimeout(resolve,15000));
}
await fs.mkdir('v7-production-output',{recursive:true});
await fs.writeFile('v7-production-output/pages.json',JSON.stringify({base,commit:process.env.GITHUB_SHA,results},null,2));
if(results.some(r=>r.status!=='PASS'))throw Error('Pages bytes differ from checkout');
