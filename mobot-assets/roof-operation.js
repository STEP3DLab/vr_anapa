// Exhibit coordinates and rates. Positions are relative to the model, not survey data.
export const route = Object.freeze({start:2.7, pickup:1.22, unload:-1.91, ground:-4, carry:18, dump:53});
export const steps = [
  {axis:'lift', action:'lower', name:'Опустить раму', hint:'Опустите ковш к поверхности кровли.'},
  {axis:'drive', action:'forward', name:'Подобрать обломки', hint:'Подайте робота вперёд, пока обломки не окажутся в ковше.'},
  {axis:'lift', action:'raise', name:'Поднять груз', hint:'Поднимите раму с обломками для перевозки.'},
  {axis:'drive', action:'forward', name:'Довезти до площадки', hint:'Двигайтесь вперёд до площадки с оранжевой разметкой.'},
  {axis:'tip', action:'dump', name:'Разгрузить ковш', hint:'Наклоните ковш вперёд, чтобы выгрузить обломки.'}
];
export const commands = {
  forward:{axis:'drive',delta:-1}, back:{axis:'drive',delta:1},
  lower:{axis:'lift',delta:-1}, raise:{axis:'lift',delta:1},
  curl:{axis:'tip',delta:-1}, dump:{axis:'tip',delta:1}
};
export function initialState(){
  return {x:route.start, lift:route.carry, tip:0, step:0, loaded:false, drop:0, dropping:false};
}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function progress(s){
  const ratios=[(route.carry-s.lift)/(route.carry-route.ground),
    (route.start-s.x)/(route.start-route.pickup),(s.lift-route.ground)/(route.carry-route.ground),
    (route.pickup-s.x)/(route.pickup-route.unload),s.tip/route.dump];
  return s.step>=steps.length?1:clamp(ratios[s.step],0,1);
}
export function canOperate(s,id){
  return !s.dropping && !!commands[id] && steps[s.step]?.axis===commands[id].axis;
}
export function advance(s,id,dt){
  if(!Number.isFinite(dt)||dt<=0)return false;
  dt=Math.min(dt,.25);
  if(s.dropping){
    s.drop=Math.min(1,s.drop+dt*1.6);
    if(s.drop>=1){s.dropping=false;s.loaded=false;s.step=5;}
    return true;
  }
  if(!canOperate(s,id))return false;
  const {axis,delta}=commands[id], amount=dt*delta;
  if(axis==='drive'){
    s.x=clamp(s.x+amount*1.12,s.step===1?route.pickup:route.unload,route.start);
  }else if(axis==='lift'){
    s.lift=clamp(s.lift+amount*17,route.ground,route.carry);
  }else{
    s.tip=clamp(s.tip+amount*34,0,route.dump);
  }
  if(progress(s)>=1){
    if(s.step===1)s.loaded=true;
    if(s.step===4)s.dropping=true;
    else s.step++;
  }
  return true;
}
