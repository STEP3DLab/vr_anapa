/** Full delivery route using only drive/turn inputs: no teleport or pose assignment. */
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(tmpdir(),'vr-route-'));
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
try{
 await build({absWorkingDir:root,entryPoints:['src/cargoScene.ts'],outfile:join(temp,'cargo.mjs'),bundle:true,format:'esm',platform:'node'});
 const {createCargoScene}=await import(pathToFileURL(join(temp,'cargo.mjs')));
 const cargo=createCargoScene(()=>{});let time=0;
 const dt=1/60,step=(drive=0,turn=0)=>{cargo.update(dt,drive,turn,true);time+=dt;};
 const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
 function align(yaw){for(let i=0;i<40;i++)step();for(let i=0;i<300;i++){const e=delta(yaw,cargo.robot.rotation.y);if(Math.abs(e)<.0001)return;step(0,Math.max(-1,Math.min(1,e/(1.65*dt))));}throw Error('Turn blocked');}
 function go(x,z){
  const p=cargo.robot.position;align(Math.atan2(-(x-p.x),-(z-p.z)));
  for(let i=0;i<2000;i++){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.06){for(let k=0;k<35;k++)step();return;}
   const yaw=Math.atan2(-dx,-dz);step(Math.min(1,d*1.7),Math.max(-1,Math.min(1,delta(yaw,cargo.robot.rotation.y)*3)));}
  throw Error('Drive blocked at '+JSON.stringify(p));
 }
 function handle(){cargo.interact();assert.ok(cargo.busy,'Pickup or unload must be available');for(let i=0;i<370;i++)step();}
 function route(points){for(const p of points)go(...p);align(0);for(let i=0;i<20;i++)step();}
 route([[-5,1],[-5,0]]);handle();route([[-5,1],[0,1],[0,2]]);handle();assert.equal(cargo.delivered,1);
 route([[6,2],[6,-7]]);handle();route([[6,2],[0,2]]);handle();assert.equal(cargo.delivered,2);
 route([[.55,2],[.55,-10],[-5,-10],[-5,-15]]);handle();route([[-5,-10],[.55,-10],[.55,2],[0,2]]);handle();
 assert.equal(cargo.delivered,3);assert.ok(cargo.finished);assert.equal(cargo.collisions,0);assert.ok(time<180);
 console.log(`PASS: complete non-teleport cargo route in ${time.toFixed(2)} simulated seconds; ${Math.round(cargo.distance)} metres; zero collisions. Not a human or headset playtest.`);
 cargo.dispose();
}finally{rmSync(temp,{recursive:true,force:true});}
