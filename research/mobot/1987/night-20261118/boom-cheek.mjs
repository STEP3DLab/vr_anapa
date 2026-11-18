// Two-point local registration removes camera roll and apparent scale; it does not test reach.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as baseline} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as candidate} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const marks={
 SKTB2:{file:'before-dispatch',mirror:1,root:[710.3,151.3],pin:[835.3,105.7],
   checks:[[726,159],[797,123],[833,94],[845.6,103.5],[843.5,112],[821.8,130.5],[816,130],[735,196]],capRadiusPx:5.5,pickPx:3},
 SKTB4:{file:'snow-side',mirror:-1,root:[209.3,119.7],pin:[104,94.7],
   checks:[[204,125],[160,110],[103,85.7],[97.5,95],[104.7,103.3],[118.7,114.3],[125,112.3],[175,147]],capRadiusPx:5.5,pickPx:4}
};
const v=xy=>new T.Vector2(...xy);
function contour(build,mark){
  const m=build(T,'desktop').mechanisms,boom=m.distalPin.parent;
  m.setPose({yaw:mark.mirror===1?0:180,wrist:90});
  const plate=boom.children.find(o=>o.geometry?.type==='ExtrudeGeometry'&&
    o.position.z*mark.mirror<0&&o.geometry.parameters.shapes.getPoints().some(p=>p.x<-1));
  const attr=plate.geometry.attributes.position;
  const xyz=Array.from({length:attr.count},(_,i)=>new T.Vector3().fromBufferAttribute(attr,i));
  const faceZ=mark.mirror===1?Math.min(...xyz.map(p=>p.z)):Math.max(...xyz.map(p=>p.z));
  const cap=xyz.filter(p=>Math.abs(p.z-faceZ)<1e-6);
  const corners=plate.geometry.parameters.shapes.getPoints();
  if(corners[0].equals(corners.at(-1)))corners.pop();
  const camera=new T.OrthographicCamera(-2,2,2,-2,.01,10);
  camera.position.z=-4*mark.mirror;camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const inverse=boom.matrixWorld.clone().invert();
  function project(world){
    const n=world.applyMatrix4(inverse).project(camera);return new T.Vector2(n.x,-n.y);
  }
  const points=corners.map(q=>{
    const closest=cap.reduce((a,b)=>Math.hypot(b.x-q.x,b.y-q.y)<Math.hypot(a.x-q.x,a.y-q.y)?b:a);
    assert(Math.hypot(closest.x-q.x,closest.y-q.y)<1e-5);
    return project(plate.localToWorld(closest.clone()));
  });
  const rootIndex=corners.findIndex(q=>Math.abs(q.x+1.08)<1e-6);
  const root=points[rootIndex],pin=project(m.distalPin.getWorldPosition(new T.Vector3()));
  const from=pin.clone().sub(root),to=v(mark.pin).sub(v(mark.root));
  const register=p=>p.clone().sub(root).rotateAround(new T.Vector2(),to.angle()-from.angle())
    .multiplyScalar(to.length()/from.length()).add(v(mark.root));
  const poly=points.map(register);
  const hub=m.gripper.children.find(o=>o.geometry?.type==='CylinderGeometry' && o.position.z*mark.mirror<-.1);
  const hubCenter=register(project(hub.getWorldPosition(new T.Vector3())));
  const attrHub=hub.geometry.attributes.position;
  let capRadius=0;
  for(let i=0;i<attrHub.count;i++){
    const q=hub.localToWorld(new T.Vector3().fromBufferAttribute(attrHub,i));
    capRadius=Math.max(capRadius,register(project(q)).distanceTo(hubCenter));
  }
  const residuals=mark.checks.map(raw=>{
    const p=v(raw);
    return Math.min(...poly.map((a,i)=>{const d=poly[(i+1)%poly.length].clone().sub(a);
      return p.distanceTo(a.clone().addScaledVector(d,T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1)));}));
  });
  return {capRadius,capError:capRadius-mark.capRadiusPx,poly:poly.map(p=>p.toArray()),residuals,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length)};
}
const output={};
for(const [id,mark] of Object.entries(marks)){
  const before=contour(baseline,mark),after=contour(candidate,mark);
  console.log(id,before.rms,after.rms);assert(after.rms<before.rms);
  output[id]={...mark,before,after};
}
fs.writeFileSync(new URL('boom-cheek.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
