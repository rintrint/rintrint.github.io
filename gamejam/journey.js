import {JourneyAudio} from './journey-audio.js';
import {editionLinks} from './edition-nav.js';
const {Journey,SURFACE,HEIGHT,HOLES,clamp}=window.BreathJourney;
const edition=document.body.dataset.edition||'2d';
document.body.innerHTML=`<main class="world" id="world"><canvas id="worldCanvas" tabindex="0" aria-label="Breath 冰海旅程。方向鍵移動，按住空白鍵吸氣，跟著音樂放開。E 呼喚同伴，Esc 暫停。"></canvas><div id="dangerVignette" class="danger-vignette"></div><div id="airWarning" class="air-warning hidden" role="status"></div><div class="film-grain"></div><div class="top-shade"></div>
<header class="topbar"><a class="brand" href="${edition==='3d'?'3d.html':'index.html'}"><svg viewBox="0 0 32 25"><path d="M1 8q7-8 15 0t15 0M1 18q7-8 15 0t15 0"/></svg><span class="brand-name">Breath</span><i class="brand-line"></i><small>冰隙之間</small></a><div class="top-actions"><nav class="edition-switch" aria-label="切換美術版本">${editionLinks(edition)}</nav>${edition==='3d'?'<button class="round view-button" id="viewButton" aria-label="切換側面視角">視角</button>':''}<button class="round sound-button" id="soundButton" aria-label="關閉音樂" aria-pressed="true"><span>♫</span><span class="sound-label">音樂</span></button><button class="round hidden" id="pauseButton" aria-label="暫停">Ⅱ</button></div></header>
<section class="opening" id="opening"><div class="opening-inner"><div class="overline">A LITTLE BREATH. A LONG WAY HOME.</div><h1>Breath<span>${edition==='3d'?'3D':'2D'}</span></h1><h2>一口氣，越過漫長的冬天。</h2><p>一隻肚子空空的小海豹，一片會唱歌的冰海。<br>吸進晨光，游向魚群。<br>也許下一個冰洞，有朋友在等你。</p><button class="begin" id="startButton" disabled>正在喚醒冰海…</button><p class="opening-note">戴上耳機，讓呼吸跟著音樂。約 3 分鐘的小旅行。</p><div class="loading-note" id="loadError"></div></div><div class="opening-footer"><span>AN ARCTIC RHYTHM JOURNEY</span><span>深呼吸。世界會等你。</span></div></section>
<section class="hud hidden" id="hud" aria-label="旅程狀態"><div class="chapter"><span id="chapterNumber">CHAPTER 01</span><h2 id="chapterTitle">先裝滿一口晨光</h2><p id="chapterSub">冰上的小肚子，正在咕嚕咕嚕。</p></div><div class="supplies"><div class="air"><div class="air-label"><span>肺活量 · 氧氣</span><b id="airValue">20%</b></div><div class="air-track" id="airMeter" role="progressbar" aria-label="氧氣量" aria-valuemin="0" aria-valuemax="100"><i id="airFill"></i></div></div><div class="nutrition"><div class="meal"><span class="nutrition-label">飽食度</span><svg viewBox="0 0 28 20"><path d="M5 10Q16-3 27 10Q16 23 5 10L0 4v12z"/></svg><b id="foodValue">0</b><span>/12</span></div><div class="energy-track" id="energyMeter" role="progressbar" aria-label="型態進化能量" aria-valuemin="0" aria-valuemax="6"><i id="energyFill"></i></div><span id="formLabel" class="form-label">小海豹 · 0/6 進化</span></div><span class="depth" id="depthValue">0 m</span></div></section>
<div class="whisper" id="whisper" aria-live="polite"></div><div class="cue hidden" id="cue"><p class="cue-title" id="cueTitle"></p><p class="cue-detail" id="cueDetail"></p></div>
<div class="breath-control hidden" id="breathControl"><button id="breathButton" aria-pressed="false">吸氣</button><small id="breathSmall">SPACE 按住 · 放開</small><button id="callButton" class="call-button hidden">呼喚朋友 · E</button></div>
<div class="touch-steer hidden" id="touchSteer"><button data-dir="up" aria-label="上游">↑</button><button data-dir="left" aria-label="左游">←</button><button data-dir="down" aria-label="下潛">↓</button><button data-dir="right" aria-label="右游">→</button></div>
<div class="bottomline hidden" id="bottomline"><span id="bottomText">72 BPM · 與冰海一起呼吸</span><button id="helpButton">如何悠游 &nbsp; ?</button></div>
<div class="scrim hidden" id="modal"><div class="dialog"><div class="overline" id="modalLabel"></div><h2 id="modalTitle"></h2><p id="modalCopy"></p><div class="stats hidden" id="stats"></div><button class="begin" id="resumeButton"></button><button class="text-button" id="restartButton">重新開始這段旅程</button></div></div>
<div class="scrim hidden" id="help"><div class="help-card"><h2>聽見海，也聽見呼吸。</h2><p><b>岸上</b>　按住 <kbd>SPACE</kbd> 吸氣，聽見每個樂句開頭的明亮琴音、海水變亮時放開。先完成兩次飽滿呼吸，再準拍入水。</p><p><b>水下</b>　用 <kbd>WASD</kbd> 或方向鍵游動，靠近魚就能吃下。深處的魚更飽，也更耗氧。準拍放開空白鍵可省氧划水。</p><p><b>冰洞</b>　向釣魚人的光束上游，靠近冰洞後，按住、準拍放開才能躍出冰縫。普通水面無法換氣。</p><p><b>大冰隙</b>　第二位釣魚人旁，長按至少兩秒，再準拍放開。巨大吸氣聲會帶你跳向下一個洞。跳過、吃飽後，上岸按 <kbd>E</kbd> 呼喚新朋友。</p><p><b>成長與結局</b>　每吃滿 6 份進化一次，身體會隨進食變大。12 份即吃飽。窒息時未吃飽會變餓死鬼，吃飽則變天使；活著跨洞並找到朋友才是成功。</p><p class="quiet">也可點「吸氣」按鈕開始，再點「放開」；手機提供方向按鈕。保持自然呼吸即可。切換版本會重新開始。</p><button class="begin" id="closeHelp">回到海裡 <span>↗</span></button></div></div><div class="flash" id="flash"></div></main>`;
const $=id=>document.getElementById(id),canvas=$('worldCanvas'),game=new Journey(),input={},held=new Set();
let renderer,audio,last=0,visualTime=0,toast=0,musicEnabled=true,helpWasPlaying=false,frameCount=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fx={particles:[],rings:[],word:null};
function resize(){renderer?.resize(innerWidth,innerHeight,devicePixelRatio||1);}
function say(text,duration=3.5){if(!text)return;$('whisper').textContent=text;$('whisper').classList.add('visible');toast=duration;}
function burst(x,y,type='splash',count=45){for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=50+Math.random()*160;fx.particles.push({x,y,vx:Math.cos(angle)*speed,vy:type==='bubble'?-30-Math.random()*65:-Math.abs(Math.sin(angle)*speed)-55,life:type==='splash'?1.5:2.2,max:type==='splash'?1.5:2.2,size:type==='splash'?1+Math.random()*4:2+Math.random()*4,type:type==='bubble'?'bubble':'spark',gravity:type==='splash'?270:0,color:type==='fish'?'#ffe5b3':'#e5f7fa'});}if(type==='splash')fx.rings.push({x,life:1.8});}
function drainEvents(){for(const e of game.events.splice(0)){
  audio?.event(e);
  if(['miss','full','rest','leap','warning','hint','call','evolve','dying'].includes(e.type))say(e.text,e.type==='leap'?4:3);
  if(e.type==='perfect'){fx.word={text:game.stage==='swim'?'隨浪而行':'一口好呼吸',life:1.8};}
  if(e.type==='fish'){burst(e.x,e.y,'fish',13);fx.word={text:e.text,life:1.4};}
  if(e.type==='splash'||e.type==='breach'){burst(e.x,e.y,'splash',60);say(e.text);}
  if(e.type==='leap')burst(e.x,e.y,'splash',80);
  if(e.type==='evolve'){burst(e.x,e.y,'fish',42);fx.word={text:e.text,life:2.2};}
  if(e.type==='dying'){clearControls();burst(game.x,game.y,'bubble',16);}
  if(e.type==='won'||e.type==='lost')showModal(e.type);
}}
function clearControls(){for(const k of Object.keys(input))delete input[k];held.clear();}
function start(){game.reset();toast=0;$('whisper').classList.remove('visible');fx.particles=[];fx.rings=[];fx.word=null;clearControls();$('opening').classList.add('hidden');$('modal').classList.add('hidden');for(const id of ['hud','cue','breathControl','bottomline','pauseButton','touchSteer'])$(id).classList.remove('hidden');
  if(!audio)try{audio=new JourneyAudio();audio.enabled=musicEnabled;}catch{say('聲音暫不可用，海水的明暗也會帶著節奏。');}
  audio?.pause();audio?.start(0);canvas.focus({preventScroll:true});}
