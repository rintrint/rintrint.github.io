(function(root){
  const {JourneyRun}=root.BreathJourney||require('./tide-core.js');
  const PROFILES={beginner:{label:'新手',window:.17,perfect:.065,approach:1.8,stride:4},intermediate:{label:'中階',window:.125,perfect:.05,approach:1.25,stride:2},expert:{label:'高手',window:.085,perfect:.035,approach:.82,stride:1}};
  class PulseRun extends JourneyRun{
    constructor(track,level='expert',practice=false){super(track,level,practice);this.profile=PROFILES[level];this.window=this.profile.window;this.maxCombo=0;this.score=0;this.counts={perfect:0,good:0,miss:0};this.errors=[];}
    get accuracy(){const total=this.hits+this.misses;return total?Math.round((this.counts.perfect+this.counts.good*.5)/total*10000)/100:100;}
    judge(note,hit,error=0){
      if(note.result)return;super.judge(note,hit,error);const e=this.feedback;
      if(e.type==='hit'){e.result=Math.abs(error)<=this.profile.perfect?'perfect':'good';this.counts[e.result]++;this.errors.push(error*1000);this.score+=e.result==='perfect'?1000:500;this.maxCombo=Math.max(this.maxCombo,this.combo);}
      else this.counts.miss++;
      if(note.kind==='call'&&this.called&&this.leaped&&this.phase==='shore'){
        this.status='won';this.outcome=this.food>=360?'friends':'rest';this.events.push({type:'won',at:this.time});
      }
    }
    update(time){
      // Input timestamps are captured before dispatch. A short expiry grace prevents
      // a render frame from invalidating an already-on-time queued keyboard event.
      const window=this.window;this.window=window+.03;try{super.update(time);}finally{this.window=window;}
    }
    press(time){
      if(this.status!=='playing'||time-this.lastPress<.04)return;this.update(time);if(this.status!=='playing')return;this.lastPress=time;
      const notes=this.notes.slice(this.cursor).filter(n=>!n.result&&Math.abs(n.time-time)<=this.window).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time));
      if(notes[0])this.judge(notes[0],true,time-notes[0].time);
    }
  }
  const api={PulseRun,PROFILES};root.BreathPulse=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
