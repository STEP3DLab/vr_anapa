// The carriers and beams are axis-aligned boxes in this assembly.
import assert from 'node:assert/strict';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const model=makeMobot1986(T);
const cross=model.objects.filter(o=>o.name==='Поперечная балка к бортам');
assert.equal(cross.length,3);
const record={};
for(const side of [-1,1]){
  const group=model.sections['Борт '+side];
  const rail=group.getObjectByName('Внутренняя продольная балка');
  const bounds=obj=>new T.Box3().setFromObject(obj,true);
  const overlaps=obj=>{
    const joint=bounds(rail).intersect(bounds(obj));
    assert(!joint.isEmpty(),'disconnected '+obj.name);
    const size=joint.getSize(new T.Vector3()).toArray();
    assert(size.every(x=>x>1e-6),'zero contact '+obj.name);
    return size.map(x=>+x.toFixed(6));
  };
  const posts=group.children.filter(o=>o.name==='Условная опора оси');
  assert.equal(posts.length,9);
  record[side]={crossRailOverlapXYZ:cross.map(overlaps),carrierRailOverlapXYZ:posts.map(overlaps)};
}
console.log(JSON.stringify({status:'PASS',scope:'Axis-aligned scene boxes only. Historical attachments C.',sides:record},null,2));
