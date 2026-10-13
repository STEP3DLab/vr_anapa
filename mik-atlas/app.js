import * as THREE from './vendor/three.module.min.js';
import {buildWorld,EXHIBITS,isWalkable} from './world.js?v=6.1';
import {installAtmosphere} from './atmosphere.js?v=6.1';
import {loadSculpture,installCollegeMark} from './sculpture.js?v=6.1';
import {createTour,floorPoint} from './tour.js?v=6.1';
import {consolidateArchitecture,freezeArchitecture,createExhibitPicker} from './optimize.js?v=6.1';
import {Inspection} from './inspection.js?v=6.1';
import {installMuseumGraphics} from './museum.js?v=6.1';
import {VRGuide} from './vr-guide.js?v=6.1';
import {ResonanceGame,gameAction} from './game.js?v=6.1';
import {AtlasEffects} from './effects.js?v=6.1';
import {CinematicRenderer} from './cinematic.js?v=6.1';
import {renderPixelRatio} from './render-budget.js?v=6.1';

const $=id=>document.getElementById(id);
const experience=$('experience'),landing=$('landing'),viewport=$('viewport'),dialog=$('help-dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let world,renderer,camera,rig,active=false,selected=-1,yaw=0,pitch=0,initialized=false,xrSupported=false,session=null,sessionStarting=false;
let inspection=null;const inspectionPointers=new Map();
let vrGuide=null,xrRequestToken=0,xrReady=false,pendingSpawn=null;
const game=new ResonanceGame();let effects=null,cinematic=null,gamePreviousDay=true,lastGameKey='';
let exhibitPicker=null,contextLost=false,rebuildPromise=null,lastShadow=-Infinity;
let initPromise=null,openToken=0,pendingEntry={id:-1,guided:false};
let quality=matchMedia('(pointer: coarse)').matches?'smooth':'detail';
const tour=createTour(EXHIBITS.length);
const questions=['Какие черты лица и детали поверхности делают портрет узнаваемым? Обойдите скульптуру и сравните силуэт с разных сторон.','Почему простая сфера и тонкие антенны стали таким сильным визуальным символом? Рассмотрите места соединения деталей.','Что эта скульптура помогает представить — и что скрывает? Чем научная модель отличается от художественного образа?','Какую задачу вы поручили бы роботу в колледже? Найдите детали, которые подсказывают его возможные функции.'];
let keys=new Set(),drag=null,lastTime=0,toastTimer,moveTimer,returnFocus=null,audioContext,audioGain,soundOn=false,snapReady=true;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),direction=new THREE.Vector3(),matrix=new THREE.Matrix4();
const controllers=[],teleportHits=new Map();

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
async function checkXR(){
  try{xrSupported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch{xrSupported=false;}
  $('xr-status').textContent=xrSupported?'Браузер поддерживает VR. Откройте павильон и нажмите «Войти в VR».':'На этом устройстве VR не обнаружен. Экспозиция доступна в обычном 3D-режиме. Для погружения откройте эту ссылку в браузере совместимого VR-шлема.';
  $('enter-vr').title=xrSupported?'Начать погружение':'Информация о входе в VR';
}
checkXR();
function openDialog(element){keys.clear();drag=null;if(!element.open)element.showModal();}
function showHelp(){$('settings-dialog').close();openDialog(dialog);}
$('help').onclick=showHelp;$('hero-vr').onclick=showHelp;
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('[data-enter]').forEach(b=>b.onclick=()=>enter(-1));
document.querySelectorAll('[data-exhibit]').forEach(b=>b.onclick=()=>enter(Number(b.dataset.exhibit)));
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>visit(Number(b.dataset.route)));
$('next-object').onclick=()=>visit((selected+1)%EXHIBITS.length);
$('close-panel').onclick=()=>{$('object-panel').hidden=true;document.body.classList.remove('panel-expanded');};

