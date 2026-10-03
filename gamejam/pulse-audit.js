import {JourneyAudio} from './tide-audio.js';
const $=id=>document.getElementById(id),plot=$('plot'),c=plot.getContext('2d');
let track,evidence,audio,cursor=0,scheduled=0,loading=false;
const points=()=>$('level').value==='grid'?track.beats:track.charts[$('level').value].map(n=>n.time);
function resetSchedule(){scheduled=points().findIndex(t=>t>cursor+.025);if(scheduled<0)scheduled=points().length;}
async function play(){if(loading)return;if(audio?.running){cursor=audio.time;audio.pause();$('play').textContent='繼續播放';return;}loading=true;$('play').disabled=true;try{audio??=new JourneyAudio();await audio.load(track);audio.play(cursor);resetSchedule();$('play').textContent='暫停';}catch(e){$('error').textContent=e.message;}finally{loading=false;$('play').disabled=false;}}
function seek(value){const running=audio?.running;audio?.pause();cursor=Math.min(track.duration,Math.max(0,value));$('seek').value=cursor;resetSchedule();if(running)audio.play(cursor);}
$('play').onclick=play;$('seek').oninput=e=>seek(Number(e.target.value));document.querySelectorAll('[data-seek]').forEach(b=>b.onclick=()=>seek(Number(b.dataset.seek)));
$('level').onchange=()=>seek(cursor);$('clicks').onchange=()=>seek(cursor);
$('export').onclick=()=>{const blob=new Blob([points().map(t=>t.toFixed(6)).join('\n')+'\n'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`breath-v9-${$('level').value}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function resize(){plot.width=Math.round(plot.clientWidth*devicePixelRatio);plot.height=Math.round(plot.clientHeight*devicePixelRatio);}addEventListener('resize',resize);resize();
function frame(){
  if(track&&evidence){
    if(audio?.running){cursor=audio.time;$('seek').value=cursor;if($('clicks').checked){const p=points();while(scheduled<p.length&&p[scheduled]<cursor+.3){if(p[scheduled]>=cursor)audio.clickAt(p[scheduled]);scheduled++;}}if(cursor>=track.duration){audio.pause();$('play').textContent='重新播放';cursor=0;$('seek').value=0;}}
    const span=Number($('zoom').value),start=Math.max(0,cursor-span*.35),w=plot.clientWidth,h=plot.clientHeight,x=t=>(t-start)/span*w;
    c.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);c.fillStyle='#183f58';c.fillRect(0,0,w,h);c.strokeStyle='#6bd1d4';c.lineWidth=1.5;c.beginPath();const first=Math.max(0,Math.floor((start-evidence.start)/evidence.step)),last=Math.min(evidence.onset.length,Math.ceil((start+span-evidence.start)/evidence.step));for(let i=first;i<last;i++){const px=x(evidence.start+i*evidence.step),py=h*.8-evidence.onset[i]*h*.27;i===first?c.moveTo(px,py):c.lineTo(px,py);}c.stroke();
    c.strokeStyle='#ffffff65';c.lineWidth=1;for(const t of evidence.independentAttacks){if(t<start||t>start+span)continue;c.beginPath();c.moveTo(x(t),h*.85);c.lineTo(x(t),h*.97);c.stroke();}
    c.strokeStyle='#ffe5a0';c.lineWidth=2;for(const t of points()){if(t<start||t>start+span)continue;c.beginPath();c.moveTo(x(t),h*.1);c.lineTo(x(t),h*.83);c.stroke();}
    c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.moveTo(x(cursor),0);c.lineTo(x(cursor),h);c.stroke();c.fillStyle='#fff';c.font='13px monospace';c.fillText(start.toFixed(2)+' s',12,22);c.fillText((start+span).toFixed(2)+' s',w-80,22);
    $('clock').textContent=`${Math.floor(cursor/60)}:${(cursor%60).toFixed(3).padStart(6,'0')}`;plot.dataset.time=cursor.toFixed(3);plot.dataset.playing=!!audio?.running;
  }requestAnimationFrame(frame);
}
addEventListener('pagehide',()=>audio?.stopSource());document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio?.running){cursor=audio.time;audio.pause();$('play').textContent='繼續播放';}});
try{const results=await Promise.all([fetch('assets/pulse/chart.json').then(r=>{if(!r.ok)throw Error('譜面載入失敗');return r.json();}),fetch('assets/pulse/evidence.json').then(r=>{if(!r.ok)throw Error('證據資料載入失敗');return r.json();})]);track=results[0].tracks[0];evidence=results[1];const a=track.analysis;$('summary').textContent=`歌曲從約 ${a.initialBpm.toFixed(1)} BPM 緩升到 ${a.finalBpm.toFixed(1)} BPM，所以使用局部拍速追蹤，沒有套一個固定 BPM。`;$('report').textContent=`獨立高頻瞬態對到 ${a.independentHighBandMatched} / ${track.beats.length} 個拍格。誤差中位 ${a.independentHighBandMedianMs.toFixed(1)} ms，95% 在 ${a.independentHighBandP95Ms.toFixed(1)} ms 內。`;$('play').disabled=false;$('play').textContent='播放';}catch(e){$('error').textContent=e.message;}
requestAnimationFrame(frame);
