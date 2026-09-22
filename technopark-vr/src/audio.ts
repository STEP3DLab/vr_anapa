/** Synthesized soundscape; no downloads, microphones or autoplay. */
export function createAudio(){
 let context:AudioContext|undefined,master:GainNode|undefined,engine:OscillatorNode|undefined,motor:GainNode|undefined,ambient:OscillatorNode|undefined,ambientGain:GainNode|undefined;
 let shotNoise:AudioBuffer|undefined;
 let muted=false,suspended=false,disposed=false,desiredScene='hub',lastMotor=-1;
 const ambience={hub:[52,.006],robot:[68,.0055],drones:[92,.0045],cargo:[58,.005]} as Record<string,[number,number]>;
 function applyScene(){
  if(!context||!ambient||!ambientGain)return;
  const [frequency,gain]=ambience[desiredScene]??ambience.hub;
  ambient.frequency.setTargetAtTime(frequency,context.currentTime,.7);
  ambientGain.gain.setTargetAtTime(gain,context.currentTime,.8);
 }
 function init(){
  if(disposed)return;
  if(!context&&!navigator.userActivation?.isActive)return;
  try{
   if(!context){
    context=new AudioContext();
    master=context.createGain();master.gain.value=muted||suspended?0:.35;master.connect(context.destination);
    engine=context.createOscillator();motor=context.createGain();engine.type='sawtooth';engine.frequency.value=65;motor.gain.value=0;engine.connect(motor);motor.connect(master);engine.start();
    ambient=context.createOscillator();ambientGain=context.createGain();ambient.type='sine';ambientGain.gain.value=0;ambient.connect(ambientGain);ambientGain.connect(master);ambient.start();applyScene();
   }
   void context.resume().catch(()=>{});return context;
  }catch{return undefined;}
 }
 function tone(f:number,d=.12,type:OscillatorType='sine',volume=.15,delay=0){
  // Only unlock() may create/resume audio, from an explicit visitor gesture.
  const c=context;if(!c||!master||disposed||suspended||muted||c.state!=='running')return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;
  o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.6),t+d);
  g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.02);o.onended=()=>{o.disconnect();g.disconnect();};
 }
 function shot(){
  const c=context;if(!c||!master||disposed||suspended||muted||c.state!=='running')return;
  if(!shotNoise){shotNoise=c.createBuffer(1,Math.ceil(c.sampleRate*.18),c.sampleRate);const data=shotNoise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain(),t=c.currentTime;
  source.buffer=shotNoise;filter.type='lowpass';filter.frequency.setValueAtTime(5200,t);filter.frequency.exponentialRampToValueAtTime(380,t+.16);
  gain.gain.setValueAtTime(.3,t);gain.gain.exponentialRampToValueAtTime(.001,t+.18);
  source.connect(filter);filter.connect(gain);gain.connect(master);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  tone(90,.16,'triangle',.25);tone(900,.025,'square',.035);
 }
 return {
  unlock(){const c=init();applyScene();return c;},
  ready(){return !!context;},
  scene(name:string){desiredScene=name;applyScene();},
  tone,
  event(name:string){
   if(name==='portal'){[220,330,440,660].forEach((f,i)=>tone(f,.5,'sine',.13,i*.065));}
   else if(name==='win'){[392,494,587,784].forEach((f,i)=>tone(f,.6,'sine',.16,i*.12));}
   else if(name==='shot')shot();
   else if(name==='hit'){tone(880,.1,'square',.07);tone(110,.16,'triangle',.2);}
   else if(name==='reload'){tone(180,.09,'square',.05);tone(320,.08,'square',.05,.35);}
   else tone(540,.09);
  },
  motor(speed:number){const value=Math.round(Math.abs(speed)*20)/20;if(!context||!motor||!engine||value===lastMotor)return;lastMotor=value;motor.gain.setTargetAtTime(Math.min(.045,value*.02),context.currentTime,.12);engine.frequency.setTargetAtTime(65+value*65,context.currentTime,.1);},
  pause(value:boolean){suspended=value;if(master&&context)master.gain.setTargetAtTime(muted||suspended?0:.35,context.currentTime,.04);},
  toggle(){muted=!muted;if(!muted)init();if(master&&context)master.gain.setTargetAtTime(muted||suspended?0:.35,context.currentTime,.05);return muted;},
  dispose(){disposed=true;engine?.stop();ambient?.stop();void context?.close().catch(()=>{});}
 };
}
