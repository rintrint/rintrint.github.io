import {SketchView} from './rhythm-view-sketch.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class DashView extends SketchView{
  constructor(canvas){super(canvas,{background:'assets/tide/ocean.png',seal:'assets/tide/seal.png',props:'assets/tide/props.png',iceBlue:true});this.effects=[];this.y=0;this.vy=0;this.kick=0;this.trail=[];this.last=0;}
  reset(){this.y=0;this.vy=0;this.kick=0;this.effects=[];this.trail=[];this.last=0;}
  get hitX(){return this.w*(this.w<650?.28:.25);}
  laneY(lane){return this.h*(lane==='air'?.47:.73);}
  color(lane){return lane==='air'?'#65bddc':'#dfb469';}
  speed(){return (this.w-this.hitX+60)/1.65;}
  emit(e){
    if(['hit','mash','pickup'].includes(e.type)){
      const lane=e.note.lane==='both'?'ground':e.note.lane;
      this.effects.push({x:this.hitX,y:this.laneY(lane),lane,age:0,kind:e.type});this.kick=Math.min(.18,this.kick+.09);
    }
    if(e.type==='stroke')this.kick=Math.min(.12,this.kick+.03);
    if(this.effects.length>45)this.effects.shift();
  }
  sealArt(x,y,width,angle=0,alpha=1){const c=this.c;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(angle);c.scale(1+this.kick,1-this.kick*.55);c.drawImage(this.sealImage,-width*.57,-width*.40,width,width*2/3);c.restore();}
  pearl(x,y,r,color){const c=this.c;c.save();c.shadowColor=color;c.shadowBlur=12;c.fillStyle='#f8fdffe8';c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();c.restore();}
  render(g,wall,dt){
    if(!this.bg||!this.props||!this.sealImage)return;
    const c=this.c,w=this.w,h=this.h,t=g?.time||0,active=!!g;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    this.background({progress:active?t/140:.05,time:active?t:wall,track:{pulseBpm:128,beatOffset:5.9}},active?t:wall*.4);
    const wash=c.createLinearGradient(0,0,0,h);wash.addColorStop(0,'#edfaff99');wash.addColorStop(.4,'#e1f4fa10');wash.addColorStop(1,'#3c739843');c.fillStyle=wash;c.fillRect(0,0,w,h);
    // Nearer ice moves faster than the distant pencil landscape.
    for(let i=0;i<5;i++){const x=((i*(w/3+140)-(active?t:wall)*24)%(w+420)+w+420)%(w+420)-150;c.globalAlpha=.52;this.sprite('ice',x,h*.92,220,90);}c.globalAlpha=1;
    if(!active){
      const glow=c.createRadialGradient(w*.74,h*.5,5,w*.74,h*.5,w*.4);glow.addColorStop(0,'#fffbd2a0');glow.addColorStop(1,'#fffde800');c.fillStyle=glow;c.fillRect(0,0,w,h);
      const x=w*(w<650?.79:.75),y=h*.67,size=Math.min(w*.41,470);
      this.sprite('ice',x,y+size*.22,size*1.13,size*.45);this.sealArt(x,y+Math.sin(wall*1.3)*3,size,-.035);
      for(let i=0;i<3;i++)this.sprite(i%2?'fish':'gold',w*(.61+i*.12),h*(.85+i%2*.035),52,38);
      c.font='italic 12px Georgia';c.fillStyle='#f0faff';c.textAlign='center';c.fillText('a new rhythm, the same little ocean',w*.72,h*.91);return;
    }
    const hx=this.hitX,speed=this.speed(),size=clamp(w*.05,24,49),sealW=clamp(w*.16,85,195);
    for(const lane of ['air','ground']){
      const y=this.laneY(lane),color=this.color(lane),grad=c.createLinearGradient(hx-40,y,w,y);
      grad.addColorStop(0,color+'25');grad.addColorStop(1,color+'00');c.fillStyle=grad;c.fillRect(hx-40,y-33,w,66);
      c.strokeStyle='#f5fbff90';c.lineWidth=1;c.beginPath();c.moveTo(hx-45,y);c.lineTo(w,y);c.stroke();
      for(let i=0;i<14;i++){const x=hx+((i*110-t*speed*.35)%(w-hx)+(w-hx))%(w-hx);c.fillStyle='#ffffff7a';c.beginPath();c.arc(x,y,1.4,0,7);c.fill();}
      this.pearl(hx,y,size*.65,color);c.fillStyle=color;c.font='10px sans-serif';c.textAlign='center';c.fillText(lane==='air'?'D / F':'J / K',hx,y+size*.65+19);
    }
    for(const n of g.notes){
      if(n.kind==='tail'||n.state==='skipped')continue;
      const x=hx+(n.time-t)*speed,y=this.laneY(n.lane),col=this.color(n.lane);
      if(n.kind==='hold'){
        const endX=hx+(n.end-t)*speed;
        if(x>w+70||endX<hx-70||n.state==='miss')continue;
        const from=Math.max(hx,x),to=Math.min(w+30,endX);if(to<from)continue;
        c.save();c.globalAlpha=g.byId.get(n.tailId).state==='miss'?.25:1;
        c.strokeStyle=col+'8a';c.lineCap='round';c.lineWidth=19;c.beginPath();c.moveTo(from,y);c.lineTo(to,y);c.stroke();
        c.strokeStyle='#fcffeed9';c.lineWidth=2;c.beginPath();for(let xx=from;xx<to;xx+=6){const yy=y+Math.sin((xx-t*70)*.047)*5;xx===from?c.moveTo(xx,yy):c.lineTo(xx,yy);}c.stroke();
        for(let xx=from+25;xx<to;xx+=45){c.fillStyle='#fff9';c.beginPath();c.arc(xx,y,2.5,0,7);c.fill();}
        this.pearl(endX,y,size*.40,col);
        if(n.state==='pending')this.pearl(x,y,size*.60,col);
        else if(g.active[n.lane]?.id===n.id){this.pearl(hx,y,size*(.65+Math.sin(t*18)*.07),col);c.font='9px sans-serif';c.textAlign='center';c.fillStyle='#315e77';c.fillText('按住',hx,y-size*.8);}
        c.restore();continue;
      }
      if(n.kind==='mash'){
        if(t<n.start-1.65||t>n.time+.35)continue;
        const mx=t<n.start?hx+(n.start-t)*speed:hx+size*1.2;
        const my=(this.laneY('ground')+this.laneY('air'))*.5;
        c.save();c.shadowColor='#ffe5a2';c.shadowBlur=30;this.sprite('gold',mx,my,size*3,size*2.3);c.restore();
        c.fillStyle='#fff9e5';c.strokeStyle='#c29b56';c.lineWidth=2;c.beginPath();c.roundRect(mx-size*1.45,my-size*1.7,size*2.9,29,12);c.fill();c.stroke();c.fillStyle='#916729';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(t<n.start?'雙手準備連打':`連打 ${n.hits} / ${n.required}`,mx,my-size*1.7+19);
        continue;
      }
      if(n.state!=='pending'||x<hx-85||x>w+60)continue;
      c.save();c.globalAlpha=x<hx?.55:1;c.shadowColor=col;c.shadowBlur=8;
      this.sprite(n.lane==='air'?'fish':'gold',x,y,size*1.3,size);c.restore();
    }
    for(const p of g.pickups){const x=hx+(p.time-t)*speed;if(p.done||x<hx-50||x>w+40)continue;c.fillStyle='#fffbe4';c.font='24px Georgia';c.textAlign='center';c.fillText('♪',x,this.laneY(p.lane));}
    for(const obstacle of g.hazards){const x=hx+(obstacle.time-t)*speed;if(x<hx-70||x>w+60)continue;const y=this.laneY('ground');c.save();c.translate(x,y+15);c.fillStyle='#d4f3ff';c.strokeStyle='#4e8fb2';c.lineWidth=2;c.beginPath();c.moveTo(-25,8);c.lineTo(-13,-20);c.lineTo(-5,-7);c.lineTo(6,-33);c.lineTo(17,-8);c.lineTo(28,8);c.closePath();c.fill();c.stroke();c.fillStyle='#4b8298';c.font='bold 16px sans-serif';c.textAlign='center';c.fillText('↑',0,-43);c.restore();}
    // A damped body preserves momentum. Consecutive presses extend the jump,
    // never reset a keyframed animation or teleport the seal back to the ground.
    const target=g.airborne?1:0;let remaining=Math.min(dt,.08);
    while(remaining>0){const step=Math.min(remaining,1/240);this.vy+=((target-this.y)*360-this.vy*30)*step;this.y+=this.vy*step;remaining-=step;}
    this.kick*=Math.exp(-dt*16);
    const sy=this.laneY('ground')-this.y*(this.laneY('ground')-this.laneY('air'));
    const sx=hx-sealW*.50,angle=clamp(-this.vy*.019,-.12,.13);
    if(!this.reduced){this.trail.push({x:sx,y:sy,age:0,angle});if(this.trail.length>10)this.trail.shift();for(const p of this.trail){p.age+=dt;if(p.age>.04&&p.age<.18&&Math.abs(this.vy)>.4)this.sealArt(p.x-p.age*35,p.y,sealW,p.angle,(.18-p.age)*.55);}}
    this.ellipse(sx,this.laneY('ground')+sealW*.23,sealW*.40,6,'#56879b28');
    if(g.active.ground&&this.y>.2)this.sealArt(sx,this.laneY('ground'),sealW,0,.4);
    const echo=this.effects.find(e=>e.kind==='hit'&&e.age<.13&&((e.lane==='ground'&&this.y>.5)||(e.lane==='air'&&this.y<.5)));
    if(echo)this.sealArt(sx+7,this.laneY(echo.lane),sealW,echo.lane==='air'?-.07:.06,(1-echo.age/.13)*.48);
    this.sealArt(sx,sy,sealW,angle);
    for(const e of this.effects){
      e.age+=dt;const life=1-e.age/.48;if(life<=0)continue;
      c.save();c.globalAlpha=life;const col=this.color(e.lane);
      c.strokeStyle=col;c.lineWidth=3*life;c.beginPath();c.arc(e.x,e.y,size*.4+e.age*100,0,7);c.stroke();
      c.strokeStyle='#fffef4';c.lineWidth=5*life;c.beginPath();c.arc(e.x-10,e.y,26+e.age*12,-.8,1.5);c.stroke();
      for(let i=0;i<(this.reduced?4:11);i++){const a=i*2.4,r=12+e.age*(40+i*13),px=e.x+Math.cos(a)*r,py=e.y+Math.sin(a)*r+e.age*e.age*70;c.fillStyle=i%2?'#fffce0':col;c.beginPath();c.ellipse(px,py,2+life*2,1+life*3,a,0,7);c.fill();}c.restore();
    }this.effects=this.effects.filter(e=>e.age<.5);
    if(g.health<60){const danger=(60-g.health)/60;c.fillStyle=`rgba(108,61,72,${danger*.08*(1+Math.sin(t*5))})`;c.fillRect(0,0,w,h);}
    if(t<5.8&&t>2){c.fillStyle='#3b708c';c.textAlign='center';c.font='18px "Noto Serif TC",serif';c.fillText('聽見第一拍，讓小魚游向你。',w*.61,h*.32);}
    const mash=g.notes.find(n=>n.kind==='mash'&&t>=n.start-.8&&t<n.time);
    if(mash){c.fillStyle='#fffbe2';c.font='12px sans-serif';c.textAlign='center';c.fillText('D / F + J / K 交替連打',w*.59,h*.30);}
  }
}
