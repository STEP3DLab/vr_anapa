// Local cheek comparison; absolute pose, depth and aperture cannot be recovered by this registration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as before} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as after} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const views={
  SKTB2:{file:'before-dispatch', fit:[[935,316],[874,332]], test:[[933,364],[925,388],[873,400]],role:'development'},
  SKTB3:{file:'front', fit:[[647,548],[556,578]], test:[[641,622],[630,653],[555,677]],role:'independent'}
};
const v=([x,y])=>new T.Vector2(x,y);
function corners(build){
  const m=build(T,'desktop').mechanisms;
  m.setPose({yaw:90,wrist:90,claw:22});
  const jaw=m.fingers.find(f=>f.side===1).group;
  const plate=jaw.children.find(c=>c.geometry?.type==='ExtrudeGeometry'&&c.position.z>0);
  const attr=plate.geometry.attributes.position;
  const local=Array.from({length:attr.count},(_,i)=>new T.Vector3().fromBufferAttribute(attr,i));
  const maxZ=Math.max(...local.map(p=>p.z));
  // Camera in plate coordinates, looking down on the outside face.
  const cam=new T.OrthographicCamera(-1,1,1,-1,.01,10);
  cam.position.z=2;cam.up.set(1,0,0);cam.lookAt(0,0,0);cam.updateMatrixWorld();
  const inv=jaw.matrixWorld.clone().invert();
  const pts=[];
  for(const p of local.filter(p=>p.z>maxZ-1e-6)){
    const t=plate.localToWorld(p).applyMatrix4(inv).project(cam);
    const uv=new T.Vector2(-t.x,-t.y);
    if(!pts.some(q=>q.distanceTo(uv)<1e-7))pts.push(uv);
  }
  const mid=pts.reduce((sum,p)=>sum.add(p),new T.Vector2()).divideScalar(pts.length);
  return pts.sort((a,b)=>a.clone().sub(mid).angle()-b.clone().sub(mid).angle());
}
const results={};
for(const [id,view] of Object.entries(views)){
  results[id]={...view, imageWidth:1000, tolerancePx:id==='SKTB2'?3:5, revisions:{}};
  for(const [rev,build] of Object.entries({v21:before,v22:after})){
    const pts=corners(build);
    const near=p=>pts.reduce((a,b)=>b.distanceTo(p)<a.distanceTo(p)?b:a);
    const upper=near(v([.18,.18])), inner=near(v([.025,.23]));
    const delta=inner.clone().sub(upper),[a,b]=view.fit.map(v);
    const target=b.clone().sub(a);
    const poly=pts.map(p=>p.clone().sub(upper).rotateAround(new T.Vector2(),target.angle()-delta.angle())
      .multiplyScalar(target.length()/delta.length()).add(a));
    const errors=view.test.map(raw=>{
      const p=v(raw);
      return Math.min(...poly.map((q,i)=>{
        const d=poly[(i+1)%poly.length].clone().sub(q);
        const t=T.MathUtils.clamp(p.clone().sub(q).dot(d)/d.lengthSq(),0,1);
        return p.distanceTo(q.clone().addScaledVector(d,t));
      }));
    });
    results[id].revisions[rev]={polygon:poly.map(p=>p.toArray()),errors,
      rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length)};
  }
  const r=results[id].revisions;assert(r.v22.rms<r.v21.rms);
}
fs.writeFileSync(new URL('jaw-profile.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
