/* Edition thirteen: one timed opening breath, tap refills at later ice holes. */
(function(root){
  const {FloeRun}=root.BreathFloe||require('./floe-core.js');
  const {DriftRun,breathState,windowValue}=root.BreathDrift||require('./drift-core.js');
  const DEFAULT_WINDOW=150;
  const REFILL_FRACTION=.12,REFILL_LIMIT=100-1e-9;
  const refillAir=air=>Math.min(REFILL_LIMIT,air+(100-air)*REFILL_FRACTION);
  const airDisplay=air=>air>=100?'100':(Math.floor(Math.max(0,air)*10)/10).toFixed(1).replace(/\.0$/,'');
  function savedWindow(settings={}){
    const value=Number(settings.window);
    // Upgrade the previous default, but retain deliberately adjusted windows.
    if(settings.windowVersion<2||settings.windowVersion==null||settings.window==null||!Number.isFinite(value)||settings.windowVersion===2&&value===125)return DEFAULT_WINDOW;
    return windowValue(value);
  }
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function foodTargets(total){
    const maximum=Math.max(1,Math.floor(total/10)*10||total);
    const target=ratio=>Math.min(maximum,Math.max(Math.min(10,maximum),Math.round(total*ratio/10)*10));
    return {grow:target(120/438),fat:target(240/438),full:target(360/438)};
  }
  function songFish(track){
    const expert=track.charts.expert||Object.values(track.charts)[0];
    const fish=expert.filter(n=>n.kind==='fish'),gates=expert.filter(n=>n.kind!=='fish');
    const group=n=>`${n.stage}:${gates.filter(g=>g.time<n.time).length}`;
    const charts=Object.fromEntries(Object.entries(track.charts).map(([level,notes])=>{
      const chart=notes.map(n=>({...n,fish:0})),targets=chart.filter(n=>n.kind==='fish');
      // Lower difficulties bundle the omitted fish without moving any note.
      for(const n of fish){
        const same=targets.filter(t=>group(t)===group(n));
        const candidates=same.length?same:targets.filter(t=>t.stage===n.stage);
        if(!candidates.length)throw Error('此段譜面沒有可分配的魚群');
        const nearest=candidates.reduce((a,b)=>Math.abs(b.time-n.time)<Math.abs(a.time-n.time)?b:a);
        nearest.fish++;
      }
      return [level,chart];
    }));
    return {...track,charts};
  }
  class GuguRun extends FloeRun{
    constructor(track,level='expert',practice=false,settings={}){
      super(songFish(track),level,practice,{...settings,window:settings.window??DEFAULT_WINDOW});
      this.totalFish=this.notes.reduce((sum,n)=>sum+n.fish,0);
      this.stageTotals=[0,1,2].map(s=>this.notes.filter(n=>n.stage===s).reduce((sum,n)=>sum+n.fish,0));
      this.targets=foodTargets(this.totalFish);this.missedGateAt=-100;
    }
    get form(){return this.food>=this.targets.fat?2:this.food>=this.targets.grow?1:0;}
    get growth(){return 1+clamp(this.food/this.targets.full,0,1)*.6;}
    get danger(){return this.phase==='underwater'?clamp((55-this.air)/55,0,1):0;}
    syncOutcome(){if(this.status==='won')this.outcome=this.food>=this.targets.full?'friends':'rest';}
    judge(note,hit,error=0){
      if(note.result)return;
      super.judge(note,hit,error);
      if(['surface','exit'].includes(note.kind)&&note.result==='miss')this.missedGateAt=this.time;
      this.syncOutcome();
    }
    update(time){super.update(time);this.syncOutcome();}
    lose(reason){super.lose(reason);if(this.status==='lost')this.outcome=this.food>=this.targets.fat?'angel':'hungryGhost';}
    get openingBreath(){return this.status==='breathing'||this.status==='paused'&&this.beforePause==='breathing';}
    get breathRemaining(){return this.openingBreath?3.6-this.breathElapsed%3.6:super.breathRemaining;}
    breathSize(time=this.breathElapsed){return this.openingBreath?breathState(time).fill:super.breathSize();}
    breathVisual(){return this.openingBreath?breathState(this.breathElapsed):super.breathVisual();}
    advanceBreath(dt){
      if(this.status!=='breathing')return;
      this.breathElapsed+=Math.max(0,dt);
      this.air=this.breathSize()*100;
    }
    inhale(){
      // Reuse the old timed intake, then go straight into swimming.
      if(this.status==='breathing')DriftRun.prototype.inhale.call(this,this.breathElapsed);
    }
    tapBreath(){
      if(this.status==='breathing')this.inhale();
      else if(this.status==='playing'&&this.phase==='surface'&&this.breathRemaining>0){
        const before=this.air;this.air=refillAir(this.air);this.breathTaps++;this.lastBreathTap=this.time;
        this.events.push({type:'breathTap',at:this.time,air:this.air,gain:this.air-before,taps:this.breathTaps});
      }
    }
  }
  const api={GuguRun,DEFAULT_WINDOW,REFILL_FRACTION,refillAir,airDisplay,foodTargets,songFish,savedWindow};root.BreathGugu=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
