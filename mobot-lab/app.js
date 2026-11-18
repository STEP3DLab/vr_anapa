import * as T from './engine/three.module.min.js';
import {insertIcons,icon} from './icons.js';
import {machines,demonstrations} from './catalog.js';
import {inspections} from './inspection.js';
import {registrations} from './registrations.js';
import {evidence} from './evidence.js';
import {createViewer} from './viewer.js';
import {photoKey,readScene,sceneURL,tools as workTools} from './scene-link.js';
import {createArchive,escapeHTML as h} from './archive.js';
import {openModal,closeModal,setupPresentation} from './presentation.js';

insertIcons();
const $=id=>document.getElementById(id);
const all=selector=>[...document.querySelectorAll(selector)];
const press=(button,on)=>button.setAttribute('aria-pressed',String(on));
const tell=text=>{$('status').textContent=text};
const params=new URLSearchParams(location.search);
const canonical='https://step3dlab.github.io/vr_anapa/mobot-lab/';
const cache=new Map(), saved=new Map();
let year=Number(params.get('model'))===1987?1987:1986;
let model,def,pose,tool='gripper',joint=0,viewer=null,mode='drive';
let partId,photoIndex=0,marks=false,demoId=0,ready=false,auditTimer=0;
const archive=createArchive({openModal,closeModal,compare:compareFromGallery});
const part=()=>inspections[year].find(p=>p.id===partId);
const photo=()=>evidence[year].photos[photoIndex];
const unit=k=>k==='track'?'%':'°';
const canUse=k=>year!==1987||k!=='claw'||tool==='gripper';