function resize(){
  if(!renderer||!active||session)return;const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);
  const ratio=renderPixelRatio(w,h,devicePixelRatio,quality,Math.min(4096,renderer.capabilities?.maxTextureSize||4096));
  renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();inspection?.resize(w,h);
}
function syncAnimationLoop(){if(!renderer)return;lastTime=0;renderer.setAnimationLoop(active&&initialized&&!contextLost&&(!document.hidden||session)?frame:null);}
window.addEventListener('resize',resize);
async function init(){
  world=buildWorld();
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.xr.enabled=true;renderer.xr.cameraAutoUpdate=false;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(1);
  viewport.appendChild(renderer.domElement);
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
      else if(hit.type==='station')void startGame(hit.id);
      else if(hit.type==='exhibit')visit(hit.id,true);else teleport(hit.point.x,hit.point.z);
    });controllers.push(controller);
  }
  const owner=renderer;
  renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();if(owner!==renderer)return;contextLost=true;++xrRequestToken;sessionStarting=false;$('enter-vr').disabled=false;$('enter-vr').textContent='Войти в VR';keys.clear();drag=null;owner.setAnimationLoop(null);clearXRInputs();
    $('loading-title').textContent='ВОССТАНАВЛИВАЕМ ГРАФИКУ';$('loading-detail').textContent='Графический контекст прерван. Игра приостановлена; попробуем восстановить зал.';$('loading').hidden=false;$('loading-actions').hidden=false;
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(owner===renderer&&contextLost&&initialized)void rebuildGraphics();});
  setupPointer();installAtmosphere(renderer,world);applyQuality();
  const resources=await Promise.allSettled([loadSculpture(world,progress=>{$('loading-detail').textContent=progress?'Загружаем скульптуру · '+Math.round(progress*100)+'%':'Загружаем скульптуру…';}),installCollegeMark(world),installMuseumGraphics(world)]);
  const failed=resources.find(result=>result.status==='rejected');if(failed)throw failed.reason;
  if(renderer.getContext?.().isContextLost())throw new Error('WebGL context lost during initialization');
  consolidateArchitecture(world);freezeArchitecture(world);exhibitPicker=createExhibitPicker(world);effects=new AtlasEffects(world,EXHIBITS,{reduced});cinematic=new CinematicRenderer(renderer);inspection=new Inspection(world);vrGuide=new VRGuide(world.scene,camera,EXHIBITS,questions);initialized=true;contextLost=false;applyQuality();
}
function disposeFailedInit(){
  renderer?.setAnimationLoop(null);world?.environmentTarget?.dispose();cinematic?.dispose();exhibitPicker?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const collect=o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}o.shadow?.map?.dispose();};
  world?.scene.traverse(collect);inspection?.scene.traverse(collect);
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
  renderer?.dispose();renderer?.domElement.remove();controllers.length=0;teleportHits.clear();world=null;renderer=null;inspection=null;vrGuide=null;effects=null;cinematic=null;exhibitPicker=null;initialized=false;contextLost=false;
}
async function enter(id,guided=false){
  if(contextLost&&initialized){if(active)return rebuildGraphics();disposeFailedInit();initPromise=null;}
  const token=++openToken;pendingEntry={id,guided};if(!active)returnFocus=document.activeElement;
  active=true;experience.hidden=false;landing.inert=true;landing.setAttribute('aria-hidden','true');document.body.classList.add('in-experience');
  $('loading').hidden=initialized;$('loading-actions').hidden=true;$('loading-title').textContent='ОТКРЫВАЕМ ПАВИЛЬОН';$('loading-detail').textContent='Настраиваем свет. Готовим экспонаты.';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(token!==openToken||!active)return;
  try{
    if(!initPromise)initPromise=init().catch(error=>{disposeFailedInit();initPromise=null;throw error;});
    await initPromise;if(token!==openToken||!active)return;
    if(guided)tour.start();else tour.stop();resize();visit(id,true);syncAnimationLoop();$('loading').hidden=!contextLost;$('exit-viewer').focus();
    if(matchMedia('(pointer: coarse)').matches)$('hint').textContent='Потяните экран — обзор · Стрелки слева — движение';
  }catch(error){
    if(token!==openToken||!active)return;
    console.error(error);$('loading-title').textContent='ПАВИЛЬОН НЕ ЗАГРУЗИЛСЯ';$('loading-detail').textContent='Проверьте соединение. Для просмотра нужен браузер с WebGL 2.';$('loading-actions').hidden=false;$('loading').hidden=false;
  }
}
$('retry-loading').onclick=()=>contextLost&&initialized?rebuildGraphics():enter(pendingEntry.id,pendingEntry.guided);
$('cancel-loading').onclick=exit;
function rebuildGraphics(){
  if(rebuildPromise)return rebuildPromise;
  const id=selected,guided=tour.active,visited=[...tour.visited],day=world?.dayMode??true;
  if(inspection?.active)closeInspection(false);
  rebuildPromise=(async()=>{
    if(session)await endVR();
    if(session){toast('Завершите VR через меню шлема, затем восстановите графику.');return;}
    disposeFailedInit();initPromise=null;contextLost=false;
    if(!active)return;
    await enter(id,guided);
    if(active&&initialized){if(guided){visited.forEach(i=>tour.select(i));tour.select(id);renderTour();}world.setLighting(day);syncLightButton();renderGame();toast('Графика восстановлена. Можно продолжать.');}
  })().finally(()=>{rebuildPromise=null;});return rebuildPromise;
}
async function exit(){
  if(game.active)stopGame(false);
  if(inspection?.active)closeInspection(false);
  ++openToken;++xrRequestToken;active=false;sessionStarting=false;clearTimeout(moveTimer);keys.clear();drag=null;tour.stop();document.body.classList.remove('panel-expanded');document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  if(session)await endVR();
  $('enter-vr').disabled=false;$('enter-vr').textContent='Войти в VR';
  active=false;renderer?.setAnimationLoop(null);experience.hidden=true;landing.inert=false;landing.removeAttribute('aria-hidden');document.body.classList.remove('in-experience');
  cinematic?.release();
  if(audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);
  soundOn=false;$('sound').textContent='Звук выкл.';$('sound').setAttribute('aria-pressed','false');returnFocus?.focus();
}
$('exit-viewer').onclick=exit;
function setOrientation(target){const v=new THREE.Vector3(...target).sub(new THREE.Vector3(rig.position.x,1.65,rig.position.z));yaw=Math.atan2(-v.x,-v.z);pitch=Math.atan2(v.y,Math.hypot(v.x,v.z));camera.rotation.set(pitch,yaw,0,'YXZ');}
function updatePanel(id){
  if(game.active&&id>=0)game.select(id);
  selected=id;tour.select(id);renderTour();document.querySelectorAll('[data-route]').forEach(b=>{const on=Number(b.dataset.route)===id;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('object-panel').hidden=id<0;
  if(id>=0){const e=EXHIBITS[id];$('object-category').textContent=e.category;$('object-title').textContent=e.title;$('object-description').textContent=e.description;$('object-fact').textContent=e.fact;$('object-source').hidden=id!==0;$('object-question').textContent=questions[id];setPanelExpanded(!matchMedia('(max-width:700px)').matches);}
  else document.body.classList.remove('panel-expanded');
  if(game.active)renderGame();
}
function visit(id,immediate=false){
  if(!initialized||!world||!Number.isInteger(id)||id < -1||id>=EXHIBITS.length)return;
  clearTimeout(moveTimer);const e=EXHIBITS[id];const p=e?e.view:[0,0,11.7];const t=e?e.target:[0,2.1,-7];
  const perform=()=>{
    if(session){
      if(!xrReady){pendingSpawn=id;updatePanel(id);return;}
      moveXRTo(p[0],p[2]);
    }else{rig.position.set(...p);rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);setOrientation(t);}
    updatePanel(id);if(session)showVRGuide();$('fade').classList.remove('visible');
  };
  if(immediate||session||reduced)perform();else{$('fade').classList.add('visible');moveTimer=setTimeout(perform,130);}
}
function teleport(x,z){if(!canUseXR()||!isWalkable(x,z))return;moveXRTo(x,z);vrGuide.hide();clearXRInputs();}

function setupPointer(){
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(session)return;if(inspection?.active){canvas.setPointerCapture(e.pointerId);inspectionPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});return;}canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,distance:0};});
  canvas.addEventListener('pointermove',e=>{if(inspection?.active){moveInspection(e);return;}if(!drag||drag.id!==e.pointerId||session)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.0035;pitch=THREE.MathUtils.clamp(pitch-dy*.0035,-1.1,1.1);drag.x=e.clientX;drag.y=e.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');});
  canvas.addEventListener('pointerup',e=>{
    if(inspection?.active){inspectionPointers.delete(e.pointerId);return;}
    if(!drag||drag.id!==e.pointerId)return;
    if(drag.distance<9){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=exhibitPicker?.pick(raycaster),station=effects?.pick(raycaster);if(station&&(!hit||station.distance<hit.distance))void startGame(station.id);else if(hit){const id=exhibitId(hit.object);if(id!==null)visit(id);}}
    drag=null;
  });canvas.addEventListener('pointercancel',e=>{drag=null;inspectionPointers.delete(e.pointerId);});canvas.addEventListener('lostpointercapture',e=>{drag=null;inspectionPointers.delete(e.pointerId);});
  canvas.addEventListener('wheel',e=>{if(!inspection?.active)return;e.preventDefault();inspection.zoom(Math.exp(THREE.MathUtils.clamp(e.deltaY,-400,400)*.0015));},{passive:false});
}
function exhibitId(object){let o=object;while(o){if(Number.isInteger(o.userData.exhibit))return o.userData.exhibit;o=o.parent;}return null;}
window.addEventListener('keydown',e=>{
  if(!active||!initialized||contextLost||session||document.querySelector('dialog[open]')||e.target.matches('input,textarea,select'))return;
  if(game.active&&e.code==='Space'&&!e.target.matches('button')){e.preventDefault();if(!e.repeat)runGameAction(gameAction(game.view()).action);return;}
  if(inspection?.active){
    if(e.code==='Escape'){closeInspection();return;}
    if(e.code==='ArrowLeft')inspection.orbit(-18,0);else if(e.code==='ArrowRight')inspection.orbit(18,0);else if(e.code==='ArrowUp')inspection.orbit(0,-14);else if(e.code==='ArrowDown')inspection.orbit(0,14);else if(e.code==='Equal'||e.code==='NumpadAdd')inspection.zoom(.88);else if(e.code==='Minus'||e.code==='NumpadSubtract')inspection.zoom(1.14);else if(e.code==='Home')inspection.reset();else return;
    e.preventDefault();return;
  }
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(e.code==='KeyM'){e.preventDefault();showMap();return;}
  if(/^Digit[1-4]$/.test(e.code))visit(Number(e.code.slice(-1))-1);
  if(e.code==='Digit0')visit(-1);if(e.code==='Escape'&&!session)exit();
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{keys.clear();drag=null;syncAnimationLoop();if(document.hidden&&audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);else if(soundOn&&audioGain&&(!session||session.visibilityState==='visible'))audioGain.gain.setTargetAtTime(.045,audioContext.currentTime,.3);});

function frame(time,xrFrame){
  if(!active||!initialized||contextLost||document.hidden&&!session)return;
  const dt=Math.min((time-lastTime)/1000||0,.04);lastTime=time;
  if(inspection?.active){if(inspection.dirty){renderer.shadowMap.needsUpdate=true;renderer.render(inspection.scene,inspection.camera);inspection.dirty=false;}return;}
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
  const simulate=(session?canUseXR():!document.hidden)&&!document.querySelector('dialog[open]');
  const previousPhase=game.phase;if(simulate)game.tick(dt);
  if(game.active){renderGame();if(previousPhase==='celebrating'&&game.phase==='complete'&&session)showVRGuide();}
  effects?.update(simulate?dt:0,camera,game);
  if($('map-dialog').open)updateMapPosition();
  if(cinematic)cinematic.render(world.scene,camera,{detail:quality==='detail',xr:!!session,energy:effects?.energy||0});else renderer.render(world.scene,camera);
}

function syncXRCamera(){rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);}
// Read the manager's matrix directly: Object3D world accessors can recompose
// the unparented ArrayCamera and overwrite its reference-space matrix.
function xrHead(){return new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);}
function canUseXR(){return !!(active&&!contextLost&&session&&!sessionStarting&&xrReady&&session.visibilityState==='visible');}
function moveXRTo(x,z){
  syncXRCamera();const head=xrHead();rig.position.x+=x-head.x;rig.position.z+=z-head.z;rig.position.y=0;syncXRCamera();clearXRInputs();
}
function clearXRPointer(controller){
  teleportHits.delete(controller);controller.userData.cursor.visible=false;controller.userData.line.visible=false;
}
function clearXRInputs(){controllers.forEach(clearXRPointer);teleportHits.clear();if(world?.marker)world.marker.visible=false;vrGuide?.setHover(null);}
function castXRPointer(controller){
  if(!canUseXR()||!controller.visible||!controller.userData.connected)return null;
  controller.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,true);matrix.identity().extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(matrix);
  const panelHit=vrGuide.hit(raycaster),objectHit=exhibitPicker?.pick(raycaster),floorHit=raycaster.intersectObject(world.floor)[0],stationHit=effects?.pick(raycaster);
  // The small head-relative reopen button remains reachable even next to a plinth.
  if(panelHit&&(!vrGuide.open||panelHit.distance<Math.min(objectHit?.distance??Infinity,floorHit?.distance??Infinity)))return panelHit;
  if(stationHit&&stationHit.distance<Math.min(objectHit?.distance??Infinity,floorHit?.distance??Infinity))return stationHit;
  if(objectHit&&(!floorHit||objectHit.distance<floorHit.distance))return {type:'exhibit',id:exhibitId(objectHit.object),distance:objectHit.distance};
  if(floorHit&&isWalkable(floorHit.point.x,floorHit.point.z))return {type:'floor',point:floorHit.point,distance:floorHit.distance};
  return null;
}
function updateVRGuide(){if(vrGuide){vrGuide.setGame(game.active?game.view():null);vrGuide.update(selected,{active:tour.active,completed:tour.completed,visited:[...tour.visited],day:world.dayMode});}}
function showVRGuide(){
  if(!session||!xrReady)return;
  syncXRCamera();const forward=new THREE.Vector3(0,0,-1).transformDirection(renderer.xr.getCamera().matrixWorld);
  updateVRGuide();vrGuide.show(xrHead(),forward);vrGuide.setEnabled(canUseXR());clearXRInputs();
}
function runVRAction(action){
  if(!canUseXR())return;
  if(action.startsWith('game:')){runGameAction(action.slice(5));return;}
  if(action.startsWith('page:')){vrGuide.setPage(Number(action.slice(5)));return;}
  if(action==='open')showVRGuide();
  else if(action==='hide'){vrGuide.hide();clearXRInputs();}
  else if(action==='previous')visit(Math.max(0,selected-1),true);
  else if(action==='next')visit((selected+1)%EXHIBITS.length,true);
  else if(action==='overview')visit(-1,true);
  else if(action==='start'){tour.start();visit(0,true);}
  else if(action==='finish'){tour.finish();renderTour();}
  else if(action==='light')$('lighting').onclick();
  else if(action==='exit')void endVR();
}
function restoreXR(endedSession){
  if(session!==endedSession)return;
  session=null;sessionStarting=false;xrReady=false;pendingSpawn=null;snapReady=true;vrGuide?.setEnabled(false);clearXRInputs();
  document.body.classList.remove('xr-active');$('enter-vr').disabled=false;$('enter-vr').textContent='Войти в VR';
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
  if(inspection?.active)closeInspection(false);
  clearTimeout(moveTimer);keys.clear();drag=null;$('fade').classList.remove('visible');
  sessionStarting=true;const token=++xrRequestToken;$('enter-vr').disabled=true;$('enter-vr').textContent='Подключаем VR…';
  const failed=async error=>{
    if(token!==xrRequestToken)return;
    console.error(error);const failedSession=session;if(failedSession){try{await failedSession.end();}catch{}restoreXR(failedSession);}
    sessionStarting=false;$('enter-vr').disabled=false;$('enter-vr').textContent='Войти в VR';
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
    document.body.classList.add('xr-active');effects?.configure(quality,true);$('enter-vr').disabled=false;$('enter-vr').textContent='Выйти из VR';sessionStarting=false;
  }).catch(failed);
};
$('sound').onclick=async()=>{
  try{
    if(!audioContext){const Audio=window.AudioContext||window.webkitAudioContext;audioContext=new Audio();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);
      for(const f of [55,82.41,110]){const o=audioContext.createOscillator();o.type='sine';o.frequency.value=f;const g=audioContext.createGain();g.gain.value=.28;o.connect(g);g.connect(audioGain);o.start();}}
    await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn ? 0.045 : 0,audioContext.currentTime,.3);$('sound').textContent=soundOn?'Звук вкл.':'Звук выкл.';$('sound').setAttribute('aria-pressed',String(soundOn));
  }catch{toast('Браузер не разрешил воспроизведение звука.');}
};

