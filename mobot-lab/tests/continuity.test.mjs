import test from 'node:test';
import assert from 'node:assert/strict';
import {machines, demonstrations} from '../catalog.js';
import {evidence} from '../evidence.js';
import {inspections} from '../inspection.js';
import {readScene, sceneURL} from '../scene-link.js';

const base='https://example.test/mobot-lab/';
function read(url,year) {
  return readScene(new URL(url).searchParams,machines[year],evidence[year].photos,inspections[year]);
}
function scene(year,mode) {
  return {year,def:machines[year],mode,photo:evidence[year].photos[1],part:'track',
    pose:year===1987?{...demonstrations['breaker-arm'].start}:{...machines[year].demo},
    tool:year===1987?'breaker-arm':'gripper',marks:true,isolated:true,
    camera:{view:null,direction:[.6,0,.8],up:[-.8,0,.6],zoom:1.75,detail:mode==='parts'}};
}

test('A dual entry preserves the underlying drive, photo and isolated-part scenes',()=>{
  for(const [year,mode] of [[1986,'drive'],[1987,'photo'],[1987,'parts']]) {
    const state=scene(year,mode), ordinary=sceneURL(base,state);
    const direct=new URL(sceneURL(base,{...state,dual:true}));
    const restored=read(direct,year), underlying=read(ordinary,year);
    assert.equal(restored.dual,true);
    assert.deepEqual({...restored,dual:false},underlying);
    assert.equal(restored.mode,mode);
    assert.deepEqual(restored.pose,state.pose);
    assert.equal(restored.tool,state.tool);
    assert.deepEqual(restored.camera,state.camera);
    if(mode==='photo') {assert.equal(restored.photo,1);assert.equal(restored.marks,true);}
    if(mode==='parts') {assert.equal(restored.part,'track');assert.equal(restored.isolated,true);}
    direct.searchParams.delete('dual');
    assert.equal(direct.href,ordinary,'The dual flag must be the only change to the scene link');
  }
});

test('Only the exact dual=1 parameter opens the two-model view',()=>{
  for(const value of [null,'','0','false','true','2','01','-1']) {
    const url=new URL(base);
    if(value!==null)url.searchParams.set('dual',value);
    assert.equal(read(url,1986).dual,false,String(value));
  }
  assert.equal(read(base+'?dual=1',1986).dual,true);
});

test('Ordinary scene and VR links cannot inherit dual mode from their base address',()=>{
  const state=scene(1987,'parts'), previous=base+'?dual=1&model=1986#archive';
  for(const dual of [undefined,false,'1',1]) {
    const url=new URL(sceneURL(previous,{...state,dual}));
    assert.equal(url.searchParams.has('dual'),false);
    assert.equal(read(url,1987).dual,false);
    assert.equal(url.href,sceneURL(base,state));
  }
});
