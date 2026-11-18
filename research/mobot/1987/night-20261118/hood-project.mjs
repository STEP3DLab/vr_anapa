import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as baseline} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as candidate} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const file=s=>new URL(s,import.meta.url);
const views=JSON.parse(fs.readFileSync(file('hood-views.json')));
const results={};
for(const [id,v] of Object.entries(views)){
  if(!v.samples)continue;
  // Complete the observed projected X and Z columns to orthogonal camera rows
  // of equal length. Image Y points down; world Y points up.
  const [xx,xy]=v.longitudinal,[zx,zy]=v.transverse;
  const A=xx**2+zx**2,B=xy**2+zy**2,C=xx*xy+zx*zy;
  const scale2=(A+B+Math.hypot(A-B,2*C))/2;
  const yy=-Math.sqrt(scale2-B),yx=-C/yy;
  const scale=Math.sqrt(scale2);
  const right=new T.Vector3(xx,yx,zx).divideScalar(scale);
  const up=new T.Vector3(-xy,-yy,-zy).divideScalar(scale);
  assert(Math.abs(right.dot(up))<1e-10);
  const backward=right.clone().cross(up);
  const camera=new T.OrthographicCamera(-500,500,v.imageHeight/2,-v.imageHeight/2,.01,50);
  camera.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,backward));
  camera.zoom=scale;
  // Rear, upper, near corner of the v21 deck plate (unchanged on v22).
  camera.position.set(.855,.663+.047/2,-.675).addScaledVector(backward,10)
    .addScaledVector(right,(500-v.deckOrigin[0])/scale)
    .addScaledVector(up,(v.deckOrigin[1]-v.imageHeight/2)/scale);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const revisions={};
  for(const [rev,build] of Object.entries({v21:baseline,v22:candidate})){
    const robot=build(T,'desktop');robot.root.updateMatrixWorld(true);
    const hood=robot.meshes.find(m=>m.name.startsWith('Кожух с плоской'));
    const geometry=hood.geometry, pts=geometry.getAttribute('position');
    const verts=Array.from({length:pts.count},(_,i)=>new T.Vector3().fromBufferAttribute(pts,i));
    const zNear=Math.min(...verts.map(p=>p.z));
    const uv=verts.filter(p=>v.part==='silhouette'||p.z<zNear+1e-5).map(p=>{
      const n=hood.localToWorld(p.clone()).project(camera);
      return [(1+n.x)*500,(1-n.y)*v.imageHeight/2];
    }).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    // Convex hood: the upper monotone hull is the visible upper edge.
    const edge=[];
    for(const p of uv){
      if(edge.length && edge.at(-1)[0]===p[0])continue;
      while(edge.length>=2){
        const [a,b]=edge.slice(-2);
        if((b[0]-a[0])*(p[1]-a[1])>(b[1]-a[1])*(p[0]-a[0]))break;
        edge.pop();
      }
      edge.push(p);
    }
    const residuals=v.samples.map(([x,y])=>{
      const j=edge.findIndex(p=>p[0]>=x);
      if(j<=0)return null;
      const [a,b]=edge.slice(j-1,j+1);
      return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])-y;
    });
    revisions[rev]={edge,residuals,rms:residuals.some(x=>x===null)?null:
      Math.sqrt(residuals.reduce((sum,d)=>sum+d*d,0)/residuals.length)};
  }
  results[id]={scale,revisions};
}
fs.writeFileSync(file('hood-results.json'),JSON.stringify(results,null,2)+'\n');
// Compare identical pixel columns. A missing projected span is reported separately.
for(const [id,{revisions}] of Object.entries(results)){
  const a=revisions.v21.residuals,b=revisions.v22.residuals;
  const valid=a.map((x,i)=>x!==null && b[i]!==null);
  const rms=r=>Math.sqrt(r.reduce((s,x,i)=>s+(valid[i]?x*x:0),0)/valid.filter(Boolean).length);
  assert(valid.filter(Boolean).length>=7,id+' insufficient common columns');
  assert(rms(b)<rms(a),id+' candidate regressed');
  assert(b.every(x=>x!==null),id+' incomplete candidate span');
}
