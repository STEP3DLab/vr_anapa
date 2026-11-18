import {initial,poses} from './poses.js';
import {inspectSurfaces} from './contact.js';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {OrbitControls} from '../../../../mobot-assets/controls/OrbitControls.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';

const $=id=>document.getElementById(id);
const photos=[
  [2,'1987-before-dispatch.jpg','Перед отправкой на ЧАЭС','Видны очертания кожуха, семь нижних дисков, поднятые крайние колёса и открытые пролёты стрелы.',0,'side'],
  [3,'1987-front.jpg','Схват на приёмо-сдаточных испытаниях','Широкие рабочие пластины расходятся в стороны от подвесной головки. Привод и глубина рамки остаются условными.',2,'side'],
  [4,'1987-snow-side.jpg','Испытания на снегу','Стрела повёрнута над кожухом. Снег закрывает нижний участок ленты, поэтому снимок не задаёт высоту контакта.',1,'side'],
  [9,'1987-breaker.jpg','Испытание отбойного молотка','Длинный узкий рабочий орган установлен на стреле. На этом снимке нельзя определить крепление молотка к погрузчику.',3,'three']
];
const joints={yaw:['Поворот опоры',-180,180],arm:['Подъём и опускание стрелы',-18,25],wrist:['Ориентация головки',55,115],claw:['Раскрытие схвата',0,24],bucket:['Подъём погрузчика',-8,36],tip:['Наклон оснастки',-25,25],track:['Ход гусениц',0,100]};
const notes={all:'Выберите узел в списке или нажмите на деталь модели.',tracks:'№2 и №4 · семь нижних дисков на видимом борту. Радиусы и зеркальное повторение борта — C.',body:'№2 и №4 · низкий кожух со скруглёнными плечами. Толщина и глубина оболочки — C.',turret:'№2 и №4 · открытая опора. Точные положения осей и устройство привода — C.',arm:'№2 и №4 · продольные элементы и наклонные связи. Сечения и схема скрытых связей — C.',gripper:'№2, №3 и №9 · съёмная головка, губки и установка молотка. Конструкция адаптера — C.',bucket:'№2 и №4 · открытый ковш и наружные рычаги. Крепление сменного молотка — C.',cameras:'№2–4 · наружные корпуса на опоре. Ориентация и крепления условны.',cable:'№2 и №4 · наружный вывод. Точная трасса и конструкция укладчика неизвестны.'};
const directions={three:[-3.1,1.65,-5.5],side:[0,0,-6],front:[-6,0,0],top:[.001,6,0]};
const V=(x,y,z)=>new T.Vector3(x,y,z);
let robot,renderer,camera,controls,scene,gl,ran=false,sceneMode='static',raf=0,chosen='normal',view='three',photo=0,values={...initial},audit,frames=0;
const originals=new Map(),ghosts=new Map(),offsets=[],markers=[], movingOffsets=new Set();
const surface=$('surface');
function pressed(selector,field,value){document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[field]===value)));}
function choosePhoto(index){
  photo=index;const [id,file,title,note]=photos[index],url='./mobot-assets/archive/'+file;
  $('photo').src=url;$('photo').alt=title;$('photoFile').href=url;$('photoTitle').textContent=title;$('photoNote').textContent=note;
  $('overlayImage').src=url;$('original').href='http://sktbpr.ru/sites/default/files/foto_album/'+id+'.jpg';
  pressed('[data-photo]','photo',String(index));
}
photos.forEach(([id],i)=>{const button=document.createElement('button');button.textContent='№'+id;button.dataset.photo=i;button.onclick=()=>choosePhoto(i);$('photoChoices').append(button);});
choosePhoto(0);
for(const [i,p] of poses.entries())$('pose').add(new Option(p[0],i));
function sliderText(key){return values[key]+(key==='track'?'%':'°');}
for(const [key,[name,min,max]] of Object.entries(joints)){
  const lab=document.createElement('label'),out=document.createElement('output'),input=document.createElement('input');
  lab.className='slider';input.type='range';input.id='joint-'+key;lab.htmlFor=input.id;input.min=min;input.max=max;input.step=1;
  out.id='out-'+key;lab.append(document.createTextNode(name),out,input);$('sliders').append(lab);
  input.oninput=()=>{values[key]=Number(input.value);out.value=sliderText(key);$('pose').selectedIndex=-1;$('poseLabel').textContent='Ручное положение';updateScene(key==='track');};
}
function requestDraw(){
  if(!ran||raf)return;
  raf=requestAnimationFrame(()=>{raf=0;if(!ran)return;controls.update();renderer.render(scene,camera);frames++;});
}
function resetEffects(){
  for(const [group,base] of offsets)group.position.copy(base);
  for(const [mesh,mat] of originals){mesh.material=mat;mesh.visible=true;}
}
function partId(mesh){return mesh.userData.part==='mechanics'?'body':mesh.userData.part;}
function applyEffects(){
  const part=$('part').value,spread=Number($('explode').value)/100;
  for(const [group,base,dir] of offsets)group.position.copy(base).addScaledVector(dir,spread);
  for(const [mesh,mat] of originals){
    const other=part!=='all'&&partId(mesh)!==part;
    mesh.visible=!(chosen==='isolate'&&other);
    mesh.material=chosen==='ghost'&&other?ghosts.get(mat):mat;
  }
  for(const item of markers)item.helper.visible=$('axes').checked&&(part==='all'||part===item.part||chosen!=='isolate');
  $('spreadOut').value=Math.round(spread*100)+'%';$('partInfo').textContent=notes[part];
  for(const b of document.querySelectorAll('[data-mode]'))b.disabled=b.dataset.mode!=='normal'&&part==='all';
  pressed('[data-mode]','mode',chosen);robot.root.updateMatrixWorld(true);
}
function updateScene(trackChanged=false){
  if(!ran)return;resetEffects();
  const {track,...rest}=values;
  robot.mechanisms.setPose(trackChanged?values:rest);
  for(const [node,base] of offsets)if(movingOffsets.has(node))base.copy(node.position);
  audit=robot.mechanisms.inspectPose();
  const messages=[];
  if(audit.alerts.length){
    const hood=robot.meshes.find(o=>o.name.startsWith('Кожух с плоской'));
    audit.detail=inspectSurfaces(robot.mechanisms,hood,$('tool').value,audit);
    const {ground,envelopes}=audit.detail;
    if(ground)messages.push('Ниже плоскости опоры: '+ground.mesh.split('/').at(-1)+'.');
    for(const e of envelopes){
      const part=e.group==='bucket'?'ковша':'кожуха';
      if(e.hits.length)messages.push('Подтверждён контакт поверхностей рабочего органа и '+part+'.');
      else if(e.unresolved.length)messages.push('Возможен контакт рабочего органа и '+part+'; зазор не установлен.');
    }
    if(!messages.length)messages.push('Габариты перекрываются. Проверка деталей подтверждает зазор.');
  }else messages.push('В проверенных парах деталей есть зазор. Рабочие органы выше опорной плоскости или касаются её.');
  if(+$('explode').value)messages.push('Проверена собранная машина.');
  $('warning').textContent=messages.join(' ');
  $('warning').classList.toggle('warn',!!audit.detail && (!!audit.detail.ground||audit.detail.envelopes.some(e=>e.hits.length||e.unresolved.length)));
  applyEffects();requestDraw();
}
function fitting(){
  const box=new T.Box3();
  robot.root.traverseVisible(o=>{
    if(o.isMesh && originals.has(o) && ($('part').value==='all'||partId(o)===$('part').value))
      box.union(new T.Box3().setFromObject(o));
  });
  if(box.isEmpty())box.setFromObject(robot.root);
  const center=box.getCenter(V()),d=V(...directions[view]).normalize();
  camera.up.set(0,1,0);if(view==='top')camera.up.set(-1,0,0);
  controls.target.copy(center);camera.position.copy(center).addScaledVector(d,7);camera.lookAt(center);camera.updateMatrixWorld();
  const w=surface.clientWidth,h=surface.clientHeight,aspect=w/h;
  let mx=0,my=0;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const p=camera.worldToLocal(V(x,y,z));mx=Math.max(mx,Math.abs(p.x));my=Math.max(my,Math.abs(p.y));
  }
  const half=Math.max(my/.76,mx/aspect/.87,.18);
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.zoom=1;camera.updateProjectionMatrix();
  controls.update();pressed('[data-view]','view',view);requestDraw();
}
function setView(v){view=v;fitting();}
function syncControls(){
  for(const key of Object.keys(joints)){$('joint-'+key).value=values[key];$('out-'+key).value=sliderText(key);}
  $('joint-claw').disabled=$('tool').value!=='gripper';
}
function selectPose(i){
  const [name,tool,data]=poses[i];values={...initial,...data};
  $('pose').value=i;$('poseLabel').textContent=name;$('tool').value=tool;robot.mechanisms.setWorkTool(tool);
  syncControls();updateScene(true);setView('three');
}
function reset(){
  chosen='normal';$('part').value='all';$('explode').value=0;$('axes').checked=false;$('overlay').checked=false;$('overlayImage').hidden=true;
  selectPose(0);
}
function fallback(reason){
  ran=false;sceneMode='static';if(raf)cancelAnimationFrame(raf);raf=0;
  surface.hidden=true;$('still').hidden=false;$('overlayImage').hidden=true;$('renderer').textContent='Статический кадр · v22';
  $('warning').textContent=reason+' Доступны контрольный кадр и четыре архивных снимка.';
  $('liveControls').disabled=true;$('overlay').disabled=$('match').disabled=true;
  for(const btn of document.querySelectorAll('.views button'))btn.disabled=true;
}
function start(){
  const canvas=document.createElement('canvas');
  gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true});
  if(!gl){fallback('WebGL 2 недоступен.');return;}
  scene=new T.Scene();robot=makeMobot(T,innerWidth<680?'mobile':'desktop');scene.add(robot.root);
  renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<680?1.4:1.7));renderer.setClearColor(0,0);
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
  scene.add(new T.HemisphereLight(0xfffdf1,0x9aa797,2.8));
  for(const [a,p] of [[[2,6,-4],3.0],[[-3,3,4],2.0]]){const light=new T.DirectionalLight(0xffffff,p);light.position.set(...a);scene.add(light);}
  canvas.tabIndex=0;canvas.setAttribute('aria-label','Трёхмерная сборка 1987 года. Стрелки вращают модель, плюс и минус меняют масштаб.');
  surface.append(canvas);
  camera=new T.OrthographicCamera(-3,3,2,-2,.01,40);
  controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.minZoom=.45;controls.maxZoom=5;
  controls.addEventListener('change',requestDraw);
  for(const mesh of robot.meshes){
    originals.set(mesh,mesh.material);
    if(!ghosts.has(mesh.material)){const ghost=mesh.material.clone();ghost.transparent=true;ghost.opacity=.13;ghost.depthWrite=false;ghosts.set(mesh.material,ghost);}
  }
  const m=robot.mechanisms,p=robot.parts;
  const spread=(group,x,y,z)=>offsets.push([group,group.position.clone(),V(x,y,z)]);
  p.tracks.children.forEach(g=>spread(g,0,-.22,Math.sign(g.position.z)*.32));
  spread(m.turntable,0,.62,0);spread(p.cameras,0,.13,.14);spread(m.gripper,-.23,.10,0);
  spread(p.bucket,-.43,0,0);spread(p.cable,.37,.05,0);
  // Each half of a loader actuator belongs to the same displaced assembly in exploded view.
  for(const {o} of [...m.loaderHousings,...m.loaderScrews])spread(o,-.43,0,0);
  // Actuator mesh positions vary with the pose; save their live positions before visual displacement.
  for(const {o} of [...m.loaderHousings,...m.loaderScrews])movingOffsets.add(o);
  for(const [node,part,axis] of [[m.turntable,'turret','y'],[m.arm,'arm','z'],[m.gripper,'gripper','z'],[m.bucketLift,'bucket','z'],[m.bucketTilt,'bucket','z']]){
    const pts=axis==='z'?[V(0,0,-.28),V(0,0,.28)]:[V(0,.7,0),V(0,1.6,0)];
    const helper=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xc15b1d,depthTest:false}));
    helper.renderOrder=10;node.add(helper);markers.push({helper,part});
  }
  ran=true;sceneMode='webgl2';$('liveControls').disabled=false;$('overlay').disabled=$('match').disabled=false;
  $('still').hidden=true;$('renderer').textContent='WebGL 2 · условный масштаб';
  renderer.setSize(surface.clientWidth,surface.clientHeight,false);reset();
  new ResizeObserver(()=>{if(ran){renderer.setSize(surface.clientWidth,surface.clientHeight,false);fitting();}}).observe(surface);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('Графический контекст потерян.');});
  let down=null;
  canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  canvas.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
    const b=canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
    const visible=[];robot.root.traverseVisible(o=>{if(originals.has(o))visible.push(o);});
    const hits=ray.intersectObjects(visible,false);
    if(hits.length){$('part').value=partId(hits[0].object);updateScene();}
  });
  canvas.onkeydown=e=>{
    if(['+','=','-'].includes(e.key)){zoom(e.key==='-'?.83:1.2);}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      const s=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(e.key==='ArrowLeft'||e.key==='ArrowRight')s.theta+=e.key==='ArrowLeft'?-.13:.13;
      else s.phi+=e.key==='ArrowUp'?-.10:.10;
      s.makeSafe();camera.position.setFromSpherical(s).add(controls.target);controls.update();requestDraw();
    }else return;e.preventDefault();
  };
}
function zoom(factor){camera.zoom=T.MathUtils.clamp(camera.zoom*factor,.45,5);camera.updateProjectionMatrix();requestDraw();}
$('pose').onchange=()=>selectPose(+$('pose').value);
$('tool').onchange=()=>{const t=$('tool').value;selectPose(t==='gripper'?0:t==='breaker-arm'?3:4);};
$('part').onchange=()=>{if($('part').value==='all')chosen='normal';updateScene();fitting();};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{chosen=b.dataset.mode;updateScene();fitting();};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
$('explode').oninput=()=>{updateScene();fitting();};$('axes').onchange=()=>updateScene();
$('reset').onclick=reset;$('in').onclick=()=>zoom(1.2);$('out').onclick=()=>zoom(1/1.2);$('home').onclick=()=>setView('three');
$('match').onclick=()=>{reset();selectPose(photos[photo][4]);setView(photos[photo][5]);$('stage').scrollIntoView({block:'start'});};
$('overlay').onchange=()=>{$('overlayImage').hidden=!$('overlay').checked;if($('overlay').checked)$('stage').scrollIntoView({block:'start'});};
function presentation(on){document.body.classList.toggle('present',on);$('present').setAttribute('aria-pressed',String(on));$('present').textContent=on?'Выйти из показа':'На весь экран';}
$('present').onclick=()=>presentation(!document.body.classList.contains('present'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')presentation(false);});
try{start();}catch(e){console.error(e);fallback('Ошибка инициализации 3D.');}
window.mobot22={model:()=>robot,status:()=>({mode:sceneMode,frames,draws:renderer?.info.render.calls??0,triangles:renderer?.info.render.triangles??0,webgl:gl?.getParameter(gl.VERSION),values:{...values},tool:$('tool').value,view,zoom:camera?.zoom,audit})};
