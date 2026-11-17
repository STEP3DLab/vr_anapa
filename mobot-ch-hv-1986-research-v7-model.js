// 1986 only. The measured inputs are image-space ratios; scene lengths and linkage are C.
import {makeMobot1986 as makeV6} from './mobot-ch-hv-1986-research-v6-model.js';

export function makeMobot1986(T){
  const model=makeV6(T),{root,sections,materials,mechanisms}=model;
  const m=materials,up=new T.Vector3(0,1,0);
  function mesh(parent,geometry,material,name){
    const o=new T.Mesh(geometry,material);o.name=name;o.userData.geometry='C';
    parent.add(o);model.objects.push(o);return o;
  }
  function pin(parent,x,y,z,r,width,name){
    const o=mesh(parent,new T.CylinderGeometry(r,r,width,24),m.steel,name);
    o.position.set(x,y,z);o.rotation.x=Math.PI/2;return o;
  }
  function bar(parent,a,b,width,depth,name){
    const o=mesh(parent,new T.BoxGeometry(width,1,depth),m.steel,name);
    between(o,a,b);return o;
  }
  function between(o,a,b){
    const v=new T.Vector3().subVectors(b,a);
    o.position.copy(a).lerp(b,.5);o.scale.y=v.length();
    o.quaternion.setFromUnitVectors(up,v.normalize());
  }
  const camera=sections['Верхний цилиндрический корпус камеры'];
  for(const old of [...camera.children]){
    camera.remove(old);const index=model.objects.indexOf(old);if(index>=0)model.objects.splice(index,1);
  }
  // Fig. 6: wide rear housing, collar, narrower tube, rim and recessed dark end.
  const profile=[[-.263,.018],[-.259,.080],[-.244,.106],[-.130,.111],[-.125,.124],
    [-.091,.124],[-.083,.105],[-.064,.079],[.125,.076],[.199,.095],
    [.215,.111],[.244,.111],[.244,.096],[.219,.094]];
  const shell=mesh(camera,new T.LatheGeometry(profile.map(([x,r])=>new T.Vector2(r,x)),48),m.structure,'Профилированный корпус верхней камеры');
  shell.rotation.z=-Math.PI/2;
  const aperture=mesh(camera,new T.CylinderGeometry(.094,.094,.008,40),m.dark,'Утопленный торец корпуса');
  aperture.rotation.z=-Math.PI/2;aperture.position.x=.216;
  for(const side of [-1,1]){
    bar(camera,new T.Vector3(-.01,-.116,side*.055),new T.Vector3(-.116,-.021,side*.115),.023,.019,'Щека опоры корпуса, схема C');
    pin(camera,-.117,-.020,side*.12,.025,.022,'Ось щеки, схема C');
  }
  // Fig. 6 nominal exterior ratio 72/114. Regularize the reduction because
  // the photograph is oblique and the visible rail is only a proxy for the axis.
  const jawDepthFactor=.68,frameHeight=.575-.286,lipDepth=.329*jawDepthFactor;
  const head=sections['Открытая рамка грейфера'],grab=mechanisms.grab;
  const linkages=[];
  for(const end of [-1,1]){
    const jaw=sections['Ковшевая челюсть '+end],skin=new T.Group();
    skin.name='Оболочка и наружные рёбра челюсти';jaw.add(skin);
    for(const child of [...jaw.children]){
      if(child!==skin&&child.name!=='Палец челюсти')skin.add(child);
    }
    skin.scale.y=jawDepthFactor;
    for(const [x,y] of [[.134,-.127],[.135,-.205]]){
      const rib=mesh(skin,new T.BoxGeometry(.014,.014,.344),m.steel,'Наружное поперечное ребро');
      rib.position.set(end*x,y,0);
    }
    for(const side of [-1,1]){
      const z=side*.210,A=new T.Vector3(end*.069,-.297,z),eye=new T.Vector3(end*.098,-.115*jawDepthFactor,z);
      pin(head,A.x,A.y,side*.163,.020,.109,'Палец верхнего звена');
      pin(jaw,eye.x,eye.y,side*.181,.023,.085,'Палец звена челюсти');
      const first=bar(head,A,new T.Vector3(A.x,-.45,z),.020,.017,'Верхнее звено, схема C');
      const second=bar(head,A,new T.Vector3(A.x,-.49,z),.021,.017,'Нижнее звено, схема C');
      const elbow=pin(head,0,0,z,.028,.029,'Промежуточная проушина');
      linkages.push({A,eye,jaw,first,second,elbow,end});
    }
  }
  const lengths=[.216,.212];
  function follow(){
    for(const {A,eye,jaw,first,second,elbow,end} of linkages){
      jaw.updateMatrix();const C=eye.clone().applyMatrix4(jaw.matrix);
      const d=C.clone().sub(A),span=d.length(),unit=d.multiplyScalar(1/span);
      const proj=(lengths[0]**2-lengths[1]**2+span**2)/(2*span);
      const height=Math.sqrt(Math.max(0,lengths[0]**2-proj**2));
      const B=A.clone().addScaledVector(unit,proj);
      B.x+=end*(-unit.y)*height;B.y+=end*unit.x*height;
      between(first,A,B);between(second,B,C);elbow.position.copy(B);
    }
    root.updateMatrixWorld(true);
  }
  const previous=model.setPose;
  model.setPose=(pose={})=>{const state=previous(pose);follow();return state;};
  root.name='Мобот-Ч-ХВ 1986 / v7';root.userData.version='1986-v7';
  model.v7={jawDepthFactor,lipDepth,frameHeight,linkages,lengths,grab};
  model.setPose(model.defaults);return model;
}
