// Neutral turntable frame, using the same mesh transforms as the public viewer.
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const m = makeMobot1986(T);
m.setPose({yaw:0, boom:0});
const {turntable, boom, grab} = m.mechanisms;
const pos = obj => obj.getWorldPosition(new T.Vector3());
const frame = v => turntable.worldToLocal(v).toArray();
const mast = m.sections['Высокая решётчатая стойка'];
const posts = mast.children.filter(o => o.name === 'Пояс стойки').map(o => {
  const h = o.geometry.parameters.height / 2;
  return [-h,h].map(y => frame(o.localToWorld(new T.Vector3(0,y,0))));
});
if(posts.length!==4) throw Error('Expected four mast posts');
console.log(JSON.stringify({origin:pos(turntable).toArray(), heel:frame(pos(boom)),
  nose:frame(pos(grab)), posts}));
