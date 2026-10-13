// Frame-cadence feedback for ordinary 3D only. These are budgets, not FPS promises.
export const QUALITY_PROFILES=Object.freeze([
  Object.freeze({quality:'detail',label:'Детально',budget:2_400_000,cap:1.5}),
  Object.freeze({quality:'detail',label:'Баланс',budget:1_600_000,cap:1.25}),
  Object.freeze({quality:'smooth',label:'Плавно',budget:1_000_000,cap:1}),
  Object.freeze({quality:'smooth',label:'Экономно',budget:650_000,cap:.85})
]);
export class AdaptiveQuality{
  constructor({coarse=false}={}){this.minimum=coarse?1:0;this.level=coarse?2:0;this.reset();}
  get profile(){return QUALITY_PROFILES[this.level];}
  reset(warmup=3){this.warmup=warmup;this.elapsed=0;this.frames=0;this.slow=0;this.fast=0;}
  sample(milliseconds,eligible=true){
    if(!eligible||!Number.isFinite(milliseconds)||milliseconds<=0||milliseconds>1000){this.reset();return false;}
    milliseconds=Math.min(milliseconds,250);
    if(this.warmup>0){this.warmup-=milliseconds/1000;return false;}
    this.elapsed+=milliseconds;this.frames++;
    if(this.elapsed<1000)return false;
    const average=this.elapsed/this.frames;this.elapsed=0;this.frames=0;
    this.slow=average>28?this.slow+1:0;this.fast=average<19?this.fast+1:0;
    // Three slow seconds to step down; sixteen fast seconds to step back up.
    // Warm-up after every switch prevents responding to shader/allocation stalls.
    if(this.slow>=3&&this.level<QUALITY_PROFILES.length-1){this.level++;this.reset();return true;}
    if(this.fast>=16&&this.level>this.minimum){this.level--;this.reset(4);return true;}
    return false;
  }
}
const key='mik-atlas:graphics:v1',modes=new Set(['auto','detail','smooth']);
export function readQuality(storage){
  try{const value=JSON.parse(storage?.getItem(key)||'null');if(value?.version===1&&modes.has(value.quality))return value.quality;}catch{}
  return 'auto';
}
export function writeQuality(storage,quality){
  if(!modes.has(quality))return false;
  try{if(!storage)return false;storage.setItem(key,JSON.stringify({version:1,quality}));return true;}catch{return false;}
}
