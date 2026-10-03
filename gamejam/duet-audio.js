import {PulseAudio} from './pulse-audio.js';
export class DuetAudio extends PulseAudio{
  event(e,g){
    if(e.type==='miss'){
      const now=this.ctx.currentTime;if(now-(this.lastMistake??-1)>.16){this.sample('ice',{volume:.12,duration:.16});this.lastMistake=now;}return;
    }
    super.event(e,g);
  }
}
