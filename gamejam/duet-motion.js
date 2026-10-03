export class DuetMotion{
  constructor(time=0){this.time=time;this.y=1;this.velocity=0;this.aim=1;this.bites=[];this.lastBiteEnd=-1;this.squash=0;this.squashVelocity=0;}
  hit(lane,time,fish){
    this.advance(time);this.aim=lane==='upper'?0:1;this.squashVelocity+=1.8;
    if(fish){const start=Math.max(time+.075,this.lastBiteEnd);this.bites.push({start,end:start+.19});this.lastBiteEnd=start+.19;}
  }
  advance(time){
    let left=Math.max(0,time-this.time);while(left>0){const dt=Math.min(left,1/120);this.velocity+=((this.aim-this.y)*784-this.velocity*48)*dt;this.y+=this.velocity*dt;this.squashVelocity+=(-this.squash*230-this.squashVelocity*22)*dt;this.squash+=this.squashVelocity*dt;left-=dt;}
    this.time=Math.max(this.time,time);this.bites=this.bites.filter(b=>b.end>time);
  }
  get frame(){const bite=this.bites.find(b=>b.start<=this.time&&b.end>this.time);if(!bite)return 0;const phase=(this.time-bite.start)/.19;return Math.min(5,1+Math.floor(phase*5));}
}
