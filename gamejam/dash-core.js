(function(root){
  'use strict';
  const PERFECT=.05, GOOD=.11;
  class DashGame{
    constructor(chart,{autoplay=false,practice=false,start=0}={}){
      this.chart=chart;this.autoplay=autoplay;this.practice=practice;this.time=start;
      this.notes=chart.events.map(n=>({...n,state:n.time<start?'skipped':'pending',hits:0}));
      this.hazards=chart.hazards.map(n=>({...n,done:n.time<start}));
      this.pickups=(chart.pickups||[]).map(n=>({...n,done:n.time<start}));
      this.byId=new Map(this.notes.map(n=>[n.id,n]));this.held={air:false,ground:false};
      this.active={air:null,ground:null};this.jumpUntil=-1;this.health=200;this.combo=0;
      this.maxCombo=0;this.score=0;this.perfect=0;this.great=0;this.missed=0;
      this.errors=[];this.events=[];this.status='playing';this.damageAt=-10;
      this.total=this.notes.filter(n=>n.state!=='skipped').length;
    }
    get accuracy(){const n=this.perfect+this.great+this.missed;return n?(this.perfect+this.great*.65)/n*100:100;}
    get airborne(){return this.time<this.jumpUntil||!!this.active.air;}
    drain(){return this.events.splice(0);}
    award(n,result='perfect',error=null){
      if(n.state==='hit'||n.state==='miss'||n.state==='skipped')return;
      n.state='hit';this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);
      this[result]++;this.score+=result==='perfect'?1000:650;this.health=Math.min(200,this.health+1);
      if(error!==null)this.errors.push(error*1000);
      this.events.push({type:'hit',note:n,at:this.time,result,error});
    }
    miss(n){
      if(n.state!=='pending'&&n.state!=='holding')return;
      n.state='miss';this.missed++;this.combo=0;this.damage(20);
      this.events.push({type:'miss',note:n,at:this.time});
    }
    damage(amount){this.health=Math.max(0,this.health-amount);this.damageAt=this.time;if(!this.health&&!this.practice)this.finish('lost');}
    finish(status='finished'){if(this.status!=='playing')return;this.status=status;this.events.push({type:'end',at:this.time});}
    press(lane,t){
      if(this.status!=='playing'||this.autoplay||!['air','ground'].includes(lane))return;
      this.advance(t);if(this.status!=='playing')return;
      this.held[lane]=true;if(lane==='air')this.jumpUntil=Math.max(this.jumpUntil,t+.36);
      this.events.push({type:'stroke',lane,at:t});
      const mash=this.notes.find(n=>n.kind==='mash'&&n.state==='pending'&&t>=n.start&&t<=n.time);
      if(mash){mash.hits++;this.events.push({type:'mash',note:mash,at:t});return;}
      const n=this.notes.find(n=>n.state==='pending'&&n.lane===lane&&n.kind!=='tail'&&n.kind!=='mash'&&Math.abs(n.time-t)<=GOOD);
      if(!n)return;
      const error=t-n.time;this.award(n,Math.abs(error)<=PERFECT?'perfect':'great',error);
      if(n.kind==='hold')this.active[lane]=n;
    }
    release(lane,t){
      if(this.status!=='playing'||this.autoplay)return;
      this.advance(t);this.held[lane]=false;
      const head=this.active[lane];if(!head)return;
      const tail=this.byId.get(head.tailId);
      if(t>=head.end-.065)this.award(tail);
      else this.miss(tail);
      this.active[lane]=null;
    }
    advance(t){
      if(this.status!=='playing'||t<this.time)return;this.time=t;
      if(this.autoplay){
        for(const n of this.notes){
          if(n.state!=='pending')continue;
          if(n.kind==='mash'&&t>=n.start){n.hits=Math.min(n.required,Math.floor((t-n.start)*14));}
          if(n.time>t)continue;
          if(n.lane==='air')this.jumpUntil=Math.max(this.jumpUntil,n.time+.36);
          if(n.kind==='hold')this.active[n.lane]=n;
          if(n.kind==='tail')this.active[n.lane]=null;
          this.award(n);
        }
      }else{
        for(const n of this.notes){
          if(n.state!=='pending')continue;
          if(n.kind==='tail'&&t>=n.time){
            if(this.active[n.lane]?.id===n.headId&&this.held[n.lane])this.award(n);
            else this.miss(n);
            if(this.active[n.lane]?.id===n.headId)this.active[n.lane]=null;
          }else if(n.kind==='mash'&&t>=n.time){n.hits>=n.required?this.award(n):this.miss(n);}
          else if(n.kind!=='mash'&&t>n.time+GOOD)this.miss(n);
          if(this.status!=='playing')return;
        }
      }
      for(const h of this.hazards){
        if(h.done)continue;
        if(this.autoplay&&t>=h.time-.12&&t<h.time+.2)this.jumpUntil=Math.max(this.jumpUntil,h.time+.2);
        if(t<h.time)continue;h.done=true;
        const safe=this.autoplay||this.airborne;
        if(!safe){this.damage(30);this.combo=0;}
        this.events.push({type:'hazard',safe,at:t});
        if(this.status!=='playing')return;
      }
      for(const p of this.pickups){
        if(p.done||t<p.time)continue;p.done=true;
        if(this.autoplay||(p.lane==='air')===this.airborne){this.health=Math.min(200,this.health+6);this.events.push({type:'pickup',note:p,at:t});}
      }
      if(t>=this.chart.duration-.25)this.finish();
    }
  }
  const api={DashGame,PERFECT,GOOD};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BreathDash=api;
})(typeof window!=='undefined'?window:globalThis);
