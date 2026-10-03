const test=require('node:test'),assert=require('node:assert/strict');
const {FloeRun,DEFAULT_WINDOW,OPENING_BREATH_SECONDS,AIR_PER_TAP}=require('./floe-core.js');
const {tracks}=require('./assets/floe/chart.json');
function launch(g,taps=20){g.startBreath();for(let i=0;i<taps;i++){g.advanceBreath(.1);g.tapBreath();}g.advanceBreath(OPENING_BREATH_SECONDS);}
function refill(g){for(let i=0;i<20&&g.phase==='surface'&&g.air<100;i++)g.press('lower',g.time+.05);}

for(const track of tracks)for(const level of ['beginner','intermediate','expert']){
 test(`v12 ${track.id}/${level}: complete the song at 30/60/144 fps with calibration extremes`,()=>{
  for(const fps of [30,60,144])for(const delay of [-200,0,200]){
   const g=new FloeRun(track,level,false,{delay,window:85});launch(g);
   for(const n of g.notes){refill(g);const at=g.noteTime(n);for(let t=g.time+1/fps;t<at;t+=1/fps)g.update(t);g.press(n.lane,at);}
   assert.equal(g.status,'won',`${fps}/${delay}: ${g.reason}`);assert.equal(g.outcome,'friends');assert.equal(g.food,438);assert.equal(g.accuracy,100);assert.deepEqual(g.stageFood,[146,146,146]);
  }
 });
}
test('v12 retains the complete v11 song and chart without modification',()=>{
 assert.deepEqual(tracks.find(t=>t.id==='drift-tide'),require('./assets/drift/chart.json').tracks[0]);
 assert.equal(tracks.length,3);assert.deepEqual(tracks.map(t=>t.title),['新音樂 2','新音樂 3','新音樂']);assert.equal(new Set(tracks.map(t=>t.src)).size,3);
});
for(const t of tracks.filter(t=>t.id.startsWith('floe-')))test(`v12 ${t.id}: difficulty reduction retains exact acoustic timestamps and 146 fish per stage`,()=>{
 const expert=new Map(t.charts.expert.map(n=>[n.step,n]));
 assert.ok(t.charts.expert.length>t.charts.intermediate.length*1.5);
 assert.ok(t.charts.intermediate.length>t.charts.beginner.length*1.5);
 for(const level of ['beginner','intermediate','expert']){
  const notes=t.charts[level];for(const n of notes){assert.equal(n.time,expert.get(n.step).time);assert.ok(n.time>t.introEnd&&n.time<t.duration);assert.ok(Math.min(...t.attacks.map(a=>Math.abs(a.time-n.time)))<.001);}
  assert.deepEqual([0,1,2].map(s=>notes.filter(n=>n.stage===s).reduce((a,n)=>a+n.fish,0)),[146,146,146]);
  assert.equal(notes.filter(n=>n.kind==='leap').length,1);assert.equal(notes.at(-1).kind,'call');
 }
});
for(const track of tracks.filter(t=>t.id.startsWith('floe-')))test(`v12 ${track.id}: still rejects mashing and requires surfacing before the automatic middle leap`,()=>{
 for(const mode of ['mash','leap']){
  const g=new FloeRun(track);launch(g);
  if(mode==='mash')for(let t=g.track.introEnd;g.status==='playing'&&t<40;t+=.05){g.press('upper',t);g.press('lower',t);}
  else {
   const leap=g.departures.find(n=>n.kind==='leap'),surface=g.notes.filter(n=>n.kind==='surface'&&n.time<leap.time).at(-1);
   for(const n of g.notes){refill(g);if(n===surface)g.update(n.time+g.window+.1);else g.press(n.lane,n.time);if(g.status==='lost')break;}
  }
  assert.equal(g.status,'lost');if(mode==='mash')assert.equal(g.reason,'rhythm');else assert.ok(['oxygen','leap'].includes(g.reason));
 }
});
test('v12 scroll speed is 70% at every multiplier and still meets the mouth at judgement time',async()=>{
 const {scrollMultiplier,SWIM_SCALE}=await import('./floe-settings.js');
 const {floeGeometry}=await import('./floe-view.js');const {fishPosition}=await import('./drift-media.js');
 assert.equal(SWIM_SCALE,1.2);
 for(const rate of [.1,1,2]){
  const geo=floeGeometry(1280,720,.82,scrollMultiplier(rate));assert.ok(Math.abs(geo.speed/((1280*.68+60)/.82*rate)-.7)<1e-12);
  const note={time:10,lane:'upper'},game={time:10.2,noteTime:()=>10.2};assert.equal(fishPosition(note,game,geo).x,geo.x);
 }
});
for(const track of tracks.filter(t=>t.id.startsWith('floe-')))test(`v12 ${track.id}: imported music is byte-identical to its recorded source checksum`,()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,track.src))).digest('hex');
 assert.equal(hash,track.analysis.sourceSha256);assert.ok(track.analysis.playableNoteValidation.expert.independentP95Ms<35);
});
test('v12 empty beats move in the pressed direction on the next frame without awarding fish',async()=>{
 const {FloeMotion}=await import('./floe-motion.js');
 for(const track of tracks)for(const fps of [30,60,144]){
  const g=new FloeRun(track),motion=new FloeMotion();launch(g);
  assert.ok(g.notes[0].time>2);
  motion.input('upper',1);g.press('upper',1);motion.advance(1+1/fps);
  assert.ok(motion.y<1,'the first frame must already move upward');
  assert.equal(g.food,0);assert.equal(g.score,0);assert.equal(g.counts.miss,0);assert.equal(g.stability,100);assert.equal(motion.frame,0);
  motion.advance(1.4);const upper=motion.y;
  motion.input('lower',1.4);g.press('lower',1.4);motion.advance(1.4+1/fps);
  assert.ok(motion.y>upper,'down input must also work without a fish');
  assert.equal(g.food,0);assert.equal(g.counts.miss,0);assert.equal(g.stability,100);assert.equal(motion.bites.length,0);
 }
});
test('v12 hit feedback cannot double the movement impulse or cancel an active bite',async()=>{
 const {FloeMotion}=await import('./floe-motion.js');const m=new FloeMotion();
 m.input('upper',0);const impulse=m.squashVelocity;m.hit('upper',0,true);
 assert.equal(m.squashVelocity,impulse);assert.equal(m.bites.length,1);assert.ok(m.frame>0);
 m.advance(.06);const pose={y:m.y,velocity:m.velocity,frame:m.frame},bite={...m.bites[0]};
 m.input('lower',.06);
 assert.equal(m.y,pose.y);assert.equal(m.velocity,pose.velocity);assert.equal(m.frame,pose.frame);assert.deepEqual(m.bites[0],bite);
 m.hit('lower',.06,true);assert.equal(m.bites.length,2);assert.equal(m.bites[1].start,bite.end);
 m.advance(.25);assert.ok(m.frame>0);m.advance(.4);assert.equal(m.frame,0);
});
test('v12 rapid direction changes preserve continuous motion and a frozen song clock freezes the pose',async()=>{
 const {FloeMotion}=await import('./floe-motion.js');const m=new FloeMotion();
 for(let i=0;i<60;i++){
  const t=i/60;m.advance(t);const y=m.y,velocity=m.velocity;
  m.input(i%2?'lower':'upper',t);assert.equal(m.y,y);assert.equal(m.velocity,velocity);
  m.advance(t+1/60);assert.ok(Number.isFinite(m.y)&&m.y>-.1&&m.y<1.1);assert.equal(m.bites.length,0);
 }
 const paused={y:m.y,velocity:m.velocity,squash:m.squash};m.advance(m.time);
 assert.deepEqual({y:m.y,velocity:m.velocity,squash:m.squash},paused);
});
function judgementRun(settings={}){
 const chart=[{time:2,step:0,kind:'fish',fish:1,stage:0,depth:18},{time:5,step:4,kind:'fish',fish:1,stage:0,depth:18}];
 const g=new FloeRun({...tracks[0],introEnd:0,charts:{expert:chart}},'expert',false,settings);
 launch(g);g.events.length=0;return g;
}

