// Run: node mik-atlas/checks/experience.mjs (Node 22+).
// Simulated DOM/renderer/XR with real Three.js geometry; not browser or headset QA.
import fs from 'node:fs';import {createRequire} from 'node:module';
const file=name=>new URL('../'+name,import.meta.url);
let nativeCanvas;
if(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES){try{nativeCanvas=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/')('@napi-rs/canvas');}catch{}}
if(nativeCanvas){nativeCanvas.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');}
const createCanvas=(w,h)=>nativeCanvas?nativeCanvas.createCanvas(w,h):{getContext:()=>new Proxy({measureText:text=>({width:text.length*16}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{}})};
import vm from 'node:vm';import assert from 'node:assert/strict';
import * as RealThree from '../vendor/three.module.min.js';
import {buildWorld,EXHIBITS,isWalkable} from '../world.js';
import {consolidateArchitecture,freezeArchitecture,createExhibitPicker} from '../optimize.js';
import {CinematicRenderer} from '../cinematic.js';
import {COLLECTION,PAVILION,galleryStep} from '../gallery.js';
import {collectionBounds} from '../framing.js';
import {GalleryAtmosphere} from '../gallery-atmosphere.js';
import {VRGuide} from '../vr-guide.js';
import {AdaptiveQuality,QUALITY_PROFILES,readQuality,writeQuality} from '../adaptive-quality.js';
import {renderPixelRatio} from '../render-budget.js';
import {loadSculpture as loadScan} from '../sculpture.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
const glb=fs.readFileSync(file('assets/lenin-bust.glb'));GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');};
class Element{
 constructor(tag,attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.style={};this.dataset={};this.listeners={};this.hidden='hidden'in attrs;this.open=false;this.clientWidth=390;this.clientHeight=800;this.classes=new Set((attrs.class||'').split(' ').filter(Boolean));for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,on)=>{if(on===undefined)on=!this.classes.has(v);on?this.classes.add(v):this.classes.delete(v);return on;}};}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}appendChild(n){this.append(n);return n;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}dispatch(name,event={}){for(const fn of this.listeners[name]||[])fn({target:this,preventDefault(){},...event});}
 focus(){document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;}setPointerCapture(){}matches(selector){return selector.split(',').some(x=>x.toUpperCase()===this.tagName);}
 getContext(){this.backing??=createCanvas(this.width||1024,this.height||768);return this.backing.getContext('2d');}getBoundingClientRect(){return {left:0,top:0,width:390,height:800,right:390,bottom:800};}
}
function makeDocument(){const unpack=data=>{const el=new Element(data.tag,data.attrs);el.append(...data.children.map(unpack));return el;};const root=new Element('html');for(const tag of fs.readFileSync(file('index.html'),'utf8').matchAll(/<([a-z][a-z0-9-]*)\b([^>]*?)>/g)){const attrs={};for(const a of tag[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';root.append(new Element(tag[1],attrs));}const all=()=>{const list=[];const walk=n=>{list.push(n);n.children.forEach(walk);};walk(root);return list;};const query=q=>all().filter(e=>{if(q==='dialog[open]')return e.tagName==='DIALOG'&&e.open;const m=q.match(/^\[([\w-]+)\]$/);return m?(m[1].startsWith('data-')?m[1].slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())in e.dataset:m[1]in e.attrs):false;});return {documentElement:root,fullscreenElement:null,fullscreenEnabled:false,body:all().find(e=>e.tagName==='BODY'),activeElement:root,hidden:false,getElementById:id=>all().find(e=>e.attrs.id===id),createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text}),querySelectorAll:query,querySelector:q=>query(q)[0]||null,listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},dispatch(name){for(const fn of this.listeners[name]||[])fn();}};}
function createEnvironment(failFirst=false,gate=null,xrOptions={}){
 const document=makeDocument();global.document=document;let count=0;const timers=new Map();let seq=0;
 class Renderer{
  constructor(){
   this.domElement=new Element('canvas');this.shadowMap={};this.renderCount=0;this.xrCamera=new RealThree.PerspectiveCamera(65,1,.08,70);this.xrCamera.matrixAutoUpdate=true;
   this.pose=new RealThree.Matrix4().makeTranslation(.32,1.62,-.18);this.setSessions=[];
   this.xr={setReferenceSpaceType(){},setFramebufferScaleFactor(){},getController(){return new RealThree.Group();},getCamera:()=>this.xrCamera,getReferenceSpace:()=>({}),
    setSession:async session=>{this.setSessions.push(session);if(xrOptions.setSession)await xrOptions.setSession(session);},
    updateCamera:camera=>{
     camera.parent.updateMatrixWorld(true);const combined=new RealThree.Matrix4().multiplyMatrices(camera.parent.matrixWorld,this.pose);
     this.xrCamera.matrix.copy(this.pose);this.xrCamera.matrixWorld.copy(combined);combined.decompose(this.xrCamera.position,this.xrCamera.quaternion,this.xrCamera.scale);
     this.pose.decompose(camera.position,camera.quaternion,camera.scale);camera.updateMatrixWorld(true);
    }};
  }
  setPixelRatio(v){this.pixelRatio=v;}setSize(){}setAnimationLoop(fn){this.loop=fn;}dispose(){this.disposed=true;}render(scene,camera){this.renderCount++;this.lastScene=scene;this.lastCamera=camera;}
 }
 const memory=new Map();const defaultStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const context=vm.createContext({collectionBounds,COLLECTION,PAVILION,galleryStep,GalleryAtmosphere,THREE:{...RealThree,WebGLRenderer:Renderer},buildWorld,EXHIBITS,isWalkable,consolidateArchitecture,freezeArchitecture,createExhibitPicker,renderPixelRatio,AdaptiveQuality,QUALITY_PROFILES,readQuality,writeQuality,VRGuide,CinematicRenderer,installMuseumGraphics:async()=>{},document,window:Object.assign(new Element('window'),{localStorage:xrOptions.storage===undefined?defaultStorage:xrOptions.storage}),navigator:xrOptions.enabled?{xr:{isSessionSupported:async()=>true,requestSession:xrOptions.requestSession||(()=>Promise.resolve(new FakeSession()))}}:{},queueMicrotask,console:{error(){}},matchMedia:q=>({matches:q.includes('coarse')?(xrOptions.coarse??true):q.includes('max-width')||(q.includes('reduced-motion')&&(xrOptions.reduced??true))}),devicePixelRatio:2,requestAnimationFrame:fn=>queueMicrotask(()=>fn(0)),setTimeout:fn=>{const id=++seq;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),installAtmosphere:(r,w)=>{w.dayMode=true;w.setLighting=d=>{w.dayMode=d;};r.shadowMap.enabled=true;},loadSculpture:async(world)=>{count++;if(gate)await gate;if(failFirst&&count===1)throw Error('Simulated network failure');return loadScan(world);},installCollegeMark:async()=>{}});
 let code=fs.readFileSync(file('app.js'),'utf8').replace(/^import .*;\n/gm,'');code+='\nglobalThis.test={enter,exit,frame,visit,teleport,rebuildGraphics,toggleFullscreen,runVRAction,xrHead,castXRPointer,get state(){return {initialized,active,selected,renderer,world,keys,rig,session,sessionStarting,xrReady,vrGuide,camera,controllers,teleportHits,effects,cinematic,contextLost,exhibitPicker,quality,adaptive,exhibitBounds};}};';vm.runInContext(code,context);
 return {doc:document,win:context.window,api:context.test,get loads(){return count;},flushTimers(){const current=[...timers.values()];timers.clear();for(const fn of current)fn();}};
}

class FakeSession extends RealThree.EventDispatcher{
 constructor(){super();this.visibilityState='visible';this.inputSources=[{handedness:'right',gamepad:{axes:[0,0,0,0]}}];this.ends=0;}
 async end(){this.ends++;this.dispatchEvent({type:'end'});}
 setVisibility(value){this.visibilityState=value;this.dispatchEvent({type:'visibilitychange'});}
}
const settle=()=>new Promise(r=>setImmediate(r));
const poseFrame={getViewerPose:()=>({views:[{}]})};
const e=createEnvironment(true),id=n=>e.doc.getElementById(n);
assert.equal(e.doc.querySelectorAll('[data-enter]').length,1);assert(!e.api.state.initialized);await e.doc.querySelectorAll('[data-enter]')[0].onclick();assert(!e.api.state.initialized);assert(!id('loading-actions').hidden);assert.equal(id('viewport').children.length,0);
await id('retry-loading').onclick();assert(e.api.state.initialized);assert.equal(e.api.state.selected,0);assert.equal(id('object-title').textContent,'Ленин');assert(!e.api.state.world.dayMode);assert(!id('object-source').hidden);assert(!id('object-dialog').open);
for(const index of [1,2,3,-1,0]){id('next-object').onclick();assert.equal(e.api.state.selected,index);}id('previous-object').onclick();assert.equal(e.api.state.selected,-1);assert.equal(id('object-title').textContent,'Павильон');
id('open-object').onclick();assert(id('object-dialog').open);assert(!id('settings-dialog').open);id('object-dialog').close();
id('open-settings').onclick();assert(id('settings-dialog').open);id('lighting').onclick();assert(e.api.state.world.dayMode);id('quality').value='detail';id('quality').onchange();assert.equal(e.api.state.effects.dust.geometry.drawRange.count,480);id('quality').value='smooth';id('quality').onchange();assert.equal(e.api.state.effects.dust.geometry.drawRange.count,160);id('settings-dialog').close();
const target=new Element('div');e.win.dispatch('keydown',{code:'ArrowRight',target,repeat:false});assert.equal(e.api.state.selected,0);e.win.dispatch('keydown',{code:'ArrowRight',target,repeat:true});assert.equal(e.api.state.selected,0);
const canvas=e.api.state.renderer.domElement;canvas.dispatch('pointerdown',{pointerId:1,clientX:100,clientY:100});assert(id('hint').classList.contains('dismissed'));const angle=e.api.state.camera.rotation.y;canvas.dispatch('pointermove',{pointerId:1,clientX:180,clientY:125});assert.notEqual(e.api.state.camera.rotation.y,angle);canvas.dispatch('pointercancel');
e.doc.hidden=true;e.doc.dispatch('visibilitychange');assert.equal(e.api.state.renderer.loop,null);e.doc.hidden=false;e.doc.dispatch('visibilitychange');assert(e.api.state.renderer.loop);
await e.api.visit(2,true);canvas.dispatch('webglcontextlost');assert(e.api.state.contextLost);await e.api.rebuildGraphics();assert(e.api.state.initialized);assert.equal(e.api.state.selected,2);assert.equal(id('viewport').children.length,1);assert(e.api.state.world.dayMode);
await e.api.exit();assert(id('experience').hidden);assert(!id('landing').inert);await e.api.enter();assert.equal(id('viewport').children.length,1);assert.equal(e.api.state.selected,0);await e.api.exit();
const transition=createEnvironment(false,null,{reduced:false});await transition.api.enter(0);transition.doc.getElementById('next-object').onclick();assert.equal(transition.api.state.selected,0);assert(transition.doc.getElementById('fade').classList.contains('visible'));transition.flushTimers();assert.equal(transition.api.state.selected,1);assert(!transition.doc.getElementById('fade').classList.contains('visible'));transition.api.frame(100);transition.api.frame(140);assert(transition.api.state.effects.time>0);await transition.api.exit();
// Audit regressions: preserve rapid input, cancellation, late audio and failed XR exit.
const rapid=createEnvironment(false,null,{reduced:false});await rapid.api.enter(0);rapid.doc.getElementById('next-object').onclick();rapid.doc.getElementById('next-object').onclick();rapid.flushTimers();assert.equal(rapid.api.state.selected,2);assert.equal(rapid.doc.getElementById('collection-status').textContent,'Атом, 3 из 4');rapid.doc.getElementById('next-object').onclick();await rapid.api.exit();rapid.flushTimers();await rapid.api.enter(0);assert.equal(rapid.api.state.selected,0);assert(!rapid.doc.getElementById('fade').classList.contains('visible'));await rapid.api.exit();
let releaseLoad;const loadGate=new Promise(r=>releaseLoad=r),cancelLoad=createEnvironment(false,loadGate);const opening=cancelLoad.api.enter(0);await settle();assert(cancelLoad.doc.getElementById('loading').open);assert.equal(cancelLoad.doc.activeElement,cancelLoad.doc.getElementById('cancel-loading'));assert(!cancelLoad.doc.getElementById('loading-actions').hidden);cancelLoad.doc.getElementById('loading').dispatch('cancel');await settle();assert(!cancelLoad.api.state.active);assert(!cancelLoad.doc.getElementById('loading').open);releaseLoad();await opening;assert(cancelLoad.doc.getElementById('experience').hidden);assert.equal(cancelLoad.api.state.renderer.loop,null);
const audio=createEnvironment();await audio.api.enter(0);let releaseAudio,master;audio.win.AudioContext=class{constructor(){this.currentTime=0;this.destination={};}createGain(){const g={gain:{value:0,setTargetAtTime(v){this.value=v;}},connect(){}};master??=g;return g;}createOscillator(){return {frequency:{},connect(){},start(){}};}resume(){return new Promise(r=>releaseAudio=r);}};const audioOperation=audio.doc.getElementById('sound').onclick();await audio.api.exit();releaseAudio();await audioOperation;assert.equal(master.gain.value,0);assert.equal(audio.doc.getElementById('sound').textContent,'Выключен');
const refused=createEnvironment(false,null,{enabled:true});await refused.api.enter(0);refused.doc.getElementById('enter-vr').onclick();await settle();refused.api.frame(100,poseFrame);const refusedSession=refused.api.state.session,originalEnd=refusedSession.end.bind(refusedSession);refusedSession.end=async()=>{throw Error('runtime refused');};await refused.api.exit();assert(refused.api.state.active);assert(refused.api.state.renderer.loop);assert(!refused.doc.getElementById('experience').hidden);refusedSession.end=originalEnd;await refused.api.exit();assert.equal(refused.api.state.session,null);
console.log('PASS: cancelled modal loads, rapid arrows, polite collection status, late audio guard and refused XR exit.');
console.log('PASS: one-button entry, retry, five-view navigation, keyboard, optional descriptions/settings, light and quality, drag, hint dismissal, hidden-page suspension, context restore, reentry and fade. DOM/layout/WebGL are simulated.');

const xr=createEnvironment(false,null,{enabled:true}),xid=n=>xr.doc.getElementById(n);await xr.api.enter(0);xid('enter-vr').onclick();await settle();let state=xr.api.state;assert(state.session);assert(!state.vrGuide.enabled);xr.api.frame(100,poseFrame);state=xr.api.state;assert(state.xrReady);assert(state.vrGuide.group.visible);assert.equal(state.effects.dust.geometry.drawRange.count,160);
const guide=state.vrGuide,controller=state.controllers[0],session=state.session;controller.dispatchEvent({type:'connected'});
function aimAt(target){const head=xr.api.xrHead(),position=head.clone().add(new RealThree.Vector3(.13,-.23,-.08));state.rig.updateMatrixWorld(true);controller.position.copy(state.rig.worldToLocal(position.clone()));const local=state.rig.worldToLocal(target.clone());controller.quaternion.setFromUnitVectors(new RealThree.Vector3(0,0,-1),local.sub(controller.position).normalize());controller.updateMatrixWorld(true);}
function press(action){const b=guide.buttons.find(b=>b.action===action);assert(b,action);const p=new RealThree.Vector3(((b.x+b.w/2)/1024-.5)*1.12,(.5-(b.y+b.h/2)/448)*(1.12*448/1024),.001);guide.group.updateMatrixWorld(true);aimAt(guide.panel.localToWorld(p));controller.dispatchEvent({type:'select'});}
const matrix=state.renderer.xrCamera.matrix.clone(),head=xr.api.xrHead();assert(matrix.equals(state.renderer.xrCamera.matrix));assert(Math.abs(head.z-EXHIBITS[0].view[2])<1e-6);assert(guide.group.position.y<head.y-.4);
press('info');assert(guide.info);
press('next');assert.equal(xr.api.state.selected,1);assert(!guide.info);press('previous');assert.equal(xr.api.state.selected,0);press('hide');assert(!guide.open);assert(guide.chip.visible);
state.camera.updateWorldMatrix(true,true);aimAt(guide.chip.getWorldPosition(new RealThree.Vector3()));controller.dispatchEvent({type:'select'});assert(guide.open);press('next');assert.equal(xr.api.state.selected,1);
const anchored=guide.group.position.clone();state.renderer.pose.makeTranslation(.6,1.62,-.1);xr.api.frame(150,poseFrame);assert(guide.group.position.distanceTo(anchored)<1e-6);
session.setVisibility('visible-blurred');xr.api.runVRAction('next');assert.equal(xr.api.state.selected,1);session.setVisibility('visible');xr.api.frame(200,poseFrame);
const before=xr.api.xrHead();session.inputSources[0].gamepad.axes[2]=1;xr.api.frame(240,poseFrame);assert(before.distanceTo(xr.api.xrHead())<1e-6);const yaw=state.rig.rotation.y;xr.api.frame(280,poseFrame);assert.equal(state.rig.rotation.y,yaw);
const pivot=xr.api.xrHead();xr.api.runVRAction('next');state=xr.api.state;const facing=new RealThree.Vector3(0,0,-1).transformDirection(state.renderer.xrCamera.matrixWorld);facing.y=0;const toward=new RealThree.Vector3(...EXHIBITS[2].target).sub(xr.api.xrHead());toward.y=0;assert(facing.normalize().dot(toward.normalize())>.999);assert(Math.abs(xr.api.xrHead().x-EXHIBITS[2].view[0])<1e-6);xr.api.runVRAction('previous');
controller.dispatchEvent({type:'disconnected'});assert.equal(xr.api.castXRPointer(controller),null);controller.dispatchEvent({type:'connected'});press('exit');await settle();assert.equal(xr.api.state.session,null);assert(!guide.enabled);assert.equal(xr.api.state.selected,1);await xr.api.exit();
let grant;const consent=new Promise(r=>grant=r),late=createEnvironment(false,null,{enabled:true,requestSession:()=>consent});await late.api.enter(0);late.doc.getElementById('enter-vr').onclick();await late.api.exit();const lateSession=new FakeSession();grant(lateSession);await settle();assert(lateSession.ends>0);assert.equal(late.api.state.session,null);
console.log('PASS: compact VR panel real geometry/controller rays, source caption, previous/next, hide/reopen, anchored panel, pose matrix preservation, focus guard, head-pivot snap, disconnect, exit and late consent. headset/renderer simulated.');

const framing=createEnvironment();await framing.api.enter(0);const fsState=framing.api.state;
const bounds=[];for(const [width,height] of [[390,800],[320,844],[1920,1080]]){framing.doc.getElementById('viewport').clientWidth=width;framing.doc.getElementById('viewport').clientHeight=height;framing.win.dispatch('resize');for(let i=0;i<4;i++){framing.api.visit(i,true);fsState.world.scene.updateMatrixWorld(true);fsState.camera.updateMatrixWorld(true);const box=new RealThree.Box3().setFromObject(fsState.world.models[i],true);const points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new RealThree.Vector3(x,y,z).project(fsState.camera));for(const p of points){assert(Math.abs(p.x)<=.821,`framing x ${i}: ${p.x}`);assert(Math.abs(p.y)<=.651,`framing y ${i}: ${p.y}`);}bounds.push({width,height,i,fov:fsState.camera.fov,x:[Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x))],y:[Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.y))]});}
}
let phaseChecks=0;
for(const [width,height] of [[320,844],[390,800],[1920,1080],[844,390]]){
 framing.doc.getElementById('viewport').clientWidth=width;framing.doc.getElementById('viewport').clientHeight=height;framing.win.dispatch('resize');
 for(let id=0;id<4;id++){
  framing.api.visit(id,true);const originalFov=fsState.camera.fov;
  for(let phase=0;phase<73;phase++){
   const angle=phase/72*Math.PI*2;
   fsState.world.animated.forEach(a=>{if(a.kind==='orbit')a.group.rotation.z=angle;else a.group.rotation.y=Math.sin(angle)*(a.kind==='sputnik'?.18:.12);});
   fsState.world.scene.updateMatrixWorld(true);fsState.camera.updateMatrixWorld(true);
   const actual=new RealThree.Box3().setFromObject(fsState.world.models[id],true);assert(fsState.exhibitBounds[id].containsBox(actual),`envelope ${id}/${phase}`);
   for(const x of [actual.min.x,actual.max.x])for(const y of [actual.min.y,actual.max.y])for(const z of [actual.min.z,actual.max.z]){const p=new RealThree.Vector3(x,y,z).project(fsState.camera);assert(Math.abs(p.x)<=.821,`animated x ${width}/${id}/${phase}: ${p.x}`);assert(Math.abs(p.y)<=.651,`animated y ${width}/${id}/${phase}: ${p.y}`);}
   framing.win.dispatch('resize');assert.equal(fsState.camera.fov,originalFov);phaseChecks++;
  }
 }
}
console.log('PASS: stable complete-cycle framing, '+phaseChecks+' model/phase/viewport combinations.');
console.log(JSON.stringify({modelFraming:'pass',viewports:3,models:4,maxFov:Math.max(...bounds.map(b=>b.fov))}));await framing.api.exit();