function link(base=canonical) {
  return sceneURL(base,{year,def,mode,photo:photo(),part:partId,pose,tool,camera:viewer?.capture(),marks});
}
let urlTimer=0, initialising=true;
function storeView() {
  if(initialising) return;
  clearTimeout(urlTimer);
  urlTimer=setTimeout(()=>{
    const url=new URL(link(location.href));url.hash=location.hash;
    history.replaceState(null,'',url);
  },180);
}
function setTool(value) {
  if(year!==1987) return;
  tool=value;
  $('tool').value=tool;model?.mechanisms.setWorkTool(tool);
  const claw=$('j-claw');if(claw)claw.disabled=!viewer||!canUse('claw');
  if(!canUse(def.joints[joint][0])) joint=0;
}
function chooseTool(value) {
  if(!workTools.includes(value)||year!==1987)return;
  stopDemo();setTool(value);
  pose={...demonstrations[value].start};apply();storeView();
  tell(value==='breaker-loader'?'Молоток установлен на поднятый погрузчик. Форма крепления восстановлена приближённо.':'');
}
function sync() {
  for(const [key,,min,max] of def.joints) {
    const input=$('j-'+key);if(!input)continue;
    const value=Math.round(pose[key]),formatted=value+unit(key);
    input.value=String(value);input.style.setProperty('--pct',((value-min)/(max-min)*100)+'%');
    $('o-'+key).value=formatted;input.setAttribute('aria-valuetext',formatted);
  }
}
function inspectPose() {
  clearTimeout(auditTimer);
  if(!model||mode!=='drive'||demoId||viewer?.xr?.active) return;
  let notes;
  if(year===1987) notes=model.mechanisms.inspectPose().alerts;
  else {
    const {bucketClearance,grappleClearance}=model.auditPose();
    notes=Math.min(bucketClearance,grappleClearance)<-.001?['Рабочий орган ниже плоскости опоры']:[];
  }
  $('poseNotice').textContent=notes.join('. ');
  $('poseNotice').hidden=!notes.length;
}
function apply() {
  if(model){def.pose(model,pose);viewer.draw()}
  sync();clearTimeout(auditTimer);
  if(!demoId&&mode==='drive') auditTimer=setTimeout(inspectPose,140);
}
function stopDemo() {
  if(demoId)cancelAnimationFrame(demoId);
  demoId=0;press($('demo'),false);
  $('demo').innerHTML=icon('play')+'<span>Демонстрация движения</span>';
}
function reset() {
  stopDemo();pose={...def.initial};if(year===1987)setTool('gripper');
  apply();storeView();tell('Механизмы в исходном положении.');
}
function demo() {
  if(!model)return;
  if(demoId){stopDemo();inspectPose();storeView();return}
  const path=year===1987?demonstrations[tool]:{start:def.initial,end:def.demo};
  const start=performance.now();let last=-Infinity;
  $('poseNotice').hidden=true;press($('demo'),true);
  $('demo').innerHTML=icon('pause')+'<span>Остановить движение</span>';tell('');
  const tick=now=>{
    const t=Math.min(1,(now-start)/7400);
    if(now-last>(viewer.mode==='cpu'?95:32)||t===1){
      const mix=(1-Math.cos(2*Math.PI*t))/2;
      for(const [key,value] of Object.entries(path.end))pose[key]=path.start[key]+(value-path.start[key])*mix;
      apply();last=now;
    }
    if(t<1)demoId=requestAnimationFrame(tick);
    else{stopDemo();inspectPose();storeView()}
  };
  pose={...path.start};demoId=requestAnimationFrame(tick);apply();
}
function makeJoints() {
  $('joints').replaceChildren();$('moreJoints').replaceChildren();
  def.joints.forEach(([key,name,min,max],i)=>{
    const el=document.createElement('div');el.className='joint';
    el.innerHTML='<div class="joint-line"><label for="j-'+key+'">'+name+'</label><output id="o-'+key+'" class="range-value" for="j-'+key+'"></output></div>'+
      '<input type="range" id="j-'+key+'" min="'+min+'" max="'+max+'" step="1">';
    const input=el.querySelector('input');input.disabled=!viewer||!canUse(key);
    input.oninput=()=>{stopDemo();joint=i;pose[key]=Number(input.value);apply();storeView()};
    (i<3?$('joints'):$('moreJoints')).append(el);
  });
  sync();
}
function setYear(next) {
  stopDemo();clearTimeout(auditTimer);
  if(def)saved.set(year,{pose:{...pose},tool,partId,photoIndex,marks});
  year=next;def=machines[year];joint=0;ready=false;
  const prev=saved.get(year);
  pose={...(prev?.pose||def.initial)};tool=prev?.tool||'gripper';
  partId=prev?.partId||inspections[year][0].id;photoIndex=prev?.photoIndex??0;marks=prev?.marks??false;
  $('poster').src='./media/'+year+'-overview.webp';$('poster').alt='Обзорная реконструкция '+def.title;
  $('poster').hidden=!!viewer?.xr?.active;
  $('modelTitle').textContent=def.title;$('sceneId').textContent=def.short+' / '+year;
  all('[data-year]').forEach(b=>press(b,Number(b.dataset.year)===year));
  $('toolRow').hidden=year!==1987;$('extra').open=false;$('poseNotice').hidden=true;tell('');
  if(viewer){if(!cache.has(year))cache.set(year,def.create(T));model=cache.get(year)}
  else model=null;
  makeJoints();if(year===1987)setTool(tool);
  if(model){def.pose(model,pose);viewer.select(model,def)}
}
function selectYear(next) {
  if(next===year)return;
  setYear(next);setMode(mode,{match:mode==='photo'&&!viewer?.xr?.active});storeView();
}
function markers() {
  const pins=$('markers');pins.hidden=mode!=='parts'||!viewer;
  if(pins.hidden)return;
  for(const button of pins.children) {
    const info=inspections[year].find(p=>p.id===button.dataset.part);
    const xy=info && viewer.project(info.anchor(model));
    button.hidden=!xy;
    if(xy){button.style.left=xy[0]+'%';button.style.top=xy[1]+'%'}
  }
}
function showPart(id,closeup=false) {
  const item=inspections[year].find(p=>p.id===id);
  if(!item)return;
  const hadDetail=viewer?.capture().detail;
  partId=id;
  for(const b of all('[data-part]'))press(b,b.dataset.part===id);
  $('partDetail').innerHTML='<h4>'+h(item.title)+'</h4><p>'+h(item.description)+'</p><p class="evidence-note">'+h(item.confidence)+'</p>'+
    '<div class="part-actions"><button id="closeup" class="secondary"'+(viewer?'':' disabled')+'>'+icon('focus')+'Крупный план</button>'+
    '<a href="'+h(item.source)+'" target="_blank" rel="noopener">Источник ↗</a></div>'+
    (item.joint&&canUse(item.joint)?'<button class="text-btn move-part" id="movePart">'+icon('sliders')+'Управлять узлом</button>':'');
  $('closeup').onclick=()=>showPart(id,true);
  if($('movePart'))$('movePart').onclick=()=>{setMode('drive');focusJoint(item.joint)};
  if(closeup||hadDetail) viewer?.frame(item.view,{node:item.anchor(model)});
  markers();storeView();
}
function partsPanel() {
  const choices=$('partChoices'),pins=$('markers'),items=inspections[year];
  choices.replaceChildren();pins.replaceChildren();
  items.forEach((item,i)=>{
    const choice=document.createElement('button');
    choice.dataset.part=item.id;choice.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span>'+h(item.title);
    choice.onclick=()=>showPart(item.id);choices.append(choice);
    const pin=document.createElement('button');pin.dataset.part=item.id;pin.className='pin';
    pin.textContent=i+1;pin.setAttribute('aria-label',item.title+' на модели');pin.title=item.title;
    pin.onclick=()=>showPart(item.id);pins.append(pin);
  });
  showPart(partId);
}
function applyPhoto() {
  const reg=registrations[photoKey(photo())];
  if(!reg||!model)return;
  stopDemo();if(year===1987)setTool(reg.tool);
  pose={...def.initial,...reg.pose};apply();
  viewer.frame(reg.direction?null:reg.view,{direction:reg.direction,up:reg.up});
  storeView();
}
function photoPanel() {
  archive.renderComparison({year,index:photoIndex,marks,live:!!viewer,
    select:index=>{photoIndex=index;applyPhoto();photoPanel();$('photoSelect').focus({preventScroll:true});storeView()},
    toggle:enabled=>{marks=enabled;photoPanel();$('overlayToggle').focus({preventScroll:true});storeView()},
    restore:()=>{applyPhoto();tell('Положение механизмов и ракурс восстановлены по выбранному снимку.')}
  });
}
function setMode(next,{match=next==='photo'}={}) {
  const previous=mode;mode=next;stopDemo();tell('');
  if(previous==='parts'&&next!=='parts'&&viewer?.capture().detail)viewer.frame('iso');
  for(const b of all('[data-mode]')){
    const on=b.dataset.mode===mode;
    b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$('panel-'+b.dataset.mode).hidden=!on;
  }
  $('markers').hidden=mode!=='parts'||!viewer;
  if(mode==='parts')partsPanel();
  if(mode==='photo'){if(match)applyPhoto();photoPanel()}
  if(mode==='drive')inspectPose();
  storeView();
}
function compareFromGallery(y,i,marked) {
  if(y!==year)setYear(y);
  photoIndex=i;marks=marked;setMode('photo');$('workbench').scrollIntoView({block:'start'});
  $('tab-photo').focus({preventScroll:true});
}
function focusJoint(key) {
  const i=def.joints.findIndex(([k])=>k===key);if(i<0||!canUse(key))return;
  joint=i;if(i>=3)$('extra').open=true;$('j-'+key)?.focus({preventScroll:true});
}
const getState=()=>{
  const [key,name]=def.joints[joint];
  return {root:model?.root,name:def.title,year,ground:model?.groundY??def.ground,jointName:name,
    value:Math.round(pose[key])+unit(key),toolName:$('tool').selectedOptions[0]?.textContent||''};
};
const callbacks={
  get:getState,switchModel:()=>selectYear(year===1986?1987:1986),
  nextJoint(){do{joint=(joint+1)%def.joints.length}while(!canUse(def.joints[joint][0]))},
  change(dir){const [key,,min,max]=def.joints[joint];pose[key]=T.MathUtils.clamp(Math.round(pose[key]+dir*Math.max(1,(max-min)/12)),min,max);apply();storeView()},
  nextTool(){chooseTool(workTools[(workTools.indexOf(tool)+1)%workTools.length])},
  reset,ended(){if(mode==='photo')photoPanel();tell('Просмотр в VR завершён.');storeView()},
  viewChanged(view){all('[data-view]').forEach(b=>press(b,b.dataset.view===view));storeView()},
  picked(key) {
    const map={yaw:year===1986?'boom':'arm',boom:'boom',arm:'arm',grab:'grab',claw:'tool',tool:'tool',wrist:'tool',loader:'loader',bucket:'loader',tip:'loader',camera:'camera',track:'track'};
    if(mode==='drive'&&def.joints.some(([k])=>k===key)&&canUse(key)){
      focusJoint(key);tell('Выбран механизм «'+def.joints[joint][1]+'».');return;
    }
    if(map[key]){partId=map[key];setMode('parts')}
  },
  contextLost(){ready=false;$('poster').hidden=false;$('renderMode').textContent='ВОССТАНОВЛЕНИЕ 3D'},
  drawn(){if(!ready){$('poster').hidden=true;$('renderMode').textContent='3D-РЕКОНСТРУКЦИЯ';ready=true}if(mode==='parts')markers()}
};
try {viewer=createViewer($('surface'),callbacks)} catch(e) {console.error('Просмотрщик',e)}
setYear(year);
const initial=readScene(params,def,evidence[year].photos,inspections[year]);
partId=initial.part;photoIndex=initial.photo;marks=initial.marks;
if(!registrations[photoKey(photo())]&&initial.mode==='photo')photoIndex=0;
setMode(initial.mode);
if(initial.pose){setTool(initial.tool);pose={...initial.pose};apply()}
if(initial.camera && viewer){
  const c=initial.camera;viewer.frame(c.view,{...c,node:c.detail?part().anchor(model):null});
}
initialising=false;
$('renderMode').textContent=viewer?'3D-РЕКОНСТРУКЦИЯ':'ОБЗОРНЫЙ ВИД';
if(!viewer){
  $('hint').textContent='Доступны обзорные виды, описания узлов и фотоархив.';
  for(const b of [...all('[data-view]'),$('demo'),$('reset'),$('in'),$('out'),$('fit'),$('tool')])b.disabled=true;
} else if(matchMedia('(pointer:coarse)').matches) $('hint').textContent='Один палец — вращение, два — масштаб';

