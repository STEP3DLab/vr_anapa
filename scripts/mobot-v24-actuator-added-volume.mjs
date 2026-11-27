// v23 vs v24: screen newly occupied cylinder shell against visible triangles. Scene units only.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);

function audit(T,baseFactory,candidateFactory){
 const E=1e-8, assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 // Clip each triangle to a finite axial slab in the candidate cylinder's local space.
 // In that slab use a conservative circular outer bound and inscribed inner bound
 // of the coaxial regular 16-sided cylinders; boundary contacts also count.
 function clip(poly,y,lower){
  const out=[];for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],A=lower?a.y-y:y-a.y,B=lower?b.y-y:y-b.y;
   if(A>=-E)out.push(a);
   if((A>0&&B<0)||(A<0&&B>0))out.push(a.clone().lerp(b,A/(A-B)));
  }return out;
 }
 function radialRange(p){
  let lo=Infinity,hi=0,area=0,pos=false,neg=false;
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz;
   const t=d?Math.max(0,Math.min(1,-(a.x*dx+a.z*dz)/d)):0;
   lo=Math.min(lo,(a.x+t*dx)**2+(a.z+t*dz)**2);hi=Math.max(hi,a.x*a.x+a.z*a.z);
   const cross=a.x*b.z-a.z*b.x;area+=cross;pos||=cross>E;neg||=cross<-E;
  }
  if(Math.abs(area)>E&&!(pos&&neg))lo=0;
  return [lo,hi];
 }
 const triangleHits=(p,lower,upper,inner)=>{const q=clip(clip(p,lower,true),upper,false);if(!q.length)return false;const [lo,hi]=radialRange(q);return lo<=1+E&&hi>=inner*inner-E};
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 assert(triangleHits([V(.8,0,0),V(.9,0,.1),V(.9,.1,0)],-.2,.2,.5),'annulus positive fixture');
 assert(!triangleHits([V(.1,0,0),V(.2,0,.1),V(.2,.1,0)],-.2,.2,.5),'inner hole fixture');
 assert(!triangleHits([V(.8,.4,0),V(.9,.4,.1),V(.9,.5,0)],-.2,.2,.5),'slab fixture');
 assert(!triangleHits([V(1.3,0,0),V(1.4,0,.1),V(1.4,.1,0)],-.2,.2,.5),'outer fixture');
 const result={threeRevision:T.REVISION,method:'conservative newly occupied annular slab vs visible mesh triangles; includes instances, boundary contacts; not volumetric or continuous proof',fixturesPassed:4,qualities:{}};
 const getPairs=m=>[[m.actuatorArmHousing,m.actuatorArmScrew],...m.loaderHousings.map((a,i)=>[a.o,m.loaderScrews[i].o])];
 const labels=['arm','loader-left','loader-right'];
 for(const quality of ['desktop','mobile']){
  const old=baseFactory(T,quality),r=candidateFactory(T,quality),a=old.mechanisms,m=r.mechanisms,oldPairs=getPairs(a),pairs=getPairs(m);
  const counts={poses:0,addedSlabs:0,unchangedOrReduced:0,meshInstancesBroadphase:0,triangleTests:0,hitSlabs:0,hitInstances:0};
  const hits={},examples=[],inverse=new T.Matrix4(),world=new T.Matrix4(),transform=new T.Matrix4(),instance=new T.Matrix4(),bounds=new T.Box3(),verts=[V(0,0,0),V(0,0,0),V(0,0,0)];
  const all=[];r.root.traverse(o=>{if(o.isMesh){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();all.push(o)}});
  const index=new Map(all.map((o,i)=>[o,i]));
  function scan(pose,tool){
   a.setWorkTool(tool);m.setWorkTool(tool);a.setPose(pose);m.setPose(pose);counts.poses++;
   const visible=[];r.root.traverseVisible(o=>{if(o.isMesh)visible.push(o)});
   for(let j=0;j<pairs.length;j++){
    const [h,s]=pairs[j],before=oldPairs[j][0].scale.y,after=h.scale.y;
    if(after-before<E){counts.unchangedOrReduced++;continue;}
    counts.addedSlabs++;const lower=before/after-.5,upper=.5;
    const inner=s.scale.x/h.scale.x*Math.cos(Math.PI/16);
    inverse.copy(h.matrixWorld).invert();
    // New volume is subset of this local cylinder annulus. Test even the intentionally attached members, report separately.
    let hit=false;
    for(const o of visible){
     if(o===h||o===s)continue;
     const g=o.geometry,p=g.attributes.position,idx=g.index,n=idx?idx.count:p.count;
     for(let k=0;k<(o.isInstancedMesh?o.count:1);k++){
      if(o.isInstancedMesh){o.getMatrixAt(k,instance);world.multiplyMatrices(o.matrixWorld,instance)}else world.copy(o.matrixWorld);
      transform.multiplyMatrices(inverse,world);
      bounds.copy(g.boundingBox).applyMatrix4(transform);
      if(bounds.max.y<lower-E||bounds.min.y>upper+E||bounds.min.x>1+E||bounds.max.x<-1-E||bounds.min.z>1+E||bounds.max.z<-1-E)continue;
      counts.meshInstancesBroadphase++;
      for(let i=0;i+2<n;i+=3){
       for(let t=0;t<3;t++)verts[t].fromBufferAttribute(p,idx?idx.getX(i+t):i+t).applyMatrix4(transform);
       counts.triangleTests++;
       if(!triangleHits(verts,lower,upper,inner))continue;
       hit=true;counts.hitInstances++;
       const key=labels[j]+' / '+(o.userData.part||'?')+' / mesh '+index.get(o);
       const entry=hits[key]??={count:0,name:o.name||'',parent:o.parent?.name||'',geometry:g.type,instance:o.isInstancedMesh,firstPose:{...pose,tool},firstTriangle:i/3,firstInstance:k,firstWorldTriangle:verts.map(v=>v.clone().applyMatrix4(h.matrixWorld).toArray())};
       entry.count++;if(examples.length<10)examples.push({key,pose:{...pose,tool},instance:k});break;
      }
     }
    }
    if(hit)counts.hitSlabs++;
   }
  }
  // Independent yaw, arm, loader sweep; both endpoint wrist/tip values and neutral, not full continuous motion.
  for(const tool of ['gripper','breaker-arm','breaker-loader'])for(const yaw of [-180,-90,0,90,180])
    for(const arm of [-18,0,25])for(const bucket of [-8,12,36])
      for(const [wrist,tip,claw] of [[55,-25,0],[90,0,4],[115,25,24]])
       scan({yaw,arm,bucket,wrist,tip,claw,track:0},tool);
  result.qualities[quality]={...counts,distinctMeshPairWitnesses:Object.keys(hits).length,hits,examples};
 }
 return result;
}

console.log(JSON.stringify(audit(T,factory(read('mobot-engineering-v23-model.js')),factory(read('mobot-engineering-v24-actuator-lab-model.js'))),null,2));
