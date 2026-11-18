// Estimate arm angle from an upper rail direction without fitting either pivot.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {deckCamera} from './deck-camera.js';
import {initial,poses} from './poses.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const file=s=>new URL(s,import.meta.url);
const views=JSON.parse(fs.readFileSync(file('hood-views.json')));
const picks={
 SKTB2:{pose:0,pin:[835,106],rail:[[533,245],[664,180]],prox:[517,342],proxStatus:'possible visible bearing, identity provisional'},
 SKTB4:{pose:1,pin:[104,95],rail:[[382,186],[241,137]],prox:null,proxStatus:'masked by pedestal and actuator'}
};
const m=makeMobot(T,'desktop').mechanisms,boom=m.distalPin.parent;
const results={};
for(const [id,pick] of Object.entries(picks)){
  const v=views[id],camera=deckCamera(v),base={...initial,...poses[pick.pose][2]};
  function project(p){
    const n=p.project(camera);return new T.Vector2((1+n.x)*500,(1-n.y)*v.imageHeight/2);
  }
  const target=new T.Vector2(...pick.pin);
  const railDir=new T.Vector2(...pick.rail[1]).sub(new T.Vector2(...pick.rail[0])).normalize();
  const rail=boom.children.find(o=>o.geometry?.type==='BoxGeometry'&&o.geometry.parameters.width===1.16);
  const axleRadius=m.distalPin.geometry.parameters.height/2;
  function inspect(arm){
    m.setPose({...base,arm});
    const center=o=>o.getWorldPosition(new T.Vector3());
    const tipEnds=[-axleRadius,axleRadius].map(y=>m.distalPin.localToWorld(new T.Vector3(0,y,0)));
    const near=tipEnds.sort((a,b)=>a.distanceToSquared(camera.position)-b.distanceToSquared(camera.position))[0];
    const tip=project(near);
    const proximal=project(center(m.arm));
    const a=project(rail.localToWorld(new T.Vector3(.45,0,0)));
    const b=project(rail.localToWorld(new T.Vector3(-.45,0,0)));
    const dir=b.clone().sub(a).normalize();
    const err=Math.atan2(dir.cross(railDir),dir.dot(railDir))*180/Math.PI;
    return {arm,yaw:base.yaw,tip:tip.toArray(),proximal:proximal.toArray(),
      rail:[a.toArray(),b.toArray()],railAngleError:err,tipError:tip.distanceTo(target)};
  }
  const candidates=Array.from({length:431},(_,i)=>inspect(-18+i/10));
  const fitted=candidates.reduce((a,b)=>Math.abs(a.railAngleError)<Math.abs(b.railAngleError)?a:b);
  assert(Math.abs(fitted.railAngleError)<.15);
  results[id]={...pick,referenceWidth:1000,preset:inspect(base.arm),slopeFit:fitted,
    note:'Near face of distal pin tested separately. Scale, roll and depth from deck camera; platform yaw fixed. No physical length estimated.'};
}
fs.writeFileSync(file('boom-pose.json'),JSON.stringify(results,null,2)+'\n');
console.log(results);
