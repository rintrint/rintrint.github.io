import {editionLinks} from './edition-nav.js?v=13.0';
import {JourneyAudio} from './tide-audio.js';
import {DashView} from './dash-view.js';
const $=s=>document.querySelector(s),view=new DashView($('#scene'));
$('#editions').innerHTML=editionLinks('dash');
let chart,audio,game=null,paused=false,busy=false,lastFrame=0,muted=false,offset=0,lastMode=false;
const keys=new Map(),held={air:new Set(),ground:new Set()},keyLane={KeyD:'air',KeyF:'air',ArrowUp:'air',KeyJ:'ground',KeyK:'ground',Space:'ground',ArrowDown:'ground'};
try{offset=Math.max(-200,Math.min(200,Number(localStorage.getItem('breath-dash-offset'))||0));}catch{}
$('#offset').value=offset;$('#offset-label').value=`${offset} ms`;
$('#offset').oninput=e=>{offset=Number(e.target.value);$('#offset-label').value=`${offset} ms`;try{localStorage.setItem('breath-dash-offset',offset);}catch{}};
const ready=Promise.all([view.ready,fetch('assets/dash/chart.json').then(r=>{if(!r.ok)throw new Error('譜面載入失敗');return r.json();}).then(c=>chart=c)]);
// Keep a handled initialization promise so a missing asset is reported on Start.
let initError;ready.catch(e=>{initError=e;$('#mode-label').textContent='素材載入失敗，請重新整理';});
function clock(){return Math.max(0,(audio?.time||0)-offset/1000);}
function clearKeys(){keys.clear();held.air.clear();held.ground.clear();$('.pad.air').classList.remove('pressed');$('.pad.ground').classList.remove('pressed');}
function modeUI(active){$('#opening').hidden=active;$('.hud').hidden=!active;$('.playbar').hidden=!active;$('.settings').open=false;$('#section').disabled=active;}
async function start(autoplay=false){
  if(busy)return;busy=true;$('#loading').hidden=false;$('#loading').textContent='正在準備音樂與冰海…';$('#start').disabled=true;$('#demo').disabled=true;
  try{
    if(initError)throw initError;await ready;audio??=new JourneyAudio();await audio.load({id:'dash-reference',src:chart.audio});
    const from=Number($('#section').value);game=new window.BreathDash.DashGame(chart,{autoplay,practice:$('#practice').checked,start:from});
    lastMode=autoplay;paused=false;clearKeys();view.reset();modeUI(true);$('#result').hidden=true;$('#pause-card').hidden=true;$('#judgement').classList.remove('show');
    $('#mode-label').textContent=autoplay?'自動演示 · 不列入成績':`${from?'段落練習 · ':''}${game.practice?'練習不中斷':'完整挑戰'} · 固定 Lv.9 譜面`;
    audio.mute(muted);audio.play(from);updateHUD();
  }catch(e){$('#loading').textContent=`無法開始：${e.message}`;setTimeout(()=>{$('#loading').hidden=true;},4000);busy=false;$('#start').disabled=false;$('#demo').disabled=false;return;}
  $('#loading').hidden=true;busy=false;$('#start').disabled=false;$('#demo').disabled=false;
}
function home(){if(busy)return;audio?.stopSource();game=null;paused=false;clearKeys();view.reset();modeUI(false);$('#pause-card').hidden=true;$('#result').hidden=true;$('#judgement').classList.remove('show');$('#progress').style.width='0%';$('#mode-label').textContent='一首曲子，一份固定譜面';}
function pause(){if(!game||game.status!=='playing'||paused)return;game.advance(clock());audio.pause();paused=true;clearKeys();$('#pause-card').hidden=false;handleEvents();}
function resume(){if(!paused)return;clearKeys();game.held.air=false;game.held.ground=false;audio.resume();paused=false;$('#pause-card').hidden=true;}
function down(lane,key){if(!game||game.status!=='playing'||paused||game.autoplay||keys.has(key))return;keys.set(key,lane);held[lane].add(key);$(`.pad.${lane}`).classList.add('pressed');game.press(lane,clock());handleEvents();}
function up(key){const lane=keys.get(key);if(!lane)return;keys.delete(key);held[lane].delete(key);if(!held[lane].size){$(`.pad.${lane}`).classList.remove('pressed');if(game&&!paused)game.release(lane,clock());handleEvents();}}
document.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();paused?resume():pause();return;}if(e.target.matches('input,select,textarea'))return;const lane=keyLane[e.code];if(lane&&game){e.preventDefault();if(!e.repeat)down(lane,e.code);}});
document.addEventListener('keyup',e=>{if(keyLane[e.code]){e.preventDefault();up(e.code);}});
for(const lane of ['air','ground']){const pad=$(`#${lane}-pad`);pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);down(lane,`touch-${e.pointerId}`);});for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>up(`touch-${e.pointerId}`));}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
$('#start').onclick=()=>start(false);$('#demo').onclick=()=>start(true);$('#again').onclick=()=>start(lastMode);$('#pause').onclick=pause;$('#resume').onclick=resume;document.querySelectorAll('.back').forEach(b=>b.onclick=home);
$('#sound').onclick=()=>{muted=!muted;audio?.mute(muted);$('#sound').textContent=`聲音 ${muted?'關':'開'}`;};
function feedback(title,subtitle='',miss=false){const el=$('#judgement');el.style.color=miss?'#b26c75':'#3d7d96';el.replaceChildren(document.createTextNode(title));if(subtitle){const s=document.createElement('small');s.textContent=subtitle;el.append(s);}el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function handleEvents(){if(!game)return;for(const e of game.drain()){view.emit(e);if(e.type==='hit')feedback(e.result==='perfect'?'PERFECT':'GREAT',e.error===null?'':Math.abs(e.error)<.01?'剛剛好':`${e.error<0?'快':'慢'} ${Math.round(Math.abs(e.error)*1000)} ms`);if(e.type==='miss')feedback('MISS','下一拍，再一起走。',true);if(e.type==='hazard')feedback(e.safe?'NICE JUMP':'OUCH',e.safe?'輕輕躍過冰刺':'上軌按鍵可以跳起',!e.safe);if(e.type==='mash')feedback('連打！',`${e.note.hits} / ${e.note.required}`);if(e.type==='end')finish();}}
function finish(){
  audio?.pause();paused=false;clearKeys();$('#pause-card').hidden=true;$('#result').hidden=false;$('.playbar').hidden=true;
  $('#result-tag').textContent=game.autoplay?'AUTO PLAY / 影片譜面演示':game.practice?'PRACTICE / 練習紀錄':Number($('#section').value)?'SECTION / 段落練習':'YOUR RHYTHM';
  $('#result-title').textContent=game.status==='lost'?'歇一口氣，再出發。':game.autoplay?'同一片海，不同的節奏。':game.missed===0?'每一拍，都接住了。':'把這段浪，留在心裡。';
  $('#result-stats').innerHTML=[[game.accuracy.toFixed(2)+'%','準確率'],[game.maxCombo,'最大連擊'],[game.missed,'MISS'],[game.perfect,'PERFECT'],[game.great,'GREAT'],[game.score.toLocaleString(),'分數']].map(([v,s])=>`<div><strong>${v}</strong><small>${s}</small></div>`).join('');
  const e=game.errors,mean=e.length?e.reduce((a,b)=>a+b)/e.length:0,sd=e.length?Math.sqrt(e.reduce((a,b)=>a+(b-mean)**2,0)/e.length):0;
  $('#result-timing').textContent=game.autoplay?'演示使用影片重建時間點。原影片打擊音效已包含在音源內。':e.length?`命中 ${e.length} 次按鍵，平均${mean<0?'快':'慢'} ${Math.abs(mean).toFixed(0)} ms，分散程度 ${sd.toFixed(0)} ms。此統計僅包含成功命中的按鍵。`:'尚無有效的按鍵時間紀錄。可先觀看自動演示。';
}
function updateHUD(){if(!game)return;$('#combo').textContent=game.combo;$('#accuracy').textContent=game.accuracy.toFixed(2)+'%';$('#health-text').textContent=game.health;$('#health-fill').style.width=`${game.health/2}%`;$('#health-fill').style.background=game.health<60?'#c97f86':'#4e9db3';$('#progress').style.width=`${Math.max(0,Math.min(100,game.time/chart.duration*100))}%`;$('#time').textContent=`${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')} / 2:20`;}
function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000||.016);lastFrame=now;if(game&&!paused&&game.status==='playing'){game.advance(clock());handleEvents();updateHUD();}view.render(game,now/1000,paused?0:dt);requestAnimationFrame(frame);}
const resize=()=>{const r=$('.stage').getBoundingClientRect();view.resize(r.width,r.height,devicePixelRatio||1);};new ResizeObserver(resize).observe($('.stage'));resize();ready.then(()=>requestAnimationFrame(frame)).catch(()=>{});
