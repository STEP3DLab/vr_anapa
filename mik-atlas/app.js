import * as THREE from './vendor/three.module.min.js';
import {buildWorld,EXHIBITS,isWalkable} from './world.js?v=3.0';
import {installAtmosphere} from './atmosphere.js?v=3.0';
import {loadSculpture,installCollegeMark} from './sculpture.js?v=3.0';
import {createTour,floorPoint} from './tour.js?v=3.0';
import {consolidateArchitecture} from './optimize.js?v=3.0';

const $=id=>document.getElementById(id);
const experience=$('experience'),landing=$('landing'),viewport=$('viewport'),dialog=$('help-dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let world,renderer,camera,rig,active=false,selected=-1,yaw=0,pitch=0,initialized=false,xrSupported=false,session=null,sessionStarting=false;
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

function resize(){if(!renderer||!active)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
async function init(){
  world=buildWorld();consolidateArchitecture(world);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(1);
  viewport.appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(65,1,.08,70);camera.position.set(0,1.65,0);camera.rotation.order='YXZ';rig=new THREE.Group();rig.add(camera);world.scene.add(rig);
  const marker=new THREE.Mesh(new THREE.RingGeometry(.22,.28,36),new THREE.MeshBasicMaterial({color:'#ffce80',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;world.scene.add(marker);world.marker=marker;
  for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);rig.add(controller);
    const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:'#ffe6b7',transparent:true,opacity:.75}));ray.scale.z=10;controller.add(ray);controller.userData.line=ray;
    controller.addEventListener('select',()=>{
      const hit=teleportHits.get(controller);if(!hit)return;
      if(hit.type==='exhibit')visit(hit.id,true);else teleport(hit.point.x,hit.point.z);
    });controllers.push(controller);
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Графический контекст потерян. Перезагрузите страницу, чтобы восстановить экспозицию.');renderer.setAnimationLoop(null);});
  setupPointer();installAtmosphere(renderer,world);applyQuality();
  const resources=await Promise.allSettled([loadSculpture(world,progress=>{$('loading-detail').textContent=progress?'Загружаем скульптуру · '+Math.round(progress*100)+'%':'Загружаем скульптуру…';}),installCollegeMark(world)]);
  const failed=resources.find(result=>result.status==='rejected');if(failed)throw failed.reason;
  initialized=true;
}
function disposeFailedInit(){
  renderer?.setAnimationLoop(null);world?.environmentTarget?.dispose();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  world?.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
  renderer?.dispose();renderer?.domElement.remove();controllers.length=0;teleportHits.clear();world=null;renderer=null;initialized=false;
}
async function enter(id,guided=false){
  const token=++openToken;pendingEntry={id,guided};if(!active)returnFocus=document.activeElement;
  active=true;experience.hidden=false;landing.inert=true;landing.setAttribute('aria-hidden','true');document.body.classList.add('in-experience');
  $('loading').hidden=initialized;$('loading-actions').hidden=true;$('loading-title').textContent='ОТКРЫВАЕМ ПАВИЛЬОН';$('loading-detail').textContent='Настраиваем свет. Готовим экспонаты.';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(token!==openToken||!active)return;
  try{
    if(!initPromise)initPromise=init().catch(error=>{disposeFailedInit();initPromise=null;throw error;});
    await initPromise;if(token!==openToken||!active)return;
    if(guided)tour.start();else tour.stop();resize();visit(id,true);renderer.setAnimationLoop(frame);$('loading').hidden=true;$('exit-viewer').focus();
    if(matchMedia('(pointer: coarse)').matches)$('hint').textContent='Потяните экран — обзор · Стрелки слева — движение';
  }catch(error){
    if(token!==openToken||!active)return;
    console.error(error);$('loading-title').textContent='ПАВИЛЬОН НЕ ЗАГРУЗИЛСЯ';$('loading-detail').textContent='Проверьте соединение. Для просмотра нужен браузер с WebGL 2.';$('loading-actions').hidden=false;$('loading').hidden=false;
  }
}
$('retry-loading').onclick=()=>enter(pendingEntry.id,pendingEntry.guided);
$('cancel-loading').onclick=exit;
async function exit(){
  ++openToken;clearTimeout(moveTimer);keys.clear();drag=null;tour.stop();document.body.classList.remove('panel-expanded');document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  if(session){try{await session.end();}catch{}}
  active=false;renderer?.setAnimationLoop(null);experience.hidden=true;landing.inert=false;landing.removeAttribute('aria-hidden');document.body.classList.remove('in-experience');
  if(audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);
  soundOn=false;$('sound').textContent='Звук выкл.';$('sound').setAttribute('aria-pressed','false');returnFocus?.focus();
}
$('exit-viewer').onclick=exit;
function setOrientation(target){const v=new THREE.Vector3(...target).sub(new THREE.Vector3(rig.position.x,1.65,rig.position.z));yaw=Math.atan2(-v.x,-v.z);pitch=Math.atan2(v.y,Math.hypot(v.x,v.z));camera.rotation.set(pitch,yaw,0,'YXZ');}
function updatePanel(id){
  selected=id;tour.select(id);renderTour();document.querySelectorAll('[data-route]').forEach(b=>{const on=Number(b.dataset.route)===id;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('object-panel').hidden=id<0;
  if(id>=0){const e=EXHIBITS[id];$('object-category').textContent=e.category;$('object-title').textContent=e.title;$('object-description').textContent=e.description;$('object-fact').textContent=e.fact;$('object-source').hidden=id!==0;$('object-question').textContent=questions[id];setPanelExpanded(!matchMedia('(max-width:700px)').matches);}
  else document.body.classList.remove('panel-expanded');
}
function visit(id,immediate=false){
  if(!initialized||!world||!Number.isInteger(id)||id < -1||id>=EXHIBITS.length)return;
  clearTimeout(moveTimer);const e=EXHIBITS[id];const p=e?e.view:[0,0,11.7];const t=e?e.target:[0,2.1,-7];
  const perform=()=>{
    if(session){
      const head=renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3());rig.position.x+=p[0]-head.x;rig.position.z+=p[2]-head.z;rig.position.y=0;
    }else{rig.position.set(...p);rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);setOrientation(t);}
    updatePanel(id);$('fade').classList.remove('visible');
  };
  if(immediate||session||reduced)perform();else{$('fade').classList.add('visible');moveTimer=setTimeout(perform,130);}
}
function teleport(x,z){if(!isWalkable(x,z))return;const head=renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3());rig.position.x+=x-head.x;rig.position.z+=z-head.z;rig.position.y=0;}

