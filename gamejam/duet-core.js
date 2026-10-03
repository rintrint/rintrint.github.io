/* Edition ten: same acoustic timestamps, two lanes, explicit overpress penalties. */
(function(root){
  const {PulseRun}=root.BreathPulse||require('./pulse-core.js');
  const phrase=['lower','lower','upper','upper','upper','upper','lower','lower','lower','upper','upper','lower','upper','lower','lower','upper'];
  function laneFor(note){
    if(['surface','exit','call'].includes(note.kind))return 'upper';
    if(note.kind!=='fish')return 'lower';
    const lane=phrase[Math.floor(note.step/2)%16];
    return note.step%2?(lane==='upper'?'lower':'upper'):lane;
  }
  function speedValue(value){const n=Number(value);return Number.isFinite(n)?Math.max(.1,Math.min(2,Math.round(n*10)/10)):1;}
  class DuetRun extends PulseRun{
    constructor(track,level='expert',practice=false){
      super(track,level,practice);this.notes.forEach(n=>n.lane=laneFor(n));
      this.stability=100;this.overpresses=0;this.inputLane='lower';this.inputAt=-100;
    }
    drainStability(amount){
      this.stability=Math.max(0,this.stability-amount);
      if(this.stability===0&&this.status==='playing'&&!this.practice)this.lose('rhythm');
    }
    judge(note,hit,error=0){
      if(note.result)return;super.judge(note,hit,error);
      if(note.result==='hit')this.stability=Math.min(100,this.stability+(Math.abs(error)<=this.profile.perfect?1.5:.5));
      else this.drainStability(11);
    }
    stray(lane,time,reason){
      this.combo=0;this.misses++;this.counts.miss++;this.overpresses++;
      const event={type:'miss',result:'miss',note:{kind:'overpress',lane},lane,at:Math.max(this.time,time),error:0,reason};
      this.feedback=event;this.events.push(event);this.drainStability(9);
    }
    press(lane,time){
      if(this.status!=='playing'||!['upper','lower'].includes(lane))return;
      this.update(time);if(this.status!=='playing')return;
      this.inputLane=lane;this.inputAt=time;
      const pending=this.notes.slice(this.cursor).filter(n=>!n.result);
      // Find the nearest note on THIS lane. Wrong-lane input can never collect it.
      const exact=pending.filter(n=>n.lane===lane&&Math.abs(n.time-time)<=this.window).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
      if(exact){this.judge(exact,true,time-exact.time);return;}
      const next=pending.find(n=>n.lane===lane&&n.time>time);
      // The early window consumes the note once. Later mashing cannot rescue it.
      if(next&&next.time-time<=Math.max(.24,this.window+.1)){
        this.judge(next,false,time-next.time);this.feedback.reason='early';return;
      }
      const wrong=pending.some(n=>n.lane!==lane&&Math.abs(n.time-time)<=this.window);
      this.stray(lane,time,wrong?'lane':'empty');
    }
  }
  const api={DuetRun,laneFor,speedValue};root.BreathDuet=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
