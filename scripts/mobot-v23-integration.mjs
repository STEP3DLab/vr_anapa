// Audit actual v23-lab module against v22 with periodic tangent; no WebGL.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const base=read('mobot-engineering-v22-model.js'),candidate=read('mobot-engineering-v23-model.js');
const needle="const point=path.getPoint(t), tangent=path.getTangent(t);",periodic="const point=path.getPoint(t), tangent=path.getPoint(THREE.MathUtils.euclideanModulo(t+1e-4,1)).sub(path.getPoint(THREE.MathUtils.euclideanModulo(t-1e-4,1))).normalize();";
if(base.split(needle).length!==2)throw Error('Unexpected baseline');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);
function audit(T,factories){
 const N=114,mat=new T.Matrix4(),res={modelOnly:true,physicalScaleKnown:false,threeRevision:T.REVISION,qualities:{}};
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 function hull(points){
  const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).filter((a,i,all)=>!i||a[0]!==all[i-1][0]||a[1]!==all[i-1][1]);
  const half=pts=>{let h=[];for(const p of pts){while(h.length>=2){let a=h.at(-2),b=h.at(-1);if((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>1e-12)break;h.pop();}h.push(p);}return h.slice(0,-1);};
  return half(sorted).concat(half([...sorted].reverse()));
 }
 function pairsets(r){
  let pads=[],cleats=[];
  r.root.traverse(o=>{if(o.isInstancedMesh&&o.userData.part==='tracks'&&o.count===N)(o.name.startsWith('Отдельные траки')?pads:cleats).push(o);});
  check(pads.length===2&&cleats.length===2,'track meshes missing');
  return pads.map(p=>[p,cleats.find(c=>c.parent===p.parent)].map(mesh=>{
   const pos=mesh.geometry.attributes.position,pts=[];let zmin=Infinity,zmax=-Infinity;
   for(let i=0;i<pos.count;i++){pts.push([pos.getX(i),pos.getY(i)]);zmin=Math.min(zmin,pos.getZ(i));zmax=Math.max(zmax,pos.getZ(i));}
   return {mesh,hull:hull(pts),zmin,zmax};
  }));
 }
 function read(o,i){
  o.mesh.getMatrixAt(i,mat);const e=mat.elements;
  check(e.every(Number.isFinite),'nonfinite matrix');
  return {x:e[12],y:e[13],polygon:o.hull.map(([x,y])=>[e[12]+x*e[0]+y*e[4],e[13]+x*e[1]+y*e[5]])};
 }
 function sat(a,b){let best=-Infinity;for(const poly of [a,b])for(let i=0;i<poly.length;i++){const [x,y]=poly[i],[X,Y]=poly[(i+1)%poly.length],l=Math.hypot(X-x,Y-y),u=(Y-y)/l,v=(x-X)/l;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const [r,s] of a){const q=r*u+s*v;amin=Math.min(amin,q);amax=Math.max(amax,q);}for(const [r,s] of b){const q=r*u+s*v;bmin=Math.min(bmin,q);bmax=Math.max(bmax,q);}best=Math.max(best,bmin-amax,amin-bmax);}return best;}
 for(const quality of ['desktop','mobile']){
  const robots=factories.map(f=>f(T,quality)),p=robots[0].mechanisms.sourceProfile();
  const q=robots[1].mechanisms.sourceProfile();check(p.version==='v22-research'&&q.version==='v23-research','unexpected source version');check(JSON.stringify({...p,version:null})===JSON.stringify({...q,version:null}),'source profile changed');
  const path=new T.CurvePath();p.trackContour.forEach(([x,y],i)=>{const [a,b]=p.trackContour[(i+1)%p.trackContour.length];path.add(new T.LineCurve3(new T.Vector3(x,y,0),new T.Vector3(a,b,0)));});
  const P=path.getLength(),pitch=P/N,sets=robots.map(pairsets),phases=Array.from({length:241},(_,i)=>i*pitch/241).concat([-P*1e-4,-P*1e-8,0,P*1e-8,P*1e-4]);
  check(sets[0][0][0].hull.length===4&&sets[1][0][0].hull.length===6,'unexpected polygon');
  for(let i=0;i<2;i++)check(sets[0][i][0].zmin===sets[1][i][0].zmin&&sets[0][i][0].zmax===sets[1][i][0].zmax,'pad width changed');
  let delta=0,checks=0;
  const stats=robots.map(()=>({minPadY:Infinity,minCleatY:Infinity,minPadGap:Infinity,minCrossGap:Infinity,overlaps:0}));
  for(const phase of phases){
   robots.forEach(r=>r.mechanisms.setTrackPhase(phase));
   for(let side=0;side<2;side++){
    const all=sets.map(s=>s[side].map(o=>Array.from({length:N},(_,i)=>read(o,i))));
    for(let i=0;i<N;i++){
     delta=Math.max(delta,Math.hypot(all[0][0][i].x-all[1][0][i].x,all[0][0][i].y-all[1][0][i].y));
     let j=(i+1)%N;
     for(let k=0;k<2;k++){
      const [pads,cleats]=all[k],s=stats[k],a=pads[i].polygon,b=cleats[i].polygon;
      for(const v of a)s.minPadY=Math.min(s.minPadY,v[1]);for(const v of b)s.minCleatY=Math.min(s.minCleatY,v[1]);
      const g=sat(a,pads[j].polygon);
      s.minPadGap=Math.min(s.minPadGap,g);
      if(g<-1e-7)s.overlaps++;
      s.minCrossGap=Math.min(s.minCrossGap,sat(a,cleats[j].polygon),sat(b,pads[j].polygon),sat(b,cleats[j].polygon));
     }checks+=4;
    }
   }
  }
  check(stats[0].overlaps>0&&stats[1].overlaps===0&&stats[1].minPadGap>0&&stats[1].minCrossGap>0&&delta<1e-8,'candidate regression');
  check(stats[0].minCleatY<p.lowerTrackDatum && stats[1].minCleatY>p.lowerTrackDatum,'ground clearance regression');
  res.qualities[quality]={phases:phases.length,positionsPerVariant:phases.length*N*2,checksPerVariant:checks,centerDelta:delta,baselinePeriodic:stats[0],chamferAndInsetPeriodic:stats[1],actualCandidatePadHull:sets[1][0][0].hull,actualPadWidth:sets[1][0][0].zmax-sets[1][0][0].zmin,actualCleatHull:sets[1][0][1].hull,actualCleatWidth:sets[1][0][1].zmax-sets[1][0][1].zmin};
 }
 return res;
}

console.log(JSON.stringify(audit(T,[factory(base.replace(needle,periodic)),factory(candidate)]),null,2));
