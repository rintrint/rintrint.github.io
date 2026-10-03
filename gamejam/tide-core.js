/* Deterministic edition-six rules. Time is audible song time, never frame count. */
(function(root){
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const WINDOWS={beginner:.21,intermediate:.15,expert:.095};
  class JourneyRun {
    constructor(track,difficulty='beginner',practice=false){
      this.track=track;this.difficulty=difficulty;this.practice=practice;this.window=WINDOWS[difficulty]||.15;
      this.notes=track.charts[difficulty].map((n,id)=>({...n,id,result:null}));
      this.status='ready';this.phase='shore';this.time=0;this.air=0;this.food=0;this.stageFood=[0,0,0];this.events=[];this.cursor=0;this.combo=0;this.hits=0;this.misses=0;this.leaped=false;this.called=false;this.outcome=null;this.lastPress=-100;this.depth=0;this.feedback=null;this.surfaceAt=0;
    }
    get growth(){return 1+Math.min(this.food/360,1)*.6;}
    get form(){return Math.min(2,Math.floor(this.food/120));}
    get progress(){return clamp(this.time/this.track.duration,0,1);}
    get danger(){return this.phase==='underwater'?clamp((40-this.air)/40,0,1):0;}
    get target(){return this.notes.slice(this.cursor).find(n=>!n.result);}
    get accuracy(){return this.hits+this.misses?Math.round(this.hits/(this.hits+this.misses)*100):100;}
    startBreath(){this.status='breathing';this.time=0;}
    breathSize(t){return clamp((t%3.6)/2.7,0,1.12);}
    inhale(t){if(this.status!=='breathing')return;this.air=Math.round(clamp(this.breathSize(t),0,1)*100);this.initialAir=this.air;this.status='playing';this.time=0;this.events.push({type:'breath',big:true,at:0});}
    pause(){if(['playing','breathing'].includes(this.status)){this.beforePause=this.status;this.status='paused';}}
    resume(){if(this.status==='paused')this.status=this.beforePause;}
    lose(reason){if(this.practice){this.air=Math.max(1,this.air);return;}this.status='lost';this.reason=reason;this.outcome=this.food>=240?'angel':'hungryGhost';this.events.push({type:'lost',at:this.time});}
    consume(to){
      const dt=Math.max(0,to-this.time);
      if(this.phase==='underwater'){
        // A full lung covers roughly one 18-second dive; depth increases consumption.
        this.air=Math.max(0,this.air-dt*(4.15+this.depth*.012));
        if(this.air<=0&&!this.practice){this.time=to;this.lose('oxygen');return;}
        if(this.practice)this.air=Math.max(1,this.air);
      }else if(this.phase==='surface')this.air=Math.min(100,this.air+dt*32);
      this.time=to;
    }
    update(t){
      if(this.status!=='playing'||t<this.time)return;
      // Process expirations in order so low frame rates cannot skip oxygen death.
      while(this.cursor<this.notes.length&&this.notes[this.cursor].time+this.window<t){
        const n=this.notes[this.cursor++];this.consume(Math.max(this.time,n.time+this.window));if(this.status!=='playing')return;
        if(!n.result)this.judge(n,false);
        if(this.status!=='playing')return;
      }
      this.consume(t);if(this.status!=='playing')return;
      if(t>=this.track.duration){
        if(this.leaped&&this.phase==='shore'&&this.called){this.status='won';this.outcome=this.food>=360?'friends':'rest';this.events.push({type:'won',at:t});}
        else this.lose('route');
      }
    }
    judge(n,hit,error=0){
      if(n.result)return;
      const allowed=n.kind==='fish'?this.phase==='underwater':n.kind==='surface'||n.kind==='exit'?this.phase==='underwater':n.kind==='call'?this.phase==='shore':this.phase!=='underwater';
      hit=hit&&allowed;n.result=hit?'hit':'miss';
      if(hit){
        this.hits++;this.combo++;
        if(n.kind==='fish'){this.food+=n.fish;this.stageFood[n.stage]+=n.fish;this.depth=n.depth;}
        if(n.kind==='surface'){this.phase='surface';this.surfaceAt=this.time;this.depth=0;this.events.push({type:'breath',big:false,at:this.time});}
        if(n.kind==='dive'||n.kind==='leap'){this.phase='underwater';this.depth=12;if(n.kind==='leap')this.leaped=true;this.events.push({type:n.kind==='leap'?'bigBreath':'splash',at:this.time});}
        if(n.kind==='exit'){this.phase='shore';this.depth=0;}
        if(n.kind==='call'){this.called=true;this.events.push({type:'call',at:this.time});}
      }else{
        this.misses++;this.combo=0;
        if(n.kind==='leap'){if(this.practice){this.leaped=true;this.phase='underwater';}else this.lose('leap');}
        if(this.practice&&n.kind==='dive')this.phase='underwater';
        if(this.practice&&n.kind==='surface'){this.phase='surface';this.air=100;}
        if(this.practice&&n.kind==='exit')this.phase='shore';
        if(this.practice&&n.kind==='call')this.called=true;
        if(n.kind==='dive'&&this.phase==='shore'&&!this.practice)this.lose('entry');
      }
      const e={type:hit?'hit':'miss',note:n,at:this.time,error,result:hit?(Math.abs(error)<this.window*.45?'perfect':'good'):'miss',food:this.food,growth:this.growth};this.events.push(e);this.feedback=e;
    }
    press(t){
      if(this.status!=='playing'||t-this.lastPress<.085)return;
      this.update(t);if(this.status!=='playing')return;this.lastPress=t;
      const candidates=this.notes.slice(this.cursor).filter(n=>!n.result&&Math.abs(n.time-t)<=this.window);
      candidates.sort((a,b)=>Math.abs(a.time-t)-Math.abs(b.time-t));
      if(candidates[0])this.judge(candidates[0],true,t-candidates[0].time);
    }
  }
  const api={JourneyRun};root.BreathJourney=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
