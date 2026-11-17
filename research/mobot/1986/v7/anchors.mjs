import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v6-model.js';
const factory=process.argv[2]==='v7'?(await import('../../../../mobot-ch-hv-1986-research-v7-model.js')).makeMobot1986:makeMobot1986;
const model=factory(T),world=o=>o.getWorldPosition(new T.Vector3()).toArray();
const lamps=model.objects.filter(m=>m.name.startsWith('Светлый круглый диск'));
const scenes={};
for(const [figure,side] of [['fig6',1],['fig9',-1]]){
  const hubs=[];
  model.sections['Борт '+side].traverse(o=>{if(o.name==='Ступица')hubs.push(world(o));});
  const pts={endRear:hubs[7],endFront:hubs[8],lampNear:world(lamps[side===1?1:0]),lampFar:world(lamps[side===1?0:1])};
  hubs.slice(0,7).forEach((v,i)=>{pts['road'+i]=v;});
  const hood=model.root.getObjectByName('Торцевой лист кожуха').geometry.attributes.position;
  let peak=new T.Vector3(),q=new T.Vector3();
  const plate=model.objects.find(o=>o.name==='Торцевой лист кожуха'&&Math.sign(o.position.z)===side);
  for(let i=0;i<hood.count;i++){q.fromBufferAttribute(hood,i);if(q.y>peak.y)peak.copy(q);}
  pts.hood=plate.localToWorld(peak).toArray();scenes[figure]=pts;
}
console.log(JSON.stringify(scenes));
