/* Shared, deterministic story and rhythm rules for both art editions. */
(function(root){
  'use strict';
  const BPM=72, BEAT=60/BPM, CYCLE=BEAT*4, SURFACE=210, HEIGHT=900, LENGTH=3950;
  const HOLES=[560,1420,2240,2790,3570];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>t*t*(3-2*t);
  class Journey {
    constructor(){this.reset();this.status='title';}
    reset(){
      this.status='playing';this.stage='breathe';this.time=0;this.x=420;this.y=SURFACE-33;this.facing=1;
      this.oxygen=20;this.food=0;this.goal=12;this.breaths=0;this.perfects=0;this.maxDepth=0;
      this.checkpoint=0;this.jumpDone=false;this.called=false;this.holding=false;this.holdStart=0;
      this.boost=0;this.vx=0;this.vy=0;this.lastRelease=-10;this.events=[];this.transition=null;
      this.warning=false;this.fisherKnocks={};this.endingTime=0;
      this.fish=[];let seed=24617;const r=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
      for(const cx of [780,1060,1220,1660,1880,2040,2970,3220,3400])for(let i=0;i<6;i++){
        const tier=i%3;
        this.fish.push({x:cx+(r()-.5)*130,y:SURFACE+195+tier*165+r()*55,value:tier+1,tier,active:true,phase:r()*6.28});
      }
    }
    get phase(){return (this.time%CYCLE)/CYCLE;}
    get beatDistance(){const t=this.time%CYCLE;return Math.min(t,CYCLE-t);}
    get precise(){return this.beatDistance<=(this.stage==='bigBreath'?.20:.28);}
    get charge(){return this.holding?clamp((this.time-this.holdStart)/2.2,0,1):0;}
    get depth(){return Math.max(0,(this.y-SURFACE)/8);}
    get underwater(){return this.stage==='swim';}
    get targetHole(){return HOLES[this.checkpoint+1]??HOLES[4];}
    get nearHole(){return this.underwater&&Math.abs(this.x-this.targetHole)<115&&this.y<SURFACE+178;}
    get pulse(){return Math.exp(-Math.pow(this.beatDistance/.17,2));}
    emit(type,text='',data={}){this.events.push({type,text,...data});}
    inhale(){if(this.status!=='playing'||this.holding||this.transition||this.stage==='ending'||this.stage==='calling')return;this.holding=true;this.holdStart=this.time;this.emit(this.stage==='bigBreath'?'greatInhale':'inhale');}
    release(){
      if(this.status!=='playing'||!this.holding)return false;
      const held=this.time-this.holdStart;this.holding=false;
      this.emit('exhale');
      if(this.time-this.lastRelease<.35)return false;this.lastRelease=this.time;
      const needed=this.stage==='bigBreath'?2.0:this.stage==='breathe'?1.0:.45;
      const good=this.precise&&held>=needed;
      if(!good){this.emit('miss',held<needed?'再留長一點，讓這口氣飽滿。':'跟著海水變亮的那一刻，輕輕放開。');return false;}
      this.perfects++;this.emit('perfect','呼吸，與海同拍。');
      if(this.stage==='breathe'){
        this.breaths++;this.oxygen=Math.min(100,this.oxygen+40);
        if(this.oxygen>=100){this.stage='entry';this.x=HOLES[0];this.emit('full','肚子還空著，肺裡已經裝滿了海風。');}
      }else if(this.stage==='entry'){
        this.animate('dive',this.x+68,SURFACE+165,.95,'swim');
        this.emit('splash','出發。讓光帶你找到魚群。',{x:this.x,y:SURFACE});
      }else if(this.stage==='swim'){
        if(this.nearHole){
          const next=this.checkpoint+1;
          if(next===4&&(!this.jumpDone||this.food<this.goal)){
            this.emit('hint',!this.jumpDone?'還沒越過那道冰隙。':`再吃 ${this.goal-this.food} 份小魚，就可以呼喚朋友了。`);return true;
          }
          this.checkpoint=next;this.fisherKnocks[next]=this.time+.45;
          this.animate('surface',HOLES[next],SURFACE-33,1.1,next===1?'rest':next===2?'bigBreath':'calling');
          this.emit('breach',next<3?'噗！借過一下，釣魚先生。':'終於，聞到朋友的氣息。',{x:HOLES[next],y:SURFACE});
        }else{this.boost=1.6;this.oxygen=Math.max(0,this.oxygen-.4);this.emit('stroke','');}
      }else if(this.stage==='rest'){
        this.oxygen=Math.max(this.oxygen,78);this.stage='entry';this.emit('rest','小小一口氣，也能走很遠。');
      }else if(this.stage==='bigBreath'){
        this.oxygen=100;this.animate('greatLeap',HOLES[3]+45,SURFACE+135,2.15,'swim');
        this.emit('leap','把這一口氣，交給天空。',{x:this.x,y:SURFACE});
      }
      return true;
    }
    call(){if(this.status!=='playing'||this.stage!=='calling'||!this.jumpDone||this.food<this.goal)return false;this.called=true;this.stage='ending';this.endingTime=0;this.holding=false;this.emit('call','原來，另一端有人在等你。');return true;}
    animate(type,x,y,duration,next){this.holding=false;this.transition={type,fromX:this.x,fromY:this.y,toX:x,toY:y,t:0,duration,next};}
    pause(){if(this.status==='playing'){this.status='paused';this.holding=false;this.emit('exhale');}else if(this.status==='paused')this.status='playing';}
    update(dt,input={}){
      if(this.status!=='playing')return;dt=clamp(dt,0,.05);this.time+=dt;
      this.boost=Math.max(0,this.boost-dt);
      if(this.transition){
        const a=this.transition;a.t+=dt;const p=clamp(a.t/a.duration,0,1),q=ease(p);
        this.x=a.fromX+(a.toX-a.fromX)*q;this.y=a.fromY+(a.toY-a.fromY)*q;
        if(a.type==='greatLeap')this.y-=Math.sin(p*Math.PI)*220;
        else if(a.type==='surface')this.y-=Math.sin(p*Math.PI)*68;
        else this.y-=Math.sin(p*Math.PI)*42;
        if(p>=1){
          this.stage=a.next;this.transition=null;
          if(a.type==='greatLeap'){this.jumpDone=true;this.checkpoint=3;this.emit('splash','你越過了，最長的那一口氣。',{x:this.x,y:SURFACE});}
          if(a.type==='surface'){this.oxygen=Math.min(100,this.oxygen+12);this.emit('land','',{x:this.x,y:this.y});}
        }
        return;
      }
      if(this.stage==='ending'){
        this.endingTime+=dt;if(this.endingTime>7.5){this.status='won';this.emit('won','吃飽了，也不再孤單。');}return;
      }
      if(this.stage!=='swim'){this.vx=this.vy=0;return;}
      let dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0);
      const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length;}
      const speed=215*(this.boost>0?1.55:1)*(this.holding?.82:1);
      this.vx=dx*speed;this.vy=dy*speed;if(dx)this.facing=dx>0?1:-1;
      const minX=HOLES[this.checkpoint]-60,maxX=this.targetHole+100;
      this.x=clamp(this.x+this.vx*dt,minX,maxX);this.y=clamp(this.y+this.vy*dt,SURFACE+62,HEIGHT-95);
      const drain=(3.0+this.depth*.043)*(this.boost>0?.65:1);
      this.oxygen=Math.max(0,this.oxygen-dt*drain);this.maxDepth=Math.max(this.maxDepth,this.depth);
      if(this.oxygen<25&&!this.warning){this.warning=true;this.emit('warning','空氣快用完了。往釣魚人的光束游 ↑');}
      if(this.oxygen>45)this.warning=false;
      if(this.oxygen<=0){this.status='lost';this.holding=false;this.emit('lost','這一口氣，沒能帶你穿過冰層。');return;}
      for(const f of this.fish)if(f.active&&Math.hypot(f.x-this.x,f.y-this.y)<52){f.active=false;this.food+=f.value;this.emit('fish',`小魚 ＋${f.value}`,{x:f.x,y:f.y,value:f.value});}
    }
    snapshot(){return{status:this.status,stage:this.stage,time:this.time,x:this.x,y:this.y,oxygen:this.oxygen,food:this.food,checkpoint:this.checkpoint,jumpDone:this.jumpDone,holding:this.holding,precise:this.precise};}
  }
  const api={Journey,BPM,BEAT,CYCLE,SURFACE,HEIGHT,LENGTH,HOLES,clamp,ease};root.BreathJourney=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
