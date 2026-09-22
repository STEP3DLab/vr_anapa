import * as T from 'three';
import data from '../assets/models/showcase.json';

type MeshData={name:string;material:string;position:string;normal:string;color?:string;index:string;centers?:number[][]};
/** Source models are converted at build preparation time; no network/CDN dependency during a show. */
export function createShowcaseModels(){
    const geometries:T.BufferGeometry[]=[],materials:Record<string,T.MeshStandardMaterial>={
        gunSteel:new T.MeshStandardMaterial({color:0x52606a,metalness:.88,roughness:.29}),
        gunPolymer:new T.MeshStandardMaterial({color:0x171d21,metalness:.04,roughness:.72}),
        drone:new T.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.44})
    };
    function bytes(value:string){const text=atob(value),out=new Uint8Array(text.length);for(let i=0;i<text.length;i++)out[i]=text.charCodeAt(i);return out.buffer;}
    function geometry(d:MeshData){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes(d.position)),3));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(bytes(d.normal)),3));if(d.color)g.setAttribute('color',new T.BufferAttribute(new Float32Array(bytes(d.color)),3));g.setIndex(new T.BufferAttribute(new Uint16Array(bytes(d.index)),1));g.computeBoundingBox();g.computeBoundingSphere();geometries.push(g);return g;}
    const gunParts=data.gun.map(d=>({d,g:geometry(d)})),droneParts=data.drone.map(d=>({d,g:geometry(d)}));
    function gun(){const root=new T.Group();root.name='shotgun';root.userData.source='J-Toastie / Mossberg 590A1 / CC BY 3.0';for(const {d,g} of gunParts){const m=new T.Mesh(g,materials[d.material]);m.name=d.name;root.add(m);}return root;}
    function drone(){const root=new T.Group();root.name='imported-quadcopter';root.userData.source='NateGazzard / Drone / CC BY 3.0';let rotors!:T.InstancedMesh;const offsets:number[][]=[];for(const {d,g} of droneParts){if('centers'in d&&d.centers){rotors=new T.InstancedMesh(g,materials.drone,4);rotors.name='drone-rotors';rotors.instanceMatrix.setUsage(T.DynamicDrawUsage);const temp=new T.Object3D();for(let i=0;i<4;i++){offsets.push(d.centers[i]);temp.position.fromArray(d.centers[i]);temp.updateMatrix();rotors.setMatrixAt(i,temp.matrix);}rotors.boundingSphere=new T.Sphere(new T.Vector3(),1.6);root.add(rotors);}else{const mesh=new T.Mesh(g,materials.drone);mesh.name=d.name;root.add(mesh);}}return {root,rotors,offsets};}
    return {gun,drone,dispose(){geometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());}};
}
