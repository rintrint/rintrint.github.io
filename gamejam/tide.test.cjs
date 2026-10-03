const test=require('node:test'),assert=require('node:assert/strict');
const {JourneyRun}=require('./tide-core.js');
const tracks=require('./assets/journey-charts.json').tracks;
function run(track,level,skip=()=>false,air=100){const g=new JourneyRun(track,level);g.startBreath();g.inhale(2.7*air/100);for(const n of g.notes){if(skip(n,g))g.update(n.time+g.window+.001);else g.press(n.time);if(g.status!=='playing')break;}g.update(track.duration);return g;}
for(const track of tracks)for(const level of ['beginner','intermediate','expert']){
  test(`${track.id}/${level}: 438 fish, 146 per stage, onset-aligned and playable`,()=>{
    const notes=track.charts[level];assert.equal(notes.reduce((s,n)=>s+n.fish,0),438);
    for(let stage=0;stage<3;stage++)assert.equal(notes.filter(n=>n.stage===stage).reduce((s,n)=>s+n.fish,0),146);
    for(let i=1;i<notes.length;i++)assert.ok(notes[i].time-notes[i-1].time>.085);
    for(const n of notes.filter(n=>n.kind==='fish'))assert.ok(track.attacks.some(a=>a.time===n.time));
    const g=run(track,level);assert.equal(g.status,'won',JSON.stringify({time:g.time,reason:g.reason,food:g.food,air:g.air}));assert.equal(g.outcome,'friends');assert.equal(g.food,438);assert.equal(g.leaped,true);assert.equal(g.called,true);
  });
  test(`${track.id}/${level}: exactly 360 reaches friends, 359 rests`,()=>{
    for(const threshold of [359,360]){const g=run(track,level,(n,g)=>n.kind==='fish'&&g.food+n.fish>threshold);assert.equal(g.status,'won');assert.equal(g.outcome,g.food>=360?'friends':'rest');assert.ok(g.food<=threshold);}
  });
  test(`${track.id}/${level}: 90% initial breath survives perfect route`,()=>assert.equal(run(track,level,()=>false,90).status,'won'));
}
test('missing first surface really suffocates, fish cannot refill oxygen',()=>{const g=run(tracks[0],'beginner',n=>n.kind==='surface');assert.equal(g.status,'lost');assert.equal(g.reason,'oxygen');assert.equal(g.outcome,'hungryGhost');});
test('low initial breath is insufficient for first dive',()=>{const g=run(tracks[0],'beginner',()=>false,40);assert.equal(g.reason,'oxygen');});
test('missing mandatory leap cannot reach either survival ending',()=>{const g=run(tracks[0],'beginner',n=>n.kind==='leap');assert.equal(g.status,'lost');assert.equal(g.reason,'leap');});
test('exact death threshold is 240 fish',()=>{for(const food of [239,240]){const g=new JourneyRun(tracks[0]);g.status='playing';g.food=food;g.lose('oxygen');assert.equal(g.outcome,food===240?'angel':'hungryGhost');}});
test('evolution thresholds are 120 and 240; size grows every fish',()=>{const g=new JourneyRun(tracks[0]);for(const [food,form] of [[119,0],[120,1],[239,1],[240,2]]){g.food=food;assert.equal(g.form,form);}g.food=0;const a=g.growth;g.food=1;assert.ok(g.growth>a);});
test('paused run freezes oxygen, notes and food',()=>{const g=new JourneyRun(tracks[0]);g.startBreath();g.inhale(2.7);g.press(g.notes[0].time);g.pause();const before=[g.time,g.air,g.food,g.cursor];g.update(100);g.press(100);assert.deepEqual([g.time,g.air,g.food,g.cursor],before);g.resume();assert.equal(g.status,'playing');});
test('practice survives missed gates and flags completed route',()=>{const g=new JourneyRun(tracks[0],'beginner',true);g.startBreath();g.inhale(.1);g.update(g.track.duration);assert.equal(g.status,'won');assert.equal(g.outcome,'rest');});
test('offbeat spam never feeds or changes phase',()=>{const g=new JourneyRun(tracks[0]);g.startBreath();g.inhale(2.7);for(let t=0;t<2;t+=.1)g.press(t);assert.equal(g.food,0);assert.equal(g.phase,'shore');});
test('359 and 360 are exact survival-ending boundaries',()=>{for(const food of [359,360]){const g=new JourneyRun(tracks[0]);g.notes=[];g.status='playing';g.food=food;g.air=100;g.leaped=true;g.called=true;g.phase='shore';g.update(g.track.duration);assert.equal(g.outcome,food===360?'friends':'rest');}});
test('render updates at different frame rates preserve the complete run',()=>{
  for(const fps of [30,60,144]){const g=new JourneyRun(tracks[1],'expert');g.startBreath();g.inhale(2.7);let t=0;for(const n of g.notes){while(t+1/fps<n.time){t+=1/fps;g.update(t);}g.press(n.time);t=n.time;}g.update(g.track.duration);assert.equal(g.outcome,'friends');assert.equal(g.food,438);}
});
test('calibration section has at least six usable onset clicks in every arrangement',()=>{for(const t of tracks)for(const notes of Object.values(t.charts))assert.ok(notes.filter(n=>n.kind==='fish'&&n.time>=7&&n.time<22.9).length>=6);});
