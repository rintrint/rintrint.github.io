const test=require('node:test'),assert=require('node:assert/strict');
const {GuguRun,DEFAULT_WINDOW,refillAir}=require('./gugu-core.js');
const {FloeRun}=require('./floe-core.js');
const {tracks}=require('./assets/floe/chart.json');
function launch(g,time=2.7){g.startBreath();g.advanceBreath(time);g.inhale();}
function refill(g){for(let i=0;i<20&&g.phase==='surface'&&g.air<100;i++)g.press('lower',g.time+.03);}

test('v13 opening breath follows the old breathing cycle, without an automatic roll deadline',()=>{
 const g=new GuguRun(tracks[0]);g.startBreath();
 const first=g.breathVisual();g.advanceBreath(2.43);
 assert.ok(Math.abs(g.air-90)<1e-8);assert.equal(g.status,'breathing');assert.ok(g.breathVisual().ready);
 assert.ok(g.breathVisual().ringScale<first.ringScale);assert.ok(g.breathVisual().expansion>first.expansion);
 g.advanceBreath(.27);assert.equal(g.air,100);
 g.advanceBreath(.9);assert.ok(g.air<1e-8);assert.equal(g.status,'breathing');
 g.advanceBreath(2.7);g.inhale();
 assert.equal(g.status,'playing');assert.equal(g.phase,'underwater');assert.equal(g.initialAir,100);
 assert.equal(g.time,0);assert.equal(g.breathTaps,0);assert.equal(g.windowMs,DEFAULT_WINDOW);
 assert.equal(g.events.filter(e=>e.type==='splash').length,1);
});

test('v13 one early confirmation uses that breath size; extra taps cannot refill underwater',()=>{
 const g=new GuguRun(tracks[0]);g.startBreath();g.advanceBreath(1.35);g.tapBreath();
 assert.equal(g.status,'playing');assert.equal(g.initialAir,50);
 for(let i=0;i<30;i++)g.tapBreath();
 assert.equal(g.air,50);assert.equal(g.breathTaps,0);assert.equal(g.events.filter(e=>e.type==='breath').length,1);
});

test('v13 pausing freezes the opening cycle and cannot confirm a breath',()=>{
 const g=new GuguRun(tracks[0]);g.startBreath();g.advanceBreath(1);g.pause();
 const air=g.air,pose=g.breathVisual();g.advanceBreath(100);g.tapBreath();g.inhale();
 assert.equal(g.status,'paused');assert.equal(g.air,air);assert.equal(g.breathElapsed,1);assert.deepEqual(g.breathVisual(),pose);
 g.resume();g.advanceBreath(1.7);g.inhale();assert.equal(g.initialAir,100);
});

test('v13 later shore breaths still require taps and depart automatically at the song timestamp',()=>{
 const g=new GuguRun(tracks[0]);launch(g);
 for(const n of g.notes){g.press(n.lane,g.noteTime(n));if(n.kind==='surface')break;}
 assert.equal(g.phase,'surface');assert.equal(g.openingBreath,false);assert.equal(g.breathTaps,0);
 const air=g.air,departure=g.departures[g.departureCursor],at=g.noteTime(departure);
 g.update(g.time+.04);assert.equal(g.air,air);
 g.press('upper',g.time+.01);assert.equal(g.air,refillAir(air));assert.equal(g.breathTaps,1);
 const taps=g.breathTaps;g.pause();g.tapBreath();assert.equal(g.breathTaps,taps);g.resume();
 refill(g);const refilled=g.air;assert.ok(refilled>90&&refilled<100);g.update(at);assert.equal(g.phase,'underwater');assert.equal(g.air,refilled);
});

for(const track of tracks)for(const level of ['beginner','intermediate','expert'])test(`v13 ${track.id}/${level}: timed opening and roll refills finish with all available fish`,()=>{
 for(const fps of [30,144]){
  const g=new GuguRun(track,level);launch(g);
  for(const n of g.notes){refill(g);const at=g.noteTime(n);for(let t=g.time+1/fps;t<at;t+=1/fps)g.update(t);g.press(n.lane,at);}
  assert.equal(g.status,'won',g.reason);assert.equal(g.outcome,'friends');assert.equal(g.food,g.totalFish);assert.equal(g.accuracy,100);assert.equal(g.form,2);
 }
});

test('v13 keeps v12 chart timing, two lanes and anti-mash penalties while widening the default judgement',()=>{
 for(const track of tracks){
  const a=new GuguRun(track),b=new FloeRun(track);
  assert.deepEqual(a.notes.map(({fish,...n})=>n),b.notes.map(({fish,...n})=>n));assert.deepEqual(a.departures,b.departures);assert.equal(a.window,.15);assert.equal(b.window,.125);
  launch(a);for(let t=track.introEnd;a.status==='playing'&&t<40;t+=.05){a.press('upper',t);a.press('lower',t);}
  assert.equal(a.status,'lost');assert.equal(a.reason,'rhythm');
 }
});

