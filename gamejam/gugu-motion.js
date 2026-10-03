// Lane selection is immediate. Animation never queues or gates player input.
export class GuguMotion{
  constructor(time=0){this.time=time;this.y=1;this.bites=[];this.inputAt=-Infinity;this.inputCount=0;}
  input(lane,time){
    if(!['upper','lower'].includes(lane))return;
    this.advance(time);this.y=lane==='upper'?0:1;
    this.inputAt=time;this.inputCount++;
  }
  hit(lane,time,fish){
    this.advance(time);
    // A fresh catch takes effect now, even during the preceding chew.
    if(fish)this.bites=[{start:time,end:time+.19}];
  }
  advance(time){
    this.time=Math.max(this.time,time);
    this.bites=this.bites.filter(b=>b.end>this.time);
  }
  get frame(){
    const bite=this.bites[0];
    if(!bite||this.time<bite.start)return 0;
    return Math.min(5,2+Math.floor((this.time-bite.start)/.19*4));
  }
  get impulse(){return Math.max(0,1-(this.time-this.inputAt)/.12);}
}
