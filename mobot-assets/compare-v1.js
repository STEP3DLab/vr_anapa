import * as T from './three.module.min.js';
import {OrbitControls} from './controls/OrbitControls.js';
import {makeMobot1986} from '../mobot-ch-hv-1986-research-v5-model.js';
import {makeMobot} from '../mobot-engineering-v20-model.js';

// 1986 v5 / 1987 v20: two separate research scenes; coordinates are NOT measured metres.
const $=id=>document.getElementById(id);
const DEG=T.MathUtils.degToRad;
const directions={three:[3.1,1.65,5.5],side:[0,.015,6],front:[6,.015,0],top:[.001,6,0]};
const partNames={
 '86':{
  tracks:{group:'Открытая ходовая',note:'На рис. 6 различимы семь нижних круговых элементов и открытый борт (B). Оси, радиусы и траки — модельные гипотезы (C).'},
  body:{group:'Рама и округлый кожух',note:'Округлый наружный кожух показан по рисункам 6 и 9 (B). Внутренняя компоновка не подтверждена (C).'},
  mast:{group:'Высокая решётчатая стойка',note:'Высокая опора различима на архивных изображениях (B); сечения и скрытые связи условные (C).'},
  arm:{group:'Решётчатая стрела',note:'Двухплоскостная решётчатая стрела видна на рис. 6 и 9 (B). Оси и углы поворота модели не являются заводскими значениями (C).'},
  gripper:{group:'Подвес и грейфер',note:'Назначение грейфера подтверждено описанием (A), наружные челюсти и подвес видны на рисунках (B). Кинематика условная (C).'},
  bucket:{group:'Фронтальный погрузчик',note:'Погрузчик и его наружные рычаги видны на рис. 6 (B), назначение описано в документах (A). Передача усилий не восстановлена (C).'}
 },
 '87':{
  tracks:{group:'tracks',note:'Открытая ходовая и низкая верхняя ветвь различимы на снимках СКТБ № 2 и 4 (B). Радиусы и схема подвески гипотетические (C).'},
  body:{group:'body',note:'Контур корпуса уточнён по оригинальным снимкам СКТБ (B). Скрытая компоновка и размеры остаются неподтверждёнными (C).'},
  turret:{group:'turret',note:'Поворотная опора видна на фотографиях (B); точная ось, передача и допустимые углы неизвестны (C).'},
  arm:{group:'arm',note:'Силуэт высокой рамы и стрелы уточнён по двум ракурсам (B). Шарниры и кинематика показаны условно (C).'},
  gripper:{group:'gripper',note:'Сменный двупалый схват подтверждён описанием СКТБ (A), пластинчатые губки видны на снимках (B). Скрытые тяги условны (C).'},
  bucket:{group:'bucket',note:'Фронтальный погрузчик и сменный молоток описаны разработчиками (A). Точные крепления и геометрия не измерены (C).'},
  cameras:{group:'cameras',note:'Цилиндрические корпуса телекамер различимы на оригинальных кадрах (B); расположение кронштейнов условно (C).'}
 }
};
const viewers={};
let inSync=false,viewAngle='three',renderPending=false,renderCounter=0;
const names={'86':'Мобот-Ч-ХВ','87':'Мобот-Ч-ХВ-2'};
function visibleBounds(object){
 const box=new T.Box3();object.updateMatrixWorld(true);
 object.traverseVisible(item=>{if(item.isMesh)box.expandByObject(item)});
 return box;
}
function selectedObject(v,key){
 if(key==='all')return v.model.root;
 const item=partNames[v.year][key];
 if(!item)return v.model.root;
 return v.year==='86'?v.model.sections[item.group]||v.model.root:v.model.parts[item.group]||v.model.root;
}
function boundsFor(v){
 const object=selectedObject(v,$('node'+v.year).value);
 const b=visibleBounds(object);
 if(b.isEmpty())return visibleBounds(v.model.root);
 return b;
}
function layoutCamera(v){
 if(!v.camera)return;
 const width=v.host.clientWidth,height=v.host.clientHeight;
 if(width<1||height<1)return;
 v.renderer.setSize(width,height,false);
 const box=boundsFor(v), size=box.getSize(new T.Vector3());
 const ratio=width/height;
 const span=Math.max(size.y*1.3,size.x/ratio*1.25,size.z/ratio*1.25,1.25);
 v.camera.left=-span*ratio/2;v.camera.right=span*ratio/2;
 v.camera.top=span/2;v.camera.bottom=-span/2;v.camera.updateProjectionMatrix();
 v.sceneBounds=box;
 queueRender();
}
function queueRender(){
 if(renderPending)return;
 renderPending=true;
 requestAnimationFrame(()=>{
  renderPending=false;
  for(const v of Object.values(viewers)){
   if(!v.renderer||!v.gl)continue;
   v.renderer.render(v.scene,v.camera);
   v.draws++;renderCounter++;
  }
 });
}
function setCameraDirection(v,dir,resetZoom=true){
 if(!v.camera)return;
 const box=boundsFor(v),target=box.getCenter(new T.Vector3());
 v.controls.target.copy(target);
 v.camera.position.copy(target).add(new T.Vector3(...dir).normalize().multiplyScalar(9));
 if(resetZoom)v.camera.zoom=1;
 layoutCamera(v);v.controls.update();queueRender();
}
function setAngle(angle){
 viewAngle=angle;
 const dir=directions[angle]||directions.three;
 inSync=true;
 for(const v of Object.values(viewers))setCameraDirection(v,dir);
 inSync=false;
 document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle===angle)));
 queueRender();
}
function alignPartner(source){
 if(inSync||!$('sync').checked||!source.camera)return;
 inSync=true;
 const dir=source.camera.position.clone().sub(source.controls.target).normalize();
 for(const other of Object.values(viewers)){
  if(other===source||!other.camera)continue;
  const target=other.controls.target;
  other.camera.position.copy(target).addScaledVector(dir,9);
  other.camera.zoom=source.camera.zoom;other.camera.updateProjectionMatrix();
  other.controls.update();
 }
 inSync=false;queueRender();
}
function setInfo(v){
 const key=$('node'+v.year).value,info=partNames[v.year][key];
 $('note'+v.year).textContent=info?info.note:'Показана конструкция в сборе. Выберите узел или коснитесь детали модели.';
 if(!v.model)return;
 if(v.outline){v.scene.remove(v.outline);v.outline.geometry.dispose();v.outline.material.dispose();v.outline=null;}
 if(info){
  const box=boundsFor(v);
  if(!box.isEmpty()){
   v.outline=new T.Box3Helper(box,0x99582e);
   v.outline.name='Рамка выбранного узла — интерфейс, не часть исторической машины';
   v.scene.add(v.outline);
  }
 }
 queueRender();
}
function pose1987(){
 const v=viewers['87'];if(!v?.model)return;
 const key=$('pose87').value, m=v.model.mechanisms;
 const p=key==='snow'?{yaw:180,arm:8,wrist:90,claw:8,bucket:0,tip:0}:
 key==='loader'?{yaw:0,arm:-8,wrist:90,claw:4,bucket:28,tip:-10}:
 {yaw:0,arm:0,wrist:90,claw:4,bucket:12,tip:0};
 m.turntable.rotation.y=DEG(p.yaw);m.arm.rotation.z=DEG(p.arm);
 m.gripper.rotation.z=DEG(p.wrist-p.arm);
 for(const f of m.fingers)f.group.rotation.z=-f.side*DEG(p.claw);
 m.bucketLift.rotation.z=-DEG(p.bucket);m.bucketTilt.rotation.z=DEG(p.tip);
 m.setWorkTool($('tool87').value);m.updateLinkages();
 v.model.root.updateMatrixWorld(true);setInfo(v);queueRender();
}
function pose1986(){
 const v=viewers['86'];if(!v?.model)return;
 const key=$('pose86').value;
 const pose=key==='raised'?{yaw:180,boom:-30,loader:5,tip:0,grab:3,track:0}:
 key==='loader'?{yaw:0,boom:-18,loader:18,tip:-8,grab:8,track:0}:
 {...v.model.defaults};
 v.model.setPose(pose);setInfo(v);queueRender();
}
function selectFromPick(v,e){
 if(!v.model)return;
 const rect=v.canvas.getBoundingClientRect();
 const pointer=new T.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
 const ray=new T.Raycaster();ray.setFromCamera(pointer,v.camera);
 const hits=ray.intersectObject(v.model.root,true);
 const select=$('node'+v.year);
 for(const hit of hits){
  let o=hit.object;
  while(o&&o!==v.model.root){
   let key=null;
   if(v.year==='86'){
    key=Object.keys(partNames['86']).find(k=>partNames['86'][k].group===o.name);
   }else{
    const id=o.userData?.part;
    if(id&&partNames['87'][id])key=id;
   }
   if(key&&[...select.options].some(opt=>opt.value===key)){
    select.value=key;setInfo(v);return;
   }
   o=o.parent;
  }
 }
}
function activateFallback(v,reason){
 $('fallback'+v.year).hidden=false;
 $('status'+v.year).textContent=reason+' · показан резервный рендер';
 ['pose'+v.year,'node'+v.year,'focus'+v.year].forEach(id=>$(id).disabled=true);
 if(v.year==='87')$('tool87').disabled=true;
 if(v.renderer){v.renderer.dispose();v.renderer=null;}
 if(v.canvas){v.canvas.remove();v.canvas=null;}
 v.gl=null;
}
function initViewer(year){
 const v={year,host:$('canvas'+year),canvas:null,model:null,scene:null,camera:null,controls:null,renderer:null,gl:null,outline:null,draws:0};
 viewers[year]=v;
 try{
  const canvas=document.createElement('canvas');
  canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Вращаемая 3D-модель '+names[year]+'. Клавиши со стрелками изменяют ракурс.');
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:true});
  if(!gl){activateFallback(v,'WebGL 2 недоступен');return;}
  v.canvas=canvas;v.gl=gl;
  v.model=year==='86'?makeMobot1986(T):makeMobot(T,innerWidth<720?'mobile':'desktop');
  if(year==='87'&&v.model.parts.dock)v.model.parts.dock.visible=false;
  v.scene=new T.Scene();v.scene.add(v.model.root);
  v.scene.add(new T.HemisphereLight(0xffffff,0x93a6a0,2.55));
  for(const [position,power] of [[[3,8,5],3.1],[[-4,3,-2],2.1]]){
   const light=new T.DirectionalLight(0xffffff,power);
   light.position.set(...position);v.scene.add(light);
  }
  v.renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});
  v.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  v.renderer.setClearColor(0x000000,0);
  v.renderer.outputColorSpace=T.SRGBColorSpace;
  v.renderer.toneMapping=T.ACESFilmicToneMapping;
  v.renderer.toneMappingExposure=1.08;
  v.camera=new T.OrthographicCamera(-3,3,2,-2,.01,100);
  v.controls=new OrbitControls(v.camera,canvas);
  v.controls.enablePan=false;v.controls.enableDamping=false;
  v.controls.minZoom=.5;v.controls.maxZoom=4;
  v.controls.addEventListener('change',()=>{alignPartner(v);queueRender();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();activateFallback(v,'Контекст WebGL утрачен');});
  let pointerDown=null;
  canvas.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY,id:e.pointerId};});
  canvas.addEventListener('pointerup',e=>{
   if(pointerDown&&pointerDown.id===e.pointerId&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<7)selectFromPick(v,e);
   pointerDown=null;
  });
  canvas.addEventListener('keydown',e=>{
   const delta={ArrowLeft:[-.14,0],ArrowRight:[.14,0],ArrowUp:[0,-.10],ArrowDown:[0,.10]}[e.key];
   if(!delta)return;
   const spherical=new T.Spherical().setFromVector3(v.camera.position.clone().sub(v.controls.target));
   spherical.theta+=delta[0];spherical.phi+=delta[1];spherical.makeSafe();
   v.camera.position.setFromSpherical(spherical).add(v.controls.target);
   v.controls.update();e.preventDefault();
  });
  v.host.appendChild(canvas);
  const observer=new ResizeObserver(()=>layoutCamera(v));observer.observe(v.host);
  $('status'+year).textContent='WebGL 2 · перетащите или коснитесь для вращения';
 }catch(e){
  console.error('Compare viewer '+year+':',e);
  activateFallback(v,'Не удалось загрузить 3D');
 }
}
function focusNode(year){
 const v=viewers[year];if(!v?.camera)return;
 const direction=v.camera.position.clone().sub(v.controls.target).normalize().toArray();
 setCameraDirection(v,direction);
 alignPartner(v);
}
function zoomBoth(factor){
 inSync=true;
 for(const v of Object.values(viewers)){
  if(!v.camera)continue;
  v.camera.zoom=T.MathUtils.clamp(v.camera.zoom*factor,.5,4);
  v.camera.updateProjectionMatrix();v.controls.update();
 }
 inSync=false;queueRender();
}
function resetAll(){
 $('pose86').value='neutral';$('pose87').value='neutral';$('tool87').value='gripper';
 $('node86').value='all';$('node87').value='all';
 pose1986();pose1987();setAngle('three');
}
function updateSyncStatus(){
 $('syncStatus').textContent=$('sync').checked?'Синхронизация включена · масштаб каждой сцены подогнан отдельно':'Независимое вращение включено';
 if($('sync').checked&&viewers['86']?.camera)alignPartner(viewers['86']);
}
document.querySelectorAll('[data-angle]').forEach(b=>b.addEventListener('click',()=>setAngle(b.dataset.angle)));
$('zoomIn').addEventListener('click',()=>zoomBoth(1.18));
$('zoomOut').addEventListener('click',()=>zoomBoth(1/1.18));
$('reset').addEventListener('click',resetAll);
$('sync').addEventListener('change',updateSyncStatus);
$('pose86').addEventListener('change',pose1986);$('pose87').addEventListener('change',pose1987);
$('tool87').addEventListener('change',pose1987);
for(const year of ['86','87']){
 $('node'+year).addEventListener('change',()=>setInfo(viewers[year]));
 $('focus'+year).addEventListener('click',()=>focusNode(year));
}
initViewer('86');initViewer('87');resetAll();
window.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRender();});
window.__mobotCompareQA={
 getState:()=>({
  ready:true,sync:$('sync').checked,angle:viewAngle,renderCounter,
  models:Object.fromEntries(Object.values(viewers).map(v=>[v.year,{
   version:v.year==='86'?'1986-v5':'1987-v20',
   mode:v.gl?'webgl2':'static',draws:v.draws,
   pose:$('pose'+v.year).value,node:$('node'+v.year).value,
   tool:v.year==='87'?$('tool87').value:null,
   camera:v.camera?.position.toArray()||null,zoom:v.camera?.zoom||null,
   direction:v.camera?v.camera.position.clone().sub(v.controls.target).normalize().toArray():null,
   triangles:v.renderer?.info.render.triangles||0
  }]))
 }),
 refresh:queueRender
};
queueRender();
