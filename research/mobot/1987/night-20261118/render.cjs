const sharp=require('sharp');
(async()=>{
 const T=await import(process.cwd()+'/mobot-assets/three.module.min.js');
 const {makeMobot}=await import(process.cwd()+'/mobot-engineering-v22-model.js');
 const {makeRasterRenderer}=await import(process.cwd()+'/mobot-assets/orthographic-raster.js');
 globalThis.document={createElement:()=>({getContext:()=>null})};
 const robot=makeMobot(T,'desktop'),m=robot.mechanisms,width=1200,height=760;
 let bytes;const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:v=>bytes=Buffer.from(v.data)})};
 const renderer=makeRasterRenderer(canvas);renderer.resize(width,height);
 for(const [name,dir,mode,pose] of [['overview',[-3.1,1.65,-5.5],'gripper',{}],['side',[0,0,-6],'gripper',{}],['breaker-arm',[-3.1,1.65,-5.5],'breaker-arm',{yaw:-65,arm:22,wrist:60,bucket:0}],['breaker-loader',[-3.1,1.65,-5.5],'breaker-loader',{bucket:36}]]){
  m.setWorkTool(mode);m.setPose({yaw:0,arm:0,wrist:90,claw:4,bucket:8,tip:0,track:0,...pose});
  const b=new T.Box3();robot.root.traverseVisible(o=>{if(o.isMesh)b.expandByObject(o,true)});
  const c=b.getCenter(new T.Vector3()),cam=new T.OrthographicCamera(-2.30,2.30,2.30*height/width,-2.30*height/width,.01,40);
  cam.position.copy(c).add(new T.Vector3(...dir));cam.lookAt(c);renderer.render(robot.root,cam);
  const cutout=await sharp(bytes,{raw:{width,height,channels:4}}).trim({background:'#00000000',threshold:8}).resize({width:1020,height:610,fit:'inside'}).png().toBuffer();
  await sharp({create:{width:1120,height:690,channels:3,background:'#dfe2d8'}}).composite([{input:cutout,gravity:'centre'}]).webp({quality:89}).toFile(require('node:path').join(__dirname,name+'.webp'));
 }
})().catch(e=>{console.error(e);process.exit(1)});
