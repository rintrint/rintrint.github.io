import {SketchView} from './rhythm-view-sketch.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const names={fish:'吃魚',surface:'撞開冰洞 · 小吸氣',dive:'準拍下海',leap:'大吸氣 · 跨越冰洞',exit:'最後的冰洞 · 上岸',call:'呼喚新朋友'};
export class JourneyView extends SketchView {
  constructor(canvas){super(canvas,{background:'assets/tide/ocean.png',seal:'assets/tide/seal.png',props:'assets/tide/props.png',iceBlue:true});this.y=.5;this.hitAt=-10;this.leapAt=-10;this.splashes=[];this.topples=[];}
  reset(g){this.ensureGame(g);this.y=.43;this.hitAt=-10;this.leapAt=-10;this.splashes=[];this.topples=[];this.motion.time=0;}
  text(text,x,y,size=14,color='#365d76'){this.c.fillStyle=color;this.c.font=`${size}px "Noto Sans TC", sans-serif`;this.c.textAlign='center';this.c.fillText(text,x,y);}
  emit(e,g){
    if(e.type==='hit'){
      this.hitAt=g.time;this.motion.hit(e.note.kind!=='fish');
      if(e.note.kind==='fish'){this.motion.eat(g.growth);this.eaten=g.food;this.sizeStage=g.form;this.onSound?.({type:'gulp'});}
      if(['surface','exit'].includes(e.note.kind))this.topples.push({at:g.time});
      if(e.note.kind!=='fish')this.splashes.push({at:g.time});
    }
    if(e.type==='bigBreath')this.leapAt=g.time;
  }
  sealPoint(){return [this.w*.28,this.h*this.y];}
  fisherman(x,y,fall=0){
    const c=this.c;c.save();c.translate(x,y);c.rotate(Math.min(fall*3,1.7));
    this.ellipse(0,-35,10,11,'#efc4b9');this.ellipse(-2,-49,14,6,'#689bb5');
    c.lineCap='round';c.lineWidth=13;c.strokeStyle='#80a9bd';c.beginPath();c.moveTo(0,-24);c.lineTo(3,-8);c.lineTo(18,0);c.stroke();
    c.strokeStyle='#527d94';c.lineWidth=2;c.beginPath();c.moveTo(8,-22);c.quadraticCurveTo(35,-60,58,-20);c.lineTo(58,42);c.stroke();c.restore();
  }
  draw(g,t,dt=0){
    if(!this.bg)return;const c=this.c,w=this.w,h=this.h,still=['paused','won','lost'].includes(g.status);if(still)dt=0;
    this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;
    const opening=g.status==='ready',breathing=g.status==='breathing'||g.status==='paused'&&g.beforePause==='breathing';
    const underwater=g.phase==='underwater';
    let aim=underwater?.66+g.depth*.002:.435;
    const leapAge=g.time-this.leapAt;if(leapAge>=0&&leapAge<1.8)aim=.44-Math.sin(leapAge/1.8*Math.PI)*.18;
    this.y+=(aim-this.y)*(1-Math.exp(-dt*5));
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    super.background(g,t);
    // A readable continuous waterline: breathing above, feeding below the ice.
    const sea=c.createLinearGradient(0,h*.48,0,h);sea.addColorStop(0,'#a6d4e83a');sea.addColorStop(1,'#519fc180');c.fillStyle=sea;c.fillRect(0,h*.48,w,h*.52);
    const travel=g.time*48;
    for(let i=-1;i<8;i++){const x=((i*230-travel)%(w+460)+w+460)%(w+460)-230;this.sprite('ice',x,h*.48,220,95);}
    c.strokeStyle='#fffbeaaf';c.lineWidth=2;c.beginPath();for(let x=0;x<=w;x+=10){const y=h*.49+Math.sin(x*.026+t*1.2)*3;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
    const sx=w*.28,sy=h*this.y-(underwater?this.motion.height*h*.22:0),speed=Math.min(380,Math.max(175,w*.33))*(g.difficulty==='expert'?1.15:g.difficulty==='beginner'?.8:1);
    const bodyWidth=Math.min(230,w*.35)*this.motion.growth;
    const mouthX=sx+bodyWidth*.32,mouthY=sy-bodyWidth*.06;
    if(!opening&&!breathing){
      // All notes cross the same visible contact line at their audio timestamp.
      c.save();c.strokeStyle='#71a5be44';c.setLineDash([3,9]);c.beginPath();c.moveTo(mouthX,h*.39);c.lineTo(mouthX,h*.87);c.stroke();c.restore();
      for(const n of g.notes){
        const remain=n.time-g.time;if(remain<-.5||remain>w/speed+1||n.result)continue;
        const x=mouthX+remain*speed;
        if(n.kind==='fish'){
          for(let k=0;k<n.fish;k++)this.fish(x+k*22,mouthY+(k%2)*17,.75,t,n.accent);
          if(n.fish>1)this.text(`×${n.fish}`,x,mouthY-24,11);
        }else{
          this.ellipse(x,h*.477,42,12,'#619ab5');this.ellipse(x,h*.473,33,8,'#4e88a5');
          if(['surface','exit'].includes(n.kind))this.fisherman(x+35,h*.455);
          c.strokeStyle=n.kind==='leap'?'#e5b05f':'#fdf8dd';c.lineWidth=3;c.beginPath();c.arc(x,h*.45,27+Math.max(0,remain)*10,0,Math.PI*2);c.stroke();
          this.text(names[n.kind],x,h*.35,12);
        }
      }
      const next=g.target;if(next&&next.kind!=='fish'&&next.time-g.time<4)this.text(names[next.kind]+'  ·  SPACE',w*.55,h*.34,16);
    }
    for(const p of this.topples){const age=g.time-p.at;if(age<2)this.fisherman(sx+40-age*60,h*.46+Math.max(0,age-.5)*20,age);}this.topples=this.topples.filter(p=>g.time-p.at<2);
    this.ellipse(sx,h*.482,80*this.motion.growth,6,'#527c9424');
    c.save();c.translate(sx,sy);
    const hunger=opening||breathing,death=g.status==='lost',rest=g.outcome==='rest';
    if(death){c.globalAlpha=.65;c.translate(0,-28);}
    const p=this.pose(g,t),scale=this.motion.growth;
    c.rotate(hunger||rest?0:p.angle*.7);c.scale(scale*(hunger||rest?1.18:p.sx),scale*(hunger||rest?.60:p.sy));
    const width=Math.min(230,w*.35);c.drawImage(this.sealImage,-width/2,-width*.33,width,width*2/3);c.restore();
    if(opening)this.text('咕嚕… 肚子餓了',sx,sy-75,16);
    if(breathing){
      const x=w*.70,y=h*.64,r=Math.min(w*.17,100),q=g.breathSize(t);
      c.strokeStyle='#6ba3bf';c.lineWidth=3;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
      c.fillStyle='#abd9ed60';c.strokeStyle=q>=.9?'#b28b46':'#7fb5cf';c.beginPath();c.arc(x,y,r*q,0,Math.PI*2);c.fill();c.stroke();
      this.text(`${Math.round(Math.min(q,1)*100)}%`,x,y+6,28);this.text('至少 90% · 重合時按 SPACE',x,y+r+31,12);
    }
    for(const splash of this.splashes){const age=g.time-splash.at;if(age<1)for(let i=0;i<18;i++){const a=i/18*Math.PI;this.ellipse(sx+Math.cos(a)*age*135,h*.48-Math.sin(a)*age*170+age*age*140,2,5,'#fffbeeaa');}}
    this.splashes=this.splashes.filter(s=>g.time-s.at<1);
    const age=g.time-this.hitAt;if(age<.45&&g.feedback?.note.kind==='fish')this.text(`+${g.feedback.note.fish} 魚`,sx+55,sy-60-age*30,17,'#8b704a');
    if(leapAge>=0&&leapAge<1.8)this.text('呼——  一大口氣，跳向下一個洞！',w*.5,h*.26,18);
    if(g.phase==='surface'&&g.status==='playing')this.text('吸—— 呼——  岸上回氣中',w*.5,h*.57,17);
    if(g.status==='lost'){
      if(g.outcome==='angel'){
        c.strokeStyle='#d4b66b';c.lineWidth=3;c.beginPath();c.ellipse(sx,sy-95,29,7,0,0,Math.PI*2);c.stroke();this.ellipse(sx-80,sy-20,30,14,'#fffcf2');this.ellipse(sx+80,sy-20,30,14,'#fffcf2');
      }else this.text('餓…',sx,sy-85,23);
    }
    if(g.outcome==='friends'||g.called&&g.food>=360){for(let i=0;i<3;i++){const x=sx+130+i*80;c.drawImage(this.sealImage,x-50,h*.43-35,100,67);}this.text('我們一起，呼吸這片海。',w*.6,h*.34,20);}
    if(g.danger){const v=c.createRadialGradient(sx,sy,h*.12,sx,sy,Math.max(w,h)*.75);v.addColorStop(0,'#24495b00');v.addColorStop(1,`rgba(22,55,74,${g.danger*.85})`);c.fillStyle=v;c.fillRect(0,0,w,h);}
    // Light responds to measured attacks, not a second unrelated pulse grid.
    const near=g.track.attacks?.find(a=>a.time>=g.time-.08&&a.time<=g.time);if(near&&!this.reduced){c.fillStyle=`rgba(255,246,210,${Math.min(.035,near.strength*.018)})`;c.fillRect(0,0,w,h);}
  }
}
