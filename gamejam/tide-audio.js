import {TrackAudio} from './rhythm-audio.js';
export class JourneyAudio extends TrackAudio {
  constructor(){super();this.music.disconnect();this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=18000;this.music.connect(this.filter);this.filter.connect(this.master);this.lastHeart=-100;}
  // Output device timestamp accounts for audio already queued by the browser.
  get time(){
    if(!this.running)return this.pausedAt;
    const stamp=this.ctx.getOutputTimestamp?.();
    const audible=stamp?.performanceTime>0?stamp.contextTime+Math.max(0,performance.now()-stamp.performanceTime)/1000:this.ctx.currentTime-(this.ctx.outputLatency||0)-(this.ctx.baseLatency||0);
    return Math.max(this.startPosition,Math.min(this.ctx.currentTime,audible)-this.anchor);
  }
  breath(big=false){
    if(!this.enabled)return;
    const c=this.ctx,t=c.currentTime,d=big?1.7:.6,b=c.createBuffer(1,c.sampleRate*d,c.sampleRate),a=b.getChannelData(0);
    let smooth=0;for(let i=0;i<a.length;i++){smooth=.8*smooth+.2*(Math.random()*2-1);a[i]=smooth;}
    const src=c.createBufferSource(),f=c.createBiquadFilter(),gain=c.createGain();src.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(350,t);f.frequency.exponentialRampToValueAtTime(big?1700:1000,t+d*.8);f.Q.value=.7;
    gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(big?.85:.3,t+d*.65);gain.gain.exponentialRampToValueAtTime(.001,t+d);src.connect(f);f.connect(gain);gain.connect(this.master);src.start();src.onended=()=>{src.disconnect();f.disconnect();gain.disconnect();};
  }
  danger(amount,time){this.filter.frequency.setTargetAtTime(18000-amount*16300,this.ctx.currentTime,.2);if(amount>0&&time-this.lastHeart>1.1-amount*.6){this.lastHeart=time;this.pluck(78,45,.18,.12+amount*.2);}}
  event(e){
    if(e.type==='breath'||e.type==='bigBreath'){this.breath(e.big||e.type==='bigBreath');return;}
    if(e.type==='splash'){this.breath(false);this.pluck(180,60,.2,.18);return;}
    if(e.type==='call'){this.pluck(480,850,.35,.3);this.pluck(620,400,.5,.2);return;}
    super.event(e);
  }
  stopSource(){super.stopSource();for(const o of this.clickNodes||[]){try{o.stop();}catch{}}this.clickNodes=[];}
  clickAt(songTime){const t=this.anchor+songTime;if(t<this.ctx.currentTime)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.value=1500;g.gain.setValueAtTime(.1,t);g.gain.exponentialRampToValueAtTime(.0001,t+.035);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.04);(this.clickNodes??=[]).push(o);o.onended=()=>{o.disconnect();g.disconnect();this.clickNodes=this.clickNodes.filter(n=>n!==o);};}
}
