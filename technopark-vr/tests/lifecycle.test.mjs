import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Group,Vector3,Quaternion,Euler} from 'three';

const output=await mkdtemp(join(tmpdir(),'vr-lifecycle-'));
try{
 await build({entryPoints:['src/xrComfort.ts','src/audio.ts'],outdir:output,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'}});
 const {alignStation,neutralGamepad,axisValue}=await import(pathToFileURL(join(output,'xrComfort.mjs')));
 for(const yaw of [-2.7,-.8,0,.9,2.9]){
  const rig=new Group(),position=new Vector3(1.4,1.62,-.7),orientation=new Quaternion().setFromEuler(new Euler(.24,yaw,0,'YXZ'));
  alignStation(rig,position,orientation,2.8,7);
  const eye=position.clone().applyMatrix4(rig.matrixWorld);
  assert.ok(eye.distanceTo(new Vector3(0,4.42,7))<1e-8,'recenter preserves tracked eye height and places the eye at the station');
  const gaze=new Vector3(0,0,-1).applyQuaternion(orientation).applyQuaternion(rig.quaternion);
  assert.ok(Math.abs(gaze.x)<1e-8&&gaze.z<0,'recenter faces the scene without changing head pitch');
 }
 assert.equal(axisValue(NaN),0);assert.equal(axisValue(.15),0);assert.ok(axisValue(.16)>0&&axisValue(.16)<.02);assert.equal(axisValue(-2),-1);
 assert.equal(neutralGamepad({axes:[0,0,0,0],buttons:[{pressed:true,value:1}]}),false);
 assert.equal(neutralGamepad({axes:[0,0,.9,0],buttons:[]}),false);
 assert.equal(neutralGamepad({axes:[0,0,0,0],buttons:[{pressed:false,value:0}]}),true);

 let contexts=0,tones=0,scheduled=0,noiseBuffers=0,noiseShots=0;
 const activation={isActive:false};Object.defineProperty(globalThis,'navigator',{value:{userActivation:activation},configurable:true});
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){scheduled++;}});
 globalThis.AudioContext=class{constructor(){contexts++;this.currentTime=0;this.state='running';this.destination={};}createGain(){return {gain:param(),connect(){},disconnect(){}};}createOscillator(){tones++;return {frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}createBuffer(channels,length){noiseBuffers++;return {getChannelData:()=>new Float32Array(length)};}createBufferSource(){noiseShots++;return {connect(){},disconnect(){},start(){}};}createBiquadFilter(){return {frequency:param(),connect(){},disconnect(){}};}get sampleRate(){return 44100;}async resume(){}async close(){this.state='closed';}};
 const {createAudio}=await import(pathToFileURL(join(output,'audio.mjs'))),audio=createAudio();
 audio.event('portal');audio.unlock();assert.equal(contexts,0,'automatic scene/deep-link events cannot create audio');
 activation.isActive=true;audio.unlock();assert.equal(contexts,1);activation.isActive=false;
 audio.event('shot');audio.event('shot');assert.equal(noiseBuffers,1,'shot noise is allocated once and reused');assert.equal(noiseShots,2);const before=tones;assert.ok(before>2);
 audio.pause(true);audio.event('hit');assert.equal(tones,before,'pause suppresses synthesized events');audio.pause(false);
 audio.motor(1);const automation=scheduled;for(let i=0;i<1000;i++)audio.motor(1);assert.equal(scheduled,automation,'steady motor input adds no audio scheduling per frame');
 audio.dispose();audio.event('win');activation.isActive=true;audio.unlock();assert.equal(contexts,1,'disposed audio cannot be recreated');
 console.log('PASS: tracked-pose recenter, smooth dead zone, held-trigger rearm, gesture-only audio, pause and bounded motor automation. No physical XR device.');
}finally{await rm(output,{recursive:true,force:true});}
