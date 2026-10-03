const test=require('node:test'),assert=require('node:assert/strict');
const {GuguRun,refillAir,airDisplay}=require('./gugu-core.js');
const {tracks}=require('./assets/floe/chart.json');

test('v13 shore taps approach full air with diminishing returns, never reaching or displaying 100%',()=>{
 let previousGain=Infinity,air=0;
 for(let i=0;i<10000;i++){
  const next=refillAir(air),gain=next-air;
  assert.ok(next>=air&&next<100);assert.ok(gain<=previousGain+1e-12);
  assert.notEqual(airDisplay(next),'100');previousGain=gain;air=next;
 }
 assert.equal(refillAir(50),56);assert.equal(refillAir(90),91.2);
 assert.ok(refillAir(99)<99.2);assert.equal(airDisplay(99.99999),'99.9');assert.equal(airDisplay(100),'100');
});

test('v13 nonlinear shore taps freeze while paused, stop at departure, and do not change the opening breath',()=>{
 const g=new GuguRun(tracks[0],'expert',true);g.startBreath();g.advanceBreath(2.7);g.inhale();
 assert.equal(g.initialAir,100);
 for(const n of g.notes){g.press(n.lane,g.noteTime(n));if(n.kind==='surface')break;}
 const first=g.air;g.press('upper',g.time+.001);const second=g.air;
 assert.equal(second,refillAir(first));g.press('upper',g.time+.001);assert.equal(g.air,refillAir(second));
 const air=g.air,taps=g.breathTaps;g.pause();g.tapBreath();assert.equal(g.air,air);assert.equal(g.breathTaps,taps);g.resume();
 g.update(g.noteTime(g.departures[g.departureCursor]));const before=g.air;g.tapBreath();assert.equal(g.air,before);assert.equal(g.phase,'underwater');
});

test('v13 head gradients exclude all three torsos and bite flippers while blending continuously at the neck',async()=>{
 const {SWIM_HEADS,PORTRAIT_HEAD,biteHead,headMask,CYANOSIS}=await import('./gugu-anatomy.js');
 for(const head of [...SWIM_HEADS,PORTRAIT_HEAD,...Array.from({length:6},(_,i)=>biteHead(i))]){
  for(const x of [0,.2,.4,head.neck[0]])for(const y of [0,.3,.6,1])assert.equal(headMask(x,y,head),0);
  const [a,b]=head.neck;assert.ok(headMask((a+b)/2,.4,head)>.4);assert.ok(headMask((a+b)/2,.4,head)<.6);
  assert.ok(headMask(b,.4,head)>.9);
  if(head.bottom)assert.equal(headMask(.9,.9,head),0);
 }
 assert.ok(CYANOSIS[0]>CYANOSIS[1]&&CYANOSIS[2]>CYANOSIS[0],'muted violet, not blue-only dye');
});

test('v13 inhalation expands the abdomen downward while the spine, head and tail stay fixed',async()=>{
 const {bellyY}=await import('./gugu-anatomy.js');
 for(const expansion of [0,.25,.5,.75,1]){
  for(const [x,y] of [[.42,.43],[.65,.30],[.84,.5],[.92,.7],[.1,.75]])assert.equal(bellyY(x,y,expansion),y);
 }
 const belly=[0,.25,.5,.75,1].map(e=>bellyY(.42,.85,e));
 for(let i=1;i<belly.length;i++)assert.ok(belly[i]>belly[i-1]);
 assert.ok(belly.at(-1)-belly[0]>.08);
});
