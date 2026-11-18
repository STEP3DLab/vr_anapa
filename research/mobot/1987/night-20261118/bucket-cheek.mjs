import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {deckCamera} from './deck-camera.js';
import {initial,poses} from './poses.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const views=read('hood-views.json');
const picks={
 SKTB2:{pose:0,root:[747,470],tip:[927,505],upper:[[776,464],[813,460],[846,457],[867,467],[894,480],[919,492]],pin:[795,531]},
 SKTB4:{pose:1,root:[719,477],tip:[822,596],upper:[[738,489],[757,502],[777,516],[798,531],[805,549],[814,572]],mask:'Lower edge and cutting lip partially hidden by snow; excluded. The tip is a low-confidence registration anchor.'}
};
const m=makeMobot(T,'desktop').mechanisms;
const cheek=m.scoopShell.children.find(o=>o.geometry?.type==='ExtrudeGeometry' && o.position.z<0);
const report={};
const pos=cheek.geometry.attributes.position;
const faceZ=Math.min(...Array.from({length:pos.count},(_,i)=>pos.getZ(i)));
for(const [id,p] of Object.entries(picks)){
 const camera=deckCamera(views[id]);
 m.setPose({...initial,...poses[p.pose][2]});
 function project(x,y){
   const q=cheek.localToWorld(new T.Vector3(x,y,faceZ)).project(camera);
   return new T.Vector2(500*(1+q.x),views[id].imageHeight*(1-q.y)/2);
 }
 const root=project(.075,.23),tip=project(-.6,-.21);
 const a=tip.clone().sub(root),b=new T.Vector2(...p.tip).sub(new T.Vector2(...p.root));
 function aligned(x,y){
   return project(x,y).sub(root).rotateAround(new T.Vector2(),b.angle()-a.angle())
     .multiplyScalar(b.length()/a.length()).add(new T.Vector2(...p.root));
 }
 const corners=cheek.geometry.parameters.shapes.getPoints();
 if(corners[0].equals(corners.at(-1)))corners.pop();
 // Verify the selected outline is present on the rendered outer face.
 for(const v of corners)assert(Array.from({length:pos.count},(_,i)=>i).some(i=>
   Math.hypot(pos.getX(i)-v.x,pos.getY(i)-v.y,pos.getZ(i)-faceZ)<1e-6));
 const poly=corners.map(v=>aligned(v.x,v.y));
 const errors=p.upper.map(xy=>{
   const q=new T.Vector2(...xy);
   return Math.min(...poly.map((v,i)=>{
     const d=poly[(i+1)%poly.length].clone().sub(v);
     return q.distanceTo(v.clone().addScaledVector(d,T.MathUtils.clamp(q.clone().sub(v).dot(d)/d.lengthSq(),0,1)));
   }));
 });
 const cornersXY=corners.map(v=>v.toArray());
 report[id]={...p,cornersXY,raw:corners.map(v=>project(v.x,v.y).toArray()),poly:poly.map(v=>v.toArray()),errors,
   rms:Math.hypot(...errors)/Math.sqrt(errors.length),basis:[[0,0],[1,0],[0,1]].map(([x,y])=>aligned(x,y).toArray()),
   rawTipOffsetPx:tip.distanceTo(new T.Vector2(...p.tip)),rawRootOffsetPx:root.distanceTo(new T.Vector2(...p.root)),
   registeredPin:aligned(0,0).toArray()};
}
const before=read('bucket-cheek-before.json');
for(const [id,view] of Object.entries(report)){
 assert(view.rms < before[id].rms);
 assert(Math.abs(view.rawTipOffsetPx-before[id].rawTipOffsetPx)<1e-8);
 assert(Math.abs(view.rawRootOffsetPx-before[id].rawRootOffsetPx)<1e-8);
}
fs.writeFileSync(new URL('bucket-cheek.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