function setupPointer(){
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(session)return;canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,distance:0};});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||session)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.0035;pitch=THREE.MathUtils.clamp(pitch-dy*.0035,-1.1,1.1);drag.x=e.clientX;drag.y=e.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');});
  canvas.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(drag.distance<9){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(world.interactive,true)[0];if(hit){const id=exhibitId(hit.object);if(id!==null)visit(id);}}
    drag=null;
  });canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('lostpointercapture',()=>drag=null);
}
function exhibitId(object){let o=object;while(o){if(Number.isInteger(o.userData.exhibit))return o.userData.exhibit;o=o.parent;}return null;}
window.addEventListener('keydown',e=>{
  if(!active||!initialized||document.querySelector('dialog[open]')||e.target.matches('input,textarea,select'))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(e.code==='KeyM'){e.preventDefault();showMap();return;}
  if(/^Digit[1-4]$/.test(e.code))visit(Number(e.code.slice(-1))-1);
  if(e.code==='Digit0')visit(-1);if(e.code==='Escape'&&!session)exit();
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();drag=null;});
document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden&&audioGain)audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);else if(soundOn&&audioGain)audioGain.gain.setTargetAtTime(.045,audioContext.currentTime,.3);});

function frame(time){
  const dt=Math.min((time-lastTime)/1000||0,.04);lastTime=time;
  if(!reduced){const t=time*.001;world.animated.forEach(a=>{if(a.kind==='orbit')a.group.rotation.z+=dt*a.speed;else if(a.kind==='sputnik')a.group.rotation.y=Math.sin(t*.17)*.18;else if(a.kind==='robot')a.group.rotation.y=Math.sin(t*.35)*.12;});}
  if(session){
    world.marker.visible=false;
    for(const controller of controllers){
      if(!controller.visible)continue;
      world.scene.updateMatrixWorld(true);matrix.identity().extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(matrix);
      const objectHit=raycaster.intersectObjects(world.interactive,true)[0];const floorHit=raycaster.intersectObject(world.floor)[0];
      if(objectHit&&(!floorHit||objectHit.distance<floorHit.distance)){teleportHits.set(controller,{type:'exhibit',id:exhibitId(objectHit.object)});controller.userData.line.scale.z=objectHit.distance;}
      else if(floorHit&&isWalkable(floorHit.point.x,floorHit.point.z)){teleportHits.set(controller,{type:'floor',point:floorHit.point});world.marker.position.copy(floorHit.point);world.marker.position.y=.04;world.marker.visible=true;controller.userData.line.scale.z=floorHit.distance;}
      else{teleportHits.delete(controller);controller.userData.line.scale.z=8;}
    }
    const right=[...session.inputSources].find(s=>s.handedness==='right'&&s.gamepad);
    const axis=right?.gamepad.axes[2]??right?.gamepad.axes[0]??0;
    if(Math.abs(axis)<.3)snapReady=true;
    if(snapReady&&Math.abs(axis)>.7){
      const before=renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3());rig.rotation.y-=Math.sign(axis)*Math.PI/6;rig.updateMatrixWorld(true);const after=renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3());rig.position.x+=before.x-after.x;rig.position.z+=before.z-after.z;snapReady=false;
    }
  }else{
    if(keys.has('ArrowLeft'))yaw+=dt*1.4;if(keys.has('ArrowRight'))yaw-=dt*1.4;if(keys.has('ArrowUp'))pitch=Math.min(1.1,pitch+dt);if(keys.has('ArrowDown'))pitch=Math.max(-1.1,pitch-dt);camera.rotation.set(pitch,yaw,0,'YXZ');
    const f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    if(f||s){const n=Math.hypot(f,s),speed=dt*2.8/n;const x=rig.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed,z=rig.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed;if(isWalkable(x,rig.position.z))rig.position.x=x;if(isWalkable(rig.position.x,z))rig.position.z=z;}
  }
  if($('map-dialog').open)updateMapPosition();
  renderer.render(world.scene,camera);
}

