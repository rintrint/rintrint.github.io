/* BufferSource and judging share AudioContext.currentTime; no accumulating frame clock. */
export class TrackAudio {
  constructor(){
    const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.75;this.master.connect(this.ctx.destination);
    this.music=this.ctx.createGain();this.music.gain.value=.86;this.music.connect(this.master);this.fx=this.ctx.createGain();this.fx.gain.value=.20;this.fx.connect(this.master);
    this.cache=new Map();this.source=null;this.pausedAt=-3;this.running=false;this.enabled=true;
  }
  async load(track){
    await this.ctx.resume();if(!this.cache.has(track.id)){
      const response=await fetch(track.src);if(!response.ok)throw new Error('音樂檔案載入失敗');
      const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.cache.set(track.id,buffer);
    }this.buffer=this.cache.get(track.id);
  }
  get time(){return this.running?Math.max(this.startPosition,this.ctx.currentTime-this.anchor):this.pausedAt;}
  play(from=-3){
    this.stopSource();this.ctx.resume();const now=this.ctx.currentTime;this.anchor=now+.06-from;this.startPosition=from;
    this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.music);
    this.source.start(from<0?now+.06-from:now+.06,Math.max(0,from));this.running=true;this.pausedAt=from;
  }
  stopSource(){if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}this.running=false;}
  pause(){this.pausedAt=this.time;this.stopSource();}
  resume(){this.play(this.pausedAt);}
  mute(value){this.enabled=!value;this.master.gain.setTargetAtTime(value?0:.75,this.ctx.currentTime,.05);}
  tone(freq,duration=.15,volume=.15){
    if(!this.enabled)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.fx);o.start(t);o.stop(t+duration);
  }
  pluck(from,to,duration,volume){
    if(!this.enabled)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.fx);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  event(event){
    if(event.type==='hit'){this.pluck(230,95,.09,.24);this.pluck(event.result==='perfect'?1174.66:880,660,.14,event.result==='perfect'?.15:.09);}
    if(event.type==='landing')this.pluck(140,70,.10,.10*event.strength);
    if(event.type==='gulp')this.pluck(440,740,.10,.09);
    if(event.type==='growth'){this.pluck(587,880,.32,.12);this.tone(1174,.35,.08);}
    if(event.type==='miss')this.tone(130.81,.17,.06);
    if(event.type==='won')this.tone(587.33,1.5,.25);
    if(event.type==='lost')this.tone(146.83,1.5,.18);
  }
}
