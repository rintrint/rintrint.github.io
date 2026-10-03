const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, SURFACE, SHORE } = require('./game-core.js');
const run = (g, seconds, input = {}) => { for (let i = 0; i < seconds * 20; i++) g.update(.05, input); };
const fresh = () => { const g = new Game(() => .5); g.reset(); return g; };

test('seal can walk into the sea, dive, surface and return to land', () => {
  const g=fresh();run(g,1.5,{right:true});assert.ok(!g.onLand);run(g,1,{down:true});assert.ok(g.depth>20);
  run(g,2,{up:true});assert.ok(g.atAir);run(g,2,{left:true});assert.ok(g.onLand);assert.ok(g.y<SURFACE);
});
test('oxygen depletion ends a dive, and deeper water costs more oxygen', () => {
  const shallow=fresh(),deep=fresh();shallow.x=deep.x=700;shallow.y=300;deep.y=650;
  run(shallow,2);run(deep,2);assert.ok(deep.oxygen<shallow.oxygen);
  run(deep,20);assert.equal(deep.status,'lost');assert.equal(deep.oxygen,0);
});
test('rhythmic breathing replenishes air only at surface and underwater boosts save oxygen', () => {
  const g=fresh();g.oxygen=50;g.elapsed=3.2;assert.equal(g.breathe(),true);assert.equal(g.oxygen,75);
  g.x=700;g.y=500;g.elapsed=6.4;g.boost=0;const before=g.oxygen;g.breathe();assert.equal(g.oxygen,before);assert.ok(g.boost>0);
  const slow=fresh();slow.x=g.x;slow.y=g.y;slow.oxygen=g.oxygen;run(g,.5);run(slow,.5);assert.ok(g.oxygen>slow.oxygen);
});
test('holding or spamming the rhythm action cannot stack instant breaths', () => {
  const g=fresh();g.oxygen=20;g.elapsed=3.2;g.breathe();g.breathe();g.breathe();assert.equal(g.oxygen,45);assert.equal(g.perfects,1);
});
test('fish are collected once per spawn and deeper fish give more food', () => {
  const g=fresh();g.x=800;g.y=500;g.fish=[{x:800,y:500,tier:2,value:3,active:true,phase:0,speed:0,direction:1}];
  g.update(.05);assert.equal(g.food,3);g.update(.05);assert.equal(g.food,3);assert.equal(g.fish[0].active,false);
});
test('three shore calls each cost five food and complete the game', () => {
  const g=fresh();g.call();assert.equal(g.companions,0);g.food=15;g.elapsed+=2;g.x=700;g.y=300;g.call();assert.equal(g.companions,0);
  g.x=200;g.y=224;for(let i=0;i<3;i++){g.elapsed+=2;g.call();}assert.equal(g.food,0);assert.equal(g.companions,3);assert.equal(g.status,'won');
});
test('pause freezes movement, oxygen, and beat timing; reset clears the whole run', () => {
  const g=fresh();g.x=700;g.y=500;g.status='paused';const elapsed=g.elapsed;run(g,10,{down:true});assert.equal(g.oxygen,100);assert.equal(g.y,500);assert.equal(g.elapsed,elapsed);
  g.food=14;g.companions=2;g.reset();assert.equal(g.food,0);assert.equal(g.companions,0);assert.equal(g.status,'playing');assert.ok(g.onLand);
});
test('underwater coastline blocks entry until the player surfaces', () => {
  const g=fresh();g.x=400;g.y=500;run(g,3,{left:true});assert.equal(g.x,SHORE);assert.ok(!g.onLand);
});

test('a complete trip can collect real fish and reunite all companions through normal controls', () => {
  let seed=42;
  const g=new Game(() => {seed=(seed*16807)%2147483647;return seed/2147483647;});g.reset();
  let returning=false, target=null;
  for(let frame=0;frame<20*360 && g.status==='playing';frame++) {
    if(g.onBeat)g.breathe();
    if(g.food>=5||g.oxygen<45)returning=true;
    let tx,ty;
    if(returning) {
      if(g.onLand){if(g.food>=5)g.call();if(g.oxygen>=95){returning=false;target=null;}tx=g.x;ty=g.y;}
      else if(!g.atAir){tx=g.x;ty=SURFACE;}
      else{tx=245;ty=SURFACE;}
    } else {
      if(g.onLand){tx=440;ty=SURFACE;}
      else {
        if(!target||!target.active)target=g.fish.filter(f=>f.active).sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)/a.value-Math.hypot(b.x-g.x,b.y-g.y)/b.value)[0];
        tx=target.x;ty=target.y;
      }
    }
    g.update(.05,{left:tx<g.x-5,right:tx>g.x+5,up:ty<g.y-5,down:ty>g.y+5});
  }
  assert.equal(g.status,'won');assert.equal(g.companions,3);assert.ok(g.collected>=15);assert.ok(g.maxDepth>10);assert.ok(g.duration<360);
});

test('3D swimming uses all three axes without granting a diagonal speed advantage', () => {
  const g=new Game(()=>.5,{dimensions:3});g.reset();g.x=700;g.y=450;g.fish=[];
  const start={x:g.x,y:g.y,z:g.z};run(g,.5,{right:true,down:true,forward:true});
  const distance=Math.hypot(g.x-start.x,g.y-start.y,g.z-start.z);
  assert.ok(Math.abs(distance-195*.5)<.001);assert.ok(g.z>0);
  run(g,2,{forward:true});assert.equal(g.z,130);run(g,3,{back:true});assert.equal(g.z,-130);
  g.reset();assert.equal(g.z,0);
});

test('3D fish cannot be eaten through the front/back axis', () => {
  const g=new Game(()=>.5,{dimensions:3});g.reset();g.x=800;g.y=500;g.z=0;
  g.fish=[{x:800,y:500,z:90,tier:2,value:3,active:true,phase:0,speed:0,direction:1}];
  g.update(.05);assert.equal(g.food,0);g.z=85;g.update(.05);assert.equal(g.food,3);
});

test('2D gameplay ignores third-axis controls', () => {
  const g=fresh();run(g,1,{forward:true});assert.equal(g.z,0);assert.equal(g.x,247);
});

test('3D journey can reach real fish, return to air and summon all three companions', () => {
  let seed=101;const g=new Game(()=>{seed=seed*16807%2147483647;return seed/2147483647;},{dimensions:3});g.reset();
  let returning=false,target=null;
  for(let frame=0;frame<20*360&&g.status==='playing';frame++){
    if(g.onBeat)g.breathe();if(g.food>=5||g.oxygen<45)returning=true;
    let tx=g.x,ty=g.y,tz=g.z;
    if(returning){
      if(g.onLand){if(g.food>=5)g.call();if(g.oxygen>=95){returning=false;target=null;}}
      else if(!g.atAir)ty=SURFACE;
      else tx=245;
    }else if(g.onLand)tx=440;
    else{
      if(!target||!target.active)target=g.fish.filter(f=>f.active).sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y,a.z-g.z)/a.value-Math.hypot(b.x-g.x,b.y-g.y,b.z-g.z)/b.value)[0];
      tx=target.x;ty=target.y;tz=target.z;
    }
    g.update(.05,{left:tx<g.x-5,right:tx>g.x+5,up:ty<g.y-5,down:ty>g.y+5,forward:tz>g.z+5,back:tz<g.z-5});
  }
  assert.equal(g.status,'won');assert.equal(g.companions,3);assert.ok(g.maxDepth>10);
});
