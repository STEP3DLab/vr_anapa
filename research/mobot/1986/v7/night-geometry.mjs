// Run one mechanical experiment on the actual displayed Three.js geometry.
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const [phase,output]=process.argv.slice(2), model=makeMobot1986(T,process.env.MOBOT_EXTENSION ? Number(process.env.MOBOT_EXTENSION) : undefined);
const {sections,mechanisms}=model, v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const at=(o,x=0,y=0,z=0)=>o.localToWorld(v(x,y,z));
const round=n=>Number(n.toPrecision(8));
function links(){
  let maximum=0,spacingError=0,previous=-1,minimumGain=Infinity,poses=0;
  for(const [yaw,boom] of [[0,0],[-180,32],[90,16],[178,1]]){
    previous=-1;
    for(let i=0;i<=800;i++){
      model.setPose({yaw,boom,grab:i/25});
      for(const {A,eye,jaw,first,second,elbow} of model.v7.linkages){
        const top=first.parent.localToWorld(A.clone()),joint=at(elbow),bottom=jaw.localToWorld(eye.clone());
        const gaps=[at(first,0,-.5).distanceTo(top),at(first,0,.5).distanceTo(joint),
          at(second,0,-.5).distanceTo(joint),at(second,0,.5).distanceTo(bottom)];
        maximum=Math.max(maximum,...gaps);
        spacingError=Math.max(spacingError,Math.abs(top.distanceTo(joint)-model.v7.lengths[0]),Math.abs(joint.distanceTo(bottom)-model.v7.lengths[1]));
      }
      const lips=[-1,1].map(s=>at(sections['Ковшевая челюсть '+s],-s*.143,-model.v7.lipDepth));
      const gap=lips[0].distanceTo(lips[1]);if(i)minimumGain=Math.min(minimumGain,gap-previous);previous=gap;poses++;
    }
  }
  return {status:maximum<1e-7&&spacingError<1e-7&&minimumGain>0?'PASS':'FAIL',poses,linksPerPose:4,
    maxAttachmentGap:round(maximum),maxRodLengthError:round(spacingError),minimumOpeningIncrement:round(minimumGain)};
}
function tracks(){
  const profile=model.sourceProfile(),wheels=[...profile.wheelXs.map(x=>[x,profile.wheelY,profile.wheelRadius]),...profile.endWheels];
  const belts=model.objects.filter(o=>o.name==='Башмаки замкнутой ленты'),matrix=new T.Matrix4(),inverse=new T.Matrix4();
  let deepest=0,largestGap=0,worst=null,distances=0;
  for(let j=0;j<128;j++){
    model.setPose({track:profile.pitch*j/128/.015});
    for(const belt of belts){
      const {width,height}=belt.geometry.parameters,nearest=wheels.map(()=>Infinity);
      for(let i=0;i<belt.count;i++){
        belt.getMatrixAt(i,matrix);inverse.copy(matrix).invert();
        for(const [n,[x,y,r]] of wheels.entries()){
          const c=v(x,y,0).applyMatrix4(inverse);
          const dx=Math.max(Math.abs(c.x)-width/2,0),dy=Math.max(Math.abs(c.y)-height/2,0);
          const gap=Math.hypot(dx,dy)-r;
          nearest[n]=Math.min(nearest[n],gap);
          if(gap<deepest){deepest=gap;worst={phase:j,shoe:i,wheel:n,side:belt.parent.name};}
          distances++;
        }
      }
      largestGap=Math.max(largestGap,...nearest);
    }
  }
  return {status:deepest>=-.001&&largestGap<=.002?'PASS':'FAIL',phases:128,distances,deepestSignedClearance:round(deepest),
    largestNearestGap:round(largestGap),worst,modelTolerances:{penetration:.001,gap:.002},scope:'Actual rectangular shoes vs circular nominal wheel profiles, ignoring intended axial overlap.'};
}
function loader(){
  const {scoop,loader}=mechanisms, rods=loader.children.filter(o=>o.name.startsWith('Тяга наклона')),pins=scoop.children.filter(o=>o.name==='Палец наклона');
  let minimum=Infinity,worst,maxGap=0,poses=0;const box=new T.Box3();
  for(let i=0;i<=64;i++)for(let j=0;j<=120;j++){
    const lift=i/4,tip=j/4-5;model.setPose({loader:lift,tip});
    const gap=box.setFromObject(scoop,true).min.y-model.groundY;
    if(gap<minimum){minimum=gap;worst={lift,tip};}
    maxGap=Math.max(maxGap,...rods.map((o,k)=>at(o,0,.5).distanceTo(at(pins[k]))));poses++;
  }
  return {status:minimum>=0&&maxGap<1e-7?'PASS':'FAIL',poses,minimumGroundClearance:round(minimum),worst,maxRodPinGap:round(maxGap),
    scope:'Lowest transformed mesh vertex vs horizontal ground; linkage attachment endpoint at both pins.'};
}
function collisions(){
  const {grab,scoop}=mechanisms;
  const hood=new T.Box3().setFromObject(sections['Рама и округлый кожух'].getObjectByName('Арочный кожух'),true);
  const deck=new T.Box3().setFromObject(sections['Рама и округлый кожух'].getObjectByName('Настил платформы'),true);
  const gap=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));
  function halton(i,b){let sum=0,f=1;while(i){f/=b;sum+=f*(i%b);i=Math.floor(i/b);}return sum;}
  const worst={},a=new T.Box3(),b=new T.Box3(),poses=6144;
  for(let i=1;i<=poses;i++){
    const pose={yaw:360*halton(i,2)-180,boom:32*halton(i,3),grab:32*halton(i,5),loader:16*halton(i,7),tip:30*halton(i,11)-5};
    model.setPose(pose);a.setFromObject(grab,true);b.setFromObject(scoop,true);
    for(const [key,target] of [['hood',hood],['scoop',b],['deck',deck]]){
      const separation=gap(a,target);
      if(!worst[key]||separation<worst[key].separation)worst[key]={separation:round(separation),pose};
    }
  }
  return {status:Object.values(worst).every(x=>x.separation>0)?'PASS':'FAIL',poses,worst,scope:'Positive separation between world AABBs certifies separation; zero requires triangle-level review. Only these three pairs were checked.'};
}
const runners={links,tracks,loader,collisions};
if(!runners[phase])throw Error('Unknown phase '+phase);
const result={phase,units:'условные единицы сцены',...runners[phase]()};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
if(result.status!=='PASS')process.exitCode=1;