$('lighting').onclick=()=>{if(!world)return;world.setLighting(!world.dayMode);$('lighting').textContent=world.dayMode?'Свет: день':'Свет: вечер';$('lighting').setAttribute('aria-pressed',String(!world.dayMode));updateVRGuide();};
$('open-credits').onclick=()=>openDialog($('credits-dialog'));
$('close-credits').onclick=()=>{$('credits-dialog').close();};


function setPanelExpanded(expanded){
  $('object-body').hidden=!expanded;$('toggle-description').setAttribute('aria-expanded',String(expanded));
  $('toggle-description').replaceChildren(document.createTextNode(expanded?'Свернуть описание ':'Об экспонате '));
  const symbol=document.createElement('span');symbol.textContent=expanded?'−':'+';$('toggle-description').append(symbol);
  document.body.classList.toggle('panel-expanded',expanded&&!$('object-panel').hidden);
}
$('toggle-description').onclick=()=>setPanelExpanded($('object-body').hidden);
function renderTour(){
  $('tour-hud').hidden=!tour.active;$('viewer-tour').hidden=tour.active;
  $('tour-label').textContent='МАРШРУТ / '+String(Math.max(0,tour.index)+1).padStart(2,'0')+' ИЗ 04';
  $('tour-back').disabled=tour.index<=0;$('tour-next').textContent=tour.index===EXHIBITS.length-1?'Завершить ✓':'Далее →';
  [...$('tour-progress').children].forEach((el,i)=>el.classList.toggle('done',tour.visited.has(i)));
  document.body.classList.toggle('tour-running',tour.active);updateVRGuide();
}
function startTour(){
  if(game.active)stopGame(false);
  if(!active||!initialized){enter(0,true);return;}
  tour.start();visit(0);
}
document.querySelectorAll('[data-tour]').forEach(b=>b.onclick=startTour);
$('viewer-tour').onclick=startTour;$('map-tour').onclick=()=>{$('map-dialog').close();startTour();};
$('tour-back').onclick=()=>visit(tour.previous());
$('tour-next').onclick=()=>{
  if(tour.index<EXHIBITS.length-1){visit(tour.next());return;}
  const complete=tour.finish();renderTour();toast(complete?'Маршрут пройден. Продолжайте свободный осмотр — у каждой идеи есть ещё одна сторона.':'Маршрут завершён. Оставшиеся экспонаты можно выбрать на карте.');
};
$('stop-tour').onclick=()=>{tour.stop();renderTour();};

