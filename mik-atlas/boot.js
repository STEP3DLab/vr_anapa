// The landing page stays independent of WebGL. Load the engine on the first action.
const panel=document.getElementById('engine-loading'),title=document.getElementById('engine-title'),retry=document.getElementById('engine-retry');
const credits=document.getElementById('credits-dialog');
document.getElementById('open-credits').onclick=()=>credits.showModal();
document.getElementById('close-credits').onclick=()=>credits.close();
let ready=false,pending=null,queued=null;
function closeLoading(){panel.close();panel.hidden=true;}
function cancelLoading(){const action=queued;queued=null;closeLoading();action?.focus();}
document.getElementById('engine-cancel').onclick=cancelLoading;
panel.addEventListener('cancel',event=>{event.preventDefault();cancelLoading();});
retry.onclick=()=>location.reload();
document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(ready||!button||!button.hasAttribute('data-enter')||button.closest('#engine-loading'))return;
  event.preventDefault();event.stopImmediatePropagation();queued=button;
  panel.hidden=false;if(!panel.open)panel.showModal();document.getElementById('engine-cancel').focus();retry.hidden=true;title.textContent='Подключаем павильон…';
  if(pending)return;
  pending=import('./app.js?v=7.2').then(()=>{
    ready=true;closeLoading();const action=queued;queued=null;
    if(action?.isConnected)action.click();
  }).catch(error=>{
    console.error(error);pending=null;if(!queued)return;retry.hidden=false;retry.focus();
    title.textContent='Не удалось загрузить павильон. Проверьте соединение и обновите страницу.';
  });
},true);
