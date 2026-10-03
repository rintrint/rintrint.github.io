import {JourneyAudio} from './tide-audio.js';
const {BeatRecording}=window.BreathRecorder;
const tracks={wash1:{id:'wash1',title:'Oceanic Wash',src:'assets/audio/oceanic-wash.mp3'},wash2:{id:'wash2',title:'Oceanic Wash 2',src:'assets/audio/oceanic-wash-2.mp3'}};
const $=id=>document.getElementById(id),key=id=>'breath-manual-beats-v1-'+id;
let audio,recording=new BeatRecording(Infinity),position=0,duration=0,loaded='',busy=false,playing=false,lastSave=0,flashTimer,storageFailed=false;
const format=t=>`${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6,'0')}`;
function updatePoints(){const n=recording.points.length;$('count').textContent=n+' 拍';$('lastBeat').textContent=n?recording.points.at(-1).toFixed(3)+' 秒':'—';$('preview').value=recording.text;$('undo').disabled=!n||busy;$('download').disabled=!n;$('preview').scrollTop=$('preview').scrollHeight;}
function controls(){ $('song').disabled=busy||playing;$('play').disabled=busy;$('reset').disabled=busy;$('beat').disabled=!playing;$('play').textContent=busy?'載入音樂中…':playing?'暫停':position>=duration&&duration?'已播放完畢':position>0?'繼續錄拍':'播放並開始錄拍';if(!playing&&duration&&position>=duration)$('play').disabled=true;updatePoints();}
function save(){try{localStorage.setItem(key($('song').value),JSON.stringify({points:recording.points,position,duration}));storageFailed=false;}catch{if(!storageFailed){$('error').textContent='瀏覽器無法暫存，請記得下載 TXT 保存。';storageFailed=true;}}}
function restore(){let draft;try{draft=JSON.parse(localStorage.getItem(key($('song').value))||'null');}catch{}
  duration=Number.isFinite(draft?.duration)&&draft.duration>0?draft.duration:0;recording=new BeatRecording(duration||Infinity,Array.isArray(draft?.points)?draft.points:[]);
  position=Math.min(duration||Infinity,Math.max(0,Number.isFinite(draft?.position)?draft.position:0,recording.points.at(-1)||0));loaded='';lastSave=position;
  $('status').textContent=recording.points.length?`已恢復 ${recording.points.length} 拍；按「繼續錄拍」從暫存位置接著錄。`:'準備好了就開始；只播放原曲，不加節拍音。';controls();}
function pause(message='已暫停，拍點已保留。'){if(!playing)return;audio.pause();position=Math.min(duration,Math.max(0,audio.time));playing=false;save();controls();$('status').textContent=message;}
async function play(){if(busy)return;if(playing){pause();return;}busy=true;controls();$('error').textContent='';
  try{audio??=new JourneyAudio();const track=tracks[$('song').value];if(loaded!==track.id){await audio.load(track);loaded=track.id;duration=audio.buffer.duration;recording=new BeatRecording(duration,recording.points);position=Math.min(position,duration);}await audio.ctx.resume();
    if(position>=duration){$('status').textContent='音樂已播完，可以下載 TXT，或清空後重新錄製。';return;}
    audio.play(position);playing=true;$('status').textContent='錄製中：跟著你聽見的音樂按空白鍵。';
    if(document.hidden)pause('離開分頁，已自動暫停。');
  }catch(e){$('error').textContent='音樂載入失敗，請重試。'+e.message;playing=false;}
  finally{busy=false;controls();if(playing)$('beat').focus({preventScroll:true});}
}
function tap(){if(!playing||busy)return;const t=audio.time;if(t<0||t>=duration)return;if(!recording.add(t))return;position=t;updatePoints();save();$('beat').classList.add('flash');clearTimeout(flashTimer);flashTimer=setTimeout(()=>$('beat').classList.remove('flash'),100);}
$('play').onclick=play;
$('beat').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();tap();};$('beat').onclick=e=>{if(e.detail===0)tap();};
addEventListener('keydown',e=>{if(e.code!=='Space'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.closest('button')&&e.target.id!=='beat')return;e.preventDefault();if(!e.repeat)tap();});
$('undo').onclick=()=>{recording.undo();updatePoints();save();$('status').textContent='已撤銷上一拍。';if(playing)$('beat').focus({preventScroll:true});};
$('reset').onclick=()=>{pause();if(recording.points.length&&!confirm('清空這首歌已錄的拍點，從頭重錄？尚未下載的資料會被清除。'))return;recording=new BeatRecording(duration||Infinity);position=0;lastSave=0;save();controls();$('status').textContent='已清空。按播放，從頭錄製。';};
$('song').onchange=()=>{audio?.pause();playing=false;restore();};
$('download').onclick=()=>{if(!recording.points.length)return;pause('已暫停並匯出 TXT。');const blob=new Blob([recording.text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=tracks[$('song').value].title.replaceAll(' ','-')+'-beats.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('status').textContent=`已匯出 ${recording.points.length} 拍：每行一個秒數。`;};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('離開分頁，已自動暫停。');});addEventListener('pagehide',()=>{pause();save();audio?.stopSource();});
function frame(){if(playing){position=Math.min(duration,Math.max(0,audio.time));if(position>=duration){pause('音樂結束！請下載 TXT，作為這首歌的標準拍點。');position=duration;save();controls();}else if(position-lastSave>1){lastSave=position;save();}}
  $('clock').textContent=format(position)+' / '+(duration?format(duration):'—');$('progress').value=duration?position/duration:0;$('beat').dataset.time=position.toFixed(3);$('beat').dataset.playing=String(playing);requestAnimationFrame(frame);}
restore();requestAnimationFrame(frame);
