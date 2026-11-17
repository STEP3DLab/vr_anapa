// SKTB9: register only the exposed barrel/chisel axis, with 3D inclination unknown.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as baseline} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as candidate} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const samples=[[30,18],[60,18],[85,25],[100,13],[116,14],[132,9],[150,7],[161,4]];
const data={origin:[737,452],direction:[120,115],imageWidth:1000,
  registration:[9,166],uncertaintyPx:2,samples,revisions:{}};
for(const [rev,make] of Object.entries({v21:baseline,v22:candidate})){
  const model=make(T,'desktop'), m=model.mechanisms;
  m.setWorkTool('breaker-arm');m.setPose({yaw:0,arm:0,wrist:90});
  const tool=m.breakerArm, inverse=tool.matrixWorld.clone().invert();
  const cam=new T.OrthographicCamera(-1,1,1,-1,.01,20);
  cam.position.z=-4;cam.lookAt(0,0,0);cam.updateMatrixWorld();
  const scale=(166-9)/(.94-.07);
  const slices=Array.from({length:156},(_,i)=>({x:i+10,lo:Infinity,hi:-Infinity}));
  for(const mesh of tool.children.filter(o=>o.geometry?.type==='CylinderGeometry')){
    const g=mesh.geometry, pos=g.attributes.position;
    const worldToCameraLocal=inverse.clone().multiply(mesh.matrixWorld);
    const pts=Array.from({length:pos.count},(_,i)=>{
      const p=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(worldToCameraLocal).project(cam);
      return [9+(p.x-.07)*scale,-p.y*scale];
    });
    const idx=g.index?.array??pts.map((_,i)=>i);
    for(let i=0;i<idx.length;i+=3)for(let j=0;j<3;j++){
      const a=pts[idx[i+j]],b=pts[idx[i+(j+1)%3]];
      if(Math.abs(a[0]-b[0])<1e-10)continue;
      for(const s of slices){
        const t=(s.x-a[0])/(b[0]-a[0]);
        if(t<0||t>1)continue;
        const y=a[1]+t*(b[1]-a[1]);
        s.lo=Math.min(s.lo,y);s.hi=Math.max(s.hi,y);
      }
    }
  }
  const residuals=samples.map(([x,w])=>{const s=slices[x-10];return s.hi-s.lo-w});
  const rms=Math.sqrt(residuals.reduce((a,r)=>a+r*r,0)/samples.length);
  assert(slices.every(s=>Number.isFinite(s.hi-s.lo)));
  data.revisions[rev]={slices,residuals,rms};
}
assert(data.revisions.v22.rms<data.revisions.v21.rms);
fs.writeFileSync(new URL('breaker-photo.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