test('v13 friends ending draws exactly two centered adult seals at desktop and phone widths',async()=>{
 const {GuguView,friendsLayout}=await import('./gugu-view.js');
 for(const [w,h] of [[1280,720],[1920,1080],[390,844],[360,720]]){
  const layout=friendsLayout(w,h),calls=[],view=Object.create(GuguView.prototype);
  Object.assign(view,{w,h,canvas:{dataset:{}},art:{friend:{rect:[0,7,1446,1048]}},portrait(...args){calls.push(['seal',...args]);},illustration(...args){calls.push(['friend',...args]);},asset(){}});
  view.friendsEnding(0,0);assert.equal(calls.length,2);assert.equal(view.canvas.dataset.endingSeals,2);
  assert.equal((layout.left+layout.right)/2,w/2);
  assert.ok(layout.left-layout.width/2>=0);assert.ok(layout.right+layout.width/2<=w);
  assert.ok(layout.left+layout.width/2<layout.right-layout.width/2);
  assert.equal(calls[0][3],layout.width);assert.equal(calls[1][4],layout.width);
 }
});

test('v13 song-specific fish totals and rounded goals are equal across difficulties, without changing source charts',()=>{
 const before=JSON.stringify(tracks),expected=[[279,80,150,230],[233,60,130,190],[414,110,230,340]];
 tracks.forEach((track,i)=>{
  for(const level of ['beginner','intermediate','expert']){
   const g=new GuguRun(track,level);
   assert.deepEqual([g.totalFish,g.targets.grow,g.targets.fat,g.targets.full],expected[i]);
   assert.equal(g.stageTotals.reduce((a,b)=>a+b,0),g.totalFish);
   assert.ok(Object.values(g.targets).every(n=>n%10===0));
   assert.ok(g.notes.filter(n=>n.kind==='fish').every(n=>n.fish>=1));
   if(level==='expert')assert.ok(g.notes.filter(n=>n.kind==='fish').every(n=>n.fish===1));
   for(const [food,form] of [[g.targets.grow-1,0],[g.targets.grow,1],[g.targets.fat-1,1],[g.targets.fat,2]]){g.food=food;assert.equal(g.form,form);}
  }
 });
 assert.equal(JSON.stringify(tracks),before);
});

test('v13 all four endings use each song’s dynamic cutoffs, including the exact boundary fish',()=>{
 for(const track of tracks){
  for(const delta of [-1,0]){
   const lost=new GuguRun(track);launch(lost);lost.food=lost.targets.fat+delta;lost.lose('oxygen');
   assert.equal(lost.outcome,delta<0?'hungryGhost':'angel');
   const won=new GuguRun(track);launch(won);won.food=won.targets.full+delta;won.phase='shore';won.leaped=true;
   const call=won.notes.find(n=>n.kind==='call');won.time=call.time;won.judge(call,true);
   assert.equal(won.status,'won');assert.equal(won.outcome,delta<0?'rest':'friends');
  }
 }
});

test('v13 oxygen distress increases with depletion, clears after refill, and respects reduced motion',async()=>{
 const {oxygenReaction}=await import('./gugu-feedback.js');
 const states=[100,60,40,20,5].map(air=>oxygenReaction(air,1.7));
 for(let i=1;i<states.length;i++){assert.ok(states[i].severity>=states[i-1].severity);assert.ok(states[i].tint>=states[i-1].tint);assert.ok(states[i].tailStrength<=states[i-1].tailStrength);}
 assert.notEqual(states.at(-1).shiver,0);assert.notEqual(states.at(-1).heave,0);
 for(const s of [oxygenReaction(100,1.7),oxygenReaction(5,1.7,false)]){assert.equal(s.tint,0);assert.equal(s.shiver,0);assert.equal(s.heave,0);}
 const reduced=oxygenReaction(5,1.7,true,true);assert.ok(reduced.tint>0);assert.equal(reduced.shiver,0);assert.equal(reduced.heave,0);
});

test('v13 gate cue follows calibrated approach, refill countdown and missed-hole feedback',async()=>{
 const {gateCue}=await import('./gugu-feedback.js');
 const g=new GuguRun(tracks[0],'expert',true,{delay:200});launch(g);
 const hole=g.notes.find(n=>n.kind==='surface'),at=g.noteTime(hole);
 g.time=at-4;assert.equal(gateCue(g).mode,'none');g.time=at-3;assert.equal(gateCue(g).mode,'approach');
 g.time=at;g.judge(hole,true);assert.equal(gateCue(g).mode,'refill');
 g.pause();assert.equal(gateCue(g).mode,'refill');g.resume();
 refill(g);g.update(g.noteTime(g.departures[g.departureCursor]));assert.equal(gateCue(g).mode,'none');
 g.missedGateAt=g.time;assert.equal(gateCue(g).mode,'missed');g.time+=2;assert.notEqual(gateCue(g).mode,'missed');
 g.status='lost';assert.equal(gateCue(g).mode,'none');
});
