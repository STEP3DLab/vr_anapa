// The same static entry point is used on Pages and by the test server.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.env.MOBOT_LAB_URL || 'http://127.0.0.1:4200/mobot-lab/';

// Compare decoded image pixels rather than the PNG encoding. Detached canvases
// keep this measurement out of the page layout and the viewer's resize events.
async function screenshotDifference(page, before, after) {
  return page.evaluate(async urls => {
    const images = await Promise.all(urls.map(async src => {
      const image = new Image();image.src = src;await image.decode();return image;
    }));
    const sizes = images.map(image => ({width:image.naturalWidth,height:image.naturalHeight}));
    const sameSize = sizes[0].width === sizes[1].width && sizes[0].height === sizes[1].height;
    if (!sameSize) return {sizes,sameSize,rms:null,changedPixelFraction:null};
    const data = images.map(image => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');context.drawImage(image,0,0);
      return context.getImageData(0,0,canvas.width,canvas.height).data;
    });
    let squared = 0, changed = 0, significant = 0, maximum = 0;
    for (let i = 0; i < data[0].length; i += 4) {
      let pixelChanged = false, pixelSignificant = false;
      for (let channel = 0; channel < 3; channel++) {
        const difference = data[0][i+channel] - data[1][i+channel];
        squared += difference*difference;
        pixelChanged ||= difference !== 0;
        pixelSignificant ||= Math.abs(difference) > 2;
        maximum = Math.max(maximum,Math.abs(difference));
      }
      if (pixelChanged) changed++;
      if (pixelSignificant) significant++;
    }
    const pixels = sizes[0].width*sizes[0].height;
    return {sizes,sameSize,rms:Math.sqrt(squared/(pixels*3)),changedPixelFraction:changed/pixels,significantPixelFraction:significant/pixels,maximum};
  }, [before,after].map(buffer => 'data:image/png;base64,'+buffer.toString('base64')));
}

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

