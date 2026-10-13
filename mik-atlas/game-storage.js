// Small, renderer-independent save format. Only local game data, no identity.
export const SAVE_KEY='mik-atlas:resonance:v1';
export const emptyPlayer=()=>({version:1,briefingSeen:false,checkpoint:null,best:{precise:0,assisted:0}});
export function localGameStorage(host){try{return host.localStorage;}catch{return null;}}
export function validateCheckpoint(value){
  if(!value||!Array.isArray(value.locks)||value.locks.length!==4||!value.locks.every(n=>Number.isInteger(n)&&n>=0&&n<=3))return null;
  const hits=value.locks.reduce((a,b)=>a+b,0);
  if(!Number.isInteger(value.index)||value.index<0||value.index>3||!Number.isInteger(value.score)||value.score<hits*60||value.score>hits*150)return null;
  if(!Number.isInteger(value.attempts)||value.attempts<hits||value.attempts>1e6||typeof value.assist!=='boolean'||typeof value.assistUsed!=='boolean'||value.assist&&!value.assistUsed)return null;
  if(!Number.isFinite(value.time)||value.time<0||value.time>86400||!Number.isFinite(value.clock)||value.clock<0||value.clock>=1||!Number.isFinite(value.cooldown)||value.cooldown<0||value.cooldown>.35)return null;
  if(hits===12?!['ready','celebrating'].includes(value.phase):value.phase!=='playing')return null;
  return {phase:hits===12?'ready':'playing',index:value.index,locks:[...value.locks],score:value.score,attempts:value.attempts,assist:value.assist,assistUsed:value.assistUsed,time:value.time,clock:value.clock,cooldown:value.cooldown};
}
export function readPlayer(storage){
  const result=emptyPlayer();
  try{
    const raw=storage?.getItem(SAVE_KEY);if(!raw||raw.length>4096)return result;
    const data=JSON.parse(raw);if(data?.version!==1)return result;
    result.checkpoint=validateCheckpoint(data.checkpoint);result.briefingSeen=data.briefingSeen===true||!!result.checkpoint;
    for(const mode of ['precise','assisted']){const score=data.best?.[mode];if(Number.isInteger(score)&&score>=720&&score<=1800)result.best[mode]=score;}
  }catch{}
  return result;
}
export function writePlayer(storage,player){try{if(!storage)return false;storage.setItem(SAVE_KEY,JSON.stringify(player));return true;}catch{return false;}}
export function renderSavedGame(doc,player){
  const checkpoint=player.checkpoint;
  doc.querySelectorAll('[data-game-label]').forEach(el=>{el.textContent=checkpoint?'Продолжить игру':'Начать игру';});
  const note=doc.getElementById('game-resume-note');if(!note)return;
  note.hidden=!checkpoint;
  if(checkpoint)note.textContent='Можно продолжить · '+checkpoint.locks.filter(n=>n===3).length+' из 4 станций · '+checkpoint.score+' очков';
}
