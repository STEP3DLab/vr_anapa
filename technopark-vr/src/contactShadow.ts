import {Mesh,PlaneGeometry,ShaderMaterial} from 'three';
/** Small analytical contact patch: one local quad, no shadow map or texture. */
export function contactShadow(width:number,length:number){
 const geometry=new PlaneGeometry(width,length);
 const material=new ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 v;void main(){float d=length((v-.5)*2.);float a=(1.-smoothstep(.35,1.,d))*.28;gl_FragColor=vec4(.015,.025,.026,a);}'
 });
 const mesh=new Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.03;mesh.name='contact-shadow';mesh.renderOrder=1;
 return {mesh,dispose(){geometry.dispose();material.dispose();}};
}
