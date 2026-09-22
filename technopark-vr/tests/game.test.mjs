import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// This module is deliberately dependency-free: run on Node 22+ with type stripping.
const source=readFileSync(new URL('../src/gameLogic.ts',import.meta.url),'utf8').replace(/:number/g,'');
const {driveRobot,shotHits,falling}=await import('data:text/javascript,'+encodeURIComponent(source));
let p={x:0,z:-2,yaw:0};for(let i=0;i<600;i++)p=driveRobot(p.x,p.z,p.yaw,1,0,1/60);assert.equal(p.z,-12.7);assert.equal(p.x,0);
p=driveRobot(5.7,-5,-Math.PI/2,1,0,1);assert.equal(p.x,5.7);
p=driveRobot(0,-5,0,0,1,.5);assert.equal(p.z,-5);assert.equal(p.yaw,1.2);
assert.equal(shotHits(-3,0),false);assert.equal(shotHits(10,.5),true);assert.equal(shotHits(10,3),false);
let f={y:4,velocity:0};for(let i=0;i<60;i++)f=falling(f.y,f.velocity,1/60);assert.ok(f.y<0);assert.ok(Math.abs(f.velocity+9.8)<1e-9);
console.log('PASS: arena boundaries, steering, forward-only hit cone, falling drone gravity');
