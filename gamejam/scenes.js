import {editionLinks} from './edition-nav.js';
import {ScenesAudio} from './scenes-audio.js';
import {hungerPose} from './scenes-media.js';
import {ScenesView} from './scenes-view.js';
const {JourneyRun}=window.BreathJourney;
document.body.innerHTML=`<main class="world" data-scene="start"><canvas id="scene" tabindex="0" aria-label="第八版冰海四幕"></canvas><div class="grain"></div>
<header><a class="brand" href="index.html">≈ Breath <small>一口氣的旅程</small></a><nav aria-label="切換遊戲版本">${editionLinks('scenes')}</nav><div class="tools"><button id="sound" aria-label="開啟聲音" aria-pressed="false" title="點一下聽開始介面音樂">♫</button><button id="pause" class="hidden" aria-label="暫停">Ⅱ</button></div></header>
<div class="scene-number" id="sceneNumber">01 / 冰川上的小海豹</div>
<section id="opening" class="opening"><div class="eyebrow">08 / A LITTLE SEAL, A WHOLE OCEAN</div><h1>一口氣，游向你。<em>BREATH · ARCTIC JOURNEY</em></h1><p class="intro">肚子扁扁，海卻很大。<br>吸一口氣，讓音樂帶你找小魚。</p><div class="start-row"><button class="primary" id="start" disabled>正在準備冰海…</button><button class="setup-link" id="openSetup">選曲與設定</button><p class="difficulty-note" id="difficultyNote"></p></div><p id="error" class="error" role="alert"></p></section>
<div class="scrim hidden" id="setup"><section class="setup-card" role="dialog" aria-modal="true" aria-labelledby="setupTitle"><div class="setup-head"><h2 id="setupTitle">選一首海。</h2><button id="closeSetup" aria-label="關閉設定">×</button></div>
<fieldset class="songs"><legend>選一首海 · 原速完整歌曲</legend><label><input type="radio" name="track" value="wash1" checked><span><b>Oceanic Wash</b><small>明亮的潮汐 / 3:39</small></span></label><label><input type="radio" name="track" value="wash2"><span><b>Oceanic Wash 2</b><small>緩緩的海風 / 3:39</small></span></label></fieldset>
<fieldset class="difficulties"><legend>每個難度都有 438 隻魚</legend><label><input type="radio" name="level" value="beginner" checked><span><b>新手</b><small>魚群 · 寬鬆</small></span></label><label><input type="radio" name="level" value="intermediate"><span><b>中階</b><small>交錯 · 標準</small></span></label><label><input type="radio" name="level" value="expert"><span><b>高手</b><small>單魚 · 精準</small></span></label></fieldset>
<label class="practice"><input type="checkbox" id="practice">輕鬆練習<small>不會死亡</small></label><details class="settings"><summary>拍點試聽與耳機校正 <span id="offsetLabel">0 ms</span></summary><p>試聽會在實際譜面起音加上輕響。聽到輕響時點「跟拍」，收集 6 次以上再套用。校正含個人反應時間，可手動微調。</p><div class="sync-buttons"><button id="listen">試聽 16 秒</button><button id="calTap">跟拍</button><button id="applyOffset" disabled>套用校正</button></div><p class="sync-status" id="syncStatus">輸出裝置延遲會自動補償；此處調整剩餘誤差。</p><label for="offset">正值延後畫面與判定</label><input id="offset" type="range" min="-250" max="250" step="5" value="0"></details><a class="audit-link" href="beat-recorder.html" target="_blank">手動錄拍工具 ↗</a> · <a class="audit-link" href="JOURNEY-DESIGN.md" target="_blank">遊戲規則與設計核對 ↗</a><details class="settings sound-library"><summary>音效試聽 · 團隊素材</summary><p>開始介面音樂：Rolling Tides。點右上角 ♫ 開啟；遊戲仍使用原本兩首歌曲。</p><label for="soundChoice">音效</label><select id="soundChoice"><option value="start">遊戲開始</option><option value="inhale">吸氣</option><option value="breathGood">精準呼吸</option><option value="breathBad">不精準呼吸</option><option value="dive">下水大水花</option><option value="surface">出水</option><option value="eat">吃魚</option><option value="ice">撞到冰</option><option value="fisher">撞倒垂釣者</option><option value="hungry">肚子餓</option><option value="happy">海豹開心／呼喚</option><option value="sad">海豹難過</option><option value="belly">海豹拍肚子</option><option value="ghost">變成餓死鬼</option><option value="angel">變成天使</option><option value="button">按鍵</option></select><button id="previewSound">試聽音效</button><p id="soundStatus" role="status"></p></details><div class="preview-bar"><b>四幕畫面預覽 · 不會開始遊戲</b><button data-preview="start">開始</button><button data-preview="breath">蓄氣</button><button data-preview="dive">海底</button><button data-preview="friends">朋友</button><button data-preview="rest">攤平</button><button data-preview="hungryGhost">餓死鬼</button><button data-preview="angel">天使</button></div></section></div><div class="preview-control hidden" id="previewControl">畫面預覽 · 非實際成績<button id="exitPreview">返回</button></div>
<section id="breathCaption" class="breath-caption hidden"><h2>慢慢吸氣，讓兩個圈重合。</h2><p>至少 90% · 按 SPACE 或右下角吸氣 · 錯過就等下一輪</p></section>
<section id="hud" class="hud route-hud hidden"><div class="song-info"><small id="chapter"></small><h2 id="trackTitle"></h2><span id="form"></span></div><div class="stats"><div class="air"><small>肺活量 <span id="airValue"></span></small><div id="airMeter" role="progressbar" aria-label="肺活量" aria-valuemin="0" aria-valuemax="100"><i id="airFill"></i></div></div><div class="food"><small>飽食度 <span id="foodValue"></span></small><div class="food-meter" role="progressbar" id="foodMeter" aria-label="飽食度" aria-valuemin="0" aria-valuemax="360"><i id="foodFill"></i></div></div></div><div class="rhythm-labels"><span>120 · 長大</span><span>240 · 進化</span><span>360 · 吃飽</span></div></section>
<div class="journey-hint hidden" id="hint" aria-live="polite"></div><div class="warning hidden" id="warning" role="status"></div><button class="tap hidden" id="tap">吸氣<small>SPACE</small></button>
<section id="ending" class="end-card hidden" aria-live="polite"><div class="eyebrow" id="endLabel"></div><h2 id="endTitle"></h2><p id="endCopy"></p><button class="primary" id="retry">再一次 ↗</button><button class="text-button" id="back">回到選曲</button></section>
<div class="scrim hidden" id="paused"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="pauseTitle"><h2 id="pauseTitle">海會等你。</h2><p>氧氣、音樂與旅程都停在這一刻。</p><button class="primary" id="resume">繼續旅行 ↗</button><button class="text-button" id="quit">回到選曲</button></section></div>
<footer><span>438 隻魚 · 3 段海 · 1 口氣</span><span class="key-hint"><kbd>SPACE</kbd> 準拍吃魚 / 換氣 / 下海 <i>·</i> ESC 暫停</span><span id="clock">約 3 分 39 秒</span></footer><div class="timeline"><i id="progress"></i></div></main>`;
const $=id=>document.getElementById(id),show=(id,on)=>$(id).classList.toggle('hidden',!on),view=new ScenesView($('scene'));
let artPreview=null,lastBreathCycle=-1,lastHungerCycle=-1;
let tracks=[],game,audio,offset=0,muted=false,loading=false,breathTime=0,previous=0,visual=0,finished=false,audition=false,samples=[],clicks=[],lastCal=-1;
try{offset=Number(localStorage.getItem('breath-journey-offset'))||0;}catch{}
const setOffset=n=>{offset=Math.max(-250,Math.min(250,Math.round(n/5)*5));$('offset').value=offset;$('offsetLabel').textContent=`${offset} ms`;try{localStorage.setItem('breath-journey-offset',offset);}catch{}};setOffset(offset);
$('offset').oninput=()=>setOffset(Number($('offset').value));
const selection=()=>tracks.find(t=>t.id===document.querySelector('[name=track]:checked').value),level=()=>document.querySelector('[name=level]:checked').value;
function preview(){if(!tracks.length)return;game=new JourneyRun(selection(),level(),$('practice').checked);view.reset(game);finished=false;$('clock').textContent='約 3 分 39 秒';$('progress').style.width='0%';$('difficultyNote').textContent=`${game.notes.length} 拍 · 判定 ±${Math.round(game.window*1000)} ms · 每段 146 隻，累積 120／240 隻進化`;$('start').textContent='PRESS START · 出發';}
function syncSoundButton(){$('sound').setAttribute('aria-pressed',!!audio&&!muted);$('sound').setAttribute('aria-label',audio?'切換聲音':'開啟聲音');$('sound').textContent=muted?'♪̸':'♫';}
async function prepareAudio(){audio??=new ScenesAudio();await audio.ctx.resume();audio.mute(muted);await audio.loadSamples();syncSoundButton();return audio;}
async function getAudio(track=selection()){await prepareAudio();await audio.load(track);return audio;}
function menuMusic(){if(!audio||muted||document.hidden||audition||game?.status!=='ready')return;audio.menu().then(()=>{if(audio.menuVoice&&lastHungerCycle<0)visual=0;}).catch(e=>$('error').textContent=e.message);}