async function startGame(index=0){
  if(contextLost)return;
  if(!active||!initialized){await enter(index);if(!active||!initialized)return;}
  if(inspection?.active)closeInspection(false);
  if(!game.active){gamePreviousDay=world.dayMode;game.start(index,reduced);world.setLighting(false);syncLightButton();}
  tour.stop();keys.clear();drag=null;renderTour();renderGame();visit(index,true);
  if(!session)$('game-action').focus();
}
function syncLightButton(){if(!world)return;$('lighting').textContent=world.dayMode?'Свет: день':'Свет: вечер';$('lighting').setAttribute('aria-pressed',String(!world.dayMode));}
function stopGame(reopenGuide=true){
  if(!game.active)return;game.stop();world?.setLighting(gamePreviousDay);syncLightButton();renderGame();
  if(reopenGuide&&session)showVRGuide();
}
function gameTone(success,finale=false){
  if(!soundOn||!audioContext||!audioGain)return;
  const now=audioContext.currentTime,notes=finale?[261.63,329.63,392,523.25]:success?[523.25,783.99]:[174.61];
  notes.forEach((frequency,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain(),start=now+i*.11;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.6,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+.6);osc.connect(gain);gain.connect(audioGain);osc.start(start);osc.stop(start+.65);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
}
function runGameAction(action){
  if(action==='start'){void startGame(0);return;}
  if(!game.active||!active||contextLost||(!session&&document.hidden)||document.querySelector('dialog[open]')||session&&!canUseXR())return;
  if(action==='strike'){
    const event=game.strike();if(event){gameTone(event.type!=='miss');if(event.type!=='miss')effects?.trigger(event.index,event.type==='charged');}
  }else if(action==='next'){const next=game.next();if(next>=0)visit(next,true);}
  else if(action.startsWith('station:')){const id=Number(action.slice(8));if(game.phase!=='celebrating'&&Number.isInteger(id)&&id>=0&&id<4)visit(id,true);}
  else if(action==='assist'){if(game.phase==='playing')game.toggleAssist();}
  else if(action==='pause')game.togglePause();
  else if(action==='stop'){stopGame();return;}
  else if(action==='restart'){const assist=game.assist;game.start(0,assist);visit(0,true);}
  else if(action==='launch'&&game.launch()){
    visit(-1,true);if(session)vrGuide.hide();else setOrientation([0,4.65,-2]);effects?.trigger(0,true);gameTone(true,true);
  }
  renderGame();
}
function renderGame(){
  const view=game.view();vrGuide?.setGame(game.active?view:null);$('game-hud').hidden=!game.active;document.body.classList.toggle('game-running',game.active);
  if(!game.active){lastGameKey='';return;}
  $('game-needle').style.left=(view.position*100)+'%';$('game-meter').classList.toggle('in-zone',view.inZone);
  const key=view.revision+':'+(view.cooldown>0);if(key===lastGameKey)return;lastGameKey=key;
  const ending=['ready','celebrating','complete'].includes(view.phase),action=gameAction(view);
  $('game-hud').classList.toggle('celebrating',view.phase==='celebrating');
  $('game-title').textContent=view.paused?'Пауза':view.phase==='ready'?'Все системы готовы':view.phase==='celebrating'?'Атлас пробуждается':view.phase==='complete'?'Атлас запущен':view.station.name;
  $('game-count').textContent=view.charged+' / 4 СТАНЦИИ';$('game-score').textContent=String(view.score).padStart(4,'0');
  $('game-instruction').textContent=ending?'Четыре источника энергии. Единый Атлас будущего.':view.station.hint;
  $('game-feedback').textContent=view.paused?'Продолжите, когда будете готовы.':view.feedback;
  $('game-meter').hidden=ending||view.paused;$('game-locks').hidden=ending;
  $('game-zone').style.left=((view.target-view.width/2)*100)+'%';$('game-zone').style.width=(view.width*100)+'%';
  [...$('game-locks').children].forEach((item,i)=>item.classList.toggle('done',i<view.locks[view.index]));$('game-locks').setAttribute('aria-label','Принято импульсов: '+view.locks[view.index]+' из 3');
  document.querySelectorAll('[data-game-station]').forEach(button=>{const i=Number(button.dataset.gameStation);button.classList.toggle('current',i===view.index);button.classList.toggle('done',view.locks[i]===3);button.setAttribute('aria-pressed',String(i===view.index));button.textContent=(view.locks[i]===3?'✓ ':'')+String(i+1).padStart(2,'0');button.disabled=view.phase==='celebrating';});
  $('game-action').textContent=action.label;$('game-action').disabled=!!action.disabled;
  $('game-assist').textContent=view.assist?'Режим: спокойно':'Режим: точно';$('game-assist').setAttribute('aria-pressed',String(view.assist));$('game-assist').disabled=ending;
  $('game-pause').textContent=view.paused?'Продолжить':'Пауза';$('game-pause').setAttribute('aria-pressed',String(view.paused));$('game-pause').disabled=view.phase==='complete';
}
document.querySelectorAll('[data-game]').forEach(button=>button.onclick=()=>startGame());$('viewer-game').onclick=()=>startGame();
$('game-action').onclick=()=>runGameAction(gameAction(game.view()).action);$('game-close').onclick=()=>stopGame();$('game-assist').onclick=()=>runGameAction('assist');$('game-pause').onclick=()=>runGameAction('pause');
document.querySelectorAll('[data-game-station]').forEach(button=>button.onclick=()=>runGameAction('station:'+button.dataset.gameStation));

function applyQuality(){
  $('quality').value=quality;if(!renderer)return;
  renderer.shadowMap.enabled=quality==='detail'&&!session;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;lastShadow=-Infinity;
  if(quality==='smooth'||session)cinematic?.release();if(inspection)inspection.dirty=true;effects?.configure(quality,!!session);resize();
}
$('quality').value=quality;$('quality').onchange=()=>{quality=$('quality').value;applyQuality();};
$('open-settings').onclick=()=>openDialog($('settings-dialog'));
document.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>$(b.dataset.dismiss).close());

