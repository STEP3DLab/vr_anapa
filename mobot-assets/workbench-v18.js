import * as T from './three.module.min.js';
import { OrbitControls } from './controls/OrbitControls.js';
// v18 uses a separate, uncalibrated single-photo track-fit candidate; the other mechanisms remain v16.
import { makeMobot } from '../mobot-engineering-v18-model.js';
import { auditViewerPose } from '../mobot-kinematics-v17.js';
import { makeRasterRenderer } from './orthographic-raster.js';

const $ = id => document.getElementById(id);
const sources = [
  {file:'stand', figure:7, name:'Работа с оснасткой на стенде', text:'На рис. 7 отрабатывается операция у имитатора трубы с отдельной оснасткой. Этот снимок нельзя автоматически считать заводским видом обычного двупалого схвата: внешний контур рабочей головки у модели остаётся гипотезой.', alt:'Александр Батанов у манипулятора на наземном стенде', target:[-.78,1.58,0], direction:[-.12,.60,5], height:1.95,width:2.40, pose:{yaw:0,arm:9,wrist:64,claw:2,bucket:0,tip:0}},
  {file:'demonstration', figure:5, name:'Демонстрация в МВТУ', text:'Фронтальный ракурс показывает взаимное положение гусениц и ширину рабочего оснащения. Нижнюю часть машины частично закрывает основание стенда.', alt:'Демонстрация Ч-ХВ-2 в помещении МВТУ, манипулятор поднят', target:[-.39,1.14,0], direction:[-6,1.15,-.65], height:2.95,width:2.8, pose:{yaw:8,arm:-4,wrist:65,claw:6,bucket:4,tip:-3}},
  {file:'pair', figure:6, name:'Два робота в Чернобыле', text:'На снимке двух машин различаются положения стрел и ковшей. Для сравнения выбран робот на переднем плане.', alt:'Два комплекса Ч-ХВ-2 на снегу', target:[0,1.0,0], direction:[3.6,1.62,5.4], height:2.65,width:4.65, pose:{yaw:172,arm:22,wrist:56,claw:6,bucket:38,tip:27}}
];
const assemblies = {
  all:{label:'Общий вид',target:[-.37,1.1,0],height:2.95,width:4.15},
  arm:{label:'Стрела и схват',target:[-.91,1.67,0],height:1.95,width:2.9,text:'На стендовом снимке различимы продольные элементы стрелы, открытая рама головки и широкие светлые детали у рабочего конца. Положение осей и ход привода приняты условно.'},
  bucket:{label:'Фронтальный погрузчик',target:[-.85,.51,0],height:1.75,width:2.8,text:'Два регулятора позволяют отдельно поднять раму и наклонить ковш. Его рабочая кромка и места крепления в модели имеют условные размеры.'},
  tracks:{label:'Гусеничная ходовая',target:[0,.46,0],height:1.5,width:2.65,text:'Перемещайте ленту, чтобы проследить путь траков. Число катков и расположение шарниров подвески требуют проверки по чертежу.'},
  body:{label:'Корпус и оборудование',target:[.17,.85,0],height:1.8,width:2.6,text:'На шасси размещены кожух оборудования и опора манипулятора. Очертания люков, крепёж и расположение камер реконструированы приблизительно.'}
};
const joints={
  yaw:{label:'Поворот опоры',min:-180,max:180,initial:0},
  arm:{label:'Наклон стрелы',min:-18,max:38,initial:0},
  wrist:{label:'Наклон схвата',min:-38,max:85,initial:63},
  claw:{label:'Раскрытие схвата',min:0,max:32,initial:8},
  bucket:{label:'Подъём рамы',min:-12,max:42,initial:0},
  tip:{label:'Наклон ковша',min:-38,max:38,initial:0},
  track:{label:'Ход ленты',min:0,max:100,initial:0}
};
const groups={all:['arm','claw','bucket'],arm:['yaw','arm','wrist','claw'],bucket:['bucket','tip'],tracks:['track'],body:[]};
const values=Object.fromEntries(Object.entries(joints).map(([id,j])=>[id,j.initial]));
const degrees=T.MathUtils.degToRad;
const fullPhoto=name=>'./mobot-assets/archive/'+name+'.jpg';
let mode='', assembly='all', sourceIndex=0, tool='gripper', previousPose;
let model, camera, controls, renderer, scene, canvas, raster=false, scheduled=false, width=0,height=0;
let fit=assemblies.all;

