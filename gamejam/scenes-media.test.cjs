const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=require('./assets/scenes/audio-manifest.json');
const media=import('./scenes-media.js'),audioModule=import('./scenes-audio.js');
test('team audio files match their recorded source hashes and valid cue offsets',()=>{
  for(const data of Object.values(manifest)){const bytes=fs.readFileSync(path.join(__dirname,'assets/scenes',data.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),data.sha256);assert.ok(data.lead>=0&&data.lead<data.duration);assert.ok(data.peak>0);}
  assert.equal(Object.keys(manifest).length,17);
});
test('breathing accuracy and all four endings choose distinct team recordings',async()=>{
  const {soundCues}=await media;
  for(const air of [89,90,100])assert.equal(soundCues({type:'breath',big:true},{initialAir:air})[0].key,air>=90?'breathGood':'breathBad');
  for(const [outcome,type,key] of [['friends','won','happy'],['rest','won','sad'],['angel','lost','angel'],['hungryGhost','lost','ghost']])assert.equal(soundCues({type},{outcome})[0].key,key);
});
test('paired rule events do not play two bites, calls, dives or breathing results',async()=>{
  const {soundCues}=await media;
  for(const kind of ['dive','leap','call'])assert.deepEqual(soundCues({type:'hit',note:{kind}},{}),[]);
  assert.deepEqual(soundCues({type:'breath',big:false},{}),[]);
  const eat=soundCues({type:'hit',note:{kind:'fish'}},{});assert.equal(eat.length,1);assert.equal(eat[0].key,'eat');assert.ok(eat[0].duration<=.3);
  const surface=soundCues({type:'hit',note:{kind:'surface'},result:'perfect'},{});assert.deepEqual(surface.map(c=>c.key),['surface','fisher','breathGood']);
  assert.deepEqual(soundCues({type:'miss',note:{kind:'leap'}},{status:'lost'}),[]);
});
test('hunger animation follows the three draft poses and reduced motion is static',async()=>{
  const {hungerPose}=await media;assert.deepEqual([0,.08,.16,.24].map(t=>hungerPose(t).frame),[0,1,2,0]);assert.equal(hungerPose(3).frame,0);assert.equal(hungerPose(7.08).cycle,1);
  for(const t of [0,.08,2,20]){assert.equal(hungerPose(t,true).frame,0);assert.equal(hungerPose(t,true).breath,0);}
});
class Param{constructor(){this.value=0;this.events=[];}setValueAtTime(...a){this.events.push(['set',...a]);}linearRampToValueAtTime(...a){this.events.push(['ramp',...a]);}setTargetAtTime(){}exponentialRampToValueAtTime(){}}
class AudioNode{constructor(){for(const k of ['gain','frequency','Q','threshold','knee','ratio','attack','release'])this[k]=new Param();}connect(){}disconnect(){this.disconnected=true;}start(...args){this.started=args;}stop(...args){this.stopped=args;}}
class Context{constructor(){this.currentTime=10;this.destination={};this.state='running';this.nodes=[];}createGain(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}createDynamicsCompressor(){return new AudioNode();}createBufferSource(){const n=new AudioNode();this.nodes.push(n);return n;}resume(){return Promise.resolve();}}
async function engine(){global.window={AudioContext:Context};const {ScenesAudio}=await audioModule;const a=new ScenesAudio();a.manifest=manifest;for(const [key,data] of Object.entries(manifest))a.samples.set(key,{duration:data.duration});return a;}
test('sample playback compensates silence and does not touch the song clock',async()=>{
  const a=await engine();a.anchor=4;a.startPosition=0;a.running=true;const before=a.time;
  const v=a.sample('eat',{duration:.3});assert.equal(v.node.started[1],manifest.eat.lead);assert.equal(v.node.stopped[0],10.3);assert.equal(a.time,before);assert.equal(a.running,true);
  assert.equal(a.sample('eat'),null);a.ctx.currentTime+=.1;assert.ok(a.sample('eat'));
});
test('pause/exit stops scheduled effect tails; mute prevents new samples',async()=>{
  const a=await engine();const v=a.sample('angel',{delay:1});a.stopEffects();assert.deepEqual(v.node.stopped,[]);assert.equal(a.voices.size,0);a.mute(true);assert.equal(a.sample('eat'),null);
});
test('starting a song cancels both active and pending menu music',async()=>{
  const a=await engine();a.loadSamples=()=>Promise.resolve();let release;a.decodeSample=()=>new Promise(r=>release=r);
  const pending=a.menu();await Promise.resolve();await Promise.resolve();a.buffer={duration:220};a.play(0);release();await pending;assert.equal(a.menuVoice,undefined);assert.equal(a.running,true);
  a.pause();a.menuLoad=Promise.resolve();await a.menu();assert.ok(a.menuVoice);const old=a.menuVoice;a.play(0);assert.equal(a.menuVoice,null);assert.deepEqual(old.node.stopped,[]);
});