function stopAudition(){if(audition)audio?.pause();audition=false;$('listen').textContent='試聽 16 秒';}
async function start(){
  if(loading||!tracks.length)return;artPreview=null;show('previewControl',false);show('setup',false);loading=true;$('start').disabled=true;$('error').textContent='';stopAudition();audio?.stopMenu();audio?.stopEffects();
  const track=selection(),difficulty=level(),practice=$('practice').checked;
  try{await getAudio(track);audio.filter.frequency.value=18000;audio.lastHeart=-100;game=new JourneyRun(track,difficulty,practice);game.startBreath();view.reset(game);breathTime=0;lastBreathCycle=-1;finished=false;audio.sample('start',{volume:.3});for(const id of ['opening','ending','paused','hint','warning','hud'])show(id,false);for(const id of ['breathCaption','tap','pause','hud'])show(id,true);$('tap').firstChild.textContent='吸氣';$('scene').focus();if(document.hidden)pause();}
  catch(e){$('error').textContent='無法載入音樂：'+e.message;}finally{loading=false;$('start').disabled=false;}
}
function press(){if(artPreview)return;if(game?.status==='breathing'){game.inhale(breathTime);audio.stopEffects();audio.play(0);show('breathCaption',false);show('hud',true);show('hint',true);$('tap').firstChild.textContent='準拍';$('trackTitle').textContent=game.track.title;events();}else if(game?.status==='playing'){game.press(Math.max(0,audio.time-offset/1000));events();}}
function events(){for(const e of game.events.splice(0)){audio?.event(e,game);view.emit(e,game);if(['won','lost'].includes(e.type))finish();}}
function finish(){if(finished)return;finished=true;audio.pause();for(const id of ['tap','pause','warning','hint'])show(id,false);show('ending',true);
  const messages={friends:['吃飽了，也交到朋友了。','你跨過冰洞、呼喚了同伴。下一次，一起游吧。'],rest:['沒吃飽，先攤一下。','活著走完旅程了。海豹趴在岸上，肚子還想要更多小魚。'],hungryGhost:['還餓著的小幽靈。','沒有累積到 240 隻魚，空空的肚子變成了一隻餓死鬼。'],angel:['有翅膀的小海豹。','已累積至少 240 隻魚，這次化成天使，下一次再回到海裡。']};
  const reason={oxygen:'氧氣耗盡。',leap:'沒有對上大吸氣跨洞拍。',entry:'沒有對上第一次下海拍。',route:'沒有完成跨洞、上岸與呼喚。'};
  $('endLabel').textContent=(game.practice?'PRACTICE / ':'')+(game.status==='won'?'旅程完成':'旅程結束');$('endTitle').textContent=messages[game.outcome][0];$('endCopy').textContent=`${reason[game.reason]||''}${messages[game.outcome][1]} 吃到 ${game.food} / 438 隻魚；吃飽目標 360 隻。準確率 ${game.accuracy}%。`;
}
function pause(){if(artPreview||!game||!['playing','breathing'].includes(game.status))return;if(game.status==='playing')audio.pause();audio?.stopEffects();game.pause();show('paused',true);$('resume').focus();}
function resume(){if(game.status!=='paused')return;game.resume();if(game.status==='playing')audio.resume();show('paused',false);$('scene').focus();}
function back(){artPreview=null;show('previewControl',false);show('setup',false);audio?.silence();stopAudition();for(const id of ['paused','ending','hud','tap','pause','hint','warning','breathCaption'])show(id,false);show('opening',true);preview();lastHungerCycle=-1;menuMusic();}
$('start').onclick=start;$('retry').onclick=start;$('back').onclick=back;$('quit').onclick=back;$('pause').onclick=pause;$('resume').onclick=resume;
$('sound').onclick=async()=>{try{if(!audio){await prepareAudio();lastHungerCycle=-1;menuMusic();}else{muted=!muted;audio.mute(muted);if(muted){audio.stopEffects();audio.stopMenu();}else{await audio.ctx.resume();menuMusic();}syncSoundButton();}}catch(e){$('error').textContent=e.message;}};
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#tap,#sound'))audio?.sample('button',{volume:.25});},true);
$('tap').onpointerdown=e=>{e.preventDefault();press();};$('tap').onclick=e=>{if(e.detail===0)press();};
document.querySelectorAll('[name=track],[name=level],#practice').forEach(e=>e.onchange=()=>{stopAudition();preview();});
addEventListener('keydown',e=>{if(e.code==='Escape'){if(artPreview){back();return;}if(!$('setup').classList.contains('hidden')){closeSetup();return;}game?.status==='paused'?resume():pause();return;}if(e.code!=='Space'||e.repeat||/INPUT|BUTTON|SUMMARY/.test(e.target.tagName))return;e.preventDefault();if(audition)calTap();else press();});
addEventListener('blur',()=>{pause();stopAudition();audio?.stopMenu();audio?.stopEffects();});addEventListener('focus',menuMusic);document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();stopAudition();audio?.stopMenu();audio?.stopEffects();}else menuMusic();});addEventListener('pagehide',()=>audio?.silence());
$('listen').onclick=async()=>{
  if(audition){stopAudition();return;}if(loading)return;loading=true;$('listen').disabled=true;
  try{await getAudio();samples=[];lastCal=-1;$('applyOffset').disabled=true;clicks=game.notes.filter(n=>n.kind==='fish'&&n.time>=7&&n.time<23).map(n=>n.time);audio.play(6);for(const t of clicks)audio.clickAt(t);audition=true;$('listen').textContent='停止試聽';$('syncStatus').textContent='聽到清脆輕響時，點「跟拍」；不需要盯著畫面。';}
  catch(e){$('error').textContent=e.message;}finally{loading=false;$('listen').disabled=false;}
};
function calTap(){if(!audition)return;const t=audio.time,i=clicks.reduce((best,n,j)=>Math.abs(n-t)<Math.abs(clicks[best]-t)?j:best,0);if(i===lastCal||Math.abs(clicks[i]-t)>.3)return;lastCal=i;samples.push((t-clicks[i])*1000);const sorted=[...samples].sort((a,b)=>a-b);const median=sorted[Math.floor(sorted.length/2)];$('syncStatus').textContent=`已收集 ${samples.length} 次 · 建議 ${Math.round(median)} ms（包含你的反應時間）`;$('applyOffset').disabled=samples.length<6;}
$('calTap').onclick=calTap;$('applyOffset').onclick=()=>{if(samples.length<6)return;setOffset([...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]);stopAudition();$('syncStatus').textContent=`已套用 ${offset} ms，可再次試聽或手動微調。`;};
function closeSetup(){stopAudition();audio?.stopEffects();menuMusic();show('setup',false);$('openSetup').focus();}
$('openSetup').onclick=()=>{show('setup',true);$('closeSetup').focus();};$('closeSetup').onclick=closeSetup;
$('setup').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=[...$('setup').querySelectorAll('button:not(:disabled),input,summary,a')].filter(n=>n.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
document.querySelectorAll('[data-preview]').forEach(button=>button.onclick=()=>{
  stopAudition();audio?.silence();preview();artPreview=button.dataset.preview;show('setup',false);
  for(const id of ['opening','breathCaption','hud','hint','warning','ending','tap','pause'])show(id,false);
  if(artPreview==='start')show('opening',true);
  else if(artPreview==='breath'){game.startBreath();breathTime=2.48;show('breathCaption',true);show('hud',true);}
  else if(artPreview==='dive'){game.status='playing';game.phase='underwater';game.time=18;game.air=73;game.food=30;game.stageFood[0]=30;game.depth=24;game.notes.filter(n=>n.time<18).forEach(n=>n.result='perfect');game.cursor=game.notes.findIndex(n=>!n.result);show('hud',true);show('hint',true);}
  else{game.status=['friends','rest'].includes(artPreview)?'won':'lost';game.outcome=artPreview;game.food={friends:380,rest:310,hungryGhost:170,angel:260}[artPreview];game.phase='shore';game.leaped=true;game.called=true;show('ending',true);$('endLabel').textContent='ENDING / 畫面預覽';$('endTitle').textContent={friends:'吃飽了，也交到朋友了。',rest:'沒吃飽，先攤一下。',hungryGhost:'還餓著的小幽靈。',angel:'有翅膀的小海豹。'}[artPreview];$('endCopy').textContent='這是結局的美術預覽，實際結局會依旅程與進食結果決定。';}
  show('previewControl',true);$('exitPreview').focus();
});$('exitPreview').onclick=back;
$('previewSound').onclick=async()=>{const button=$('previewSound');button.disabled=true;try{await prepareAudio();if(muted){$('soundStatus').textContent='目前已靜音，請先開啟右上角聲音。';return;}audio.stopMenu();audio.stopEffects();const key=$('soundChoice').value;audio.sample(key,{volume:.45});$('soundStatus').textContent='正在試聽：'+$('soundChoice').selectedOptions[0].textContent;}catch(e){$('soundStatus').textContent=e.message;}finally{button.disabled=false;}};
function resize(){view.resize(innerWidth,innerHeight,devicePixelRatio||1);}addEventListener('resize',resize);resize();
const fmt=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
function frame(now){const dt=Math.min(.05,(now-previous)/1000||0);previous=now;
  if(game){if(game.status==='breathing'&&!artPreview)breathTime+=dt;if(game.status==='ready'&&!document.hidden)visual+=dt;
    if(!artPreview&&audio?.enabled&&!document.hidden){if(game.status==='breathing'){const cycle=Math.floor(breathTime/3.6);if(cycle!==lastBreathCycle){lastBreathCycle=cycle;audio.sample('inhale',{volume:.6,duration:2.7});}}else if(game.status==='ready'&&audio.menuVoice){const cycle=hungerPose(visual).cycle;if(cycle!==lastHungerCycle){lastHungerCycle=cycle;audio.sample('hungry',{volume:.6});}}}
    if(!artPreview&&game.status==='playing'){game.update(Math.max(0,audio.time-offset/1000));events();audio.danger(game.danger,game.time);}
    view.draw(game,game.status==='breathing'||game.status==='paused'&&game.beforePause==='breathing'?breathTime:game.status==='ready'?visual:game.time,dt);
    const screen=view.flow.current;document.querySelector('.world').dataset.scene=screen;document.querySelector('.world').dataset.outcome=game.outcome||'';document.querySelector('.world').dataset.preview=!!artPreview;
    $('sceneNumber').textContent={start:'01 / 冰川上的小海豹',breath:'02 / 給自己一口氣',dive:'03 / 循著音樂，游向海底',ending:'04 / 旅程的另一端'}[screen];
    if(game.status==='breathing'||game.status==='paused'&&game.beforePause==='breathing'){const air=Math.round(Math.min(1,game.breathSize(breathTime))*100);$('airValue').textContent=air+'%';$('airFill').style.width=air+'%';$('airMeter').setAttribute('aria-valuenow',air);$('airMeter').classList.toggle('low',false);$('chapter').textContent='準備下海';$('trackTitle').textContent=game.track.title;$('form').textContent='至少吸滿 90%';}
    if(game.status==='playing'||finished){
      const stage=game.track.stageBounds.findIndex((b,i,a)=>i<a.length-1&&game.time>=b&&game.time<a[i+1]);const s=Math.max(0,Math.min(2,stage<0?game.progress>.9?2:0:stage));
      $('trackTitle').textContent=game.track.title;$('chapter').textContent=`0${s+1} / ${['晨光淺海','藍色冰廊','極光歸途'][s]} · 本段 ${game.stageFood[s]} / 146 隻`;
      $('form').textContent=`${['小海豹','圓滾滾','飽飽海豹'][game.form]} · 體型 ${Math.round(view.motion.growth*100)}% · ${game.depth} m`;
      $('airValue').textContent=`${Math.ceil(game.air)}%`;$('airFill').style.width=game.air+'%';$('airMeter').setAttribute('aria-valuenow',Math.ceil(game.air));$('airMeter').classList.toggle('low',game.air<35);
      $('foodValue').textContent=`${game.food} / 360`;$('foodFill').style.width=Math.min(100,game.food/360*100)+'%';$('foodMeter').setAttribute('aria-valuenow',Math.min(360,game.food));
      $('progress').style.width=game.progress*100+'%';$('clock').textContent=fmt(game.time)+' / '+fmt(game.track.duration);
      const next=game.target,gate=game.notes.slice(game.cursor).find(n=>!n.result&&n.kind!=='fish');
      $('hint').innerHTML=`<strong>${game.phase==='underwater'?'在琴音落下時，吃到小魚。':game.phase==='surface'?'吸一小口氣，再出發。':game.called?'朋友聽見了，旅程即將完成。':'準拍下海，從冰縫出發。'}</strong>${game.phase==='underwater'?`下一個冰洞：${Math.max(0,(gate?.time||0)-game.time).toFixed(1)} 秒 · 連擊 ${game.combo}`:next?`下一拍：${{dive:'入水',leap:'大吸氣跨洞',call:'呼喚同伴',exit:'上岸'}[next.kind]||'跟上音樂'}`:''}`;
      show('warning',game.status==='playing'&&game.danger>.05);$('warning').textContent=game.air<10?'最後一口氣！準拍衝向釣魚人的洞口。':game.air<25?'氧氣不足，下一個冰洞一定要抓準。':'呼吸漸急。看好釣魚人，準備上岸。';
    }
    Object.assign($('scene').dataset,{status:game.status,phase:game.phase,time:game.time.toFixed(3),nextNote:game.target?.time??'',nextKind:game.target?.kind??'',food:game.food,air:game.air.toFixed(2),outcome:game.outcome||'',breath:game.breathSize(breathTime).toFixed(3),hungerFrame:view.canvasFrame??0,audioState:audio?.ctx.state||'locked',menuAudio:!!audio?.menuVoice,effect:audio?.lastCue||'',effectCount:audio?.voices.size||0});
  }if(audition){$('listen').dataset.time=audio.time.toFixed(3);$('listen').dataset.nextClick=clicks.find(t=>t>=audio.time-.1)??'';if(audio.time>=22.9)stopAudition();}requestAnimationFrame(frame);
}
try{const res=await fetch('assets/journey-charts.json');if(!res.ok)throw Error('譜面讀取失敗');tracks=(await res.json()).tracks;await view.ready;preview();$('start').disabled=false;}catch(e){$('error').textContent=e.message;}
requestAnimationFrame(frame);
