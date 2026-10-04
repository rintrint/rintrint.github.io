import {ShoreRun,VARIANTS,clamp} from './core.js';
import {ShoreView} from './view.js';
import {ShoreAudio} from './audio.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
let version=Object.hasOwn(VARIANTS,params.get('v'))?params.get('v'):'a',auto=true,game=new ShoreRun(version,auto),loading=false,ready=false,last=0,paused=false,feedbackAt=-100,lastPhase='';
const view=new ShoreView($('#game')),audio=new ShoreAudio();
const concepts=[...document.querySelectorAll('[data-version]')];
const status=$('#load-status'),watch=$('#watch'),tryButton=$('#try');watch.disabled=tryButton.disabled=true;
view.ready.then(()=>{ready=true;watch.disabled=tryButton.disabled=false;status.textContent='約 16 秒一段 · 建議開啟聲音 · 可隨時切換方案';renderUI();}).catch(err=>{status.textContent=`${err.message}，請重新整理重試。`;console.error(err)});
function describe(){const config=VARIANTS[version];for(const b of concepts){let yes=b.dataset.version===version;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',yes)}$('#scene-code').textContent=`${version.toUpperCase()} / ${config.name}`;$('#note-title').textContent=config.title;$('#note-body').textContent=config.body;$('#rule-entry').textContent=config.rule;$('#mode-tag').textContent=auto?'自動演出':'親自試玩';$('#mode').textContent=auto?'切到親自試玩':'切到自動演出';$('#mode-note').textContent=auto?'自動演出會示範完整成功路線':'對拍上岸 → 連打補氣 → 對拍跨洞';document.title=`${config.name} · 海豹呼呼上岸提案`;}
function reset(){audio.stop();game=new ShoreRun(version,auto);paused=false;last=audio.now;feedbackAt=-100;lastPhase='';$('#feedback').classList.remove('pop');$('#paused').hidden=true;$('#pause').textContent='Ⅱ 暫停';$('#veil').hidden=false;$('#overlay-title').textContent='一口氣，換一場冒險。';$('#overlay-body').innerHTML='先看演出，再親自抓拍點。<br>垂釣者的魚線，是冰洞的預告。';watch.innerHTML='觀看演出 <span>↗</span>';tryButton.innerHTML='親自試玩 <kbd>SPACE</kbd>';describe();renderUI();}
async function start(useAuto){if(!ready||loading)return;loading=true;watch.disabled=tryButton.disabled=true;status.textContent='正在打開冰海的聲音…';
 try{await audio.unlock();auto=useAuto;reset();$('#veil').hidden=true;game.start();last=audio.now;consume();status.textContent='約 16 秒一段 · 建議開啟聲音 · 可隨時切換方案';}
 catch(e){status.textContent='音效載入失敗，請確認網路後再按一次。';console.error(e);audio.loading=null;}
 finally{loading=false;watch.disabled=tryButton.disabled=false;describe();}
}
function consume(){for(const e of game.events){audio.event(e,game);if(e.type==='feedback'){const el=$('#feedback');el.textContent=e.text;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');feedbackAt=game.time;}if(e.type==='phase'&&['done','fail'].includes(e.phase))showResult();}game.events.length=0;}
function showResult(){const success=game.phase==='done';$('#veil').hidden=false;$('#overlay-title').textContent=success?'呼——又能游下去了。':'差一拍，也沒關係。';$('#overlay-body').innerHTML=success?`垂釣者已跌坐雪地，你成功躍進下一個洞。<br>帶著 ${Math.round(game.air)}% 氧氣，繼續找魚吃。`:`${game.outcome}<br>先看一次自動演出，聽聽出手的時機。`;watch.innerHTML='再看一次 <span>↗</span>';tryButton.innerHTML='我來試試 <kbd>SPACE</kbd>';}
function updateTime(){const now=audio.now;let dt=last?Math.max(0,now-last):0;last=now;if(paused)return;while(dt>.00001){const step=Math.min(dt,.025);game.step(step);dt-=step;consume();}}
function press(){if(auto||loading||paused)return;updateTime();game.press();consume();renderUI();}
async function pauseToggle(){if(['ready','done','fail'].includes(game.phase))return;paused=!paused;game.paused=paused;$('#paused').hidden=!paused;$('#pause').textContent=paused?'▶ 繼續':'Ⅱ 暫停';if(paused)await audio.suspend();else{await audio.resume();last=audio.now;}}
function renderUI(){const p=game.phase,a=game.age;$('#air-text').innerHTML=`${Math.round(game.air)}<span>%</span>`;$('#air-fill').style.width=`${game.air}%`;$('#stage').classList.toggle('on-shore',game.onShore);$('#air-status').textContent=p==='breath'?'連打補氣，停下來仍會耗氧':game.air<20?'快沒氣了，別錯過這個洞！':'下一個冰洞，是你的喘息機會。';$('#tap-label').textContent=game.action;$('#tap').disabled=auto||paused||['ready','launch','leap','done','fail'].includes(p);$('#pause').disabled=['ready','done','fail'].includes(p);
 let chapter='01 / 冰下的微光',cue='看到釣魚線，就快到岸了。',hint=version==='b'?'第 2、3、4 拍各按一次，把他拉得搖搖晃晃。':'聽四拍，在第四拍按下 Space 衝出冰洞。';
 if(p==='approach'&&a>=2){cue=version==='b'?'咬住、拉緊、頂上去！':'一、二、三——衝！';}
 if(p==='launch'){chapter='02 / 借過一下！';cue=version==='c'?'就是這一拍。':'撞倒啦！';hint='魚竿脫手，垂釣者跌坐在雪地上。';}
 if(p==='breath'){chapter=`03 / 喘息時間 · 還有 ${Math.max(0,game.config.breath-a).toFixed(1)} 秒`;cue='快補氣，下一個洞還很遠！';hint='連打 Space 或下方按鈕。越接近滿氣，每下增加越少。';}
 if(p==='charge'){chapter='04 / 最重要的一口氣';cue=a<game.config.charge-.65?'聽——深深吸一口。':'現在，跳！';hint='吸氣聲之後的第四個提示音，再按一次 Space。';}
 if(p==='leap'){chapter='05 / 飛過冰海';cue='帶著這口氣，去下一個洞。';hint='海豹落水，水花把新的旅程接起來。';}
 if(p==='done'){chapter='繼續旅程';cue='換氣成功！';hint='';}if(p==='fail'){chapter='再試一次';cue='冰洞錯過了。';hint='';}
 $('#chapter').textContent=chapter;$('#cue').textContent=cue;$('#hint').textContent=hint;
 const words=version==='b'&&p==='approach'?['等','咬','拉','頂！']:p==='charge'?['吸','吸','吸','跳！']:['1','2','3','衝！'];
 $('#beat-words').style.display=['approach','charge'].includes(p)?'flex':'none';[...$('#beat-words').children].forEach((el,i)=>{el.textContent=words[i];el.classList.toggle('on',game.beat===i)});
}
for(const button of concepts)button.addEventListener('click',()=>{if(loading)return;version=button.dataset.version;history.replaceState(null,'',`?v=${version}`);reset();if(ready)start(auto)});
watch.addEventListener('click',()=>start(true));tryButton.addEventListener('click',()=>start(false));$('#replay').addEventListener('click',()=>start(auto));$('#mode').addEventListener('click',()=>start(!auto));$('#pause').addEventListener('click',pauseToggle);$('#resume').addEventListener('click',pauseToggle);$('#tap').addEventListener('pointerdown',e=>{e.preventDefault();press()});
$('#sound').addEventListener('click',()=>{const on=audio.mute();$('#sound').textContent=`聲音 ${on?'開啟':'關閉'}`;$('#sound').setAttribute('aria-pressed',!on)});
document.addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Space'){if(['ready','done','fail'].includes(game.phase)||paused)return;e.preventDefault();press()}else if(e.code==='Escape'){e.preventDefault();pauseToggle()}else if(e.code==='KeyR'&&!e.ctrlKey&&!e.metaKey)start(auto)});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&!['ready','done','fail'].includes(game.phase))pauseToggle()});
let lastDraw=performance.now();function frame(now){const delta=(now-lastDraw)/1000;lastDraw=now;updateTime();view.draw(game,Math.min(delta,.1));renderUI();requestAnimationFrame(frame)}describe();requestAnimationFrame(frame);
// Read-only state is useful when comparing recorded runs and checking browser errors.
Object.defineProperty(window,'shoreDemo',{get:()=>({version,mode:auto?'auto':'manual',phase:game.phase,time:game.time,age:game.age,air:game.air,tug:game.tug,refills:game.refills,paused,ready})});
