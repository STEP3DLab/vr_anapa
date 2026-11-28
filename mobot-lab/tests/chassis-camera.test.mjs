import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from '../engine/three.module.min.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=JSON.parse(read('data/chassis-camera-check.json'));
function project([x,y,z],fit,view){
 const p=new Vector3(-x,-y,z),[rx,ry,rz,tx,ty,tz]=fit.parameters;
 const theta=Math.hypot(rx,ry,rz);
 if(theta)p.applyAxisAngle(new Vector3(rx,ry,rz).divideScalar(theta),theta);
 p.add(new Vector3(tx,ty,tz));
 assert(p.z>0);
 return [fit.f*p.x/p.z+view.width/2,fit.f*p.y/p.z+view.height/2];
}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('Fixed wheel-only camera fits agree at the marked wheels, but disagree away from that plane',()=>{
 const out=[];
 for(const view of Object.values(check.views)){
  assert.equal(view.train.length,5);
  assert(view.hold.every(n=>!view.train.includes(n)));
  for(const fit of view.fits){
   for(const [label,xyz,xy] of [['train',view.trainXYZ,view.trainXY],['test',view.holdXYZ,view.holdXY]]){
    const rms=Math.sqrt(xyz.reduce((sum,p,i)=>sum+distance(project(p,fit,view),xy[i])**2,0)/xyz.length);
    assert(Math.abs(rms-fit[label])<1e-6);
   }
  }
  const [a,b]=view.fits.map(f=>project(view.probeXYZ[1],f,view));
  out.push(Math.round(distance(a,b)));
 }
 assert.deepEqual(out,[86,45]);
 assert.match(read('geometry-audit.html'),/Камера по шасси/);
 assert.match(read('offline-worker.js'),/data\/chassis-camera-check.json/);
});
