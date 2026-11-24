// The same static entry point is used on Pages and by the test server.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.env.MOBOT_LAB_URL || 'http://127.0.0.1:4200/mobot-lab/';

// Exercise the exact batched exhibit with a real WebGL2 renderer. The camera
// and input here are simulated; physical stereo and tracking require a headset.
async function renderXRExhibits(page) {
  const rows=await page.evaluate(async()=>{
    const T=await import('./engine/three.module.min.js');
    const {machines}=await import('./catalog.js');
    const {createXR}=await import('./xr.js');
    const gl=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    gl.setSize(256,192,false);
    const camera=new T.PerspectiveCamera(57,256/192,.02,60);
    camera.position.set(.1,1.55,0);camera.lookAt(.18,1.12,-1.9);
    const controllers=[new T.Group(),new T.Group()];
    let frame,year=1986,model=machines[year].create(T);
    const adapter={
      xr:{getController:i=>controllers[i],setReferenceSpaceType(){},async setSession(){},getReferenceSpace:()=>({})},
      setAnimationLoop:cb=>{frame=cb},render:scene=>gl.render(scene,camera)
    };
    const xr=createXR(adapter,{
      get:()=>({year,name:machines[year].title,root:model.root,ground:model.groundY??machines[year].ground,jointName:'Стрела',value:'0°',toolName:'Схват'}),
      switchModel(){},nextJoint(){},change(){},nextTool(){},reset(){},ended(){}
    });
    const session=new EventTarget();session.requestReferenceSpace=async()=>({});
    const results=[];
    try {
      await xr.start(session);
      for(const next of [1986,1987]){
        year=next;model=machines[year].create(T);machines[year].pose(model,machines[year].initial);xr.modelChanged();
        const tools=year===1987?['gripper','breaker-arm','breaker-loader']:['gripper'];
        for(const tool of tools){
          if(year===1987)model.mechanisms.setWorkTool(tool);
          xr.poseChanged();frame(0);
          results.push({year,tool,calls:gl.info.render.calls,triangles:gl.info.render.triangles,glError:gl.getContext().getError()});
        }
      }
    } finally {session.dispatchEvent(new Event('end'));gl.dispose()}
    return results;
  });
  for(const frame of rows){
    assert(frame.triangles>1000 && frame.calls>0);
    assert.equal(frame.glError,0,JSON.stringify(frame));
  }
  console.log('Four XR exhibit configurations rendered through WebGL2:',JSON.stringify(rows));
}

async function vrAvailability(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  try {
    await page.addInitScript(()=>{
      const xr=new EventTarget(),checks=[];
      window.vrRequests=0;window.vrChecks=checks;
      xr.isSessionSupported=()=>new Promise(resolve=>checks.push(resolve));
      xr.requestSession=()=>{window.vrRequests++;return Promise.reject(new DOMException('Denied','NotAllowedError'))};
      Object.defineProperty(navigator,'xr',{value:xr,configurable:true});
    });
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.vrChecks.length===1);
    const vr=page.locator('#vr'),dialog=page.locator('#dialog');
    assert.equal(await vr.innerText(),'Как открыть в VR');
    await vr.click();
    assert((await dialog.innerText()).includes('можно изучать на этой странице без шлема'));
    const link=new URL(await page.locator('#shareURL').inputValue());
    assert.equal(link.pathname,'/vr_anapa/mobot-lab/');
    await dialog.press('Escape');assert(await vr.evaluate(el=>el===document.activeElement));
    assert.equal(await page.evaluate(()=>window.vrRequests),0);
    await page.evaluate(()=>navigator.xr.dispatchEvent(new Event('devicechange')));
    await page.waitForFunction(()=>window.vrChecks.length===2);
    await page.evaluate(()=>window.vrChecks[1](true));
    await page.waitForFunction(()=>document.querySelector('#vrLabel').textContent==='Войти в VR');
    await page.evaluate(async()=>{window.vrChecks[0](false);await Promise.resolve()});
    assert.equal(await vr.innerText(),'Войти в VR');
    await vr.click();
    assert((await dialog.innerText()).includes('разрешите сеанс VR'));
    assert.equal(await page.evaluate(()=>window.vrRequests),1);
    await dialog.press('Escape');
    await page.evaluate(()=>navigator.xr.dispatchEvent(new Event('devicechange')));
    await page.waitForFunction(()=>window.vrChecks.length===3);
    await page.evaluate(()=>window.vrChecks[2](false));
    await page.waitForFunction(()=>document.querySelector('#vrLabel').textContent==='Как открыть в VR');
    console.log('VR setup without a headset, device changes, stale result, permission denial and focus return passed');
  } finally {await page.close()}
}

