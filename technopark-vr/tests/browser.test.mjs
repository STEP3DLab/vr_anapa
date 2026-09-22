import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '.test-output');
await mkdir(output, {recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=resolve(project, '.'+pathname);if(!file.startsWith(project+'/')&&file!==project)throw Error('Invalid path');if(pathname.endsWith('/'))file+='/index.html';res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const reports=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(process.env.VR_LIVE_URL){const response=await page.goto(process.env.VR_LIVE_URL,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.waitForTimeout(1500);await page.screenshot({path:output+'/published.png'});reports.push({publishedURL:process.env.VR_LIVE_URL,status:response.status(),text:await page.locator('body').innerText()});}
 await page.goto(url+'?diagnostics=1',{waitUntil:'networkidle'});await page.waitForTimeout(1700);
 assert.equal(await page.locator('.game-error').count(),0,'3D must start without an error banner');
 const gl=await page.evaluate(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2');if(!g)return null;const e=g.getExtension('WEBGL_debug_renderer_info');return {version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null};});assert.ok(gl,'real WebGL2 context required');reports.push({webgl:gl});
 await page.screenshot({path:output+'/desktop-hub.png'});
 for(const [name,text] of [['cargo','Полигон Лосинка'],['robot','Робот-арена'],['drones','Дрон-тир']]){
  await page.locator('.portal-cards button').filter({hasText:text}).click();await page.waitForTimeout(1000);await page.screenshot({path:output+'/desktop-'+name+'.png'});
  reports.push({scene:name,status:await page.locator('.game-status').innerText(),diagnostics:await page.locator('[data-diagnostics]').textContent().catch(()=>null)});
  assert.equal(await page.locator('.game-error').count(),0);
  await page.getByRole('button',{name:'⌂ Холл',exact:true}).click();
 }
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(400);await page.screenshot({path:output+'/mobile-'+viewport.width+'-hub.png'});
  await page.locator('.portal-cards button').filter({hasText:'Полигон Лосинка'}).click();await page.waitForTimeout(400);await page.screenshot({path:output+'/mobile-'+viewport.width+'-cargo.png'});
  reports.push({viewport,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
  await page.getByRole('button',{name:'⌂ Холл',exact:true}).click();
 }
 await page.goto(url+'?gallery=1',{waitUntil:'networkidle'});await page.waitForTimeout(600);await page.screenshot({path:output+'/gallery.png'});
 reports.push({errors});assert.deepEqual(errors,[],'No browser errors expected');
 console.log('PASS: actual WebGL2 renderer, three scene transitions, mobile layouts, legacy gallery. Software GPU, not a Quest test.');
} finally {await writeFile(output+'/browser-report.json',JSON.stringify(reports,null,2));await browser.close();server.close();}
