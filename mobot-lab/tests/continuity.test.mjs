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

test('A comparison link preserves the underlying drive, photo and isolated-part scenes',()=>{
  for(const [year,mode] of [[1986,'drive'],[1987,'photo'],[1987,'parts']]) {
    const state=scene(year,mode), ordinary=sceneURL(base,state);
    const direct=new URL(sceneURL(base,{...state,dual:true}));
    const restored=read(direct,year), underlying=read(ordinary,year);
    assert.equal(direct.searchParams.get('compare'),'1');
    assert.equal(direct.searchParams.has('dual'),false);
    assert.equal(restored.dual,true);
    assert.deepEqual({...restored,dual:false},underlying);
    assert.equal(restored.mode,mode);
    assert.deepEqual(restored.pose,state.pose);
    assert.equal(restored.tool,state.tool);
    assert.deepEqual(restored.camera,state.camera);
    if(mode==='photo') {assert.equal(restored.photo,1);assert.equal(restored.marks,true);}
    if(mode==='parts') {assert.equal(restored.part,'track');assert.equal(restored.isolated,true);}
    direct.searchParams.delete('compare');
    assert.equal(direct.href,ordinary,'Comparison entry must be the only change to the scene link');
  }
});

test('The dual alias retains scene context and rewrites to the canonical compare flag',()=>{
  for(const mode of ['photo','parts']) {
    const state=scene(1987,mode), canonical=sceneURL(base,{...state,dual:true});
    const alias=new URL(sceneURL(base,state));alias.searchParams.set('dual','1');
    const restored=read(alias,1987);
    assert.deepEqual(restored,read(canonical,1987));
    assert.equal(sceneURL(alias,{...state,dual:restored.dual}),canonical);
  }
});

test('Only an exact compare=1 or dual=1 parameter opens the two-model view',()=>{
  for(const key of ['compare','dual']) {
    for(const value of [null,'','0','false','true','2','01','-1']) {
      const url=new URL(base);
      if(value!==null)url.searchParams.set(key,value);
      assert.equal(read(url,1986).dual,false,key+'='+String(value));
    }
  }
  for(const query of ['compare=1','dual=1','compare=1&dual=0','compare=0&dual=1','compare=1&dual=1']) {
    assert.equal(read(base+'?'+query,1986).dual,true,query);
  }
});

test('Ordinary scene and VR links cannot inherit either comparison flag from their base address',()=>{
  const state=scene(1987,'parts'), previous=base+'?compare=1&dual=1&model=1986#archive';
  for(const dual of [undefined,false,'1',1]) {
    const url=new URL(sceneURL(previous,{...state,dual}));
    assert.equal(url.searchParams.has('compare'),false);
    assert.equal(url.searchParams.has('dual'),false);
    assert.equal(read(url,1987).dual,false);
    assert.equal(url.href,sceneURL(base,state));
  }
});
