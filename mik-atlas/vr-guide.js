import * as THREE from './vendor/three.module.min.js';

const W=1024,H=896,INK='#263a33',RED='#963e2e',PAPER='#efe5cf';

// Real scene geometry: readable in both eyes, without a DOM overlay.
export class VRGuide {
  constructor(scene,camera,exhibits,questions){
    this.exhibits=exhibits;this.questions=questions;this.index=-1;this.page=0;
    this.enabled=false;this.open=true;this.hover=null;this.buttons=[];this.state={visited:[],active:false,completed:false,day:true};
    this.canvas=document.createElement('canvas');this.canvas.width=W;this.canvas.height=H;this.ctx=this.canvas.getContext('2d');
    this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    this.group=new THREE.Group();this.group.name='VR museum guide';scene.add(this.group);
    this.panel=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4*H/W),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));this.group.add(this.panel);
    const back=new THREE.Mesh(new THREE.BoxGeometry(1.42,1.4*H/W+.02,.025),new THREE.MeshBasicMaterial({color:INK}));back.position.z=-.018;this.group.add(back);
    const chip=document.createElement('canvas');chip.width=768;chip.height=160;const c=chip.getContext('2d');
    c.fillStyle=INK;c.fillRect(0,0,768,160);c.strokeStyle='#baa477';c.lineWidth=5;c.strokeRect(4,4,760,152);c.fillStyle=PAPER;c.font='bold 48px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('ПУТЕВОДИТЕЛЬ',384,80);
    const map=new THREE.CanvasTexture(chip);map.colorSpace=THREE.SRGBColorSpace;
    this.chip=new THREE.Mesh(new THREE.PlaneGeometry(.48,.1),new THREE.MeshBasicMaterial({map,toneMapped:false,depthTest:false}));
    this.chip.name='Open VR guide';this.chip.position.set(0,-.4,-1.2);this.chip.renderOrder=20;camera.add(this.chip);
    this.setEnabled(false);this.draw();
  }
  setEnabled(enabled){this.enabled=enabled;this.group.visible=enabled&&this.open;this.chip.visible=enabled&&!this.open;}
  show(head,forward){this.open=true;this.hover=null;this.anchor(head,forward);this.setEnabled(this.enabled);this.draw();}
  hide(){this.open=false;this.hover=null;this.setEnabled(this.enabled);}
  anchor(head,forward){
    const flat=new THREE.Vector3(forward.x,0,forward.z);if(flat.lengthSq()<.001)flat.set(0,0,-1);flat.normalize();
    this.group.position.copy(head).addScaledVector(flat,1.65);this.group.position.y=Math.max(.85,head.y-.18);
    this.group.lookAt(head.x,this.group.position.y,head.z);this.group.updateMatrixWorld(true);
  }
  update(index,state){if(index!==this.index){this.index=index;this.page=0;this.hover=null;}this.state=state;this.draw();}
  setPage(page){this.page=page;this.hover=null;this.draw();}
  setHover(action){if(this.hover===action)return;this.hover=action;this.draw();}
  hit(raycaster){
    if(!this.enabled)return null;
    if(!this.open){const hit=raycaster.intersectObject(this.chip)[0];return hit?{...hit,type:'guide',action:'open'}:null;}
    const hit=raycaster.intersectObject(this.panel)[0];if(!hit)return null;
    const x=hit.uv.x*W,y=(1-hit.uv.y)*H;
    const button=this.buttons.find(b=>!b.disabled&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    return {...hit,type:'guide',action:button?.action??null};
  }
  draw(){
    const c=this.ctx,e=this.exhibits[this.index],s=this.state;this.buttons=[];
    c.fillStyle=PAPER;c.fillRect(0,0,W,H);c.fillStyle=RED;c.fillRect(0,0,12,H);c.textAlign='left';c.textBaseline='middle';
    const text=(value,x,y,size=30,color=INK,bold=false)=>{c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;c.fillStyle=color;c.fillText(value,x,y);};
    const button=(action,label,x,y,w,h,{primary=false,disabled=false,active=false}={})=>{
      const hover=this.hover===action;this.buttons.push({action,x,y,w,h,disabled});
      c.fillStyle=disabled?'#ddd4c1':hover?'#b1573c':primary||active?RED:'#ded6c2';c.fillRect(x,y,w,h);
      c.textAlign='center';text(label,x+w/2,y+h/2,28,disabled?'#8a877a':hover||primary||active?PAPER:INK,true);c.textAlign='left';
    };
    const paragraph=(value,y,size=31,lineHeight=42)=>{
      c.font=`${size}px Arial, sans-serif`;let line='';
      for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>928){text(line,48,y,size);y+=lineHeight;line=word;}else line=next;}
      if(line)text(line,48,y,size);return y+lineHeight;
    };
    text('МИК / АТЛАС БУДУЩЕГО',48,49,24,RED,true);
    text(e?String(this.index+1).padStart(2,'0')+' / 04':'VR / ПАВИЛЬОН',795,49,24,RED,true);
    text(e?e.title:'Ваш путеводитель',48,108,48,INK,true);
    if(e){
      ['Об экспонате','Задание','Источник'].forEach((label,i)=>button('page:'+i,label,48+i*314,154,300,62,{active:this.page===i}));
      text(e.category,48,254,22,RED,true);
      if(this.page===0)paragraph(e.description,304);
      else if(this.page===1){paragraph(this.questions[this.index],304);text('ОБСУДИТЕ В ГРУППЕ ПОСЛЕ ОСМОТРА',48,540,23,RED,true);}
      else{
        paragraph(e.fact,304,29,40);
        if(this.index===0){text('Источник скана: Printables / модель 662942',48,512,25);text('fractalnoise · CC BY-NC-SA 4.0',48,549,25,RED,true);}
        else text('Авторская учебная модель / Павильон МИК',48,549,25,RED,true);
      }
    }else{
      paragraph('Четыре экспоната. Четыре взгляда на историю идей, искусство и инженерию.',193,34,46);
      paragraph('Наведите луч на кнопку и нажмите курок. На полу курок переносит вас в выбранную точку. Правый стик поворачивает на 30°.',335,31,42);
      text('СЖАТИЕ КОНТРОЛЛЕРА — ВЫЗВАТЬ ПАНЕЛЬ',48,540,25,RED,true);
    }
    const progress=s.completed?'МАРШРУТ ПРОЙДЕН':s.active?'МАРШРУТ / ОСМОТРЕНО '+s.visited.length+' ИЗ 4':'СВОБОДНЫЙ ОСМОТР';
    text(progress,48,599,23,RED,true);
    for(let i=0;i<4;i++){c.fillStyle=s.visited.includes(i)?RED:'#cabea7';c.fillRect(790+i*46,590,34,10);}
    if(e){
      button('previous','← Назад',48,630,265,76,{disabled:this.index===0});
      button(s.active&&this.index===3?'finish':'next',s.active&&this.index===3?'Завершить ✓':this.index===3?'К первому →':'Далее →',325,630,355,76,{primary:true});
      button('overview','Общий вид',692,630,284,76);
    }else{button('start','Начать маршрут →',48,630,928,76,{primary:true});}
    button('light',s.day?'Свет: день':'Свет: вечер',48,722,300,66);
    button('hide','Скрыть панель',362,722,300,66);
    button('exit','Выйти из VR',676,722,300,66);
    text('ЛУЧ + КУРОК — ВЫБРАТЬ',48,834,22);
    text('СЖАТИЕ — ВЕРНУТЬ ПАНЕЛЬ',548,834,22);
    this.texture.needsUpdate=true;
  }
}
