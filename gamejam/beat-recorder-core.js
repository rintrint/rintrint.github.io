(function(root){
  class BeatRecording {
    constructor(duration,points=[]){this.duration=duration;this.points=[];for(const t of points)this.add(t);}
    add(time){
      if(!Number.isFinite(time)||time<0||time>=this.duration)return false;
      const value=Math.round(time*1000)/1000;
      if(this.points.length&&value<=this.points.at(-1))return false;
      this.points.push(value);return true;
    }
    undo(){return this.points.pop();}
    get text(){return this.points.length?this.points.map(t=>t.toFixed(3)).join('\n')+'\n':'';}
  }
  root.BreathRecorder={BeatRecording};if(typeof module!=='undefined')module.exports={BeatRecording};
})(globalThis);
