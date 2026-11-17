import * as T from '../../../mobot-assets/three.module.min.js';
import {OrbitControls} from '../../../mobot-assets/controls/OrbitControls.js';
import {makeMobot1986} from '../../../mobot-ch-hv-1986-research-v6-model.js';

const $=id=>document.getElementById(id), viewport=$('viewport');
const buttons=selector=>[...document.querySelectorAll(selector)];
const pressed=(el,on)=>el.setAttribute('aria-pressed',String(on));
const modes={neutral:{},rear:{yaw:0,boom:2},front:{yaw:168,boom:12,grab:8},lift:{yaw:46,boom:20,loader:16,tip:18,grab:18}};
const labels={yaw:'Поворот стойки',boom:'Подъём стрелы',grab:'Раскрытие грейфера',loader:'Подъём погрузчика',tip:'Наклон ковша',track:'Прокрутка траков'};
function showTab(pose){
  $('partsPanel').hidden=pose;$('posePanel').hidden=!pose;
  pressed($('partsTab'),!pose);pressed($('poseTab'),pose);
}
$('partsTab').onclick=()=>showTab(false);$('poseTab').onclick=()=>showTab(true);

// Chromium can omit the compatibility click immediately after a canvas orbit.
// Handle a stationary single-finger tap once; leave scroll, pinch and keyboard native.
let touchButton=null;
document.addEventListener('touchstart',event=>{
  const button=event.target.closest('button');
  const finger=event.touches[0];
  touchButton=button&&!button.disabled&&event.touches.length===1?
    {button,id:finger.identifier,x:finger.clientX,y:finger.clientY}:null;
},{passive:true});
document.addEventListener('touchmove',event=>{
  if(!touchButton)return;
  const t=event.touches[0];
  if(event.touches.length!==1||Math.hypot(t.clientX-touchButton.x,t.clientY-touchButton.y)>8)touchButton=null;
},{passive:true});
document.addEventListener('touchcancel',()=>{touchButton=null;},{passive:true});
document.addEventListener('touchend',event=>{
  const tap=touchButton;touchButton=null;
  if(!tap||event.touches.length||!event.cancelable)return;
  const t=event.changedTouches[0],hit=document.elementFromPoint(t.clientX,t.clientY);
  if(t.identifier!==tap.id||!tap.button.contains(hit)||tap.button.disabled)return;
  event.preventDefault();
  tap.button.focus({preventScroll:true});tap.button.click();
},{passive:false});