async function sharingClipboard(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.addInitScript(()=>{
      window.writes=[];
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:value=>
        new Promise((resolve,reject)=>window.writes.push({value,resolve,reject}))}});
    });
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    const share=page.locator('#share'),dialog=page.locator('#dialog'),copy=page.locator('#copyLink');
    await share.click();
    await copy.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.writes.length===1);
    await page.evaluate(()=>window.writes[0].reject(new DOMException('Denied','NotAllowedError')));
    await page.waitForFunction(()=>document.querySelector('#copyStatus').textContent.includes('вручную'));
    assert(await page.locator('#shareURL').evaluate(el=>document.activeElement===el&&el.selectionStart===0&&el.selectionEnd===el.value.length));
    await dialog.press('Escape');

    await share.click();await copy.click();
    await page.waitForFunction(()=>window.writes.length===2);
    await dialog.press('Escape');
    await page.locator('[data-year="1987"]').click();
    await share.click();
    await page.evaluate(async()=>{window.writes[1].reject(new DOMException('Denied','NotAllowedError'));await Promise.resolve()});
    assert.equal(await page.locator('#copyStatus').innerText(),'');
    assert(await page.locator('#closeDialog').evaluate(el=>document.activeElement===el));
    await copy.click();
    await page.waitForFunction(()=>window.writes.length===3);
    assert.equal(await page.evaluate(()=>new URL(window.writes[2].value).searchParams.get('model')),'1987');
    await page.evaluate(()=>window.writes[2].resolve());
    await page.waitForFunction(()=>document.querySelector('#copyStatus').textContent==='Ссылка скопирована.');
    assert.deepEqual(errors,[]);
    console.log('Share dialog handles clipboard success, manual copy and stale results without losing focus');
  } finally {await page.close()}
}

