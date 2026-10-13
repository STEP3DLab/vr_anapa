import * as THREE from './vendor/three.module.min.js';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const common='varying vec2 vUv;uniform sampler2D tInput;';

// HDR bloom for the desktop detail mode. XR always renders directly, per eye.
export class CinematicRenderer{
  constructor(renderer){
    this.renderer=renderer;this.available=!!renderer.extensions?.has('EXT_color_buffer_float');this.size=new THREE.Vector2();this.width=0;this.height=0;
    if(!this.available)return;
    const options={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false};
    this.sceneTarget=new THREE.WebGLRenderTarget(1,1,{...options,depthBuffer:true,samples:2});this.a=new THREE.WebGLRenderTarget(1,1,options);this.b=new THREE.WebGLRenderTarget(1,1,options);
    const make=(fragmentShader,uniforms,toneMapped=false)=>new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false,toneMapped});
    this.extract=make(common+'void main(){vec3 c=texture2D(tInput,vUv).rgb;float b=max(c.r,max(c.g,c.b));float k=smoothstep(.85,1.6,b);gl_FragColor=vec4(c*k,1.);}',{tInput:{value:null}});
    this.blur=make(common+'uniform vec2 uDirection;void main(){vec3 c=texture2D(tInput,vUv).rgb*.227027;c+=texture2D(tInput,vUv+uDirection*1.384615).rgb*.316216;c+=texture2D(tInput,vUv-uDirection*1.384615).rgb*.316216;c+=texture2D(tInput,vUv+uDirection*3.230769).rgb*.070270;c+=texture2D(tInput,vUv-uDirection*3.230769).rgb*.070270;gl_FragColor=vec4(c,1.);}',{tInput:{value:null},uDirection:{value:new THREE.Vector2()}});
    this.output=make(common+`uniform sampler2D tBloom;uniform float uStrength;void main(){vec3 base=texture2D(tInput,vUv).rgb;vec3 glow=texture2D(tBloom,vUv).rgb;float vignette=1.-.16*smoothstep(.18,.72,length(vUv-.5));gl_FragColor=vec4((base+glow*uStrength)*vignette,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,{tInput:{value:null},tBloom:{value:null},uStrength:{value:.38}},true);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
    this.quad=new THREE.Mesh(geometry,this.output);this.quad.frustumCulled=false;this.scene=new THREE.Scene();this.scene.add(this.quad);this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  }
  resize(){
    const r=this.renderer;r.getDrawingBufferSize(this.size);const w=Math.max(1,Math.floor(this.size.x)),h=Math.max(1,Math.floor(this.size.y));if(w===this.width&&h===this.height)return;
    this.width=w;this.height=h;this.sceneTarget.setSize(w,h);this.a.setSize(Math.max(1,Math.ceil(w/4)),Math.max(1,Math.ceil(h/4)));this.b.setSize(this.a.width,this.a.height);
  }
  render(scene,camera,{detail=true,xr=false,energy=0}={}){
    const r=this.renderer;
    if(!this.available||!detail||xr||r.xr.isPresenting){r.render(scene,camera);return;}
    this.resize();const previous=r.getRenderTarget();
    const pass=(material,target)=>{this.quad.material=material;r.setRenderTarget(target);r.render(this.scene,this.camera);};
    try{
      r.setRenderTarget(this.sceneTarget);r.render(scene,camera);
      this.extract.uniforms.tInput.value=this.sceneTarget.texture;pass(this.extract,this.a);
      for(let i=0;i<2;i++){
        this.blur.uniforms.tInput.value=this.a.texture;this.blur.uniforms.uDirection.value.set((1+i)/this.a.width,0);pass(this.blur,this.b);
        this.blur.uniforms.tInput.value=this.b.texture;this.blur.uniforms.uDirection.value.set(0,(1+i)/this.a.height);pass(this.blur,this.a);
      }
      this.output.uniforms.tInput.value=this.sceneTarget.texture;this.output.uniforms.tBloom.value=this.a.texture;this.output.uniforms.uStrength.value=.38+energy*.17;pass(this.output,previous);
    }finally{r.setRenderTarget(previous);}
  }
  dispose(){if(!this.available)return;for(const target of [this.sceneTarget,this.a,this.b])target.dispose();for(const material of [this.extract,this.blur,this.output])material.dispose();this.quad.geometry.dispose();}
}
