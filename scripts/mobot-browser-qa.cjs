// Real Chromium/WebGL2 audit. Requires Playwright; no mocked THREE classes.
// MOBOT_BASE_URL must point to an already running preview or deployed GitHub Pages.
const { chromium }=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.MOBOT_BASE_URL||'http://127.0.0.1:4173/';
const out=path.resolve(__dirname,'../mobot-qa/demo-2026-11-18');fs.mkdirSync(out,{recursive:true});
async function ready(page){await page.waitForFunction(()=>window.__mobotQA?.getState().renderCount>0,{timeout:30000});}
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const result={baselines:[],started:new Date().toISOString(),base,engine:'real Chromium with SwiftShader software WebGL2',mockThree:false,runs:[],limits:['No physical phone GPU or headset tested','No factory-dimensional verification','No complete mesh-to-mesh collision solver']};
 // Produce both reserve frames first, before auditing any backup-image request.
 for(const year of ['1986','1987']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(new URL(year==='1986'?'mobot-ch-hv-1986-research-v5.html':'mobot-engineering-v20.html',base).href,{waitUntil:'networkidle'});
  await ready(page);await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-model.png'),style:'.stage-top,.stage-bottom,.load{visibility:hidden!important}'});
  await page.locator('[data-view="side"]').click();await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-side.png'),style:'.stage-top,.stage-bottom,.load{visibility:hidden!important}'});await page.close();
 }
 for(const mobile of [false,true])for(const year of ['1986','1987']){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>failed.push(r.url()+': '+r.failure()?.errorText));
  const filename=year==='1986'?'mobot-ch-hv-1986-research-v5.html':'mobot-engineering-v20.html';
  await page.goto(new URL(filename,base).href,{waitUntil:'networkidle'});await ready(page);await settle(page);
  const initial=await page.evaluate(()=>window.__mobotQA.getState());assert(initial.webglVersion.includes('WebGL 2'));assert(initial.triangles>0);
  const suffix=mobile?'mobile':'desktop';
  await page.screenshot({path:path.join(out,year+'-'+suffix+'.png')});
  if(!mobile){await page.locator('#stage').screenshot({path:path.join(out,year+'-model.png'),style:'.stage-top,.stage-bottom,.load{visibility:hidden!important}'});await page.locator('[data-view="side"]').click();await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-side.png'),style:'.stage-top,.stage-bottom,.load{visibility:hidden!important}'});}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'horizontal overflow');
  const presets=[];for(const i of [0,1,2]){await page.selectOption('#pose',String(i));await settle(page);const s=await page.evaluate(()=>window.__mobotQA.getState());assert(Number.isFinite(s.clearance));assert(s.clearance>=0,'preset below support plane');presets.push(s);}
  const sliders=[];
  for(const assembly of ['all','arm','bucket','tracks']){
   await page.selectOption('#assembly',assembly);
   const ids=await page.locator('#controls input').evaluateAll(es=>es.map(e=>e.id));
   for(const id of ids){const samples=await page.locator('#'+id).evaluate(e=>[+e.min,(+e.min + +e.max)/2,+e.max]);for(const value of samples){await page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}))},Math.round(value));await settle(page);const s=await page.evaluate(()=>window.__mobotQA.getState());assert(s.pose[id.replace('control-','')]===Math.round(value));sliders.push({id,value:Math.round(value),clearance:s.clearance});}}
  }
  const tools=[];if(year==='1987')for(const tool of ['gripper','breaker-arm','breaker-loader']){await page.selectOption('#tool',tool);await settle(page);const state=await page.evaluate(()=>window.__mobotQA.getState());assert(state.tool===tool);tools.push(state);}
  await page.selectOption('#assembly','all');await page.selectOption('#pose','0');await settle(page);
  const before=await page.evaluate(()=>window.__mobotQA.getState().camera);const box=await page.locator('#surface canvas').boundingBox();
  if(mobile){const cdp=await context.newCDPSession(page);const x=box.x+box.width*.50,y=box.y+box.height*.45;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y:y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55,{steps:5});await page.mouse.up();}
  await settle(page);const after=await page.evaluate(()=>window.__mobotQA.getState().camera);assert(JSON.stringify(before)!==JSON.stringify(after),'orbit did not change camera');
  await page.locator('#zoomIn').click();await settle(page);assert((await page.evaluate(()=>window.__mobotQA.getState().zoom))>1);
  await page.locator('#home').click();await settle(page);const kbBefore=await page.evaluate(()=>window.__mobotQA.getState().camera);await page.locator('#surface canvas').press('ArrowRight');await settle(page);assert.notDeepEqual(await page.evaluate(()=>window.__mobotQA.getState().camera),kbBefore,'keyboard orbit');
  await page.locator('#presentation').click();assert(await page.locator('body').evaluate(b=>b.classList.contains('present')));await page.locator('#presentation').click();
  const finite=await page.evaluate(()=>{const bad=[];window.__mobotQA.getModel().root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))bad.push(o.name)});return bad});assert.deepEqual(finite,[]);
  const sources=[];for(const b of await page.locator('[data-source]').all()){await b.click();await page.locator('#archivePhoto').evaluate(img=>img.decode());sources.push(await page.locator('#archivePhoto').getAttribute('src'));}
  await page.locator('[data-panel="passport"]').click();assert(await page.locator('#passport').isVisible());await page.locator('[data-panel="backup"]').click();assert(await page.locator('#backup').isVisible());
  assert.deepEqual(errors,[],'browser console errors');assert.deepEqual(failed,[],'failed requests');
  result.runs.push({year,profile:suffix,initial,presets,sliderSamples:sliders,tools,mouseOrTouchOrbit:true,keyboardOrbit:true,zoomButton:true,finiteTransforms:true,archiveImages:sources,horizontalOverflow:overflow,errors,failed});
  await context.close();
 }
 // Baseline real browser renders kept separate from historical mock QA.
 for(const [name,file,selector] of [['1986-v4','mobot-ch-hv-1986-research-v4.html','#stage'],['1987-v19','mobot-engineering-v19.html','#stage']]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(new URL(file,base).href,{waitUntil:'networkidle'});await page.waitForSelector('canvas');await settle(page);const gl=await page.locator('canvas').first().evaluate(c=>{const g=c.getContext('webgl2');return g?g.getParameter(g.VERSION):null});assert(gl?.includes('WebGL 2'));result.baselines.push({name,webglVersion:gl});await page.locator(selector).screenshot({path:path.join(out,name+'-before.png')});await page.close();
 }
 // Actual absence of WebGL must take the tested static fallback path.
 const blocked=await browser.newContext({viewport:{width:390,height:844}});await blocked.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind==='webgl2'||kind==='webgl')return null;return get.call(this,kind,...args)}});
 const bp=await blocked.newPage();await bp.goto(new URL('mobot-demo.html',base).href,{waitUntil:'networkidle'});assert(await bp.locator('#fallback').isVisible());assert(await bp.locator('#photoPose').isDisabled());assert(!(await bp.locator('.stage-top').isVisible()));await bp.locator('#fallback').evaluate(img=>img.decode());await bp.screenshot({path:path.join(out,'fallback-mobile.png')});result.webglUnavailableFallback=true;await blocked.close();
 const noJS=await browser.newContext({javaScriptEnabled:false});const np=await noJS.newPage();await np.goto(new URL('mobot-backup.html',base).href,{waitUntil:'networkidle'});result.staticBackupImages=await np.locator('img').evaluateAll(es=>es.map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0})));assert(result.staticBackupImages.every(i=>i.loaded));await noJS.close();
 // The new archive tool has identified 1986 sources and local full originals.
 const photo=await browser.newPage({viewport:{width:1440,height:1000}});await photo.goto(new URL('mobot-photo-measure-v2.html',base).href,{waitUntil:'networkidle'});
 const photoSources=[];for(const id of ['fig6','fig9','sktb2','sktb3','sktb4','sktb9']){await photo.selectOption('#src',id);await photo.locator('#photo').evaluate(im=>im.decode());await photo.locator('#reference').evaluate(im=>im.decode());photoSources.push(id);}
 await photo.selectOption('#src','fig6');await photo.locator('#photo').evaluate(im=>im.decode());await photo.locator('#marks').click({position:{x:100,y:100}});assert.equal(await photo.locator('#marks circle').count(),1);assert(JSON.parse(await photo.locator('#result').textContent()).points.length===1);await photo.locator('#overlay').check();assert(await photo.locator('#ghost').isVisible());await photo.locator('#scale').evaluate(e=>{e.value='110';e.dispatchEvent(new Event('input',{bubbles:true}))});assert((await photo.locator('#ghost').getAttribute('style')).includes('1.1'));await photo.screenshot({path:path.join(out,'photo-measure-desktop.png')});await photo.locator('#overlay').uncheck();await photo.locator('#undo').click();assert.equal(await photo.locator('#marks circle').count(),0);await photo.setViewportSize({width:390,height:844});assert(await photo.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));result.photoMeasureV2={sourcesLoaded:photoSources,pointAddUndo:true,overlayTransform:true,mobileNoOverflow:true};await photo.close();
 // Verify the permanent latest entrypoint now promotes research v20, not the preserved v17.
 // Check that links from the roof exhibition can open archive/passport panels after redirect.
 const entry=await browser.newPage({viewport:{width:390,height:844}});
 await entry.goto(new URL('mobot-latest.html?source=demo#passport',base).href,{waitUntil:'domcontentloaded'});
 await entry.waitForURL(/mobot-engineering-v20\.html\?source=demo#passport/,{timeout:30000});
 await ready(entry);
 assert(await entry.locator('#passport').isVisible(),'latest #passport panel must be visible');
 await entry.goto(new URL('mobot-latest.html#archive',base).href,{waitUntil:'domcontentloaded'});
 await entry.waitForURL(/mobot-engineering-v20\.html#archive/,{timeout:30000});
 await ready(entry);
 assert(await entry.locator('#archive').isVisible(),'latest #archive panel must be visible');
 result.latestEntrypoint={target:'1987-v20',queryAndHashPreserved:true,passportDeepLink:true,archiveDeepLink:true};
 await entry.close();
 result.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));await browser.close();
 console.log(JSON.stringify({runs:result.runs.map(r=>({year:r.year,profile:r.profile,triangles:r.initial.triangles,errors:r.errors,failed:r.failed,presets:r.presets.map(p=>p.clearance)})),webglUnavailableFallback:result.webglUnavailableFallback,report:path.join(out,'browser-report.json')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
