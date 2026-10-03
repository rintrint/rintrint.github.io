const test=require('node:test'),assert=require('node:assert/strict');
const {RhythmRun,DIFFICULTIES,SealMotion}=require('./rhythm-core.js');
const charts=require('./assets/music-charts.json');
const track={duration:12,notes:[1,2,3,4,5].map(time=>({time})),bpm:60};
function run(practice=false){const g=new RhythmRun(track,'rings',practice);g.start();return g;}
test('countdown and ready do not accept input',()=>{const g=new RhythmRun(track);assert.equal(g.press(1),null);g.start();g.press(-.1);assert.equal(g.hits,0);assert.equal(g.air,100);});
test('timing windows distinguish perfect, good and soft',()=>{for(const [error,result] of [[0,'perfect'],[.07,'perfect'],[.12,'good'],[.18,'soft'],[-.18,'soft']]){const g=run();assert.equal(g.press(1+error),result);}});
test('early press does not consume the future note',()=>{const g=run();g.press(.7);assert.equal(g.notes[0].result,null);assert.equal(g.press(1),'perfect');});
test('duplicate and held-key style inputs cannot score a note twice',()=>{const g=run();g.press(1);g.press(1.01);g.press(1.15);assert.equal(g.hits,1);assert.equal(g.food,1);});
test('long frame skips judge all overdue notes exactly once',()=>{const g=run();g.update(4.3);g.update(4.3);assert.equal(g.misses,4);assert.equal(g.air,76);});
test('pause rejects input and time changes, then resumes',()=>{const g=run();g.update(.5);g.pause();g.update(5);g.press(1);assert.equal(g.time,.5);assert.equal(g.hits,0);g.resume();assert.equal(g.press(1),'perfect');});
test('miss breaks combo and a hit restores breathing energy',()=>{const g=run();g.press(1);g.press(2);g.update(3.3);assert.equal(g.combo,0);assert.equal(g.maxCombo,2);assert.equal(g.air,94);g.press(4);assert.equal(g.air,97);});
test('failed run stops further judgement',()=>{const g=run();g.air=6;g.update(5.5);assert.equal(g.status,'lost');assert.equal(g.outcome,'hungryGhost');assert.equal(g.misses,1);g.press(6);assert.equal(g.misses,1);});
test('well-fed failure becomes angel',()=>{const g=run();g.food=12;g.air=6;g.update(1.3);assert.equal(g.outcome,'angel');});
test('practice widens timing and never loses',()=>{const g=run(true);g.air=1;assert.equal(g.press(1.22),'soft');g.update(11);assert.equal(g.status,'playing');assert.equal(g.air,1);g.update(12);assert.equal(g.status,'won');});
test('song tail must finish before ending, and ending only emits once',()=>{const g=run(true);g.update(11.99);assert.equal(g.status,'playing');g.update(12);g.update(14);assert.equal(g.events.filter(e=>e.type==='won').length,1);});
test('runner jump is vertical animation state, judged using same music clock',()=>{const g=new RhythmRun(track,'runner');g.start();g.press(1);assert.equal(g.lastJump.good,true);assert.ok(g.lastJump.duration>=.48);assert.equal(g.lastJump.at,1);});
test('food gradually grows seal through three sizes',()=>{const g=run();let previous=g.growth;for(let i=0;i<12;i++){g.food++;assert.ok(g.growth>previous);previous=g.growth;}assert.equal(g.form,2);assert.equal(g.growth,1.45);});
test('offbeat spam never replaces a successful jump or its immediate feedback',()=>{const g=run();g.press(1);const jump=g.lastJump,feedback=g.feedback;g.press(1.12);g.press(1.24);g.press(1.36);assert.strictEqual(g.lastJump,jump);assert.strictEqual(g.feedback,feedback);assert.equal(g.hits,1);assert.equal(g.food,1);});
test('successful notes carry one fish and visible growth in every difficulty',()=>{for(const level of Object.keys(DIFFICULTIES)){const g=new RhythmRun(charts.tracks[0],'rings',false,level);g.start();g.press(g.notes[0].time);const hit=g.events.find(e=>e.type==='hit');assert.equal(hit.food,1);assert.ok(hit.growth>=1.018);g.food=12;assert.equal(g.form,1);g.food=24;assert.equal(g.growth,1.45);}});
test('airborne input adds force without snapping position, speed or posture',()=>{const m=new SealMotion(0);m.hit();m.advance(.18);const before=[m.height,m.velocity,m.angle,m.squash];assert.ok(m.height>.05);m.hit(true);assert.deepEqual([m.height,m.velocity,m.angle,m.squash],before);m.advance(.19);assert.ok(Math.abs(m.height-before[0])<.015);});
test('gravity produces one contact and a damped landing recovery',()=>{const m=new SealMotion(0);m.hit();m.advance(.3);assert.ok(m.height>.07);m.advance(.8);assert.equal(m.height,0);assert.equal(m.events.length,1);assert.equal(m.events[0].type,'landing');m.advance(3);assert.equal(m.events.length,1);assert.ok(Math.abs(m.squash)<.0001);assert.ok(Math.abs(m.angle)<.0001);});
test('dense successful beats stay bounded and settle after the last hit',()=>{const m=new SealMotion(0);let peak=0;for(let i=0;i<80;i++){m.advance(i*.12);m.hit(i%4===0);peak=Math.max(peak,m.height);assert.ok(Number.isFinite(m.velocity));}assert.ok(peak>.05&&peak<.26);m.advance(13);assert.equal(m.height,0);assert.equal(m.velocity,0);});
test('motion freezes at the same clock and remains consistent at 30/60/144 Hz',()=>{
 function simulate(fps){const m=new SealMotion(0),hits=[0,.19,.43,.82];let i=0;for(let frame=0;frame<=fps;frame++){const time=frame/fps;while(i<hits.length&&hits[i]<=time){m.advance(hits[i++]);m.hit();}m.advance(time);}return m;}
 const reference=simulate(144);for(const fps of [30,60]){const m=simulate(fps);assert.ok(Math.abs(m.height-reference.height)<.001);assert.ok(Math.abs(m.velocity-reference.velocity)<.005);}
 const before=JSON.stringify(reference);reference.advance(1);reference.advance(.9);assert.equal(JSON.stringify(reference),before);
});
test('a swallowed fish grows the displayed body gradually and never shrinks it',()=>{const m=new SealMotion(0);m.eat(1.225);assert.equal(m.growth,1);m.advance(.1);assert.ok(m.growth>1&&m.growth<1.225);m.eat(1.1);assert.equal(m.targetGrowth,1.225);m.advance(2);assert.ok(Math.abs(m.growth-1.225)<.001);});
for(const song of charts.tracks){
 test(`${song.title}: valid chart and packaged audio`,()=>{assert.ok(song.duration>200);assert.ok(song.notes.length>100);assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,song.src)).size>1000000);let last=0;for(const note of song.notes){assert.ok(note.time>last+.25);assert.ok(note.time<song.duration);last=note.time;}assert.ok(song.energy.every(e=>Number.isFinite(e)&&e>=0&&e<=1));});
 for(const mode of ['rings','runner'])test(`${song.title}: full ${mode} run succeeds on every charted beat`,()=>{const g=new RhythmRun(song,mode);g.start();for(const note of song.notes){assert.equal(g.press(note.time),'perfect');g.update(note.time+.2);}g.update(song.duration);assert.equal(g.status,'won');assert.equal(g.hits,song.notes.length);assert.equal(g.accuracy,100);assert.equal(g.air,100);assert.equal(g.form,2);});
}
test('same input offset is forgiving for beginner and too early for expert',()=>{
 const easy=new RhythmRun(track,'rings',false,'beginner'),hard=new RhythmRun(track,'rings',false,'expert');easy.start();hard.start();
 assert.equal(easy.press(.80),'soft');assert.equal(hard.press(.80),null);assert.equal(hard.notes[0].result,null);
 assert.equal(hard.press(1),'perfect');assert.ok(easy.profile.approach>hard.profile.approach);assert.ok(easy.profile.speed<hard.profile.speed);
});
test('expert misses are more costly and repeated spam cannot bypass judgement',()=>{
 const easy=new RhythmRun(track,'runner',false,'beginner'),hard=new RhythmRun(track,'runner',false,'expert');easy.start();hard.start();easy.update(1.5);hard.update(1.5);
 assert.equal(easy.air,96);assert.equal(hard.air,92);hard.press(2);for(let i=1;i<10;i++)hard.press(2+i*.005);assert.equal(hard.hits,1);
});
test('unknown difficulty falls back safely without changing the source chart',()=>{
 const source=JSON.stringify(charts);const g=new RhythmRun(charts.tracks[0],'runner',false,'invalid');g.start();g.press(g.notes[0].time);g.reset();
 assert.equal(g.difficulty,'intermediate');assert.equal(g.hits,0);assert.ok(g.notes.every(n=>n.result===null));assert.equal(JSON.stringify(charts),source);
});
for(const song of charts.tracks){
 test(`${song.title}: three distinct arrangements with playable burst spacing`,()=>{
   const {beginner,intermediate,expert}=song.charts;
   assert.ok(intermediate.length>beginner.length*2);assert.ok(expert.length>intermediate.length*2);
   for(const notes of Object.values(song.charts)){let last=0;for(const n of notes){assert.ok(n.time-last>.11);assert.ok(n.time>=5&&n.time<song.duration-3);last=n.time;}}
   assert.ok(expert.some(n=>n.subdivision===1));assert.ok(intermediate.some(n=>n.subdivision===2));assert.ok(beginner.every(n=>n.subdivision===0));
 });
 for(const level of Object.keys(DIFFICULTIES)){
  test(`${song.title}: ${level} practice remains playable through every miss`,()=>{const g=new RhythmRun(song,'runner',true,level);g.start();g.update(song.duration);assert.equal(g.status,'won');assert.equal(g.air,1);assert.equal(g.misses,g.notes.length);});
  for(const mode of ['rings','runner','sketch'])test(`${song.title}: full ${level} ${mode} chart clears with normal timed presses`,()=>{
    const g=new RhythmRun(song,mode,false,level);g.start();
    for(let i=0;i<g.notes.length;i++){const n=g.notes[i];assert.equal(g.press(n.time),'perfect');const next=g.notes[i+1];if(next)assert.ok(g.lastJump.duration<next.time-n.time+.001);g.update(n.time+.01);}
    g.update(song.duration);assert.equal(g.status,'won');assert.equal(g.maxCombo,g.notes.length);assert.equal(g.accuracy,100);assert.equal(g.air,100);
  });
 }
}
