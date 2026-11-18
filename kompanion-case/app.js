import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { SoftwareRenderer } from './software-renderer.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let selected='pro-max', color='#899575', painted=false, reports={}, loaded, renderer, controls, scene, camera;
let view='back', animation, transition=null, sequence=0, toastTimer, autoRotate=false;
const group=new THREE.Group(), cache=new Map();
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const names={pro:'iPhone 18 Pro','pro-max':'iPhone 18 Pro Max'};
const format=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});

function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500)}
function selectButton(button, selector){$$(selector).forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))})}
function syncData(){
  const r=reports[selected];
  $('#download-stl').href=`downloads/kompanion-iphone-18-${selected}.stl`;
  $('#download-step').href=`downloads/kompanion-iphone-18-${selected}.step`;
  $('#download-fit').href=`downloads/fit-test-iphone-18-${selected}.stl`;
  if(!r)return;
  $('#phone-size').textContent='Телефон: '+r.phone_mm.map(format).join(' × ')+' мм';
  $('#stl-label').textContent=`STL · мм · ${format(r.stl_bytes/1e6)} МБ`;
  $('#weight').innerHTML=`≈ ${Math.round(r.estimated_tpu_g)} <small>г</small>`;
  $('#measure-height').textContent=format(r.case_mm[1])+' мм';$('#measure-width').textContent=format(r.case_mm[0])+' мм';
  $('#viewer').setAttribute('aria-label',`Интерактивная 3D-модель чехла для ${names[selected]} с гравировкой сиба-ину. Вращайте мышью или пальцем, приближайте колёсиком или двумя пальцами.`);
}

$$('[data-model]').forEach(b=>b.addEventListener('click',()=>{if(selected===b.dataset.model)return;selected=b.dataset.model;selectButton(b,'[data-model]');syncData();if(renderer)loadModel(selected)}));
$$('[data-color]').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;selectButton(b,'[data-color]');$('#color-name').textContent=b.dataset.name;updateMaterial();$('.fallback-case').style.background=color}));
$('#paint').addEventListener('change',e=>{painted=e.target.checked;updateMaterial()});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;selectButton(b,'[data-view]');setView(view)}));
$('#dimensions').addEventListener('click',()=>{const show=$('#measurements').hidden;$('#measurements').hidden=!show;$('#dimensions').setAttribute('aria-pressed',String(show));if(show&&view!=='back')toast('Габариты корпуса. Для сравнения выберите вид «Спинка».')});
$('#rotate').addEventListener('click',()=>{if(!controls)return;autoRotate=!autoRotate;controls.autoRotate=autoRotate;$('#rotate').setAttribute('aria-pressed',String(autoRotate));$('#rotate').setAttribute('aria-label',autoRotate?'Остановить автовращение':'Включить автовращение');transition=null});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#stage').requestFullscreen)await $('#stage').requestFullscreen();else toast('Разверните устройство горизонтально для большого просмотра.')}catch{toast('Полноэкранный режим недоступен. Используйте масштаб браузера.')}});
document.addEventListener('fullscreenchange',()=>{const full=!!document.fullscreenElement;$('#fullscreen').setAttribute('aria-label',full?'Выйти из полного экрана':'Развернуть 3D-просмотр')});
$$('a[download]').forEach(a=>a.addEventListener('click',()=>{const ext=a.getAttribute('href').split('.').pop().toUpperCase();toast(`Запрошен файл ${ext}${a.id==='download-stl'||a.id==='download-step'||a.id==='download-fit'?' · '+names[selected]:''}`)}));
fetch('assets/models.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{reports=data;syncData()}).catch(()=>{toast('Параметры не загрузились. Файлы модели доступны по кнопкам скачивания.')});

function updateMaterial(){
 if(!loaded)return;
 const bodyColor=new THREE.Color(color);
 loaded.traverse(o=>{if(!o.isMesh)return;const groove=o.name==='engraving'||o.material.name==='engraving';o.material.color.copy(bodyColor);if(groove)o.material.color.multiplyScalar(painted?.16:.72);o.material.roughness=groove?.92:.68;o.material.metalness=0;o.material.needsUpdate=true;});
}

async function loadModel(key){
 const n=++sequence;$('#loading').hidden=false;
 try{
  if(!cache.has(key))cache.set(key,new GLTFLoader().loadAsync(`assets/${key}${renderer.isSoftwareRenderer?'-lite':''}.glb`));
  const gltf=await cache.get(key);if(n!==sequence)return;
  if(loaded)group.remove(loaded);
  loaded=gltf.scene.clone(true);
  loaded.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.castShadow=true;o.receiveShadow=true;}});
  // CAD +Z points towards the screen; turn the outward-facing back towards the visitor.
  loaded.rotation.y=Math.PI;loaded.position.z=5.725;
  group.add(loaded);updateMaterial();setView(view,true);
  $('#loading').hidden=true;$('#fallback').hidden=true;
  document.documentElement.dataset.modelReady=key;
 }catch(err){
  console.error('Unable to load the model',err);$('#loading').hidden=true;
  if(!loaded)$('#fallback').hidden=false;
  toast('3D-модель не загрузилась. Файлы STL и STEP доступны для скачивания.');
 }
}

