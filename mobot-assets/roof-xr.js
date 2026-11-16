import * as T from './three.module.min.js';
import {steps} from './roof-operation.js';

const pairs={drive:[['back','Назад'],['forward','Вперёд']],lift:[['lower','Опустить'],['raise','Поднять']],tip:[['curl','Вернуть'],['dump','Наклонить']]};
const buttons=[{x:24,y:150,w:358,h:87},{x:394,y:150,w:350,h:87},
  {x:24,y:251,w:358,h:62},{x:394,y:251,w:350,h:62}];

export async function setupXR({renderer,scene,world,button,notice,getState,press,release,reset,tick,resume}){
  let supported=false;
  try{supported=!!renderer&&!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch{}
  button.disabled=false;
  if(!supported){
    button.textContent='О VR-режиме';button.setAttribute('aria-expanded','false');
    button.onclick=()=>{notice.hidden=!notice.hidden;button.setAttribute('aria-expanded',String(!notice.hidden));
      notice.textContent='Для VR откройте эту страницу в браузере шлема с WebXR, например Meta Quest. На экране доступны те же пять действий.';};
    return;
  }
  renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.xr.setFramebufferScaleFactor(.79);
  const view=new T.PerspectiveCamera(53,1,.025,30),panelCanvas=document.createElement('canvas');
  panelCanvas.width=768;panelCanvas.height=330;
  const ctx=panelCanvas.getContext('2d'), texture=new T.CanvasTexture(panelCanvas);
  texture.colorSpace=T.SRGBColorSpace;
  const panel=new T.Mesh(new T.PlaneGeometry(1.10,.473),new T.MeshBasicMaterial({map:texture,side:T.FrontSide,toneMapped:false}));
  panel.position.set(0,-.37,-1.23);panel.rotation.x=-.23;panel.visible=false;scene.add(panel);
  const ray=new T.Raycaster(), controllers=[],aims=new Map();
  let modalSession=null,hover=-1,armed=null,signature='',exiting=false;
  function redraw(){
    const s=getState(),step=steps[s.step],choices=step?pairs[step.axis]:[];
    const key=[s.step,s.dropping,hover].join(':');if(key===signature)return;signature=key;
    ctx.fillStyle='#e9e8dc';ctx.fillRect(0,0,768,330);
    ctx.fillStyle='#894020';ctx.font='bold 22px sans-serif';ctx.fillText(step?'ДЕЙСТВИЕ '+(s.step+1)+' / 5':'СЦЕНАРИЙ ЗАВЕРШЁН',25,37);
    ctx.fillStyle='#23322c';ctx.font='bold 38px sans-serif';ctx.fillText(step?step.name:'Площадка расчищена',24,85);
    ctx.font='22px sans-serif';ctx.fillText(s.dropping?'Идёт выгрузка':step?'Наведите луч и удерживайте курок контроллера.':'Можно повторить работу погрузчика.',25,124);
    const labels=[choices[0]?.[1]||'—',choices[1]?.[1]||'—','Начать сначала','Выйти из VR'];
    buttons.forEach((r,i)=>{
      const active=step&&i<2&&choices[i][0]===step.action;
      ctx.fillStyle=i===hover?'#805237':active?'#934421':i<2?'#48584e':'#d2d4c6';
      ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle=i<2||i===hover?'#fffaf0':'#27372d';
      ctx.font=(i<2?'bold 31':'25')+'px sans-serif';ctx.textAlign='center';
      ctx.fillText(labels[i],r.x+r.w/2,r.y+r.h/2+9);ctx.textAlign='left';
    });texture.needsUpdate=true;
  }
  function hit(controller){
    controller.updateWorldMatrix(true,false);const matrix=new T.Matrix4().extractRotation(controller.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    ray.ray.direction.set(0,0,-1).applyMatrix4(matrix);
    const point=ray.intersectObject(panel,false)[0];if(!point)return -1;
    const x=point.uv.x*768,y=(1-point.uv.y)*330;
    return buttons.findIndex(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  }
  for(let i=0;i<2;i++){
    const c=renderer.xr.getController(i);
    const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-2.5)]),new T.LineBasicMaterial({color:0xffb773}));
    c.add(line);scene.add(c);controllers.push(c);c.visible=false;
    c.addEventListener('connected',()=>aims.set(c,true));
    c.addEventListener('selectstart',()=>{
      if(armed||!modalSession)return;
      const i=hit(c),s=getState();if(i===2){reset();return;}
      if(i===3){if(!exiting){exiting=true;modalSession.end().catch(()=>{exiting=false;});}return;}
      const pair=pairs[steps[s.step]?.axis];if(i<0||!pair||s.dropping)return;
      armed=c;press(pair[i][0]);
    });
    const lift=()=>{if(armed===c){release();armed=null;}};
    c.addEventListener('selectend',lift);c.addEventListener('disconnected',()=>{aims.delete(c);lift();});
  }
  const previousBackground=scene.background;
  function restore(){
    renderer.setAnimationLoop(null);release();armed=null;hover=-1;signature='';exiting=false;modalSession=null;
    panel.visible=false;for(const c of controllers)c.visible=false;
    scene.background=previousBackground;world.position.set(0,0,0);world.scale.setScalar(1);
    button.disabled=false;button.textContent='Войти в VR';resume();
  }
  button.onclick=async()=>{
    if(modalSession)return;
    button.disabled=true;let session;
    try{
      session=await navigator.xr.requestSession('immersive-vr');
      modalSession=session;
      await renderer.xr.setSession(session);
      session.addEventListener('end',restore,{once:true});
      release();button.textContent='VR включён';notice.hidden=true;
      world.scale.setScalar(.315);world.position.set(0,-.64,-2.18);
      panel.visible=true;scene.background=new T.Color(0x24322f);renderer.xr.setFoveation(.75);
      let last=0;
      renderer.setAnimationLoop(time=>{
        const dt=last?Math.min(.12,(time-last)/1000):0;last=time;tick(dt);
        let active=-1;
        for(const c of controllers){if(!c.visible||!aims.has(c))continue;const i=hit(c);if(i>=0)active=i;}
        hover=active;redraw();renderer.render(scene,view);
      });
    }catch(error){
      if(session){try{await session.end();}catch{}}
      restore();notice.hidden=false;notice.textContent='Не удалось начать VR-сеанс. Проверьте доступ к шлему и нажмите «Войти в VR» ещё раз.';
    }
  };
}