function fitFrame(){
  const aspect=width/height;
  const span=Math.max(fit.height, (fit.width??3.75)/aspect);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;
  camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
}
function draw(){
  scheduled=false;
  if(!width||!height) return;
  controls.update();
  camera.updateMatrixWorld();
  // Project a soft contact shadow onto the nominal crawler plane. Its
  // footprint follows the same orthographic camera in both renderers.
  const shadow=$('contact');
  const toScreen=point=>{
    point.project(camera);
    return [(point.x+1)*width/2,(1-point.y)*height/2];
  };
  const center=toScreen(new T.Vector3(-.08,.099,0));
  const x=toScreen(new T.Vector3(1.42,.099,0));
  const z=toScreen(new T.Vector3(-.08,.099,1.03));
  shadow.style.transform='matrix('+[(x[0]-center[0])/50,(x[1]-center[1])/50,
    (z[0]-center[0])/50,(z[1]-center[1])/50,center[0],center[1]].join(',')+') translate(-50%,-50%)';
  shadow.hidden=camera.position.y<.1;
  renderer.render(raster?model.root:scene,camera);
  $('load').hidden=true;
}
function invalidate(){
  if(!scheduled){scheduled=true;requestAnimationFrame(draw);}
}
function resize(){
  const bounds=$('surface').getBoundingClientRect();
  if(bounds.width<=0||bounds.height<=0) return;
  width=bounds.width;height=bounds.height;
  const ratio=raster?Math.min(devicePixelRatio,1200/width,920/height):Math.min(devicePixelRatio,2);
  const rw=Math.max(1,Math.round(width*ratio)), rh=Math.max(1,Math.round(height*ratio));
  if(raster) renderer.resize(rw,rh); else renderer.setSize(rw,rh,false);
  fitFrame();invalidate();
}
function setCamera(config,view='three'){
  fit=config;
  const directions={three:[-3.5,2.15,-6],side:[0,.015,-6],top:[0,6,-.001]};
  const direction=config.direction&&view==='photo'?config.direction:directions[view]||directions.three;
  controls.target.fromArray(config.target);
  camera.position.copy(controls.target).add(new T.Vector3(...direction).normalize().multiplyScalar(9));
  camera.zoom=1;fitFrame();controls.update();
  for(const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed',String(b.dataset.view===view));
  invalidate();
}
function zoom(factor){
  camera.zoom=T.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);
  camera.updateProjectionMatrix();invalidate();
}
function updateScreening(){
  const q=auditViewerPose(values.bucket,values.tip);
  const view=$('clearanceState');
  const bad=q.potentialGroundCrossing;
  view.classList.toggle('warn',bad);
  view.textContent=bad
    ? 'Внимание: модельная кромка попадает ниже условной плоскости гусениц. '
    : 'Модельная кромка выше условной плоскости гусениц. ';
  view.textContent+='Минимальный зазор: '+q.minClearanceScene.toFixed(3)+
    ' условных ед. · '+q.probeCount+' точек. Не расчёт реального контакта или эксплуатационных пределов.';
  view.dataset.warn=String(bad);
}
function applyPose(){
  const m=model.mechanisms;
  m.turntable.rotation.y=degrees(values.yaw);
  m.arm.rotation.z=degrees(values.arm);
  m.gripper.rotation.z=degrees(values.wrist);
  for(const finger of m.fingers) finger.group.rotation.z=-finger.side*degrees(values.claw);
  m.bucketLift.rotation.z=degrees(-values.bucket);m.bucketTilt.rotation.z=degrees(values.tip);
  m.updateLinkages();
  updateScreening();
  invalidate();
}
function showControls(){
  $('motions').replaceChildren();
  for(const id of groups[assembly]){
    const j=joints[id],div=document.createElement('div'),lab=document.createElement('label');
    const out=document.createElement('output'),range=document.createElement('input');
    div.className='motion';lab.htmlFor='joint-'+id;lab.textContent=j.label;
    range.id=lab.htmlFor;range.type='range';range.min=j.min;range.max=j.max;range.step=1;range.value=values[id];
    range.disabled=id==='claw'&&tool!=='gripper';
    const unit=id==='track'?'%':'°';
    out.value=values[id]+unit;out.setAttribute('for',range.id);
    range.addEventListener('input',()=>{
      values[id]=Number(range.value);out.value=values[id]+unit;
      if(id==='track'){model.mechanisms.setTrackPhase(values.track*.045);invalidate();}
      else applyPose();
    });
    lab.append(out);div.append(lab,range);$('motions').append(div);
  }
  $('dockControl').hidden=assembly!=='body';
  $('toolControl').hidden=!['all','arm','bucket'].includes(assembly);
  $('overview').hidden=assembly!=='all';$('detail').hidden=assembly==='all';
  $('detailText').textContent=assemblies[assembly].text||'';
}
function displayAssembly(){
  assembly=$('assembly').value;
  $('currentView').textContent=assemblies[assembly].label;
  $('partLabel').textContent=assemblies[assembly].label;$('partLabel').hidden=assembly==='all';
  showControls();setCamera(assemblies[assembly]);
}
function chooseSource(index){
  sourceIndex=index;const item=sources[index];
  $('photo').src=fullPhoto(item.file);$('photo').alt=item.alt;$('fullPhoto').href=fullPhoto(item.file);
  $('observation').textContent=item.text;$('figure').textContent='Рис. '+item.figure+' · '+item.name;
  $('sourceLink').href='https://storage.arsenal-otechestva.ru/article/2375-chernobylskaya-krysha';
  for(const [i,b] of [...$('archives').children].entries())b.setAttribute('aria-pressed',String(i===index));
  model.parts.dock.visible=false;model.mechanisms.setWorkTool('gripper');Object.assign(values,item.pose);applyPose();
  $('partLabel').hidden=true;$('currentView').textContent='Ракурс подобран приблизительно';
  setCamera(item,'photo');
}
function locationMode(){
  const key=location.hash.slice(1);
  const next=['archive','passport'].includes(key)?key:'model';
  if(mode===next)return;
  if(mode==='archive'&&previousPose){
    Object.assign(values,previousPose);model.parts.dock.visible=$('dock').checked;model.mechanisms.setWorkTool(tool);applyPose();
  }
  if(next==='archive')previousPose={...values};
  mode=next;
  for(const name of ['model','archive','passport'])$(name+'Panel').hidden=name!==mode;
  document.querySelector('.study').classList.toggle('compare',mode==='archive');
  $('comparison').hidden=mode!=='archive';
  for(const a of document.querySelectorAll('nav a')){
    if(a.hash==='#'+mode)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  }
  resize();
  if(mode==='archive')chooseSource(sourceIndex);else displayAssembly();
}
function setupRenderer(){
  canvas=document.createElement('canvas');
  let gl=null;
  try {
    gl=canvas.getContext('webgl2',{antialias:true,alpha:true,powerPreference:'high-performance'});
    if(gl) {

    renderer=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:true});
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    scene=new T.Scene();scene.add(model.root);
    scene.add(new T.HemisphereLight(0xffffff,0xa5aaa0,2.1));
    for(const [p,color,power] of [[[-4,7,-3],0xfff3d9,4.8],[[3,4,2],0xe7f2ff,3.5],[[-1,1,5],0xffffff,1.1]]){
      const light=new T.DirectionalLight(color,power);light.position.set(...p);scene.add(light);
    }
    // Broad reflected light panels give specular metals readable edges.
    const w=64,h=32,data=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const v=y>h*.58?56:(y>3&&y<15&&((x>5&&x<24)||(x>37&&x<47))?246:154);
      const i=(y*w+x)*4;data[i]=v;data[i+1]=v;data[i+2]=v;data[i+3]=255;
    }
    const env=new T.DataTexture(data,w,h);env.mapping=T.EquirectangularReflectionMapping;
    env.colorSpace=T.SRGBColorSpace;env.needsUpdate=true;scene.environment=env;
    }
  } catch(error) {
    console.warn('WebGL initialization unavailable, trying Canvas 2D',error);
    gl=null;
  }
  if(!gl) {
    // A canvas that has obtained a WebGL context cannot be reused for 2D.
    // Create a fresh element so a partial GL initialization can recover.
    raster=true;
    canvas=document.createElement('canvas');
    renderer=makeRasterRenderer(canvas);
  }
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Трёхмерная модель робота. Стрелки поворачивают, плюс и минус меняют масштаб.');
  $('surface').append(canvas);
}
function start(){
  model=makeMobot(T,innerWidth<760?'mobile':'desktop');
  model.parts.dock.visible=false;
  $('dock').addEventListener('change',()=>{model.parts.dock.visible=$('dock').checked;invalidate();});
  setupRenderer();
  camera=new T.OrthographicCamera(-2,2,1.5,-1.5,.05,60);
  controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=false;
  controls.minZoom=.55;controls.maxZoom=4;controls.rotateSpeed=.72;controls.addEventListener('change',invalidate);
  // When the user orbits freely, release the preset indicator.
  controls.addEventListener('start',()=>{
    for(const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed','false');
  });
  $('assembly').addEventListener('change',displayAssembly);
  $('tool').addEventListener('change',()=>{tool=$('tool').value;model.mechanisms.setWorkTool(tool);showControls();invalidate();});
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setCamera(fit,b.dataset.view));
  $('zoomOut').onclick=()=>zoom(1/1.22);$('zoomIn').onclick=()=>zoom(1.22);
  $('home').onclick=()=>{if(mode==='archive')chooseSource(sourceIndex);else{$('assembly').value='all';displayAssembly();}};
  canvas.addEventListener('keydown',e=>{
    const dir={ArrowLeft:[-.14,0],ArrowRight:[.14,0],ArrowUp:[0,-.10],ArrowDown:[0,.10]}[e.key];
    if(dir){
      const sphere=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      sphere.theta+=dir[0];sphere.phi+=dir[1];sphere.makeSafe();
      camera.position.setFromSpherical(sphere).add(controls.target);controls.update();invalidate();
      for(const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed','false');
    }else if(e.key==='+'||e.key==='=')zoom(1.15);else if(e.key==='-')zoom(1/1.15);else return;
    e.preventDefault();
  });
  for(const [i,s] of sources.entries()){
    const b=document.createElement('button'),img=document.createElement('img');
    b.className='archive-btn';img.src=fullPhoto(s.file);img.alt='';
    b.append(img,document.createTextNode(s.name));b.onclick=()=>chooseSource(i);$('archives').append(b);
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('surface'));
  else window.addEventListener('resize',resize);
  window.addEventListener('hashchange',locationMode);
  resize();applyPose();locationMode();
}
try{start();}
catch(error){
  console.error(error);$('load').innerHTML='Не удалось открыть 3D. <a href="./mobot-schematic-v15.html">Открыть кинематическую схему</a>';
}
