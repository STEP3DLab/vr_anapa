import * as THREE from './vendor/three.module.min.js';
import {buildWorld,EXHIBITS,isWalkable} from './world.js?v=7.1';
import {installAtmosphere} from './atmosphere.js?v=7.1';
import {loadSculpture,installCollegeMark} from './sculpture.js?v=7.1';
import {consolidateArchitecture,freezeArchitecture,createExhibitPicker} from './optimize.js?v=7.1';
import {installMuseumGraphics} from './museum.js?v=7.1';
import {VRGuide} from './vr-guide.js?v=7.1';
import {CinematicRenderer} from './cinematic.js?v=7.1';
import {AdaptiveQuality,QUALITY_PROFILES,readQuality,writeQuality} from './adaptive-quality.js?v=7.1';
import {renderPixelRatio} from './render-budget.js?v=7.1';


import {COLLECTION,PAVILION,galleryStep} from './gallery.js?v=7.1';
import {collectionBounds} from './framing.js?v=7.1';
import {GalleryAtmosphere} from './gallery-atmosphere.js?v=7.1';

const $=id=>document.getElementById(id);
const experience=$('experience'),landing=$('landing'),viewport=$('viewport'),dialog=$('help-dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let world,renderer,camera,rig,active=false,selected=-1,yaw=0,pitch=0,initialized=false,xrSupported=false,session=null,sessionStarting=false;
let vrGuide=null,xrRequestToken=0,xrReady=false,pendingSpawn=null;
let effects=null,cinematic=null,hintTimer,requestedView=null;
let exhibitBounds=[],exhibitPicker=null,contextLost=false,rebuildPromise=null,lastShadow=-Infinity;
let initPromise=null,openToken=0,pendingEntry={id:0};
const adaptive=new AdaptiveQuality({coarse:matchMedia('(pointer: coarse)').matches});
let quality='auto';try{quality=readQuality(window.localStorage);}catch{}
let ownsFullscreen=false,fullscreenBusy=false,windowFocused=document.hasFocus?.()??true;
let keys=new Set(),drag=null,lastTime=0,toastTimer,moveTimer,returnFocus=null,audioContext,audioGain,soundOn=false,snapReady=true,soundRequest=0,soundBusy=false;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),direction=new THREE.Vector3(),matrix=new THREE.Matrix4();
const controllers=[],teleportHits=new Map();

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function checkXR(){
  try{xrSupported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch{xrSupported=false;}
  $('xr-status').textContent=xrSupported?'VR доступен. Нажмите «VR» в павильоне.':'Для VR откройте эту страницу в браузере совместимого шлема. Здесь доступен 3D-просмотр.';
  $('enter-vr').title=xrSupported?'Начать погружение':'Информация о входе в VR';
}
checkXR();
function openDialog(element){adaptive.reset();keys.clear();drag=null;if(!element.open)element.showModal();}
function showHelp(){$('settings-dialog').close();openDialog(dialog);}
$('help').onclick=showHelp;
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('[data-enter]').forEach(b=>b.onclick=()=>enter(0));
$('previous-object').onclick=()=>visit(galleryStep(requestedView??selected,-1));
$('next-object').onclick=()=>visit(galleryStep(requestedView??selected,1));
$('open-object').onclick=()=>openDialog($('object-dialog'));
function showLoading(retry=false){
  const panel=$('loading');$('retry-loading').hidden=!retry;$('loading-actions').hidden=false;
  document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==panel)d.close();});
  panel.hidden=false;if(!panel.open)panel.showModal();$(retry?'retry-loading':'cancel-loading').focus();
}
function hideLoading(){$('loading').close();$('loading').hidden=true;}
function cancelVisit(){clearTimeout(moveTimer);requestedView=null;$('fade').classList.remove('visible');}
function dismissHint(){$('hint').classList.add('dismissed');clearTimeout(hintTimer);}

