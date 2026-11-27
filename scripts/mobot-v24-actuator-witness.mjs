// Exact polygonal witness for selected v24 added-volume screen hits.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);

function confirm(T,baseFactory,candidateFactory){
 const baseline=baseFactory(T,'desktop'),r=candidateFactory(T,'desktop'),m=r.mechanisms,a=baseline.mechanisms;
 const list=r=>{const o=[];r.root.traverse(x=>{if(x.isMesh)o.push(x)});return o};
 const meshes=list(r),oldMeshes=list(baseline);
 const cases=[
 {name:'loader-left-to-gripper',pose:{yaw:-90,arm:25,bucket:36,wrist:115,tip:25,claw:24,track:0},targets:[268,269],actuator:1},
 {name:'loader-to-carrier',pose:{yaw:0,arm:-18,bucket:36,wrist:90,tip:0,claw:4,track:0},targets:[164,168],actuator:1},
 {name:'arm-to-internal-boom',pose:{yaw:0,arm:25,bucket:12,wrist:90,tip:0,claw:4,track:0},targets:[211,212],actuator:0}
 ];
 const V=()=>new T.Vector3(),pairs=m=>[[m.actuatorArmHousing,m.actuatorArmScrew],...m.loaderHousings.map((h,i)=>[h.o,m.loaderScrews[i].o])];
 const tol=1e-6;
 // Actual 16-sided THREE CylinderGeometry uses vertices (sin theta, cos theta).
 const planes=Array.from({length:16},(_,i)=>{const t=2*Math.PI*(i+.5)/16;return [Math.sin(t),Math.cos(t)]});
 const apothem=Math.cos(Math.PI/16);
 function clip(p,f){const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],A=f(a),B=f(b);if(A>=0)q.push(a);if((A>0&&B<0)||(A<0&&B>0))q.push(a.clone().lerp(b,A/(A-B)));}return q}
 function pointTest(obj,p){
  const q=obj.worldToLocal(p.clone()),radial=Math.max(...planes.map(([x,z])=>x*q.x+z*q.z));
  return {inside:Math.abs(q.y)<.5-tol&&radial<apothem-tol,local:q.toArray(),axialMargin:.5-Math.abs(q.y),radialMargin:apothem-radial};
 }
 function scan(target,solid,exclude=[]){
  const pos=target.geometry.attributes.position,idx=target.geometry.index,n=idx?idx.count:pos.count,mat=new T.Matrix4().copy(solid.matrixWorld).invert().multiply(target.matrixWorld);
  let best=null,hits=0;
  for(let i=0;i<n;i+=3){
   let p=[0,1,2].map(t=>V().fromBufferAttribute(pos,idx?idx.getX(i+t):i+t).applyMatrix4(mat));
   p=clip(p,v=>v.y+.5-tol);p=clip(p,v=>.5-tol-v.y);
   for(const [x,z] of planes){if(!p.length)break;p=clip(p,v=>apothem-tol-x*v.x-z*v.z)}
   if(!p.length)continue;
   // vertices and centroid; verify strict interior directly for each.
   const center=p.reduce((a,b)=>a.add(b),V()).multiplyScalar(1/p.length);
   for(const v of [...p,center]){
    const world=solid.localToWorld(v.clone()),test=pointTest(solid,world);
    if(!test.inside)continue;
    const outside=exclude.map(o=>pointTest(o,world));
    // Require strictly outside at least one face of each prior solid (not merely on boundary).
    if(outside.some(q=>q.axialMargin>=-tol&&q.radialMargin>=-tol))continue;
    hits++;const margin=Math.min(test.axialMargin,test.radialMargin,...outside.map(q=>Math.max(-q.axialMargin,-q.radialMargin)));
    if(!best||margin>best.margin)best={triangle:i/3,world:world.toArray(),margin,inside:test,priorSolids:outside};
   }
  }return {strictInteriorWitnessCount:hits,best};
 }
 const result=[];
 for(const c of cases){
  [m,a].forEach(x=>{x.setWorkTool('gripper');x.setPose(c.pose)});
  for(const id of c.targets){
   const j=id===168?2:c.actuator,[h,s]=pairs(m)[j],[H,S]=pairs(a)[j],o=meshes[id],O=oldMeshes[id];
   const entry={case:c.name,id,pose:c.pose,part:o.userData.part,geometry:o.geometry.type,parentChain:[],candidateHousing:scan(o,h),addedHousing:scan(o,h,[H,S]),baselineHousing:scan(O,H),baselineRod:scan(O,S),candidateRod:scan(o,s)};
   for(let q=o;q;q=q.parent)entry.parentChain.push({name:q.name,part:q.userData.part,position:q.position.toArray()});
   result.push(entry);
  }
 }
 return {threeRevision:T.REVISION,method:'clip actual target triangles against 16 planar side faces and two caps of actual actuator mesh; strict interior points verified independently against baseline housing and rod. Normalized-coordinate tolerance 1e-6; not real dimensions.',cases:result};
}

console.log(JSON.stringify(confirm(T,factory(read('mobot-engineering-v23-model.js')),factory(read('mobot-engineering-v24-actuator-lab-model.js'))),null,2));
