// A small orthographic z-buffer renderer for browsers without WebGL.
// Reads the same Three.js geometry, material colours, joint transforms and
// instances as the GPU path. Renders only when the camera or pose changes.
import { Matrix3, Matrix4, Vector3, Color, DoubleSide } from './three.module.min.js';

export function makeRasterRenderer(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  const palettes = new WeakMap();
  const world = new Matrix4(), instance = new Matrix4(), mvp = new Matrix4();
  const viewProjection = new Matrix4(), normalMatrix = new Matrix3();
  const light = new Vector3(-.45,.84,-.32).normalize();
  const fill = new Vector3(.5,.2,.84).normalize();
  const eye = new Vector3(), half = new Vector3();
  let buffer, pixels, depth, projected = new Float32Array(0);

  function palette(material) {
    if (palettes.has(material)) return palettes.get(material);
    const rgb = new Color(material.color).convertLinearToSRGB();
    const shades = new Uint32Array(256);
    for(let i=0;i<256;i++) {
      const channel = v => Math.min(255, Math.round(v * (.39+i/204)*255 + .063*i));
      shades[i] = (255<<24) | (channel(rgb.b)<<16) | (channel(rgb.g)<<8) | channel(rgb.r);
    }
    palettes.set(material, shades);
    return shades;
  }

  function drawTriangle(ia, ib, ic, shades, twoSided) {
    const p = projected;
    const ax=p[ia], ay=p[ia+1], bx=p[ib], by=p[ib+1], cx=p[ic], cy=p[ic+1];
    const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    if(Math.abs(area)<.025 || (area>0 && !twoSided)) return;
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5));
    const x1=Math.min(canvas.width-1,Math.floor(Math.max(ax,bx,cx)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5));
    const y1=Math.min(canvas.height-1,Math.floor(Math.max(ay,by,cy)-.5));
    const dxB=(cy-ay)/area, dyB=(ax-cx)/area;
    const dxC=(ay-by)/area, dyC=(bx-ax)/area;
    const az=p[ia+2], bz=p[ib+2]-az, cz=p[ic+2]-az;
    const as=p[ia+3], bs=p[ib+3]-as, cs=p[ic+3]-as;
    let rowB=((x0+.5-ax)*(cy-ay)-(y0+.5-ay)*(cx-ax))/area;
    let rowC=((y0+.5-ay)*(bx-ax)-(x0+.5-ax)*(by-ay))/area;
    for(let y=y0; y<=y1; y++,rowB+=dyB,rowC+=dyC) {
      let b=rowB,c=rowC,offset=y*canvas.width+x0;
      for(let x=x0; x<=x1; x++,b+=dxB,c+=dxC,offset++) {
        if(b<-.00001 || c<-.00001 || b+c>1.00001) continue;
        const z=az+b*bz+c*cz;
        if(z>=depth[offset] || z < -1 || z>1) continue;
        depth[offset]=z;
        pixels[offset]=shades[Math.max(0,Math.min(255,(as+b*bs+c*cs)|0))];
      }
    }
  }

  function drawMesh(mesh, transform) {
    const geom=mesh.geometry, pos=geom.attributes.position, norm=geom.attributes.normal;
    if(!pos || !norm) return;
    const total=pos.count, points=pos.array, normals=norm.array;
    if(projected.length<total*4) projected=new Float32Array(total*4);
    const mat=mvp.multiplyMatrices(viewProjection,transform).elements;
    const n=normalMatrix.getNormalMatrix(transform).elements;
    const sx=canvas.width/2, sy=canvas.height/2;
    const shades=palette(mesh.material);
    const spec=22+mesh.material.metalness*28;
    for(let i=0, j=0, k=0;i<total;i++,j+=3,k+=4) {
      const x=points[j],y=points[j+1],z=points[j+2];
      projected[k]=(mat[0]*x+mat[4]*y+mat[8]*z+mat[12]+1)*sx;
      projected[k+1]=(1-(mat[1]*x+mat[5]*y+mat[9]*z+mat[13]))*sy;
      projected[k+2]=mat[2]*x+mat[6]*y+mat[10]*z+mat[14];
      const a=normals[j],b=normals[j+1],c=normals[j+2];
      let nx=n[0]*a+n[3]*b+n[6]*c, ny=n[1]*a+n[4]*b+n[7]*c, nz=n[2]*a+n[5]*b+n[8]*c;
      const inv=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
      nx*=inv; ny*=inv; nz*=inv;
      const diffuse=Math.max(0,nx*light.x+ny*light.y+nz*light.z);
      const bounce=Math.max(0,nx*fill.x+ny*fill.y+nz*fill.z);
      const h=Math.max(0,nx*half.x+ny*half.y+nz*half.z);
      projected[k+3]=50+diffuse*123+bounce*34+ny*14+h**12*spec;
    }
    const indices=geom.index?.array, twoSided=mesh.material.side===DoubleSide;
    const count=indices?indices.length:total;
    for(let i=0;i<count;i+=3) {
      if(indices) drawTriangle(indices[i]*4,indices[i+1]*4,indices[i+2]*4,shades,twoSided);
      else drawTriangle(i*4,(i+1)*4,(i+2)*4,shades,twoSided);
    }
  }

  function shadeContacts() {
    const w=canvas.width, h=canvas.height;
    const radius=Math.max(2,Math.round(h/155));
    const offsets=[-radius,radius,-radius*w,radius*w,-radius*w-radius,radius*w+radius];
    for(let y=radius; y<h-radius; y++){
      for(let x=radius, i=y*w+x; x<w-radius; x++,i++){
        if(!Number.isFinite(depth[i])) continue;
        let occlusion=0;
        for(let k=0;k<offsets.length;k++){
          const dz=depth[i]-depth[i+offsets[k]];
          if(dz>.00045 && dz<.023) occlusion+=Math.min(1,dz/.002)*(1-dz/.023);
        }
        if(occlusion<.04) continue;
        const factor=1-.073*occlusion, rgb=pixels[i];
        const red=(rgb&255)*factor, green=((rgb>>>8)&255)*factor, blue=((rgb>>>16)&255)*factor;
        pixels[i]=(255<<24)|(blue<<16)|(green<<8)|red;
      }
    }
  }

  return {
    resize(width,height) {
      if(buffer && canvas.width===width && canvas.height===height) return;
      canvas.width=width; canvas.height=height;
      buffer=context.createImageData(width,height);
      pixels=new Uint32Array(buffer.data.buffer);
      depth=new Float32Array(width*height);
    },
    render(root,camera) {
      pixels.fill(0); depth.fill(Infinity);
      root.updateMatrixWorld(true); camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      camera.getWorldDirection(eye).negate();
      half.copy(light).add(eye).normalize();
      root.traverseVisible(mesh=>{
        if(!mesh.isMesh) return;
        if(mesh.isInstancedMesh) {
          for(let i=0;i<mesh.count;i++) {
            mesh.getMatrixAt(i,instance);
            drawMesh(mesh,world.multiplyMatrices(mesh.matrixWorld,instance));
          }
        } else drawMesh(mesh,mesh.matrixWorld);
      });
      shadeContacts();
      context.putImageData(buffer,0,0);
    }
  };
}
