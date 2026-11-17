// npm install --no-save playwright, then provide MOBOT_BASE_URL of a static server.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=(process.env.MOBOT_BASE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const url=base+'mobot-ch-hv-1986-research-v7.html?qa=1'+(process.env.MOBOT_EXTENSION?'&suspension='+encodeURIComponent(process.env.MOBOT_EXTENSION):'');
const out=process.env.MOBOT_QA_OUT||'v7-browser-output';fs.mkdirSync(out,{recursive:true});
const report={base,url,commit:process.env.GITHUB_SHA||null,tests:[],screenshotFiles:[]};
let page,browser;const errors=[],responses=[];
async function test(name,fn){
  try{const details=await fn();report.tests.push({name,status:'PASS',...details});}
  catch(e){report.tests.push({name,status:'FAIL',error:e.message});throw e;}
}
async function openPage(options){
  page=await browser.newPage(options);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))responses.push([r.status(),r.url()]);});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.mobotV7?.renderer?.domElement?.clientWidth>0,{},{timeout:20000});
}
async function capture(name,selector){
  const target=selector?page.locator(selector):page;
  await target.screenshot({path:path.join(out,name),type:'jpeg',quality:83,animations:'disabled'});
  report.screenshotFiles.push(name);
}
const signature=()=>page.evaluate(()=>{const {model,owner,materials}=window.mobotV7;model.root.updateMatrixWorld(true);
  return [...owner.keys()].map(o=>[o.visible,o.material===materials.get(o),...o.matrixWorld.elements.map(x=>+x.toFixed(9))]);});