function pause(){if(!['playing','paused'].includes(game.status))return;game.pause();clearControls();if(game.status==='paused'){audio?.pause();showModal('paused');}else{$('modal').classList.add('hidden');audio?.start(game.time);canvas.focus({preventScroll:true});}}
function showModal(kind){
  const won=kind==='won',lost=kind==='lost',angel=game.outcome==='angel';$('modal').classList.remove('hidden');$('modal').classList.toggle('loss-modal',lost);
  $('modalLabel').textContent=won?'SOMEWHERE, SOMEONE IS WAITING':lost?(angel?'ENDING · ANGEL':'ENDING · HUNGRY GHOST'):'A MOMENT BETWEEN BREATHS';
  $('modalTitle').textContent=won?'吃飽了，也不再孤單。':lost?(angel?'吃飽的小天使。':'還餓著的餓死鬼。'):'海會等你。';
  $('modalCopy').textContent=won?'越過冰縫，帶著滿滿的小肚子。你的呼喚，終於有了回應。':lost?(angel?'肚子已經吃飽，氧氣卻先耗盡了。小海豹化成天使。下一次，帶著這份飽足活著回到朋友身邊。':'氧氣耗盡時，肚子還沒吃飽。小海豹化成餓死鬼。下次先吃近處的小魚，提早游回冰洞換氣。'):'讓肩膀放鬆。準備好，再回到冰海的旋律裡。';
  $('stats').classList.toggle('hidden',!won&&!lost);$('stats').innerHTML=`<div><b>${game.food}</b>小魚份量</div><div><b>${Math.round(game.maxDepth)}m</b>最深探索</div><div><b>${game.perfects}</b>同拍呼吸</div>`;
  $('resumeButton').innerHTML=won?'再一起聽一次海 <span>↗</span>':lost?'重新吸一口氣 <span>↗</span>':'繼續旅行 <span>↗</span>';
  $('restartButton').classList.toggle('hidden',won||lost);$('resumeButton').focus({preventScroll:true});
}
const chapters={breathe:['01','先裝滿一口晨光','飢餓的小肚子，等著出發。'],entry:['01','穿過第一道冰縫','下一次明亮琴音，放開。'],swim:['02','把呼吸交給海','深處的小魚，藏著更多收穫。'],rest:['03','借一口冰上的空氣','釣魚先生，借過一下。'],bigBreath:['04','最長的那一口氣','下一個洞，在風的另一端。'],calling:['05','另一端，有朋友','吃飽了。試著呼喚看看。'],ending:['06','一起，等春天','每一次呼吸，都有了回應。'],dying:['—','最後一口氣','這一次，旅程到這裡。']};
function ui(){
  const s=game.stage,chapter=chapters[s]||chapters.swim;
  $('chapterNumber').textContent=`CHAPTER ${chapter[0]}`;$('chapterTitle').textContent=chapter[1];$('chapterSub').textContent=chapter[2];
  $('airValue').textContent=`${Math.ceil(game.oxygen)}%`;$('airFill').style.width=`${game.oxygen}%`;$('airFill').style.background=game.oxygen<25?'#b67b85':'#477f98';
  $('foodValue').textContent=game.food;
  $('airMeter').setAttribute('aria-valuenow',String(Math.ceil(game.oxygen)));
  $('energyFill').style.width=`${game.energy*100}%`;$('energyMeter').setAttribute('aria-valuenow',String(game.form===2?6:game.food%6));
  $('formLabel').textContent=`${game.formName} · ${game.form===2?'已吃飽':`${game.food%6}/6 進化`}`;
  $('energyMeter').setAttribute('aria-valuetext',$('formLabel').textContent);
  $('hud').dataset.form=game.form;$('hud').classList.toggle('just-ate',game.eatPulse>0);
  $('airWarning').classList.toggle('hidden',!game.underwater||game.oxygen>40);
  $('airWarning').textContent=game.oxygen<=10?'最後一口氣！':game.oxygen<=25?'缺氧危險':'空氣漸少';
  $('airWarning').textContent+=Math.abs(game.targetHole-game.x)<115?' · ↑ 從光束上游':game.targetHole>game.x?' · 冰洞在右上 ↗':' · 冰洞在左上 ↖';$('depthValue').textContent=`${Math.round(game.depth)} m`;
  $('breathButton').textContent=game.holding?'放開':'吸氣';$('breathButton').setAttribute('aria-pressed',String(game.holding));
  $('breathButton').disabled=!!game.transition||['calling','ending','dying'].includes(s);
  $('callButton').classList.toggle('hidden',s!=='calling');$('breathButton').classList.toggle('hidden',s==='calling'||s==='ending'||s==='dying');
  $('breathSmall').textContent=s==='calling'?'讓朋友聽見你':game.holding?'聽到明亮琴音，放開':'SPACE 按住 · 放開';
  $('breathSmall').classList.toggle('hidden',s==='dying'||s==='ending');
  $('pauseButton').classList.toggle('hidden',['title','won','lost'].includes(game.status));
  let title='',detail='';
  if(s==='breathe'){title=game.holding?'把晨光，慢慢吸進肚子。':'先吸滿一口氣，再出發。';detail=`按住 SPACE 吸氣；每段琴音回到明亮處時放開。${game.breaths}/2 次飽滿呼吸`;}
  if(s==='entry'){title='光，正在穿過冰縫。';detail='按住 SPACE，跟著下一次明亮琴音放開，潛入冰海。';}
  if(s==='swim'){
    title=game.nearHole?'就是這裡。穿過那束光。':game.oxygen<25?'把最後一口氣，留給回家。':'慢慢游，聽見海。';
    detail=game.nearHole?'按住 SPACE，海水亮起時放開，躍出冰洞。':'WASD／方向鍵悠游 · 靠近魚群吃魚 · 釣魚人的光束通往空氣';
  }
  if(s==='rest'){title='釣魚先生，借一口氣。';detail='按住 SPACE，再隨著明亮琴音放開。準備下一段旅程。';}
  if(s==='bigBreath'){title='深深吸氣。讓海風托住你。';detail='長按 SPACE 至少兩秒，明亮琴音落下時放開，跳向下一個冰洞。';}
  if(s==='calling'){title='肚子滿了，心裡還有一個位置。';detail='按 E，呼喚冰川另一端的新朋友。';}
  if(s==='ending'){title='原來，你也在等我。';detail='';}
  if(s==='dying'){title=game.outcome==='angel'?'一雙小翅膀，接住了你。':'小肚子，還在咕嚕咕嚕。';detail='氧氣耗盡 · 旅程結束';}
  if(game.transition){title=game.transition.type==='greatLeap'?'這一口氣，比冬天還長。':'噗通。';detail='';}
  $('cueTitle').textContent=title;$('cueDetail').textContent=detail;
  $('bottomText').textContent=game.underwater?`${Math.round(game.depth)} m · 讓光帶你回到空氣裡`:'72 BPM · 與冰海一起呼吸';
  // Accessible DOM state also makes real input-based browser checks reproducible.
  canvas.dataset.stage=s;canvas.dataset.beat=game.precise?'open':'closed';canvas.dataset.status=game.status;
  canvas.dataset.holding=String(game.holding);canvas.dataset.x=String(Math.round(game.x));canvas.dataset.y=String(Math.round(game.y));canvas.dataset.musicTime=game.time.toFixed(3);canvas.dataset.outcome=game.outcome||'';canvas.dataset.form=String(game.form);
}
$('startButton').addEventListener('click',start);$('pauseButton').addEventListener('click',pause);
$('resumeButton').addEventListener('click',()=>game.status==='paused'?pause():start());$('restartButton').addEventListener('click',start);
$('soundButton').addEventListener('click',()=>{musicEnabled=!musicEnabled;audio?.setEnabled(musicEnabled);$('soundButton').setAttribute('aria-pressed',String(musicEnabled));$('soundButton').setAttribute('aria-label',musicEnabled?'關閉音樂':'開啟音樂');$('soundButton').firstElementChild.textContent=musicEnabled?'♫':'♪';canvas.focus({preventScroll:true});});
$('breathButton').addEventListener('click',()=>{game.holding?game.release():game.inhale();canvas.focus({preventScroll:true});});
$('callButton').addEventListener('click',()=>game.call());
$('helpButton').addEventListener('click',()=>{helpWasPlaying=game.status==='playing';if(helpWasPlaying){game.pause();audio?.pause();clearControls();}$('help').classList.remove('hidden');});
$('closeHelp').addEventListener('click',()=>{$('help').classList.add('hidden');if(helpWasPlaying){game.pause();audio?.start(game.time);}canvas.focus({preventScroll:true});});
const mapping={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(!$('help').classList.contains('hidden'))$('closeHelp').click();else pause();e.preventDefault();return;}
  if(game.status!=='playing'||e.target instanceof HTMLButtonElement)return;
  if(mapping[e.code]){e.preventDefault();held.add(e.code);input[mapping[e.code]]=true;}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)game.inhale();}
  if(e.code==='KeyE'&&!e.repeat)game.call();
});
addEventListener('keyup',e=>{held.delete(e.code);if(mapping[e.code])input[mapping[e.code]]=[...held].some(k=>mapping[k]===mapping[e.code]);if(e.code==='Space'){e.preventDefault();game.release();}});
for(const button of document.querySelectorAll('[data-dir]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input[button.dataset.dir]=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>input[button.dataset.dir]=false);}
canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
addEventListener('blur',()=>{clearControls();if(game.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='playing')pause();});
addEventListener('resize',resize);
function frame(ms){const dt=Math.min((ms-last)/1000||0,.05);last=ms;
  const moving=game.status==='playing'||game.status==='title';if(moving)visualTime+=dt*(reduced?.3:1);
  game.update(dt,input);audio?.update(game);drainEvents();
  if(moving){for(const p of fx.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.life-=dt;}fx.particles=fx.particles.filter(p=>p.life>0);for(const r of fx.rings)r.life-=dt;fx.rings=fx.rings.filter(r=>r.life>0);if(fx.word)fx.word.life-=dt;
    if(game.underwater&&Math.random()<dt*4)burst(game.x+game.facing*55,game.y-3,'bubble',1);
    if(toast>0){toast-=dt;if(toast<=0)$('whisper').classList.remove('visible');}
  }
  const danger=game.danger;const pulse=reduced?.5:game.heartbeat;
  $('dangerVignette').style.opacity=String(danger*(.55+pulse*.22));
  $('dangerVignette').style.setProperty('--tunnel',`${55-danger*28}%`);
  $('airWarning').style.opacity=String(.75+danger*pulse*.25);
  $('airFill').style.opacity=String(1-danger*pulse*.45);
  $('flash').style.opacity=String(game.evolutionGlow*(reduced?.05:.15));
  if(frameCount++%3===0)ui();renderer.render(game,visualTime,fx);requestAnimationFrame(frame);
}
try{
  const module=edition==='3d'?await import('./journey-view3d.js'):await import('./journey-view2d.js');
  renderer=new (edition==='3d'?module.Ice3D:module.Ice2D)(canvas);resize();await renderer.ready;
  if($('viewButton'))$('viewButton').addEventListener('click',()=>{renderer.side=!renderer.side;canvas.focus({preventScroll:true});});
  $('startButton').disabled=false;$('startButton').innerHTML='吸一口氣，出發 <span>↗</span>';requestAnimationFrame(frame);
}catch(error){console.error(error);$('startButton').textContent='暫時無法喚醒冰海';$('loadError').textContent=edition==='3d'?'請使用支援 WebGL 2 的瀏覽器，或切換 2D 繪本版。':'請透過本機伺服器開啟，確認 assets 圖片檔案存在。';}
