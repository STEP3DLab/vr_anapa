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
await build({absWorkingDir:project,stdin:{contents:"import {createExperience} from './src/worldEngine';createExperience(document.getElementById('host')!,{status(){},scene(){}});",resolveDir:project,loader:'ts'},outfile:output+'/inspection.js',bundle:true,format:'esm',plugins:[{name:'inspection-only',setup(b){b.onLoad({filter:/worldEngine\.ts$/},async args=>{let s=await readFile(args.path,'utf8');const index=s.lastIndexOf("    go('hub');");assert.ok(index>0);s=s.slice(0,index)+s.slice(index).replace("    go('hub');","    go('hub');(globalThis as any).__inspection={renderer,scene,camera,cargo,go,fade,rig,placeView};");return {contents:s,loader:'ts'};});}}]});
await writeFile(output+'/inspection.html',`<!doctype html><html><head><link rel="icon" href="../favicon.svg"><style>body{margin:0}#host{width:100vw;height:100vh}canvas{display:block}</style></head><body><div id="host"></div><script type="module" src="./inspection.js"></script></body></html>`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(project, '.'+pathname);if(!file.startsWith(project+'/')&&file!==project)throw Error('Invalid path');if(pathname.endsWith('/'))file+='/index.html';const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const reports=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(process.env.VR_LIVE_URL){const response=await page.goto(process.env.VR_LIVE_URL,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.waitForTimeout(1000);await page.screenshot({path:output+'/published.png'});reports.push({publishedURL:process.env.VR_LIVE_URL,status:response.status(),text:await page.locator('body').innerText()});}
 await page.goto(url+'?diagnostics=1',{waitUntil:'networkidle'});await page.waitForTimeout(1500);
 assert.equal(await page.locator('.game-error').count(),0,'3D must start');
 const gl=await page.evaluate(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2');if(!g)return null;const e=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null};});assert.ok(gl);reports.push({webgl:gl});
 await page.screenshot({path:output+'/desktop-hub.png'});
 for(const [name,text] of [['cargo','Полигон Лосинка'],['robot','Робот-арена'],['drones','Дрон-тир']]){
  await page.locator('.portal-cards button').filter({hasText:text}).click();await page.waitForTimeout(1100);await page.screenshot({path:output+'/desktop-'+name+'.png'});
  reports.push({scene:name,status:await page.locator('.game-status').innerText(),diagnostics:await page.locator('[data-diagnostics]').textContent()});
  await page.getByRole('button',{name:'Как играть ?',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('dialog:modal')&&document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));assert.match(await page.locator('.game-status').innerText(),/ПАУЗА/);await page.screenshot({path:output+'/help-'+name+'.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog:modal'));
  assert.equal(await page.locator('.game-error').count(),0);await page.getByRole('button',{name:'⌂ Холл',exact:true}).click();
 }
 // Desktop without a headset still keeps all three experiences accessible.
 await page.locator('.vr-entry button').click();assert.match(await page.locator('.game-error').innerText(),/не поддерживается|гарнитуры/);await page.getByRole('button',{name:'Закрыть сообщение',exact:true}).click();
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(250);await page.screenshot({path:output+'/mobile-'+viewport.width+'-hub.png'});
  await page.locator('.portal-cards button').filter({hasText:'Полигон Лосинка'}).click();await page.waitForTimeout(400);await page.screenshot({path:output+'/mobile-'+viewport.width+'-cargo.png'});
  const layout=await page.evaluate(()=>{const selectors=['.vr-entry button','.round-actions','.touch-controls','.game-footer nav','.game-status','.game-header'];const r=selectors.map(s=>{const x=document.querySelector(s).getBoundingClientRect();return {selector:s,x:x.x,y:x.y,w:x.width,h:x.height};});const overlap=[];for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)if(Math.min(r[i].x+r[i].w,r[j].x+r[j].w)>Math.max(r[i].x,r[j].x)+2&&Math.min(r[i].y+r[i].h,r[j].y+r[j].h)>Math.max(r[i].y,r[j].y)+2)overlap.push([r[i].selector,r[j].selector]);return {rects:r,overlap,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};});reports.push({viewport,...layout});assert.equal(layout.horizontalOverflow,false);assert.deepEqual(layout.overlap,[],'Mobile controls and status must not overlap');
  await page.getByRole('button',{name:'⌂ Холл',exact:true}).click();
 }
 await page.setViewportSize({width:1440,height:900});await page.goto(url+'?gallery=1',{waitUntil:'networkidle'});await page.waitForTimeout(600);await page.screenshot({path:output+'/gallery.png'});
 // Close-up, deterministic, real rendered inspection of the arm at every handling stage.
 await page.goto(url+'.test-output/inspection.html',{waitUntil:'networkidle'});await page.waitForTimeout(800);
 await page.evaluate(()=>{const q=window.__inspection;q.go('cargo');q.renderer.setAnimationLoop(null);q.fade.visible=false;q.scene.traverse(o=>{if(o.isDirectionalLight)o.intensity=3.5;});q.cargo.robot.position.set(-5,0,0);q.cargo.update(0,0,0,false);q.camera.position.set(1,4.5,5);q.camera.lookAt(-5,1,0);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);});
 await page.screenshot({path:output+'/arm-0-ready.png'});
 await page.evaluate(()=>window.__inspection.cargo.interact());
 for(const [name,frames] of [['1-approach',70],['2-gripped',65],['3-transfer',45],['4-loaded',190]]){
  const state=await page.evaluate(n=>{const q=window.__inspection;for(let i=0;i<n;i++)q.cargo.update(1/60,0,0,true);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);return {loaded:q.cargo.loaded,busy:q.cargo.busy,delivered:q.cargo.delivered,calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};},frames);reports.push({arm:name,...state});await page.screenshot({path:output+'/arm-'+name+'.png'});
 }
 await page.evaluate(()=>{const q=window.__inspection;q.cargo.robot.position.set(0,0,2);q.cargo.update(0,0,0,false);q.camera.position.set(6,5,8);q.camera.lookAt(0,1,2);q.cargo.interact();for(let i=0;i<370;i++)q.cargo.update(1/60,0,0,true);q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);});
 assert.equal(await page.evaluate(()=>window.__inspection.cargo.delivered),1);await page.screenshot({path:output+'/arm-5-delivered.png'});
 // Monoscopic preview at a nominal standing eye height; NOT an immersive device test.
 for(const name of ['cargo','robot','drones']){
  await page.evaluate(mode=>{const q=window.__inspection;q.go(mode);q.renderer.xr.isPresenting=true;q.placeView();q.renderer.xr.isPresenting=false;q.camera.position.set(0,1.65,0);q.camera.rotation.set(-.15,0,0);q.fade.visible=false;q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);},name);
  await page.screenshot({path:output+'/console-preview-'+name+'.png'});
 }
 reports.push({errors});assert.deepEqual(errors,[],'No browser errors expected');
 console.log('PASS: real WebGL2 renderer; three scenes; help/pause; unsupported VR message; two mobile layouts without overlaps; legacy gallery; real rendered arm sequence. Software GPU, not Quest.');
} finally {await writeFile(output+'/browser-report.json',JSON.stringify(reports,null,2));await browser.close();server.close();}