async function consolidatedSceneTransitions(browser) {
  const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.addInitScript(()=>{
      window.copiedLinks=[];
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedLinks.push(value)}}});
      const xr=new EventTarget();xr.isSessionSupported=async()=>false;
      Object.defineProperty(navigator,'xr',{configurable:true,value:xr});
    });
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    const dialog=page.locator('#dialog');
    const sceneKeys=['model','mode','pose','tool','part','isolate','view','z','detail'];
    const sceneFields=url=>Object.fromEntries(sceneKeys.map(key=>[key,url.searchParams.get(key)]));
    const shareURL=async()=>{
      await page.locator('#share').click();
      const url=new URL(await page.locator('#shareURL').inputValue());
      assert(!url.searchParams.has('compare')&&!url.searchParams.has('dual'),'Ordinary sharing must not request the comparison');
      await dialog.press('Escape');return url;
    };
    const cameraFields=url=>['view','z'].map(key=>url.searchParams.get(key));
    const poseFields=()=>page.locator('#joints input,#moreJoints input').evaluateAll(inputs=>
      Object.fromEntries(inputs.map(input=>[input.id,input.value])));

    // Give the machines deliberately different cameras through their controls.
    await page.locator('[data-view="side"]').click();
    await page.locator('#in').click();await page.locator('#in').click();
    const firstCamera=cameraFields(await shareURL());
    assert.equal(firstCamera[0],'side');assert(Number(firstCamera[1])>1);
    await page.locator('[data-year="1987"]').click();
    await page.locator('#tool').selectOption('breaker-arm');
    await page.locator('#j-yaw').press('ArrowRight');await page.locator('#j-arm').press('ArrowRight');
    await page.locator('[data-view="front"]').click();await page.locator('#in').click();
    const secondCamera=cameraFields(await shareURL());
    assert.equal(secondCamera[0],'front');assert(Number(secondCamera[1])>1);
    assert.notEqual(firstCamera[1],secondCamera[1]);
    for(const mode of ['drive','parts']) {
      await page.locator('#tab-'+mode).click();
      for(const [year,camera] of [[1986,firstCamera],[1987,secondCamera]]) {
        await page.locator('[data-year="'+year+'"]').click();
        assert.equal(await page.locator('#workbench').getAttribute('data-mode'),mode);
        assert.deepEqual(cameraFields(await shareURL()),camera,'Each robot retains its view and zoom in '+mode);
      }
    }

    // Keep the full scene in the page URL; the inline sharing link is intentionally clean.
    await page.locator('#partChoices [data-part="tool"]').click();
    await page.locator('#isolatePart').click();
    const mainScene=await shareURL(), expectedPose=await poseFields();
    assert.equal(mainScene.searchParams.get('mode'),'parts');
    assert.equal(mainScene.searchParams.get('tool'),'breaker-arm');
    assert.equal(mainScene.searchParams.get('part'),'tool');
    assert.equal(mainScene.searchParams.get('isolate'),'1');
    await page.locator('#compareModels').click();
    await page.waitForURL(url=>url.searchParams.get('compare')==='1');
    const fullComparisonURL=new URL(page.url());
    assert.equal(fullComparisonURL.searchParams.has('dual'),false,'Comparison state uses the canonical flag');
    assert.deepEqual(sceneFields(fullComparisonURL),sceneFields(mainScene));
    await page.locator('#dualShare > summary').click();
    await page.waitForFunction(()=>document.querySelector('#dualURL')?.value);
    const dualURL=new URL(await page.locator('#dualURL').inputValue());
    assert.equal(dualURL.search,'?compare=1','Inline sharing must use the clean comparison URL');
    assert.equal(dualURL.hash,'');
    await page.waitForFunction(()=>document.querySelector('#dualQR')?.width>100 && document.querySelector('#dualQR').height===document.querySelector('#dualQR').width);
    await page.locator('#dualCopy').click();
    await page.waitForFunction(url=>window.copiedLinks.at(-1)===url,dualURL.href);
    assert.equal(await page.locator('#dualCopyStatus').innerText(),'Ссылка скопирована.');

    // Reload the full page address, not the clean public comparison link.
    const reloadURL=new URL(base);reloadURL.search=fullComparisonURL.search;
    await page.goto(reloadURL.href);await page.locator('#dialog.dual-dialog').waitFor();
    await page.reload();await page.locator('#dialog.dual-dialog').waitFor();
    await page.locator('#poster').waitFor({state:'hidden'});
    assert.equal(await dialog.locator('.dual-surface canvas').count(),2);
    await dialog.press('Escape');
    await page.waitForURL(url=>!url.searchParams.has('compare')&&!url.searchParams.has('dual'));
    await page.locator('.dual-surface canvas').first().waitFor({state:'detached'});
    assert.equal(await page.locator('#workbench').getAttribute('data-mode'),'parts');
    assert.equal(await page.locator('#tool').inputValue(),'breaker-arm');
    assert.equal(await page.locator('#partChoices [aria-pressed="true"]').getAttribute('data-part'),'tool');
    assert.equal(await page.locator('#isolatePart').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await poseFields(),expectedPose);
    assert.deepEqual(sceneFields(await shareURL()),sceneFields(mainScene));
    await page.locator('#vr').click();
    const vrURL=new URL(await page.locator('#shareURL').inputValue());
    assert(!vrURL.searchParams.has('compare')&&!vrURL.searchParams.has('dual'),'VR handoff must share the single-model scene');
    await dialog.press('Escape');

    await page.locator('#compareModels').click();
    await page.locator('[data-dual-open="1986"]').click();
    await dialog.waitFor({state:'hidden'});
    await page.locator('.dual-surface canvas').first().waitFor({state:'detached'});
    assert.equal(await page.locator('[data-year="1986"]').getAttribute('aria-pressed'),'true');
    assert(await page.locator('#tab-drive').evaluate(el=>el===document.activeElement),'Selecting a comparison model must focus its control tab');
    for(const year of [1987,1986]) {
      await page.locator('[data-research-model="'+year+'"]').click();
      assert.equal(await page.locator('#tab-drive').getAttribute('aria-selected'),'true');
      assert(await page.locator('[data-year="'+year+'"]').evaluate(el=>el===document.activeElement),'Materials must focus the selected model button');
      const passport=page.locator('[data-research-passport="'+year+'"]');
      await passport.click();
      const download=dialog.locator('a[download]');
      assert.equal(await download.count(),1);
      assert.equal(await download.getAttribute('href'),'./data/'+year+'-passport.json');
      assert.notEqual(await download.getAttribute('download'),null);
      await dialog.press('Escape');assert(await passport.evaluate(el=>el===document.activeElement));
    }
    const archives=page.locator('#researchContent .download-grid a.download-card');
    assert.equal(await archives.count(),2);
    for(const archive of await archives.all()) {
      assert.equal(await archive.getAttribute('target'),'_blank');
      assert((await archive.getAttribute('rel')).split(/\s+/).includes('noopener'));
      assert(new URL(await archive.getAttribute('href'),page.url()).searchParams.get('file').endsWith('.zip'));
    }
    // Start without saved per-model state: the first photo transition must
    // preserve A's free camera before the registered photo replaces it.
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    await page.locator('[data-view="side"]').click();
    await page.locator('#in').click();await page.locator('#in').click();
    const beforeFirstPhoto=cameraFields(await shareURL());
    await page.locator('#tab-photo').click();
    await page.locator('[data-year="1987"]').click();
    await page.locator('#tab-drive').click();
    await page.locator('[data-year="1986"]').click();
    assert.equal(await page.locator('#workbench').getAttribute('data-mode'),'drive');
    assert.deepEqual(cameraFields(await shareURL()),beforeFirstPhoto,
      'A drive → first photo → B → drive → A must restore A\'s free camera');
    assert.deepEqual(errors,[]);
    console.log('Shared dual view survives reload and restores its scene; per-model cameras, selection focus and material download attributes pass');
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

