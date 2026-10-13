import assert from 'node:assert/strict';
import {ResonanceGame,gameAction} from '../game.js';
import {SAVE_KEY,emptyPlayer,localGameStorage,readPlayer,writePlayer,validateCheckpoint,renderSavedGame} from '../game-storage.js';

const game=new ResonanceGame();game.start(2,false,{briefing:true});
assert.equal(gameAction(game.view()).action,'begin');game.tick(.1);assert.equal(game.time,0);assert.equal(game.strike(),null);assert.equal(game.checkpoint(),null);
game.togglePause();assert(!game.paused);assert(game.begin());assert(!game.begin());game.toggleAssist();game.strike();
const snapshot=game.checkpoint();assert.equal(snapshot.locks[2],1);assert.equal(snapshot.score,60);
snapshot.locks[2]=2;assert.equal(game.locks[2],1,'save must not alias live state');
const saved=game.checkpoint(),restored=new ResonanceGame();assert(restored.restore(saved));assert(restored.paused);assert.equal(restored.index,2);
restored.tick(.1);assert.equal(restored.time,saved.time);assert.equal(restored.strike(),null);restored.togglePause();assert.equal(restored.strike(),null,'restore must keep cooldown');
restored.tick(.1);restored.tick(.1);restored.tick(.1);restored.tick(.1);assert(restored.strike());
for(const invalid of [null,{}, {...saved,locks:[0,0,4,0]}, {...saved,locks:[0,0,1]}, {...saved,score:99999}, {...saved,index:-1}, {...saved,index:1.2}, {...saved,attempts:0}, {...saved,clock:NaN}, {...saved,clock:1}, {...saved,cooldown:.5}, {...saved,time:Infinity}, {...saved,phase:'complete'}, {...saved,assist:'true'}, {...saved,assistUsed:false}])assert.equal(validateCheckpoint(invalid),null);
for(let i=0;i<4;i++){restored.select(i);while(restored.locks[i]<3){for(let k=0;k<4;k++)restored.tick(.1);restored.strike();}}
assert.equal(restored.phase,'ready');restored.togglePause();assert(!restored.launch());restored.togglePause();assert(restored.launch());
const finale=restored.checkpoint();assert.equal(finale.phase,'ready');const resumedFinale=new ResonanceGame();assert(resumedFinale.restore(finale));assert(resumedFinale.paused);resumedFinale.togglePause();assert(resumedFinale.launch());
for(let k=0;k<150;k++)resumedFinale.tick(.1);assert.equal(resumedFinale.phase,'complete');assert.equal(resumedFinale.checkpoint(),null);assert.equal(resumedFinale.view().accuracy,100);

const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)},player=emptyPlayer();player.checkpoint=saved;player.best.assisted=720;
assert(writePlayer(storage,player));assert.deepEqual(readPlayer(storage).checkpoint,saved);assert(readPlayer(storage).briefingSeen);assert.equal(readPlayer(storage).best.assisted,720);
assert.deepEqual(readPlayer(null),emptyPlayer());assert(!writePlayer(null,player));assert(!writePlayer({setItem(){throw Error('quota');}},player));
assert.equal(localGameStorage({get localStorage(){throw Error('denied');}}),null);
for(const raw of ['{','null','x'.repeat(4097),JSON.stringify({version:99,checkpoint:saved})]){memory.set(SAVE_KEY,raw);assert.deepEqual(readPlayer(storage),emptyPlayer());}
memory.set(SAVE_KEY,JSON.stringify({version:1,checkpoint:{...saved,score:-1},best:{precise:999999,assisted:-1}}));assert.deepEqual(readPlayer(storage),emptyPlayer());
const label={},note={},doc={querySelectorAll:()=>[label],getElementById:()=>note};renderSavedGame(doc,player);assert.equal(label.textContent,'Продолжить игру');assert(!note.hidden);assert(note.textContent.includes('60 очков'));renderSavedGame(doc,emptyPlayer());assert.equal(label.textContent,'Начать игру');assert(note.hidden);
console.log('PASS: briefing, validated checkpoints, paused resume, retained cooldown, interrupted finale, completion, corruption/oversize/version/quota/access handling, landing resume label. Pure state tests; no browser or headset.');

const precise=new ResonanceGame();precise.start(0,true,{briefing:true});precise.toggleAssist();precise.begin();assert(!precise.assistUsed,'briefing choice must allow a fully precise game');
for(let i=0;i<4;i++){precise.select(i);while(precise.locks[i]<3){precise.cooldown=0;precise.clock=(Math.asin(2*precise.target-1)/(2*Math.PI)+1)%1;assert(precise.strike());}}
assert.equal(precise.score,1800);assert(!precise.view().assistUsed);assert(precise.checkpoint());
