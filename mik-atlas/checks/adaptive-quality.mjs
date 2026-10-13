// Run: node mik-atlas/checks/adaptive-quality.mjs — pure state tests, no GPU.
import assert from 'node:assert/strict';
import {AdaptiveQuality,QUALITY_PROFILES,readQuality,writeQuality} from '../adaptive-quality.js';
import {renderPixelRatio} from '../render-budget.js';
const run=(controller,ms,seconds,eligible=true)=>{let changes=0;for(let i=0;i<Math.ceil(seconds*1000/ms);i++)if(controller.sample(ms,eligible))changes++;return changes;};
const desktop=new AdaptiveQuality();assert.equal(desktop.level,0);
run(desktop,16.67,4);desktop.sample(200);run(desktop,16.67,2);assert.equal(desktop.level,0,'single long frame lowered quality');
run(desktop,40,4);assert.equal(desktop.level,1);run(desktop,40,16);assert.equal(desktop.level,3);
run(desktop,16.67,10);assert.equal(desktop.level,3,'recovery was too quick');run(desktop,16.67,12);assert.equal(desktop.level,2);run(desktop,16.67,45);assert.equal(desktop.level,0);
const overloaded=new AdaptiveQuality();run(overloaded,300,30);assert.equal(overloaded.level,3,'very slow frames never reduced load');
const mobile=new AdaptiveQuality({coarse:true});assert.equal(mobile.level,2);run(mobile,16.67,30);assert.equal(mobile.level,1);run(mobile,16.67,30);assert.equal(mobile.level,1,'coarse device exceeded balanced ceiling');
const inactive=new AdaptiveQuality();run(inactive,50,60,false);assert.equal(inactive.level,0);run(inactive,40,2);assert.equal(inactive.level,0,'resume warmup missing');
for(const n of [0,-1,NaN,Infinity,5000]){inactive.sample(n);assert.equal(inactive.level,0);}
// After a manual profile change, stale observations do not count toward a downgrade.
run(inactive,40,4);inactive.reset();run(inactive,40,3);assert.equal(inactive.level,0);
for(const p of QUALITY_PROFILES)for(const [w,h,dpr] of [[390,844,3],[1920,1080,2],[3840,2160,2],[5120,2880,3],[12000,800,2]]){
 const ratio=renderPixelRatio(w,h,dpr,p);assert(Number.isFinite(ratio)&&ratio>0);assert(w*h*ratio**2<=p.budget+1);assert(ratio<=p.cap);assert(Math.max(w,h)*ratio<=4096+1);
}
let saved;const store={getItem:()=>saved,setItem:(key,value)=>{assert.equal(key,'mik-atlas:graphics:v1');saved=value;}};
assert.equal(readQuality(store),'auto');for(const mode of ['auto','detail','smooth']){assert(writeQuality(store,mode));assert.equal(readQuality(store),mode);}
assert(!writeQuality(store,'unknown'));for(const value of ['{',JSON.stringify({version:7,quality:'detail'}),JSON.stringify({version:1,quality:'unknown'}),'null']){saved=value;assert.equal(readQuality(store),'auto');}
const denied={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};assert.equal(readQuality(denied),'auto');assert(!writeQuality(denied,'detail'));assert.equal(readQuality(),'auto');assert(!writeQuality(undefined,'detail'));
console.log('PASS: sustained slowdown, isolated stall, conservative recovery, mobile ceiling, ineligible/idle frames, warmup, all pixel budgets, validated settings, blocked storage and invalid JSON.');