function fallback(message){
  viewport.querySelector('canvas')?.remove();$('still').hidden=false;
  $('mode').textContent='Статический вид';$('hint').textContent=message;
  for(const el of buttons('.bench button,.bench select,.bench input,[data-archive]'))el.disabled=true;
}
async function start(){
  const response=await fetch(new URL('../../../mobot-ch-hv-1986-research-v6-passport.json',import.meta.url));
  if(!response.ok)throw Error('Паспорт недоступен');
  const passport=await response.json(),model=makeMobot1986(T),s=model.sections;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.setClearColor(0xe8ece5);renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.19;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','Интерактивная 3D-модель Мобот-Ч-ХВ');viewport.prepend(canvas);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-3,3,2,-2,.02,90);
  scene.add(model.root,new T.HemisphereLight(0xfffbeb,0x92a298,2.7));
  const sun=new T.DirectionalLight(0xfff4dd,3.1);sun.position.set(-3,6,4);
  sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);
  Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4});sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias=.009;sun.shadow.bias=-.00018;scene.add(sun);
  const fill=new T.DirectionalLight(0xe6efff,1.4);fill.position.set(3,3,-4);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshBasicMaterial({color:0xe2e7df}));ground.rotation.x=-Math.PI/2;ground.position.y=model.groundY-.009;scene.add(ground);
  const shadow=new T.Mesh(ground.geometry,new T.ShadowMaterial({opacity:.21}));
  shadow.rotation.copy(ground.rotation);shadow.position.copy(ground.position);shadow.position.y+=.001;shadow.receiveShadow=true;scene.add(shadow);
  const grid=new T.GridHelper(8,32,0xbac6b9,0xc3cfc2);grid.position.y=ground.position.y+.002;
  grid.material.transparent=true;grid.material.opacity=.32;grid.material.depthWrite=false;scene.add(grid);
  const controls=new OrbitControls(camera,canvas);controls.minZoom=.32;controls.maxZoom=7;
  controls.maxPolarAngle=Math.PI*.494;controls.enableDamping=false;
  const roots={
    tracks:[s['Открытая ходовая']],body:[s['Рама и округлый кожух']],mast:[model.mechanisms.turntable],
    boom:[model.mechanisms.boom],grab:[model.mechanisms.grab],loader:[model.mechanisms.loader],
    cameras:[s['Верхний цилиндрический корпус камеры'],s['Оборудование на конце у ковша']]
  };
  const owner=new Map(),anchors=new Map();
  for(const [key,nodes] of Object.entries(roots))for(const node of nodes)anchors.set(node,key);
  const materials=new Map(),tinted=new Map();
  model.root.traverse(o=>{
    if(!o.isMesh)return;
    let p=o;while(p&&!anchors.has(p))p=p.parent;
    if(!p)throw Error('Не определён узел '+o.name);
    owner.set(o,anchors.get(p));materials.set(o,o.material);o.castShadow=true;o.receiveShadow=true;
    if(!tinted.has(o.material)){
      const mat=o.material.clone();mat.color.lerp(new T.Color(0xd88d40),.78);mat.emissive.setHex(0x261006);tinted.set(o.material,mat);
    }
  });
  const offsets=[
    [s['Борт -1'],0,0,-.49],[s['Борт 1'],0,0,.49],[roots.body[0],0,.18,0],
    [roots.mast[0],0,.65,0],[roots.boom[0],-.36,.30,0],[roots.grab[0],-.27,-.40,0],
    [roots.loader[0],.61,.15,0],[roots.cameras[0],0,.30,.20],[roots.cameras[1],.16,.40,0]
  ].map(([node,x,y,z])=>({node,home:node.position.clone(),offset:new T.Vector3(x,y,z)}));
  const directions={three:[2.15,1.52,4.9],side:[0,.015,5],front:[5,.32,.01],top:[.001,5,.001]};
  let selected='all',isolated=false,exploded=false,view='three',pose={...model.defaults};
  const render=()=>renderer.render(scene,camera);
  controls.addEventListener('change',render);
  function visibleBounds(){
    const bounds=new T.Box3();model.root.updateMatrixWorld(true);
    for(const obj of owner.keys())if(obj.visible)bounds.expandByObject(obj,false);
    return bounds;
  }
  function frame(align=false){
    const b=visibleBounds(),center=b.getCenter(new T.Vector3());
    const d=align?new T.Vector3(...directions[view]):camera.position.clone().sub(controls.target);
    camera.position.copy(center).addScaledVector(d.normalize(),9);controls.target.copy(center);camera.lookAt(center);camera.updateMatrixWorld();
    const aspect=viewport.clientWidth/viewport.clientHeight;
    // Fit projected corners to the live viewport even when a single small node is isolated.
    let rx=0,ry=0;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
      const v=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      rx=Math.max(rx,Math.abs(v.x));ry=Math.max(ry,Math.abs(v.y));
    }
    const h=Math.max(ry,rx/aspect,.1)*(aspect<1.25?1.13:1.10);
    camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;camera.zoom=1;
    camera.updateProjectionMatrix();controls.update();render();
  }
  const resize=()=>{renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);frame(true);};
  const observer=new ResizeObserver(resize);observer.observe(viewport);
  function styleParts(){
    for(const [obj,key] of owner){
      obj.visible=!isolated||selected===key;
      obj.material=selected===key?tinted.get(materials.get(obj)):materials.get(obj);
    }
    const info=passport.nodes.find(n=>n.id===selected);
    $('partTitle').textContent=info?.title||'Компоновка машины';
    $('partText').textContent=info?'По снимку (B). '+info.B:'Гусеничная платформа несёт поворотную стрелу с грейфером. Погрузчик закреплён на шасси.';
    $('partUnknown').textContent=info?'Гипотеза (C). '+info.C:'Выберите узел в списке или нажмите на деталь модели.';
    $('partSource').href=info?'#'+info.figure:'#archive';
    $('partSource').textContent=info?'Основание · рис. '+passport.sources[info.figure].figure+' ↓':'Архивные ракурсы ↓';
    $('part').value=selected;$('isolate').disabled=selected==='all';
    pressed($('isolate'),isolated);$('isolate').textContent=isolated?'Показать всё':'Изолировать';
    document.querySelector('.stage-head h2').textContent=isolated?info.title:exploded?'Разнесённая сборка':'Модель в сборе';
    render();
  }
  function select(key){
    selected=key;if(key==='all')isolated=false;styleParts();if(isolated||key==='all')frame();
  }
  for(const n of passport.nodes)$('part').add(new Option(n.title,n.id));
  $('part').onchange=e=>select(e.target.value);
  $('isolate').onclick=()=>{isolated=!isolated;styleParts();frame();};
  function spread(value){
    exploded=value;for(const {node,home,offset} of offsets)node.position.copy(home).addScaledVector(offset,Number(value));
    model.root.updateMatrixWorld(true);pressed($('explode'),value);$('explode').textContent=value?'Собрать модель':'Разнести сборку';
    styleParts();frame();
  }
  $('explode').onclick=()=>spread(!exploded);
  function aim(key){view=key;buttons('[data-view]').forEach(b=>pressed(b,b.dataset.view===key));frame(true);}
  buttons('[data-view]').forEach(el=>el.onclick=()=>aim(el.dataset.view));
  controls.addEventListener('start',()=>buttons('[data-view]').forEach(b=>pressed(b,false)));
  $('home').onclick=()=>aim('three');
  function zoom(factor){camera.zoom=T.MathUtils.clamp(camera.zoom*factor,.32,7);camera.updateProjectionMatrix();render();}
  $('in').onclick=()=>zoom(1.25);$('out').onclick=()=>zoom(.8);
  let down=null;const ray=new T.Raycaster(),activeTouches=new Set();
  canvas.addEventListener('pointerdown',e=>{activeTouches.add(e.pointerId);down=activeTouches.size===1&&e.button===0?[e.clientX,e.clientY]:null;});
  canvas.addEventListener('pointercancel',e=>{activeTouches.delete(e.pointerId);down=null;});
  canvas.addEventListener('pointerup',e=>{
    activeTouches.delete(e.pointerId);
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5){down=null;return;}
    down=null;const rect=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.intersectObjects([...owner.keys()].filter(o=>o.visible),false)[0];
    if(hit){showTab(false);select(owner.get(hit.object));}
  });
  function setPose(p,preset){
    pose=model.setPose(p);$('preset').value=preset;
    for(const [key,val] of Object.entries(pose)){
      $('p-'+key).value=val;$('v-'+key).value=val+(key==='track'?' %':'°');
    }
    render();
  }
  for(const [key,label] of Object.entries(labels)){
    const row=document.createElement('label');row.className='slider';row.htmlFor='p-'+key;
    row.append(document.createTextNode(label));const output=document.createElement('output');output.id='v-'+key;row.append(output);
    const input=document.createElement('input');input.type='range';input.id='p-'+key;
    [input.min,input.max]=model.limits[key];input.step=1;input.value=0;row.append(input);$('sliders').append(row);
    input.oninput=()=>setPose({[key]:Number(input.value)},'custom');
  }
  function preset(key){setPose({...model.defaults,...modes[key]},key);frame();}
  $('preset').onchange=e=>preset(e.target.value);$('reset').onclick=()=>preset('neutral');
  buttons('[data-archive]').forEach(el=>el.onclick=()=>{
    isolated=false;selected='all';spread(false);preset(el.dataset.archive);showTab(true);aim(el.dataset.archive==='front'?'front':'three');
    $('bench').scrollIntoView({block:'start'});
  });
  $('still').hidden=true;$('mode').textContent='WebGL 2';resize();styleParts();setPose(model.defaults,'neutral');
  canvas.addEventListener('webglcontextlost',()=>{observer.disconnect();fallback('Потерян контекст WebGL. Для продолжения 3D-просмотра перезагрузите страницу.');});
  // Same live objects and camera as the visible page; exposed only for the regression suite.
  if(new URLSearchParams(location.search).has('qa'))window.mobotV6={model,renderer,scene,camera,controls,owner,materials,render,get state(){return {selected,isolated,exploded,view,pose:{...pose}};}};
}
start().catch(error=>{console.warn('Режим просмотра:',error.message);fallback('Интерактивный режим недоступен. Открыты контрольный снимок и архивные материалы.');});