async function fullscreenFallback(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  try {
    await page.addInitScript(()=>{
      HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('Native fullscreen unavailable'));
    });
    await page.goto(base);await page.locator('#poster').waitFor({state:'hidden'});
    const bench=page.locator('#workbench'),button=page.locator('#fullscreen'),archive=page.locator('.navarch');
    await button.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#fullscreen').getAttribute('aria-pressed')==='true');
    assert(await bench.evaluate(el=>el.classList.contains('full-window')));
    assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).overflowY),'hidden');
    assert(await page.locator('#archive').evaluate(el=>el.inert),'Archive must not be reachable behind the full-window viewer');
    assert(await archive.evaluate(el=>{el.focus();return document.activeElement!==el}),'Keyboard focus escaped behind the viewer');
    assert(await page.locator('#dialog').evaluate(el=>!el.inert),'Dialog must not be isolated with the background');
    await page.locator('[data-year="1987"]').click();
    assert.equal(await page.locator('[data-year="1987"]').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-pressed'),'false');
    assert(await button.evaluate(el=>document.activeElement===el),'Escape must return focus to the full-screen button');
    assert(!await page.locator('#archive').evaluate(el=>el.inert));
    await archive.focus();assert(await archive.evaluate(el=>document.activeElement===el));
    await button.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#fullscreen').getAttribute('aria-pressed')==='true');
    await button.click();assert.equal(await button.getAttribute('aria-pressed'),'false');
  } finally {await page.close()}
  console.log('Full-window fallback blocks the background, preserves model controls, and restores focus on exit');
}

