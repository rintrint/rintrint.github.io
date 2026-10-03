/* Edition twelve: free movement between notes, one judgement per nearby note. */
(function(root){
  const {DriftRun}=root.BreathDrift||require('./drift-core.js');
  const DEFAULT_WINDOW=125,OPENING_BREATH_SECONDS=4,AIR_PER_TAP=5;
  class FloeRun extends DriftRun{
    constructor(track,level='expert',practice=false,settings={}){
      super(track,level,practice,{...settings,window:settings.window??DEFAULT_WINDOW});
      // Keep the original song times for automatic departures, outside the score.
      this.departures=this.notes.filter(n=>['dive','leap'].includes(n.kind));
      this.notes=this.notes.filter(n=>!['dive','leap'].includes(n.kind));
      this.departureCursor=0;this.breathElapsed=0;this.breathTaps=0;this.lastBreathTap=-100;
    }
    get breathingActive(){const status=this.status==='paused'?this.beforePause:this.status;return status==='breathing'||status==='playing'&&this.phase==='surface';}
    get breathRemaining(){const departure=this.departures[this.departureCursor];return this.status==='breathing'||this.status==='paused'&&this.beforePause==='breathing'?Math.max(0,OPENING_BREATH_SECONDS-this.breathElapsed):this.phase==='surface'&&departure?Math.max(0,this.noteTime(departure)-this.time):0;}
    breathSize(){return this.air/100;}
    startBreath(){super.startBreath();this.air=0;this.breathElapsed=0;this.breathTaps=0;this.lastBreathTap=-100;}
    tapBreath(){
      if(!this.breathingActive||this.status==='paused'||this.breathRemaining<=0)return;
      this.air=Math.min(100,this.air+AIR_PER_TAP);this.breathTaps++;
      this.lastBreathTap=this.status==='breathing'?this.breathElapsed:this.time;
      this.events.push({type:'breathTap',at:this.time,air:this.air,taps:this.breathTaps});
    }
    inhale(){this.tapBreath();}
    advanceBreath(dt){
      if(this.status!=='breathing')return;
      this.breathElapsed=Math.min(OPENING_BREATH_SECONDS,this.breathElapsed+Math.max(0,dt));
      if(this.breathElapsed>=OPENING_BREATH_SECONDS)super.inhale(this.breathElapsed);
    }
    breathVisual(){
      const fill=this.air/100,smooth=fill*fill*(3-2*fill),time=this.status==='breathing'||this.status==='paused'&&this.beforePause==='breathing'?this.breathElapsed:this.time;
      const pulse=Math.max(0,1-(time-this.lastBreathTap)/.18);
      return {fill,expansion:Math.min(1,smooth+pulse*.06),ringScale:1-.86*smooth,mist:.2+pulse*.8,inhaling:true,ready:fill>=.9,pulse};
    }
    judge(note,hit,error=0){
      if(note.result)return;const air=this.air;
      super.judge(note,hit,error);
      if(note.kind==='surface'&&this.phase==='surface'){
        if(note.result==='miss')this.air=air;
        this.breathTaps=0;this.lastBreathTap=-100;
      }
    }
    consumeSegment(to){
      // Surface air comes from taps only. Waiting must not refill the lungs.
      if(this.phase==='surface')this.time=Math.max(this.time,to);else super.consume(to);
    }
    consume(to){
      while(this.departureCursor<this.departures.length&&this.noteTime(this.departures[this.departureCursor])<=to){
        const departure=this.departures[this.departureCursor++],at=Math.max(this.time,this.noteTime(departure));
        this.consumeSegment(at);if(this.status!=='playing')return;
        if(departure.kind==='leap'&&this.phase!=='surface'&&!this.practice){this.lose('leap');return;}
        if(this.phase==='surface'||this.practice){
          this.phase='underwater';this.depth=12;
          if(departure.kind==='leap')this.leaped=true;
          this.events.push({type:departure.kind==='leap'?'bigBreath':'splash',at,automatic:true});
        }
      }
      this.consumeSegment(to);
    }
    get approachWindow(){return Math.max(.24,this.window+.1);}
    press(lane,time){
      if(this.status!=='playing'||!['upper','lower'].includes(lane))return;
      this.update(time);if(this.status!=='playing')return;
      if(this.phase==='surface'){this.tapBreath();return;}
      this.inputLane=lane;this.inputAt=time;
      const pending=this.notes.slice(this.cursor).filter(n=>!n.result);
      const delta=n=>time-this.noteTime(n);
      const same=pending.filter(n=>n.lane===lane).sort((a,b)=>Math.abs(delta(a))-Math.abs(delta(b)));
      const exact=same.find(n=>Math.abs(delta(n))<=this.window+1e-8);
      if(exact){this.judge(exact,true,delta(exact));return;}
      // An early/late press consumes this note once, so repeated presses cannot
      // rescue it. The render expiry grace is not an extra late-hit window.
      const nearby=same.find(n=>Math.abs(delta(n))<=this.approachWindow+1e-8);
      const wrong=pending.find(n=>n.lane!==lane&&Math.abs(delta(n))<=this.window+1e-8);
      const missed=nearby||wrong;
      if(missed){
        this.overpresses++;
        this.judge(missed,false,delta(missed));
        this.feedback.reason=nearby?(delta(missed)<0?'early':'late'):'lane';
      }
      // With no nearby note, only move: preserve combo, score and accuracy.
    }
  }
  const api={FloeRun,DEFAULT_WINDOW,OPENING_BREATH_SECONDS,AIR_PER_TAP};root.BreathFloe=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
