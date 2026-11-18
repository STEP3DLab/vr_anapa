// Two-pose experiment. All world coordinates are conditional on the v22 deck cameras.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {deckCamera} from './deck-camera.js';
import {initial,poses} from './poses.js';

globalThis.document={createElement:()=>({getContext:()=>null})};
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const marks=read('batanov-lift-marks.json'), views=read('hood-views.json');
const v2=p=>new T.Vector2(...p);
const origin=new T.Vector2();
const centre=points=>points.reduce((sum,p)=>sum.add(p),new T.Vector2()).divideScalar(points.length);
const rms=errors=>Math.hypot(...errors)/Math.sqrt(errors.length);
function registration(from,to){
  const [a,b]=from.slice(0,2).map(v2),[c,d]=to.slice(0,2).map(v2);
  const u=b.sub(a),v=d.sub(c),angle=v.angle()-u.angle(),scale=v.length()/u.length();
  return p=>p.clone().sub(a).rotateAround(origin,angle).multiplyScalar(scale).add(c);
}
const id=p=>p.clone();
const to14=registration(marks.SKTB2.wheels,marks.P014.wheels);
const from14=registration(marks.P014.wheels,marks.SKTB2.wheels);
function frame(view,forward=id,inverse=id){
  const camera=deckCamera(view), height=view.imageHeight;
  return {
    project(p){
      const q=p.clone().project(camera);
      return forward(new T.Vector2(500*(1+q.x),height*(1-q.y)/2));
    },
    atDepth(p,z){
      const q=inverse(p);
      const ray=new T.Raycaster();
      ray.setFromCamera(new T.Vector2(q.x/500-1,1-2*q.y/height),camera);
      return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-z),new T.Vector3());
    }
  };
}
const frames={SKTB2:frame(views.SKTB2),P014:frame(views.SKTB2,to14,from14),SKTB4:frame(views.SKTB4)};
const model=makeMobot(T,'desktop'),m=model.mechanisms;
const pivotCap=m.bucketLift.children.find(o=>o.geometry?.parameters.radiusTop===.068 && o.position.z<0);
const shaft=m.scoopShell.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.height>1);
assert(pivotCap&&shaft);
const end=mesh=>mesh.localToWorld(new T.Vector3(0,-mesh.geometry.parameters.height/2,0));
const capPoint=()=>end(pivotCap), shaftPoint=()=>end(shaft);
m.setPose({...initial,...poses[0][2]});
const zCap=capPoint().z,zShaft=shaftPoint().z;
const ring=id=>marks[id].bolts.map(p=>frames[id].atDepth(v2(p),zCap));
const ring2=ring('SKTB2'),ring14=ring('P014');
const xy=p=>new T.Vector2(p.x,p.y);
const meanXY=ps=>centre(ps.map(xy));
const root=meanXY(ring2), second=meanXY(ring14);
let cross=0,dot=0;
for(let i=0;i<ring2.length;i++){
  const a=xy(ring2[i]).sub(root),b=xy(ring14[i]).sub(second);
  cross+=a.cross(b);dot+=a.dot(b);
}
// Cap rotates with the lifting member. Nearest roll modulo 60 degrees;
// the two carrier orientations in the photographs select this branch.
const delta=Math.atan2(cross,dot);
const angle2=poses[0][2].bucket;
const angle14=angle2-T.MathUtils.radToDeg(delta);
const pin=frames.SKTB2.atDepth(v2(marks.SKTB2.shaftMark),zShaft);
const local=xy(pin).sub(root).rotateAround(origin,T.MathUtils.degToRad(angle2));
const rig=new T.Group();
rig.name='Проверочная пара шарниров погрузчика';
rig.position.set(root.x,root.y,0);
const cap=pivotCap.clone(), axle=shaft.clone();
cap.position.set(0,0,pivotCap.position.z);
axle.position.set(local.x,local.y,0);
rig.add(cap,axle);
// Both rods, cap and full transverse shaft are actual scene geometry.
// The two rods describe the line of centres only; the plate silhouette is unresolved.
for(const z of [pivotCap.position.z,-pivotCap.position.z]){
  const rod=new T.Mesh(new T.CylinderGeometry(.014,.014,local.length(),12),cap.material);
  rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(local.x,local.y,0).normalize());
  rod.position.set(local.x/2,local.y/2,z);rig.add(rod);
}
// Recover the radius from the axle witness to the exposed end of the cutting lip.
// X/Y length is invariant under either lift or bucket tilt. Apply the ray at the
// respective model depth so that different transverse endpoints are not conflated.
m.blade.geometry.computeBoundingBox();
const bladeBox=m.blade.geometry.boundingBox;
const lipLocal=new T.Vector3(bladeBox.min.x,0,bladeBox.min.z);
const publishedLip=m.blade.localToWorld(lipLocal.clone());
const shaftToLip=xy(publishedLip).distanceTo(xy(shaftPoint()));
const lipRadius={modelSceneXY:shaftToLip,views:{}};
for(const key of ['SKTB2','P014']){
  const f=frames[key],p=marks[key];
  const a=xy(f.atDepth(v2(p.shaftMark),zShaft));
  const b=xy(f.atDepth(v2(p.lipMark),publishedLip.z));
  const measured=a.distanceTo(b);
  lipRadius.views[key]={observedSceneXY:measured,ratioToModel:measured/shaftToLip};
}
const out={lipRadius,baseline:'v22 release 2819cab0913f563ccd5ba1f7f56eeb292fd70beb',scope:'Experimental lift-axis geometry; no bucket resize, historical angle zero or lateral calibration. Only SKTB2 enters pivot and shaft reconstruction.',root:root.toArray(),shaftLocal:local.toArray(),zCap,zShaft,deltaDegrees:T.MathUtils.radToDeg(delta),angles:{SKTB2:angle2,P014:angle14},views:{}};
const wheelErrors=marks.SKTB2.wheels.slice(2).map((p,i)=>to14(v2(p)).distanceTo(v2(marks.P014.wheels[i+2])));
out.registration={wheelErrors,rms:rms(wheelErrors),flangeDriftPx:to14(centre(marks.SKTB2.bolts.map(v2))).distanceTo(centre(marks.P014.bolts.map(v2)))};
for(const [key,angle] of Object.entries({SKTB2:angle2,P014:angle14,SKTB4:0})){
  const f=frames[key],obs=marks[key];
  const pivot=obs.bolts?centre(obs.bolts.map(v2)):v2(obs.flangeMark);
  m.setPose({...initial,bucket:angle,tip:0});
  rig.rotation.z=-T.MathUtils.degToRad(angle);rig.updateMatrixWorld(true);
  const row={measured:{pivot:pivot.toArray(),shaft:obs.shaftMark??null}};
  for(const [label,p,s] of [['published',capPoint(),shaftPoint()],['trial',end(cap),end(axle)]]){
    const a=f.project(p),b=f.project(s);
    row[label]={pivot:a.toArray(),shaft:b.toArray(),pivotError:a.distanceTo(pivot),
      shaftError:obs.shaftMark?b.distanceTo(v2(obs.shaftMark)):null};
  }
  out.views[key]=row;
}
const test=out.views;
assert(Math.abs(lipRadius.views.SKTB2.ratioToModel-lipRadius.views.P014.ratioToModel)<.05);
for(const v of Object.values(lipRadius.views))assert(v.ratioToModel<.8);
assert(out.registration.rms<6);
assert(test.SKTB2.trial.pivotError<1e-6 && test.SKTB2.trial.shaftError<1e-6);
assert(test.P014.trial.pivotError<test.P014.published.pivotError);
assert(test.P014.trial.shaftError<test.P014.published.shaftError);
assert(test.SKTB4.trial.pivotError<test.SKTB4.published.pivotError);
fs.writeFileSync(new URL('batanov-lift-result.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({registration:out.registration,rotation:out.deltaDegrees,views:out.views},null,2));
