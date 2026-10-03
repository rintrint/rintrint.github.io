import {ScenesAudio} from './scenes-audio.js';
import {songTimeAt} from './pulse-clock.js';
export class PulseAudio extends ScenesAudio{
  constructor(track){super();this.track=track;this.music.gain.value=.93;}
  get time(){return this.timeAt(performance.now());}
  timeAt(eventTime){if(!this.running)return this.pausedAt;return songTimeAt(this.ctx,this.anchor,this.startPosition,eventTime,performance.now());}
  danger(amount,time){
    // Keep the percussion audible even when oxygen is low. The screen and a quiet
    // heartbeat carry the warning instead of muffling the timing reference.
    this.filter.frequency.setTargetAtTime(18000-amount*5000,this.ctx.currentTime,.2);
    if(amount>0&&time-this.lastHeart>1.1-amount*.6){this.lastHeart=time;this.pluck(78,45,.16,.035+amount*.05);}
  }
  async menu(){
    if(this.menuVoice||!this.enabled)return;const token=++this.menuToken;
    await this.load(this.track);await this.loadSamples();if(token!==this.menuToken||this.running||!this.enabled)return;
    this.samples.set('menu',this.buffer);this.menuVoice=this.sample('menu',{volume:.18,loop:true});
  }
  event(e,g){
    if(e.type==='hit'&&e.note.kind==='fish'){this.sample('eat',{volume:.105,duration:.14});return;}
    super.event(e,g);
  }
  // The intro count-in is aligned to the same output schedule as the song.
  play(from=0){super.play(from);this.music.gain.setValueAtTime(.93,this.ctx.currentTime);const source=this.source;source.onended=()=>{if(this.source===source){this.pausedAt=this.track.duration;this.stopSource();}};if(from===0){const beats=this.track.beats,step=beats[1]-beats[0];for(let i=4;i>0;i--)this.clickAt(beats[0]-step*i);}}
}
