import * as T from './engine/three.module.min.js';
import {machines, demonstrations} from './catalog.js';
import {createViewer} from './viewer.js';
import {escapeHTML as h} from './archive.js';
import {orientComparisonCamera} from './scene-link.js';
import {putQR} from './presentation.js';

// Both panes use the very same accepted factories as the main laboratory.
// Their geometry and control state remain independent.
export function openDual({openModal, onModalCleanup, select, shareURL}) {
  const years=[1986,1987], viewers=new Map(), models=new Map();
  let syncing=false, disposed=false, animation=0;
  openModal('ДВЕ МАШИНЫ', '<h2>Два робота рядом</h2><p>Поверните любую модель. При связанных ракурсах вторая повторит направление осмотра.</p>'+
    '<div class="dual-toolbar"><label><input id="dualSync" type="checkbox" checked> Связать ракурсы</label><div role="group" aria-label="Общий ракурс">'+
    [['iso','Общий'],['side','Сбоку'],['front','Спереди'],['top','Сверху']].map(([key,label])=>'<button class="text-btn" data-dual-view="'+key+'">'+label+'</button>').join('')+'</div></div>'+
    '<div class="dual-grid">'+years.map(year=>'<article class="dual-card"><div class="dual-heading"><div><span class="mini">'+year+' · '+machines[year].code+'</span><h3>'+h(machines[year].title)+'</h3></div></div>'+
      '<div id="dual-'+year+'" class="dual-surface" aria-label="Модель '+year+' года"></div><button class="secondary" data-dual-open="'+year+'">Управлять этой машиной</button></article>').join('')+'</div>'+
    '<div class="dual-actions"><button class="secondary" id="dualMotion" aria-pressed="false">Движение обоих роботов</button><p id="dualStatus" role="status"></p></div>'+
    '<p class="evidence-note">Каждая машина вписана в своё окно. Размеры на экране не задают общий физический масштаб. Для подробного осмотра выберите машину и откройте её узлы.</p>'+
    '<details id="dualShare"><summary>Ссылка на обе модели и QR-код</summary><div class="transfer"><canvas id="dualQR" aria-label="QR-код сравнения"></canvas><p>На другом устройстве ссылка откроет обе машины в исходных положениях. Она не сохраняет индивидуальные позы сравнения.</p></div><label class="select-title" for="dualURL">Адрес сравнения</label><input id="dualURL" class="url-field" type="url" readonly value="'+h(shareURL)+'"><button id="dualCopy" class="modal-action">Скопировать ссылку</button><p id="dualCopyStatus" role="status"></p></details>', 'Два робота рядом');
  const dialog=document.getElementById('dialog');dialog.classList.add('dual-dialog');
  const status=document.getElementById('dualStatus'), motion=document.getElementById('dualMotion');
  const share=document.getElementById('dualShare'),input=document.getElementById('dualURL'),copy=document.getElementById('dualCopy'),copyStatus=document.getElementById('dualCopyStatus');
  let qrStarted=false,attempt=0;
  share.ontoggle=()=>{if(share.open&&!qrStarted&&!disposed){qrStarted=true;putQR(shareURL,document.getElementById('dualQR'));}};
  copy.onclick=async()=>{
    const id=++attempt,current=()=>!disposed&&dialog.open&&copy.isConnected&&id===attempt;
    try{await navigator.clipboard.writeText(shareURL);if(current())copyStatus.textContent='Ссылка скопирована.';}
    catch{if(current()){if(document.activeElement===copy){input.focus({preventScroll:true});input.select();}copyStatus.textContent='Скопируйте адрес вручную.';}}
  };
  function stop() {
    cancelAnimationFrame(animation);animation=0;
    motion.textContent='Движение обоих роботов';motion.setAttribute('aria-pressed','false');
  }
  function follow(year,state) {
    if(disposed||syncing||!document.getElementById('dualSync')?.checked)return;
    const other=year===1986?1987:1986, target=viewers.get(other);
    if(!target)return;
    syncing=true;
    // The accepted scenes have opposite longitudinal orientations.
    target.frame(null,orientComparisonCamera(state,machines[year].side,machines[other].side));
    syncing=false;
  }
  for(const year of years) {
    const surface=document.getElementById('dual-'+year), def=machines[year];
    let view;
    try {
      const model=def.create(T);def.pose(model,{...def.initial});models.set(year,model);
      view=createViewer(surface,{
        get:()=>({root:model.root,year,name:def.title,ground:def.ground}),
        contextLost(){status.textContent='Один из 3D-видов временно недоступен. Закройте и снова откройте сравнение.';},
        drawn(){}, ended(){}, picked(){}, viewChanged(){}, cameraChanged:state=>follow(year,state)
      },{xr:false});
      viewers.set(year,view);syncing=true;view.select(model,def);syncing=false;
    } catch(error) {
      view?.dispose({models:true});viewers.delete(year);models.delete(year);
      surface.innerHTML='<img src="./media/'+year+'-overview.webp" alt="Обзорный вид '+h(def.title)+'">';
      status.textContent='Для одной из моделей показан резервный кадр.';
    } finally {syncing=false;}
  }
  for(const button of dialog.querySelectorAll('[data-dual-view]'))button.onclick=()=>{
    syncing=true;for(const view of viewers.values())view.frame(button.dataset.dualView);syncing=false;
  };
  document.getElementById('dualSync').onchange=e=>{if(e.target.checked&&viewers.has(1986))follow(1986,viewers.get(1986).capture());};
  for(const button of dialog.querySelectorAll('[data-dual-open]'))button.onclick=()=>select(+button.dataset.dualOpen);
  motion.disabled=viewers.size!==2;
  motion.onclick=()=>{
    if(animation){stop();return;}
    const start=performance.now();let last=-Infinity;
    motion.textContent='Остановить движение';motion.setAttribute('aria-pressed','true');
    const tick=now=>{
      if(disposed)return;
      const t=Math.min(1,(now-start)/7400),mix=(1-Math.cos(2*Math.PI*t))/2;
      if(now-last>50||t===1){
        for(const year of years){
          const def=machines[year],path=year===1987?demonstrations.gripper:{start:def.initial,end:def.demo};
          const pose=Object.fromEntries(Object.entries(path.end).map(([key,value])=>[key,path.start[key]+(value-path.start[key])*mix]));
          def.pose(models.get(year),pose);viewers.get(year).draw();
        }
        last=now;
      }
      if(t<1)animation=requestAnimationFrame(tick);else stop();
    };
    animation=requestAnimationFrame(tick);
  };
  onModalCleanup(()=>{
    disposed=true;stop();for(const view of viewers.values())view.dispose({models:true});
    viewers.clear();models.clear();dialog.classList.remove('dual-dialog');
  });
}
