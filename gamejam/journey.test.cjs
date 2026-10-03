const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Journey,CYCLE,SURFACE,HOLES}=require('./journey-core.js');
const advance=(g,seconds,input={})=>{for(let elapsed=0;elapsed<seconds-1e-7;elapsed+=.025)g.update(Math.min(.025,seconds-elapsed),input);};
const fresh=()=>{const g=new Journey();g.reset();return g;};
function onBeat(g){g.inhale();const end=(Math.floor((g.time+1e-6)/CYCLE)+1)*CYCLE;advance(g,end-g.time);return g.release();}

test('opening requires two full rhythmic breaths and an additional precise dive',()=>{
  const g=fresh();assert.equal(g.oxygen,20);assert.equal(g.stage,'breathe');
  assert.equal(onBeat(g),true);assert.equal(g.oxygen,60);assert.equal(g.stage,'breathe');
  onBeat(g);assert.equal(g.oxygen,100);assert.equal(g.stage,'entry');
  g.inhale();advance(g,1.2);assert.equal(g.release(),false);assert.equal(g.transition,null);
  onBeat(g);assert.equal(g.transition.type,'dive');advance(g,1);assert.equal(g.stage,'swim');
});
test('ordinary ice cannot be surfaced through; correct position and rhythm are both required',()=>{
  const g=fresh();g.stage='swim';g.oxygen=100;g.x=900;g.y=SURFACE+70;
  advance(g,.5,{up:true});assert.equal(g.y,SURFACE+62);onBeat(g);assert.equal(g.checkpoint,0);assert.equal(g.stage,'swim');
  g.x=HOLES[1];g.y=SURFACE+100;g.inhale();advance(g,.5);assert.equal(g.release(),false);assert.equal(g.transition,null);
  onBeat(g);assert.equal(g.transition.type,'surface');advance(g,1.2);assert.equal(g.stage,'rest');assert.equal(g.checkpoint,1);assert.ok(1 in g.fisherKnocks);
});
test('rest breathing refills air without bypassing the next timed dive',()=>{
  const g=fresh();g.stage='rest';g.checkpoint=1;g.x=HOLES[1];g.oxygen=18;onBeat(g);
  assert.equal(g.oxygen,78);assert.equal(g.stage,'entry');onBeat(g);advance(g,1);assert.equal(g.stage,'swim');
});
test('large leap needs a long precise inhale and records success only on landing',()=>{
  const g=fresh();g.stage='bigBreath';g.checkpoint=2;g.x=HOLES[2];
  g.time=CYCLE-.15;g.inhale();advance(g,.15);assert.equal(g.release(),false);assert.equal(g.jumpDone,false);
  onBeat(g);assert.equal(g.transition.type,'greatLeap');assert.equal(g.jumpDone,false);
  advance(g,1);assert.ok(g.y<SURFACE);advance(g,1.2);assert.equal(g.jumpDone,true);assert.equal(g.checkpoint,3);assert.equal(g.stage,'swim');
});
test('depth affects oxygen; suffocation is terminal and surface ice does not refill it',()=>{
  const shallow=fresh(),deep=fresh();for(const g of [shallow,deep]){g.stage='swim';g.x=900;g.oxygen=60;}shallow.y=SURFACE+62;deep.y=740;
  advance(shallow,2);advance(deep,2);assert.ok(deep.oxygen<shallow.oxygen);assert.ok(shallow.oxygen<60);
  advance(deep,20);assert.equal(deep.status,'lost');assert.equal(deep.oxygen,0);const x=deep.x;advance(deep,1,{right:true});assert.equal(deep.x,x);
});
test('food alone cannot unlock the ending without the large leap',()=>{
  const g=fresh();g.stage='swim';g.checkpoint=3;g.x=HOLES[4];g.y=SURFACE+90;g.food=30;g.oxygen=100;onBeat(g);assert.equal(g.stage,'swim');assert.equal(g.transition,null);
  g.stage='calling';assert.equal(g.call(),false);g.jumpDone=true;assert.equal(g.call(),true);advance(g,8);assert.equal(g.status,'won');
});
test('pause freezes the story and discards a held breath',()=>{
  const g=fresh();g.inhale();advance(g,1);g.pause();const time=g.time;advance(g,10);assert.equal(g.time,time);assert.equal(g.holding,false);g.pause();assert.equal(g.status,'playing');
});
test('deeper fish count for more food and cannot be collected twice',()=>{
  const g=fresh();g.stage='swim';g.oxygen=100;const f=g.fish.find(f=>f.tier===2);g.x=f.x;g.y=f.y;advance(g,.05);assert.ok(g.food>=3);assert.equal(f.active,false);const food=g.food;advance(g,.05);assert.equal(g.food,food);
});
test('entire story is completable with timed breaths, swimming, both fishers, leap and final call',()=>{
  const g=fresh();let target=null;
  for(let i=0;i<20000&&g.status==='playing';i++){
    const s=g.stage;
    if(g.transition){g.update(.025);continue;}
    if(s==='calling'){g.call();continue;}
    if(s==='ending'){g.update(.025);continue;}
    if(s!=='swim'){
      if(!g.holding)g.inhale();
      if(g.holding&&g.time-g.holdStart>=2.05&&g.precise)g.release();
      g.update(.025);continue;
    }
    let tx,ty;
    const returnNow=g.food>=g.goal||g.oxygen<45;
    if(returnNow){tx=g.targetHole;ty=SURFACE+90;}
    else{
      if(!target||!target.active||target.x<HOLES[g.checkpoint])target=g.fish.filter(f=>f.active&&f.x>HOLES[g.checkpoint]&&f.x<g.targetHole).sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)/a.value-Math.hypot(b.x-g.x,b.y-g.y)/b.value)[0];
      if(!target){tx=g.targetHole;ty=SURFACE+90;}else{tx=target.x;ty=target.y;}
    }
    if(g.nearHole&&(returnNow||!target)){
      if(!g.holding)g.inhale();if(g.holding&&g.time-g.holdStart>.5&&g.precise)g.release();
    }
    g.update(.025,{left:tx<g.x-5,right:tx>g.x+5,up:ty<g.y-5,down:ty>g.y+5});
  }
  assert.equal(g.status,'won');assert.equal(g.jumpDone,true);assert.ok(g.food>=12);assert.ok(1 in g.fisherKnocks);assert.ok(2 in g.fisherKnocks);assert.equal(g.called,true);
});
