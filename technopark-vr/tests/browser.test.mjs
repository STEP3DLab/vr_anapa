/** Real WebGL2 smoke test. SwiftShader is NOT a Quest performance or comfort test. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const {chromium} = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '.test-output');
await mkdir(output, {recursive:true});
// A separate inspection bundle exposes fixtures. The production app.js has NO testing globals.
await build({absWorkingDir:project,stdin:{contents:"import {createExperience} from './src/worldEngine';createExperience(document.getElementById('host')!,{status(){},scene(){}});",resolveDir:project,loader:'ts'},outfile:output+'/inspection.js',bundle:true,format:'esm',plugins:[{name:'inspection-only',setup(b){b.onLoad({filter:/worldEngine\.ts$/},async args=>{let s=await readFile(args.path,'utf8');assert.ok(s.includes('renderer.setAnimationLoop((t,frame) => {'));s=s.replace('renderer.setAnimationLoop((t,frame) => {','const auditFrame=(t:number,frame?:XRFrame) => {');s=s.replace("    });\n    go('hub');","    };renderer.setAnimationLoop(auditFrame);\n    go('hub');(globalThis as any).__inspection={renderer,scene,camera,cargo,go,start,fade,introRoot,rig,placeView,hudRoot,missionBeacon,controllers,drones,cells,blocks,robot,spin,reload,nextVisitor,pause,resume,advance(n:number){renderer.setAnimationLoop(null);const draw=renderer.render;renderer.render=()=>{};try{for(let i=0;i<n;i++)auditFrame((previous||0)+1000/60);}finally{renderer.render=draw;}fade.visible=false;introRoot.visible=false;scene.updateMatrixWorld(true);renderer.render(scene,camera);}};");return {contents:s,loader:'ts'};});}}]});
await writeFile(output+'/inspection.html',`<!doctype html><html><head><link rel="icon" href="../favicon.svg"><style>body{margin:0}#host{width:100vw;height:100vh}canvas{display:block}</style></head><body><div id="host"></div><script type="module" src="./inspection.js"></script></body></html>`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(project, '.'+pathname);if(!file.startsWith(project+'/')&&file!==project)throw Error('Invalid path');if(pathname.endsWith('/'))file+='/index.html';const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const reports=[];
const budget=JSON.parse(await readFile(resolve(project,'tests/performance-budget.json'),'utf8'));
async function performanceReport(page,name,spatial=false){
 const stats=await page.evaluate(()=>{const q=window.__inspection;q.renderer.render(q.scene,q.camera);return {calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,...q.renderer.info.memory};});
 reports.push({budgetScene:name,spatial,...stats});assert.ok(stats.calls<=budget[name].calls+(spatial?budget.spatialUIExtraCalls:0),`${name}: ${stats.calls} draw calls`);assert.ok(stats.triangles<=budget[name].triangles,`${name}: triangle budget`);assert.ok(stats.geometries<=budget.geometries,'geometry memory budget');assert.ok(stats.textures<=budget.textures,'texture memory budget');
 return stats;
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(process.env.VR_LIVE_URL){const response=await page.goto(process.env.VR_LIVE_URL,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.waitForTimeout(1000);await page.screenshot({path:output+'/published.png'});reports.push({publishedURL:process.env.VR_LIVE_URL,status:response.status(),text:await page.locator('body').innerText()});}
 await page.goto(url+'?diagnostics=1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
 assert.equal(await page.locator('.game-error').count(),0,'3D must start');
 const gl=await page.evaluate(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2');if(!g)return null;const e=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null};});assert.ok(gl);reports.push({webgl:gl});
 await page.screenshot({path:output+'/desktop-hub.png'});
 if(await page.evaluate(()=>('serviceWorker' in navigator))){
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);}
  await page.context().setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(800);
  assert.equal(await page.locator('.experience').count(),1,'Cached VR experience must open without network after first load');assert.equal(await page.locator('.game-error').count(),0,'Offline fallback must not start with a 3D error');await page.screenshot({path:output+'/desktop-offline.png'});
  await page.context().setOffline(false);await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(500);
 }
 await page.getByRole('button',{name:'Чистый вид ↗',exact:true}).click();await page.waitForTimeout(80);
 assert.equal(await page.locator('.wordmark').evaluate(el=>getComputedStyle(el).display),'none','Clean view hides the wordmark');
 assert.equal(await page.locator('.vr-entry button').isVisible(),true,'Clean view keeps the VR entry available');
 await page.screenshot({path:output+'/desktop-clean.png'});
 await page.getByRole('button',{name:'Вернуть интерфейс',exact:true}).click();
 await page.getByRole('button',{name:'☰ Меню',exact:true}).click();await page.waitForTimeout(260);assert.equal(await page.locator('.main-menu').count(),1);const desktopMenu=await page.locator('.main-menu').boundingBox();assert.ok(desktopMenu&&desktopMenu.width>400&&desktopMenu.height>500&&desktopMenu.x>=0&&desktopMenu.y>=0&&desktopMenu.x+desktopMenu.width<=1440&&desktopMenu.y+desktopMenu.height<=900);assert.equal(await page.locator('.menu-live').count(),1);assert.equal(await page.locator('.menu-vr').count(),1);const menuOnTop=await page.evaluate(()=>!!document.elementFromPoint(innerWidth-80,innerHeight/2)?.closest?.('.main-menu'));assert.equal(menuOnTop,true,'Command menu must be the top interactive layer');await page.screenshot({path:output+'/desktop-menu.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('.main-menu').count(),0,'Escape closes menu without navigation');await page.keyboard.press('m');assert.equal(await page.locator('.main-menu').count(),1,'M opens command menu');await page.keyboard.press('m');assert.equal(await page.locator('.main-menu').count(),0,'M toggles command menu');await page.keyboard.press('1');await page.waitForTimeout(120);assert.match(await page.locator('.game-status').innerText(),/Робот-арена|ОБУЧЕНИЕ/,'1 opens robot arena');await page.keyboard.press('0');await page.waitForTimeout(120);assert.equal(await page.locator('.experience.is-hub').count(),1,'0 returns to the hall');
 for(const [name,text] of [['cargo','Полигон Лосинка'],['robot','Робот-арена'],['drones','Дрон-тир']]){
  await page.locator('.portal-cards button').filter({hasText:text}).click();await page.waitForTimeout(240);await page.screenshot({path:output+'/desktop-'+name+'-intro.png'});await page.waitForTimeout(1650);await page.screenshot({path:output+'/desktop-'+name+'.png'});
  const diagnostics=await page.locator('[data-diagnostics]').textContent(),calls=Number(diagnostics?.match(/(\d+) вызов/)?.[1]??Infinity),budgets={cargo:95,robot:70,drones:50};reports.push({scene:name,status:await page.locator('.game-status').innerText(),diagnostics,calls});assert.ok(calls<=budgets[name],`${name} draw calls ${calls} exceed budget ${budgets[name]}`);
 if(name==='cargo'){await page.getByRole('button',{name:'☰ Меню',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));assert.match(await page.locator('.menu-live').innerText(),/ПАУЗА/);await page.getByRole('button',{name:'▶ Продолжить миссию',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));await page.keyboard.press('p');await page.getByRole('button',{name:'☰ Меню',exact:true}).click();await page.getByRole('button',{name:'▶ Продолжить миссию',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));}
  await page.getByRole('button',{name:'Как играть ?',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('dialog:modal')&&document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));assert.match(await page.locator('.game-status').innerText(),/ПАУЗА/);await page.screenshot({path:output+'/help-'+name+'.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog:modal'));
  assert.equal(await page.locator('.game-error').count(),0);await page.getByRole('button',{name:'⌂ Холл',exact:true}).click();
 }
 // Desktop without a headset still keeps all three experiences accessible.
 await page.locator('.vr-entry button').click();assert.match(await page.locator('.game-error').innerText(),/не поддерживается|гарнитуры/);await page.getByRole('button',{name:'Закрыть сообщение',exact:true}).click();
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(250);await page.screenshot({path:output+'/mobile-'+viewport.width+'-hub.png'});
  await page.getByRole('button',{name:'☰ Меню',exact:true}).click();await page.waitForTimeout(180);const menuBox=await page.locator('.main-menu').boundingBox();assert.ok(menuBox&&menuBox.x>=0&&menuBox.y>=0&&menuBox.x+menuBox.width<=viewport.width+1&&menuBox.y+menuBox.height<=viewport.height+1,'Command menu must fit mobile viewport');await page.screenshot({path:output+'/mobile-'+viewport.width+'-menu.png'});await page.locator('.menu-close').click();
  await page.locator('.portal-cards button').filter({hasText:'Полигон Лосинка'}).click();await page.waitForTimeout(400);await page.screenshot({path:output+'/mobile-'+viewport.width+'-cargo.png'});
  const layout=await page.evaluate(()=>{const selectors=['.vr-entry button','.round-actions','.touch-controls','.game-footer nav','.game-status','.game-header'];const r=selectors.map(s=>{const x=document.querySelector(s).getBoundingClientRect();return {selector:s,x:x.x,y:x.y,w:x.width,h:x.height};});const overlap=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)if(Math.min(r[i].x+r[i].w,r[j].x+r[j].w)>Math.max(r[i].x,r[j].x)+2&&Math.min(r[i].y+r[i].h,r[j].y+r[j].h)>Math.max(r[i].y,r[j].y)+2)overlap.push([r[i].selector,r[j].selector]);return {rects:r,overlap,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};});reports.push({viewport,...layout});assert.equal(layout.horizontalOverflow,false);assert.deepEqual(layout.overlap,[],'Mobile controls and status must not overlap');
   await page.getByRole('button',{name:'☰ Меню',exact:true}).click();await page.locator('.menu-scenes button').filter({hasText:'Главный павильон'}).click();
 }
 await page.setViewportSize({width:1440,height:900});await page.goto(url+'?scene=robot&presentation=1&autostart=1',{waitUntil:'networkidle'});await page.waitForTimeout(500);
 assert.match(await page.locator('.game-status').innerText(),/СТАРТ ЧЕРЕЗ|ДЕМОНСТРАЦИЯ ∞/,'Autostart deep link begins the selected presentation scene');
 await page.goto(url+'?scene=drones',{waitUntil:'networkidle'});assert.equal(await page.locator('.experience.scene-drones').count(),1,'drones deep link');
 await page.goto(url+'?scene=cargo',{waitUntil:'networkidle'});assert.equal(await page.locator('.experience.scene-cargo').count(),1,'cargo deep link');
 await page.goto(url+'?scene=cargo&presentation=1&clean=1',{waitUntil:'networkidle'});await page.waitForTimeout(650);
 assert.equal(await page.locator('.experience.is-game.clean').count(),1,'Deep link opens the requested game scene in clean presentation mode');
 assert.equal(await page.locator('.game-status').count(),0,'Clean deep link keeps gameplay overlays hidden');assert.equal(await page.locator('.vr-entry button').isVisible(),true);
 await page.goto(url+'?gallery=1',{waitUntil:'networkidle'});await page.waitForTimeout(600);await page.screenshot({path:output+'/gallery.png'});
 await page.locator('.demo-list button').filter({hasText:'Робот-манипулятор'}).click();assert.equal(new URL(page.url()).searchParams.get('gallery'),'1','changing exhibits must preserve the gallery deep link');
 const stl=Buffer.from('solid audit\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid audit');
 const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
 const json=Buffer.from(JSON.stringify(gltf)),padded=Math.ceil(json.length/4)*4,glb=Buffer.alloc(12+8+padded+8+36,0x20);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);glb.writeUInt32LE(36,20+padded);glb.writeUInt32LE(0x004e4942,24+padded);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>glb.writeFloatLE(v,28+padded+i*4));
 for(const [name,buffer] of [['audit.stl',stl],['audit.glb',glb]]){await page.locator('input[type=file]').setInputFiles({name,mimeType:'application/octet-stream',buffer});await page.waitForFunction(name=>document.querySelector('.scene-heading h1')?.textContent===name,name);assert.equal(new URL(page.url()).searchParams.get('gallery'),'1');}await page.screenshot({path:output+'/gallery-local-glb.png'});
 // Close-up, deterministic, real rendered inspection of the arm at every handling stage.
 await page.goto(url+'.test-output/inspection.html',{waitUntil:'networkidle'});await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>!!window.__inspection.scene.getObjectByName('cargo-exhibit')),true,'Losinka rover exhibit must be present in the hall');
 await page.evaluate(()=>{const q=window.__inspection;q.go('cargo');q.renderer.setAnimationLoop(null);q.fade.visible=false;q.introRoot.visible=false;q.scene.traverse(o=>{if(o.isDirectionalLight)o.intensity=3.5;});q.cargo.robot.position.set(-5,0,0);q.cargo.update(0,0,0,false);q.camera.position.set(1,4.5,5);q.camera.lookAt(-5,1,0);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);});
 await page.screenshot({path:output+'/arm-0-ready.png'});
 await page.evaluate(()=>window.__inspection.cargo.interact());
 for(const [name,frames] of [['1-approach',70],['2-gripped',65],['3-transfer',45],['4-loaded',190]]){
  const state=await page.evaluate(n=>{const q=window.__inspection;for(let i=0;i<n;i++)q.cargo.update(1/60,0,0,true);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);return {loaded:q.cargo.loaded,busy:q.cargo.busy,delivered:q.cargo.delivered,calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};},frames);reports.push({arm:name,...state});await page.screenshot({path:output+'/arm-'+name+'.png'});
 }
 await page.evaluate(()=>{const q=window.__inspection;q.cargo.robot.position.set(0,0,2);q.cargo.update(0,0,0,false);q.camera.position.set(6,5,8);q.camera.lookAt(0,1,2);q.cargo.interact();});
 for(const [phase,frames] of [['deck-grip',135],['lowering',80],['released',40],['rest',115]]){await page.evaluate(n=>{const q=window.__inspection;for(let i=0;i<n;i++)q.cargo.update(1/60,0,0,true);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);},frames);await page.screenshot({path:output+'/unload-'+phase+'.png'});}
 assert.equal(await page.evaluate(()=>window.__inspection.cargo.delivered),1);await page.screenshot({path:output+'/arm-5-delivered.png'});
 for(let index=1;index<3;index++){
  const delivered=await page.evaluate(index=>{const q=window.__inspection,c=q.cargo,item=c.packages[index];c.robot.position.set(item.position.x,0,item.position.z+3);c.robot.rotation.set(0,0,0);c.update(0,0,0,false);c.interact();for(let i=0;i<370;i++)c.update(1/60,0,0,true);c.robot.position.set(0,0,2);c.update(0,0,0,false);c.interact();for(let i=0;i<370;i++)c.update(1/60,0,0,true);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);return c.delivered;},index);
  assert.equal(delivered,index+1,'every cargo delivery is rendered and counted once');await page.screenshot({path:output+'/cargo-delivered-'+delivered+'.png'});
 }
 // Monoscopic preview at a nominal standing eye height; NOT an immersive device test.
 for(const name of ['cargo','robot','drones']){
  await page.evaluate(mode=>{const q=window.__inspection;q.go(mode);q.renderer.xr.isPresenting=true;q.placeView();q.renderer.xr.isPresenting=false;q.camera.position.set(0,1.65,0);q.camera.rotation.set(-.15,0,0);q.fade.visible=false;q.introRoot.visible=false;q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);},name);
  await page.screenshot({path:output+'/console-preview-'+name+'.png'});
  assert.equal(await page.evaluate(()=>window.__inspection.missionBeacon.visible),true,'Spatial mission beacon must be visible in VR game scenes');
  const heights=await page.evaluate(()=>{const q=window.__inspection;return q.hudRoot.children.filter(o=>o.userData.action).map(o=>o.getWorldPosition(q.camera.position.clone()).y-q.rig.position.y);});assert.ok(heights.every(y=>y>.3),'Every VR button must remain above ground');
  await page.evaluate(()=>{const q=window.__inspection;q.camera.rotation.set(-.08,Math.atan2(4.4,3.4),0);q.renderer.render(q.scene,q.camera);});
  await page.screenshot({path:output+'/console-side-'+name+'.png'});
  await performanceReport(page,name,true);
 }
 // Full active workloads, not just the one-drone tutorial. Logic advances deterministically;
 // the final scene is drawn by the real WebGL2 renderer (no mock or screenshot substitute).
 await page.evaluate(()=>{const q=window.__inspection;q.go('hub');q.advance(270);});
 await page.screenshot({path:output+'/hub-settled.png'});await performanceReport(page,'hub');
 await page.evaluate(()=>{const q=window.__inspection;q.go('drones');q.start();q.advance(2600);});
 await page.screenshot({path:output+'/drones-flagship-wave.png'});await performanceReport(page,'drones');
 assert.equal(await page.evaluate(()=>window.__inspection.drones.filter(d=>d.g.visible).length),9,'entire final wave must be rendered');
 await page.evaluate(()=>{const q=window.__inspection;q.go('robot');q.start();q.advance(190);q.spin();for(const o of [...q.cells,...q.blocks]){q.robot.position.copy(o.position);q.advance(1);}});
 await page.screenshot({path:output+'/robot-duel.png'});await performanceReport(page,'robot');
 await page.evaluate(()=>{const q=window.__inspection;q.go('cargo');q.start();q.advance(190);});await performanceReport(page,'cargo');
 const memories=[];for(let cycle=0;cycle<3;cycle++){for(const mode of ['hub','robot','drones','cargo'])await page.evaluate(mode=>{const q=window.__inspection;q.go(mode);q.start();q.advance(mode==='drones'?2600:270);},mode);memories.push(await page.evaluate(()=>({...window.__inspection.renderer.info.memory})));}
 assert.deepEqual(memories[2],memories[1],'repeated scene changes must not accumulate GPU geometries/textures');reports.push({memoryAfterCycles:memories});
 const softwareFPS=await page.evaluate(async()=>{const q=window.__inspection,start=performance.now();for(let i=0;i<8;i++)await new Promise(resolve=>requestAnimationFrame(()=>{q.renderer.render(q.scene,q.camera);resolve();}));return 8000/(performance.now()-start);});assert.ok(softwareFPS>=budget.minimumSoftwareFPS,'software WebGL2 must keep producing frames');reports.push({softwareFPS,hardware:'Software renderer; not Meta Quest 2'});
 reports.push({errors});assert.deepEqual(errors,[],'No browser errors expected');
 console.log('PASS: real WebGL2 renderer; three scenes; help/pause; unsupported VR message; two mobile layouts without overlaps; legacy gallery; real rendered arm sequence. Software GPU, not Quest.');
} finally {await writeFile(output+'/browser-report.json',JSON.stringify(reports,null,2));await browser.close();server.close();}
