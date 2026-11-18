// A small CPU renderer for devices where WebGL is unavailable. It renders real
// triangles from the same CAD model and keeps orbit/zoom controls available.
import * as THREE from 'three';
export class SoftwareRenderer {
 constructor(){
  this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');
  if(!this.ctx)throw Error('Canvas unavailable');
  this.domElement.style.filter='drop-shadow(17px 23px 16px #3b49382a)';
  this.isSoftwareRenderer=true;this.ratio=Math.min(devicePixelRatio,1.5);this.last='';this.prepared=new WeakMap();
  this.mv=new THREE.Matrix4();this.normal=new THREE.Matrix3();this.light=new THREE.Vector3(-.55,.65,.9).normalize();
 }
 setSize(w,h){this.width=w;this.height=h;this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';this.last='';}
 data(geometry){
  if(this.prepared.has(geometry))return this.prepared.get(geometry);
  const pos=geometry.attributes.position.array,idx=geometry.index?.array||Uint32Array.from({length:pos.length/3},(_,i)=>i);
  const data={pos,idx,view:new Float32Array(pos.length),screen:new Float32Array(pos.length/3*2)};this.prepared.set(geometry,data);return data;
 }
 render(scene,camera){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const meshes=[];scene.traverse(o=>{if(o.isMesh&&o.visible&&o.material.type!=='ShadowMaterial')meshes.push(o)});
  const stamp=camera.matrixWorld.elements.join(',')+camera.projectionMatrix.elements[0]+meshes.map(o=>o.matrixWorld.elements.join(',')+o.material.color.getHex()).join('|');
  if(stamp===this.last)return;this.last=stamp;
  const faces=[],w=this.width,h=this.height,pm=camera.projectionMatrix.elements;
  for(const mesh of meshes){
   const d=this.data(mesh.geometry),p=d.pos,v=d.view,s=d.screen;
   this.mv.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);const m=this.mv.elements;
   this.normal.getNormalMatrix(mesh.matrixWorld);const nm=this.normal.elements;
   const matColor=mesh.material.color.clone().convertLinearToSRGB();
   const rgb=[matColor.r*255,matColor.g*255,matColor.b*255];
   for(let i=0,j=0;i<p.length;i+=3,j+=2){const x=p[i],y=p[i+1],z=p[i+2];v[i]=m[0]*x+m[4]*y+m[8]*z+m[12];v[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];v[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];s[j]=(v[i]*pm[0]/-v[i+2]+1)*w/2;s[j+1]=(1-v[i+1]*pm[5]/-v[i+2])*h/2;}
   for(let f=0;f<d.idx.length;f+=3){
    const a=d.idx[f],b=d.idx[f+1],c=d.idx[f+2],a3=a*3,b3=b*3,c3=c*3;
    if(v[a3+2]>-1||v[b3+2]>-1||v[c3+2]>-1)continue;
    const ux=v[b3]-v[a3],uy=v[b3+1]-v[a3+1],uz=v[b3+2]-v[a3+2],vx=v[c3]-v[a3],vy=v[c3+1]-v[a3+1],vz=v[c3+2]-v[a3+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*v[a3]+ny*v[a3+1]+nz*v[a3+2]>=0)continue;
    const x1=s[a*2],y1=s[a*2+1],x2=s[b*2],y2=s[b*2+1],x3=s[c*2],y3=s[c*2+1];
    if(Math.max(x1,x2,x3)<0||Math.min(x1,x2,x3)>w||Math.max(y1,y2,y3)<0||Math.min(y1,y2,y3)>h)continue;
    const ax=p[b3]-p[a3],ay=p[b3+1]-p[a3+1],az=p[b3+2]-p[a3+2],bx=p[c3]-p[a3],by=p[c3+1]-p[a3+1],bz=p[c3+2]-p[a3+2];
    const ox=ay*bz-az*by,oy=az*bx-ax*bz,oz=ax*by-ay*bx;
    let wx=nm[0]*ox+nm[3]*oy+nm[6]*oz,wy=nm[1]*ox+nm[4]*oy+nm[7]*oz,wz=nm[2]*ox+nm[5]*oy+nm[8]*oz;
    const len=Math.hypot(wx,wy,wz)||1;wx/=len;wy/=len;wz/=len;
    const illumination=.69+.36*Math.max(0,wx*this.light.x+wy*this.light.y+wz*this.light.z)+.035*Math.max(0,-wx);
    const shade=rgb.map(v=>Math.round(Math.min(255,v*illumination)));
    faces.push([v[a3+2]+v[b3+2]+v[c3+2],x1,y1,x2,y2,x3,y3,`rgb(${shade.join(',')})`]);
   }
  }
  faces.sort((a,b)=>a[0]-b[0]);
  const ctx=this.ctx;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,w,h);ctx.lineWidth=.35;ctx.lineJoin='round';
  for(const f of faces){ctx.beginPath();ctx.moveTo(f[1],f[2]);ctx.lineTo(f[3],f[4]);ctx.lineTo(f[5],f[6]);ctx.closePath();ctx.fillStyle=f[7];ctx.strokeStyle=f[7];ctx.fill();ctx.stroke();}
 }
}
