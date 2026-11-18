// Sample the two actual jaw skins in world axes, relative to the traverse centre.
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';

const read = file => JSON.parse(fs.readFileSync(new URL(file,import.meta.url)));
const views = read('./registration/registration.json').views;
const model = makeMobot1986(T);
const rows = {};
for (const [figure, view] of Object.entries(views)) {
  rows[figure]=[];
  for(let grab=0;grab<=32;grab++){
    model.setPose({yaw:view.demoPose.yaw,boom:view.demoPose.boom,grab});
    const jaws=[];
    const anchor=model.root.getObjectByName('Верхняя траверса').getWorldPosition(new T.Vector3());
    for(const sign of [-1,1]){
      const skin=model.sections['Ковшевая челюсть '+sign].getObjectByName('Оболочка и наружные рёбра челюсти');
      const points=[];
      for(const mesh of skin.children){
        const attr=mesh.geometry.getAttribute('position');
        for(let i=0;i<attr.count;i++){
          const v=mesh.localToWorld(new T.Vector3().fromBufferAttribute(attr,i));
          points.push(v.sub(anchor).toArray());
        }
      }
      const rib=skin.getObjectByName('Наружное поперечное ребро');
      const ends=[-1,1].map(s=>rib.localToWorld(new T.Vector3(0,0,s*rib.geometry.parameters.depth/2)).toArray());
      jaws.push({sign,ribVector:ends[1].map((v,i)=>v-ends[0][i]),points});
    }
    rows[figure].push({grab,jaws});
  }
}
console.log(JSON.stringify(rows));