async function click(id){await page.locator('#'+id).click();}
async function range(id,num){
  const el=page.locator('#p-'+id);await el.focus();await el.press('Home');
  for(let i=0;i<num;i++)await el.press('ArrowRight');
}
(async()=>{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  report.chromium=browser.version();
  await test('Desktop Chromium: live WebGL2 and non-uniform framebuffer',async()=>{
    await openPage({viewport:{width:1400,height:960},deviceScaleFactor:1});
    const metrics=await page.evaluate(()=>{
      const {renderer,render,model}=window.mobotV7;render();const gl=renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let dark=0,bright=0;for(let i=0;i<pixels.length;i+=64){const l=pixels[i]*.3+pixels[i+1]*.6+pixels[i+2]*.1;if(l<140)dark++;if(l>160)bright++;}
      return {isWebGL2:gl instanceof WebGL2RenderingContext,glError:gl.getError(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,extension:model.v7.extension,version:model.root.userData.version,dark,bright};
    });
    assert(metrics.isWebGL2&&metrics.glError===0&&metrics.triangles>10000&&metrics.dark>100&&metrics.bright>1000);
    assert.equal(metrics.version,'1986-v7');assert.equal(metrics.extension,Number(process.env.MOBOT_EXTENSION||.105));await capture('desktop.jpg');return metrics;
  });
  const original=await signature();
  await test('Seven assemblies: highlights, isolation and exact restoration',async()=>{
    const options=await page.locator('#part option').evaluateAll(os=>os.map(o=>o.value).filter(v=>v!=='all'));assert.equal(options.length,7);
    for(const id of options){
      await page.selectOption('#part',id);await click('isolate');
      const result=await page.evaluate(id=>{const {owner,materials}=window.mobotV7;let count=0;
        for(const [o,key] of owner){if(o.visible)count++;if(o.visible!==(key===id)||(o.material!==materials.get(o))!==(key===id))return -1;}return count;
      },id);assert(result>0,id);
      await click('isolate');
    }
    await page.selectOption('#part','all');assert.deepEqual(await signature(),original);return {assemblies:options};
  });
  await test('Camera controls, ray selection and reversible explosion',async()=>{
    await click('explode');assert.notDeepEqual(await signature(),original);await capture('exploded.jpg','#viewport');await click('explode');assert.deepEqual(await signature(),original);
    for(const view of ['front','top','side','three']){
      await page.locator('[data-view='+view+']').click();assert.equal(await page.evaluate(()=>window.mobotV7.state.view),view);
    }
    await click('in');assert((await page.evaluate(()=>window.mobotV7.camera.zoom))>1);await click('home');
    const point=await page.evaluate(()=>{
      const {camera,model,renderer}=window.mobotV7,part=model.sections['Верхний цилиндрический корпус камеры'];
      const v=part.position.clone().set(0,0,0);part.localToWorld(v).project(camera);
      const b=renderer.domElement.getBoundingClientRect();return {x:b.left+(v.x+1)*b.width/2,y:b.top+(1-v.y)*b.height/2};
    });await page.mouse.click(point.x,point.y);assert.equal(await page.inputValue('#part'),'cameras');
    await page.selectOption('#part','all');return {picked:'cameras'};
  });
  await test('Six motion controls, archive poses and local source files',async()=>{
    await click('poseTab');
    for(const k of ['yaw','boom','grab','loader','tip','track']){
      await range(k,4);const value=Number(await page.inputValue('#p-'+k));assert.equal(await page.evaluate(k=>window.mobotV7.state.pose[k],k),value);
    }
    await click('reset');assert.deepEqual(await signature(),original);
    for(const [preset,yaw] of [['rear',34],['front',111]]){
      await page.locator('[data-archive='+preset+']').click();assert.equal(await page.inputValue('#preset'),preset);
      assert.equal(await page.evaluate(()=>window.mobotV7.state.pose.yaw),yaw);
    }
    const urls=await page.locator('.photo,#passport .footlinks a').evaluateAll(xs=>xs.map(x=>x.href));
    for(const u of urls)assert.equal((await page.request.get(u)).status(),200,u);
    await click('reset');return {inputs:6,archivePoses:2,linkedFiles:urls.length};
  });
  await page.close();
  await test('Mobile Chromium with touch: layout, tap selection and touch orbit',async()=>{
    await openPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    for(const width of [320,360,390,720]){
      await page.setViewportSize({width,height:844});for(const tab of ['partsTab','poseTab']){
        await click(tab);const s=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert(s[0]<=s[1],width+' overflow '+s);
      }
    }
    await page.setViewportSize({width:390,height:844});await click('partsTab');await click('home');await capture('mobile.jpg');
    await page.evaluate(()=>{
      window.touchTrace=[];
      for(const kind of ['pointerdown','pointerup','pointercancel','click','touchstart','touchend'])document.addEventListener(kind,e=>{
        const p=e.changedTouches?.[0]||e;
        window.touchTrace.push([kind,e.target.id||e.target.tagName,Math.round(p.clientX),Math.round(p.clientY),window.mobotV7.state.isolated]);
      },{capture:true,passive:true});
    });
    const loc=await page.locator('canvas').boundingBox(),x=Math.round(loc.x+loc.width*.55),y=Math.round(loc.y+loc.height*.55);
    const before=await page.evaluate(()=>window.mobotV7.camera.position.toArray());
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+44,y:y+12}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.notDeepEqual(await page.evaluate(()=>window.mobotV7.camera.position.toArray()),before);
    await page.selectOption('#part','tracks');await page.locator('#isolate').tap();
    try{
      await page.waitForFunction(()=>window.mobotV7.state.isolated && document.getElementById('isolate').getAttribute('aria-pressed')==='true',undefined,{timeout:5000});
    }catch(error){
      const diagnostic=await page.evaluate(()=>({events:window.touchTrace,state:window.mobotV7.state,button:document.getElementById('isolate').getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight,scrollY,visualViewport.scale]}));
      throw Error('Mobile tap: '+JSON.stringify(diagnostic),{cause:error});
    }
    assert.equal(await page.locator('.stage-head h2').textContent(),'Гусеничная ходовая');
    await page.locator('#isolate').tap();
    await page.waitForFunction(()=>!window.mobotV7.state.isolated);
    const actions=await page.evaluate(()=>window.touchTrace.filter(e=>e[0]==='click'&&e[1]==='isolate').length);
    assert.equal(actions,2,'one activation per tap');return {widths:[320,360,390,720],touchOrbit:true,activationsForTwoTaps:actions};
  });
  await test('Static fallback with WebGL disabled',async()=>{
    const f=await browser.newPage({viewport:{width:390,height:844}});
    await f.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type.includes('webgl')?null:orig.call(this,type,...rest);};});
    await f.goto(url,{waitUntil:'networkidle'});assert.equal(await f.textContent('#mode'),'Статический вид');
    assert(await f.locator('#still').evaluate(i=>i.complete&&i.naturalWidth>0&&!i.hidden));assert(await f.locator('#fig6 a.photo').isVisible());await f.close();
  });
  await test('No page exceptions or missing same-origin resources',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);});
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(page&&!page.isClosed()&&process.exitCode)await capture('failure.jpg').catch(()=>{});
  report.errors=errors;report.httpErrors=responses;fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser?.close();
});
