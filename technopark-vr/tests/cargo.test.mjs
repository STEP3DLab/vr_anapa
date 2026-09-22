import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(tmpdir(),'vr-cargo-'));
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
try{
 await build({absWorkingDir:root,entryPoints:['src/cargoScene.ts','src/cargoMath.ts'],outdir:temp,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'}});
 const {ARM,solveArm,overlapsBarrier,outsideField,segmentBlocked,atBase,toLocal,toWorld}=await import(pathToFileURL(join(temp,'cargoMath.mjs')));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(let i=0;i<1500;i++){
  const goal={x:Math.sin(i*1.713)*4,y:(i%100)/20,z:Math.cos(i*2.319)*4};
  const s=solveArm(goal);assert.ok(Math.abs(distance(ARM.shoulder,s.elbow)-ARM.upper)<1e-8);assert.ok(Math.abs(distance(s.wrist,s.elbow)-ARM.fore)<1e-8);
  if(s.reachable)assert.ok(distance(goal,s.wrist)<1e-8);
 }
 for(const goal of [ARM.shoulder,{...ARM.shoulder,y:5},{...ARM.shoulder,y:0}]){const s=solveArm(goal);assert.ok(Math.abs(distance(ARM.shoulder,s.elbow)-ARM.upper)<1e-8);assert.ok(Math.abs(distance(s.wrist,s.elbow)-ARM.fore)<1e-8);}
 const point={x:3,y:.36,z:-7};assert.ok(distance(point,toWorld(-5,-2,1.3,toLocal(-5,-2,1.3,point)))<1e-8);
 assert.ok(atBase(0,2));assert.ok(!atBase(5,2));assert.ok(outsideField(10,0,0));
 assert.equal(overlapsBarrier(0,0,0,{x:2,z:0,w:.2,d:6}),false);assert.equal(overlapsBarrier(0,0,Math.PI/2,{x:2,z:0,w:.2,d:6}),true,'turning must include the rear platform');
 assert.ok(segmentBlocked({x:0,y:1,z:1},{x:0,y:1,z:-4},[{x:0,z:-2,w:3,d:.6}]));assert.ok(!segmentBlocked({x:3,y:1,z:1},{x:3,y:1,z:-4},[{x:0,z:-2,w:3,d:.6}]));
 const {createCargoScene}=await import(pathToFileURL(join(temp,'cargoScene.mjs')));const messages=[];const cargo=createCargoScene(s=>messages.push(s));
 const robot=cargo.robot,upper=robot.getObjectByName('cargo-upper-link'),fore=robot.getObjectByName('cargo-fore-link'),claw=robot.getObjectByName('cargo-claw'),statusLamp=robot.getObjectByName('cargo-status-lamp'),crate=cargo.packages[0];assert.ok(statusLamp,'rover exposes a visible status beacon');let bayCount=0;cargo.root.traverse(o=>{if(o.name?.startsWith('cargo-delivery-bay-'))bayCount++;});assert.equal(bayCount,3,'base exposes three delivery progress bays');
 const step=(n,active=true,drive=0,turn=0)=>{for(let i=0;i<n;i++){cargo.update(1/60,drive,turn,active);assert.ok(Math.abs(upper.scale.y-ARM.upper)<1e-8);assert.ok(Math.abs(fore.scale.y-ARM.fore)<1e-8);}};
 robot.position.set(-5,0,0);cargo.update(0,0,0,false);assert.match(cargo.hint(),/ДОСТУПЕН/);
 cargo.interact();assert.ok(cargo.busy);assert.equal(crate.parent,cargo.root,'do not attach before the claw closes');step(60);assert.equal(crate.parent,cargo.root);
 step(70);assert.equal(crate.parent,robot);assert.ok(Math.abs(crate.position.y-(claw.position.y-ARM.gripOffset))<1e-8);
 const frozenTip=claw.position.clone(),frozenCrate=crate.position.clone();step(600,false,1,1);assert.ok(frozenTip.distanceTo(claw.position)<1e-8);assert.ok(frozenCrate.distanceTo(crate.position)<1e-8);
 step(240);assert.ok(!cargo.busy);assert.ok(cargo.loaded);assert.ok(distance(crate.position,{x:0,y:1.31,z:1.85})<1e-8,'load must rest on the rear platform');
 cargo.interact();assert.ok(!cargo.busy,'no unloading outside the base');robot.position.set(0,0,2);cargo.update(0,0,0,false);cargo.interact();assert.ok(cargo.busy);step(180);assert.equal(cargo.delivered,0,'do not credit delivery before placement');step(190);assert.equal(cargo.delivered,1);assert.ok(crate.userData.delivered);assert.equal(crate.parent,cargo.root);assert.ok(Math.abs(crate.position.x)<=2.8&&Math.abs(crate.position.z-2)<=1.8);assert.ok(Math.abs(crate.position.y-.36)<1e-8);
 cargo.interact();assert.equal(cargo.delivered,1);cargo.reset();assert.equal(cargo.delivered,0);assert.ok(!cargo.busy&&!cargo.loaded);assert.equal(crate.parent,cargo.root);
 robot.position.set(-5,0,0);step(1,true,0,1);cargo.interact();assert.ok(!cargo.busy,'turning also prevents acquisition');
 // Operate all three loads through the public arm inputs, without teleporting the wrist.
 cargo.reset();
 const steer=goal=>{
  const angleError=()=>Math.atan2(Math.sin(Math.atan2(goal.x,-(goal.z-ARM.shoulder.z))-Math.atan2(cargo.wrist.x,-(cargo.wrist.z-ARM.shoulder.z))),Math.cos(Math.atan2(goal.x,-(goal.z-ARM.shoulder.z))-Math.atan2(cargo.wrist.x,-(cargo.wrist.z-ARM.shoulder.z))));
  const radius=()=>Math.hypot(cargo.wrist.x,cargo.wrist.z-ARM.shoulder.z),targetRadius=Math.hypot(goal.x,goal.z-ARM.shoulder.z);
  const axis=(error,index)=>{for(let n=0;Math.abs(error())>.015&&n<1200;n++){const inputs=[0,0,0];inputs[index]=Math.max(-1,Math.min(1,error()*15));cargo.moveArm(1/60,...inputs);step(1);}assert.ok(Math.abs(error())<.02,'manual axis reaches target '+JSON.stringify({goal,actual:cargo.wrist,index}));};
  axis(()=>2.65-cargo.wrist.y,2);axis(()=>-angleError(),1);axis(()=>targetRadius-radius(),0);axis(()=>goal.y-cargo.wrist.y,2);
 };
 for(let index=0;index<3;index++){
  const load=cargo.packages[index];robot.position.set(load.position.x,0,load.position.z+3);robot.rotation.set(0,0,0);step(1);
  assert.equal(cargo.setManual(true),true);const chassis=robot.position.clone();step(20,true,1,1);assert.ok(chassis.distanceTo(robot.position)<1e-8,'arm mode locks the chassis');
  cargo.interact();assert.equal(cargo.busy,false,'grip only works at the actual load');
  steer({x:0,y:.36+ARM.gripOffset,z:-3});cargo.interact();cargo.interact();assert.equal(cargo.busy,true);assert.equal(load.parent,cargo.root,'manual grip attaches only after jaws close');
  const tipBefore=claw.position.clone();step(120,false);assert.equal(cargo.handLoaded,false);assert.ok(tipBefore.distanceTo(claw.position)<1e-8,'pause freezes grip');step(40);
  assert.equal(cargo.handLoaded,true);assert.equal(cargo.setManual(false),false,'cannot drive with a suspended load');
  cargo.interact();assert.equal(cargo.busy,false,'cannot release a load away from the platform/base');
  steer({x:0,y:1.31+ARM.gripOffset,z:1.85});cargo.interact();step(40);assert.equal(cargo.handLoaded,false);assert.equal(cargo.loaded,true);assert.ok(distance(load.position,{x:0,y:1.31,z:1.85})<1e-8);
  assert.equal(cargo.setManual(false),true);robot.position.set(0,0,2);step(1);assert.equal(cargo.setManual(true),true);
  cargo.interact();step(40);assert.equal(cargo.handLoaded,true,'grip can retrieve a secured platform load');
  const drop=[{x:2.2,y:.36+ARM.gripOffset,z:0},{x:-2.2,y:.36+ARM.gripOffset,z:0},{x:2.2,y:.36+ARM.gripOffset,z:1.1}][index];
  steer(drop);cargo.interact();step(20);assert.equal(cargo.delivered,index,'delivery waits for release');step(20);assert.equal(cargo.delivered,index+1);assert.equal(load.parent,cargo.root);assert.equal(load.userData.delivered,true);
  cargo.interact();step(40);assert.equal(cargo.delivered,index+1,'manual release cannot double-count');
 }
 assert.equal(cargo.finished,true);cargo.reset();assert.equal(cargo.manual,false);assert.equal(cargo.handLoaded,false);assert.equal(cargo.loaded,false);assert.equal(cargo.delivered,0);
 cargo.dispose();console.log('PASS: 1500 IK targets + singularities, constant link lengths, rotated collisions, blocked reach, automatic + manual three-load pick/place sequences, chassis interlock, frozen animation, no duplicate or premature delivery.');
}finally{rmSync(temp,{recursive:true,force:true});}
