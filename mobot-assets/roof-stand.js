import * as T from './three.module.min.js';
import {OrbitControls} from './controls/OrbitControls.js';
import {makeRasterRenderer} from './orthographic-raster.js';
import {makeRoofScene} from './roof-scene.js';
import {initialState,steps,advance,canOperate,progress} from './roof-operation.js';
import {setupXR} from './roof-xr.js';

const $=id=>document.getElementById(id);
function start(){
  const canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label','Участок кровли с роботом, обломками и размеченной площадкой выгрузки');
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,xrCompatible:true});
  let gpu=null,software=null;
  if(gl){
    gpu=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true});
    gpu.setClearColor(0,0);gpu.toneMapping=T.ACESFilmicToneMapping;gpu.toneMappingExposure=1.25;
  }else software=makeRasterRenderer(canvas);
  $('surface').append(canvas);
  const {world,scene,update}=makeRoofScene();
  const camera=new T.OrthographicCamera(-5,5,2.7,-2.7,.05,80);
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=2.6;controls.maxPolarAngle=Math.PI*.48;
  let state=initialState(),command=null,lastTime=0,frame=0,view='overview',lastStep=-1;
  let w=1,h=1,followX=state.x,capture=null,fastFrame=false;
  const buttons=[...document.querySelectorAll('[data-command]')];
  const viewButtons=[...document.querySelectorAll('[data-view]')];
  const bars=[...document.querySelectorAll('.progress i')];
  function orbitPreset(){
    const target=view==='tool'?[state.x-.86,.66,0]:[-.05,.54,0];
    const direction=view==='plan'?[0,9,.002]:view==='tool'?[-3.6,1.8,5.8]:[-1.7,4.15,7.65];
    controls.target.fromArray(target);camera.position.fromArray(direction).add(controls.target);
    camera.zoom=1;followX=state.x;controls.update();resize();
    for(const b of viewButtons)b.setAttribute('aria-pressed',String(b.dataset.view===view));
  }
  function resize(){
    if(gpu?.xr.isPresenting)return;
    const bounds=$('surface').getBoundingClientRect();w=bounds.width;h=bounds.height;if(!w||!h)return;
    const ratio=software?Math.min(devicePixelRatio,(fastFrame?640:970)/w,(fastFrame?470:780)/h):Math.min(1.65,devicePixelRatio);
    const rw=Math.max(1,Math.round(w*ratio)),rh=Math.max(1,Math.round(h*ratio));
    if(gpu)gpu.setSize(rw,rh,false);else software.resize(rw,rh);
    const aspect=w/h,span=view==='tool'?Math.max(2.6,3.6/aspect):Math.max(4.2,10.65/aspect);
    camera.left=-span*aspect/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;
    camera.updateProjectionMatrix();schedule();
  }
  function show(){
    const current=steps[state.step];
    if(lastStep!==state.step){
      $('counter').textContent=current?'ДЕЙСТВИЕ '+(state.step+1)+' / '+steps.length:'ГОТОВО · 5 / 5';
      $('stepName').textContent=current?current.name:'Площадка расчищена';
      $('hint').textContent=current?current.hint:'Все три фрагмента доставлены в зону выгрузки.';
      $('again').hidden=!!current;$('controlHint').hidden=!current;
      lastStep=state.step;
    }
    for(const b of buttons){
      const id=b.dataset.command;b.disabled=!canOperate(state,id);
      b.classList.toggle('recommended',current?.action===id&&!state.dropping);
      b.classList.toggle('held',command===id);
    }
    for(const [i,bar]of bars.entries()){
      bar.classList.toggle('done',i<state.step);bar.classList.toggle('active',i===state.step);
      if(i===state.step)bar.style.setProperty('--fill',Math.max(3,progress(state)*100)+'%');
    }
  }
  function tick(dt){
    const before=state.step;
    if(!command&&!state.dropping)return;
    // Keep exhibit motion tied to elapsed time even on a slow software renderer.
    let remaining=Math.min(dt,.8);
    while(remaining>0 && state.step===before){
      const part=Math.min(.15,remaining);
      advance(state,command,part);remaining-=part;
    }
    // A held button cannot operate the next station until it has been released.
    if(before!==state.step||state.dropping)command=null;
    if(view==='tool'){
      const delta=state.x-followX;
      controls.target.x+=delta;camera.position.x+=delta;followX=state.x;
    }
    update(state);show();
  }
  function draw(time){
    frame=0;if(gpu?.xr.isPresenting)return;
    const moving=!!command||state.dropping;
    if(software&&fastFrame!==moving){fastFrame=moving;resize();}
    const dt=lastTime?Math.min(.8,(time-lastTime)/1000):0;lastTime=time;
    tick(dt);controls.update();
    if(gpu)gpu.render(scene,camera);else software.render(world,camera);
    $('load').hidden=true;
    if(command||state.dropping)schedule();else lastTime=0;
  }
  function schedule(){if(!frame&&!gpu?.xr.isPresenting)frame=requestAnimationFrame(draw);}
  function press(id){
    if(!canOperate(state,id))return;
    command=id;tick(.13);show();schedule();
  }
  function release(){
    command=null;capture=null;show();schedule();
  }
  function reset(){
    command=null;capture=null;state=initialState();lastStep=-1;update(state);show();
    if(!gpu?.xr.isPresenting){view='overview';orbitPreset();}
  }
  for(const b of buttons){
    const id=b.dataset.command;
    b.addEventListener('pointerdown',e=>{
      if(e.button!==0||capture!==null)return;
      e.preventDefault();capture=e.pointerId;b.setPointerCapture(e.pointerId);press(id);
    });
    for(const evt of ['pointerup','pointercancel','lostpointercapture'])
      b.addEventListener(evt,e=>{if(e.pointerId===capture)release();});
    b.addEventListener('keydown',e=>{
      if(e.key!==' '&&e.key!=='Enter')return;e.preventDefault();if(!e.repeat)press(id);
    });
    b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release();}});
    b.addEventListener('blur',()=>{if(command===id)release();});
    // Assistive technology can invoke the click action without pointer or key events.
    b.addEventListener('click',e=>{if(e.detail===0){press(id);release();}});
  }
  for(const b of viewButtons)b.onclick=()=>{view=b.dataset.view;orbitPreset();};
  $('reset').onclick=reset;$('again').onclick=reset;
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  controls.addEventListener('change',schedule);
  new ResizeObserver(resize).observe($('surface'));
  reset();
  setupXR({renderer:gpu,scene,world,button:$('vr'),notice:$('vrInfo'),
    getState:()=>state,press,release,reset,tick,resume:()=>{update(state);orbitPreset();}});
}
try{start();}catch(error){
  console.error(error);$('load').innerHTML='Стенд не загрузился. <a href="./mobot-latest.html">Вернуться к модели</a>';
}
