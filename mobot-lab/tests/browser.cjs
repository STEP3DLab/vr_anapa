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
    assert.equal(await page.locator('#photoSelect').inputValue(),'1');
    await page.locator('[data-year="1987"]').click();
    await page.locator('#photoSelect').selectOption('2');
    await page.waitForFunction(()=>document.querySelector('#photoEnlarge img').naturalWidth>800);
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' · '+(software?'software rasterizer':'WebGL2')+' · views, tool motion, archive, links and offline navigation passed');
  } finally {await context.close()}
}
async function staticRobots(browser) {
  for(const width of [320,1440]) {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:760}});
    try {
      const page=await context.newPage();
      await page.goto(base);
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
    await exercise(browser,1440,960,false);
    await exercise(browser,390,844,false);
    await exercise(browser,360,800,true);
    await compactControls(browser);
    await staticRobots(browser);
    await vrAvailability(browser);
    await sharingClipboard(browser);
    await offlineUpdate(browser);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
