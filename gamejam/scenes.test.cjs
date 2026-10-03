const test=require('node:test'),assert=require('node:assert/strict');
const {JourneyRun}=require('./tide-core.js');
const {screenFor,SceneFlow}=require('./scenes-state.js');
const tracks=require('./assets/journey-charts.json').tracks;

test('four-screen camera follows real breathing, diving and ending states',()=>{
  const g=new JourneyRun(tracks[0]),flow=new SceneFlow();
  assert.equal(flow.update(g,.1),'start');g.startBreath();assert.equal(flow.update(g,.1),'breath');
  g.inhale(2.7);assert.equal(flow.update(g,.1),'breath');g.press(g.notes[0].time);assert.equal(flow.update(g,.1),'dive');
  g.pause();const elapsed=flow.elapsed;assert.equal(flow.update(g,.5),'dive');assert.equal(flow.elapsed,elapsed);
  g.resume();g.lose('oxygen');assert.equal(flow.update(g,.1),'ending');
});
test('pausing during initial breathing does not select the underwater camera',()=>{
  const g=new JourneyRun(tracks[0]);g.startBreath();g.pause();assert.equal(screenFor(g),'breath');
});
for(const track of tracks)for(const level of ['beginner','intermediate','expert']){
  test(`${track.id}/${level}: camera changes never alter music time, oxygen or judgement`,()=>{
    const g=new JourneyRun(track,level),flow=new SceneFlow(),visited=new Set([flow.update(g,0)]);
    g.startBreath();visited.add(flow.update(g,.01));g.inhale(2.7);
    for(const n of g.notes){g.press(n.time);const state=JSON.stringify(g);for(let i=0;i<12;i++)visited.add(flow.update(g,1/60));assert.equal(JSON.stringify(g),state);}
    g.update(track.duration);visited.add(flow.update(g,.01));assert.deepEqual([...visited],['start','breath','dive','ending']);assert.equal(g.food,438);assert.equal(g.outcome,'friends');
  });
}
test('all four ending outcomes select the ending screen',()=>{
  for(const outcome of ['friends','rest','hungryGhost','angel'])assert.equal(screenFor({status:['friends','rest'].includes(outcome)?'won':'lost',outcome}),'ending');
});
