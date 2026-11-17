// Fit exactly the original two anchors per image for each assumed direction and distance.
// Off-axis projection keeps the optical orientation fixed while registering the photo.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v21-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const {root,parts}=makeMobot(T,'desktop');
root.updateMatrixWorld(true);
const group=parts.tracks.children.find(g=>g.position.z<0);
const wheels=group.children.filter(m=>m.geometry?.type==='CylinderGeometry' &&
  m.geometry.parameters.height===.115).sort((a,b)=>b.position.x-a.position.x);
const keys=['rear','r1','r2','r3','r4','r5','r6','r7','front'];
assert.equal(wheels.length,keys.length);
const points=Object.fromEntries(wheels.map((m,i)=>[keys[i],m.getWorldPosition(new T.Vector3())]));
const target=points.r4;
const path=name=>new URL(name,import.meta.url);
const views=JSON.parse(fs.readFileSync(path('photo-side.json'))).views;
const results={};
for (const {id,width,height,fit,centres,visibleSpan} of views){
  const rows=[];
  for(const yaw of [-25,0,25])for(const pitch of [0,15])for(const distance of [3,8]){
    const cam=new T.PerspectiveCamera(40,width/height,.01,100);
    const [az,el]=[yaw,pitch].map(T.MathUtils.degToRad);
    cam.position.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el))
      .multiplyScalar(distance).add(target);
    cam.lookAt(target);cam.updateMatrixWorld();
    function pixel(p){
      const n=p.clone().project(cam);
      return new T.Vector2((1+n.x)*width/2,(1-n.y)*height/2);
    }
    const a=pixel(points[fit[0]]), b=pixel(points[fit[1]]).sub(a);
    const u=new T.Vector2(...centres[fit[0]]);
    const v=new T.Vector2(...centres[fit[1]]).sub(u);
    const scale=v.length()/b.length(), roll=v.angle()-b.angle();
    const errors={};
    for(const [k,obs] of Object.entries(centres)){
      const prediction=pixel(points[k]).sub(a).rotateAround(new T.Vector2(),roll)
        .multiplyScalar(scale).add(u);
      const d=prediction.sub(new T.Vector2(...obs));
      if(fit.includes(k))assert(d.length()<1e-8);
      else errors[k]=d.toArray();
    }
    const ds=Object.values(errors);
    const rms=Math.sqrt(ds.reduce((s,[x,y])=>s+x*x+y*y,0)/ds.length);
    rows.push({yaw,pitch,distance,scale,roll,errors,rms,relativeRms:rms/(visibleSpan[1]-visibleSpan[0])});
  }
  results[id]=rows;
}
fs.writeFileSync(path('perspective-v21.json'),JSON.stringify(results,null,2)+'\n');
