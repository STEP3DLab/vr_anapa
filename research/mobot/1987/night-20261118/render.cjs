const sharp=require('sharp');
(async()=>{
 const T=await import(process.cwd()+'/mobot-assets/three.module.min.js');
 const {makeMobot}=await import(process.cwd()+'/mobot-engineering-v22-model.js');
 const {makeRasterRenderer}=await import(process.cwd()+'/mobot-assets/orthographic-raster.js');
 globalThis.document={createElement:()=>({getContext:()=>null})};
 const robot=makeMobot(T,'desktop'),m=robot.mechanisms,width=1200,height=760;
 let bytes;const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:v=>bytes=Buffer.from(v.data)})};
 const renderer=makeRasterRenderer(canvas);renderer.resize(width,height);
 const {initial,poses}=await import('./poses.js');
 const three=[-3.1,1.65,-5.5];
 for(const [name,dir,index] of [['overview',three,0],['side',[0,0,-6],0],['breaker-arm',three,3],['breaker-loader',three,4]]){
  const [,mode,pose]=poses[index];
  m.setWorkTool(mode);m.setPose({...initial,...pose});
  const b=new T.Box3();robot.root.traverseVisible(o=>{if(o.isMesh)b.expandByObject(o,true)});
  const c=b.getCenter(new T.Vector3()),cam=new T.OrthographicCamera(-2.30,2.30,2.30*height/width,-2.30*height/width,.01,40);
  cam.position.copy(c).add(new T.Vector3(...dir));cam.lookAt(c);renderer.render(robot.root,cam);
  const cutout=await sharp(bytes,{raw:{width,height,channels:4}}).trim({background:'#00000000',threshold:8}).resize({width:1020,height:610,fit:'inside'}).png().toBuffer();
  await sharp({create:{width:1120,height:690,channels:3,background:'#dfe2d8'}}).composite([{input:cutout,gravity:'centre'}]).webp({quality:89}).toFile(require('node:path').join(__dirname,name+'.webp'));
 }
})().catch(e=>{console.error(e);process.exit(1)});
