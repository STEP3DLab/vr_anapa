// Actual instanced track regression: v22 versus isolated periodic-tangent patch.
// Scene units, not dimensions of the historic machine. No browser or WebGL requirement.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const source=fs.readFileSync(new URL('../mobot-engineering-v22-model.js',import.meta.url),'utf8');
const needle="const point=path.getPoint(t), tangent=path.getTangent(t);", replacement="const point=path.getPoint(t), tangent=path.getPoint(THREE.MathUtils.euclideanModulo(t+1e-4,1)).sub(path.getPoint(THREE.MathUtils.euclideanModulo(t-1e-4,1))).normalize();";
if(source.split(needle).length!==2)throw Error('Unexpected baseline');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);

function audit(T,baseFactory,candidateFactory){
 const fail=(x,msg)=>{if(!x)throw Error(msg)};
 const N=114,qualities=['desktop','mobile'],output={modelOnly:true,physicalScaleKnown:false,threeRevision:T.REVISION,qualities:{}};
 const mat=new T.Matrix4();
 function getPairs(robot){
   const pads=[],cleats=[];
   robot.root.traverse(o=>{if(o.isInstancedMesh&&o.userData.part==='tracks'&&o.count===N){(o.name.startsWith('Отдельные траки')?pads:cleats).push(o)}});
   fail(pads.length===2&&cleats.length===2,'missing track meshes');
   return pads.map(p=>[p,cleats.find(c=>c.parent===p.parent)]);
 }
 function rect(mesh,i){
  mesh.getMatrixAt(i,mat);const e=mat.elements,q=mesh.geometry.parameters;
  fail(e.every(Number.isFinite),'nonfinite mesh transform');
  return {x:e[12],y:e[13],c:e[0],s:e[1],hx:q.width/2,hy:q.height/2};
 }
 function gap(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  let best=-Infinity;
  for(const [u,v] of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]){
   const ra=a.hx*Math.abs(u*a.c+v*a.s)+a.hy*Math.abs(-u*a.s+v*a.c);
   const rb=b.hx*Math.abs(u*b.c+v*b.s)+b.hy*Math.abs(-u*b.s+v*b.c);
   best=Math.max(best,Math.abs(dx*u+dy*v)-ra-rb);
  }
  return best;
 }
 function bottom(a){return a.y-Math.abs(a.s)*a.hx-Math.abs(a.c)*a.hy}
 const angle=(a,b)=>Math.abs(Math.atan2(a.c*b.s-a.s*b.c,a.c*b.c+a.s*b.s))*180/Math.PI;
 for(const quality of qualities){
  const base=baseFactory(T,quality),next=candidateFactory(T,quality);
  const p=base.mechanisms.sourceProfile(),q=next.mechanisms.sourceProfile();
  fail(JSON.stringify(p)===JSON.stringify(q),'source profile changed');
  const loop=new T.CurvePath();
  p.trackContour.forEach(([x,y],i)=>{const [a,b]=p.trackContour[(i+1)%p.trackContour.length];loop.add(new T.LineCurve3(new T.Vector3(x,y,0),new T.Vector3(a,b,0)))});
  const P=loop.getLength(),pitch=P/N;
  const pairsets=[getPairs(base),getPairs(next)];
  const phases=Array.from({length:241},(_,i)=>i*pitch/241).concat([-P*1e-4,-P*1e-8,0,P*1e-8,P*1e-4]);
  const makeStats=()=>({minPadY:Infinity,minCleatY:Infinity,adjacentMinSeparatingAxisGap:{padPad:Infinity,cleatCleat:Infinity,padCleat:Infinity,cleatPad:Infinity},overlapCounts:{padPad:0,cleatCleat:0,padCleat:0,cleatPad:0},minWheelGap:Infinity});
  const st=[makeStats(),makeStats()];let maxCenterDelta=0,maxDirectionDelta=0;
  let adjacentChecksPerVariant=0;
  const wheels=[...p.lowerWheels,...p.terminalWheels];
  for(const phase of phases){
   base.mechanisms.setTrackPhase(phase);next.mechanisms.setTrackPhase(phase);
   for(let side=0;side<2;side++){
    const all=pairsets.map(ps=>ps[side].map(mesh=>Array.from({length:N},(_,i)=>rect(mesh,i))));
    for(let i=0;i<N;i++){
      maxCenterDelta=Math.max(maxCenterDelta,Math.hypot(all[0][0][i].x-all[1][0][i].x,all[0][0][i].y-all[1][0][i].y));
      maxDirectionDelta=Math.max(maxDirectionDelta,angle(all[0][0][i],all[1][0][i]));
      const j=(i+1)%N;
      for(let m=0;m<2;m++){
       const [pads,cleats]=all[m],s=st[m],a=pads[i],b=cleats[i];
       s.minPadY=Math.min(s.minPadY,bottom(a));s.minCleatY=Math.min(s.minCleatY,bottom(b));
       for(const w of wheels){const x=w.x-a.x,y=w.y-a.y,u=Math.max(0,Math.abs(x*a.c+y*a.s)-a.hx),v=Math.max(0,Math.abs(-x*a.s+y*a.c)-a.hy);s.minWheelGap=Math.min(s.minWheelGap,Math.hypot(u,v)-w.r);}
       for(const [key,r1,r2] of [['padPad',a,pads[j]],['cleatCleat',b,cleats[j]],['padCleat',a,cleats[j]],['cleatPad',b,pads[j]]]){
        const g=gap(r1,r2);s.adjacentMinSeparatingAxisGap[key]=Math.min(s.adjacentMinSeparatingAxisGap[key],g);
        if(g < -1e-7)s.overlapCounts[key]++;
       }
      }
      adjacentChecksPerVariant+=4;
    }
   }
  }
  const seam=[];
  for(let j=0;j<2;j++){
   const robot=[base,next][j],mesh=pairsets[j][0][0];
   robot.mechanisms.setTrackPhase(-P*1e-8);const left=rect(mesh,0);
   robot.mechanisms.setTrackPhase(P*1e-8);const right=rect(mesh,0);
   seam.push(angle(left,right));
  }
  fail(maxCenterDelta<1e-7,'pad centers changed');
  fail(seam[0]>3.7&&seam[1]<.001,'seam regression');
  fail(st[1].minWheelGap>=-1e-7,'wheel intrusion');
  fail(Math.abs(st[1].minCleatY-st[0].minCleatY)<1e-7,'cleat datum regression');
  output.qualities[quality]={phases:phases.length,instanceSamplesPerVariant:phases.length*N*2,adjacentChecksPerVariant,maxCenterDelta,maxDirectionDelta,nearSeamDegrees:{baseline:seam[0],candidate:seam[1]},baseline:st[0],candidate:st[1]};
 }
 return output;
}

console.log(JSON.stringify(audit(T,factory(source),factory(source.replace(needle,replacement))),null,2));