test('v12 earned fish select thin, medium and fat swimming art at the exact growth boundaries',async()=>{
 const {FloeView}=await import('./floe-view.js'),forms=require('./assets/floe/swim-forms.json');
 const drawn=[],bites=[],canvas={dataset:{}},view=Object.create(FloeView.prototype);
 const c={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(image){drawn.push(image.id);}};
 Object.assign(view,{c,canvas,reduced:true,swimForms:forms.map(a=>({...a,image:{id:a.id}})),duet:{bites:[]},eatPose(...args){bites.push(args);}});
 for(const [before,after] of [[0,'thin'],[118,'thin'],[119,'medium'],[238,'medium'],[239,'fat'],[359,'fat']]){
  const g=judgementRun();g.food=before;view.game=g;view.duet.bites=[];
  view.eatingSeal(448,490,270,0);assert.equal(canvas.dataset.sealForm,forms[g.form].id);
  const n=g.notes[0];g.press(n.lane,n.time);assert.equal(g.food,before+1);
  drawn.length=0;view.eatingSeal(448,490,270,0);
  assert.equal(canvas.dataset.sealForm,after);assert.equal(drawn.length,24);assert.ok(drawn.every(id=>id===after));
  // The same form remains selected during a queued bite and after returning to swimming.
  view.duet.bites=[{start:g.time-.06,end:g.time+.13}];view.eatingSeal(448,490,270,2);
  assert.equal(canvas.dataset.sealForm,after);const a=forms[g.form];
  assert.equal(bites.at(-1)[4],a.rect[3]/a.rect[2]/.65);
  view.duet.bites=[];view.eatingSeal(448,490,270,0);assert.equal(canvas.dataset.sealPose,'swimming');
 }
 view.game=judgementRun();view.eatingSeal(448,490,270,0);assert.equal(canvas.dataset.sealForm,'thin');
 assert.deepEqual(forms.map(a=>a.minimumFish),[0,120,240]);
});