async function offlineUpdate(browser) {
  for(const scenario of ['same','updated','update-failed','save-failed']){
    const context=await browser.newContext();
    try {
      await context.addInitScript(scenario=>{
        window.refreshes=0;
        const scriptURL=new URL('./offline-worker.js',location.href).href;
        function makeWorker(state){
          return Object.assign(new EventTarget(),{state,scriptURL,postMessage(message,[port]){
            window.refreshes++;port.postMessage({saved:message==='refresh-exhibition'});port.close();
          }});
        }
        const registration={active:scenario==='save-failed'?null:makeWorker('activated'),installing:null,waiting:null,async update(){
          if(scenario==='update-failed')throw new Error('offline');
          if(scenario!=='updated')return;
          const next=makeWorker('installing');this.installing=next;
          setTimeout(()=>{
            next.state='activated';this.active=next;this.installing=null;
            next.dispatchEvent(new Event('statechange'));
          },25);
        }};
        Object.defineProperty(navigator,'serviceWorker',{value:{
          getRegistration:async()=>registration,register:async()=>{
            if(scenario==='save-failed')throw new Error('offline');
            return registration;
          }
        }});
      },scenario);
      const page=await context.newPage();await page.goto(base);
      if(scenario!=='save-failed')await page.waitForFunction(()=>document.querySelector('#offline').textContent.includes('Обновить'));
      await page.locator('#offline').click();
      const expected={same:'сохранены',updated:'сохранены','update-failed':'Предыдущая автономная версия остаётся активной','save-failed':'Сохранение не завершено'}[scenario];
      await page.waitForFunction(text=>document.querySelector('#offlineStatus').textContent.includes(text),expected);
      assert(await page.locator('#offline').isEnabled());
      assert.equal(await page.evaluate(()=>window.refreshes),scenario==='same'?1:0);
    }finally{await context.close()}
  }
  console.log('An updated offline copy is downloaded once; the same worker still refreshes on request');
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
    assert.equal(await page.locator('#partChoices [data-part]').count(),7);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#tab-drive').getAttribute('aria-selected'),'true');
    assert(await page.locator('#keyboardHelp').textContent().then(t=>t.includes('стрелки')));
    if(width===1440)await renderXRExhibits(page);
    if(width===390){
      const archiveJump=page.locator('.navarch'), labJump=page.locator('#archiveReturn');
      await archiveJump.focus();
      await Promise.all([page.waitForURL(url=>url.hash==='#archive'),page.keyboard.press('Enter')]);
      assert(await page.locator('#archive').evaluate(el=>el===document.activeElement));
      assert(await page.locator('#archiveTitle').evaluate(el=>el.getBoundingClientRect().top<innerHeight));
      await page.locator('#expandArchive').click();
      assert.equal(await page.locator('#archiveCards .photo-card').count(),10);
      await Promise.all([page.waitForURL(url=>url.hash==='#lab'),labJump.click()]);
      assert(await page.locator('#lab').evaluate(el=>el===document.activeElement));
      await page.locator('#expandArchive').click(); // restore collapsed archive for the remaining checks
      console.log('Archive entry and return from all ten photos move viewport and focus');
    }
    if(width===1440||width===390){
      const compare=page.locator('#compareModels'),dialog=page.locator('#dialog');
      for(const year of [1987,1986]){
        await compare.click();
        assert.equal(await dialog.locator('.dual-card').count(),2);
        assert.equal(await dialog.locator('.dual-surface canvas').count(),2);
        assert.match(await dialog.locator('.dual-card').first().innerText(),/1986 · v7/);
        assert.match(await dialog.locator('.dual-card').last().innerText(),/1987 · v23/);
        assert(await page.locator('#dualSync').isChecked());
        assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
        if(year===1987){
          const first=page.locator('#dual-1986 canvas'),second=page.locator('#dual-1987 canvas');
          await dialog.locator('[data-dual-view="side"]').click();
          const linked=await second.screenshot();
          const linkedBeforeBox=await second.boundingBox();
          await first.focus();await page.keyboard.press('ArrowLeft');
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const linkedDifference=await screenshotDifference(page,linked,await second.screenshot());
          console.log('Linked dual-view image difference:',JSON.stringify({viewport:[width,height],...linkedDifference,beforeBox:linkedBeforeBox,afterBox:await second.boundingBox()}));
          assert(linkedDifference.sameSize,'Linked view retains the same screenshot dimensions');
          assert(linkedDifference.rms>5,'The linked camera produces a substantial visible turn, beyond raster noise');
          await page.locator('#dualSync').uncheck();
          await first.focus();
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const independent=await second.screenshot();
          const independentBeforeBox=await second.boundingBox();
          await page.keyboard.press('ArrowRight');
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const independentDifference=await screenshotDifference(page,independent,await second.screenshot());
          console.log('Unlinked dual-view image difference:',JSON.stringify({viewport:[width,height],...independentDifference,beforeBox:independentBeforeBox,afterBox:await second.boundingBox()}));
          assert(independentDifference.sameSize,'Unlinked view retains the same screenshot dimensions');
          // A static GPU/compositor capture can differ at the final 8-bit color
          // level. Require a strong separation from the visible linked turn.
          assert(independentDifference.rms<=1 && independentDifference.rms<linkedDifference.rms/20,
            'Unlinked camera retains its view within one RGB level and below 5% of the linked turn');
        }
        await dialog.locator('[data-dual-open="'+year+'"]').click();
        assert(!(await dialog.isVisible()));
        // dialog.close() hides immediately; its native close event performs
        // renderer cleanup in a subsequent task.
        await page.locator('.dual-surface canvas').first().waitFor({state:'detached',timeout:3000});
        assert.equal(await page.locator('.dual-surface canvas').count(),0,'Closing the comparison removes its renderers');
        assert.equal(await page.locator('[data-year="'+year+'"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('#tab-drive').getAttribute('aria-selected'),'true');
        assert.equal(await page.locator('#partChoices [data-part]').count(),7);
      }
      await page.locator('#tab-drive').click();
      console.log('Two current interactive models support linked and independent views and return to the selected control panel');
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
      const isolate=page.locator('#isolatePart');
      assert(await isolate.evaluate(el=>el===document.activeElement));
      await page.keyboard.press('Enter');
      assert.equal(await isolate.getAttribute('aria-pressed'),'true');
      await page.keyboard.press('Tab');
      assert(await page.locator('.part-actions a').evaluate(el=>el===document.activeElement));
      await isolate.click();
      assert.equal(await isolate.getAttribute('aria-pressed'),'false');
      console.log('Keyboard close-up retains focus; Tab reaches assembly isolation and then the source');
    }else await closeup.click();
    assert(await page.locator('#markers [data-part="tool"]').isVisible());
    if(width===1440){
      const canvas=page.locator('#surface canvas'),pin=page.locator('#markers [data-part="tool"]');
      await pin.focus();
      await canvas.evaluate(el=>el.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
      assert(await page.locator('#poster').isVisible());
      assert(!(await pin.isVisible()));
      assert(await page.locator('#partChoices [data-part="tool"]').evaluate(el=>el===document.activeElement));
      assert.match(await page.locator('#graphicsStatus').innerText(),/3D временно недоступно/);
      await canvas.evaluate(el=>el.dispatchEvent(new Event('webglcontextrestored')));
      await page.locator('#poster').waitFor({state:'hidden'});
      assert.match(await page.locator('#graphicsStatus').innerText(),/3D снова доступно/);
      assert(await pin.isVisible());
      console.log('Interrupted 3D shows the poster and transfers pin focus without losing the selected part');
      await page.locator('#fit').click();
      const outerPart=await page.evaluate(async()=>{
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const edge=b=>Math.max(Math.abs(parseFloat(b.style.left)-50),Math.abs(parseFloat(b.style.top)-50));
        return [...document.querySelectorAll('#markers button:not([hidden])')].sort((a,b)=>edge(b)-edge(a))[0]?.dataset.part;
      });
      assert(outerPart,'The fitted model has an on-screen marker');
      const outerPin=page.locator('#markers [data-part="'+outerPart+'"]');
      const outerChoice=page.locator('#partChoices [data-part="'+outerPart+'"]');
      await outerPin.focus();
      await page.locator('#in').evaluate(button=>{for(let i=0;i<10;i++)button.click()});
      await outerPin.waitFor({state:'hidden'});
      assert(await outerChoice.evaluate(el=>document.activeElement===el),'Zooming a focused marker out of view must preserve keyboard position in the matching list item');
      assert.equal(await page.locator('#partChoices [aria-pressed="true"]').getAttribute('data-part'),'tool','Zoom and focus must not select a different node');
      await page.locator('#fit').evaluate(button=>button.click());
      await outerPin.waitFor({state:'visible'});
      assert(await outerChoice.evaluate(el=>document.activeElement===el),'Reappearing markers must not steal focus');
      console.log('Zooming a marker out of the viewport transfers focus without changing the selected part');
    }
    if(width===390){
      const choices=page.locator('#partChoices');
      for(const [part,key,extra] of [['loader','bucket',true],['arm','arm',false]]){
        const tab=page.locator('#tab-parts');
        if(await tab.getAttribute('aria-selected')!=='true')await tab.click();
        await choices.locator('[data-part="'+part+'"]').click();
        const button=page.locator('#movePart');
        // Place the former part action at the top, exposing a scroll mismatch
        // when the new slider sits well above the part card on a narrow view.
        await button.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
        await button.press('Enter');
        const input=page.locator('#j-'+key);
        assert.equal(await page.locator('#tab-drive').getAttribute('aria-selected'),'true');
        if(extra)assert(await page.locator('#extra').evaluate(el=>el.open));
        assert(await input.evaluate(el=>el===document.activeElement));
        await page.waitForFunction(id=>{
          const r=document.getElementById(id).closest('.joint').getBoundingClientRect();
          return r.top>=-1 && r.bottom<=innerHeight+1;
        },'j-'+key);
      }
      console.log('390px: from part details, the selected slider and label are visible and focused');
    }
    await page.locator('#tab-drive').click();await page.locator('#reset').click();
    await page.locator('#expandArchive').click();assert.equal(await page.locator('.photo-card').count(),10);
    const matches=page.locator('#archiveCards .archive-badge.has-match');
    assert.equal(await matches.count(),6);
    assert.equal(await page.locator('#archiveCards .archive-badge:not(.has-match)').count(),4);
    await page.locator('[data-filter="1986"]').click();assert.equal(await page.locator('.photo-card').count(),4);
    assert.equal(await matches.count(),2);
    if(width===390){
      await page.getByRole('button',{name:/Пост оператора.*Архивный кадр/}).click();
      assert.equal(await page.locator('#galleryCompare').count(),0);
      await page.locator('#dialog').press('Escape');
      await page.getByRole('button',{name:/Грейфер над фронтальным ковшом.*Есть 3D-сверка/}).click();
      assert(await page.locator('#galleryCompare').isVisible());
      await page.locator('#dialog').press('Escape');
    }
    if(width===1440) {
      const card=page.locator('.photo-card[data-gallery="1986"][data-index="1"]');
      await card.click();
      const dialog=page.locator('#dialog');
      await page.locator('#galleryMarks').click();
      assert.equal(await dialog.locator('svg.registration').count(),1);
      const live=dialog.locator('#galleryAnnouncement');
      const persistent=await live.elementHandle();
      assert.equal(await live.textContent(),'');
      await page.locator('#nextPhoto').click();
      assert((await dialog.locator('h2').innerText()).includes('Пост оператора'));
      assert.match(await live.textContent(),/^Снимок 3 из 4: Пост оператора/);
      assert(await persistent.evaluate(el=>el.isConnected),'The live region must survive frame changes');
      assert(await page.locator('#nextPhoto').evaluate(el=>el===document.activeElement));
      assert.equal(await dialog.locator('svg.registration').count(),0);
      const free=await dialog.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',altKey:true,bubbles:true,cancelable:true})));
      assert(free,'Browser Back shortcut must remain available');
      assert((await dialog.locator('h2').innerText()).includes('Пост оператора'));
      await page.keyboard.press('ArrowLeft');
      assert((await dialog.locator('h2').innerText()).includes('Грейфер над фронтальным ковшом'));
      assert.match(await live.textContent(),/^Снимок 2 из 4: Грейфер над фронтальным ковшом/);
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
    assert.match(await page.evaluate(()=>fetch('./data/1986-pose-audit.txt').then(r=>r.text())),/729 дискретных/);

    assert.equal(await page.locator('#photoSelect').inputValue(),'1');
    await page.locator('[data-year="1987"]').click();
    await page.locator('#photoSelect').selectOption('2');
    await page.waitForFunction(()=>document.querySelector('#photoEnlarge img').naturalWidth>800);
    assert.deepEqual(errors,[]);
    await page.waitForFunction(()=>document.querySelector('#sceneId').textContent.endsWith('v23'));
    assert.match(await page.locator('#poster').getAttribute('alt'),/v22$/);
    console.log(width+'×'+height+' · '+(software?'software rasterizer':'WebGL2')+' · views, tool motion, archive, links and offline navigation passed');
  } finally {await context.close()}
}
async function directComparison(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(base+'?compare=1&model=1987&tool=breaker-loader&pose=12,0,4,90,36,0,0&view=side&z=1.4');
    const dialog=page.locator('#dialog');
    await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('.dual-surface canvas').count(),2);
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('compare')==='1'&&new URL(location.href).searchParams.get('z')==='1.400');
    await page.reload();
    await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('.dual-surface canvas').count(),2);
    await page.locator('#dualShare summary').click();
    const address=new URL(await page.locator('#dualURL').inputValue());
    assert.equal(address.pathname,'/vr_anapa/mobot-lab/');
    assert.equal(address.search,'?compare=1');
    await page.waitForFunction(()=>document.querySelector('#dualQR')?.width>100&&document.querySelector('#dualQR')?.width===document.querySelector('#dualQR')?.height);
    assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await dialog.locator('[data-dual-open="1987"]').click();
    await page.locator('.dual-surface canvas').first().waitFor({state:'detached',timeout:3000});
    assert(await page.locator('#tab-drive').evaluate(el=>el===document.activeElement));
    assert.equal(await page.locator('#tool').inputValue(),'breaker-loader');
    assert.equal(await page.locator('#j-yaw').inputValue(),'12');
    assert.equal(await page.locator('#j-bucket').inputValue(),'36');
    await page.waitForFunction(()=>!new URL(location.href).searchParams.has('compare'));
    assert.equal(await page.locator('#poseScope').isVisible(),false);
    const viewState=()=>page.evaluate(()=>{const p=new URL(location.href).searchParams;return [p.get('view'),p.get('z')]});
    assert.deepEqual(await viewState(),['side','1.400']);
    await page.locator('[data-year="1986"]').click();
    const scope=page.locator('#poseScope');
    assert(await scope.isVisible());
    await scope.locator('summary').click();
    assert.match(await scope.locator('p').innerText(),/не всей траектории/);
    const audit=await page.request.get(new URL(await scope.locator('a').getAttribute('href'),page.url()).href);
    assert(audit.ok());assert.match(await audit.text(),/729 дискретных/);
    await scope.locator('summary').click();
    await page.locator('[data-view="top"]').click();
    await page.locator('#in').click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('view')==='top'&&new URL(location.href).searchParams.get('z')==='1.220');
    await page.locator('[data-year="1987"]').click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('model')==='1987'&&new URL(location.href).searchParams.get('view')==='side');
    assert.deepEqual(await viewState(),['side','1.400']);
    assert.equal(await page.locator('#tool').inputValue(),'breaker-loader');
    assert.equal(await page.locator('#j-yaw').inputValue(),'12');
    await page.locator('[data-year="1986"]').click();
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('model')==='1986'&&new URL(location.href).searchParams.get('view')==='top');
    assert.deepEqual(await viewState(),['top','1.220']);
    for(const card of await page.locator('.download-card').all())assert.equal(await card.getAttribute('target'),'_blank');
    const auditReport=page.locator('#researchContent a[href="./geometry-audit.html"]');
    assert.equal(await auditReport.count(),1);
    await page.goto(base+'geometry-audit.html',{timeout:10000,waitUntil:'domcontentloaded'});
    assert(await page.getByRole('heading',{name:'Сверка геометрии по узлам'}).isVisible());
    assert.equal(await page.locator('#y1986 article, #y1987 article').count(),19);
    assert.equal(await page.locator('#registration-sensitivity article').count(),4);
    assert.equal(await page.locator('#chassis-camera li').count(),2);
    const cameraData=await page.request.get(new URL(await page.locator('#chassis-camera a').getAttribute('href'),page.url()).href);
    assert(cameraData.ok());assert.deepEqual(Object.keys((await cameraData.json()).views),['SKTB2','SKTB4']);
    assert(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    assert.deepEqual(errors,[]);
    console.log('Direct comparison, QR, return to controls, retained tool/pose and per-model camera states passed');
  } finally {await page.close()}
}

