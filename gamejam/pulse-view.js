import {ScenesView} from './scenes-view.js';
const names={surface:'換氣',dive:'下海',leap:'大吸氣',exit:'上岸',call:'呼喚'};
export function noteGeometry(width,height,approach){return {x:width*.32,y:height*.58,speed:(width*.68+60)/approach};}
export class PulseView extends ScenesView{
  constructor(canvas){super(canvas);this.hitBursts=[];this.hideNotes=false;}
  reset(g){super.reset(g);this.hitBursts=[];}
  emit(e,g){super.emit(e,g);if(e.type==='hit')this.hitBursts.push({at:g.time,perfect:e.result==='perfect',kind:e.note.kind});}
  draw(g,t,dt=0){
    const playing=g.status==='playing'||g.status==='paused'&&g.beforePause==='playing';
    if(!playing){super.draw(g,t,dt);return;}
    if(!this.bg)return;this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;
    this.flow.update(g,dt);const c=this.c,w=this.w,h=this.h,water=g.phase==='underwater';
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.scenery(water,t,g);
    const lane=noteGeometry(w,h,g.profile.approach),body=Math.min(255,w*.36)*this.motion.growth;
    // Mouth position never moves horizontally as the seal grows. The judgement
    // line and every note use one audio-clock coordinate, including route gates.
    const sx=lane.x-body*.32,sy=lane.y+body*.06;
    c.save();const laneGlow=c.createLinearGradient(0,lane.y-45,0,lane.y+45);laneGlow.addColorStop(0,'#e9ffff00');laneGlow.addColorStop(.5,'#d9ffff21');laneGlow.addColorStop(1,'#e9ffff00');c.fillStyle=laneGlow;c.fillRect(lane.x, lane.y-45,w,90);
    c.strokeStyle=water?'#d0f4ff88':'#508cad77';c.lineWidth=2;c.beginPath();c.moveTo(lane.x,lane.y-66);c.lineTo(lane.x,lane.y+66);c.stroke();
    c.strokeStyle=water?'#edfcff70':'#72acc2';c.beginPath();c.arc(lane.x,lane.y,33,0,Math.PI*2);c.stroke();c.restore();
    this.portrait(sx,sy,body,t,{animated:true});
    if(!this.hideNotes)for(const n of g.notes){
      if(n.result)continue;const left=n.time-g.time,x=lane.x+left*lane.speed;if(x<lane.x-100||x>w+85)continue;
      if(n.kind==='fish'){
        c.save();c.shadowColor=n.accent?'#ffe69b':'#b5f7ff';c.shadowBlur=12;this.fish(x,lane.y,w<760?1:1.22,t,n.accent);c.restore();
        if(n.fish>1)this.text(`×${n.fish}`,x,lane.y+40,w<760?14:18,water?'#f7ffff':'#315d78');
      }else{
        const gold=n.kind==='leap',r=w<760?29:38;
        this.ellipse(x,lane.y,r,r,gold?'#ffe5a3':'#edfaff');c.strokeStyle=gold?'#ae8242':'#508ba7';c.lineWidth=3;c.beginPath();c.arc(x,lane.y,r,0,Math.PI*2);c.stroke();this.text(names[n.kind],x,lane.y+6,w<760?16:21,'#315f79');
        if(['surface','exit'].includes(n.kind)){this.sprite('ice',x,lane.y-99,105,43);this.fisherman(x-20,lane.y-110);}
      }
    }
    for(const b of this.hitBursts){const age=g.time-b.at;if(age<0||age>.5)continue;const alpha=1-age*2;c.save();c.globalAlpha=alpha;c.strokeStyle=b.perfect?'#fff1a6':'#d4f6ff';c.lineWidth=3;c.beginPath();c.arc(lane.x,lane.y,27+age*145,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;this.ellipse(lane.x+Math.cos(a)*(20+age*150),lane.y+Math.sin(a)*(20+age*90),3,3,c.strokeStyle);}c.restore();}
    this.hitBursts=this.hitBursts.filter(b=>g.time-b.at<.5);
    for(const p of this.topples){const age=g.time-p.at;if(age<1.3)this.fisherman(lane.x+70+age*90,lane.y-50+age*age*70,age);}this.topples=this.topples.filter(p=>g.time-p.at<1.3);
    for(const p of this.splashes){const age=g.time-p.at;if(age<.8)for(let i=0;i<16;i++){const a=i/16*Math.PI;this.ellipse(lane.x+Math.cos(a)*age*200,lane.y-Math.sin(a)*age*170+age*age*130,2,6,`rgba(244,255,255,${1-age/.8})`);}}this.splashes=this.splashes.filter(p=>g.time-p.at<.8);
    if(g.danger){const v=c.createRadialGradient(lane.x,lane.y,h*.18,lane.x,lane.y,Math.max(w,h)*.75);v.addColorStop(0,'#173f5900');v.addColorStop(1,`rgba(16,45,65,${g.danger*.8})`);c.fillStyle=v;c.fillRect(0,0,w,h);}
    if(this.flow.veil&&!this.reduced){c.fillStyle=`rgba(225,251,255,${this.flow.veil*.16})`;c.fillRect(0,0,w,h);}
  }
}
