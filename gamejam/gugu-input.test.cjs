const test=require('node:test'),assert=require('node:assert/strict');
const {GuguRun,DEFAULT_WINDOW,savedWindow}=require('./gugu-core.js');
const {tracks}=require('./assets/floe/chart.json');
const launch=g=>{g.startBreath();g.advanceBreath(2.7);g.inhale();};

test('v13 defaults to ±150 ms, migrates old defaults and retains custom tuning',()=>{
 assert.equal(DEFAULT_WINDOW,150);
 for(const saved of [{},{windowVersion:2,window:125},{windowVersion:3},{windowVersion:3,window:'bad'}])assert.equal(savedWindow(saved),150);
 for(const window of [40,100,145,200])for(const windowVersion of [2,3])assert.equal(savedWindow({windowVersion,window}),window);
 assert.equal(savedWindow({windowVersion:3,window:125}),125);
 for(const track of tracks)for(const level of ['beginner','intermediate','expert']){
  assert.equal(new GuguRun(track,level).windowMs,150);
  assert.equal(new GuguRun(track,level,false,{window:95}).windowMs,95);
 }
});

test('v13 ±150 ms edges accept hits; just outside misses once and cannot be rescued',()=>{
 for(const offset of [-.150001,-.15,.15,.150001]){
  const g=new GuguRun(tracks[0],'expert',true);launch(g);
  const n=g.notes.find(n=>n.kind==='fish');g.press(n.lane,g.noteTime(n)+offset);
  assert.equal(n.result,Math.abs(offset)<=.15?'hit':'miss');
  if(n.result==='miss'){
   const food=g.food;g.press(n.lane,g.noteTime(n)+Math.max(0,offset));assert.equal(g.food,food);assert.equal(n.result,'miss');
  }
 }
});

test('v13 every key moves immediately, including same-lane presses and opposite inputs in a single frame',async()=>{
 const {GuguMotion}=await import('./gugu-motion.js'),motion=new GuguMotion();
 const lanes=['upper','upper','lower','lower','upper','lower','upper'];
 lanes.forEach((lane,i)=>{
  motion.input(lane,i*.001);assert.equal(motion.y,lane==='upper'?0:1);assert.equal(motion.inputCount,i+1);assert.equal(motion.inputAt,i*.001);
  motion.advance(i*.001+.0001);assert.equal(motion.y,lane==='upper'?0:1);
 });
 motion.input('upper',.02);motion.input('lower',.02);assert.equal(motion.y,1);assert.equal(motion.inputCount,9);
});

test('v13 dense catches react now with no bite backlog; empty inputs do not cancel an active bite',async()=>{
 const {GuguMotion}=await import('./gugu-motion.js'),motion=new GuguMotion();
 for(let i=0;i<60;i++){
  const t=i*.01;motion.input('upper',t);motion.hit('upper',t,true);
  assert.equal(motion.frame,2);assert.equal(motion.bites.length,1);assert.equal(motion.bites[0].start,t);
  motion.input('lower',t+.001);assert.equal(motion.frame,2);assert.equal(motion.y,1);
 }
 motion.advance(.79);assert.equal(motion.frame,0);assert.equal(motion.bites.length,0);
});

test('v13 consecutive same-lane notes have no input rate limit and remain independent of animation',async()=>{
 const {GuguMotion}=await import('./gugu-motion.js');
 for(const lane of ['upper','lower']){
  const source=tracks[0],notes=Array.from({length:30},(_,i)=>({time:source.introEnd+2+i*.01,step:i*32+(lane==='upper'?4:0),kind:'fish',fish:1,stage:0}));
  const track={...source,charts:{expert:notes}},g=new GuguRun(track,'expert',true),motion=new GuguMotion();launch(g);
  for(const n of g.notes){motion.input(n.lane,n.time);g.press(n.lane,n.time);motion.hit(n.lane,n.time,true);assert.equal(n.result,'hit');assert.equal(motion.y,lane==='upper'?0:1);}
  assert.equal(g.food,30);assert.equal(g.combo,30);assert.equal(g.overpresses,0);assert.equal(motion.inputCount,30);
 }
});

test('v13 seal sprites retain native aspect ratios outside the deliberately animated abdomen',async()=>{
 const {GuguView}=await import('./gugu-view.js'),{GuguMotion}=await import('./gugu-motion.js'),{oxygenReaction}=await import('./gugu-feedback.js');
 const view=Object.create(GuguView.prototype),calls=[],scales=[];
 const c={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},scale(x,y){scales.push([x,y]);},drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh){calls.push({sw,sh,dw,dh});}};
 Object.assign(view,{c,canvas:{dataset:{}},sealImage:{width:1536,height:1024},hungerImage:{width:2172,height:724},eating:{width:1536,height:1024},
  swimForms:require('./assets/floe/swim-forms.json').map(a=>({...a,image:{}})),duet:new GuguMotion(),tintedSprite:(image,rect)=>({image,rect})});
 for(const reduced of [false,true]){
  view.reduced=reduced;
  for(const air of [100,35,8])for(const form of [0,1,2]){
   view.game={form,time:1.7};view.health=oxygenReaction(air,1.7,true,reduced);view.duet.input('upper',1.7);
   view.eatingSeal(440,350,280,0);
   for(let frame=0;frame<6;frame++)view.eatPose(440,350,280,frame);
  }
  for(const flat of [false,true])for(const flip of [false,true])view.portrait(400,410,350,2.1,{flat,flip,animated:true,scale:1.3});
  for(const t of [0,.1,.2,2.4])view.hungryPortrait(400,410,350,t);
  view.art={friend:{rect:[0,7,1446,1048],image:{}},angel:{rect:[0,0,710,568],image:{}}};
  for(const kind of ['friend','angel'])view.illustration(kind,400,410,350);
 }
 assert.ok(calls.length>100);
 for(const {sw,sh,dw,dh} of calls)assert.ok(Math.abs(dw/sw-dh/sh)<1e-12,'source and drawn aspect ratios must match');
 for(const [x,y] of scales)assert.equal(Math.abs(x),Math.abs(y),'uniform scale only, including mirrored poses');
});
