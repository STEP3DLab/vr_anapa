// Fast grid scan of two rigid rotations. Confirm every reported solution against live Three.js.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {deckCamera} from './deck-camera.js';
import {initial,poses} from './poses.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const get=f=>JSON.parse(fs.readFileSync(new URL(f,import.meta.url)));
import {inspectSurfaces} from './contact.js';
const model=makeMobot(T,'desktop'),m=model.mechanisms;
const hood=model.meshes.find(o=>o.name.startsWith('Кожух с плоской'));
const views=get('hood-views.json'),marks=get('bucket-cheek.json');
const cheek=m.scoopShell.children.find(o=>o.geometry?.type==='ExtrudeGeometry'&&o.position.z<0);
const attr=cheek.geometry.attributes.position;
const z=Math.min(...Array.from({length:attr.count},(_,i)=>attr.getZ(i)));
const records={};
for(const [id,v] of Object.entries(marks)){
  const camera=deckCamera(views[id]),preset={...initial,...poses[v.pose][2]};
  m.setPose(preset);
  const p=[new T.Vector3(.075,.23,z),new T.Vector3(-.60,-.21,z),new T.Vector3(0,0,z)];
  function inspect(){
    const px=p.map(point=>{
      const n=cheek.localToWorld(point.clone()).project(camera);
      return new T.Vector2((1+n.x)*500,(1-n.y)*views[id].imageHeight/2);
    });
    const errors=[v.root,v.tip].map((q,i)=>px[i].distanceTo(new T.Vector2(...q)));
    return {rms:Math.hypot(...errors)/Math.sqrt(2),rootPx:errors[0],tipPx:errors[1],
      pinPx:v.pin?px[2].distanceTo(new T.Vector2(...v.pin)):null};
  }
  const initialError=inspect();
  assert(Math.abs(initialError.tipPx-v.rawTipOffsetPx)<1e-7);
  let best={rms:Infinity};
  for(let lift=-8;lift<=36;lift++)for(let tip=-25;tip<=25;tip++){
    m.bucketLift.rotation.z=-T.MathUtils.degToRad(lift);
    m.bucketTilt.rotation.z=T.MathUtils.degToRad(tip);
    const err=inspect();
    if(err.rms<best.rms)best={...err,lift,tip};
  }
  m.setPose({...preset,bucket:best.lift,tip:best.tip});
  assert(Math.abs(inspect().rms-best.rms)<1e-7);
  const audit=m.inspectPose();
  records[id]={preset:initialError,best,alerts:audit.alerts,
    ground:inspectSurfaces(m,hood,'gripper',audit).ground};
}
fs.writeFileSync(new URL('bucket-pose.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
console.log(records);
