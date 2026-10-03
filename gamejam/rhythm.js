import {editionLinks} from './edition-nav.js';
import {TrackAudio} from './rhythm-audio.js';
import {RhythmView} from './rhythm-view.js';
const {RhythmRun,DIFFICULTIES}=window.BreathRhythm;
const edition=document.body.dataset.mode,sketch=edition==='sketch',mode=edition==='rings'?'rings':'runner',runner=mode==='runner';
let selectedDifficulty='beginner';try{const saved=localStorage.getItem('breath-difficulty');if(DIFFICULTIES[saved])selectedDifficulty=saved;}catch{}
document.body.innerHTML=`<main class="world"><canvas id="scene" tabindex="0" aria-label="${runner?'海豹上下，跟著魚群到達的時機按空白鍵跳躍':'圈圈節奏，光環縮到小圈時按空白鍵'}"></canvas><div class="grain"></div>
<header><a class="brand" href="index.html"><span>≈</span> Breath <small>冰海的旋律</small></a><nav aria-label="切換遊戲版本">${editionLinks(sketch?'sketch':mode)}</nav><div class="tools"><button id="sound" aria-label="關閉聲音" aria-pressed="true">♫</button><button id="pause" class="hidden" aria-label="暫停遊戲">Ⅱ</button></div></header>
<section class="opening" id="opening"><div class="eyebrow">BREATH / ${sketch?'A PENCIL, A SEAL, A LITTLE SEA':runner?'A LITTLE LEAP, A LONG WAY HOME':'FOLLOW THE LIGHT. FEEL THE TIDE.'}</div><h1>${sketch?'畫一片海，<br><em>跳一支舞。</em>':runner?'逐浪<br><em>小旅行。</em>':'聽見<br><em>潮汐的形狀。</em>'}</h1><p class="intro">${runner?'小海豹留在身邊，世界隨旋律往前。<br>魚群來到面前，輕按空白鍵躍起。<br>穿過晨光、深海，和一場溫柔的極光。':'看光環緩緩收攏，聽海洋輕輕呼吸。<br>大圈與小圈重合時，輕按空白鍵。<br>準拍抓到小魚，吃進肚子，慢慢長大。'}</p>
<fieldset class="songs"><legend>選一首今天的海</legend><label><input type="radio" name="track" value="wash1" ${!runner?'checked':''}><span><b>Oceanic Wash</b><small>01 / 明亮的潮汐 · 3:39</small></span><i>↗</i></label><label><input type="radio" name="track" value="wash2" ${runner?'checked':''}><span><b>Oceanic Wash 2</b><small>02 / 緩緩的海風 · 3:39</small></span><i>↗</i></label></fieldset>
<fieldset class="difficulties"><legend>同一首海，三種節奏</legend>${Object.entries(DIFFICULTIES).map(([id,p])=>`<label><input type="radio" name="difficulty" value="${id}" ${id===selectedDifficulty?'checked':''}><span><b>${p.label}</b><small aria-label="${p.stars} 星">${'✦'.repeat(p.stars)}</small></span><em id="count-${id}"></em></label>`).join('')}</fieldset><p class="difficulty-note" id="difficultyNote" aria-live="polite"></p>
<div class="start-row"><button class="primary" id="start" disabled>正在喚醒冰海…</button><label class="practice"><input type="checkbox" id="practice">輕鬆練習<small>不會失敗</small></label></div><p class="error" id="error" role="alert"></p><details class="settings"><summary>耳機延遲校正 <span id="offsetLabel">0 ms</span></summary><label for="offset">若聽到拍點時總是判定太晚，向右調整。</label><input id="offset" type="range" min="-200" max="200" step="10" value="0"><small>正值會延後判定時間；鍵盤與觸控皆可遊玩。</small></details></section>
<section class="hud hidden" id="hud" aria-label="遊戲狀態"><div class="song-info"><small id="chapter">01 / 晨光入海</small><h2 id="trackTitle"></h2><span id="form">小海豹</span><div class="body-growth"><span id="bodySize">體型 100%</span><div id="growthMeter" role="progressbar" aria-label="海豹體型" aria-valuemin="100" aria-valuemax="145"><i id="growthFill"></i></div></div></div><div class="stats"><div><small>COMBO</small><b id="combo">0</b></div><div><small>準確率</small><b id="accuracy">100<em>%</em></b></div><div class="air"><small>呼吸能量 <span id="airValue">100%</span></small><div id="airMeter" role="progressbar" aria-label="呼吸能量" aria-valuemin="0" aria-valuemax="100"><i id="airFill"></i></div></div></div></section>
<div class="countdown hidden" id="countdown" aria-live="polite"></div><div class="warning hidden" id="warning" role="status">呼吸變急了。跟著下一拍，找回氣息。</div>
<footer><span id="footerText">TWO SONGS. ONE LITTLE OCEAN.</span><span class="key-hint"><kbd>SPACE</kbd> ${runner?'跟著節奏跳躍':'光環重合時按下'} <i>·</i> ESC 暫停</span><span id="clock">約 3 分 39 秒</span></footer><div class="timeline hidden" id="timeline"><i id="progress"></i></div><button id="tap" class="tap hidden">${runner?'躍起':'輕觸'}<small>SPACE</small></button>
<div class="scrim hidden" id="modal"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="eyebrow" id="modalLabel"></div><h2 id="modalTitle"></h2><p id="modalCopy"></p><div id="resultStats" class="result-stats"></div><button class="primary" id="continue">繼續旅行 ↗</button><button class="text-button" id="back">回到選曲</button></section></div></main>`;
const $=id=>document.getElementById(id),canvas=$('scene'),view=sketch?new (await import('./rhythm-view-sketch.js')).SketchView(canvas):new RhythmView(canvas,mode);
let tracks=[],game=null,audio=null,loading=false,muted=false,last=0,visual=0,held=false,offset=0,finished=false;
view.onSound=e=>audio?.event(e);
try{offset=Math.max(-200,Math.min(200,Number(localStorage.getItem('breath-music-offset'))||0));}catch{}
$('offset').value=offset;$('offsetLabel').textContent=`${offset} ms`;
$('offset').oninput=()=>{offset=Number($('offset').value);$('offsetLabel').textContent=`${offset} ms`;try{localStorage.setItem('breath-music-offset',String(offset));}catch{}};
const show=(id,visible)=>$(id).classList.toggle('hidden',!visible);
const format=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
function selection(){return tracks.find(t=>t.id===document.querySelector('input[name="track"]:checked').value)||tracks[0];}
function difficulty(){return document.querySelector('input[name="difficulty"]:checked').value;}
function preview(){if(!tracks.length)return;game=new RhythmRun(selection(),mode,$('practice').checked,difficulty());finished=false;view.particles=[];view.ripples=[];$('clock').textContent='約 3 分 39 秒';$('footerText').textContent='TWO SONGS. ONE LITTLE OCEAN.';for(const id of Object.keys(DIFFICULTIES))$('count-'+id).textContent=`${selection().charts[id].length} 拍`;$('difficultyNote').textContent=`${game.profile.description} · 判定 ±${Math.round(game.window*1000)} ms`;}
async function start(){
  if(loading||!tracks.length)return;loading=true;$('start').disabled=true;$('start').textContent='音樂準備中…';$('error').textContent='';
  const track=selection(),practice=$('practice').checked,level=difficulty();
  document.querySelectorAll('.songs input,.difficulties input,#practice').forEach(e=>e.disabled=true);
  try{
    audio??=new TrackAudio();await audio.load(track);audio.mute(muted);
    game=new RhythmRun(track,mode,practice,level);view.particles=[];view.ripples=[];finished=false;held=false;
    game.start();audio.play(-3);visual=-3;show('opening',false);show('modal',false);
    for(const id of ['hud','pause','timeline','tap'])show(id,true);
    $('trackTitle').textContent=game.track.title;$('footerText').textContent=game.practice?`PRACTICE / ${game.profile.label} · 不會失敗`:`${sketch?'手繪海豹':runner?'海豹上下':'圈圈節奏'} / ${game.profile.label} · ${game.notes.length} 拍`;
    canvas.focus({preventScroll:true});if(document.hidden)pause();
  }catch(e){$('error').textContent=`無法載入音樂，請重試。${e.message}`;show('modal',false);show('opening',true);}
  finally{loading=false;$('start').disabled=false;$('start').textContent='開始聽海 ↗';document.querySelectorAll('.songs input,.difficulties input,#practice').forEach(e=>e.disabled=false);}
}
function pause(){if(game?.status!=='playing')return;audio.pause();game.pause();held=false;modal('paused');}
function resume(){if(game?.status!=='paused')return;audio.resume();game.resume();show('modal',false);canvas.focus({preventScroll:true});}
function modal(kind){
  const paused=kind==='paused',won=kind==='won';show('modal',true);
  $('modalLabel').textContent=paused?'A MOMENT BETWEEN WAVES':won?'A LITTLE OCEAN, A FULL HEART':'TAKE ANOTHER BREATH';
  $('modalTitle').textContent=paused?'海會等你。':won?'吃飽了，也有朋友了。':game.outcome==='angel'?'吃飽的小天使。':'還餓著的小幽靈。';
  $('modalCopy').textContent=paused?'音樂和旅程都停在這一刻。準備好了，再一起出發。':won?'從第一道晨光到最後一個音符，謝謝你陪小海豹走完這段海。':`呼吸能量用完了。${runner?'魚群到達海豹面前時':'光環縮到小圈時'}再按下；也可以在選曲開啟輕鬆練習。`;
  $('resultStats').innerHTML=paused?'':`<div><b>${game.accuracy}%</b>準確率</div><div><b>${game.maxCombo}</b>最高連擊</div><div><b>${game.score.toLocaleString()}</b>分數</div><p>Perfect ${game.counts.perfect} · Good ${game.counts.good} · Soft ${game.counts.soft} · Miss ${game.misses}${game.practice?' · 練習模式':''}</p>`;
  $('modalLabel').textContent+=` / ${game.profile.label}${game.practice?' · 練習':''}`;
  $('continue').textContent=paused?'繼續旅行 ↗':'再聽一次 ↗';$('continue').focus({preventScroll:true});
}
function events(){for(const e of game.events.splice(0)){audio?.event(e);view.emit(e,game);if(e.type==='won'||e.type==='lost'){audio.pause();finished=true;show('tap',false);show('pause',false);show('countdown',false);show('warning',false);modal(e.type);}}}
function press(){if(game?.status!=='playing')return;game.press(audio.time-offset/1000);events();}
$('start').onclick=start;$('pause').onclick=pause;$('continue').onclick=()=>game.status==='paused'?resume():start();
$('back').onclick=()=>{audio?.pause();for(const id of ['modal','hud','pause','timeline','tap','countdown','warning'])show(id,false);show('opening',true);preview();$('start').focus();};
$('sound').onclick=()=>{muted=!muted;audio?.mute(muted);$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'開啟聲音':'關閉聲音');};
$('tap').onpointerdown=e=>{e.preventDefault();press();canvas.focus({preventScroll:true});};
$('tap').onclick=e=>{if(e.detail===0)press();};
document.querySelectorAll('input[name="track"]').forEach(e=>e.onchange=preview);$('practice').onchange=preview;document.querySelectorAll('input[name="difficulty"]').forEach(e=>e.onchange=()=>{try{localStorage.setItem('breath-difficulty',difficulty());}catch{}preview();});
addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(game?.status==='playing')pause();else if(game?.status==='paused')resume();return;}
  if(e.code!=='Space'||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  e.preventDefault();if(e.repeat||held)return;held=true;press();
});addEventListener('keyup',e=>{if(e.code==='Space')held=false;});
addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('pagehide',()=>audio?.stopSource());
function resize(){view.resize(innerWidth,innerHeight,devicePixelRatio||1);}addEventListener('resize',resize);resize();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(game){
    if(game.status==='playing'){game.update(audio.time-offset/1000);visual=game.time;events();}
    else if(game.status==='ready'||finished)visual+=dt;
    view.draw(game,visual,dt,game.status==='ready');
    const playing=game.status==='playing';show('countdown',playing&&game.time<0);
    if(playing&&game.time<0)$('countdown').textContent=Math.ceil(-game.time);
    if(game.status!=='ready'){
      $('combo').textContent=game.combo;$('accuracy').innerHTML=`${game.accuracy}<em>%</em>`;
      $('airValue').textContent=`${Math.ceil(game.air)}%`;$('airFill').style.width=`${game.air}%`;$('airMeter').setAttribute('aria-valuenow',Math.ceil(game.air));
      $('airMeter').classList.toggle('low',game.air<35);show('warning',playing&&game.air<35);
      $('progress').style.width=`${game.progress*100}%`;$('clock').textContent=`${format(game.time)} / ${format(game.track.duration)}`;
      $('form').textContent=`${game.profile.label} / ${['小海豹','圓滾滾','飽飽海豹'][view.sizeStage||0]} · 吃到 ${view.eaten||0} 隻魚`;
      const bodySize=Math.round((view.motion?.growth||1)*100);$('bodySize').textContent=`體型 ${bodySize}%`;$('growthFill').style.width=`${(bodySize-100)/45*100}%`;$('growthMeter').setAttribute('aria-valuenow',bodySize);
      $('chapter').textContent=game.progress<.33?'01 / 晨光入海':game.progress<.66?'02 / 深藍漫遊':'03 / 極光與朋友';
    }
    canvas.dataset.status=game.status;canvas.dataset.time=game.time.toFixed(3);canvas.dataset.nextNote=game.target?.time??'';canvas.dataset.hits=game.hits;canvas.dataset.mode=edition;canvas.dataset.difficulty=game.difficulty;canvas.dataset.noteCount=game.notes.length;canvas.dataset.bodyScale=(view.motion?.growth||1).toFixed(3);canvas.dataset.eaten=view.eaten||0;canvas.dataset.jumpHeight=(view.motion?.height||0).toFixed(4);
  }
  requestAnimationFrame(frame);
}
try{const response=await fetch('assets/music-charts.json');if(!response.ok)throw new Error('譜面讀取失敗');tracks=(await response.json()).tracks;await view.ready;preview();$('start').disabled=false;$('start').textContent='開始聽海 ↗';}
catch(e){$('error').textContent=`冰海暫時無法載入：${e.message}。請重新整理。`;}
requestAnimationFrame(frame);