all('[data-year]').forEach(b=>b.onclick=()=>selectYear(+b.dataset.year));
all('[data-mode]').forEach((b,i,buttons)=>{
  b.onclick=()=>{if(mode!==b.dataset.mode)setMode(b.dataset.mode)};
  b.onkeydown=e=>{
    const destination={ArrowRight:(i+1)%3,ArrowLeft:(i+2)%3,Home:0,End:2}[e.key];
    if(destination===undefined)return;e.preventDefault();buttons[destination].focus();buttons[destination].click();
  };
});
all('[data-view]').forEach(b=>b.onclick=()=>viewer?.frame(b.dataset.view));
$('in').onclick=()=>{viewer?.zoom(1.22);storeView()};$('out').onclick=()=>{viewer?.zoom(1/1.22);storeView()};
$('surface').addEventListener('wheel',storeView,{passive:true});
$('surface').addEventListener('pointerup',storeView);
$('surface').addEventListener('keydown',storeView);
$('fit').onclick=()=>viewer?.frame('iso');$('demo').onclick=demo;$('reset').onclick=reset;
$('tool').onchange=e=>chooseTool(e.target.value);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&demoId){stopDemo();storeView()}});
$('passport').onclick=()=>{
  const data=evidence[year];
  openModal('ПАСПОРТ РЕКОНСТРУКЦИИ  /  '+year,'<h2>'+h(def.title)+'</h2><dl class="facts">'+
    data.facts.map(f=>'<div><dt>'+h(f.label)+'</dt><dd>'+h(f.value)+'</dd></div>').join('')+'</dl><h3>Границы реконструкции</h3><p>'+h(data.note)+'</p>'+
    '<div class="source-links"><a href="'+h(data.reference)+'" target="_blank" rel="noopener">Публикация разработчиков ↗</a> <a href="'+def.original+'" target="_blank" rel="noopener">Инженерная версия '+def.code+' ↗</a></div>',def.title);
};
$('about').onclick=()=>openModal('О ПРОЕКТЕ','<h2>Две машины для работ на ЧАЭС</h2><p>В 1986 году в МВТУ им. Н. Э. Баумана создали «Мобот-Ч-ХВ» для расчистки кровли. В 1987 году работы продолжили модернизированные комплексы «Мобот-Ч-ХВ-2» со сменным оснащением.</p><p>Технопарк РГСУ объединил исследовательские модели 1986 и 1987 годов. В разделе «Сверка» архивный снимок задаёт позу и ракурс, а разметка связывает модель с видимыми деталями. Углы движения и масштаб сцены условны.</p><p><a href="https://sktbpr.ru/node/23" target="_blank" rel="noopener">История комплексов в архиве СКТБ ПР ↗</a></p>');
const presentation=setupPresentation({getLink:()=>link(),getState});
let vrSupported=false,busy=false;
async function checkVR() {
  try{vrSupported=!!viewer?.xr&&!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr')}catch{vrSupported=false}
}
checkVR();navigator.xr?.addEventListener('devicechange',checkVR);
$('vr').onclick=async()=>{
  if(busy)return;stopDemo();
  if(!vrSupported){presentation.vrHelp();return}
  busy=true;let session;
  try {
    session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});
    await viewer.xr.start(session);
  } catch(e) {
    if(session)await session.end().catch(()=>{});
    presentation.vrHelp(e.name==='NotAllowedError'?'Для запуска разрешите сеанс VR в браузере шлема.':'Сеанс не начался. Проверьте подключение шлема и повторите запуск.');
  } finally {busy=false}
};
if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{
  const active=entry.isIntersecting&&$('lab').getBoundingClientRect().top<-90;
  document.querySelector('.navarch').classList.toggle('active',active);
  document.querySelector('.navlab').classList.toggle('active',!active);
},{threshold:[0,.4,1]}).observe($('archive'));
