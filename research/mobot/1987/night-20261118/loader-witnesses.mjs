import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {deckCamera} from './deck-camera.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {poses,initial} from './poses.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const views=read('hood-views.json'), profile=read('bucket-cheek.json'), lower=read('bucket-heel.json');
const m=makeMobot(T,'desktop').mechanisms;
const plate=m.scoopShell.children.find(o=>o.geometry?.type==='ExtrudeGeometry'&&o.position.z<0);
const vertices=plate.geometry.attributes.position;
const z=Math.min(...Array.from({length:vertices.count},(_,i)=>vertices.getZ(i)));
const shaft=m.scoopShell.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.height>1);
const blade=m.blade.geometry;blade.computeBoundingBox();
const lip=new T.Vector3(blade.boundingBox.min.x,0,blade.boundingBox.min.z);
const shaftEnd=new T.Vector3(0,-shaft.geometry.parameters.height/2,0);
const records={};
for(const [id,v] of Object.entries(profile)){
 const cam=deckCamera(views[id]),height=views[id].imageHeight;
 const base={...initial,...poses[v.pose][2]};
 const reference={bucket:id==='SKTB2'?8:0,tip:0};
 m.setPose({...base,...reference});
 const toPixel=(mesh,local)=>{
  const n=mesh.localToWorld(local.clone()).project(cam);
  return new T.Vector2((1+n.x)*500,(1-n.y)*height/2);
 };
 const vec=p=>new T.Vector2(...p);
 const root=new T.Vector3(.075,.23,z),toe=new T.Vector3(-.60,-.21,z);
 const rootMark=vec(v.root),toeMark=vec(v.tip);
 function inspect(bucket,tip,details=false){
  m.bucketLift.rotation.z=-T.MathUtils.degToRad(bucket);
  m.bucketTilt.rotation.z=T.MathUtils.degToRad(tip);
  const a=toPixel(plate,root),b=toPixel(plate,toe);
  const rootError=rootMark.distanceTo(a),toeError=toeMark.distanceTo(b);
  const row={bucket,tip,rootError,toeError,rms:Math.hypot(rootError,toeError)/Math.sqrt(2)};
  if(!details)return row;
  m.setPose({...base,bucket,tip});
  const pin=toPixel(shaft,shaftEnd),edge=toPixel(m.blade,lip);
  const count=lower[id].after.poly.length;
  const outline=v.cornersXY.slice(0,count).map(([x,y])=>toPixel(plate,new T.Vector3(x,y,z)));
  const distances=lower[id].checks.map(xy=>Math.min(...outline.slice(1).map((p,i)=>{
   const d=p.clone().sub(outline[i]),q=vec(xy).sub(outline[i]);
   return q.distanceTo(d.clone().multiplyScalar(T.MathUtils.clamp(q.dot(d)/d.lengthSq(),0,1)));
  })));
  return {...row,root:a.toArray(),toe:b.toArray(),shaftEnd:pin.toArray(),lip:edge.toArray(),outline:outline.map(p=>p.toArray()),
    pinError:v.pin?pin.distanceTo(vec(v.pin)):null,lipError:id==='SKTB2'?edge.distanceTo(new T.Vector2(938,501)):null,
    lowerRms:Math.hypot(...distances)/Math.sqrt(distances.length),alerts:m.inspectPose().alerts};
 }
 const before=inspect(reference.bucket,reference.tip,true);
 const candidates=[];
 for(let lift=-8;lift<=36;lift++)for(let tilt=-25;tilt<=25;tilt++){
  const row=inspect(lift,tilt);
  if(row.rootError<=before.rootError+1e-8&&row.toeError<=before.toeError+1e-8)candidates.push(row);
 }
 candidates.sort((a,b)=>a.rms-b.rms);
 let best;
 for(const row of candidates){
  const trial=inspect(row.bucket,row.tip,true);
  if(!trial.alerts.length){best=trial;break;}
 }
 assert(best);
 const selected=inspect(base.bucket,base.tip,true);
 assert.equal(selected.alerts.length,0);
 if(id==='SKTB2'){
  assert.equal(best.bucket,selected.bucket);assert.equal(best.tip,selected.tip);
  assert(selected.pinError<before.pinError && selected.lipError<before.lipError && selected.lowerRms<before.lowerRms);
 }else{
  assert.equal(selected.lowerRms,before.lowerRms);assert(best.lowerRms>selected.lowerRms);
 }
 records[id]={reference:before,fit:best,selected,pinMark:v.pin??null,lipMark:id==='SKTB2'?[938,501]:null,
  note:'Fit uses only raw deck-camera residuals at the two cheek corners. Axle end and cutting edge are withheld, and obscured in view 4. The circular mark in view 2 is a candidate axle centre.'};
 console.log(id,before,best);
}
fs.writeFileSync(new URL('loader-witnesses.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