function graphicsProfile(){return quality==='auto'?adaptive.profile:QUALITY_PROFILES[quality==='detail'?0:2];}
function resize(){
  if(!renderer||!active||session)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);
  const ratio=renderPixelRatio(w,h,devicePixelRatio,graphicsProfile(),Math.min(4096,renderer.capabilities?.maxTextureSize||4096));
  renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;frameExhibit();
}
function frameExhibit(){
  if(!camera||session)return;
  camera.fov=65;camera.updateProjectionMatrix();
  const model=world?.models[selected];if(!model||!exhibitBounds[selected])return;
  // Frame the fixed viewing position, so a quality/size change never zooms in
  // response to the visitor looking away from the sculpture.
  const view=EXHIBITS[selected].view,fit=new THREE.PerspectiveCamera(65,camera.aspect,.08,70);
  fit.position.set(view[0],1.65,view[2]);fit.lookAt(...galleryTarget(selected));fit.updateMatrixWorld(true);
  const bounds=exhibitBounds[selected],point=new THREE.Vector3();let scale=1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    point.set(x,y,z).project(fit);scale=Math.max(scale,Math.abs(point.x)/.82,Math.abs(point.y)/.65);
  }
  camera.fov=Math.min(100,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(65)/2)*scale)));camera.updateProjectionMatrix();
}
function galleryTarget(id){
  const target=[...(EXHIBITS[id]?.target||[0,2.1,-7])];
  if(id===1&&world?.models[id])target[0]=exhibitBounds[id].getCenter(new THREE.Vector3()).x;
  return target;
}
function syncAnimationLoop(){adaptive.reset();if(!renderer)return;lastTime=0;renderer.setAnimationLoop(active&&initialized&&!contextLost&&(!document.hidden||session)?frame:null);}
window.addEventListener('resize',()=>{adaptive.reset();resize();});
async function init(){
  world=buildWorld();
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.xr.enabled=true;renderer.xr.cameraAutoUpdate=false;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(1);
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D-коллекция. Стрелки влево и вправо — экспонаты; потяните для обзора.');viewport.appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(65,1,.08,70);camera.position.set(0,1.65,0);camera.rotation.order='YXZ';rig=new THREE.Group();rig.add(camera);world.scene.add(rig);
  const marker=new THREE.Mesh(new THREE.RingGeometry(.22,.28,36),new THREE.MeshBasicMaterial({color:'#ffce80',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;world.scene.add(marker);world.marker=marker;
  for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);rig.add(controller);
    const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:'#ffe6b7',transparent:true,opacity:.75}));ray.scale.z=10;controller.add(ray);controller.userData.line=ray;
    const cursor=new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),new THREE.MeshBasicMaterial({color:'#ffdfa1',toneMapped:false}));controller.add(cursor);cursor.visible=false;controller.userData.cursor=cursor;controller.userData.connected=false;
    controller.addEventListener('connected',()=>{controller.userData.connected=true;});
    controller.addEventListener('disconnected',()=>{controller.userData.connected=false;clearXRPointer(controller);});
    controller.addEventListener('squeeze',()=>{if(canUseXR()&&controller.userData.connected)showVRGuide();});
    controller.addEventListener('select',()=>{
      if(!canUseXR())return;
      // Recast at the gesture; a previous frame may refer to a different target.
      syncXRCamera();const hit=castXRPointer(controller);if(!hit)return;
      if(hit.type==='guide'){if(hit.action)runVRAction(hit.action);}
      else if(hit.type==='exhibit')visit(hit.id,true);else teleport(hit.point.x,hit.point.z);
    });controllers.push(controller);
  }
  const owner=renderer;
  renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();if(owner!==renderer)return;contextLost=true;++xrRequestToken;sessionStarting=false;$('enter-vr').disabled=false;$('enter-vr').textContent='VR ↗';keys.clear();drag=null;owner.setAnimationLoop(null);clearXRInputs();
    $('loading-title').textContent='ВОССТАНАВЛИВАЕМ ГРАФИКУ';$('loading-detail').textContent='Восстанавливаем свет и скульптуры…';if(active)showLoading(true);
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(owner===renderer&&contextLost&&initialized)void rebuildGraphics();});
  setupPointer();installAtmosphere(renderer,world);world.setLighting(false);syncLightButton();applyQuality();
  const resources=await Promise.allSettled([loadSculpture(world,progress=>{$('loading-detail').textContent=progress?'Загружаем скульптуру · '+Math.round(progress*100)+'%':'Загружаем скульптуру…';}),installCollegeMark(world),installMuseumGraphics(world)]);
  const failed=resources.find(result=>result.status==='rejected');if(failed)throw failed.reason;
  if(renderer.getContext?.().isContextLost())throw new Error('WebGL context lost during initialization');
  exhibitBounds=collectionBounds(world);consolidateArchitecture(world);freezeArchitecture(world);exhibitPicker=createExhibitPicker(world);effects=new GalleryAtmosphere(world,EXHIBITS,{reduced});cinematic=new CinematicRenderer(renderer);vrGuide=new VRGuide(world.scene,camera,COLLECTION);initialized=true;contextLost=false;applyQuality();
}
function disposeFailedInit(){
  renderer?.setAnimationLoop(null);world?.environmentTarget?.dispose();cinematic?.dispose();exhibitPicker?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const collect=o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}o.shadow?.map?.dispose();};
  world?.scene.traverse(collect);
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
  renderer?.dispose();renderer?.domElement.remove();controllers.length=0;teleportHits.clear();world=null;renderer=null;vrGuide=null;effects=null;cinematic=null;exhibitPicker=null;exhibitBounds=[];initialized=false;contextLost=false;
}
async function enter(id=0){
  if(contextLost&&initialized){if(active)return rebuildGraphics();disposeFailedInit();initPromise=null;}
  const token=++openToken;pendingEntry={id};if(!active)returnFocus=document.activeElement;
  active=true;experience.hidden=false;landing.inert=true;landing.setAttribute('aria-hidden','true');document.body.classList.add('in-experience');
  if(initialized)hideLoading();else showLoading();$('loading-title').textContent='ОТКРЫВАЕМ ПАВИЛЬОН';$('loading-detail').textContent='Готовим скульптуры…';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(token!==openToken||!active)return;
  try{
    if(!initPromise)initPromise=init().catch(error=>{disposeFailedInit();initPromise=null;throw error;});
    await initPromise;if(token!==openToken||!active)return;
    resize();visit(id,true);syncAnimationLoop();if(!contextLost){hideLoading();$('exit-viewer').focus();}
    $('hint').classList.remove('dismissed');clearTimeout(hintTimer);hintTimer=setTimeout(dismissHint,6500);
  }catch(error){
    if(token!==openToken||!active)return;
    console.error(error);$('loading-title').textContent='ПАВИЛЬОН НЕ ЗАГРУЗИЛСЯ';$('loading-detail').textContent='Проверьте соединение. Для просмотра нужен браузер с WebGL 2.';showLoading(true);
  }
}
$('retry-loading').onclick=()=>contextLost&&initialized?rebuildGraphics():enter(pendingEntry.id);
$('cancel-loading').onclick=exit;
$('loading').addEventListener('cancel',event=>{event.preventDefault();void exit();});
function rebuildGraphics(){
  if(rebuildPromise)return rebuildPromise;
  const id=selected,day=world?.dayMode??false;
  rebuildPromise=(async()=>{
    if(session)await endVR();
    if(session){toast('Завершите VR через меню шлема, затем восстановите графику.');return;}
    disposeFailedInit();initPromise=null;contextLost=false;
    if(!active)return;
    await enter(id);
    if(active&&initialized){world.setLighting(day);syncLightButton();toast('Павильон восстановлен.');}
  })().finally(()=>{rebuildPromise=null;});return rebuildPromise;
}
async function exit(){
  const exitToken=++openToken;++xrRequestToken;active=false;sessionStarting=false;cancelVisit();keys.clear();drag=null;dismissHint();
  ++soundRequest;soundBusy=false;soundOn=false;if(audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);$('sound').textContent='Выключен';$('sound').setAttribute('aria-pressed','false');document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  if(session)await endVR();if(exitToken!==openToken)return;
  if(session){active=true;syncAnimationLoop();vrGuide?.setEnabled(canUseXR());return;}
  hideLoading();$('enter-vr').disabled=false;$('enter-vr').textContent='VR ↗';
  active=false;renderer?.setAnimationLoop(null);await leaveFullscreen();if(exitToken!==openToken)return;experience.hidden=true;landing.inert=false;landing.removeAttribute('aria-hidden');document.body.classList.remove('in-experience');
  cinematic?.release();
  if(audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);
  soundOn=false;$('sound').textContent='Выключен';$('sound').setAttribute('aria-pressed','false');returnFocus?.focus();
}
$('exit-viewer').onclick=exit;
function syncFullscreen(){
  const available=!!document.fullscreenEnabled&&!!document.documentElement?.requestFullscreen;
  $('fullscreen').disabled=!available||fullscreenBusy||!!session;
  const on=document.fullscreenElement===document.documentElement;
  $('fullscreen').textContent=on?'Выйти из полного экрана':'На весь экран';$('fullscreen').setAttribute('aria-pressed',String(on));
  $('fullscreen-note').textContent=available?'F — полный экран · Esc — назад.':'Этот браузер не предоставляет полноэкранный режим.';
  if(!document.fullscreenElement)ownsFullscreen=false;
}
async function toggleFullscreen(){
  if(!active||!initialized||session||contextLost||fullscreenBusy||!document.fullscreenEnabled)return;
  const token=openToken;fullscreenBusy=true;syncFullscreen();$('settings-dialog').close();
  try{
    if(document.fullscreenElement===document.documentElement){await document.exitFullscreen();ownsFullscreen=false;}
    else{await document.documentElement.requestFullscreen();ownsFullscreen=true;if(token!==openToken||!active||session){await document.exitFullscreen();ownsFullscreen=false;}}
  }catch{toast('Браузер не разрешил полный экран. Просмотр доступен в обычном окне.');}
  finally{fullscreenBusy=false;syncFullscreen();resize();if(active&&!session)renderer.domElement?.focus();}
}
async function leaveFullscreen(){
  if(!ownsFullscreen||document.fullscreenElement!==document.documentElement)return;
  try{await document.exitFullscreen();ownsFullscreen=false;}catch{}
}
$('fullscreen').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',()=>{syncFullscreen();resize();});syncFullscreen();
function setOrientation(target){const v=new THREE.Vector3(...target).sub(new THREE.Vector3(rig.position.x,1.65,rig.position.z));yaw=Math.atan2(-v.x,-v.z);pitch=Math.atan2(v.y,Math.hypot(v.x,v.z));camera.rotation.set(pitch,yaw,0,'YXZ');}
function updatePanel(id){
  selected=id;const item=COLLECTION[id]||PAVILION;
  $('object-number').textContent=id<0?'МИК / КОЛЛЕКЦИЯ':String(id+1).padStart(2,'0')+' / 04';
  $('object-title').textContent=item.title;$('object-caption').textContent=item.caption;
  $('collection-status').textContent=item.title+(id<0?'':', '+(id+1)+' из '+COLLECTION.length);
  $('object-dialog-title').textContent=item.title;$('object-category').textContent=item.category;
  $('object-description').textContent=item.description;$('object-source').hidden=id!==0;
  $('open-object').setAttribute('aria-label','Об экспонате: '+item.title);
  effects?.focus(id);updateVRGuide();
}
function visit(id,immediate=false){
  if(!initialized||!world||!Number.isInteger(id)||id < -1||id>=EXHIBITS.length)return;
  clearTimeout(moveTimer);requestedView=id;const token=openToken;const e=EXHIBITS[id];const p=e?e.view:[0,0,11.7];const t=galleryTarget(id);
  const perform=()=>{
    if(token!==openToken||!active)return;requestedView=null;
    if(session){
      if(!xrReady){pendingSpawn=id;updatePanel(id);return;}
      moveXRTo(p[0],p[2]);faceXRTarget(t);
    }else{rig.position.set(...p);rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);setOrientation(t);}
    updatePanel(id);if(session)showVRGuide();else frameExhibit();$('fade').classList.remove('visible');
  };
  if(immediate||session||reduced)perform();else{$('fade').classList.add('visible');moveTimer=setTimeout(perform,240);}
}
function teleport(x,z){if(!canUseXR()||!isWalkable(x,z))return;moveXRTo(x,z);vrGuide.hide();clearXRInputs();}

