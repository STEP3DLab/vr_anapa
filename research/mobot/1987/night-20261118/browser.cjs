const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { chromium }=require('playwright');
const base=(process.env.MOBOT_BASE_URL||'http://127.0.0.1:4187/').replace(/\/?$/,'/');
const publicRoute=process.env.MOBOT_PUBLIC_ROUTE==='1';
const candidate=new URL('mobot-engineering-v22.html',base).href;
async function enter(page, javascript=true){
 if(!publicRoute){const res=await page.goto(candidate);assert.equal(res.status(),200);return;}
 const suffix=javascript?'?demo=v22#model':'';
 await page.goto(base+'mobot-latest.html'+suffix,{waitUntil:'commit'});
 await page.waitForURL(candidate+suffix);
}
const out=process.env.MOBOT_REPORT_DIR||'/tmp/mobot22-browser';
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
   await enter(page);
   await page.waitForFunction(()=>window.mobot22?.status().frames>0,{},{timeout:18000});
   const state=await page.evaluate(()=>window.mobot22.status());
   assert.equal(await page.evaluate(()=>window.mobot22.model().root.userData.version),'v22-research');assert.match(state.webgl,/WebGL 2/);assert(state.draws>0&&state.triangles>0);return state;
  });
  if(report.tests[w+'x'+h+'/WebGL2'].status==='PASS'){
   await testAt('viewport',async()=>{
    const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,width:document.querySelector('canvas').clientWidth,height:document.querySelector('canvas').clientHeight}));
    assert(size.page<=w+1&&size.width>230&&size.height>250);return size;
   });
   await testAt('poses-and-tools',async()=>{
    const {initial,poses:presets}=await import('./poses.js');
    const poses=[];assert.equal(presets.length,6);
    for(const [i,[label,tool,pose]] of presets.entries()){
     await page.selectOption('#pose',String(i));
     const s=await page.evaluate(()=>{
      const m=window.mobot22.model().mechanisms;
      return {...window.mobot22.status(),angles:[m.turntable.rotation.y,m.arm.rotation.z,m.gripper.rotation.z,
       m.bucketLift.rotation.z,m.bucketTilt.rotation.z],label:document.getElementById('poseLabel').textContent};
     });
     const expected={...initial,...pose};
     assert.equal(s.label,label);assert.equal(s.tool,tool);assert.deepEqual(s.values,expected);
     const angles=[expected.yaw,expected.arm,expected.wrist-expected.arm,-expected.bucket,expected.tip];
     s.angles.forEach((rad,j)=>assert(Math.abs(rad*180/Math.PI-angles[j])<1e-7));
     assert.deepEqual(s.audit.alerts,[]);
     poses.push({label,tool,values:s.values,anglesDegrees:s.angles.map(rad=>rad*180/Math.PI),clearance:s.audit.clearance});
     if(w===1440){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.locator('#stage').screenshot({path:path.join(out,'pose-'+i+'.png')});
     }
    }
    const modes=[];for(const t of ['breaker-arm','breaker-loader','gripper']){await page.selectOption('#tool',t);modes.push(await page.evaluate(()=>[window.mobot22.model().mechanisms.fingerHead,window.mobot22.model().mechanisms.breakerArm,window.mobot22.model().mechanisms.breakerLoader].map(o=>o.visible)));}
    assert.deepEqual(modes,[[false,true,false],[false,false,true],[true,false,false]]);return poses;
   });
   await testAt('reversible-inspection',async()=>{
    await page.click('#reset');
    const snapshot=()=>page.evaluate(()=>{const m=window.mobot22.model();m.root.updateMatrixWorld(true);return m.meshes.map(o=>[o.id,o.material.uuid,o.visible,...o.matrixWorld.elements]);});
    const before=await snapshot();
    for(const part of ['tracks','body','turret','arm','gripper','bucket','cameras','cable']){
     await page.selectOption('#part',part);await page.click('[data-mode=isolate]');
     assert(await page.evaluate(()=>window.mobot22.model().meshes.some(o=>!o.visible)));
     await page.click('[data-mode=ghost]');assert(await page.evaluate(()=>window.mobot22.model().meshes.some(o=>o.material.opacity<.2)));
    }
    await page.check('#axes');await page.locator('#explode').fill('85');await page.locator('#explode').dispatchEvent('input');
    assert.notDeepEqual(await snapshot(),before);await page.click('#reset');assert.deepEqual(await snapshot(),before);
    return '8 assemblies; transforms, materials and visibility restore exactly';
   });
   await testAt('mechanisms-and-input',async()=>{
    await page.locator('#joints').evaluate(o=>o.open=true);
    for(const [key,value] of Object.entries({yaw:'65',arm:'20',wrist:'70',claw:'21',bucket:'-8',tip:'-25',track:'61'})){
     await page.locator('#joint-'+key).fill(value);await page.locator('#joint-'+key).dispatchEvent('input');
     assert.equal(await page.evaluate(k=>window.mobot22.status().values[k],key),+value);
    }
    await page.selectOption('#tool','breaker-loader');await page.locator('#joint-bucket').fill('-8');await page.locator('#joint-bucket').dispatchEvent('input');
    assert(await page.locator('#warning').evaluate(o=>o.classList.contains('warn')));
    await page.click('#reset');const z=await page.evaluate(()=>window.mobot22.status().zoom);
    await page.click('#in');assert((await page.evaluate(()=>window.mobot22.status().zoom))>z);
    await page.click('[data-view=side]');await page.click('#present');assert(await page.locator('body').evaluate(o=>o.classList.contains('present')));
    await page.keyboard.press('Escape');await page.click('#reset');
   });
   await testAt('surface-witnesses',async()=>{
    await page.click('#reset');
    await page.locator('#joints').evaluate(o=>o.open=true);
    const set=async(key,value)=>page.locator('#joint-'+key).fill(String(value));
    await set('tip',0);await set('claw',8);await set('bucket',36);await set('arm',-18);
    assert(await page.locator('#warning').evaluate(o=>o.classList.contains('warn')));
    assert(await page.evaluate(()=>window.mobot22.status().audit.detail.envelopes.some(e=>e.hits.length)));
    await set('arm',25);
    assert.match(await page.locator('#warning').innerText(),/подтверждает зазор/);
    assert(!await page.locator('#warning').evaluate(o=>o.classList.contains('warn')));
    const bucketAudit=()=>page.evaluate(()=>window.mobot22.status().audit.detail.envelopes.find(e=>e.group==='bucket'));
    const clear=await bucketAudit();
    assert.equal(clear.hits.length,0);assert.equal(clear.unresolved.length,0);
    assert(clear.separated.length && clear.separated.every(e=>e.gap>0));
    await set('tip',3);
    const contact=await bucketAudit();
    assert(contact.hits.length && contact.hits.every(h=>h.point.length===3 && h.point.every(Number.isFinite)));
    assert.match(await page.locator('#warning').innerText(),/Подтверждён контакт/);
    assert(await page.locator('#warning').evaluate(o=>o.classList.contains('warn')));
    await page.click('#reset');
    return {tip0GapPairs:clear.separated.length,tip3TriangleHits:contact.hits};
   });
   await testAt('archive-and-overlay',async()=>{
    const sizes=[];
    for(let i=0;i<4;i++){await page.click('[data-photo="'+i+'"]');
     await page.locator('#photo').evaluate(o=>o.decode());sizes.push(await page.locator('#photo').evaluate(o=>[o.naturalWidth,o.naturalHeight]));
     await page.click('#match');
     assert.equal(await page.inputValue('#pose'),String([0,2,1,3][i]));
     assert.equal(await page.locator('#original').getAttribute('href'),'https://sktbpr.ru/sites/default/files/foto_album/'+[2,3,4,9][i]+'.jpg');
     assert.equal(await page.evaluate(()=>window.mobot22.status().view),['side','side','side','three'][i]);
    }
    assert.deepEqual(sizes,[[2786,2106],[2721,2014],[2782,1993],[2056,1346]]);
    await page.check('#overlay');assert(await page.locator('#overlayImage').isVisible());await page.uncheck('#overlay');
    return sizes;
   });
   await page.click('#reset');await page.evaluate(()=>{document.querySelector('#joints').open=false;window.scrollTo(0,0)});
   const name='webgl-'+w+'x'+h+'.png';await page.screenshot({path:path.join(out,name)});report.screens.push(name);
  }
  await testAt('context-loss',async()=>{
   const cases=w===1440?[[1,'snow-boom'],[5,'raised-bucket']]:
     w===390?[[2,'front-gripper'],[3,'breaker-arm']]:[[0,'overview'],[4,'breaker-loader']];
   const results=[];
   for(const [i,name] of cases){
    if(results.length){await page.reload();await page.waitForFunction(()=>window.mobot22?.status().frames>0);}
    await page.selectOption('#pose',String(i));
    const label=await page.locator('#poseLabel').innerText();
    await page.check('#overlay');
    await page.evaluate(()=>{
     const gl=document.querySelector('#surface canvas').getContext('webgl2');
     const loss=gl.getExtension('WEBGL_lose_context');
     if(!loss)throw Error('WEBGL_lose_context unavailable');
     loss.loseContext();
    });
    await page.waitForFunction(()=>window.mobot22?.status().mode==='static');
    const still=await page.locator('#still').evaluate(async el=>{
     await el.decode();return {url:el.currentSrc,width:el.naturalWidth,height:el.naturalHeight};
    });
    assert.equal(new URL(still.url).pathname.split('/').pop(),name+'.webp');
    assert.deepEqual([still.width,still.height],[1120,690]);assert(await page.locator('#still').isVisible());
    assert.equal(await page.locator('#poseLabel').innerText(),'Контрольный кадр · '+label);
    assert(await page.locator('#pose').isDisabled());assert(!(await page.locator('#overlay').isChecked()));
    assert(!(await page.locator('#overlayImage').isVisible()));
    await page.click('[data-photo="3"]');await page.locator('#photo').evaluate(el=>el.decode());
    results.push({pose:i,label,...still});
   }
   return results;
  });
  if(publicRoute)await testAt('latest-to-v21', async()=>{
   assert.equal(page.url(),candidate+'?demo=v22#model');
   await page.locator('#backup a[href$="mobot-engineering-v21.html"]').click();
   await page.waitForURL(new URL('mobot-engineering-v21.html',base).href);
   await page.waitForFunction(()=>window.mobot21?.status().frames>0);
   const state=await page.evaluate(()=>window.mobot21.status());
   assert.match(state.webgl,/WebGL 2/);assert(state.draws>0);
   return {start:'mobot-latest.html?demo=v22#model',candidate,backup:page.url(),draws:state.draws};
  });
  await testAt('console-and-network',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);return {errors,failures};});
  await ctx.close();
 }
 await test('no-webgl',async()=>{
  const ctx=await browser.newContext();await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...a){return k==='webgl2'?null:get.call(this,k,...a);};});
  const p=await ctx.newPage();await enter(p);await p.waitForFunction(()=>window.mobot22?.status().mode==='static');
  assert(await p.locator('#still').isVisible());await p.locator('#still').evaluate(o=>o.decode());assert(await p.locator('#pose').isDisabled());
  await p.click('[data-photo="3"]');await p.locator('#photo').evaluate(o=>o.decode());await ctx.close();
 });
 await test('without-javascript',async()=>{
  const ctx=await browser.newContext({javaScriptEnabled:false});const p=await ctx.newPage();await enter(p,false);
  assert(await p.locator('#still').isVisible());assert(await p.locator('#still').evaluate(o=>o.naturalWidth>900));
  const links=await p.locator('#photoChoices a').evaluateAll(items=>items.map(a=>a.href));
  assert.equal(links.length,4);
  const originals=[];
  for(const url of links){
    const image=await p.goto(url);
    assert.equal(image.status(),200);
    const dimensions=await p.locator('img').evaluate(async o=>{await o.decode();return [o.naturalWidth,o.naturalHeight]});
    originals.push(dimensions);
  }
  assert.deepEqual(originals,[[2786,2106],[2721,2014],[2782,1993],[2056,1346]]);
  await ctx.close();return originals;
 });
 await test('candidate-resources',async()=>{
  const ctx=await browser.newContext(), page=await ctx.newPage();
  await page.goto(base+'mobot-engineering-v22.html');
  const paths=await page.locator('#backup a,section[aria-labelledby=compare] a').evaluateAll(items=>items.map(a=>a.href));
  for(const url of paths){
    const response=await ctx.request.get(url);
    assert.equal(response.status(),200,url);
    if(/\.(jpg|webp)$/.test(url))assert.match(response.headers()['content-type'],/^image\//);
    if(url.endsWith('-passport.json'))assert.equal((await response.json()).revision,'v22');
    if(url.endsWith('contact-sweep.json'))assert.equal((await response.json()).v22.counts.confirmedPoses,42);
  }
  await ctx.close();return paths.length;
 });
 await browser.close();
}
run().catch(e=>report.errors.push(String(e))).finally(()=>{
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
});
