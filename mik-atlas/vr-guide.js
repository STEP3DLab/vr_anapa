import * as THREE from './vendor/three.module.min.js';
import {PAVILION} from './gallery.js?v=7.1';
const W=1024,H=448,PAPER='#eadfc7',GOLD='#cdb083';

// A compact physical caption below eye level, identical navigation in both eyes.
export class VRGuide{
  constructor(scene,camera,exhibits){
    this.exhibits=exhibits;this.index=-1;this.info=false;this.enabled=false;this.open=true;this.hover=null;this.buttons=[];
    this.canvas=document.createElement('canvas');this.canvas.width=W;this.canvas.height=H;this.ctx=this.canvas.getContext('2d');
    this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.group=new THREE.Group();this.group.name='VR collection caption';scene.add(this.group);
    this.panel=new THREE.Mesh(new THREE.PlaneGeometry(1.12,1.12*H/W),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));this.group.add(this.panel);
    const back=new THREE.Mesh(new THREE.BoxGeometry(1.13,1.12*H/W+.012,.02),new THREE.MeshBasicMaterial({color:'#15221c'}));back.position.z=-.012;this.group.add(back);
    const chip=document.createElement('canvas');chip.width=512;chip.height=128;const c=chip.getContext('2d');c.fillStyle='#19281f';c.fillRect(0,0,512,128);c.fillStyle=PAPER;c.textAlign='center';c.textBaseline='middle';c.font='38px Arial, sans-serif';c.fillText('Коллекция',256,64);
    const map=new THREE.CanvasTexture(chip);map.colorSpace=THREE.SRGBColorSpace;
    this.chip=new THREE.Mesh(new THREE.PlaneGeometry(.32,.08),new THREE.MeshBasicMaterial({map,toneMapped:false,depthTest:false}));this.chip.position.set(0,-.39,-1.2);this.chip.renderOrder=20;camera.add(this.chip);this.setEnabled(false);this.draw();
  }
  setEnabled(enabled){this.enabled=enabled;this.group.visible=enabled&&this.open;this.chip.visible=enabled&&!this.open;}
  show(head,forward){this.open=true;this.hover=null;this.anchor(head,forward);this.setEnabled(this.enabled);this.draw();}
  hide(){this.open=false;this.hover=null;this.setEnabled(this.enabled);}
  anchor(head,forward){const flat=new THREE.Vector3(forward.x,0,forward.z);if(flat.lengthSq()<.001)flat.set(0,0,-1);flat.normalize();this.group.position.copy(head).addScaledVector(flat,1.65);this.group.position.y=Math.max(.45,head.y-.52);this.group.lookAt(head.x,head.y-.08,head.z);this.group.updateMatrixWorld(true);}
  update(index){if(index===this.index)return;this.index=index;this.info=false;this.hover=null;this.draw();}
  toggleInfo(){this.info=!this.info;this.hover=null;this.draw();}
  setHover(action){if(this.hover===action)return;this.hover=action;this.draw();}
  hit(raycaster){
    if(!this.enabled)return null;
    if(!this.open){const hit=raycaster.intersectObject(this.chip)[0];return hit?{...hit,type:'guide',action:'open'}:null;}
    const hit=raycaster.intersectObject(this.panel)[0];if(!hit)return null;
    const x=hit.uv.x*W,y=(1-hit.uv.y)*H;
    const button=this.buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    return {...hit,type:'guide',action:button?.action??null};
  }
  draw(){
    const c=this.ctx,item=this.exhibits[this.index]||PAVILION;this.buttons=[];
    c.fillStyle='#19261f';c.fillRect(0,0,W,H);c.strokeStyle='#8c7854';c.lineWidth=2;c.strokeRect(1,1,W-2,H-2);c.textAlign='left';c.textBaseline='middle';
    const text=(value,x,y,size=30,color=PAPER)=>{c.font=`${size}px Arial, sans-serif`;c.fillStyle=color;c.fillText(value,x,y);};
    const button=(action,label,x,y,w,h,quiet=false)=>{this.buttons.push({action,x,y,w,h});c.fillStyle=this.hover===action?'#514b37':'#29362b';if(!quiet||this.hover===action)c.fillRect(x,y,w,h);c.textAlign='center';text(label,x+w/2,y+h/2,quiet?24:28,quiet?'#d1c9b7':PAPER);c.textAlign='left';};
    text('МИК / АТЛАС БУДУЩЕГО',40,40,21,GOLD);
    button('info',this.info?'К объекту':'Об объекте',772,18,212,48);
    button('previous','←',40,99,82,76);button('next','→',902,99,82,76);
    c.textAlign='center';text(item.title,512,136,46);c.textAlign='left';
    if(this.info){
      let line='',y=208;c.font='27px Arial, sans-serif';
      for(const word of item.description.split(/\s+/)){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>936){text(line,44,y,27);y+=35;line=word;}else line=next;}if(line)text(line,44,y,27);
      if(this.index===0)text('3D-скан: fractalnoise · CC BY-NC-SA 4.0',44,322,21,GOLD);
    }else{c.textAlign='center';text(item.caption,512,239,28,GOLD);text(this.index<0?'КОЛЛЕКЦИЯ':String(this.index+1).padStart(2,'0')+' / 04',512,298,21,'#b9b7a2');c.textAlign='left';}
    c.strokeStyle='#51604c';c.lineWidth=1;c.beginPath();c.moveTo(40,350);c.lineTo(984,350);c.stroke();
    button('hide','Скрыть панель',40,364,452,54,true);button('exit','Выйти из VR',512,364,472,54,true);
    this.texture.needsUpdate=true;
  }
}