function updateMapPosition(){
  if(!rig)return;const point=floorPoint(rig.position.x,rig.position.z);const player=$('map-player');
  player.style.left=point.x+'%';player.style.top=point.y+'%';player.style.transform=`translate(-50%,-50%) rotate(${-yaw*180/Math.PI}deg)`;
}
function showMap(){
  if(!initialized)return;updateMapPosition();
  document.querySelectorAll('[data-map-stop]').forEach(b=>{const i=Number(b.dataset.mapStop);b.classList.toggle('current',selected===i);b.classList.toggle('visited',tour.visited.has(i));b.setAttribute('aria-current',selected===i?'location':'false');});
  openDialog($('map-dialog'));
}
EXHIBITS.forEach((exhibit,i)=>{
  const point=floorPoint(exhibit.position[0],exhibit.position[2]),pin=document.createElement('button'),item=document.createElement('button');
  pin.className='map-stop';pin.dataset.mapStop=i;pin.textContent=String(i+1).padStart(2,'0');pin.style.left=point.x+'%';pin.style.top=point.y+'%';pin.setAttribute('aria-label',exhibit.title);
  item.className='map-list-item';item.dataset.mapStop=i;
  const num=document.createElement('span'),label=document.createElement('span');num.className='map-number';num.textContent=String(i+1).padStart(2,'0');label.textContent=exhibit.title;item.append(num,label);
  for(const button of [pin,item])button.onclick=()=>{$('map-dialog').close();visit(i);};
  $('floor-plan').append(pin);$('map-list').append(item);
});
$('open-map').onclick=showMap;
for(const button of document.querySelectorAll('[data-move]')){
  const release=()=>{keys.delete(button.dataset.move);button.classList.remove('pressed');};
  button.addEventListener('pointerdown',event=>{if(!initialized||session)return;event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.move);button.classList.add('pressed');});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
  button.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();keys.add(button.dataset.move);}});button.addEventListener('keyup',release);button.addEventListener('blur',release);
}


