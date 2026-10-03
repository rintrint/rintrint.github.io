const test=require('node:test'),assert=require('node:assert/strict');
require('./tide-core.js');require('./pulse-core.js');const {DuetRun,speedValue}=require('./duet-core.js');
const track=require('./assets/pulse/chart.json').tracks[0];
const start=(level='expert',practice=false)=>{const g=new DuetRun(track,level,practice);g.startBreath();g.inhale(2.7);return g;};
for(const level of ['beginner','intermediate','expert']){
  test(`v10/${level}: two-lane full run is playable at 30/60/144 fps`,()=>{
    for(const fps of [30,60,144]){const g=start(level);for(const n of g.notes){for(let t=g.time+1/fps;t<n.time;t+=1/fps)g.update(t);g.press(n.lane,n.time);}assert.equal(g.status,'won');assert.equal(g.food,438);assert.equal(g.outcome,'friends');assert.equal(g.accuracy,100);assert.equal(g.maxCombo,g.notes.length);assert.equal(g.stability,100);assert.deepEqual(g.stageFood,[146,146,146]);}
  });
  test(`v10/${level}: both lanes occur without changing version-nine timestamps`,()=>{
    const g=start(level);assert.deepEqual(g.notes.map(n=>n.time),track.charts[level].map(n=>n.time));for(const lane of ['upper','lower'])assert.ok(g.notes.filter(n=>n.kind==='fish'&&n.lane===lane).length>20);
  });
}
test('v10 wrong lane breaks combo and never awards the other lane fish',()=>{
  const g=start();g.press(g.target.lane,g.target.time);const n=g.target,food=g.food;g.press(n.lane==='upper'?'lower':'upper',n.time);assert.equal(n.result,null);assert.equal(g.food,food);assert.equal(g.feedback.reason,'lane');assert.equal(g.combo,0);assert.equal(g.stability,91);
});
test('v10 too-early hit is an irreversible Miss, even if pressed correctly afterward',()=>{
  const g=start();g.press(g.target.lane,g.target.time);const n=g.target;g.press(n.lane,n.time-g.window-.04);assert.equal(n.result,'miss');assert.equal(g.feedback.reason,'early');assert.equal(g.food,0);assert.equal(g.counts.miss,1);g.press(n.lane,n.time);assert.equal(n.result,'miss');assert.equal(g.food,0);
});
test('v10 empty input and duplicate input are not free',()=>{
  const g=start();g.press('upper',1);assert.equal(g.feedback.reason,'empty');assert.equal(g.stability,91);g.press(g.target.lane,g.target.time);const score=g.score;g.press('lower',g.time);assert.equal(g.score,score);assert.equal(g.combo,0);assert.equal(g.overpresses,2);
});
for(const interval of [.03,.05,.1,.15])test(`v10 ${Math.round(1/interval)} Hz mashing cannot clear, even alternating lanes`,()=>{
  for(const mode of ['one','alternating','both']){const g=start();g.press(g.target.lane,g.target.time);let i=0;for(let t=g.time+.001;t<track.duration&&g.status==='playing';t+=interval,i++){g.press(mode==='alternating'&&i%2?'upper':'lower',t);if(mode==='both')g.press('upper',t);}assert.equal(g.status,'lost');assert.ok(g.time<15);assert.ok(g.food<30);}
});
test('v10 pressing both keys on every correct beat still loses',()=>{
  const g=start();for(const n of g.notes){if(g.status!=='playing')break;g.press(n.lane,n.time);g.press(n.lane==='upper'?'lower':'upper',n.time);}assert.equal(g.status,'lost');assert.ok(g.food<100);
});
test('v10 practice keeps penalties and clearly remains a practice run',()=>{
  const g=start('expert',true);for(let t=0;t<3;t+=.05)g.press('upper',t);assert.equal(g.status,'playing');assert.equal(g.stability,0);assert.ok(g.counts.miss>40);assert.equal(g.practice,true);
});
test('v10 speed range affects scrolling only, with an invariant contact timestamp',async()=>{
  const {duetGeometry}=await import('./duet-view.js');for(const width of [390,1280]){const base=duetGeometry(width,844,.82);for(const rate of [.1,.5,1,2]){const geo=duetGeometry(width,844,.82,rate);assert.equal(geo.speed,base.speed*rate);assert.equal(geo.x+(12-12)*geo.speed,base.x);assert.ok(geo.upper<geo.lower);}}
  assert.equal(speedValue(-1),.1);assert.equal(speedValue(9),2);assert.equal(speedValue('bad'),1);assert.equal(speedValue(1.26),1.3);
});
test('v10 lane motion and queued eating remain continuous across fast successive hits',async()=>{
  const {DuetMotion}=await import('./duet-motion.js');const m=new DuetMotion();m.hit('upper',0,true);assert.equal(m.y,1);m.advance(.1);const y=m.y,oldEnd=m.bites[0].end;m.hit('lower',.1,true);assert.equal(m.y,y);assert.equal(m.bites[0].end,oldEnd);assert.ok(m.bites[1].start>=oldEnd);const frames=new Set();for(let t=.1;t<.6;t+=.01){m.advance(t);frames.add(m.frame);}for(let f=1;f<=5;f++)assert.ok(frames.has(f));assert.ok(m.y>.9);
});
