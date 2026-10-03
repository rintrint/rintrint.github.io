const test=require('node:test'),assert=require('node:assert/strict');
const {DriftRun,delayValue,windowValue}=require('./drift-core.js');
const track=require('./assets/drift/chart.json').tracks[0];
const previous=require('./assets/pulse/chart.json').tracks[0];
const start=(level='expert',practice=false,settings={})=>{const g=new DriftRun(track,level,practice,settings);g.startBreath();g.inhale(2.7);return g;};
for(const level of ['beginner','intermediate','expert']){
  test(`v11 ${level}: inhale enters water directly; only the opening dive is removed`,()=>{
    const g=start(level);assert.equal(g.status,'playing');assert.equal(g.phase,'underwater');assert.equal(g.air,100);assert.equal(g.target.kind,'fish');
    assert.deepEqual(g.notes.map(n=>n.time),previous.charts[level].slice(1).map(n=>n.time));
    g.update(track.introEnd);assert.equal(g.air,100);assert.equal(g.status,'playing');assert.equal(g.misses,0);
  });
  test(`v11 ${level}: full route with both delay extremes, every window and frame rate`,()=>{
    for(const delay of [-200,0,200])for(const window of [40,85,200])for(const fps of [30,60,144]){
      const g=start(level,false,{delay,window});
      for(const n of g.notes){const at=g.noteTime(n);for(let t=g.time+1/fps;t<at;t+=1/fps)g.update(t);g.press(n.lane,at);}
      assert.equal(g.status,'won');assert.equal(g.outcome,'friends');assert.equal(g.food,438);assert.equal(g.accuracy,100);assert.deepEqual(g.stageFood,[146,146,146]);
    }
  });
}
test('v11 delay moves input/contact deadlines without moving audio time or chart data',()=>{
  for(const delay of [-200,200]){const g=start('expert',false,{delay,window:40}),n=g.target,original=n.time;g.press(n.lane,n.time+delay/1000);assert.equal(n.result,'hit');assert.ok(Math.abs(g.feedback.error)<1e-8);assert.equal(n.time,original);assert.equal(g.time,original+delay/1000);}
  const g=start();g.update(5);g.setTiming(200,200);assert.equal(g.time,5);g.setTiming(-200,40);assert.equal(g.time,5);
});
test('v11 custom window accepts boundary and rejects a premature hit beyond it',()=>{
  for(const window of [40,85,200]){const hit=start('expert',false,{window}),n=hit.target;hit.notes=[n];hit.press(n.lane,n.time+window/1000);assert.equal(n.result,'hit');const early=start('expert',false,{window}),m=early.target;early.notes=[m];early.press(m.lane,m.time-window/1000-.01);assert.equal(m.result,'miss');assert.equal(early.feedback.reason,'early');early.press(m.lane,m.time);assert.equal(early.food,0);}
});
test('v11 delayed note is not prematurely expired by rendering',()=>{
  const g=start('expert',false,{delay:200,window:40}),n=g.target;
  g.update(n.time+.21);assert.equal(n.result,null);g.press(n.lane,n.time+.205);assert.equal(n.result,'hit');
});
test('v11 maximum tolerance still cannot be cleared with continuous mashing',()=>{
  for(const window of [40,85,200])for(const interval of [.03,.05,.1,.15])for(const mode of ['one','alternating','both']){
    const g=start('expert',false,{window});let i=0;
    for(let t=track.introEnd;t<track.duration&&g.status==='playing';t+=interval,i++){g.press(mode==='alternating'&&i%2?'upper':'lower',t);if(mode==='both')g.press('upper',t);}
    assert.equal(g.status,'lost');assert.ok(g.food<100);assert.ok(g.time<30);
  }
});
test('v11 Miss fish keep travelling left and cannot be collected again',async()=>{
  const {fishPosition,noteVisible}=await import('./drift-media.js');
  for(const rate of [.1,1,2]){const g=start('expert',true),n=g.target,geo={x:400,upper:300,lower:450,speed:1100*rate};g.update(n.time+.2);assert.equal(n.result,'miss');const a=fishPosition(n,g,geo);assert.equal(noteVisible(n,a.x,1280),true);g.press(n.lane,g.time);assert.equal(g.food,0);g.time+=1;const b=fishPosition(n,g,geo);assert.ok(b.x<a.x);g.time=n.time+(geo.x+91)/geo.speed;assert.equal(noteVisible(n,fishPosition(n,g,geo).x,1280),false);n.result='hit';assert.equal(noteVisible(n,400,1280),false);}
});
test('v11 swimming animation is continuous; a hit starts eating immediately and queues the next bite',async()=>{
  const {DriftMotion,swimPose}=await import('./drift-media.js');const m=new DriftMotion();assert.equal(m.frame,0);m.hit('upper',0,true);assert.equal(m.frame,1);m.advance(.05);const y=m.y;m.hit('lower',.05,true);assert.equal(m.y,y);assert.equal(m.bites.length,2);assert.ok(m.bites[1].start>=m.bites[0].end);m.advance(.4);assert.equal(m.frame,0);assert.notDeepEqual(swimPose(1),swimPose(1.1));assert.deepEqual(swimPose(1,true),swimPose(2,true));
});
test('v11 retains all four endings and the 240/360 fish thresholds',()=>{
  for(const [food,outcome] of [[239,'hungryGhost'],[240,'angel']]){const g=start();g.food=food;g.lose('oxygen');assert.equal(g.outcome,outcome);}
  for(const [food,outcome] of [[359,'rest'],[360,'friends']]){const g=start();g.food=food;g.phase='shore';g.leaped=true;const call=g.notes.find(n=>n.kind==='call');g.judge(call,true,0);assert.equal(g.outcome,outcome);}
});
test('v11 media uses all five supplied assets and trims only after the final note',()=>{
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),art=require('./assets/drift/art.json'),report=require('./assets/drift/audio-edit.json');
  assert.deepEqual(Object.keys(art),['swim','fisher','friend','splash','angel']);
  for(const a of Object.values(art)){const bytes=fs.readFileSync(path.join(__dirname,a.src));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.ok(a.rect[2]>0&&a.rect[3]>0);}
  assert.equal(report.trimmedDuration,190.5);assert.equal(report.decodedAlignmentSamples,0);assert.equal(track.duration,report.trimmedDuration);assert.equal(track.stageBounds.at(-1),track.duration);assert.ok(track.charts.expert.at(-1).time+.5<track.duration);assert.equal(track.charts.expert.filter(n=>n.kind==='fish').reduce((s,n)=>s+n.fish,0),438);
});
test('v11 controls clamp their ranges and reject invalid stored values',()=>{
  assert.equal(delayValue(-900),-200);assert.equal(delayValue(901),200);assert.equal(delayValue('bad'),0);assert.equal(windowValue(0),40);assert.equal(windowValue(900),200);assert.equal(windowValue('bad'),85);
});
test('v11 all six gameplay keys can alternate through the full chart without changing lanes',()=>{
  const {laneForKey}=require('./drift-core.js'),keys={upper:['KeyD','KeyF','ArrowUp'],lower:['KeyJ','KeyK','ArrowDown']},used=new Set(),g=start();let i=0;
  for(const n of g.notes){const code=keys[n.lane][i++%3];used.add(code);g.press(laneForKey(code),g.noteTime(n));}
  assert.equal(used.size,6);assert.equal(g.status,'won');assert.equal(g.accuracy,100);assert.equal(g.food,438);assert.equal(laneForKey('Space'),null);
});
test('v11 inhalation contracts the mist ring while filling the lungs and expands only the torso',async()=>{
  const {breathState}=require('./drift-core.js'),{breathColumn}=await import('./drift-media.js');let lastFill=-1,lastRing=2;
  for(let t=0;t<=2.7;t+=.01){const b=breathState(t);assert.ok(b.fill>=lastFill);assert.ok(b.ringScale<=lastRing);assert.equal(b.ready,b.fill>=.9);assert.equal(breathColumn(.05,b.expansion),1);assert.equal(breathColumn(.86,b.expansion),1);lastFill=b.fill;lastRing=b.ringScale;}
  const full=breathState(2.7);assert.equal(full.fill,1);assert.ok(full.ringScale<.15);assert.ok(breathColumn(.39,full.expansion)>1.21);assert.equal(breathColumn(.64,full.expansion),1);
  for(const t of [0,1,2.5,2.7,3.2]){const g=new DriftRun(track);g.startBreath();g.inhale(t);assert.equal(g.initialAir,Math.round(breathState(t).fill*100));}
});
test('v11 a missed breath relaxes continuously and a paused breath does not advance',()=>{
  const {breathState}=require('./drift-core.js');let last=1;
  for(let t=3.05;t<3.6;t+=.005){const b=breathState(t);assert.ok(b.fill<=last+1e-12);last=b.fill;}
  assert.ok(breathState(3.59999).fill<1e-7);assert.equal(breathState(3.6).fill,0);assert.equal(breathState(3.6).mist,0);
  const g=new DriftRun(track);g.startBreath();g.pause();g.update(99);assert.equal(g.status,'paused');assert.equal(g.time,0);g.resume();assert.equal(g.status,'breathing');
});
