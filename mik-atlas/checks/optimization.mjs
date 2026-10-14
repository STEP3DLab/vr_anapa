// Run: node mik-atlas/checks/optimization.mjs (Node 22+; no npm dependencies).
// No browser, GPU render or hardware XR is exercised here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {buildWorld,EXHIBITS} from '../world.js';
import {loadSculpture} from '../sculpture.js';
import {consolidateArchitecture,freezeArchitecture,createExhibitPicker} from '../optimize.js';
import {renderPixelRatio} from '../render-budget.js';
const file=name=>new URL('../'+name,import.meta.url);
global.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const glb=fs.readFileSync(file('assets/lenin-bust.glb')),originalLoad=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=function(){return this.parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');};
const world=buildWorld();await loadSculpture(world);GLTFLoader.prototype.loadAsync=originalLoad;
for(const name of ['stone','dark','red'])world.materials[name].map=new THREE.Texture();
const stats=()=>{let meshes=0,triangles=0;world.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});return {meshes,triangles};};
const before=stats();consolidateArchitecture(world);const after=stats();assert.equal(after.triangles,before.triangles);assert(after.meshes<before.meshes);
freezeArchitecture(world);
for(const {group} of world.animated){assert(group.matrixAutoUpdate);const matrix=group.matrixWorld.clone();group.rotation.y+=.02;world.scene.updateMatrixWorld();assert(!group.matrixWorld.equals(matrix),'animated transform frozen');group.rotation.y-=.02;}
world.scene.updateMatrixWorld();
const picker=createExhibitPicker(world),ray=new THREE.Raycaster();
for(const [index,e] of EXHIBITS.entries()){
 const origin=new THREE.Vector3(e.view[0],1.65,e.view[2]),direction=new THREE.Vector3(...e.target).sub(origin).normalize();ray.set(origin,direction);assert.equal(picker.pick(ray)?.object.userData.exhibit,index);
}
for(const quality of ['smooth','detail'])for(const [w,h,dpr] of [[390,844,3],[1920,1080,2],[3840,2160,2],[5120,2880,3],[12000,800,2]]){
 const ratio=renderPixelRatio(w,h,dpr,quality);assert(Number.isFinite(ratio)&&ratio>0);assert(w*h*ratio**2<=(quality==='detail'?2400000:1000000)+1);assert(Math.max(w,h)*ratio<=4096+1);
}
const measure=(fn,n)=>{fn();const samples=[];for(let j=0;j<5;j++){const t=performance.now();for(let i=0;i<n;i++)fn();samples.push((performance.now()-t)/n);}return samples.sort((a,b)=>a-b)[2];};
ray.set(new THREE.Vector3(0,3.4,-3.6),new THREE.Vector3(0,0,-1));
const meshPickMs=measure(()=>ray.intersectObjects(world.interactive,true),120),proxyPickMs=measure(()=>picker.pick(ray),120),matrixUpdateMs=measure(()=>world.scene.updateMatrixWorld(),1000);
picker.dispose();
// Lazy-import control: one pending load, last requested action, cancellation and retry UI.
const boot=fs.readFileSync(file('boot.js'),'utf8').replace(/^import .*;\n/gm,'').replace("import('./app.js?v=7.0')",'load()');
function bootEnv(){
 const elements=Object.fromEntries(['engine-loading','engine-title','engine-retry','engine-cancel','credits-dialog','open-credits','close-credits'].map(id=>[id,{hidden:true,showModal(){this.open=true;},close(){this.open=false;}}]));let handler,resolve,reject,loads=0,reloads=0;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const context={window:{},localGameStorage:()=>null,readPlayer:()=>({}),renderSavedGame:()=>{},document:{getElementById:id=>elements[id],addEventListener:(name,fn)=>handler=fn},load:()=>{loads++;return pending;},console:{error(){}},location:{reload(){reloads++;}}};vm.runInNewContext(boot,context);
 const button=()=>({hasAttribute:()=>true,clicks:0,isConnected:true,closest:()=>null,click(){this.clicks++;},focus(){this.focused=true;}});
 const click=b=>handler({target:{closest:()=>b},preventDefault(){},stopImmediatePropagation(){}});
 return {elements,button,click,resolve,reject,get loads(){return loads;},get reloads(){return reloads;}};
}
const settle=()=>new Promise(r=>setImmediate(r));
const about=bootEnv();about.elements['open-credits'].onclick();assert(about.elements['credits-dialog'].open);assert.equal(about.loads,0);about.elements['close-credits'].onclick();assert(!about.elements['credits-dialog'].open);
const b=bootEnv(),first=b.button(),last=b.button();assert.equal(b.loads,0);b.click(first);b.click(last);assert.equal(b.loads,1);b.resolve();await settle();assert.equal(first.clicks,0);assert.equal(last.clicks,1);assert(b.elements['engine-loading'].hidden);
const c=bootEnv(),cancelled=c.button();c.click(cancelled);c.elements['engine-cancel'].onclick();c.resolve();await settle();assert.equal(cancelled.clicks,0);assert(cancelled.focused);
const d=bootEnv();d.click(d.button());d.reject(Error('network'));await settle();assert(!d.elements['engine-retry'].hidden);d.elements['engine-retry'].onclick();assert.equal(d.reloads,1);
console.log(JSON.stringify({status:'pass',before,after,meshPickMs,proxyPickMs,matrixUpdateMs,scope:'CPU microbenchmark; basic hall and actual GLB; texture flags, no GPU/DOM/browser/WebXR'},null,2));
