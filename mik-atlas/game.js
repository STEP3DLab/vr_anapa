export const STATIONS=[
  {name:'Сигнал памяти',verb:'Сканировать',hint:'Сохраните форму. Зафиксируйте три импульса сканера.',speed:.24,width:.24,centers:[.38,.7,.52]},
  {name:'На орбите',verb:'Поймать сигнал',hint:'Поймайте три сигнала спутника в отмеченной зоне.',speed:.3,width:.22,centers:[.65,.3,.55]},
  {name:'Резонанс атома',verb:'Синхронизировать',hint:'Согласуйте три энергетических контура реактора.',speed:.34,width:.2,centers:[.3,.65,.45]},
  {name:'Пробуждение',verb:'Подать импульс',hint:'Подайте три точных импульса роботу-смотрителю.',speed:.38,width:.2,centers:[.72,.35,.6]}
];

// All clocks are simulation time: hidden tabs, dialogs and XR focus loss pause play.
export class ResonanceGame{
  constructor(){this.reset();}
  reset(){this.phase='idle';this.index=0;this.locks=[0,0,0,0];this.attempts=0;this.score=0;this.time=0;this.clock=0;this.cooldown=0;this.finale=0;this.feedback='';this.assist=false;this.paused=false;this.revision=0;}
  get active(){return this.phase!=='idle';}
  get charged(){return this.locks.filter(n=>n===3).length;}
  get target(){return STATIONS[this.index].centers[Math.min(2,this.locks[this.index])];}
  get position(){return this.assist?this.target:(Math.sin(this.clock*Math.PI*2)+1)/2;}
  get inZone(){return Math.abs(this.position-this.target)<=STATIONS[this.index].width/2;}
  start(index=0,assist=false){this.reset();this.phase='playing';this.index=Number.isInteger(index)&&index>=0&&index<4?index:0;this.assist=assist;this.feedback=assist?'Спокойный режим: три нажатия активируют станцию.':'Нажмите, когда указатель войдёт в светлую зону.';this.revision++;}
  stop(){this.phase='idle';this.revision++;}
  select(index){if(!this.active||!Number.isInteger(index)||index<0||index>3)return;this.index=index;this.clock=0;this.cooldown=0;this.feedback=this.phase==='complete'?'Атлас запущен. Павильон снова полон энергии.':this.phase==='ready'?'Все четыре станции готовы. Запустите Атлас.':this.locks[index]===3?'Станция активирована. Выберите следующую.':this.assist?'Спокойный режим: три нажатия активируют станцию.':'Поймайте импульс в светлой зоне.';this.revision++;}
  next(){return this.locks.findIndex(n=>n<3);}
  toggleAssist(){this.assist=!this.assist;this.feedback=this.assist?'Спокойный режим: три нажатия активируют станцию.':'Точный режим: дождитесь светлой зоны.';this.revision++;}
  togglePause(){this.paused=!this.paused;this.revision++;}
  tick(dt){
    if(this.paused)return;
    dt=Math.max(0,Math.min(dt,.1));this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.phase==='playing'){this.time+=dt;this.clock+=dt*STATIONS[this.index].speed;}
    if(this.phase==='celebrating'){this.finale+=dt;if(this.finale>=14){this.phase='complete';this.feedback='Атлас запущен. Павильон снова полон энергии.';this.revision++;}}
  }
  strike(){
    if(this.paused||this.phase!=='playing'||this.locks[this.index]===3||this.cooldown>0)return null;
    this.cooldown=.35;this.attempts++;const hit=this.inZone;this.revision++;
    if(!hit){this.feedback='Чуть раньше или позже. Дождитесь светлой зоны.';return {type:'miss',index:this.index};}
    const precision=1-Math.abs(this.position-this.target)/(STATIONS[this.index].width/2);
    this.locks[this.index]++;this.score+=this.assist?60:100+Math.round(50*precision);
    const charged=this.locks[this.index]===3;
    this.feedback=charged?'Станция активирована. Энергия направлена в ядро.':'Точно! Импульс '+this.locks[this.index]+' из 3 принят.';
    if(this.charged===4){this.phase='ready';this.feedback='Все четыре станции готовы. Запустите Атлас.';}
    return {type:charged?'charged':'hit',index:this.index};
  }
  launch(){if(this.phase!=='ready')return false;this.phase='celebrating';this.finale=0;this.feedback='АТЛАС ПРОБУЖДАЕТСЯ';this.revision++;return true;}
  view(){return {phase:this.phase,index:this.index,locks:[...this.locks],charged:this.charged,score:this.score,attempts:this.attempts,time:this.time,position:this.position,target:this.target,width:STATIONS[this.index].width,inZone:this.inZone,assist:this.assist,paused:this.paused,feedback:this.feedback,station:STATIONS[this.index],cooldown:this.cooldown,revision:this.revision};}
}

// Shared action labels keep the desktop and headset interfaces consistent.
export function gameAction(view){
  if(view.paused)return {action:'pause',label:'Продолжить →'};
  if(view.phase==='ready')return {action:'launch',label:'Запустить Атлас →'};
  if(view.phase==='celebrating')return {action:'wait',label:'Ядро пробуждается…',disabled:true};
  if(view.phase==='complete')return {action:'restart',label:'Пройти ещё раз ↻'};
  if(view.locks[view.index]===3)return {action:'next',label:'Следующая станция →'};
  return {action:'strike',label:view.station.verb,disabled:view.cooldown>0};
}