function setView(name, immediate=false){
 if(!camera)return;
 const presets={back:{p:[0,0,365],t:[0,0,0],r:[.10,-.30,-.12]},inside:{p:[0,0,-365],t:[0,0,0],r:[-.07,.17,-.10]},side:{p:[290,65,115],t:[0,0,0],r:[0,0,-.04]},detail:{p:[0,-20,175],t:[0,-18,0],r:[0,0,0]}};
 const dest=presets[name];
 controls.autoRotate=false;autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');$('#rotate').setAttribute('aria-label','Включить автовращение');
 const endpoint={p:new THREE.Vector3(...dest.p),t:new THREE.Vector3(...dest.t),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(...dest.r))};
 // Interpolate along an orbit, keeping the camera outside the case when flipping it.
 const targetSpherical=new THREE.Spherical().setFromVector3(endpoint.p.clone().sub(endpoint.t));
 const fromSpherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
 let dt=targetSpherical.theta-fromSpherical.theta;if(dt>Math.PI)targetSpherical.theta-=Math.PI*2;if(dt< -Math.PI)targetSpherical.theta+=Math.PI*2;
 if(immediate||reduced){camera.position.copy(endpoint.p);controls.target.copy(endpoint.t);group.quaternion.copy(endpoint.q);transition=null;controls.update();return}
 transition={start:performance.now(),fromSpherical,toSpherical:targetSpherical,fromT:controls.target.clone(),fromQ:group.quaternion.clone(),...endpoint};
}

function setup(){
 try{
  const host=$('#viewer');
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
  catch{renderer=new SoftwareRenderer();$('.stage-caption').textContent='3D · облегчённый просмотр';}
  if(!renderer.isSoftwareRenderer){renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D-просмотр чехла');
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#fallback').hidden=false;toast('3D-просмотр приостановлен. Обновите страницу, чтобы восстановить его.')});
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(32,1,1,2000);camera.position.set(0,0,365);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=110;controls.maxDistance=650;controls.autoRotateSpeed=1.1;controls.enablePan=true;
  controls.addEventListener('start',()=>{transition=null;$$('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')})});
  if(!renderer.isSoftwareRenderer){const env=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();}
  scene.add(new THREE.HemisphereLight(0xffffff,0x78816a,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(-100,150,210);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-140,right:140,top:180,bottom:-180,near:1,far:600});key.shadow.bias=-.0003;key.shadow.normalBias=.2;key.shadow.radius=5;scene.add(key);
  const fill=new THREE.DirectionalLight(0xf1e4d2,1.5);fill.position.set(120,-50,-80);scene.add(fill);
  scene.add(group);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.ShadowMaterial({color:0x59654a,opacity:.11}));plane.position.z=-23;plane.receiveShadow=true;scene.add(plane);
  const observer=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(width&&height){renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}});observer.observe(host);
  let last=performance.now();
  function frame(now){
    animation=requestAnimationFrame(frame);if(document.hidden)return;
    if(transition){const p=Math.min((now-transition.start)/700,1),e=p*p*(3-2*p),s=transition.fromSpherical.clone();s.radius=THREE.MathUtils.lerp(s.radius,transition.toSpherical.radius,e);s.phi=THREE.MathUtils.lerp(s.phi,transition.toSpherical.phi,e);s.theta=THREE.MathUtils.lerp(s.theta,transition.toSpherical.theta,e);controls.target.lerpVectors(transition.fromT,transition.t,e);camera.position.setFromSpherical(s).add(controls.target);group.quaternion.slerpQuaternions(transition.fromQ,transition.q,e);if(p===1)transition=null;}
    controls.update(Math.min((now-last)/1000,.1));last=now;renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);loadModel(selected);
 }catch(e){console.error('WebGL unavailable',e);$('#loading').hidden=true;$('#fallback').hidden=false;$$('[data-view],#rotate,#dimensions,#fullscreen').forEach(b=>b.disabled=true)}
}
setup();