async function compactControls(browser) {
  const page=await browser.newPage({viewport:{width:320,height:680},hasTouch:true,reducedMotion:'reduce'});
  try {
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    await page.evaluate(()=>document.fonts.ready);
    const area=await page.locator('#stage').boundingBox();
    const canvas=await page.locator('#surface canvas').boundingBox();
    const views=await page.locator('.view-controls').boundingBox();
    const zoom=await page.locator('.zoom').boundingBox();
    assert(views.x>=area.x && views.x+views.width<=area.x+area.width,'Views must not be clipped at 320px');
    assert(zoom.x>=area.x && zoom.x+zoom.width<=area.x+area.width,'Zoom must not be clipped at 320px');
    assert(views.y+views.height<=zoom.y,'Zoom and views must never overlap');
    assert(canvas.y+canvas.height<=views.y,'Controls must not cover the model');
    await page.locator('[data-view="top"]').click();
    assert.equal(await page.locator('[data-view="top"]').getAttribute('aria-pressed'),'true');
    await page.locator('#in').click();
    await page.locator('[data-year="1987"]').click();
    await page.locator('#tab-photo').click();
    await page.locator('[data-filter="1987"]').click();
    assert.equal(await page.locator('[data-filter="1987"]').getAttribute('aria-pressed'),'true');
    assert(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No page overflow at 320px');
    console.log('320px touch: views and zoom fully reachable without overlap; model, comparison and archive work');
  } finally {await page.close()}
}

async function exercise(browser, width, height, software) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<600,reducedMotion:'reduce'});
  try {
    if(software) await context.addInitScript(()=>{
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args)};
    });
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    for(const credit of ['sktb','rgsu']){
      const badge=page.locator('.credit-'+credit);
      assert(await badge.isVisible());
      await badge.locator('img').evaluate(img=>img.decode());
      assert(await badge.locator('strong').isVisible());
      const box=await badge.boundingBox();assert(box.width>=44&&box.height>=44);
    }
    assert(await page.locator('.bar .navlab').isVisible());
    assert(await page.locator('.bar .navarch').isVisible());
    assert.equal(await page.locator('#surface').evaluate(s=>s.classList.contains('software')),software);
    const canvas=page.locator('#surface canvas');
    assert.equal(await canvas.getAttribute('aria-describedby'),'hint keyboardHelp');
    await canvas.focus();
    const shortcuts=await canvas.evaluate(el=>{
      const press=(key,mods={})=>el.dispatchEvent(new KeyboardEvent('keydown',{key,...mods,bubbles:true,cancelable:true}));
      return [press('=',{ctrlKey:true}),press('-', {metaKey:true}),press('ArrowLeft',{altKey:true}),press('ArrowLeft'),press('Home')];
    });
    assert.deepEqual(shortcuts,[true,true,true,false,false]);
    assert.equal(await page.locator('#workbench').getAttribute('data-mode'),'drive');
    assert.equal(await page.locator('#workbench').getAttribute('tabindex'),null);
    await page.locator('#tab-drive').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-parts').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#tab-drive').getAttribute('aria-selected'),'true');
    assert(await page.locator('#keyboardHelp').textContent().then(t=>t.includes('стрелки')));
    if(width===1440)await renderXRExhibits(page);
    if(width===390){
      const archiveJump=page.locator('.navarch'), labJump=page.locator('#archiveReturn');
      await archiveJump.focus();await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash,'#archive');
      assert(await page.locator('#archive').evaluate(el=>el===document.activeElement));
      assert(await page.locator('#archiveTitle').evaluate(el=>el.getBoundingClientRect().top<innerHeight));
      await page.locator('#expandArchive').click();
      assert.equal(await page.locator('#archiveCards .photo-card').count(),10);
      await labJump.click();
      assert.equal(new URL(page.url()).hash,'#lab');
      assert(await page.locator('#lab').evaluate(el=>el===document.activeElement));
      await page.locator('#expandArchive').click(); // restore collapsed archive for the remaining checks
      console.log('Archive entry and return from all ten photos move viewport and focus');
    }
    if(width===1440||width===390){
      const compare=page.locator('#compareModels'),dialog=page.locator('#dialog');
      for(const [year,index] of [[1987,'3'],[1986,'1']]){
        await compare.click();
        assert.equal(await dialog.locator('.model-compare-card').count(),2);
        for(const image of await dialog.locator('.model-compare-card img').all())await image.evaluate(img=>img.decode());
        assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
        await dialog.locator('[data-compare-year="'+year+'"]').click();
        assert.equal(await page.locator('[data-year="'+year+'"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#photoSelect').inputValue(),index);
        assert(await page.locator('#tab-photo').evaluate(el=>el===document.activeElement));
      }
      await page.locator('#tab-drive').click();
      console.log('Two dated comparison cards link to the correct matched photos and model');
    }
    const before=await page.locator('#surface canvas').screenshot();
    await page.locator('[data-view="side"]').click();
    const after=await page.locator('#surface canvas').screenshot();assert(!before.equals(after));
    await page.locator('[data-year="1987"]').click();
    await page.locator('#tool').selectOption('breaker-loader');
    assert.equal(await page.locator('#j-bucket').inputValue(),'36');
    assert(await page.locator('#j-claw').isDisabled());
    await page.locator('#demo').click();
    await page.waitForFunction(()=>Number(document.querySelector('#j-yaw').value)>0);
    await page.locator('#demo').click();assert.equal(await page.locator('#demo').getAttribute('aria-pressed'),'false');
    await page.locator('#tab-photo').click();
    await page.locator('#photoSelect').selectOption('3');
    await page.locator('#overlayToggle').check();
    assert.equal(await page.locator('#panel-photo .registration polyline').count(),2);
    await page.locator('#photoEnlarge').click();assert(await page.locator('#dialog').isVisible());
    await page.locator('#dialog').press('Escape');await page.locator('#share').click();
    const shared=new URL(await page.locator('#shareURL').inputValue());
    assert.equal(shared.searchParams.get('tool'),'breaker-arm');
    assert.equal(shared.searchParams.get('photo'),'1987-breaker');
    await page.waitForFunction(()=>document.querySelector('#qr')?.width>100 && document.querySelector('#qr')?.height===document.querySelector('#qr')?.width);
    await page.goto(base+shared.search);await page.locator('#poster').waitFor({state:'hidden'});
    assert.equal(await page.locator('#photoSelect').inputValue(),'3');
    assert(await page.locator('#overlayToggle').isChecked());
    await page.locator('#tab-parts').click();await page.locator('#partChoices [data-part="tool"]').click();
    const closeup=page.locator('#closeup');
    if(width===1440){
      await closeup.focus();await page.keyboard.press('Enter');
      assert(await closeup.evaluate(el=>el===document.activeElement),'Close-up must retain keyboard focus');
      await page.keyboard.press('Tab');
      assert(await page.locator('.part-actions a').evaluate(el=>el===document.activeElement));
      console.log('Keyboard close-up retains focus and Tab reaches the source');
    }else await closeup.click();
    assert(await page.locator('#markers [data-part="tool"]').isVisible());
    await page.locator('#tab-drive').click();await page.locator('#reset').click();
    await page.locator('#expandArchive').click();assert.equal(await page.locator('.photo-card').count(),10);
    await page.locator('[data-filter="1986"]').click();assert.equal(await page.locator('.photo-card').count(),4);
    if(width===1440) {
      const card=page.locator('.photo-card[data-gallery="1986"][data-index="1"]');
      await card.click();
      const dialog=page.locator('#dialog');
      await page.locator('#galleryMarks').click();
      assert.equal(await dialog.locator('svg.registration').count(),1);
      await page.locator('#nextPhoto').click();
      assert((await dialog.locator('h2').innerText()).includes('Пост оператора'));
      assert.equal(await dialog.locator('svg.registration').count(),0);
      const free=await dialog.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true})));
      assert(free,'Browser Back shortcut must remain available');
      assert((await dialog.locator('h2').innerText()).includes('Пост оператора'));
      await page.keyboard.press('ArrowLeft');
      assert((await dialog.locator('h2').innerText()).includes('Грейфер над фронтальным ковшом'));
      assert.equal(await dialog.locator('svg.registration').count(),1,'Marks remain enabled across unaligned photos');
      assert(await page.locator('#prevPhoto').evaluate(el=>el===document.activeElement));
      await dialog.press('Escape');
      assert(await card.evaluate(el=>el===document.activeElement));
      console.log('Archive retains marks across reference-only photos and honors browser Back and focus');
    }
    assert(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await page.locator('#offline').click();
    await page.waitForFunction(()=>document.querySelector('#offlineStatus').textContent.includes('сохранены'));
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);
    const offline=await page.goto(base+'?model=1986&mode=photo&photo=1986-fig9&marks=1');
    assert(offline.fromServiceWorker());await page.locator('#poster').waitFor({state:'hidden'});
    assert.equal(await page.locator('#photoSelect').inputValue(),'1');
    await page.locator('[data-year="1987"]').click();
    await page.locator('#photoSelect').selectOption('2');
    await page.waitForFunction(()=>document.querySelector('#photoEnlarge img').naturalWidth>800);
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' · '+(software?'software rasterizer':'WebGL2')+' · views, tool motion, archive, links and offline navigation passed');
  } finally {await context.close()}
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.MOBOT_CHROME_CHANNEL || undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    await exercise(browser,1440,960,false);
    await exercise(browser,390,844,false);
    await exercise(browser,360,800,true);
    await compactControls(browser);
    await vrAvailability(browser);
    await sharingClipboard(browser);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
