import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../technopark-vr/tests/browser.test.mjs',import.meta.url);
let s=readFileSync(path,'utf8');
s=s.replace("__inspection={renderer,scene,camera,cargo,go,fade}","__inspection={renderer,scene,camera,cargo,go,fade,rig,placeView}");
s=s.replace("await page.getByRole('button',{name:'Как играть ?',exact:true}).click();assert.equal(await page.locator('dialog:modal').count(),1);assert.match(await page.locator('.game-status').innerText(),/ПАУЗА/);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog:modal').count(),0);","await page.getByRole('button',{name:'Как играть ?',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('dialog:modal')&&document.querySelector('.game-status')?.textContent.includes('ПАУЗА'));assert.match(await page.locator('.game-status').innerText(),/ПАУЗА/);await page.screenshot({path:output+'/help-'+name+'.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog:modal'));");
if(!s.includes('console-preview-'))s=s.replace(" reports.push({errors});assert.deepEqual(errors,[],'No browser errors expected');",` // Monoscopic preview at a nominal standing eye height; NOT an immersive device test.
 for(const name of ['cargo','robot','drones']){
  await page.evaluate(mode=>{const q=window.__inspection;q.go(mode);q.renderer.xr.isPresenting=true;q.placeView();q.renderer.xr.isPresenting=false;q.camera.position.set(0,1.65,0);q.camera.rotation.set(-.15,0,0);q.fade.visible=false;q.scene.updateMatrixWorld(true);q.renderer.render(q.scene,q.camera);},name);
  await page.screenshot({path:output+'/console-preview-'+name+'.png'});
 }
 reports.push({errors});assert.deepEqual(errors,[],'No browser errors expected');`);
writeFileSync(path,s);
