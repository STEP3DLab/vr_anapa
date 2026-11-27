import {icon} from './icons.js';
import {escapeHTML as h} from './archive.js';
const $ = id => document.getElementById(id);
const dialog = $('dialog');
let returnFocus;
let modalCleanups=[];
function cleanupModal() { const cleanups=modalCleanups;modalCleanups=[];for(const dispose of cleanups)dispose(); }
export function onModalCleanup(dispose) { modalCleanups.push(dispose); }
export function openModal(kind, html, label=kind) {
  cleanupModal();
  if (!dialog.open) returnFocus=document.activeElement;
  $('dialogKind').textContent=kind; $('dialogBody').innerHTML=html;
  dialog.setAttribute('aria-label',label);
  if (!dialog.open) dialog.showModal();
}
export function closeModal() { dialog.close(); }
$('closeDialog').onclick=closeModal;
dialog.addEventListener('close',()=>{cleanupModal();if(returnFocus?.isConnected && (document.activeElement===document.body || dialog.contains(document.activeElement))) returnFocus.focus({preventScroll:true})});
dialog.addEventListener('click',e=>{
  if (e.target!==dialog) return;
  const b=dialog.getBoundingClientRect();
  if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom) closeModal();
});

function fullscreen() {
  const bench=$('workbench'), button=$('fullscreen');
  const active=()=>document.fullscreenElement===bench||bench.classList.contains('full-window');
  function label() {
    const text=active()?'Выйти из полного экрана':'На весь экран';
    button.title=text; button.setAttribute('aria-label',text); button.setAttribute('aria-pressed',String(active()));
  }
  const outside=new Set();
  function fallback(on) {
    bench.classList.toggle('full-window',on);
    if (on) {
      // The CSS fallback is visually full-screen, but unlike native fullscreen
      // it leaves background controls in the tab order unless we isolate them.
      for (let node=bench;node!==document.body;node=node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling===node || sibling===dialog || sibling.inert) continue;
          sibling.inert=true;outside.add(sibling);
        }
      }
      button.focus({preventScroll:true});
    } else {
      for (const sibling of outside) sibling.inert=false;
      outside.clear();
      button.focus({preventScroll:true});
    }
    label();
  }
  button.onclick=async()=>{
    if(document.fullscreenElement){await document.exitFullscreen();return}
    if (bench.classList.contains('full-window')) {fallback(false);return}
    try {await bench.requestFullscreen()} catch {fallback(true)}
    label();
  };
  document.addEventListener('fullscreenchange',label);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!dialog.open&&bench.classList.contains('full-window')){
      e.preventDefault();fallback(false);
    }
  });
  // Native dialogs must be descendants of a fullscreen element on some browsers.
  document.addEventListener('fullscreenchange',()=>{(document.fullscreenElement===bench?bench:document.body).append(dialog)});
}
function setupOffline() {
  const button=$('offline'), out=$('offlineStatus');
  if(!('serviceWorker' in navigator) || !window.isSecureContext){button.hidden=true;return}
  async function prepare() {
    button.disabled=true; out.textContent='Сохраняются обе модели, пульт, паспорта и фотоархив…';
    let previousWorker;
    try {
      previousWorker=(await navigator.serviceWorker.getRegistration('./').catch(()=>null))?.active;
      const registration=await navigator.serviceWorker.register('./offline-worker.js',{scope:'./',updateViaCache:'none'});
      // A failed install never becomes ready. Track the actual installing worker
      // so a visitor can retry after a dropped connection.
      previousWorker=registration.active || previousWorker;
      if(previousWorker && !registration.installing) await registration.update();
      const worker=registration.installing || registration.waiting || registration.active;
      if(!worker) throw Error('worker');
      if(worker.state!=='activated') await new Promise((resolve,reject)=>{
        function changed(){
          if(worker.state==='activated'){worker.removeEventListener('statechange',changed);resolve()}
          if(worker.state==='redundant'){worker.removeEventListener('statechange',changed);reject(Error('install'))}
        }
        worker.addEventListener('statechange',changed);changed();
      });
      // A newly activated worker has already downloaded the entire copy.
      // Only refresh files explicitly when continuing with the same worker.
      if(worker===previousWorker) await new Promise((resolve,reject)=>{
        const channel=new MessageChannel();
        const timeout=setTimeout(()=>finish(false),45000);
        function finish(ok){clearTimeout(timeout);channel.port1.close();if(ok)resolve();else reject(Error('refresh'))}
        channel.port1.onmessage=event=>finish(event.data?.saved===true);
        worker.postMessage('refresh-exhibition',[channel.port2]);
      });
      button.innerHTML=icon('download')+'Обновить копию';
      out.textContent='Обе модели, паспорта и 10 снимков сохранены. Эту страницу можно открыть без интернета. ZIP-исходники и внешние источники скачиваются отдельно.';
    } catch {
      out.textContent=previousWorker?.scriptURL===new URL('./offline-worker.js',location.href).href && previousWorker.state==='activated'
        ? 'Обновление не завершено. Предыдущая автономная версия остаётся активной. Повторите попытку при устойчивом соединении.'
        : 'Сохранение не завершено. Проверьте соединение и повторите попытку.';
    } finally {button.disabled=false}
  }
  button.onclick=prepare;
  navigator.serviceWorker.getRegistration('./').then(reg=>{
    if(reg?.active?.scriptURL===new URL('./offline-worker.js',location.href).href) button.innerHTML=icon('download')+'Обновить копию';
  }).catch(()=>{});
}
async function putQR(url,canvas) {
  try {
    const {default:QR}=await import('./engine/qr.js');
    if (!canvas.isConnected) return;
    const qr=new QR(-1,0); qr.addData(url); qr.make();
    const quiet=4, cells=qr.getModuleCount(), pixel=5;
    canvas.width=canvas.height=(cells+quiet*2)*pixel;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#17251f';
    for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)if(qr.isDark(y,x))ctx.fillRect((x+quiet)*pixel,(y+quiet)*pixel,pixel,pixel);
  } catch {canvas.hidden=true}
}
export function setupPresentation({getLink,getState}) {
  fullscreen();setupOffline();
  function transfer(vr=false,error='') {
    const link=getLink(), state=getState(), title=vr?'Просмотр в VR':'Ссылка на этот вид';
    const text=vr?'Откройте ссылку в браузере VR-шлема, затем нажмите «Войти в VR». На виртуальном пульте можно менять модель, оснастку и положение механизмов. Боковая кнопка контроллера вращает экспонат движением руки.':'Ссылка откроет ту же машину, оснастку, положение механизмов и ракурс. QR-код можно считать с другого устройства.';
    openModal(vr?'ВИРТУАЛЬНАЯ РЕАЛЬНОСТЬ':'ПЕРЕДАЧА СЦЕНЫ','<h2>'+title+'</h2>'+
      (error?'<p>'+h(error)+'</p>':'')+'<div class="transfer"><canvas id="qr" aria-label="QR-код ссылки на текущую сцену"></canvas><div><strong>'+h(state.name)+' · '+state.year+'</strong><p>'+text+'</p>'+(vr?'<p>Масштаб настольного экспоната можно изменить в пульте шлема.</p>':'')+'</div></div>'+
      '<label class="select-title" for="shareURL">Адрес сцены</label><input id="shareURL" class="url-field" type="url" readonly value="'+h(link)+'">'+
      '<button id="copyLink" class="modal-action">'+icon('link')+'Скопировать ссылку</button><p id="copyStatus" role="status"></p>', title);
    putQR(link,$('qr'));
    const copy=$('copyLink'), input=$('shareURL'), status=$('copyStatus');
    let attempt=0;
    copy.onclick=async()=>{
      const id=++attempt;
      const current=()=>dialog.open&&copy.isConnected&&id===attempt;
      try {
        await navigator.clipboard.writeText(link);
        if(current())status.textContent='Ссылка скопирована.';
      } catch {
        if(!current())return;
        if(document.activeElement===copy){
          input.focus({preventScroll:true});input.select();
          status.textContent='Адрес выделен. Скопируйте его вручную.';
        } else status.textContent='Автокопирование недоступно. Скопируйте адрес вручную.';
      }
    };
  }
  $('share').onclick=()=>transfer();
  return {vrHelp:error=>transfer(true,error)};
}
