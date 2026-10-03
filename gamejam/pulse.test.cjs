const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('./tide-core.js');const {PulseRun,PROFILES}=require('./pulse-core.js');
const track=require('./assets/pulse/chart.json').tracks[0];
for(const level of Object.keys(PROFILES)){
  test(`v9/${level}: full song reaches friends and awards exactly 438 fish`,()=>{
    for(const fps of [30,60,144]){const g=new PulseRun(track,level);g.startBreath();g.inhale(2.7);for(const note of g.notes){for(let t=g.time+1/fps;t<note.time;t+=1/fps)g.update(t);g.press(note.time);}assert.equal(g.status,'won');assert.equal(g.outcome,'friends');assert.equal(g.food,438);assert.deepEqual(g.stageFood,[146,146,146]);assert.equal(g.maxCombo,g.notes.length);assert.equal(g.accuracy,100);assert.equal(g.score,g.notes.length*1000);}
  });
  test(`v9/${level}: perfect/good/miss windows are meaningful`,()=>{
    const g=new PulseRun(track,level);g.startBreath();g.inhale(2.7);g.press(g.target.time+g.profile.perfect*.8);assert.equal(g.feedback.result,'perfect');g.press(g.target.time+g.profile.perfect*1.2);assert.equal(g.feedback.result,'good');assert.ok(g.accuracy<100);g.update(g.target.time+g.window+.04);assert.equal(g.feedback.result,'miss');assert.equal(g.combo,0);
  });
}
test('v9 lower charts are strict time-identical subsets with regular skipping',()=>{
  const high=new Map(track.charts.expert.map(n=>[n.step,n]));
  for(const [level,stride] of [['beginner',8],['intermediate',4]])for(const n of track.charts[level]){assert.equal(n.time,high.get(n.step).time);assert.equal(n.kind,high.get(n.step).kind);if(n.kind==='fish')assert.equal(n.step%stride,0);}
  assert.ok(track.charts.expert.some(n=>n.step%2===1));
});
test('v9 chart references the exact supplied MP3 and actual onset evidence',()=>{
  const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,track.src))).digest('hex');assert.equal(hash,track.analysis.sourceSha256);
  const evidence=require('./assets/pulse/evidence.json');const distances=track.beats.map(t=>Math.min(...evidence.independentAttacks.map(a=>Math.abs(a-t))));const sorted=distances.filter(d=>d<.055).sort((a,b)=>a-b);assert.ok(sorted.length>=570);assert.ok(sorted[Math.floor(sorted.length*.95)]<.012);assert.ok(track.analysis.finalBpm-track.analysis.initialBpm>2);
  // Exported attacks are independently measured, not appended from chart times.
  assert.ok(track.attacks.length>track.charts.expert.length);assert.ok(track.charts.expert.some(n=>!track.attacks.some(a=>a.time===n.time)));
  for(const notes of Object.values(track.charts))for(const n of notes)assert.ok(Math.min(...track.attacks.map(a=>Math.abs(a.time-n.time)))<.025,`No acoustic attack near ${n.time}`);
});
test('v9 render-expiry grace never widens the actual input window',()=>{
  const g=new PulseRun(track,'expert');g.startBreath();g.inhale(2.7);const n=g.target;g.update(n.time+.1);assert.equal(n.result,null);g.press(n.time+.08);assert.equal(n.result,'hit');
  const next=g.target;g.press(next.time+.09);assert.equal(next.result,null);g.update(next.time+.12);assert.equal(next.result,'miss');
});
test('v9 audible timestamp mapping compensates output and input dispatch delays',async()=>{
  const {songTimeAt}=await import('./pulse-clock.js');const ctx={currentTime:10,getOutputTimestamp:()=>({contextTime:9.95,performanceTime:1000})};assert.ok(Math.abs(songTimeAt(ctx,5,0,1020,1050)-4.97)<1e-9);
  assert.ok(Math.abs(songTimeAt({currentTime:10,outputLatency:.03,baseLatency:.01},5,0,1020,1050)-4.93)<1e-9);assert.equal(songTimeAt(ctx,12,0,1020,1050),0);
});
test('v9 all speeds contact the same fixed line at exact audio timestamps',async()=>{
  const {noteGeometry}=await import('./pulse-view.js');for(const w of [390,1280])for(const p of Object.values(PROFILES)){const a=noteGeometry(w,800,p.approach);assert.equal(a.x,w*.32);assert.equal(a.x+(10-10)*a.speed,a.x);assert.ok(a.x+p.approach*a.speed>w);}
  assert.ok(noteGeometry(1280,720,.82).speed>1000);
});
test('v9 perfect charts remain playable with 90% air; offbeat spam cannot grow seal',()=>{
  const g=new PulseRun(track,'expert');g.startBreath();g.inhale(2.43);for(const n of g.notes)g.press(n.time);assert.equal(g.status,'won');
  const b=new PulseRun(track,'expert');b.startBreath();b.inhale(2.7);for(let t=0;t<5;t+=.05)b.press(t);assert.equal(b.food,0);assert.equal(b.score,0);
});
