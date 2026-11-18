import {poses} from './poses.js';
// Register only the right cheek. The left cheek is a held-out test of the assembled pose.
// Both near cheek faces are coplanar in the model; a common affine camera is assumed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as baseline} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as candidate} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const views={
 SKTB2:{image:'before-dispatch',yaw:0,claw:4,right:[[935,316],[874,332],[925,388]],
   left:[[746,317],[809,334],[810,401]],pickPx:3},
 SKTB3:{image:'front',yaw:90,claw:22,right:[[647,548],[556,578],[630,653]],
   left:[[343,558],[436,583],[435,685]],pickPx:5}
};
function project(m,side){
  const jaw=m.fingers.find(f=>f.side===side).group;
  const plate=jaw.children.find(o=>o.geometry?.type==='ExtrudeGeometry' && o.position.z>0);
  const attr=plate.geometry.attributes.position;
  const all=Array.from({length:attr.count},(_,i)=>new T.Vector3().fromBufferAttribute(attr,i));
  const z=Math.max(...all.map(p=>p.z));
  const face=[];
  for(const p of all.filter(p=>p.z>z-1e-6)){
    if(!face.some(q=>q.distanceTo(p)<1e-7))face.push(p);
  }
  const near=(x,y)=>face.reduce((a,b)=>Math.hypot(b.x-x,b.y-y)<Math.hypot(a.x-x,a.y-y)?b:a);
  const outer=near(-.18,side*.18),inner=near(-.23,side*.025);
  const distal=face.filter(p=>p.x<-.32);
  const bottomOuter=distal.reduce((a,b)=>b.y*side>a.y*side?b:a);
  const bottomInner=distal.reduce((a,b)=>b.y*side<a.y*side?b:a);
  const camera=new T.OrthographicCamera(-2,2,2,-2,.01,20);
  camera.position.z=4;camera.up.set(1,0,0);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const inv=m.fingerHead.matrixWorld.clone().invert();
  const uv=p=>{
    const n=plate.localToWorld(p.clone()).applyMatrix4(inv).project(camera);
    return new T.Vector2(-n.x,-n.y);
  };
  const points=face.map(uv);
  const c=points.reduce((s,p)=>s.add(p),new T.Vector2()).divideScalar(points.length);
  points.sort((a,b)=>a.clone().sub(c).angle()-b.clone().sub(c).angle());
  return {fit:[outer,inner,bottomOuter].map(uv),test:[outer,inner,bottomInner].map(uv),points};
}
function measure(m,view,claw){
  m.setPose({yaw:view.yaw,arm:0,wrist:90,claw});
  const r=project(m,1),l=project(m,-1);
  const [a,b,c]=r.fit, [u,v,w]=view.right.map(p=>new T.Vector2(...p));
  const ab=b.clone().sub(a),ac=c.clone().sub(a),det=ab.cross(ac);
  assert(Math.abs(det)>1e-5);
  const map=p=>{
    const d=p.clone().sub(a);
    return u.clone().addScaledVector(v.clone().sub(u),d.cross(ac)/det)
      .addScaledVector(w.clone().sub(u),ab.cross(d)/det);
  };
  const left=l.test.map(map);
  const errors=left.map((p,i)=>p.distanceTo(new T.Vector2(...view.left[i])));
  const gapX=v.x-left[1].x;
  return {claw,rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/3),errors,gapX,
    upperGapError:gapX-(view.right[1][0]-view.left[1][0]),
    left:l.points.map(p=>map(p).toArray()),right:r.points.map(p=>map(p).toArray())};
}
const result={};
for(const [id,v] of Object.entries(views)){
  const data={...v,referenceWidth:1000,revisions:{}};
  for(const [rev,build] of Object.entries({v21:baseline,v22:candidate})){
    const m=build(T,'desktop').mechanisms;
    const preset=measure(m,v,v.claw);
    const sweep=Array.from({length:25},(_,i)=>measure(m,v,i));
    const best=sweep.reduce((a,b)=>a.rms<b.rms?a:b);
    data.revisions[rev]={preset,best,angleSweep:sweep.map(s=>[s.claw,s.rms,s.gapX])};
  }
  const pose=poses[id==='SKTB2'?0:2][2];
  const calibrated=measure(candidate(T,'desktop').mechanisms,v,pose.claw);
  const observedGap=v.right[1][0]-v.left[1][0];
  const grid=data.revisions.v22.angleSweep;
  assert(Math.abs(calibrated.gapX-observedGap)<=Math.min(...grid.map(([,r,gap])=>Math.abs(gap-observedGap)))+1e-8);
  data.photoMatch=calibrated;
  result[id]=data;
  console.log(id,Object.entries(data.revisions).map(([rev,s])=>[rev,s.preset.rms,s.preset.gapX,s.best.claw,s.best.rms]));
}
fs.writeFileSync(new URL('jaw-opening.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
