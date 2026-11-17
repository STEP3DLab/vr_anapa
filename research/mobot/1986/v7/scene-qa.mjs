// Run with Node 22+ from any directory. Uses the same vendored Three.js as the viewer.
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const model=makeMobot1986(T), {root,sections,mechanisms,defaults}=model;
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const world=(obj,x=0,y=0,z=0)=>obj.localToWorld(vec(x,y,z));
const box=obj=>new T.Box3().setFromObject(obj,true);
const named=name=>root.getObjectByName(name);
const close=(a,b)=>assert(a.distanceTo(b)<1e-8,'attachment gap '+a.distanceTo(b));
const report={runtime:'Three.js r'+T.REVISION+' / Node '+process.version,tests:[]};
function check(name,fn){
  try{const data=fn();report.tests.push({name,status:'PASS',...data});}
  catch(e){report.tests.push({name,status:'FAIL',error:e.message});process.exitCode=1;}
  model.setPose(defaults);
}
check('Vertices, normals, transforms and instance matrices',()=>{
  let meshes=0,drawnInstances=0,vertices=0;
  for(const pose of [defaults,{yaw:115,boom:32,loader:14,tip:-5,grab:32,track:81}]){
    model.setPose(pose);root.traverse(o=>{
      assert(o.matrixWorld.elements.every(Number.isFinite));
      if(!o.isMesh)return;
      for(const a of Object.values(o.geometry.attributes))assert(a.array.every(Number.isFinite));
      if(o.isInstancedMesh)assert(o.instanceMatrix.array.every(Number.isFinite));
      if(pose===defaults){meshes++;drawnInstances+=o.isInstancedMesh?o.count:1;vertices+=o.geometry.attributes.position.count;}
    });
  }
  return {meshes,drawnInstances,vertices};
});
check('Wheel centres, gaps, closed belt and continuous contact',()=>{
  const p=model.sourceProfile(),wheels=[...p.wheelXs.map(x=>[x,p.wheelY,p.wheelRadius]),...p.endWheels];
  assert.equal(wheels.length,9);const gaps=wheels.map(()=>Infinity);
  for(let i=0;i<wheels.length;i++)for(let j=i+1;j<wheels.length;j++){
    const [x,y,r]=wheels[i],[u,v,s]=wheels[j];assert(Math.hypot(x-u,y-v)>r+s);
  }
  for(let i=0;i<5000;i++){
    const [x,y]=p.onBelt(i*p.length/5000);
    wheels.forEach(([u,v,r],j)=>{gaps[j]=Math.min(gaps[j],Math.hypot(x-u,y-v)-r-p.shoeThickness/2);});
  }
  assert(gaps.every(g=>Math.abs(g)<.00002));close(vec(...p.onBelt(0)),vec(...p.onBelt(p.length)));
  return {trackSamples:5000,wheelCountPerSide:wheels.length,maxContactResidual:Math.max(...gaps.map(Math.abs)),units:'scene'};
});
check('Six independent motions and return to neutral',()=>{
  const {turntable,boom,grab,loader,scoop}=mechanisms;
  const belt=model.objects.find(o=>o.isInstancedMesh);
  function probe(key){
    if(key==='track')return new T.Matrix4().fromArray(belt.instanceMatrix.array).elements;
    const part={yaw:turntable,boom,loader,tip:scoop,grab:sections['Ковшевая челюсть 1']}[key];
    return world(part,.23,-.3,.19).toArray();
  }
  for(const k of Object.keys(defaults)){
    const start=probe(k);model.setPose({[k]:12});
    assert.notDeepEqual(probe(k),start,k+' did not move');
    model.setPose(defaults);assert.deepEqual(probe(k),start,k+' did not return');
  }
  let prev=-1;
  for(const angle of [0,8,16,24,32]){
    model.setPose({grab:angle});const gap=world(sections['Ковшевая челюсть -1'],.143,-model.v7.lipDepth).distanceTo(world(sections['Ковшевая челюсть 1'],-.143,-model.v7.lipDepth));
    if(!angle)assert(gap<1e-9);assert(gap>prev);prev=gap;
  }
  const before=model.setPose({yaw:7});assert.throws(()=>model.setPose({yaw:99,boom:NaN}));assert.deepEqual(model.setPose(),before);
  assert.equal(grab.parent,boom);return {coordinates:6,maxJawLipGap:prev};
});
check('Structural joints, linkage endpoints and selected collision envelopes',()=>{
  const {boom,grab,loader,scoop}=mechanisms;
  const rods=loader.children.filter(o=>o.name.startsWith('Тяга наклона'));
  const pins=scoop.children.filter(o=>o.name==='Палец наклона');
  const hood=box(named('Арочный кожух')),platform=box(named('Настил платформы'));
  for(const [a,b] of [['Поперечная балка к бортам','Внутренняя продольная балка'],['Опорный отбортованный край','Настил платформы'],['Седло цилиндрического корпуса','Низкий цилиндрический корпус'],['Палец подвеса','Щека серьги']])assert(box(named(a)).intersectsBox(box(named(b))),a);
  let poses=0,minBucket=Infinity,minGrab=Infinity;
  for(let yaw=-180;yaw<=180;yaw+=15)for(const lift of [0,16,32])for(const loaderAngle of [0,8,16])for(const tip of [-5,10,25])for(const grip of [0,16,32]){
    model.setPose({yaw,boom:lift,loader:loaderAngle,tip,grab:grip});
    close(world(boom,-1.49,.30),world(grab));
    close(world(loader,1.4,-.08),world(scoop));
    for(let i=0;i<rods.length;i++)close(world(rods[i],0,.5),world(pins[i]));
    for(const sign of [-1,1])close(world(grab,sign*.143,-.575),world(sections['Ковшевая челюсть '+sign]));
    const vertical=world(grab,0,1).sub(world(grab));close(vertical,vec(0,1,0));
    const g=box(grab),s=box(scoop);
    assert(!g.intersectsBox(hood)&&!g.intersectsBox(s)&&!g.intersectsBox(platform),'grapple overlap at '+[yaw,lift,loaderAngle,tip,grip]);
    minBucket=Math.min(minBucket,s.min.y-model.groundY);minGrab=Math.min(minGrab,g.min.y-model.groundY);poses++;
  }
  assert(minBucket>=0&&minGrab>=0);
  const reportPose=model.auditPose();
  assert(reportPose.bucketClearance>=0&&reportPose.grappleClearance>=0);
  return {poses,minBucketGroundClearance:minBucket,minGrappleGroundClearance:minGrab,units:'scene',scope:'Samples; grapple against hood, scoop and deck; scoop and grapple against floor. Not all-pairs collision detection.'};
});
console.log(JSON.stringify(report,null,2));