$('enter-vr').onclick=()=>{
  if(session){session.end().catch(()=>toast('Завершите VR через меню шлема.'));return;}
  if(!navigator.xr||!xrSupported){showHelp();return;}
  if(sessionStarting||!initialized)return;
  clearTimeout(moveTimer);keys.clear();drag=null;$('fade').classList.remove('visible');
  sessionStarting=true;
  // Request synchronously from the user gesture: no dynamic import or awaited check before this call.
  navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor']}).then(async xrSession=>{
    session=xrSession;
    session.addEventListener('end',()=>{session=null;sessionStarting=false;document.body.classList.remove('xr-active');applyQuality();rig.rotation.set(0,0,0);camera.position.set(0,1.65,0);world.marker.visible=false;teleportHits.clear();$('enter-vr').textContent='Войти в VR';visit(selected,true);resize();});
    rig.rotation.set(0,0,0);camera.rotation.set(0,0,0);camera.position.set(0,0,0);rig.position.set(0,0,11.7);
    renderer.shadowMap.enabled=false;await renderer.xr.setSession(session);document.body.classList.add('xr-active');$('enter-vr').textContent='Выйти из VR';sessionStarting=false;
  }).catch(async error=>{console.error(error);sessionStarting=false;if(session){try{await session.end();}catch{}session=null;}toast(error.name==='NotAllowedError'?'VR не запущен: доступ отклонён. Разрешите погружение в браузере шлема.':'Не удалось включить VR. Продолжайте просмотр в 3D или попробуйте браузер шлема.');});
};
$('sound').onclick=async()=>{
  try{
    if(!audioContext){const Audio=window.AudioContext||window.webkitAudioContext;audioContext=new Audio();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);
      for(const f of [55,82.41,110]){const o=audioContext.createOscillator();o.type='sine';o.frequency.value=f;const g=audioContext.createGain();g.gain.value=.28;o.connect(g);g.connect(audioGain);o.start();}}
    await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn ? 0.045 : 0,audioContext.currentTime,.3);$('sound').textContent=soundOn?'Звук вкл.':'Звук выкл.';$('sound').setAttribute('aria-pressed',String(soundOn));
  }catch{toast('Браузер не разрешил воспроизведение звука.');}
};

$('lighting').onclick=()=>{if(!world)return;world.setLighting(!world.dayMode);$('lighting').textContent=world.dayMode?'Свет: день':'Свет: вечер';$('lighting').setAttribute('aria-pressed',String(!world.dayMode));};
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
  document.body.classList.toggle('tour-running',tour.active);
}
function startTour(){
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

function applyQuality(){
  $('quality').value=quality;if(!renderer)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='smooth'?1:1.5));renderer.shadowMap.enabled=quality==='detail'&&!session;resize();
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
