import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import * as T from '../engine/three.module.min.js';
import {machines, demonstrations} from '../catalog.js';
import {inspections} from '../inspection.js';
import {registrations,landmarkDifferences} from '../registrations.js';
import {evidence} from '../evidence.js';
import {readScene, sceneURL, photoKey} from '../scene-link.js';
import {createXR} from '../xr.js';
import {inspectSurfaces} from '../../research/mobot/1987/night-20261118/contact.js';

const ctx={fillRect(){}, fillText(){}, clearRect(){}};
globalThis.document={createElement:()=>({getContext:()=>null})};
const models=Object.fromEntries(Object.entries(machines).map(([year,def])=>[year,def.create(T)]));

test('Every registered photograph restores the intended tool, joints and landmarks',()=>{
  let matched=0;
  for(const [id,doc] of Object.entries(evidence)) {
    const year=+id, def=machines[year], model=models[year];
    for(const [index,photo] of doc.photos.entries()) {
      assert(existsSync(new URL('../'+photo.file,import.meta.url)));
      const shot=registrations[photoKey(photo)];
      if(!shot)continue;
      matched++;
      const url=sceneURL('https://example.org/project/',{year,def,mode:'photo',photo,pose:shot.pose,tool:shot.tool,marks:true});
      const restored=readScene(new URL(url).searchParams,def,doc.photos,inspections[year]);
      assert.deepEqual(restored.pose,shot.pose);assert.equal(restored.photo,index);
      assert.equal(restored.tool,shot.tool);assert.equal(restored.marks,true);
      if(year===1987)model.mechanisms.setWorkTool(shot.tool);
      def.pose(model,shot.pose);
      for(const part of inspections[year]) {
        const node=part.anchor(model);
        for(let p=node;p;p=p.parent)assert.equal(p.visible,true);
        assert(node.isObject3D && !new T.Box3().setFromObject(node).isEmpty());
      }
      const {width,height,points,lines}=shot.overlay;
      for(const [x,y] of [...points.map(p=>[p.x,p.y]),...lines.flatMap(l=>l.points)]){
        assert(x>=0&&x<=width&&y>=0&&y<=height);
      }
    }
  }
  assert.equal(matched,6);
});
test('Scene links clamp out-of-range angles and reject malformed cameras',()=>{
  const state=readScene(new URLSearchParams('mode=unknown&pose=999,999,999,999,999,999&view=no&dir=1,1,1&z=9000'),machines[1986],evidence[1986].photos,inspections[1986]);
  assert.equal(state.mode,'drive');assert.equal(state.camera,null);
  assert.equal(state.pose.yaw,180);assert.equal(state.pose.boom,32);
});
test('Eighty-one samples along each demonstration path keep the active work tools above the datum',()=>{
  const model=models[1987],m=model.mechanisms,hood=model.meshes.find(o=>o.name.startsWith('Кожух с плоской'));
  for(const [tool,path] of Object.entries(demonstrations)){
    m.setWorkTool(tool);
    for(let i=0;i<=80;i++){
      const pose=Object.fromEntries(Object.keys(path.start).map(k=>[k,path.start[k]+(path.end[k]-path.start[k])*i/80]));
      m.setPose(pose);
      const {ground,envelopes}=inspectSurfaces(m,hood,tool,m.inspectPose());
      assert.equal(ground,null,tool+' sample '+i);
      assert(envelopes.every(e=>!e.hits.length&&!e.unresolved.length),tool+' sample '+i);
    }
  }
  for(let i=0;i<=80;i++){
    const model=models[1986],def=machines[1986];
    def.pose(model,Object.fromEntries(Object.entries(def.demo).map(([k,v])=>[k,v*i/80])));
    const r=model.auditPose();assert(r.grappleClearance>=-.001&&r.bucketClearance>=-.001);
  }
});
test('The XR exhibit handles controller input, model replacement, local space fallback and session end',async()=>{
  const oldDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  try{
    let year=1986,loop,shown,ended=0,space,jointChanges=0;
    const controllers=[new T.Group(),new T.Group()];
    const renderer={xr:{getController:i=>controllers[i],setReferenceSpaceType:s=>{space=s},async setSession(){},getReferenceSpace:()=>({})},
      setAnimationLoop:cb=>{loop=cb},render:scene=>{shown=scene;scene.updateMatrixWorld(true)}};
    const session=new EventTarget();
    session.requestReferenceSpace=async()=>{throw Error('no floor')};
    session.end=async()=>session.dispatchEvent(new Event('end'));
    const xr=createXR(renderer,{
      get:()=>({year,name:machines[year].title,root:models[year].root,ground:machines[year].ground,jointName:'Стрела',value:'0°',toolName:'Схват'}),
      switchModel(){year=1987;xr.modelChanged()},nextJoint(){jointChanges++},change(){},reset(){},nextTool(){},ended(){ended++}
    });
    await xr.start(session);
    assert.equal(space,'local');assert(xr.active);
    loop(0,{getViewerPose:()=>({transform:{position:{x:1,y:.08,z:2},orientation:{x:0,y:0,z:0,w:1}}})});
    const board=shown.children[0].children.find(o=>o.geometry?.type==='PlaneGeometry');
    const holder=shown.children[0].children.find(o=>o.isGroup);
    assert(holder.children[0].children.some(o=>o.isBatchedMesh));
    const aim=(row)=>{
      const localY=(.5-(170+row*82+30)/1030)*.742;
      const point=board.localToWorld(new T.Vector3(0,localY,0));
      controllers[0].position.copy(point).add(new T.Vector3(0,0,.6));
      controllers[0].lookAt(controllers[0].position.clone().multiplyScalar(2).sub(point));
      controllers[0].updateMatrixWorld(true);controllers[0].dispatchEvent({type:'select'});
    };
    aim(0);assert.equal(year,1987);aim(1);assert.equal(jointChanges,1);
    const startScale=holder.scale.x;aim(5);assert.notEqual(holder.scale.x,startScale);
    const startRotation=holder.rotation.y;
    controllers[0].dispatchEvent({type:'squeezestart'});controllers[0].position.x+=.2;
    loop(16);controllers[0].dispatchEvent({type:'squeezeend'});assert.notEqual(holder.rotation.y,startRotation);
    xr.poseChanged();await session.end();assert.equal(ended,1);assert.equal(loop,null);assert.equal(xr.active,false);
  } finally {globalThis.document=oldDocument}
});

test('The photo report measures only paired points in the displayed image coordinates',()=>{
  const first=registrations['1986-fig6'].overlay;
  const hanger=landmarkDifferences(first).find(p=>p.label==='Траверса грейфера');
  assert(hanger.pixels>60 && hanger.pixels<75);
  assert(Math.abs(hanger.percentWidth-hanger.pixels*100/first.width)<1e-9);
  assert.deepEqual(landmarkDifferences(registrations['1987-breaker'].overlay),[]);
});
