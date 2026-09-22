import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as Three from 'three';
const {build}=await import(process.env.ESBUILD_PATH||'esbuild');
const project=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(tmpdir(),'vr-smoke-'));
await build({absWorkingDir:project,entryPoints:['src/worldEngine.ts'],bundle:true,platform:'node',format:'esm',outfile:join(temp,'engine.mjs'),plugins:[{name:'headless-renderer',setup(b){b.onLoad({filter:/worldEngine\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replace('new T.WebGLRenderer({antialias:true})','new (globalThis as any).TestRenderer()').replace('new T.PMREMGenerator(renderer)','new (globalThis as any).TestEnvironment()'),loader:'ts'}));}}]});
const events={},controllers=[];let frame,scene;
const context={clearRect(){},fillRect(){},fillText(){}};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};globalThis.devicePixelRatio=1;globalThis.window={addEventListener:(n,f)=>events[n]=f,removeEventListener(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.TestEnvironment=class{fromScene(){return {texture:null,dispose(){}};}dispose(){}};
globalThis.TestRenderer=class{constructor(){this.domElement={addEventListener:(n,f)=>events[n]=f,removeEventListener(){},remove(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800})};this.xr={enabled:false,isPresenting:false,setReferenceSpaceType(){},getController:()=>{const c=new Three.Group();controllers.push(c);return c;},addEventListener(){},getSession(){}};}setPixelRatio(){}setSize(){}setAnimationLoop(f){frame=f;}render(s){scene=s;s.updateMatrixWorld(true);}dispose(){}};
const {createExperience}=await import(pathToFileURL(join(temp,'engine.mjs')));let status='';const game=createExperience({clientWidth:1200,clientHeight:800,appendChild(){}},{status:s=>status=s,scene(){}});
let t=0;function frames(n){for(let i=0;i<n;i++)frame(t+=1000/60);}
frames(2);assert.match(status,/портал/);
game.go('robot');frames(600);assert.match(status,/ОБУЧЕНИЕ 1/,'lesson must not time out');game.key('w',true);game.key('a',true);frames(40);game.key('w',false);game.key('a',false);assert.match(status,/ОБУЧЕНИЕ 2/);game.spin();frames(1);assert.match(status,/ГОТОВЫ/,'lesson must complete after driving, turning and spinning');game.start();frames(60);assert.match(status,/СТАРТ ЧЕРЕЗ/);frames(125);assert.match(status,/60 с/);game.start();frames(1);assert.doesNotMatch(status,/СТАРТ ЧЕРЕЗ/,'start must not reset active round');game.key('w',true);frames(120);game.key('w',false);game.spin();frames(3600);assert.match(status,/ПОПРОБУЙТЕ ЕЩЁ/);
game.go('drones');frames(1);events.pointerdown({clientX:600,clientY:400});assert.match(status,/ОБУЧЕНИЕ 2/,'stationary target must advance lesson');game.reload();frames(90);assert.match(status,/ГОТОВЫ/,'reloading completes shooting lesson');game.start();frames(185);events.pointerdown({clientX:1150,clientY:700});assert.match(status,/5\/6/);game.reload();frames(90);assert.match(status,/6\/6/);frames(3600);assert.match(status,/РАУНД ЗАВЕРШЁН/);game.restart();frames(1);assert.match(status,/ГОТОВЫ/);
game.go('hub');frames(1);let camera;scene.traverse(o=>{if(o.isPerspectiveCamera)camera=o;});const before=camera.getWorldPosition(new Three.Vector3());game.turn(1);frames(1);assert.ok(before.distanceTo(camera.getWorldPosition(new Three.Vector3()))<1e-6,'snap turn must preserve head position');
const src={handedness:'right',gamepad:{axes:[0,0,.9,0]}};controllers[1].dispatchEvent({type:'connected',data:src});frames(1);const yaw=camera.parent.rotation.y;frames(20);assert.equal(camera.parent.rotation.y,yaw,'holding the stick must not keep turning');src.gamepad.axes[2]=0;frames(1);src.gamepad.axes[2]=.9;frames(1);assert.notEqual(camera.parent.rotation.y,yaw,'returning to center must rearm snap');
// Complete objectives through deterministic scene fixtures, then let the real opponent simulation run.
game.go('robot');game.start();frames(185);game.spin();
let player;const objectives=[];scene.traverse(o=>{if(o.name==='player-robot')player=o;if(['energy-cell','target-block'].includes(o.name))objectives.push(o);});
for(const objective of objectives){player.position.copy(objective.position);frames(1);}
assert.match(status,/ДУЭЛЬ/);frames(1800);assert.match(status,/ПОБЕДА В ДУЭЛИ/,'spinning robot must defeat an approaching opponent');
game.setPresentation(true);game.go('drones');game.start();frames(8000);assert.match(status,/ДЕМОНСТРАЦИЯ ∞/,'presentation must not end after 60 seconds');game.nextVisitor();frames(1);assert.match(status,/ПРЕЗЕНТАЦИЯ ∞/,'visitor reset must preserve demo mode');game.go('robot');frames(1);assert.match(status,/ОБУЧЕНИЕ 1/,'new visitor gets a fresh lesson');
game.dispose();rmSync(temp,{recursive:true});console.log('PASS: robot and shooting lessons, countdown, ammo/reload, snap-turn, opponent duel victory, unlimited demo, visitor reset and cleanup. GPU and physical headset are not simulated.');
