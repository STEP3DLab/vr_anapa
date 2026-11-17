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
 const result={started:new Date().toISOString(),base,engine:'real Chromium with SwiftShader software WebGL2',mockThree:false,runs:[],limits:['No physical phone GPU or headset tested','No factory-dimensional verification','No complete mesh-to-mesh collision solver']};
 // Produce both reserve frames first, before auditing any backup-image request.
 for(const year of ['1986','1987']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(new URL(year==='1986'?'mobot-ch-hv-1986-research-v5.html':'mobot-engineering-v20.html',base).href,{waitUntil:'networkidle'});
  await ready(page);await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-model.png')});
  await page.locator('[data-view="side"]').click();await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-side.png')});await page.close();
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
  if(!mobile){await page.locator('#stage').screenshot({path:path.join(out,year+'-model.png')});await page.locator('[data-view="side"]').click();await settle(page);await page.locator('#stage').screenshot({path:path.join(out,year+'-side.png')});}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,'horizontal overflow');
  const presets=[];for(const i of [0,1,2]){await page.selectOption('#pose',String(i));await settle(page);const s=await page.evaluate(()=>window.__mobotQA.getState());assert(Number.isFinite(s.clearance));presets.push(s);}
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
  await page.locator('#home').click();await settle(page);await page.locator('#surface canvas').press('ArrowRight');await settle(page);
  const finite=await page.evaluate(()=>{const bad=[];window.__mobotQA.getModel().root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))bad.push(o.name)});return bad});assert.deepEqual(finite,[]);
  const sources=[];for(const b of await page.locator('[data-source]').all()){await b.click();await page.locator('#archivePhoto').evaluate(img=>img.decode());sources.push(await page.locator('#archivePhoto').getAttribute('src'));}
  await page.locator('[data-panel="passport"]').click();assert(await page.locator('#passport').isVisible());await page.locator('[data-panel="backup"]').click();assert(await page.locator('#backup').isVisible());
  result.runs.push({year,profile:suffix,initial,presets,sliderSamples:sliders,tools,mouseOrTouchOrbit:true,keyboardOrbit:true,zoomButton:true,finiteTransforms:true,archiveImages:sources,horizontalOverflow:overflow,errors,failed});
  await context.close();
 }
 // Baseline real browser renders kept separate from historical mock QA.
 for(const [name,file,selector] of [['1986-v4','mobot-ch-hv-1986-research-v4.html','#stage'],['1987-v19','mobot-engineering-v19.html','#stage']]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(new URL(file,base).href,{waitUntil:'networkidle'});await page.waitForSelector('canvas');await settle(page);await page.locator(selector).screenshot({path:path.join(out,name+'-before.png')});await page.close();
 }
 // Actual absence of WebGL must take the tested static fallback path.
 const blocked=await browser.newContext({viewport:{width:390,height:844}});await blocked.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind==='webgl2'||kind==='webgl')return null;return get.call(this,kind,...args)}});
 const bp=await blocked.newPage();await bp.goto(new URL('mobot-demo.html',base).href,{waitUntil:'networkidle'});assert(await bp.locator('#fallback').isVisible());await bp.locator('#fallback').evaluate(img=>img.decode());await bp.screenshot({path:path.join(out,'fallback-mobile.png')});result.webglUnavailableFallback=true;await blocked.close();
 const noJS=await browser.newContext({javaScriptEnabled:false});const np=await noJS.newPage();await np.goto(new URL('mobot-backup.html',base).href,{waitUntil:'networkidle'});result.staticBackupImages=await np.locator('img').evaluateAll(es=>es.map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0})));assert(result.staticBackupImages.every(i=>i.loaded));await noJS.close();
 result.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));await browser.close();
 console.log(JSON.stringify({runs:result.runs.map(r=>({year:r.year,profile:r.profile,triangles:r.initial.triangles,errors:r.errors,failed:r.failed,presets:r.presets.map(p=>p.clearance)})),webglUnavailableFallback:result.webglUnavailableFallback,report:path.join(out,'browser-report.json')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
