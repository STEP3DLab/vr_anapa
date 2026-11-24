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
    await page.locator('#closeup').click();assert(await page.locator('#markers [data-part="tool"]').isVisible());
    await page.locator('#tab-drive').click();await page.locator('#reset').click();
    await page.locator('#expandArchive').click();assert.equal(await page.locator('.photo-card').count(),10);
    await page.locator('[data-filter="1986"]').click();assert.equal(await page.locator('.photo-card').count(),4);
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
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