function setupPointer(){
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(session||contextLost)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};dismissHint();});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||session)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.0035;pitch=THREE.MathUtils.clamp(pitch-dy*.0035,-1.1,1.1);drag.x=e.clientX;drag.y=e.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');});
  canvas.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(drag.distance<9){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=exhibitPicker?.pick(raycaster);if(hit){const id=exhibitId(hit.object);if(id!==null){if(id===selected)effects?.focus(id);else visit(id);}}}
    drag=null;
  });for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
}
function exhibitId(object){let o=object;while(o){if(Number.isInteger(o.userData.exhibit))return o.userData.exhibit;o=o.parent;}return null;}
window.addEventListener('keydown',e=>{
  if(!active||!initialized||contextLost||session||document.querySelector('dialog[open]')||e.target.matches('input,textarea,select'))return;
  if(e.code==='Escape'&&document.fullscreenElement===document.documentElement){e.preventDefault();void leaveFullscreen();return;}
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat)void toggleFullscreen();return;}
  if(['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();if(!e.repeat){dismissHint();visit(galleryStep(requestedView??selected,e.code==='ArrowRight'?1:-1));}return;}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);dismissHint();}
  if(/^Digit[1-4]$/.test(e.code))visit(Number(e.code.slice(-1))-1);
  if(e.code==='Digit0')visit(-1);if(e.code==='Escape'&&!session)exit();
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();drag=null;windowFocused=false;adaptive.reset();});window.addEventListener('focus',()=>{windowFocused=true;adaptive.reset();});
document.addEventListener('visibilitychange',()=>{keys.clear();drag=null;syncAnimationLoop();if(document.hidden&&audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);else if(soundOn&&audioGain&&(!session||session.visibilityState==='visible'))audioGain.gain.setTargetAtTime(.045,audioContext.currentTime,.3);});

