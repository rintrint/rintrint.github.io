import {DuetMotion} from './duet-motion.js';
export class DriftMotion extends DuetMotion{
  hit(lane,time,fish){
    super.hit(lane,time,false);
    if(fish){const start=Math.max(time,this.lastBiteEnd);this.bites.push({start,end:start+.19});this.lastBiteEnd=start+.19;}
  }
}
export function fishPosition(note,game,geometry){
  const time=typeof game.noteTime==='function'?game.noteTime(note):note.time;
  return {x:geometry.x+(time-game.time)*geometry.speed,y:geometry[note.lane]};
}
export function noteVisible(note,x,width){
  return note.result!=='hit'&&x>=-90&&x<=width+90;
}
export function swimPose(time,reduced=false){
  return reduced?{wave:0,roll:0,breath:1}:{wave:Math.sin(time*7.3)*.018,roll:Math.sin(time*3.65)*.013,breath:1+Math.sin(time*3.65)*.025};
}
// The flippers rest on a fixed baseline. Only the torso expands; face and tail stay intact.
export function breathColumn(x,expansion){
  const u=Math.max(0,Math.min(1,(x-.18)/.42));
  return 1+Math.sin(u*Math.PI)**2*.22*expansion;
}
