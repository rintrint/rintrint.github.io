export const VARIANTS={
 a:{name:'破冰衝刺',tag:'爽快 / 直接',entry:[3.5],launch:1.75,breath:4,charge:2.5,leap:1.8,title:'讓撞擊，成為換氣的獎勵。',body:'海豹先在水下蓄勢，第四拍破冰頂出。垂釣者被掀起、魚竿脫手、落回雪地；鏡頭跟著海豹上岸，連打換氣後再躍入下一個洞。',rule:'第四拍按一次'},
 b:{name:'拉線拔河',tag:'俏皮 / 互動',entry:[2.5,3,3.5],launch:2.25,breath:4,charge:2.5,leap:2,title:'先逗逗他，再借一下冰洞。',body:'鏡頭同時看見水面上下。海豹咬住魚線，三拍輕拉、拉緊、頂上去！垂釣者失去平衡坐倒，海豹探頭連打補氣，再從魚竿下躍往下一個冰洞。',rule:'第 2、3、4 拍各按一次'},
 c:{name:'深吸大躍',tag:'張力 / 演出',entry:[3.5],launch:2.8,breath:4.5,charge:3,leap:2.5,title:'最安靜的一秒，接最大的呼吸。',body:'氧氣不足時鏡頭推近海豹；最後一拍，向光衝出冰洞。撞擊短暫停格，垂釣者慢動作翻倒。喘息特寫之後，以一個超大吸氣聲接上跨洞大跳。',rule:'跟心跳，到第四拍按一次'}
};
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
export class ShoreRun{
 constructor(version='a',auto=true){this.config=VARIANTS[version];this.version=version;this.auto=auto;this.phase='ready';this.age=0;this.time=0;this.air=28;this.hits=[];this.events=[];this.refills=0;this.tug=0;this.outcome='';this.paused=false;this.feedback='';this.feedbackAt=-100;this.lastTap=-100;this.lastAuto=-1;this.strikes=0;}
 event(type,more={}){this.events.push({type,at:this.time,...more})}
 enter(phase){this.phase=phase;this.age=0;this.event('phase',{phase});if(phase==='charge')this.event('bigBreath');if(phase==='breath')this.event('inhale');if(phase==='launch')this.event('surface');if(phase==='leap')this.event('jump');}
 start(){if(this.phase==='ready'){this.enter('approach');this.event('start')}}
 feedbackText(text){this.feedback=text;this.feedbackAt=this.time;this.event('feedback',{text})}
 hitEntry(i,error=0){if(this.hits[i])return;this.hits[i]='hit';this.tug++;this.feedbackText(this.version==='b'&&i<this.config.entry.length-1?['咬住了！','拉緊！'][i]:'PERFECT!');this.event('tug',{index:i});if(i===this.config.entry.length-1){if(this.version==='b'&&this.tug<2){this.fail('魚線鬆開了，再抓一次節奏。');return}this.enter('launch');this.event('impact',{delay:this.version==='c'?.70:.38});}}
 fail(reason){this.outcome=reason;this.enter('fail');this.feedbackText('差一口氣…');this.event('fail')}
 press(){if(this.paused||['ready','done','fail'].includes(this.phase))return;this.lastTap=this.time;
   if(this.phase==='approach'){
     const i=this.config.entry.findIndex((t,j)=>!this.hits[j]&&Math.abs(t-this.age)<.44);
     if(i<0)return;
     const delta=this.age-this.config.entry[i];
     if(Math.abs(delta)<=.18)this.hitEntry(i,delta);
     else{this.hits[i]='miss';this.strikes++;this.feedbackText(delta<0?'再等一拍！':'晚了一點');this.event('miss');}
   }else if(this.phase==='breath'){
     this.air+=(100-this.air)*.105;this.air=Math.min(99.5,this.air);this.refills++;this.event('refill');
   }else if(this.phase==='charge'){
     const target=this.config.charge-.35,delta=this.age-target;
     if(Math.abs(delta)<=.2){this.feedbackText('大吸氣！');this.enter('leap');}
     else if(Math.abs(delta)<.48){this.fail(delta<0?'跳太早了，等吸氣聲後的重拍。':'下一個冰洞已經錯過了。');}
   }
 }
 step(dt){if(this.paused||this.phase==='ready'||this.phase==='done'||this.phase==='fail')return;dt=Math.max(0,Math.min(dt,.05));this.time+=dt;const before=this.age;this.age+=dt;
   const rate=this.phase==='approach'?3:this.phase==='breath'?3.2:1.3;this.air=Math.max(0,this.air-rate*dt);
   if(this.air<=0){this.fail('這一口氣用完了。上岸後盡量連打補氣！');return}
   if(this.phase==='approach'){
     if(this.auto)for(let i=0;i<this.config.entry.length;i++){let t=this.config.entry[i];if(before<t&&this.age>=t){this.hitEntry(i);break}}
     if(this.phase==='approach'&&this.age>3.72)this.fail('錯過破冰的拍點，這次沒能上岸。');
   }else if(this.phase==='launch'&&this.age>=this.config.launch)this.enter('breath');
   else if(this.phase==='breath'){
     if(this.auto&&Math.floor(this.age/.13)!==Math.floor(before/.13))this.press();
     if(this.age>=this.config.breath)this.enter('charge');
   }else if(this.phase==='charge'){
     let target=this.config.charge-.35;
     if(this.auto&&before<target&&this.age>=target)this.press();
     if(this.phase==='charge'&&this.age>target+.2)this.fail('沒能跳進下一個洞。等大吸氣後的重拍再按！');
   }else if(this.phase==='leap'&&this.age>=this.config.leap){this.outcome='成功換氣，下一段旅程繼續。';this.enter('done');this.event('dive');}
 }
 get onShore(){return ['breath','charge','leap','done'].includes(this.phase)||(this.phase==='launch'&&this.age>.7)}
 get beat(){if(this.phase==='approach')return Math.floor((this.age-2)/.5);if(this.phase==='charge')return Math.floor((this.age-(this.config.charge-1.85))/.5);return -1}
 get action(){return {ready:'開始',approach:this.version==='b'?'跟拍拉線':'對拍破冰',launch:'衝出冰洞',breath:'連打補氣',charge:'對拍大跳',leap:'躍入下一洞',done:'再玩一次',fail:'再試一次'}[this.phase]}
}