async function staticRobots(browser) {
  for(const width of [320,1440]) {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:760}});
    try {
      const page=await context.newPage();
      await page.goto(base);
      const brand=page.locator('.brand img');
      const mark='./mark.svg?v=20261125-robot';
      assert.equal(await brand.getAttribute('src'),mark);
      assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),mark);
      assert(await brand.evaluate(img=>img.complete&&img.naturalWidth>0));
      const badge=await brand.boundingBox();
      assert(badge.width>=32&&badge.height===badge.width&&badge.x>=0&&badge.x+badge.width<=width,'Robot mark must fit the header');
      assert.equal(await page.locator('.credit-sktb img').getAttribute('src'),'./media/sktbpr.png');
      assert.equal(await page.locator('.credit-rgsu img').getAttribute('src'),'./media/rgsu.png');
      const exhibit=page.getByRole('region',{name:'Обе модели без JavaScript'});
      assert(await exhibit.isVisible(),'Both models need an in-page no-script alternative');
      assert.equal(await exhibit.locator('figure').count(),2);
      assert.match(await exhibit.locator('figcaption').first().innerText(),/1986 · Мобот-Ч-ХВ$/);
      assert.match(await exhibit.locator('figcaption').last().innerText(),/1987 · Мобот-Ч-ХВ-2$/);
      for(const image of await exhibit.locator('img').all()) assert(await image.evaluate(el=>el.complete&&el.naturalWidth>0));
      assert.equal(await exhibit.getByRole('link',{name:'История машин у разработчика'}).getAttribute('href'),'https://sktbpr.ru/node/23');
      for(const control of ['#workbench','#share','#offline','#archive']) assert(!(await page.locator(control).isVisible()),control+' appears usable without JavaScript');
      assert(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    } finally {await context.close()}
  }
  console.log('Both reconstructions and the original archive link are readable without JavaScript at 320 and 1440 px');
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.MOBOT_CHROME_CHANNEL || undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    await directComparison(browser);
    await exercise(browser,1440,960,false);
    await exercise(browser,390,844,false);
    await exercise(browser,360,800,true);
    await compactControls(browser);
    await fullscreenFallback(browser);
    await staticRobots(browser);
    await vrAvailability(browser);
    await sharingClipboard(browser);
    await consolidatedSceneTransitions(browser);
    await offlineUpdate(browser);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
