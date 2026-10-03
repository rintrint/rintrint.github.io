import {DriftMotion} from './drift-media.js?v=11.2';

// Direction responds to input; a successful judgement only starts the bite.
export class FloeMotion extends DriftMotion{
  input(lane,time){
    if(!['upper','lower'].includes(lane))return;
    super.hit(lane,time,false);
  }
  hit(lane,time,fish){
    this.advance(time);
    if(fish){
      const start=Math.max(time,this.lastBiteEnd);
      this.bites.push({start,end:start+.19});
      this.lastBiteEnd=start+.19;
    }
  }
}
