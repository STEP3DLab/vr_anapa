// From repository root: node research/mobot/1987/night-20261118/photo-side.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v21-model.js';
globalThis.document = {createElement: () => ({getContext: () => null})};
const model = makeMobot(T,'desktop');
model.root.updateMatrixWorld(true);
const side = model.parts.tracks.children.find(g => g.position.z < 0);
const discs = side.children.filter(o => o.geometry?.type === 'CylinderGeometry' &&
  o.geometry.parameters.height === .115).sort((a,b) => b.position.x-a.position.x);
assert.equal(discs.length,9);
const ids = ['rear','r1','r2','r3','r4','r5','r6','r7','front'];
const file = name => new URL(name,import.meta.url);
const views = JSON.parse(fs.readFileSync(file('photo-side.json'))).views;
const out = {};
for (const {id,width,height,fit,centres,visibleSpan} of views) {
  const camera = new T.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,100);
  camera.position.z=-10;
  camera.lookAt(0,0,0);
  camera.updateMatrixWorld();
  function project(pt) {
    const n=pt.clone().project(camera);
    return [(n.x+1)*width/2,(1-n.y)*height/2];
  }
  const points=Object.fromEntries(ids.map((k,i)=>[k,discs[i].getWorldPosition(new T.Vector3())]));
  const delta=([a,b])=>[b[0]-a[0],b[1]-a[1]];
  const angle=v=>Math.atan2(v[1],v[0]);
  const predicted=delta(fit.map(k=>project(points[k])));
  const measured=delta(fit.map(k=>centres[k]));
  camera.rotateZ(angle(measured)-angle(predicted));
  camera.zoom=Math.hypot(...measured)/Math.hypot(...predicted);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const shift=delta([centres[fit[0]],project(points[fit[0]])]);
  camera.translateX(shift[0]/camera.zoom);
  camera.translateY(-shift[1]/camera.zoom);
  camera.updateMatrixWorld();
  const residuals={}, circles={};
  for (const [i,k] of ids.entries()) {
    const disc=discs[i], p=project(points[k]);
    circles[k]={centre:p,radius:disc.geometry.parameters.radiusTop*camera.zoom};
    if (!centres[k]) continue;
    const d=delta([centres[k],p]);
    residuals[k]={projected:p,delta:d,error:Math.hypot(...d),fit:fit.includes(k)};
  }
  assert(fit.every(k=>residuals[k].error<1e-8));
  const test=Object.values(residuals).filter(r=>!r.fit);
  const rms=Math.sqrt(test.reduce((s,r)=>s+r.error**2,0)/test.length);
  out[id]={camera:camera.toJSON().object, circles,residuals,rms,
    relativeRms:rms/(visibleSpan[1]-visibleSpan[0])};
}
fs.writeFileSync(file('photo-side-v21.json'),JSON.stringify(out,null,2)+'\n');
