export class PulseHud{
  constructor(){this.scale=1;this.velocity=0;this.age=10;this.judgeScale=1;this.judgeVelocity=0;this.result='';this.combo=document.getElementById('comboValue');this.judge=document.getElementById('judgement');this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}
  reset(){this.combo.textContent='0';this.judge.classList.add('hidden');this.age=10;this.scale=1;this.velocity=0;}
  event(e,g){
    if(!['hit','miss'].includes(e.type))return;this.result=e.result;this.age=0;
    this.combo.textContent=g.combo;this.velocity=Math.min(6,this.velocity+(e.type==='hit'?3.6:-2));this.judgeVelocity=Math.min(6,this.judgeVelocity+3);
    this.judge.dataset.grade=e.result;this.judge.classList.remove('hidden');document.getElementById('grade').textContent={perfect:'PERFECT',good:'GOOD',miss:'MISS'}[e.result];
    document.getElementById('timing').textContent=e.type==='miss'?'錯過了，跟上下一拍':Math.abs(e.error)<.008?'JUST!':`${e.error<0?'EARLY':'LATE'} ${Math.round(Math.abs(e.error)*1000)} ms`;
  }
  draw(g,dt){
    if(g.status==='paused')dt=0;this.age+=dt;
    let left=dt;while(left>0){const d=Math.min(left,1/120);this.velocity+=((1-this.scale)*210-this.velocity*19)*d;this.scale+=this.velocity*d;this.judgeVelocity+=((1-this.judgeScale)*180-this.judgeVelocity*19)*d;this.judgeScale+=this.judgeVelocity*d;left-=d;}
    this.combo.style.transform=`scale(${this.reduced?1:this.scale})`;
    this.judge.style.transform=`translateX(-50%) scale(${this.reduced?1:this.judgeScale})`;
    this.judge.style.opacity=this.age<.45?'1':String(Math.max(0,1-(this.age-.45)*4));
    document.getElementById('scoreValue').textContent=String(g.score).padStart(7,'0');document.getElementById('accuracyValue').textContent=g.accuracy.toFixed(2)+'%';
  }
}
