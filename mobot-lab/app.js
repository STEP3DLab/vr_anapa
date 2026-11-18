import * as T from './engine/three.module.min.js';
import {insertIcons,icon} from './icons.js';
import {machines} from './catalog.js';
import {createViewer} from './viewer.js';

insertIcons();
const $=id=>document.getElementById(id);
const all=sel=>[...document.querySelectorAll(sel)];
const press=(b,yes)=>b.setAttribute('aria-pressed',String(yes));
const url=new URL(location.href);
const cache=new Map(), saved=new Map();
let year=Number(url.searchParams.get('model'))===1987?1987:1986;
let model,def,pose,tool='gripper',joint=0,viewer,demoId=0,demoStart=0,lastStep=0,demoBase={},demoDest={},viewReady=false;
const dialog=$('dialog');
function tell(s){$('status').textContent=s}
function openDialog(kind,body,label){
  $('dialogKind').textContent=kind;$('dialogBody').innerHTML=body;dialog.setAttribute('aria-label',label||kind);
  if(!dialog.open)dialog.showModal();
}
$('closeDialog').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
function setTool(value){
  if(year!==1987)return;
  tool=value;$('tool').value=value;model?.mechanisms.setWorkTool(value);
  const claw=$('j-claw');if(claw)claw.disabled=tool!=='gripper'||!viewer;
  tell(value==='breaker-loader'?'* Крепление молотка к погрузчику показано условно.':'');
}
function chooseTool(value){stopDemo();setTool(value);viewer?.draw()}
function sync(){
  for(const [key,,min,max] of def.joints){
    const input=$('j-'+key);if(!input)continue;
    const v=Math.round(pose[key]),unit=key==='track'?'%':'°';
    input.value=String(v);input.style.setProperty('--pct',((v-min)/(max-min)*100)+'%');
    $('o-'+key).value=v+unit;input.setAttribute('aria-valuetext',v+unit);
  }
}
function apply(){if(model){def.pose(model,pose);viewer?.draw()}sync()}
function stopDemo(){
  if(demoId)cancelAnimationFrame(demoId);demoId=0;press($('demo'),false);$('demo').innerHTML=icon('play')+'<span>Демонстрация движения</span>';
}
function reset(){
  stopDemo();pose={...def.initial};if(year===1987)setTool('gripper');apply();tell('');
}
function makeJoints(){
  $('joints').replaceChildren();$('moreJoints').replaceChildren();
  def.joints.forEach(([key,name,min,max],i)=>{
    const el=document.createElement('label');el.className='joint';el.htmlFor='j-'+key;
    el.innerHTML='<span class="joint-line"><span>'+name+'</span><output class="range-value" id="o-'+key+'" for="j-'+key+'"></output></span><input type="range" id="j-'+key+'" min="'+min+'" max="'+max+'" step="1">';
    const input=el.querySelector('input');input.disabled=!viewer;
    input.oninput=()=>{stopDemo();joint=i;pose[key]=Number(input.value);apply()};
    (i<3?$('joints'):$('moreJoints')).append(el);
  });
  sync();
}
function modelLink(){
  const live=new URL('https://step3dlab.github.io/vr_anapa/mobot-lab/');live.searchParams.set('model',year);return live.href;
}
function selectYear(next,write=true){
  stopDemo();if(def)saved.set(year,{pose:{...pose},tool});
  year=next;def=machines[year];joint=0;viewReady=false;
  const prev=saved.get(year);pose={...(prev?.pose||def.initial)};tool=prev?.tool||'gripper';
  $('poster').src='./media/'+year+'-overview.webp';$('poster').alt='Обзорная реконструкция '+def.title;
  if(!viewer?.xr?.active)$('poster').hidden=false;
  $('modelTitle').textContent=def.title;$('sceneId').textContent=def.short+' / '+year;
  all('[data-year]').forEach(b=>press(b,Number(b.dataset.year)===year));
  $('extra').open=false;$('toolRow').hidden=year!==1987;tell('');
  if(viewer){if(!cache.has(year))cache.set(year,def.create(T));model=cache.get(year)}else model=null;
  makeJoints();if(year===1987)setTool(tool);if(model){def.pose(model,pose);viewer.select(model,def)}
  if(write){const u=new URL(location.href);u.searchParams.set('model',year);history.replaceState(null,'',u)}
}
function presetDemo(){
  if(demoId){stopDemo();return}
  demoBase={...pose};demoDest={...def.demo};
  if(Object.keys(demoDest).every(k=>Math.abs(demoDest[k]-demoBase[k])<2))demoDest={...def.initial};
  demoStart=performance.now();lastStep=0;press($('demo'),true);$('demo').innerHTML=icon('pause')+'<span>Остановить движение</span>';
  const tick=now=>{
    const elapsed=Math.min(1,(now-demoStart)/7400);
    if(now-lastStep>(viewer.mode==='cpu'?92:35)||elapsed===1){
      const amount=.5-.5*Math.cos(elapsed*2*Math.PI);
      for(const [k,v] of Object.entries(demoDest))pose[k]=demoBase[k]+(v-demoBase[k])*amount;
      apply();lastStep=now;
    }
    if(elapsed<1)demoId=requestAnimationFrame(tick);else stopDemo();
  };
  demoId=requestAnimationFrame(tick);
}
const callbacks={
  get(){const [k,n]=def.joints[joint];return {root:model.root,name:def.title,year,ground:def.ground,jointName:n,value:Math.round(pose[k])+(k==='track'?'%':'°'),toolName:$('tool').selectedOptions[0]?.textContent||''}},
  switchModel(){selectYear(year===1986?1987:1986)},
  nextJoint(){do{joint=(joint+1)%def.joints.length}while(def.joints[joint][0]==='claw'&&tool!=='gripper')},
  change(dir){const [k,,min,max]=def.joints[joint];pose[k]=T.MathUtils.clamp(Math.round(pose[k]+dir*Math.max(1,(max-min)/12)),min,max);apply()},
  nextTool(){const tools=['gripper','breaker-arm','breaker-loader'];chooseTool(tools[(tools.indexOf(tool)+1)%tools.length]);if(def.joints[joint][0]==='claw'&&tool!=='gripper')joint=0},
  reset,ended(){tell('Просмотр в VR завершён.');viewer?.frame('iso')},
  viewChanged(view){all('[data-view]').forEach(b=>press(b,b.dataset.view===view))},
  picked(k){const i=def.joints.findIndex(([key])=>key===k);if(i<0)return;joint=i;if(i>=3)$('extra').open=true;const input=$('j-'+k);input?.focus({preventScroll:true});tell('Выбран механизм «'+def.joints[i][1]+'».')},
  drawn(){if(!viewReady){$('poster').hidden=true;viewReady=true}}
};
try{viewer=createViewer($('surface'),callbacks)}catch(error){console.error('Просмотрщик',error)}
selectYear(year,false);
$('renderMode').textContent=viewer?'3D-МОДЕЛЬ':'ОБЗОРНЫЙ ВИД';
if(!viewer){
  $('hint').textContent='Доступны обзорные виды и архивные фотографии.';
  for(const el of [...all('[data-view]'),$('demo'),$('reset'),$('in'),$('out'),$('fit'),$('tool')])el.disabled=true;
}
all('[data-year]').forEach(b=>b.onclick=()=>{if(+b.dataset.year!==year)selectYear(+b.dataset.year)});
all('[data-view]').forEach(b=>b.onclick=()=>viewer?.frame(b.dataset.view));
$('in').onclick=()=>viewer?.zoom(1.22);$('out').onclick=()=>viewer?.zoom(1/1.22);$('fit').onclick=()=>viewer?.frame('iso');
$('demo').onclick=presetDemo;$('reset').onclick=reset;$('tool').onchange=e=>chooseTool(e.target.value);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDemo()});
if(matchMedia('(pointer:coarse)').matches&&viewer)$('hint').textContent='Одним пальцем — вращение, двумя — масштаб';
const fs=$('fullscreen'),stage=$('stage');
function fullLabel(){
  const active=Boolean(document.fullscreenElement)||stage.classList.contains('full-window');
  const label=active?'Выйти из полного экрана':'На весь экран';fs.title=label;fs.setAttribute('aria-label',label);press(fs,active);
}
fs.onclick=async()=>{
  if(document.fullscreenElement){await document.exitFullscreen();return}
  if(stage.classList.contains('full-window'))stage.classList.remove('full-window');
  else{try{await stage.requestFullscreen()}catch{stage.classList.add('full-window')}}
  fullLabel();
};
document.addEventListener('fullscreenchange',fullLabel);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('full-window')){stage.classList.remove('full-window');fullLabel()}});
let gallery=null;
function showPhoto(y,i=0){
  const data=machines[y],photos=data.photos;i=(i+photos.length)%photos.length;const p=photos[i];
  gallery={y,i};
  openDialog('ФОТОАРХИВ  /  '+y,'<h2>'+p.title+'</h2><img class="gallery-image" src="'+p.file+'" alt="'+p.title+'"><div class="gallery-foot"><a target="_blank" rel="noopener" href="'+p.source+'">Источник снимка ↗</a><div class="gallery-nav"><button class="icon" id="prevPhoto" aria-label="Предыдущий снимок">'+icon('left')+'</button><span>'+(i+1)+' / '+photos.length+'</span><button class="icon" id="nextPhoto" aria-label="Следующий снимок">'+icon('right')+'</button></div></div><p>'+p.note+'</p><button id="galleryModel" class="modal-action">'+icon('box')+'Открыть '+data.short+' в 3D</button>',p.title);
  $('prevPhoto').onclick=()=>{showPhoto(y,i-1);$('prevPhoto').focus()};$('nextPhoto').onclick=()=>{showPhoto(y,i+1);$('nextPhoto').focus()};
  $('galleryModel').onclick=()=>{dialog.close();selectYear(Number(y));$('lab').scrollIntoView();$('fit').focus({preventScroll:true})};
}
all('[data-gallery]').forEach(b=>b.onclick=()=>showPhoto(+b.dataset.gallery));
dialog.addEventListener('close',()=>{gallery=null});
dialog.addEventListener('keydown',e=>{if(!gallery)return;if(e.key==='ArrowRight')$('nextPhoto').click();else if(e.key==='ArrowLeft')$('prevPhoto').click()});
$('about').onclick=()=>openDialog('О ПРОЕКТЕ','<h2>Две машины для работ на ЧАЭС</h2><p>В 1986 году коллектив двух факультетов МВТУ им. Н. Э. Баумана разработал «Мобот-Ч-ХВ» для расчистки кровли. В 1987 году на ЧАЭС работали модернизированные комплексы «Мобот-Ч-ХВ-2» со сменным оснащением.</p><p>Технопарк РГСУ объединил две инженерные реконструкции. Архивные фотографии задают форму видимых узлов. Масштаб, скрытые шарниры, углы и движение механизмов в модели условны. В VR обе машины показаны в настольном масштабе.</p><p><a href="http://sktbpr.ru/node/23" target="_blank" rel="noopener">История комплексов в архиве СКТБ ПР ↗</a></p><p>Исходные инженерные модели · <a href="'+machines[1986].original+'" target="_blank" rel="noopener">Ч-ХВ, 1986 ↗</a> · <a href="'+machines[1987].original+'" target="_blank" rel="noopener">Ч-ХВ-2, 1987 ↗</a></p>');
let vrSupported=false;
async function checkVR(){try{vrSupported=!!viewer?.xr&&!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')}catch{vrSupported=false}}
checkVR();navigator.xr?.addEventListener('devicechange',checkVR);
function vrHelp(error=''){
  openDialog('ВИРТУАЛЬНАЯ РЕАЛЬНОСТЬ','<h2>Просмотр в VR</h2><p>'+(error||'Откройте атлас в браузере VR-шлема с поддержкой WebXR, например в Meta Quest Browser. На компьютере можно использовать подключённый шлем и совместимый браузер.')+'</p><p>Рядом с моделью появится пульт. Наведите луч контроллера на кнопку и нажмите курок, чтобы сменить машину, выбрать механизм или переместить его.</p><p><a href="'+modelLink()+'">Открыть модель '+def.short+' по постоянной ссылке ↗</a></p><button id="copyVR" class="modal-action">Скопировать ссылку для шлема</button><p id="copyMessage" role="status"></p>');
  $('copyVR').onclick=async()=>{try{await navigator.clipboard.writeText(modelLink());$('copyMessage').textContent='Ссылка скопирована.'}catch{$('copyMessage').textContent=modelLink()}};
}
$('vr').onclick=async()=>{
  stopDemo();
  if(!vrSupported){vrHelp();return}
  let session;
  try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});await viewer.xr.start(session)}
  catch(e){if(session)await session.end().catch(()=>{});vrHelp(e.name==='NotAllowedError'?'Браузер не разрешил запуск VR. Разрешите просмотр в шлеме и снова нажмите «Войти в VR».':'Не удалось начать сеанс VR. Проверьте подключение шлема, затем повторите запуск.')}
};
const archiveObserver=new IntersectionObserver(([e])=>{
  const active=e.isIntersecting&&$('lab').getBoundingClientRect().top<-90;
  document.querySelector('.navarch').classList.toggle('active',active);
  document.querySelector('.navlab').classList.toggle('active',!active);
},{threshold:[0,.6,1]});archiveObserver.observe($('archive'));
