/* Breath — original procedural art, animation and audio. No assets or build step required. */
(() => {
  'use strict';
  const { Game, W, H, SURFACE, SHORE, clamp } = BreathGame;
  const is3D = typeof window.Breath3D === 'function';
  const game = new Game(Math.random, { dimensions: is3D ? 3 : 2 });
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas'), ctx = is3D ? null : canvas.getContext('2d');
  const stage = $('gameStage'), input = {};
  const scene3D = is3D ? new window.Breath3D(canvas) : null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let viewWidth = W, camera = 0, visualTime = 0, lastTime = 0, feedbackTimer = 0;
  let particles = [], callWaves = [], audio = null, audioEnabled = false, audioFailed = false;
  let canvasScale = 1, demoTime = 0;

  // Seeded decoration keeps the little bay consistent across playthroughs.
  let seed = 318;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const motes = Array.from({ length: 75 }, () => ({ x: random() * W, y: 285 + random() * 470, r: .7 + random() * 1.8, phase: random() * 7 }));
  const plants = Array.from({ length: 38 }, (_, i) => ({ x: i * 43 + random() * 25, y: 750 + random() * 25, h: 42 + random() * 112, phase: random() * 8, wide: 5 + random() * 8 }));
  const ripples = Array.from({ length: 36 }, () => ({ x: random() * W, y: 261 + random() * 67, w: 7 + random() * 70, phase: random() * 8 }));
  const grain = document.createElement('canvas'); grain.width = 180; grain.height = 180;
  const gx = grain.getContext('2d'), pixels = gx.createImageData(180, 180);
  for (let i = 0; i < pixels.data.length; i += 4) { const v = random() > .5 ? 255 : 0; pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = v; pixels.data[i+3] = random() * 13; }
  gx.putImageData(pixels, 0, 0);
  const grainPattern = ctx?.createPattern(grain, 'repeat');

  function resize() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (scene3D) { scene3D.resize(r.width, r.height, dpr); return; }
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    canvasScale = canvas.height / H; viewWidth = canvas.width / canvasScale;
    camera = clamp((game.status === 'ready' ? 860 : game.x) - viewWidth * .43, 0, Math.max(0, W - viewWidth));
  }
  new ResizeObserver(resize).observe(stage);

  function path(fill, commands, stroke, width = 1) {
    ctx.beginPath(); commands(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function ellipse(x,y,rx,ry,fill,rotation=0) { ctx.beginPath(); ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2); ctx.fillStyle=fill;ctx.fill(); }

  function background(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    sky.addColorStop(0, '#dbe4cf'); sky.addColorStop(1, '#e9e7cb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(1035, 85, 3, 1035, 85, 135);
    sun.addColorStop(0, '#fff9dbb0'); sun.addColorStop(.4, '#fff7d752'); sun.addColorStop(1, '#fff7d700');
    ctx.fillStyle = sun; ctx.fillRect(880, 0, 300, 240);
    ellipse(1035, 86, 38, 38, '#fff8d9bd');
    // Soft distant islands and clouds.
    path('#c5d2bc',()=>{ctx.moveTo(505,255);ctx.bezierCurveTo(655,222,670,221,755,230);ctx.bezierCurveTo(859,224,877,178,952,192);ctx.bezierCurveTo(1020,177,1113,213,1150,221);ctx.bezierCurveTo(1260,206,1330,229,1440,234);ctx.lineTo(1440,273);ctx.closePath();});
    path('#b4c8b4',()=>{ctx.moveTo(1052,255);ctx.bezierCurveTo(1135,221,1162,192,1215,190);ctx.bezierCurveTo(1250,176,1281,195,1317,190);ctx.bezierCurveTo(1373,187,1400,200,1440,207);ctx.lineTo(1440,270);ctx.closePath();});
    ctx.globalAlpha = .3;
    path(null,()=>{ctx.moveTo(608,109);ctx.bezierCurveTo(654,101,674,103,708,107);ctx.moveTo(752,70);ctx.bezierCurveTo(792,63,816,64,858,68);},'#fff9e7',2);
    ctx.globalAlpha = 1;
    // A tiny pair of birds over the horizon.
    for (let i=0;i<3;i++) { const bx=739+i*37+Math.sin(t*.14)*15, by=141-i*13; path(null,()=>{ctx.moveTo(bx-6,by);ctx.quadraticCurveTo(bx-2,by-4+Math.sin(t+i)*1.5,bx,by);ctx.quadraticCurveTo(bx+3,by-4+Math.sin(t+i)*1.5,bx+7,by);},'#75958966',1.3); }
    const sea = ctx.createLinearGradient(0, SURFACE, 0, H);
    sea.addColorStop(0, '#89b5a8');sea.addColorStop(.19, '#72a69c');sea.addColorStop(.55, '#4b8583');sea.addColorStop(1, '#315b64');
    ctx.fillStyle=sea;ctx.fillRect(0,SURFACE,W,H-SURFACE);
    // Reflected sunlight and translucent underwater shafts.
    for(let i=0;i<7;i++) {
      const x=520+i*145+Math.sin(t*.13+i)*12;
      const light=ctx.createLinearGradient(x,SURFACE,x-70,700); light.addColorStop(0,'#eff4c413');light.addColorStop(1,'#eff4c400');
      path(light,()=>{ctx.moveTo(x,SURFACE);ctx.lineTo(x+37,SURFACE);ctx.lineTo(x-60,733);ctx.lineTo(x-180,733);ctx.closePath();});
    }
    for(const r of ripples) { const shift=Math.sin(t*.45+r.phase)*12; path(null,()=>{ctx.moveTo(r.x+shift,r.y);ctx.quadraticCurveTo(r.x+r.w/2+shift,r.y+2,r.x+r.w+shift,r.y);},'#e4edd53b',1); }
    path(null,()=>{ctx.moveTo(310,256);for(let x=310;x<=W;x+=15)ctx.lineTo(x,256+Math.sin(x*.022+t*.7)*1.7);},'#e8eed99c',2);
    // The underwater coastline.
    path('#507e72',()=>{ctx.moveTo(0,225);ctx.lineTo(308,248);ctx.bezierCurveTo(331,284,308,345,265,405);ctx.bezierCurveTo(201,461,250,526,117,570);ctx.lineTo(0,590);ctx.closePath();});
    path('#436e68',()=>{ctx.moveTo(0,380);ctx.bezierCurveTo(108,351,150,410,241,407);ctx.bezierCurveTo(206,469,225,510,132,563);ctx.lineTo(0,603);ctx.closePath();});
    path('#70928155',()=>{ctx.moveTo(207,285);ctx.bezierCurveTo(277,310,228,354,263,381);ctx.bezierCurveTo(294,335,308,300,297,275);ctx.closePath();});
    // Land, shoreline and soft grasses.
    path('#a5b28f',()=>{ctx.moveTo(0,175);ctx.bezierCurveTo(67,179,110,197,153,201);ctx.bezierCurveTo(218,204,261,221,287,230);ctx.bezierCurveTo(309,239,330,245,344,258);ctx.bezierCurveTo(272,270,198,247,166,249);ctx.lineTo(0,246);ctx.closePath();});
    path('#d1cfac',()=>{ctx.moveTo(0,220);ctx.bezierCurveTo(110,217,129,232,208,231);ctx.bezierCurveTo(260,230,297,244,338,252);ctx.quadraticCurveTo(354,255,344,263);ctx.bezierCurveTo(286,272,221,249,157,254);ctx.lineTo(0,259);ctx.closePath();});
    path('#809b79',()=>{ctx.moveTo(0,184);ctx.bezierCurveTo(49,188,78,184,100,203);ctx.bezierCurveTo(147,194,153,218,214,218);ctx.bezierCurveTo(164,233,119,215,66,224);ctx.lineTo(0,219);ctx.closePath();});
    ellipse(111,218,31,13,'#a6b198');ellipse(109,213,26,12,'#b5bca1');ellipse(58,203,18,9,'#bfc4a7');
    for(let i=0;i<18;i++) {const x=12+i*9; const y=211+Math.sin(i*.6)*6;path(null,()=>{ctx.moveTo(x,y);ctx.quadraticCurveTo(x-5+Math.sin(t*.7+i)*2,y-11,x-4+Math.sin(t*.7+i)*2,y-19-(i%4)*3);},i%2?'#7a9573':'#93a580',1.5);}
    // Sea floor silhouettes, stones and a little coral garden.
    path('#49797466',()=>{ctx.moveTo(0,650);ctx.bezierCurveTo(230,595,270,709,519,663);ctx.bezierCurveTo(660,641,750,673,856,691);ctx.bezierCurveTo(1000,704,1084,624,1235,636);ctx.quadraticCurveTo(1358,627,1440,671);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();});
    path('#315e63',()=>{ctx.moveTo(0,733);ctx.bezierCurveTo(240,699,313,742,490,724);ctx.bezierCurveTo(680,703,709,749,1000,728);ctx.bezierCurveTo(1126,710,1281,702,1440,715);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();});
    ellipse(1129,714,72,29,'#467472');ellipse(1150,704,53,25,'#59847b');ellipse(1202,723,36,13,'#72948566');
    ellipse(421,739,55,19,'#3a6766');ellipse(441,731,30,16,'#588178');
    coral(1247,717,1.15,t);coral(487,743,.65,t);coral(105,699,.8,t);
    for(const p of plants) drawPlant(p,t);
    for(const p of motes) {ctx.globalAlpha=.12+Math.sin(t*.7+p.phase)*.08;ellipse(p.x+Math.sin(t*.15+p.phase)*10,p.y-Math.sin(t*.22+p.phase)*13,p.r,p.r,'#f2f2d5');}ctx.globalAlpha=1;
    // Unobtrusive depth markers.
    ctx.font='9px "DM Sans", sans-serif';ctx.fillStyle='#b5d3c03d';ctx.textAlign='right';
    for(let d=20;d<=60;d+=20) {const y=SURFACE+d*7;ctx.fillText(`${d} m`,W-25,y+3);path(null,()=>{ctx.moveTo(W-65,y);ctx.lineTo(W-53,y);},'#b5d3c034',1);}
  }

  function drawPlant(p,t) {
    const sway=Math.sin(t*.65+p.phase)*12;
    ctx.save();ctx.translate(p.x,p.y);
    const color=p.x%3>1?'#6e9b8166':'#224f54b0';
    path(color,()=>{ctx.moveTo(-p.wide/2,0);ctx.bezierCurveTo(-19,-p.h*.36,20+sway,-p.h*.67,sway,-p.h);ctx.bezierCurveTo(29+sway,-p.h*.66,-5,-p.h*.25,p.wide/2,0);ctx.closePath();});
    for(let j=1;j<=3;j++){const y=-p.h*j/4,x=Math.sin(j+p.phase)*4;const side=j%2?1:-1;path(color,()=>{ctx.moveTo(x,y);ctx.quadraticCurveTo(x+side*29,y-7,x+side*20,y-29);ctx.quadraticCurveTo(x+side*4,y-21,x,y);});}
    ctx.restore();
  }
  function coral(x,y,s,t) {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineCap='round';
    path(null,()=>{ctx.moveTo(0,0);ctx.quadraticCurveTo(-9,-24,-5,-70);ctx.moveTo(-6,-20);ctx.quadraticCurveTo(-31,-27,-36,-50);ctx.moveTo(-6,-39);ctx.quadraticCurveTo(24,-43,29,-67);ctx.moveTo(-24,-34);ctx.lineTo(-23,-54);ctx.moveTo(16,-48);ctx.lineTo(12,-66);ctx.moveTo(-5,-50);ctx.lineTo(-17,-65);},'#b0b18b66',5);ctx.restore();
  }

  function drawFish(f,t) {
    if(!f.active)return;
    const wiggle=Math.sin(t*3+f.phase), color=['#d7dfb5','#d7c38d','#e6b085'][f.tier];
    ctx.save();ctx.translate(f.x,f.y+wiggle*3);ctx.scale(f.direction,1);
    path(color,()=>{ctx.moveTo(-11,0);ctx.quadraticCurveTo(0,-10,14,-1);ctx.quadraticCurveTo(4,12,-11,0);ctx.lineTo(-20,-6+wiggle*2);ctx.lineTo(-19,7+wiggle*2);ctx.closePath();});
    path('#fffbe42b',()=>{ctx.moveTo(-6,-2);ctx.quadraticCurveTo(1,-7,9,-2);ctx.closePath();});
    ellipse(8,-1,1.2,1.2,'#506d65');ctx.restore();
  }

  function seal(x,y,scale,facing,t,swimming=false,friend=false) {
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    const flap=Math.sin(t*(swimming?5:1.7));
    if(swimming)ctx.rotate(Math.sin(t*1.6)*.04 + clamp(game.velocity.y / 1800,-.15,.15)*facing);
    else ellipse(-6,21,39,6,'#446c571c');
    // Tail, far flipper, round body and a curious face.
    path(friend?'#a4b9a6':'#b6c9b7',()=>{ctx.moveTo(-32,10);ctx.bezierCurveTo(-53,8,-60,-6+flap*5,-64,-3+flap*4);ctx.bezierCurveTo(-67,6,-56,16,-42,18);ctx.quadraticCurveTo(-59,22,-59,27);ctx.quadraticCurveTo(-40,32,-27,15);ctx.closePath();});
    path('#aabca9',()=>{ctx.moveTo(11,5);ctx.quadraticCurveTo(5,28+flap*3,20,26);ctx.quadraticCurveTo(28,20,29,8);});
    const body=ctx.createLinearGradient(0,-30,0,26);body.addColorStop(0,friend?'#ccd8c2':'#eef0d8');body.addColorStop(1,friend?'#a8c0ad':'#c6d5bd');
    path(body,()=>{ctx.moveTo(-40,10);ctx.bezierCurveTo(-44,-8,-22,-19,1,-16);ctx.bezierCurveTo(15,-40,46,-38,52,-13);ctx.bezierCurveTo(72,-11,68,4,54,8);ctx.bezierCurveTo(46,29,-2,28,-27,20);ctx.quadraticCurveTo(-39,18,-40,10);ctx.closePath();});
    path('#b3c7b1',()=>{ctx.moveTo(0,6);ctx.bezierCurveTo(-12,16,-18,26+flap*5,-7,29+flap*3);ctx.quadraticCurveTo(9,30,19,14);});
    ellipse(47,-1,13,8,'#f0f1dccc');
    if(Math.sin(t*.9)>.993)path(null,()=>{ctx.moveTo(33,-13);ctx.lineTo(40,-13);},'#385d52',2);
    else {ellipse(38,-14,2.8,3.5,'#38544c');ellipse(39,-15,1,1,'#faf9e4');}
    ellipse(59,-5,3.7,2.6,'#5f7666');ellipse(38,-3,6,3.5,'#d9b8a35c');
    path(null,()=>{ctx.moveTo(56,0);ctx.quadraticCurveTo(55,5,51,4);ctx.moveTo(48,0);ctx.lineTo(34,1);ctx.moveTo(48,3);ctx.lineTo(36,7);ctx.moveTo(60,0);ctx.lineTo(70,-2);ctx.moveTo(60,3);ctx.lineTo(71,5);},'#6c85716e',1);
    // Little speckles on its back.
    for(let i=0;i<5;i++)ellipse(-21+i*7,-4+Math.sin(i*3)*3,2.2,1.5,'#93ae9130');
    ctx.restore();
  }

  function render(t) {
    if (scene3D) { scene3D.render(game, t, particles, callWaves); return; }
    ctx.setTransform(canvasScale,0,0,canvasScale,0,0);
    ctx.clearRect(0,0,viewWidth,H);
    const targetX=game.status==='ready'?860:game.x;
    const targetCamera=clamp(targetX-viewWidth*.43,0,Math.max(0,W-viewWidth));
    camera+=(targetCamera-camera)*.08;
    ctx.save();ctx.translate(-camera,0);background(t);
    const fishTime=game.status==='ready'?demoTime:game.elapsed;
    for(const f of game.fish)drawFish(f,fishTime);
    for(let i=0;i<game.companions;i++)seal(110+i*57,218+(i%2)*3,.64,i%2?1:-1,t+i,false,true);
    if(game.status==='ready') {
      seal(884+Math.sin(t*.35)*35,377+Math.sin(t*.8)*12,1.23,1,t,true);
      // Tiny bubbles drift from the demo seal.
      for(let i=0;i<5;i++){const by=360-((t*17+i*30)%138);path(null,()=>ctx.arc(947+Math.sin(i+t*.4)*10,by,2+i*.6,0,Math.PI*2),'#def0d67a',1);}
    } else seal(game.x,game.y+(game.atAir&&!game.onLand?Math.sin(t*2)*2:0),.84,game.facing,t,!game.onLand);
    for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);if(p.type==='bubble')path(null,()=>ctx.arc(p.x,p.y,p.size,0,Math.PI*2),'#e6f2da',1);else ellipse(p.x,p.y,p.size,p.size,p.color);}
    ctx.globalAlpha=1;
    for(const wave of callWaves){ctx.globalAlpha=wave.life/2;path(null,()=>ctx.arc(wave.x,wave.y,30+(2-wave.life)*90,Math.PI*1.12,Math.PI*1.85),'#f6efc1',1.5);}ctx.globalAlpha=1;
    ctx.fillStyle=grainPattern;ctx.fillRect(0,0,W,H);
    ctx.restore();
    if(game.status==='playing'&&game.oxygen<25){const warn=ctx.createRadialGradient(viewWidth/2,H/2,H*.25,viewWidth/2,H/2,Math.max(H,viewWidth)*.6);warn.addColorStop(0,'#c9997600');warn.addColorStop(1,`rgba(200,122,88,${(1-game.oxygen/25)*.32})`);ctx.fillStyle=warn;ctx.fillRect(0,0,viewWidth,H);}
  }

  class OceanAudio {
    constructor() {
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      this.context=new AudioContext();const ac=this.context;
      this.master=ac.createGain();this.master.gain.value=0;this.master.connect(ac.destination);
      const buf=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate), data=buf.getChannelData(0);let previous=0;
      for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;data[i]=previous*3;}
      const noise=ac.createBufferSource();noise.buffer=buf;noise.loop=true;
      const filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.value=550;
      const gain=ac.createGain();gain.gain.value=.2;noise.connect(filter);filter.connect(gain);gain.connect(this.master);noise.start();
      const lfo=ac.createOscillator(),lfoGain=ac.createGain();lfo.frequency.value=.13;lfoGain.gain.value=.075;lfo.connect(lfoGain);lfoGain.connect(gain.gain);lfo.start();
      for(const [i,freq] of [130.81,196,261.63].entries()){const osc=ac.createOscillator(),g=ac.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.value=.008/(i+1);osc.connect(g);g.connect(this.master);osc.start();}
    }
    set(enabled){this.context.resume().catch(()=>{});this.master.gain.setTargetAtTime(enabled?.55:0,this.context.currentTime,.2);}
    tone(freq,duration=.4,level=.06,delay=0){if(!audioEnabled)return;const ac=this.context,now=ac.currentTime+delay,osc=ac.createOscillator(),g=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,now);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(level,now+.02);g.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(g);g.connect(this.master);osc.start(now);osc.stop(now+duration+.1);}
    chime(kind){if(kind==='fish')this.tone(659.25,.24,.04);if(kind==='perfect'){this.tone(523.25,.5,.05);this.tone(783.99,.6,.03,.06);}if(kind==='friend'||kind==='won'){[392,523.25,659.25,783.99].forEach((f,i)=>this.tone(f,.8,.06,i*.18));}if(kind==='warning')this.tone(261.63,.7,.035);}
  }

  function setSound(enabled) {
    try {if(!audio)audio=new OceanAudio();audioEnabled=enabled;audio.set(enabled);$('soundLabel').textContent=enabled?'海洋聲音':'聲音關閉';$('soundButton').setAttribute('aria-pressed',String(enabled));$('soundButton').setAttribute('aria-label',enabled?'關閉海洋聲音':'開啟海洋聲音');}
    catch {audioFailed=true;$('soundLabel').textContent='聲音暫不可用';}
  }
  $('soundButton').addEventListener('click',()=>setSound(!audioEnabled));

  function notify(text,duration=2.5) {$('feedback').textContent=text;$('feedback').classList.add('visible');feedbackTimer=duration;}
  function burst(type,x,y,count=8) {for(let i=0;i<count;i++)particles.push({type,x,y,vx:(Math.random()-.5)*60,vy:-20-Math.random()*50,life:1.2+Math.random(),max:2.2,size:1.5+Math.random()*3,color:'#e7d8a4'});}
  function events() {
    for(const e of game.events.splice(0)) {
      if(e.text)notify(e.text,e.type==='warning'?3.5:2.4);
      if(audio)audio.chime(e.type);
      if(e.type==='fish'||e.type==='perfect')burst(e.type==='fish'?'spark':'bubble',game.x+25,game.y,9);
      if(e.type==='splash')burst('bubble',game.x,SURFACE,14);
      if(e.type==='friend')callWaves.push({x:game.x,y:game.y,life:2});
      if(e.type==='won'||e.type==='lost')showEnd(e.type);
    }
  }
  function ui() {
    const ready=game.status==='ready', phase=ready?(demoTime%3.2)/3.2:game.phase;
    $('oxygenValue').textContent=Math.ceil(game.oxygen);
    $('oxygenFill').style.width=game.oxygen+'%';
    $('oxygenFill').style.background=game.oxygen<25?'#c68d6c':'#688d75';
    $('oxygenHint').textContent=game.onLand?'在岸上，安心呼吸':game.atAir?'浮上水面，補充氧氣':game.oxygen<25?'氧氣偏低，請盡快上浮 ↑':game.boost>0?'節奏正好，輕盈省氧中':'記得留一口氣，回家';
    $('fishCount').textContent=game.food;
    $('companionCount').textContent=`同伴 ${game.companions} / 3`;
    [...$('companionDots').children].forEach((dot,i)=>dot.classList.toggle('filled',i<game.companions));
    $('zoneLabel').textContent=game.onLand?'岸邊':game.depth<3?'水面':game.depth<30?'淺海':'深海';
    $('depthValue').innerHTML=`${Math.round(game.depth)}<span> m</span>`;
    $('rhythmRing').setAttribute('r',String(35+(1-phase)*38));
    $('breathWidget').classList.toggle('perfect',!ready&&game.onBeat);
    $('breathVerb').textContent=ready?'呼吸':game.onBeat?'現在':game.atAir?'吸氣':'划水';
    $('breathHint').textContent=game.atAir||ready?'光圈靠攏時，輕按空白鍵':'跟上節奏，划得更遠';
    $('callPrompt').classList.toggle('hidden',!(game.status==='playing'&&game.onLand&&game.food>=5));
    if(game.status==='playing')$('statusText').textContent=game.onLand?(game.food>=5?'小魚準備好了，按 E 讓同伴知道你回來了。':'準備好了就向右出發，海灣裡有小魚等著你。'):game.oxygen<25?'留一口氣給回家的路。按 ↑ 回到水面。':game.food>=5?'收穫足夠了，回左側岸上與同伴分享吧。':is3D?'Q／R 前後游動，靠近魚就能吃下。拖曳畫面可旋轉視角。':'越深處的魚，藏著越多收穫。也記得看看氧氣。';
  }
  function clearInput(){heldKeys.clear();for(const key of Object.keys(input))delete input[key];}
  function start() {
    game.reset();clearInput();particles=[];callWaves=[];feedbackTimer=0;$('feedback').classList.remove('visible');
    stage.classList.add('playing');$('startOverlay').classList.add('hidden');$('modalOverlay').classList.add('hidden');$('pauseButton').disabled=false;$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','暫停遊戲');
    canvas.focus({preventScroll:true});
    if(audioEnabled&&!audioFailed)audio.set(true);
    camera=clamp(game.x-viewWidth*.43,0,Math.max(0,W-viewWidth));
    notify('向右走進海裡，開始你的小旅行',3);
  }
  function pause() {
    if(game.status==='playing') {
      game.status='paused';clearInput();if(audio)audio.set(false);
      $('modalEyebrow').textContent='A MOMENT OF STILLNESS';$('modalTitle').textContent='休息一下。';$('modalText').textContent='海浪會等你，準備好再出發。';$('tripStats').classList.add('hidden');
      $('resumeButton').innerHTML='繼續旅行 <span>↗</span>';$('restartButton').classList.remove('hidden');$('modalOverlay').classList.remove('hidden');$('pauseButton').textContent='▷';$('pauseButton').setAttribute('aria-label','繼續遊戲');$('resumeButton').focus({preventScroll:true});
    }else if(game.status==='paused') {
      game.status='playing';$('modalOverlay').classList.add('hidden');$('pauseButton').textContent='Ⅱ';$('pauseButton').setAttribute('aria-label','暫停遊戲');canvas.focus({preventScroll:true});if(audio&&audioEnabled)audio.set(true);
    }
  }
  function showEnd(kind) {
    clearInput();const won=kind==='won';
    $('modalEyebrow').textContent=won?'THE BEST SHORE IS A SHARED ONE':'EVERY TIDE IS A NEW BEGINNING';
    $('modalTitle').textContent=won?'有你們，就是岸。':'這次，呼吸用完了。';
    $('modalText').textContent=won?'三位同伴，都因你的呼喚而來。小小的海灣，因為分享而溫暖。':'你在海底耗盡氧氣，這趟旅程結束了。下次早一點浮上水面，再帶小魚回家。';
    $('tripStats').innerHTML=`<span><b>${game.collected}</b>小魚份量</span><span><b>${Math.round(game.maxDepth)} m</b>最深探索</span><span><b>${game.perfects}</b>完美節奏</span>`;
    $('tripStats').classList.remove('hidden');$('resumeButton').innerHTML=won?'再去看看海 <span>↗</span>':'再出發一次 <span>↗</span>';$('restartButton').classList.add('hidden');$('modalOverlay').classList.remove('hidden');$('pauseButton').disabled=true;$('resumeButton').focus({preventScroll:true});
    $('statusText').textContent=won?'今天的小任務完成了，謝謝你帶來的溫暖。':'每次出發，都能找到更舒服的節奏。';
  }
  $('startButton').addEventListener('click',start);
  $('pauseButton').addEventListener('click',pause);
  $('resumeButton').addEventListener('click',()=>{if(game.status==='paused')pause();else start();});
  $('restartButton').addEventListener('click',start);
  $('callInline').addEventListener('click',()=>{game.call();canvas.focus({preventScroll:true});});
  $('helpButton').addEventListener('click',()=>{const open=$('helpPanel').classList.contains('hidden');$('helpPanel').classList.toggle('hidden',!open);$('helpButton').setAttribute('aria-expanded',String(open));if(open&&game.status==='playing')pause();});
  const keys={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
  if(is3D){keys.KeyQ='forward';keys.KeyR='back';}
  const heldKeys=new Set();
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(game.status==='playing'||game.status==='paused'){e.preventDefault();pause();}return;}
    if(game.status!=='playing')return;
    if(e.target instanceof HTMLButtonElement)return;
    if(keys[e.code]){e.preventDefault();heldKeys.add(e.code);input[keys[e.code]]=true;}
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)game.breathe();}
    if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)game.call();}
  });
  window.addEventListener('keyup',e=>{heldKeys.delete(e.code);if(keys[e.code])input[keys[e.code]]=[...heldKeys].some(k=>keys[k]===keys[e.code]);});
  window.addEventListener('blur',()=>{heldKeys.clear();clearInput();if(game.status==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')pause();});
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  for(const button of document.querySelectorAll('[data-move]')) {
    const direction=button.dataset.move;
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input[direction]=true;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{input[direction]=false;});
  }
  $('touchBreathe').addEventListener('pointerdown',e=>{e.preventDefault();game.breathe();});
  $('touchCall').addEventListener('pointerdown',e=>{e.preventDefault();game.call();});

  function frame(time) {
    const dt=Math.min((time-lastTime)/1000||0,.05);lastTime=time;
    const active=game.status==='playing'||game.status==='ready';
    if(active){visualTime+=dt*(reducedMotion?.2:1);demoTime+=dt;}
    game.update(dt,input);events();
    if(game.status==='playing'){
      for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
      for(const w of callWaves)w.life-=dt;callWaves=callWaves.filter(w=>w.life>0);
      if(!game.atAir&&Math.random()<dt*3)burst('bubble',game.x+game.facing*39,game.y,1);
    }
    if(feedbackTimer>0&&active){feedbackTimer-=dt;if(feedbackTimer<=0)$('feedback').classList.remove('visible');}
    ui();render(visualTime);requestAnimationFrame(frame);
  }
  resize();requestAnimationFrame(frame);
})();
