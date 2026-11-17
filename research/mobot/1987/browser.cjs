const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const base=(process.env.MOBOT_BASE_URL||'http://127.0.0.1:4187/').replace(/\/?$/,'/');
const out=process.env.MOBOT_REPORT_DIR||'/tmp/mobot21-browser';
fs.mkdirSync(out,{recursive:true});
const report={base,tests:{},screens:[],errors:[]};
async function test(name,fn){
 try{const detail=await fn();report.tests[name]={status:'PASS',detail:detail??true};}
 catch(e){report.tests[name]={status:'FAIL',error:String(e)};report.errors.push(name+': '+e.message);console.error(name,e.message);}
}
async function run(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [w,h] of [[1440,1000],[390,844],[360,800]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:w<500,isMobile:w<500});
  const page=await ctx.newPage();
  const errors=[],failures=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failures.push([r.url(),r.failure()?.errorText]));
  page.on('response',r=>{if(r.status()>=400)failures.push([r.url(),r.status()]);});
  const testAt=(k,fn)=>test(w+'x'+h+'/'+k,fn);
  await testAt('WebGL2',async()=>{
   const r=await page.goto(base+'mobot-engineering-v21.html');assert.equal(r.status(),200);
   await page.waitForFunction(()=>window.mobot21?.status().frames>0,{},{timeout:18000});
   const state=await page.evaluate(()=>window.mobot21.status());
   assert.match(state.webgl,/WebGL 2/);assert(state.draws>0&&state.triangles>0);return state;
  });
  if(report.tests[w+'x'+h+'/WebGL2'].status==='PASS'){
   await testAt('viewport',async()=>{
    const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,width:document.querySelector('canvas').clientWidth,height:document.querySelector('canvas').clientHeight}));
    assert(size.page<=w+1&&size.width>230&&size.height>250);return size;
   });
   await testAt('poses-and-tools',async()=>{
    const poses=[];for(let i=0;i<6;i++){await page.selectOption('#pose',String(i));const s=await page.evaluate(()=>window.mobot21.status());poses.push({tool:s.tool,alerts:s.audit.alerts,clearance:s.audit.clearance});assert.equal(s.audit.alerts.length,0,'preset '+i+' '+s.audit.alerts.join(','));}
    const modes=[];for(const t of ['breaker-arm','breaker-loader','gripper']){await page.selectOption('#tool',t);modes.push(await page.evaluate(()=>[window.mobot21.model().mechanisms.fingerHead,window.mobot21.model().mechanisms.breakerArm,window.mobot21.model().mechanisms.breakerLoader].map(o=>o.visible)));}
    assert.deepEqual(modes,[[false,true,false],[false,false,true],[true,false,false]]);return poses;
   });
   await testAt('reversible-inspection',async()=>{
    await page.click('#reset');
    const snapshot=()=>page.evaluate(()=>{const m=window.mobot21.model();m.root.updateMatrixWorld(true);return m.meshes.map(o=>[o.id,o.material.uuid,o.visible,...o.matrixWorld.elements]);});
    const before=await snapshot();
    for(const part of ['tracks','body','turret','arm','gripper','bucket','cameras','cable']){
     await page.selectOption('#part',part);await page.click('[data-mode=isolate]');
     assert(await page.evaluate(()=>window.mobot21.model().meshes.some(o=>!o.visible)));
     await page.click('[data-mode=ghost]');assert(await page.evaluate(()=>window.mobot21.model().meshes.some(o=>o.material.opacity<.2)));
    }
    await page.check('#axes');await page.locator('#explode').fill('85');await page.locator('#explode').dispatchEvent('input');
    assert.notDeepEqual(await snapshot(),before);await page.click('#reset');assert.deepEqual(await snapshot(),before);
    return '8 assemblies; transforms, materials and visibility restore exactly';
   });
   await testAt('mechanisms-and-input',async()=>{
    await page.locator('#joints').evaluate(o=>o.open=true);
    for(const [key,value] of Object.entries({yaw:'65',arm:'20',wrist:'70',claw:'21',bucket:'-8',tip:'-25',track:'61'})){
     await page.locator('#joint-'+key).fill(value);await page.locator('#joint-'+key).dispatchEvent('input');
     assert.equal(await page.evaluate(k=>window.mobot21.status().values[k],key),+value);
    }
    await page.selectOption('#tool','breaker-loader');await page.locator('#joint-bucket').fill('-8');await page.locator('#joint-bucket').dispatchEvent('input');
    assert(await page.locator('#warning').evaluate(o=>o.classList.contains('warn')));
    await page.click('#reset');const z=await page.evaluate(()=>window.mobot21.status().zoom);
    await page.click('#in');assert((await page.evaluate(()=>window.mobot21.status().zoom))>z);
    await page.click('[data-view=side]');await page.click('#present');assert(await page.locator('body').evaluate(o=>o.classList.contains('present')));
    await page.keyboard.press('Escape');await page.click('#reset');
   });
   await testAt('archive-and-overlay',async()=>{
    const sizes=[];
    for(let i=0;i<4;i++){await page.click('[data-photo="'+i+'"]');
     await page.locator('#photo').evaluate(o=>o.decode());sizes.push(await page.locator('#photo').evaluate(o=>[o.naturalWidth,o.naturalHeight]));
     await page.click('#match');}
    assert.deepEqual(sizes,[[2786,2106],[2721,2014],[2782,1993],[2056,1346]]);
    await page.check('#overlay');assert(await page.locator('#overlayImage').isVisible());await page.uncheck('#overlay');
    return sizes;
   });
   await page.click('#reset');await page.evaluate(()=>{document.querySelector('#joints').open=false;window.scrollTo(0,0)});
   const name='webgl-'+w+'x'+h+'.png';await page.screenshot({path:path.join(out,name)});report.screens.push(name);
  }
  await testAt('console-and-network',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);return {errors,failures};});
  await ctx.close();
 }
 await test('no-webgl',async()=>{
  const ctx=await browser.newContext();await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...a){return k==='webgl2'?null:get.call(this,k,...a);};});
  const p=await ctx.newPage();await p.goto(base+'mobot-engineering-v21.html');await p.waitForFunction(()=>window.mobot21?.status().mode==='static');
  assert(await p.locator('#still').isVisible());await p.locator('#still').evaluate(o=>o.decode());assert(await p.locator('#pose').isDisabled());
  await p.click('[data-photo="3"]');await p.locator('#photo').evaluate(o=>o.decode());await ctx.close();
 });
 await test('without-javascript',async()=>{
  const ctx=await browser.newContext({javaScriptEnabled:false});const p=await ctx.newPage();await p.goto(base+'mobot-engineering-v21.html');
  assert(await p.locator('#still').isVisible());assert(await p.locator('#still').evaluate(o=>o.naturalWidth>900));await ctx.close();
 });
 await test('v20-and-local-resources',async()=>{
  const ctx=await browser.newContext();const p=await ctx.newPage();assert.equal((await p.goto(base+'mobot-engineering-v20.html')).status(),200);
  await p.waitForFunction(()=>window.__mobotQA?.getState().renderCount>0);
  const state=await p.evaluate(()=>window.__mobotQA.getState());assert.equal(state.version,'v20');assert.equal(state.mode,'webgl2');
  for(const f of ['mobot-engineering-v21-model.js','mobot-engineering-v21-passport.json','mobot-engineering-v21-qa.json','research/mobot/1987/side.webp','research/mobot/1987/breaker-arm.webp','research/mobot/1987/breaker-loader.webp'])assert.equal((await ctx.request.get(base+f)).status(),200);
  await ctx.close();return state.version;
 });
 await browser.close();
}
run().catch(e=>report.errors.push(String(e))).finally(()=>{
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
});