function openInspection(index){
  if(!initialized||session||!inspection.open(index))return;
  clearTimeout(moveTimer);keys.clear();drag=null;inspectionPointers.clear();$('fade').classList.remove('visible');
  inspection.resize(viewport.clientWidth,viewport.clientHeight);inspection.reset();
  $('inspection-title').textContent=EXHIBITS[index].title;$('inspection-category').textContent=String(index+1).padStart(2,'0')+' / ДЕТАЛЬНЫЙ ОСМОТР';
  $('inspection-credit').textContent=index===0?'3D-скан: fractalnoise · CC BY-NC-SA 4.0':'Авторская учебная модель · Павильон МИК';
  $('inspection-ui').hidden=false;document.body.classList.add('inspection-active');$('close-inspection').focus();
}
function closeInspection(returnToObject=true){
  if(!inspection?.active)return;const index=inspection.index;inspection.close();inspectionPointers.clear();keys.clear();drag=null;
  $('inspection-ui').hidden=true;document.body.classList.remove('inspection-active');
  if(returnToObject){visit(index,true);$('inspect-exhibit').focus();}
}
function moveInspection(event){
  if(!inspectionPointers.has(event.pointerId))return;
  const values=[...inspectionPointers.values()],old=inspectionPointers.get(event.pointerId);
  const previousGap=values.length===2?Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y):0;
  inspectionPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(inspectionPointers.size===1)inspection.orbit(event.clientX-old.x,event.clientY-old.y);
  else if(inspectionPointers.size===2){const p=[...inspectionPointers.values()],gap=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(gap>0&&previousGap>0)inspection.zoom(previousGap/gap);}
}
$('inspect-exhibit').onclick=()=>openInspection(selected);
$('close-inspection').onclick=()=>closeInspection();
$('inspection-previous').onclick=()=>openInspection((inspection.index+EXHIBITS.length-1)%EXHIBITS.length);
$('inspection-next').onclick=()=>openInspection((inspection.index+1)%EXHIBITS.length);
$('inspection-reset').onclick=()=>inspection.reset();$('inspection-detail').onclick=()=>inspection.detail();
$('inspection-in').onclick=()=>inspection.zoom(.83);$('inspection-out').onclick=()=>inspection.zoom(1.2);
document.querySelectorAll('[data-inspect]').forEach(button=>button.onclick=async()=>{
  const index=Number(button.dataset.inspect);await enter(index);if(active&&initialized)openInspection(index);
});
$('save-inspection').onclick=async()=>{
  if(!inspection?.active)return;const button=$('save-inspection'),index=inspection.index;button.disabled=true;button.textContent='Сохраняем…';
  try{
    renderer.render(inspection.scene,inspection.camera);
    const source=renderer.domElement,canvas=document.createElement('canvas'),width=Math.max(800,Math.min(1800,source.width)),height=Math.round(source.height/source.width*width);
    canvas.width=width;canvas.height=height+180;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,width,height);ctx.fillStyle='#eee6d5';ctx.fillRect(0,height,width,180);
    ctx.fillStyle='#8f3929';ctx.font='bold 14px Arial';ctx.fillText('МИК / АТЛАС БУДУЩЕГО / ОБЪЕКТ '+String(index+1).padStart(2,'0'),30,height+30);
    ctx.fillStyle='#293227';ctx.font='bold 28px Arial';ctx.fillText(EXHIBITS[index].title,30,height+70,width-60);ctx.font='13px Arial';
    if(index===0){ctx.fillText('3D-скан: fractalnoise · Адаптация: бронза, оптимизация, постановка света.',30,height+100,width-60);ctx.fillText('Источник: printables.com/model/662942-bust-of-lenin-3d-scan',30,height+124,width-60);ctx.fillText('CC BY-NC-SA 4.0 · creativecommons.org/licenses/by-nc-sa/4.0/',30,height+148,width-60);}
    else {ctx.fillText('Авторская учебная модель · Виртуальный павильон колледжа МИК',30,height+106,width-60);ctx.fillText('step3dlab.github.io/vr_anapa/mik-atlas/',30,height+137,width-60);}
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Export unavailable');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='mik-atlas-object-'+String(index+1).padStart(2,'0')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Изображение подготовлено с подписью и источником модели.');
  }catch(error){console.error(error);toast('Не удалось сохранить изображение. Попробуйте ещё раз после завершения загрузки.');}
  finally{button.disabled=false;button.textContent='Сохранить вид ↓';}
};