function frame(time,xrFrame){
  if(!active||!initialized||contextLost||document.hidden&&!session)return;
  const elapsed=lastTime?time-lastTime:0,dt=Math.min(elapsed/1000||0,.04);lastTime=time;
  const blocked=!!document.querySelector('dialog[open]');
  if(adaptive.sample(elapsed,quality==='auto'&&windowFocused&&!session&&!blocked)){applyQuality();}
  if(renderer.shadowMap.enabled&&(time-lastShadow>=50)){renderer.shadowMap.needsUpdate=true;lastShadow=time;}
  if(!reduced){const t=time*.001;world.animated.forEach(a=>{if(a.kind==='orbit')a.group.rotation.z+=dt*a.speed;else if(a.kind==='sputnik')a.group.rotation.y=Math.sin(t*.17)*.18;else if(a.kind==='robot')a.group.rotation.y=Math.sin(t*.35)*.12;});}
  if(session){
    const hadPose=xrReady;
    xrReady=!sessionStarting&&!!xrFrame?.getViewerPose(renderer.xr.getReferenceSpace());
    if(xrReady){
      syncXRCamera();
      if(pendingSpawn!==null){const id=pendingSpawn;pendingSpawn=null;visit(id,true);}
      else if(!hadPose&&vrGuide.open)showVRGuide();
    }
    vrGuide.setEnabled(canUseXR());world.marker.visible=false;
    if(canUseXR()){
      world.scene.updateMatrixWorld();
      let hover=null;
      for(const controller of controllers){
        const hit=castXRPointer(controller);
        if(!hit){clearXRPointer(controller);continue;}
        teleportHits.set(controller,hit);controller.userData.line.visible=true;controller.userData.line.scale.z=hit.distance;
        const cursor=controller.userData.cursor;cursor.visible=true;cursor.position.set(0,0,-hit.distance);
        controller.userData.line.material.color.set(hit.type==='guide'&&hit.action?'#d57743':'#ffe6b7');
        if(hit.type==='guide'&&hit.action)hover=hit.action;
        if(hit.type==='floor'){world.marker.position.copy(hit.point);world.marker.position.y=.04;world.marker.visible=true;}
      }
      vrGuide.setHover(hover);
      const right=[...session.inputSources].find(source=>source.handedness==='right'&&source.gamepad);
      const axis=right?.gamepad.axes[2]??right?.gamepad.axes[0]??0;
      if(Math.abs(axis)<.3)snapReady=true;
      if(snapReady&&Math.abs(axis)>.7){
        const before=xrHead();rig.rotation.y-=Math.sign(axis)*Math.PI/6;syncXRCamera();const after=xrHead();
        rig.position.x+=before.x-after.x;rig.position.z+=before.z-after.z;syncXRCamera();snapReady=false;
        if(vrGuide.open)showVRGuide();
      }
    }else clearXRInputs();
  }else{
    if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;if(keys.has('ArrowUp'))pitch=Math.min(1.1,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(-1.1,pitch-dt);camera.rotation.set(pitch,yaw,0,'YXZ');
    const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    if(f||s){const n=Math.hypot(f,s),speed=dt*2.8/n;const x=rig.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed,z=rig.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed;if(isWalkable(x,rig.position.z))rig.position.x=x;if(isWalkable(rig.position.x,z))rig.position.z=z;}
  }
  const simulate=(session?canUseXR():!document.hidden)&&!blocked;
  effects?.update(simulate?dt:0);
  if(cinematic)cinematic.render(world.scene,camera,{detail:graphicsProfile().quality==='detail',xr:!!session,energy:effects?.energy||0});else renderer.render(world.scene,camera);
}

function syncXRCamera(){rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);}
// Read the manager's matrix directly: Object3D world accessors can recompose
// the unparented ArrayCamera and overwrite its reference-space matrix.
function xrHead(){return new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);}
function canUseXR(){return !!(active&&!contextLost&&session&&!sessionStarting&&xrReady&&session.visibilityState==='visible');}
function moveXRTo(x,z){
  syncXRCamera();const head=xrHead();rig.position.x+=x-head.x;rig.position.z+=z-head.z;rig.position.y=0;syncXRCamera();clearXRInputs();
}
function faceXRTarget(target){
  const head=xrHead(),forward=new THREE.Vector3(0,0,-1).transformDirection(renderer.xr.getCamera().matrixWorld);
  const desired=Math.atan2(target[0]-head.x,target[2]-head.z),current=Math.atan2(forward.x,forward.z);
  rig.rotation.y+=desired-current;syncXRCamera();const after=xrHead();
  rig.position.x+=head.x-after.x;rig.position.z+=head.z-after.z;syncXRCamera();
}
function clearXRPointer(controller){
  teleportHits.delete(controller);controller.userData.cursor.visible=false;controller.userData.line.visible=false;
}
function clearXRInputs(){controllers.forEach(clearXRPointer);teleportHits.clear();if(world?.marker)world.marker.visible=false;vrGuide?.setHover(null);}
function castXRPointer(controller){
  if(!canUseXR()||!controller.visible||!controller.userData.connected)return null;
  controller.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,true);matrix.identity().extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(matrix);
  const panelHit=vrGuide.hit(raycaster),objectHit=exhibitPicker?.pick(raycaster),floorHit=raycaster.intersectObject(world.floor)[0];
  // The small head-relative reopen button remains reachable even next to a plinth.
  if(panelHit&&(!vrGuide.open||panelHit.distance<Math.min(objectHit?.distance??Infinity,floorHit?.distance??Infinity)))return panelHit;
  if(objectHit&&(!floorHit||objectHit.distance<floorHit.distance))return {type:'exhibit',id:exhibitId(objectHit.object),distance:objectHit.distance};
  if(floorHit&&isWalkable(floorHit.point.x,floorHit.point.z))return {type:'floor',point:floorHit.point,distance:floorHit.distance};
  return null;
}
function updateVRGuide(){vrGuide?.update(selected);}
function showVRGuide(){
  if(!session||!xrReady)return;
  syncXRCamera();const forward=new THREE.Vector3(0,0,-1).transformDirection(renderer.xr.getCamera().matrixWorld);
  updateVRGuide();vrGuide.show(xrHead(),forward);vrGuide.setEnabled(canUseXR());clearXRInputs();
}
function runVRAction(action){
  if(!canUseXR())return;
  if(action==='open')showVRGuide();
  else if(action==='hide'){vrGuide.hide();clearXRInputs();}
  else if(action==='previous')visit(galleryStep(requestedView??selected,-1),true);
  else if(action==='next')visit(galleryStep(requestedView??selected,1),true);
  else if(action==='info')vrGuide.toggleInfo();
  else if(action==='exit')void endVR();
}
function restoreXR(endedSession){
  if(session!==endedSession)return;
  session=null;sessionStarting=false;xrReady=false;pendingSpawn=null;snapReady=true;vrGuide?.setEnabled(false);clearXRInputs();
  document.body.classList.remove('xr-active');$('enter-vr').disabled=false;$('enter-vr').textContent='VR ↗';
  rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);camera.fov=65;camera.near=.08;camera.far=70;camera.updateProjectionMatrix();
  applyQuality();if(active)visit(selected,true);resize();syncAnimationLoop();
}
async function endVR(){
  const ending=session;if(!ending)return;
  try{await ending.end();restoreXR(ending);}catch{toast('Завершите VR через меню шлема.');}
}
function xrVisibilityChanged(){
  keys.clear();snapReady=true;clearXRInputs();vrGuide?.setEnabled(canUseXR());
  if(audioGain)audioGain.gain.setTargetAtTime(soundOn&&session?.visibilityState==='visible' ? .045 : 0,audioContext.currentTime,.1);
  if(canUseXR()&&vrGuide.open)showVRGuide();
}
$('enter-vr').onclick=()=>{
  if(session){void endVR();return;}
  if(!navigator.xr||!xrSupported){showHelp();return;}
  if(sessionStarting||!initialized||!active||contextLost)return;
  cancelVisit();keys.clear();drag=null;
  sessionStarting=true;const token=++xrRequestToken;$('enter-vr').disabled=true;$('enter-vr').textContent='VR…';
  const failed=async error=>{
    if(token!==xrRequestToken)return;
    console.error(error);const failedSession=session;if(failedSession){try{await failedSession.end();}catch{}restoreXR(failedSession);}
    sessionStarting=false;$('enter-vr').disabled=false;$('enter-vr').textContent='VR ↗';
    toast(error.name==='NotAllowedError'?'VR не запущен: доступ отклонён. Разрешите погружение в браузере шлема.':'Не удалось включить VR. Продолжайте просмотр в 3D или попробуйте браузер шлема.');
  };
  // Must be invoked synchronously from the user gesture.
  let request;try{request=navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor']});}catch(error){void failed(error);return;}
  request.then(async xrSession=>{
    if(token!==xrRequestToken||!active){await xrSession.end();return;}
    session=xrSession;xrReady=false;pendingSpawn=selected;snapReady=true;
    xrSession.addEventListener('end',()=>queueMicrotask(()=>restoreXR(xrSession)));
    xrSession.addEventListener('visibilitychange',()=>{if(session===xrSession)xrVisibilityChanged();});
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    rig.rotation.set(0,0,0);camera.rotation.set(0,0,0);camera.position.set(0,0,0);rig.position.set(0,0,0);renderer.shadowMap.enabled=false;cinematic?.release();
    await renderer.xr.setSession(xrSession);
    if(token!==xrRequestToken||!active||session!==xrSession){await xrSession.end();return;}
    document.body.classList.add('xr-active');effects?.configure(graphicsProfile().quality,true);$('enter-vr').disabled=false;$('enter-vr').textContent='Выйти из VR';sessionStarting=false;
  }).catch(failed);
};
$('sound').onclick=async()=>{
  if(!active||soundBusy)return;const token=openToken,request=++soundRequest,desired=!soundOn;soundBusy=true;
  try{
    if(!audioContext){const Audio=window.AudioContext||window.webkitAudioContext;audioContext=new Audio();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);
      for(const f of [55,82.41,110]){const o=audioContext.createOscillator();o.type='sine';o.frequency.value=f;const g=audioContext.createGain();g.gain.value=.28;o.connect(g);g.connect(audioGain);o.start();}}
    await audioContext.resume();if(request!==soundRequest||token!==openToken||!active)return;
    soundOn=desired;audioGain.gain.setTargetAtTime(soundOn&&!document.hidden&&(!session||session.visibilityState==='visible') ? 0.045 : 0,audioContext.currentTime,.3);$('sound').textContent=soundOn?'Включён':'Выключен';$('sound').setAttribute('aria-pressed',String(soundOn));
  }catch{if(request===soundRequest&&token===openToken&&active)toast('Браузер не разрешил воспроизведение звука.');}
  finally{if(request===soundRequest)soundBusy=false;}
};

$('lighting').onclick=()=>{if(!world)return;world.setLighting(!world.dayMode);syncLightButton();};
$('open-credits').onclick=()=>openDialog($('credits-dialog'));
$('close-credits').onclick=()=>{$('credits-dialog').close();};


function syncLightButton(){if(!world)return;$('lighting').textContent=world.dayMode?'День':'Вечер';$('lighting').setAttribute('aria-pressed',String(!world.dayMode));}

function applyQuality(){
  const profile=graphicsProfile();$('quality').value=quality;
  $('quality-state').textContent=quality==='auto'?'Авто · '+profile.label:'Выбран режим «'+profile.label+'»';
  if(!renderer)return;
  renderer.shadowMap.enabled=profile.quality==='detail'&&!session;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;lastShadow=-Infinity;
  if(profile.quality==='smooth'||session)cinematic?.release();effects?.configure(profile.quality,!!session);resize();
}
applyQuality();$('quality').onchange=()=>{const value=$('quality').value;if(!['auto','detail','smooth'].includes(value))return;quality=value;adaptive.reset();try{writeQuality(window.localStorage,quality);}catch{}applyQuality();};
$('open-settings').onclick=()=>openDialog($('settings-dialog'));
document.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>$(b.dataset.dismiss).close());