test('v12 swimming art preserves the three supplied original files',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 const forms=require('./assets/floe/swim-forms.json');
 for(const form of forms){
  const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,form.src))).digest('hex');
  assert.equal(hash,form.sha256);
 }
 assert.ok(forms[0].rect[3]/forms[0].rect[2]<forms[1].rect[3]/forms[1].rect[2]);
 assert.ok(forms[1].rect[3]/forms[1].rect[2]<forms[2].rect[3]/forms[2].rect[2]);
});
test('v12 empty presses preserve an earned combo, score, accuracy and stability',()=>{
 const g=judgementRun();g.press(g.notes[0].lane,2);g.events.length=0;
 const earned={combo:g.combo,score:g.score,accuracy:g.accuracy,stability:g.stability,food:g.food,misses:g.misses};
 for(let t=2.4;t<4.6;t+=.02){g.press('upper',t);g.press('lower',t);}
 assert.deepEqual({combo:g.combo,score:g.score,accuracy:g.accuracy,stability:g.stability,food:g.food,misses:g.misses},earned);
 assert.equal(g.events.length,0);assert.equal(g.overpresses,0);
});
test('v12 the empty/early/hit boundaries follow timing calibration and every window setting',()=>{
 for(const window of [40,85,125,170,200])for(const delay of [-200,0,200]){
  const empty=judgementRun({window,delay}),n=empty.notes[0],at=empty.noteTime(n);
  empty.press(n.lane,at-empty.approachWindow-.001);assert.equal(n.result,null);assert.equal(empty.misses,0);
  empty.press(n.lane,at-empty.window);assert.equal(n.result,'hit');
  const early=judgementRun({window,delay}),fish=early.notes[0];
  early.press(fish.lane,at-early.approachWindow);assert.equal(fish.result,'miss');assert.equal(early.feedback.reason,'early');
  for(let t=at-early.approachWindow+.01;t<=at+.2;t+=.01)early.press(fish.lane,t);
  assert.equal(early.food,0);assert.equal(early.counts.miss,1);assert.equal(early.overpresses,1);assert.equal(early.stability,89);
  const edge=judgementRun({window,delay});edge.press(edge.notes[0].lane,at+edge.window);assert.equal(edge.notes[0].result,'hit');
 }
});
test('v12 late presses and omitted fish miss once, without charging a second empty press',()=>{
 for(const window of [40,85,200])for(const late of [.001,.08]){
  const g=judgementRun({window}),n=g.notes[0];g.press(n.lane,2+g.window+late);
  assert.equal(n.result,'miss');assert.equal(g.counts.miss,1);assert.equal(g.food,0);assert.equal(g.stability,89);
  if(late<.03)assert.equal(g.feedback.reason,'late');
  g.press(n.lane,2+g.window+late+.001);assert.equal(g.counts.miss,1);
 }
});
test('v12 wrong-lane input consumes a nearby fish, but cannot affect the next separate fish',()=>{
 const g=judgementRun(),n=g.notes[0];g.press(n.lane==='upper'?'lower':'upper',2);
 assert.equal(n.result,'miss');assert.equal(g.feedback.reason,'lane');
 g.press(n.lane,2);assert.equal(g.food,0);assert.equal(g.counts.miss,1);
 g.press(g.notes[1].lane,5);assert.equal(g.food,1);assert.equal(g.notes[1].result,'hit');
});
test('v12 dense legitimate hits are still accepted after a nearby earlier miss',()=>{
 const g=judgementRun();g.notes[1].time=2.18;g.notes[1].lane=g.notes[0].lane;
 g.press(g.notes[0].lane,1.77);assert.equal(g.notes[0].result,'miss');
 g.press(g.notes[1].lane,2.18);assert.equal(g.notes[1].result,'hit');assert.equal(g.food,1);
});
test('v12 free empty beats do not let repeated button mashing clear any song or difficulty',()=>{
 for(const track of tracks)for(const level of ['beginner','intermediate','expert'])for(const window of [40,85,200])for(const interval of [.025,.05,.09])for(const mode of ['both','alternate','upper','lower']){
  const g=new FloeRun(track,level,false,{window});launch(g);
  for(let i=0;g.status==='playing'&&i*interval<track.duration;i++){
   const t=i*interval;
   if(mode==='both'){g.press('upper',t);g.press('lower',t);}
   else g.press(mode==='alternate'?(i%2?'upper':'lower'):mode,t);
  }
  if(g.status==='playing')g.update(track.duration);
  assert.equal(g.status,'lost',`${track.id}/${level}/${window}/${interval}/${mode}`);assert.ok(g.food<360);
 }
});
test('v12 all difficulties default to 125 ms while explicit window adjustments remain available',()=>{
 for(const level of ['beginner','intermediate','expert']){
  assert.equal(new FloeRun(tracks[0],level).windowMs,125);
  assert.equal(new FloeRun(tracks[0],level,false,{window:40}).windowMs,40);
 }
 assert.equal(DEFAULT_WINDOW,125);
});
test('v12 opening breath awards exactly five percent per tap and departs on the deadline',()=>{
 for(const count of [0,1,10,18,20,28]){
  const g=new FloeRun(tracks[0]);g.startBreath();
  g.advanceBreath(1);assert.equal(g.air,0,'waiting never refills oxygen');
  for(let i=0;i<count;i++){g.tapBreath();g.advanceBreath(.05);}
  assert.equal(g.air,Math.min(100,count*AIR_PER_TAP));assert.equal(g.breathTaps,count);assert.equal(g.status,'breathing');
  assert.equal(g.score,0);assert.equal(g.misses,0);assert.equal(g.accuracy,100);
  g.advanceBreath(g.breathRemaining-.01);assert.equal(g.status,'breathing');
  g.advanceBreath(.011);assert.equal(g.status,'playing');assert.equal(g.phase,'underwater');assert.equal(g.time,0);
  assert.equal(g.initialAir,Math.min(100,count*AIR_PER_TAP));assert.equal(g.events.filter(e=>e.type==='splash').length,1);
  g.advanceBreath(10);assert.equal(g.events.filter(e=>e.type==='splash').length,1);
 }
});
test('v12 paused breathing cannot gain air or advance its countdown',()=>{
 const g=new FloeRun(tracks[0]);g.startBreath();g.advanceBreath(1);g.tapBreath();const before=g.breathRemaining;
 g.pause();g.advanceBreath(30);g.tapBreath();assert.equal(g.air,5);assert.equal(g.breathRemaining,before);
 g.resume();g.advanceBreath(before);assert.equal(g.status,'playing');assert.equal(g.initialAir,5);
});
test('v12 removed departure notes do not alter fish timing, weights, scoreable gates or source charts',()=>{
 for(const track of tracks)for(const level of ['beginner','intermediate','expert']){
  const g=new FloeRun(track,level),source=track.charts[level];
  assert.ok(g.notes.every(n=>!['dive','leap'].includes(n.kind)));
  assert.deepEqual(g.departures.map(n=>n.time),source.filter(n=>['dive','leap'].includes(n.kind)).map(n=>n.time));
  assert.deepEqual(g.notes.map(n=>[n.time,n.kind,n.fish]),source.filter(n=>!['dive','leap'].includes(n.kind)).map(n=>[n.time,n.kind,n.fish]));
 }
});
test('v12 surface refill requires taps and automatically dives at the original calibrated song time',()=>{
 for(const delay of [-200,0,200])for(const kind of ['dive','leap']){
  const chart=[{time:2,step:0,kind:'surface',fish:0,stage:0},{time:5,step:2,kind,fish:0,stage:0},{time:7,step:4,kind:'fish',fish:1,stage:0,depth:18}];
  const g=new FloeRun({...tracks[0],introEnd:0,charts:{expert:chart}},'expert',false,{delay});launch(g,10);
  g.press(g.notes[0].lane,g.noteTime(g.notes[0]));assert.equal(g.phase,'surface');const air=g.air,deadline=5+delay/1000;
  g.update(deadline-1);assert.equal(g.air,air);const score=g.score,combo=g.combo;
  g.press('upper',deadline-.8);g.press('lower',deadline-.6);assert.equal(g.air,air+10);assert.equal(g.breathTaps,2);
  g.pause();g.update(deadline+20);g.tapBreath();assert.ok(Math.abs(g.breathRemaining-.6)<1e-8);assert.equal(g.air,air+10);g.resume();
  g.update(deadline-.001);assert.equal(g.phase,'surface');g.update(deadline);assert.equal(g.phase,'underwater');
  assert.equal(g.time,deadline);assert.equal(g.score,score);assert.equal(g.combo,combo);assert.equal(g.misses,0);
  assert.equal(g.leaped,kind==='leap');assert.equal(g.events.filter(e=>e.automatic&&e.at===deadline).length,1);
  g.press(g.notes[1].lane,g.noteTime(g.notes[1]));assert.equal(g.food,1);
 }
});
test('v12 practice mode still requires tapping to refill at a missed surface',()=>{
 const chart=[{time:2,step:0,kind:'surface',fish:0,stage:0},{time:5,step:2,kind:'dive',fish:0,stage:0}];
 const g=new FloeRun({...tracks[0],introEnd:0,charts:{expert:chart}},'expert',true);launch(g,10);
 g.update(2.2);assert.equal(g.phase,'surface');assert.ok(g.air<50);const air=g.air;
 g.update(3);assert.equal(g.air,air);g.press('upper',3.1);assert.equal(g.air,air+5);
});
