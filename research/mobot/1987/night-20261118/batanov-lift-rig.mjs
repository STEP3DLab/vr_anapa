// Two-pose experiment. All world coordinates are conditional on the v22 deck cameras.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {writeLiftGLB} from './batanov-lift-glb.mjs';
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
cap.name="Visible lift flange";axle.name="Provisional bucket axle";
cap.position.set(0,0,pivotCap.position.z);
axle.position.set(local.x,local.y,0);
rig.add(cap,axle);
// Both rods, cap and full transverse shaft are actual scene geometry.
// The two rods describe the line of centres only; the plate silhouette is unresolved.
for(const z of [pivotCap.position.z,-pivotCap.position.z]){
  const rod=new T.Mesh(new T.CylinderGeometry(.014,.014,local.length(),12),cap.material);
  rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(local.x,local.y,0).normalize());
  rod.name="Line of centres (schematic)";
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
const out={lipRadius,baseline:'v22 release 2819cab0913f563ccd5ba1f7f56eeb292fd70beb',scope:'Experimental lift axis fitted on SKTB2. The separately reconstructed bucket section is recorded under bucket. Angle zero and transverse dimensions are conditional.',root:root.toArray(),shaftLocal:local.toArray(),zCap,zShaft,deltaDegrees:T.MathUtils.radToDeg(delta),angles:{SKTB2:angle2,P014:angle14},views:{}};
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
// Fit the lower assembly from SKTB2 only. Work in the actual near cheek plane.
const cheek=m.scoopShell.children.find(o=>o.geometry?.type==='ExtrudeGeometry' && o.position.z<0);
const position=cheek.geometry.attributes.position;
const faceZ=Math.min(...Array.from({length:position.count},(_,i)=>position.getZ(i)));
const planeZ=cheek.localToWorld(new T.Vector3(0,0,faceZ)).z;
const cheekData=read('bucket-cheek.json'), lowerData=read('bucket-heel.json');
const originalRoot=new T.Vector2(.075,.23), originalToe=new T.Vector2(-.6,-.21);
const angleAt=(a,b)=>Math.atan2(a.cross(b),a.dot(b));
const view2=cheekData.SKTB2;
const total2=T.MathUtils.degToRad(poses[0][2].tip-angle2);
const toMount=p=>xy(frames.SKTB2.atDepth(v2(p),planeZ)).sub(xy(pin)).rotateAround(origin,-total2);
const newRoot=toMount(view2.root),newToe=toMount(view2.tip);
const oldSpan=originalToe.clone().sub(originalRoot),newSpan=newToe.clone().sub(newRoot);
const sectionScale=newSpan.length()/oldSpan.length();
const sectionAngle=angleAt(oldSpan,newSpan);
const shift=newRoot.clone().sub(originalRoot.clone().rotateAround(origin,sectionAngle).multiplyScalar(sectionScale));
const tilt=new T.Group(), shell=new T.Group();
tilt.name="Bucket tilt pivot";shell.name="Cheeks, floor and lip; reconstructed XY section";
tilt.position.copy(axle.position);rig.add(tilt);tilt.add(shell);
shell.scale.set(sectionScale,sectionScale,1);
shell.rotation.z=sectionAngle;
shell.position.set(shift.x,shift.y,0);
for(const original of m.scoopShell.children)if(original!==shaft)shell.add(original.clone());
const trialCheek=shell.children[m.scoopShell.children.indexOf(cheek)];
const trialBlade=shell.children[m.scoopShell.children.indexOf(m.blade)];
assert.equal(trialCheek.geometry,cheek.geometry);assert.equal(trialBlade.geometry,m.blade.geometry);
function rivetVector(key){
  const f=frames[key],obs=marks[key];
  return xy(f.atDepth(v2(obs.upperRivet),planeZ)).sub(xy(f.atDepth(v2(obs.shaftMark),zShaft)));
}
const change=T.MathUtils.radToDeg(angleAt(rivetVector('SKTB2'),rivetVector('P014')));
const tip14=poses[0][2].tip+angle14-angle2+change;
out.bucket={sectionScale,sectionRotationDeg:T.MathUtils.radToDeg(sectionAngle),shift:shift.toArray(),tip14,views:{},
  scope:'Conditional XY section from two SKTB2 cheek corners; original transverse depths. P014 tip change uses the direction to one upper rivet relative to the axle mark. For the snow view both models retain the published zero/zero pose.'};
