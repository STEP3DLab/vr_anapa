// Compare v23 variable-scale actuator proxies to v24 laboratory fixed lengths. All units arbitrary.
import fs from 'node:fs';
import * as T from '../mobot-assets/three.core.min.js';
import * as K from '../mobot-kinematics-v15.js';
const document={createElement:()=>({getContext:()=>null})};
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const factory=s=>new Function('PROFILE_V15','sharedAudit','sharedSweep','document',s.replace(/^import[^\n]+\n/,'').replace('export function makeMobot','function makeMobot')+'\nreturn makeMobot;')(K.PROFILE_V15,K.auditBucketPose,K.sweepBucketEnvelope,document);

function audit(T,baseFactory,candidateFactory){
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 const out={modelOnly:true,physicalScaleKnown:false,threeRevision:T.REVISION,qualities:{}};
 for(const quality of ['desktop','mobile']){
  const baseline=baseFactory(T,quality),candidate=candidateFactory(T,quality),all=[baseline,candidate],V=()=>new T.Vector3();
  const parts=m=>[[m.armFixed,m.armMoving,m.actuatorArmHousing,m.actuatorArmScrew],...m.framePins.map((a,i)=>[a,m.liftPins[i],m.loaderHousings[i].o,m.loaderScrews[i].o])];
  const names=['arm','loader-left','loader-right'];
  const make=()=>names.map(name=>({name,minPinDistance:Infinity,maxPinDistance:0,minHousing:Infinity,maxHousing:0,minRod:Infinity,maxRod:0,minInsertion:Infinity,maxInsertion:0,minExposedRod:Infinity,minRodToBase:Infinity,maxPinResidual:0,maxCoaxialError:0}));
  const stats=[make(),make()];
  const neutral={yaw:0,arm:0,wrist:90,claw:4,bucket:12,tip:0};
  all.forEach(r=>r.mechanisms.setPose(neutral));
  function endpoint(o,u){return o.localToWorld(new T.Vector3(0,u,0))}
  const neutralEndpoints=all.map(r=>parts(r.mechanisms).flatMap(([a,b,h,s])=>[endpoint(h,-.5),endpoint(h,.5),endpoint(s,-.5),endpoint(s,.5)]));
  let neutralDelta=Math.max(...neutralEndpoints[0].map((v,i)=>v.distanceTo(neutralEndpoints[1][i])));
  let maxAnchorDelta=0,maxOtherMeshTransformDelta=0,poseCount=0;
  function scan(r,k){
   const m=r.mechanisms; r.root.updateMatrixWorld(true);
   return parts(m).map(([a,b,h,s],i)=>{
    const A=a.getWorldPosition(V()),B=b.getWorldPosition(V()),D=A.distanceTo(B),H=h.scale.y,R=s.scale.y,q=stats[k][i];
    const e0=endpoint(h,-.5),e1=endpoint(h,.5),e2=endpoint(s,-.5),e3=endpoint(s,.5);
    const direction=B.clone().sub(A).normalize(),axisErr=Math.max(e1.clone().sub(e0).normalize().cross(direction).length(),e3.clone().sub(e2).normalize().cross(direction).length());
    q.minPinDistance=Math.min(q.minPinDistance,D);q.maxPinDistance=Math.max(q.maxPinDistance,D);
    q.minHousing=Math.min(q.minHousing,H);q.maxHousing=Math.max(q.maxHousing,H);
    q.minRod=Math.min(q.minRod,R);q.maxRod=Math.max(q.maxRod,R);
    q.minInsertion=Math.min(q.minInsertion,H+R-D);q.maxInsertion=Math.max(q.maxInsertion,H+R-D);
    q.minExposedRod=Math.min(q.minExposedRod,D-H);q.minRodToBase=Math.min(q.minRodToBase,D-R);
    q.maxPinResidual=Math.max(q.maxPinResidual,e0.distanceTo(A),e3.distanceTo(B));
    q.maxCoaxialError=Math.max(q.maxCoaxialError,axisErr);
    return [A,B];
   });
  }
  const other=r=>{const omit=new Set(parts(r.mechanisms).flatMap(a=>a.slice(2)));return r.meshes.filter(o=>!omit.has(o));};
  const others=all.map(other);
  assert(others[0].length===others[1].length,'non-actuator mesh count changed');
  for(let i=0;i<others[0].length;i++){let a=others[0][i],b=others[1][i];assert(a.geometry.type===b.geometry.type&&a.geometry.attributes.position.count===b.geometry.attributes.position.count,'non-actuator mesh geometry changed');}
  for(const yaw of [-180,0,90])for(const tool of ['gripper','breaker-arm','breaker-loader']){
   all.forEach(r=>r.mechanisms.setWorkTool(tool));
   for(let i=0;i<=220;i++){
    const pose={yaw,arm:-18+43*i/220,bucket:-8+44*i/220,wrist:55+60*i/220,claw:24*i/220,tip:-25+50*i/220};
    all.forEach(r=>r.mechanisms.setPose(pose));
    const a=scan(baseline,0),b=scan(candidate,1);
    a.forEach((pair,j)=>pair.forEach((v,k)=>maxAnchorDelta=Math.max(maxAnchorDelta,v.distanceTo(b[j][k]))));
    if(i===0||i===110||i===220){
     for(let j=0;j<others[0].length;j++){
      const m=others[0][j],n=others[1][j];
      assert(m.visible===n.visible,'non-actuator visibility changed');
      for(let k=0;k<16;k++)maxOtherMeshTransformDelta=Math.max(maxOtherMeshTransformDelta,Math.abs(m.matrixWorld.elements[k]-n.matrixWorld.elements[k]));
     }
    }
    poseCount++;
   }
  }
  for(const q of stats[1]){
   assert(q.maxHousing-q.minHousing<1e-10&&q.maxRod-q.minRod<1e-10,'rigid length changed');
   assert(q.minInsertion>0&&q.minExposedRod>0&&q.minRodToBase>0,'invalid telescoping travel');
   assert(q.maxPinResidual<1e-8&&q.maxCoaxialError<1e-8,'bad mount');
  }
  assert(neutralDelta<1e-8&&maxAnchorDelta<1e-8&&maxOtherMeshTransformDelta<1e-8,'baseline regression');
  out.qualities[quality]={poseCount,actuatorCount:3,nonActuatorMeshCount:others[0].length,nonActuatorTransformCheckedPoses:27,maxOtherMeshTransformDelta,neutralDelta,maxAnchorDelta,baseline:stats[0],candidate:stats[1]};
 }
 return out;
}

console.log(JSON.stringify(audit(T,factory(read('mobot-engineering-v23-model.js')),factory(read('mobot-engineering-v24-actuator-lab-model.js'))),null,2));
