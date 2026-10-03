/* An original, scheduled 72-BPM score. Every visual breath uses this same clock. */
export class JourneyAudio {
  constructor(){
    const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=.7;this.master.connect(c.destination);
    this.music=c.createGain();this.music.gain.value=.66;
    this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=7500;
    this.music.connect(this.filter);this.filter.connect(this.master);
    this.delay=c.createDelay(2);this.delay.delayTime.value=.41667;this.echo=c.createGain();this.echo.gain.value=.19;
    this.delay.connect(this.echo);this.echo.connect(this.delay);this.echo.connect(this.filter);
    this.nodes=new Set();this.enabled=true;this.running=false;this.nextStep=0;
    this.noise=c.createBuffer(1,c.sampleRate*5,c.sampleRate);let brown=0;const data=this.noise.getChannelData(0);
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.024;data[i]=brown*5;}
    this.wind=c.createBufferSource();this.wind.buffer=this.noise;this.wind.loop=true;
    this.windFilter=c.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=520;
    this.windGain=c.createGain();this.windGain.gain.value=.06;
    this.wind.connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);this.wind.start();
    this.breathGain=c.createGain();this.breathGain.gain.value=0;this.breathGain.connect(this.master);
    this.breathSource=c.createBufferSource();this.breathSource.buffer=this.noise;this.breathSource.loop=true;
    this.breathFilter=c.createBiquadFilter();this.breathFilter.type='bandpass';this.breathFilter.frequency.value=950;this.breathFilter.Q.value=.7;
    this.breathSource.connect(this.breathFilter);this.breathFilter.connect(this.breathGain);this.breathSource.start();
  }
  start(time=0){this.ctx.resume();this.anchor=this.ctx.currentTime-time;this.nextStep=Math.ceil(time/(60/72/2));this.nextHeart=0;this.running=true;this.setEnabled(this.enabled);}
  pause(){this.running=false;for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();this.breath(false);this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.08);}
  setEnabled(v){this.enabled=v;this.master.gain.setTargetAtTime(v&&this.running?.68:0,this.ctx.currentTime,.12);}
  note(freq,at,duration,volume=.08,type='sine',echo=true,direct=false){
    const c=this.ctx;if(at<c.currentTime-.1)return;at=Math.max(c.currentTime,at);
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=freq;
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.018);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g);g.connect(direct?this.master:this.music);if(echo)g.connect(this.delay);o.start(at);o.stop(at+duration+.04);this.nodes.add(o);o.onended=()=>this.nodes.delete(o);
  }
  update(game){
    if(!this.running||game.status!=='playing')return;
    const now=this.ctx.currentTime,step=60/72/2;
    if(game.stage==='dying')return;
    // Re-anchor after slow frames so visual timing never drifts away from the music.
    if(Math.abs((now-this.anchor)-game.time)>.10){this.anchor=now-game.time;this.nextStep=Math.ceil(game.time/step);}
    const danger=game.danger;
    this.filter.frequency.setTargetAtTime((game.underwater?2200+Math.max(0,4500-game.depth*65):7800)*(1-danger*.88),now,.3);
    this.music.gain.setTargetAtTime(.66-danger*.32,now,.3);
    if(danger>0&&now>=(this.nextHeart||0)){
      this.nextHeart=now+1.05-danger*.58;
      this.note(68,now,.16,.05+danger*.16,'sine',false,true);
      this.note(53,now+.17,.19,.035+danger*.09,'sine',false,true);
    }
    // Dmaj9 — Bm7 — Gmaj9 — A6. Harp figures and a slow eight-bar melody.
    const chords=[[146.83,220,293.66,369.99,440],[123.47,185,246.94,293.66,369.99],[98,146.83,196,246.94,293.66],[110,164.81,220,293.66,369.99]];
    const melody=[587.33,0,659.25,0,739.99,659.25,587.33,0,493.88,0,587.33,0,739.99,0,659.25,0,587.33,0,493.88,440,493.88,0,587.33,0,659.25,0,587.33,493.88,440,0,0,0];
    while(this.anchor+this.nextStep*step<now+.12){
      const n=this.nextStep++,at=this.anchor+n*step,bar=Math.floor(n/8),slot=n%8,chord=chords[bar%4];
      if(slot===0){for(let i=0;i<4;i++)this.note(chord[i],at,3.15,.033,'sine');this.note(chord[0]/2,at,1.4,.09,'sine',false);this.note(1174.66,at,.65,.038,'sine',false,true);}
      const order=[1,3,2,4,1,3,4,2];this.note(chord[order[slot]]*2,at,1.1,slot%2?.024:.042,'triangle');
      if(n%2===0){const m=melody[Math.floor(n/2)%melody.length];if(m)this.note(m,at+.015,1.65,.056,'sine');}
      if(slot===4)this.note(chord[0],at,.8,.025,'sine',false);
    }
  }
  breath(on,big=false){const c=this.ctx,t=c.currentTime;this.breathGain.gain.cancelScheduledValues(t);this.breathGain.gain.setTargetAtTime(on?(big?.5:.16):0,t,on?.8:.16);this.breathFilter.frequency.setTargetAtTime(big?1500:900,t,1);}
  noiseBurst(duration,volume,from,to){const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(to,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+duration);this.nodes.add(s);s.onended=()=>this.nodes.delete(s);}
  event(e){const t=this.ctx.currentTime;
    if(e.type==='inhale')this.breath(true);
    if(e.type==='greatInhale')this.breath(true,true);
    if(e.type==='exhale')this.breath(false);
    if(e.type==='perfect'){this.note(880,t,.8,.038);this.note(1174.66,t+.06,.9,.025);}
    if(e.type==='fish'){this.note([739.99,880,1174.66][(e.value||1)-1],t,.55,.055);}
    if(e.type==='evolve'){[587.33,739.99,880,1174.66].forEach((f,i)=>this.note(f,t+i*.1,1.3,.08));}
    if(e.type==='splash'||e.type==='breach')this.noiseBurst(1.1,.45,2400,180);
    if(e.type==='leap'){this.noiseBurst(2,.6,1900,170);[293.66,440,587.33,880].forEach((f,i)=>this.note(f,t+i*.12,2,.09));}
    if(e.type==='call'){[440,587.33,440,739.99].forEach((f,i)=>this.note(f,t+i*.27,1.1,.1));}
    if(e.type==='won'){[293.66,369.99,440,587.33,739.99].forEach((f,i)=>this.note(f,t+i*.22,3,.08));}
    if(e.type==='warning')this.note(220,t,1.1,.07);
    if(e.type==='dying'){
      for(const n of this.nodes){try{n.stop();}catch{}}this.nodes.clear();this.breath(false);
      this.filter.frequency.setTargetAtTime(700,t,.25);
      const notes=e.outcome==='angel'?[587.33,739.99,880]:[293.66,220,146.83];
      notes.forEach((f,i)=>this.note(f,t+i*.35,2.8,.075,'sine',false,true));
    }
  }
}
