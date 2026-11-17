// Independent production Chromium/WebGL2 smoke test for comparison of research v5 + v20.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.MOBOT_BASE_URL||'http://127.0.0.1:4173/';
const out=path.resolve(__dirname,'../mobot-qa/demo-2026-11-18');
fs.mkdirSync(out,{recursive:true});
const url=new URL('mobot-compare.html',base).href;
const nearly=(a,b)=>Math.abs(a-b)<1e-3;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={url,engine:'Chromium WebGL2 / SwiftShader, genuine vendored Three.js',runs:[],fallbackChecked:false};
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true}:{viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('requestfailed',request=>failed.push(request.url()+': '+request.failure()?.errorText));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{const q=window.__mobotCompareQA?.getState();return q?.models?.['86']?.draws>0&&q?.models?.['87']?.draws>0;},{timeout:30000});
  const initial=await page.evaluate(()=>window.__mobotCompareQA.getState());
  for(const year of ['86','87']){
   assert.equal(initial.models[year].mode,'webgl2',year+' must use real WebGL2');
   assert(initial.models[year].triangles>0,year+' must render triangles');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal mobile overflow');
  await page.locator('[data-angle="side"]').click();
  const side=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert.equal(side.angle,'side');
  assert(side.models['86'].direction.every((v,i)=>nearly(v,side.models['87'].direction[i])),'synchronized side view');
  await page.selectOption('#pose86','raised');
  await page.selectOption('#pose87','loader');
  await page.selectOption('#tool87','breaker-arm');
  const posed=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert.equal(posed.models['86'].pose,'raised');assert.equal(posed.models['87'].pose,'loader');assert.equal(posed.models['87'].tool,'breaker-arm');
  await page.selectOption('#node86','gripper');await page.selectOption('#node87','tracks');
  assert((await page.locator('#note86').textContent()).includes('грейфера'));
  assert((await page.locator('#note87').textContent()).includes('ходовая'));
  // Isolation must hide non-selected meshes and be exactly reversible.
  const beforeIsolation=await page.evaluate(()=>window.__mobotCompareQA.getState());
  await page.locator('#isolate86').click();
  await page.locator('#isolate87').click();
  const isolated=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert(isolated.models['86'].isolated&&isolated.models['87'].isolated);
  assert(isolated.models['86'].visibleMeshes<beforeIsolation.models['86'].visibleMeshes);
  assert(isolated.models['87'].visibleMeshes<beforeIsolation.models['87'].visibleMeshes);
  await page.locator('#isolate86').click();
  await page.locator('#isolate87').click();
  const restored=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert(!restored.models['86'].isolated&&!restored.models['87'].isolated);
  assert.equal(restored.models['86'].visibleMeshes,beforeIsolation.models['86'].visibleMeshes);
  assert.equal(restored.models['87'].visibleMeshes,beforeIsolation.models['87'].visibleMeshes);
  await page.locator('#focus87').click();
  await page.locator('#zoomIn').click();
  const zoomed=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert(zoomed.models['86'].zoom>1&&zoomed.models['87'].zoom>1,'zoom both canvases');
  await page.locator('#reset').click();
  const reset=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert.equal(reset.angle,'three');assert.equal(reset.models['87'].tool,'gripper');
  assert.equal(reset.models['86'].node,'all');assert.equal(reset.models['87'].node,'all');
  const canvas=page.locator('#canvas86 canvas');
  if(mobile){
   const b=await canvas.boundingBox();const x=b.x+b.width*.5,y=b.y+b.height*.45;
   const cdp=await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+75,y:y+35}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   const b=await canvas.boundingBox();
   await page.mouse.move(b.x+b.width*.40,b.y+b.height*.40);
   await page.mouse.down();
   await page.mouse.move(b.x+b.width*.66,b.y+b.height*.53,{steps:6});
   await page.mouse.up();
  }
  const afterDrag=await page.evaluate(()=>window.__mobotCompareQA.getState());
  assert(afterDrag.models['86'].direction.every((v,i)=>nearly(v,afterDrag.models['87'].direction[i])),'paired orbit stays synchronized');
  await page.locator('#sync').uncheck();
  const independentBefore=await page.evaluate(()=>window.__mobotCompareQA.getState().models['87'].direction);
  await page.locator('#canvas86 canvas').focus();
  await page.keyboard.press('ArrowRight');
  const independentAfter=await page.evaluate(()=>window.__mobotCompareQA.getState().models['87'].direction);
  assert.deepEqual(independentAfter,independentBefore,'independent mode must leave partner unchanged');
  await page.locator('#sync').check();
  assert.equal(await page.evaluate(()=>window.__mobotCompareQA.getState().sync),true);
  await page.screenshot({path:path.join(out,mobile?'compare-mobile.png':'compare-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[],'javascript/browser console errors');
  assert.deepEqual(failed,[],'network requests');
  report.runs.push({profile:mobile?'mobile':'desktop',initial,sideSynchronized:true,bothPoses:true,toolSwitch:true,nodeDetails:true,nodeIsolationReversible:true,zoomBoth:true,orbitSynchronized:true,independentMode:true,errors,failed});
  await context.close();
 }
 const blocked=await browser.newContext({viewport:{width:390,height:844}});
 await blocked.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   if(type==='webgl2'||type==='webgl')return null;
   return original.call(this,type,...args);
  };
 });
 const fallbackPage=await blocked.newPage();
 await fallbackPage.goto(url,{waitUntil:'networkidle'});
 assert(await fallbackPage.locator('#fallback86').isVisible());
 assert(await fallbackPage.locator('#fallback87').isVisible());
 assert(await fallbackPage.locator('#pose86').isDisabled());
 assert(await fallbackPage.locator('#pose87').isDisabled());
 assert(await fallbackPage.locator('#isolate86').isDisabled());
 assert(await fallbackPage.locator('#isolate87').isDisabled());
 await fallbackPage.locator('#fallback86').evaluate(img=>img.decode());
 await fallbackPage.locator('#fallback87').evaluate(img=>img.decode());
 report.fallbackChecked=true;
 await fallbackPage.screenshot({path:path.join(out,'compare-fallback-mobile.png'),fullPage:true});
 await blocked.close();await browser.close();
 fs.writeFileSync(path.join(out,'compare-browser-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({url,runs:report.runs.map(r=>({profile:r.profile,rendered:Object.values(r.initial.models).map(m=>({version:m.version,triangles:m.triangles})),paired:r.orbitSynchronized})),fallback:report.fallbackChecked},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