const outline=view2.cornersXY.slice(0,lowerData.SKTB2.after.poly.length);
function distances(points,checks){
  return checks.map(p=>Math.min(...points.slice(1).map((b,i)=>{
    const a=points[i],d=b.clone().sub(a),r=v2(p).sub(a);
    return r.distanceTo(d.clone().multiplyScalar(T.MathUtils.clamp(r.dot(d)/d.lengthSq(),0,1)));
  })));
}
for(const [key,lift,tip] of [['SKTB2',angle2,poses[0][2].tip],['P014',angle14,tip14],['SKTB4',0,0]]){
  const f=frames[key],obs=marks[key],checks=obs.lowerChecks??lowerData[key].checks;
  m.setPose({...initial,bucket:lift,tip});rig.rotation.z=-T.MathUtils.degToRad(lift);tilt.rotation.z=T.MathUtils.degToRad(tip);
  rig.updateMatrixWorld(true);
  const row={lift,tip,checks};
  for(const [label,plate,blade] of [['published',cheek,m.blade],['trial',trialCheek,trialBlade]]){
    const poly=outline.map(([x,y])=>f.project(plate.localToWorld(new T.Vector3(x,y,faceZ))));
    const edge=f.project(blade.localToWorld(lipLocal.clone()));
    row[label]={poly:poly.map(p=>p.toArray()),lowerRms:rms(distances(poly,checks)),lip:edge.toArray(),
      lipError:obs.lipMark?edge.distanceTo(v2(obs.lipMark)):null};
  }
  out.bucket.views[key]=row;
}
// Snow pose is unknown. Separately test if any permitted pair can recover the two
// partly obscured registration corners. Lower picks stay out of this search.
const snow=cheekData.SKTB4,snowFrame=frames.SKTB4;
let snowBest;
for(let lift=-8;lift<=36;lift++)for(let tip=-25;tip<=25;tip++){
  rig.rotation.z=-T.MathUtils.degToRad(lift);tilt.rotation.z=T.MathUtils.degToRad(tip);
  const uv=(x,y)=>snowFrame.project(trialCheek.localToWorld(new T.Vector3(x,y,faceZ)));
  const a=uv(originalRoot.x,originalRoot.y), b=uv(originalToe.x,originalToe.y);
  const score=rms([a.distanceTo(v2(snow.root)),b.distanceTo(v2(snow.tip))]);
  if(!snowBest||score<snowBest.cornerRms){
    const poly=outline.map(([x,y])=>uv(x,y));
    snowBest={lift,tip,cornerRms:score,lowerRms:rms(distances(poly,lowerData.SKTB4.checks)),poly:poly.map(p=>p.toArray())};
  }
}
out.bucket.snowPoseSearch={tested:45*51,...snowBest,scope:'Shape reprojection only; no certification of actuator travel or contacts.'};
assert(out.bucket.views.P014.trial.lipError<out.bucket.views.P014.published.lipError);
assert(out.bucket.views.P014.trial.lowerRms<out.bucket.views.P014.published.lowerRms);
const test=out.views;
assert(Math.abs(lipRadius.views.SKTB2.ratioToModel-lipRadius.views.P014.ratioToModel)<.05);
for(const v of Object.values(lipRadius.views))assert(v.ratioToModel<.8);
assert(out.registration.rms<6);
assert(test.SKTB2.trial.pivotError<1e-6 && test.SKTB2.trial.shaftError<1e-6);
assert(test.P014.trial.pivotError<test.P014.published.pivotError);
assert(test.P014.trial.shaftError<test.P014.published.shaftError);
assert(test.SKTB4.trial.pivotError<test.SKTB4.published.pivotError);
// Add the six visible heads. Their angles and bolt-circle radius come from SKTB2.
for(const [i,p] of ring2.entries()){
  const offset=xy(p).sub(root).rotateAround(origin,T.MathUtils.degToRad(angle2));
  const head=new T.Mesh(new T.CylinderGeometry(.008,.008,.008,6),axle.material);
  head.name='Visible bolt '+(i+1);head.rotation.x=Math.PI/2;
  head.position.set(offset.x,offset.y,zCap-.004);rig.add(head);
}
rig.rotation.z=-T.MathUtils.degToRad(angle2);tilt.rotation.z=T.MathUtils.degToRad(poses[0][2].tip);
writeLiftGLB(new URL('batanov-loader-trial.glb',import.meta.url),rig,tilt,[[angle2,poses[0][2].tip],[angle14,tip14]]);
fs.writeFileSync(new URL('batanov-lift-result.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({bucket:Object.fromEntries(Object.entries(out.bucket.views).map(([k,r])=>[k,[r.published.lowerRms,r.trial.lowerRms,r.published.lipError,r.trial.lipError]])),registration:out.registration,rotation:out.deltaDegrees,views:out.views},null,2));
