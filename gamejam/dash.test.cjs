const test=require('node:test'),assert=require('node:assert/strict');
const {DashGame}=require('./dash-core.js');
const chart=require('./assets/dash/chart.json');
const fixture=events=>({events,hazards:[],pickups:[],duration:10});
test('video transcription preserves 514 judgements and paired hold endpoints',()=>{
  assert.equal(chart.events.length,514);assert.equal(new Set(chart.events.map(n=>n.id)).size,514);
  assert.equal(chart.events.filter(n=>n.kind==='hold').length,15);
  assert.equal(chart.events.filter(n=>n.kind==='mash').length,2);
  chart.events.forEach((n,i)=>{assert.ok(Number.isFinite(n.time));assert.ok(n.time>=0&&n.time<chart.duration);if(i)assert.ok(n.time>=chart.events[i-1].time);if(n.kind==='hold'){const tail=chart.events.find(t=>t.id===n.tailId);assert.equal(tail.headId,n.id);assert.equal(tail.lane,n.lane);assert.ok(tail.time>n.time);}});
});
test('whole video chart autoplay completes at different frame rates without dropping simultaneous hits',()=>{
  for(const fps of [30,60,144]){const g=new DashGame(chart,{autoplay:true});for(let t=0;t<141;t+=1/fps)g.advance(t);assert.equal(g.status,'finished');assert.equal(g.combo,514);assert.equal(g.perfect,514);assert.equal(g.missed,0);assert.equal(g.accuracy,100);}
});
test('wrong lane cannot hit a note; rapid independent same-lane strokes can',()=>{
  const g=new DashGame(fixture([{id:1,time:1,lane:'air',kind:'tap'},{id:2,time:1.12,lane:'air',kind:'tap'}]));
  g.press('ground',.99);assert.equal(g.combo,0);g.press('air',1);g.press('air',1.12);assert.equal(g.combo,2);assert.equal(g.notes[0].state,'hit');
});
test('holding one lane permits opposite-lane taps and earns the tail once',()=>{
  const g=new DashGame(fixture([{id:1,time:1,lane:'ground',kind:'hold',end:3,tailId:3},{id:2,time:2,lane:'air',kind:'tap'},{id:3,time:3,lane:'ground',kind:'tail',headId:1}]));
  g.press('ground',1);g.press('air',2);g.release('air',2.05);g.advance(3);g.release('ground',3.02);assert.equal(g.combo,3);assert.equal(g.missed,0);
});
test('early hold release misses its tail and later key mashing cannot restore it',()=>{
  const g=new DashGame(fixture([{id:1,time:1,lane:'ground',kind:'hold',end:3,tailId:2},{id:2,time:3,lane:'ground',kind:'tail',headId:1}]));
  g.press('ground',1);g.release('ground',1.5);g.press('ground',2.9);g.advance(3.5);assert.equal(g.missed,1);assert.equal(g.perfect,1);
});
test('mash needs separate presses during its interval, not a held key',()=>{
  const c=fixture([{id:1,kind:'mash',lane:'both',start:1,time:3,required:6}]);
  const g=new DashGame(c);g.press('air',1);g.advance(3.1);assert.equal(g.missed,1);
  const h=new DashGame(c);for(let i=0;i<6;i++)h.press(i%2?'air':'ground',1+i*.2);h.advance(3);assert.equal(h.perfect,1);
});
test('air input avoids obstacles; ground attack does not cancel a jump',()=>{
  const c={...fixture([]),hazards:[{time:1,lane:'ground'}]};const g=new DashGame(c);g.press('air',.8);g.press('ground',.95);g.advance(1);assert.equal(g.health,200);
  const h=new DashGame(c);h.advance(1);assert.equal(h.health,170);
});
test('failure and practice are distinct; skipped sections do not count as misses',()=>{
  const c=fixture(Array.from({length:20},(_,i)=>({id:i,time:1+i*.2,lane:'air',kind:'tap'})));
  const g=new DashGame(c);g.advance(6);assert.equal(g.status,'lost');assert.equal(g.missed,10);
  const p=new DashGame(c,{practice:true,start:2});p.advance(10);assert.equal(p.status,'finished');assert.equal(p.missed,15);assert.equal(p.total,15);
});
