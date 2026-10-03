/* Edition eleven: the audio clock never moves when calibration changes. */
(function(root){
  const {DuetRun,speedValue}=root.BreathDuet||require('./duet-core.js');
  const bounded=(v,lo,hi,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(lo,Math.min(hi,Math.round(n/5)*5)):fallback;};
  const delayValue=v=>bounded(v,-200,200,0);
  const windowValue=v=>bounded(v,40,200,85);
  const laneForKey=code=>['KeyD','KeyF','ArrowUp'].includes(code)?'upper':['KeyJ','KeyK','ArrowDown'].includes(code)?'lower':null;
  function breathState(time){
    const phase=((time%3.6)+3.6)%3.6,inhale=Math.min(1,phase/2.7);
    const release=Math.max(0,Math.min(1,(phase-3.05)/.55));
    const smooth=v=>v*v*(3-2*v),fill=inhale*(1-smooth(release));
    return {phase,fill,inhaling:phase<2.7,ready:fill>=.9,ringScale:1-.86*smooth(inhale),mist:Math.min(1,phase/.18)*(1-smooth(release)),expansion:smooth(fill)};
  }
  class DriftRun extends DuetRun{
    constructor(track,level='expert',practice=false,settings={}){
      super(track,level,practice);
      this.profile={...this.profile};
      this.setTiming(settings.delay??0,settings.window??this.window*1000);
    }
    setTiming(delay,window){
      this.delayMs=delayValue(delay);this.windowMs=windowValue(window);this.window=this.windowMs/1000;
      this.profile.perfect=Math.min(.065,this.window*.42);
    }
    noteTime(note){return note.time+this.delayMs/1000;}
    breathSize(time){return breathState(time).fill;}
    inhale(t){
      super.inhale(t);
      if(this.status==='playing'){
        this.phase='underwater';this.depth=18;
        this.events.push({type:'splash',at:0,automatic:true});
      }
    }
    consume(to){
      // The musical intro is preparation time, not six extra seconds of oxygen debt.
      if(this.time<(this.track.introEnd||0))this.time=Math.min(to,this.track.introEnd);
      super.consume(to);
    }
    update(time){
      if(this.status!=='playing'||time<this.time)return;
      while(this.cursor<this.notes.length&&this.noteTime(this.notes[this.cursor])+this.window+.03<time){
        const note=this.notes[this.cursor++];
        this.consume(Math.max(this.time,this.noteTime(note)+this.window+.03));
        if(this.status!=='playing')return;
        if(!note.result)this.judge(note,false);
        if(this.status!=='playing')return;
      }
      this.consume(time);
      if(this.status==='playing'&&time>=this.track.duration){
        if(this.leaped&&this.phase==='shore'&&this.called){this.status='won';this.outcome=this.food>=360?'friends':'rest';this.events.push({type:'won',at:time});}
        else this.lose('route');
      }
    }
    press(lane,time){
      if(this.status!=='playing'||!['upper','lower'].includes(lane))return;
      this.update(time);if(this.status!=='playing')return;
      this.inputLane=lane;this.inputAt=time;
      const pending=this.notes.slice(this.cursor).filter(n=>!n.result);
      const delta=n=>time-this.noteTime(n);
      const exact=pending.filter(n=>n.lane===lane&&Math.abs(delta(n))<=this.window+1e-8).sort((a,b)=>Math.abs(delta(a))-Math.abs(delta(b)))[0];
      if(exact){this.judge(exact,true,delta(exact));return;}
      const next=pending.find(n=>n.lane===lane&&delta(n)<0);
      if(next&&-delta(next)<=Math.max(.24,this.window+.1)){
        this.judge(next,false,delta(next));this.feedback.reason='early';return;
      }
      this.stray(lane,time,pending.some(n=>n.lane!==lane&&Math.abs(delta(n))<=this.window)?'lane':'empty');
    }
  }
  const api={DriftRun,speedValue,delayValue,windowValue,laneForKey,breathState};root.BreathDrift=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
