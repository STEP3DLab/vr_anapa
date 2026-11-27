// Analytic envelope containment for fixed-length C-grade actuator proxies.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);

function audit(T,baseFactory,candidateFactory){
 const assert=(ok,m)=>{if(!ok)throw Error(m)};
 const result={threeRevision:T.REVISION,modelOnly:true,physicalScaleKnown:false,method:'Rigid pivot => D²=c0+cCos*cos(theta)+cSin*sin(theta); fit three orthogonal angles and evaluate endpoints and stationary points. Cross-check independent slider grid. Cylinder envelope inclusion follows axial interval inclusion and same regular polygon radii and orientation.',qualities:{}};
 const V=()=>new T.Vector3(),rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
 const get=m=>[[m.armFixed,m.armMoving,m.actuatorArmHousing,m.actuatorArmScrew],...m.framePins.map((o,i)=>[o,m.liftPins[i],m.loaderHousings[i].o,m.loaderScrews[i].o])];
 const neutral={yaw:0,arm:0,wrist:90,bucket:12,tip:0,claw:4,track:0};
 for(const quality of ['desktop','mobile']){
  const b=baseFactory(T,quality),r=candidateFactory(T,quality),m=b.mechanisms,n=r.mechanisms,P=get(m),Q=get(n);
  const d2=([a,b])=>a.getWorldPosition(V()).distanceToSquared(b.getWorldPosition(V()));
  const stats=[];
  for(let j=0;j<3;j++){
   const key=j===0?'arm':'bucket',limits=j===0?[-18,25]:[-8,36],samples=[0,90,180].map(theta=>{m.setPose({...neutral,[key]:theta});return d2(P[j])});
   const c0=(samples[0]+samples[2])/2,cos=(samples[0]-samples[2])/2,sin=samples[1]-c0;
   const f=d=>c0+cos*Math.cos(rad(d))+sin*Math.sin(rad(d));
   const stationary=deg(Math.atan2(sin,cos)),critical=[...limits];
   for(let k=-3;k<=3;k++){const t=stationary+180*k;if(t>limits[0]&&t<limits[1])critical.push(t);}
   const lo=Math.sqrt(Math.min(...critical.map(f))),hi=Math.sqrt(Math.max(...critical.map(f)));
   n.setPose(neutral);const H=Q[j][2].scale.y,R=Q[j][3].scale.y,oldFactor=j===0?.68:.66;
   const margins={outerHousing:oldFactor*lo-H,rodBehindBase:lo-R,insertion:H+R-hi,rodExposed:lo-H};
   assert(Object.values(margins).every(x=>x>0),'non-positive inclusion margin');
   stats.push({actuator:['arm','loader-left','loader-right'][j],key,limits,coefficients:{c0,cos,sin},criticalAngles:critical,minDistance:lo,maxDistance:hi,fixedHousing:H,fixedRod:R,margins,maxDistanceSquaredFitError:0,maxAxisError:0,maxAnchorOffset:0,maxLengthError:0,maxEnvelopeExcess:0,gridPoses:0});
  }
  for(const tool of ['gripper','breaker-arm','breaker-loader'])for(const yaw of [-180,-90,0,90,180])
   for(let arm=-18;arm<=25;arm++)for(let bucket=-8;bucket<=36;bucket+=4){
    const pose={...neutral,yaw,arm,bucket,wrist:55+60*(arm+18)/43,tip:-25+50*(bucket+8)/44,claw:24*(arm+18)/43};
    [m,n].forEach(x=>{x.setWorkTool(tool);x.setPose(pose)});
    for(let j=0;j<3;j++){
     const q=stats[j],p=P[j],c=Q[j],D=Math.sqrt(d2(p)),H=c[2].scale.y,R=c[3].scale.y,t=rad(pose[q.key]);
     const f=q.coefficients.c0+q.coefficients.cos*Math.cos(t)+q.coefficients.sin*Math.sin(t);
     q.maxDistanceSquaredFitError=Math.max(q.maxDistanceSquaredFitError,Math.abs(D*D-f));
     q.maxLengthError=Math.max(q.maxLengthError,Math.abs(H-q.fixedHousing),Math.abs(R-q.fixedRod));
     q.maxEnvelopeExcess=Math.max(q.maxEnvelopeExcess,H-p[2].scale.y,R-D,D-H-R);
     for(let k=0;k<2;k++)q.maxAnchorOffset=Math.max(q.maxAnchorOffset,p[k].getWorldPosition(V()).distanceTo(c[k].getWorldPosition(V())));
     for(let k=2;k<4;k++){
      const g=c[k].geometry.parameters,h=p[k].geometry.parameters;
      assert(g.radialSegments===16&&h.radialSegments===16&&g.thetaStart===h.thetaStart&&g.thetaLength===h.thetaLength&&c[k].scale.x===p[k].scale.x&&c[k].scale.z===p[k].scale.z,'cross-section changed');
      q.maxAxisError=Math.max(q.maxAxisError,1-Math.abs(c[k].getWorldQuaternion(new T.Quaternion()).dot(p[k].getWorldQuaternion(new T.Quaternion()))));
      // Check real endpoints, not just local dimensions.
      const end=c[k].localToWorld(new T.Vector3(0,k===2?-.5:.5,0));
      q.maxAnchorOffset=Math.max(q.maxAnchorOffset,end.distanceTo(c[k-2].getWorldPosition(V())));
     }
     q.gridPoses++;
    }
   }
  for(const q of stats)assert(q.maxDistanceSquaredFitError<1e-9&&q.maxAnchorOffset<1e-9&&q.maxAxisError<1e-9&&q.maxLengthError<1e-9&&q.maxEnvelopeExcess<1e-9,'regression');
  result.qualities[quality]=stats;
 }
 return result;
}

console.log(JSON.stringify(audit(T,factory(read('mobot-engineering-v23-model.js')),factory(read('mobot-engineering-v24b-actuator-lab-model.js'))),null,2));
