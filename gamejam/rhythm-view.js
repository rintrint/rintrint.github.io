const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('無法載入美術素材'));image.src=src;});
const positions=[[.55,.51],[.70,.61],[.53,.70],[.36,.60],[.42,.43],[.68,.43],[.76,.70],[.48,.59]];
export class RhythmView {
  constructor(canvas,mode,assets={}){this.canvas=canvas;this.c=canvas.getContext('2d');this.mode=mode;this.particles=[];this.ripples=[];this.glow=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ready=Promise.all([load(assets.background||'assets/rhythm-ocean.png'),load(assets.seal||'assets/seal.png')]).then(([bg,seal])=>{this.bg=bg;this.sealImage=seal;});}
  resize(w,h,dpr){this.w=w;this.h=h;this.dpr=Math.min(dpr,2);this.canvas.width=w*this.dpr;this.canvas.height=h*this.dpr;}
  point(note){const p=positions[note.id%positions.length];return [this.w*p[0],this.h*p[1]];}
  sealPoint(g,t){
    if(g.status==='ready')return [this.w*.76,this.h*.59+Math.sin(t*1.4)*7];
    if(this.mode==='rings')return [this.w*.22,this.h*.63+Math.sin(t*1.4)*7];
    const base=this.h*(.55+.065*Math.sin(g.progress*Math.PI*2));let y=base;
    if(g.lastJump){const q=clamp((g.time-g.lastJump.at)/g.lastJump.duration,0,1);y-=Math.sin(q*Math.PI)*(g.lastJump.good?this.h*.19:this.h*.065)*(g.lastJump.accent?1.12:1);}
    return [this.w*.29,y];
  }
  emit(event,g){
    if(event.type!=='hit'&&event.type!=='miss')return;
    const point=this.mode==='rings'?this.point(event.note):this.sealPoint(g,g.time),[x,y]=point;
    const good=event.type==='hit',color=event.result==='perfect'?'#ffdf97':good?'#baf7ed':'#c392a9';
    this.ripples.push({x,y,life:1,max:1,color,good});
    if(good){this.glow=event.result==='perfect'?.15:.07;for(let i=0;i<(this.reduced?8:30);i++){
      const a=i/30*Math.PI*2,speed=35+Math.random()*120;this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-35,life:.8+Math.random()*.7,max:1.5,r:1+Math.random()*3,color});
    }}
  }
  ellipse(x,y,rx,ry,color){const c=this.c;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
  background(g,t){
    const c=this.c,w=this.w,h=this.h;const drift=Math.sin(t*.024)*w*.055;
    const scale=Math.max(w*1.17/this.bg.width,h*1.08/this.bg.height),bw=this.bg.width*scale,bh=this.bg.height*scale;
    c.drawImage(this.bg,(w-bw)/2+drift,-h*.025,bw,bh);
    const p=g.progress;
    // Long phrases travel from dawn, through sapphire water, to a soft aurora.
    const tint=c.createLinearGradient(0,0,0,h);tint.addColorStop(0,p<.35?'#f0c3a612':p<.72?'#5267a138':'#6a9ba938');tint.addColorStop(.4,'#12557608');tint.addColorStop(1,'#061d4238');c.fillStyle=tint;c.fillRect(0,0,w,h);
    if(p>.45){c.save();c.globalCompositeOperation='screen';for(let k=0;k<3;k++){
      c.beginPath();for(let x=0;x<=w;x+=15){const y=h*(.035+.04*k)+Math.sin(x/w*4+t*.14+k)*h*.025;x?c.lineTo(x,y):c.moveTo(x,y);}
      c.lineWidth=h*.035;c.strokeStyle=`rgba(${k===1?'138,161,217':'136,227,206'},${Math.min(.12,(p-.45)*.35)})`;c.filter='blur(12px)';c.stroke();
    }c.restore();}
    const energy=g.track.energy?.[Math.max(0,Math.floor(g.time/(g.track.energyStep||.25)))]||.2;
    const beat=60/g.track.bpm;const beatDistance=Math.abs(((Math.max(0,g.time)-(g.track.beatOffset||0)+beat/2)%beat+beat)%beat-beat/2);const pulse=Math.exp(-Math.pow(beatDistance/.09,2));
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<7;i++){
      const x=((i*.19*w-t*(this.mode==='runner'?11:2))%(w*1.35)+w*1.35)%(w*1.35)-w*.1;
      const gr=c.createLinearGradient(x,h*.22,x+w*.09,h*.92);gr.addColorStop(0,`rgba(185,245,240,${.035+energy*.035+pulse*.025})`);gr.addColorStop(1,'#9df4ec00');
      c.beginPath();c.moveTo(x,h*.215);c.lineTo(x+w*.015,h*.215);c.lineTo(x+w*.16,h);c.lineTo(x+w*.06,h);c.closePath();c.fillStyle=gr;c.fill();
    }c.restore();
    // Multiple independently scrolling layers keep the seal anchored while the ocean moves.
    for(let layer=0;layer<2;layer++)for(let i=0;i<23;i++){
      const speed=this.mode==='runner'?(layer+1)*17:2;
      const x=((i*97.31-t*speed)%(w+50)+w+50)%(w+50)-25,y=h*.28+(i*79.23%(h*.63));
      this.ellipse(x,y+Math.sin(t*.7+i)*5,layer?1.7:.8,layer?1.7:.8,layer?'#c4f6f13c':'#f7ffff24');
    }
    this.plants(t);
    const vig=c.createRadialGradient(w*.52,h*.48,w*.08,w*.5,h*.5,Math.max(w,h)*.66);vig.addColorStop(0,'#06223b00');vig.addColorStop(1,'#051a3b7a');c.fillStyle=vig;c.fillRect(0,0,w,h);
  }
  plants(t){
    const c=this.c,w=this.w,h=this.h;
    for(let i=0;i<26;i++){
      const x=((i*101.9-t*(this.mode==='runner'?31:1))%(w+180)+w+180)%(w+180)-90;
      const height=24+(i*47%100);c.beginPath();c.moveTo(x,h+18);c.bezierCurveTo(x-12,h-height*.25,x+Math.sin(t*.8+i)*19,h-height*.7,x+Math.sin(t*.8+i)*12,h-height);
      c.lineWidth=2+i%3;c.strokeStyle=i%4?'#245e7655':'#a1dfce77';c.stroke();if(i%4===0)this.ellipse(x+Math.sin(t*.8+i)*12,h-height,2,4,'#d6eacc99');
    }
  }
  fish(x,y,size,t,gold=false){const c=this.c;c.save();c.translate(x,y);c.scale(size,size);c.shadowColor=gold?'#f4d594':'#a1e8ee';c.shadowBlur=gold?14:5;
    const gr=c.createLinearGradient(0,-8,0,8);gr.addColorStop(0,'#fff9dd');gr.addColorStop(.55,gold?'#e4b96c':'#aadadf');gr.addColorStop(1,'#508496');c.fillStyle=gr;
    c.beginPath();c.moveTo(-13,0);c.bezierCurveTo(-4,-10,13,-8,23,0);c.bezierCurveTo(13,10,-3,8,-13,0);c.lineTo(-25,-9+Math.sin(t*8)*2);c.lineTo(-23,9);c.closePath();c.fill();c.shadowBlur=0;this.ellipse(15,-1,1.6,1.8,'#244257');c.restore();}
  seal(x,y,g,t,scale=1){
    const c=this.c;c.save();c.translate(x,y);const grow=g.growth||1;const bob=g.lastJump?Math.sin(clamp((g.time-g.lastJump.at)/g.lastJump.duration,0,1)*Math.PI*2)*-.13:Math.sin(t*1.2)*.025;
    c.rotate(bob);c.scale(scale*grow,scale*grow);c.shadowColor='#90e4e945';c.shadowBlur=16;
    const width=Math.min(this.w*.25,184),height=width*.53;
    for(let i=0;i<30;i++){const sway=Math.sin(t*5+i*.2)*2.2*Math.pow(1-i/30,2);c.drawImage(this.sealImage,i*this.sealImage.width/30,0,this.sealImage.width/30,this.sealImage.height,-width*.5+i*width/30,-height*.53+sway,width/30+.6,height);}
    c.restore();
  }
  floe(x,y,width,accent,t){const c=this.c;c.save();const gr=c.createLinearGradient(0,y,0,y+75);gr.addColorStop(0,'#e8f8ef');gr.addColorStop(.12,'#b5e4e9');gr.addColorStop(1,'#4a92b277');
    c.beginPath();c.moveTo(x-width*.5,y);c.quadraticCurveTo(x,y-8,x+width*.5,y);c.lineTo(x+width*.35,y+33);c.lineTo(x+width*.15,y+66);c.lineTo(x-width*.17,y+37);c.lineTo(x-width*.41,y+48);c.closePath();c.fillStyle=gr;c.fill();
    c.strokeStyle=accent?'#fff0b2dd':'#e5fff9aa';c.lineWidth=2;c.beginPath();c.moveTo(x-width*.5,y);c.quadraticCurveTo(x,y-8,x+width*.5,y);c.stroke();
    c.fillStyle='#a8dfea48';c.beginPath();c.moveTo(x-width*.12,y+1);c.lineTo(x+width*.35,y+4);c.lineTo(x+width*.15,y+66);c.closePath();c.fill();
    c.fillStyle='#346f9d25';c.beginPath();c.moveTo(x-width*.12,y+1);c.lineTo(x-width*.41,y+48);c.lineTo(x-width*.17,y+37);c.closePath();c.fill();
    c.strokeStyle='#e7faf970';c.lineWidth=1;c.beginPath();c.moveTo(x-width*.12,y+2);c.lineTo(x+width*.04,y+17);c.lineTo(x-width*.10,y+35);c.moveTo(x+width*.04,y+17);c.lineTo(x+width*.23,y+23);c.stroke();
    // Fine frost speckles and translucent veins keep the moving ice tactile.
    for(let i=0;i<24;i++){const px=x-width*.4+((i*37)%97)/97*width*.8,py=y+2+(i*13%19);this.ellipse(px,py,.5+i%2*.35,.5,'#efffff55');}
    c.shadowColor='#ddfcf6';c.shadowBlur=9;c.fillStyle='#f7ffffaa';c.fillRect(x-width*.22,y-2,width*.18,1);c.restore();}
  runner(g,t,preview){
    const w=this.w,h=this.h,[sx,sy]=this.sealPoint(g,t),base=h*(.55+.065*Math.sin(g.progress*Math.PI*2)),speed=Math.max(160,Math.min(270,w*.28))*(g.profile?.speed||1);
    const now=preview?t%18+15:g.time;
    const nearby=g.notes.filter(n=>n.time>now-3&&n.time<now+w/speed+2);
    for(const n of nearby){
      const x=sx+(n.time-now)*speed;
      const gap=g.notes[n.id+1]?.time-n.time||1;
      this.floe(x+30,base+45,Math.min(160,Math.max(48,speed*gap*.68)),n.accent,t);
      if(!n.result){
        const closeness=clamp(1-Math.abs(n.time-now)/1.4,0,1);
        this.fish(x,base-75-Math.sin(t*2+n.id)*4,1.05+closeness*.25,t,n.accent);
        if(n.time-now<1.4&&n.time-now>-.1){
          const c=this.c;c.save();c.strokeStyle=`rgba(233,246,217,${closeness*.5})`;c.setLineDash([2,7]);c.lineWidth=1;c.beginPath();c.moveTo(x,base-52);c.lineTo(x,base+25);c.stroke();c.restore();
        }
      }
    }
    for(let i=0;i<5;i++)this.fish(((i*w*.31-t*42)%(w+70)+w+70)%(w+70)-35,h*.83+Math.sin(i+t*.4)*22,.45,t+i,false);
    const jump=g.lastJump,q=jump?clamp((g.time-jump.at)/jump.duration,0,1):1;
    if(q<1&&!this.reduced){for(let i=1;i<=5;i++){this.c.globalAlpha=(1-i/6)*.14;this.seal(sx-i*13,sy+i*3,g,t-i*.035,.97);}this.c.globalAlpha=1;}
    this.seal(sx,preview?base-Math.abs(Math.sin(t*1.8))*h*.12:sy,g,t,1.05);
    // Timing is in the approaching fish and ice edge, not a second rhythm widget.
    if(g.time>=0&&g.time<8&&!preview){this.c.font='12px sans-serif';this.c.fillStyle=this.sketch?'#55548c':'#e6efdfbb';this.c.textAlign='center';this.c.fillText('魚群靠近時，跟著琴音躍起',sx,base+110);}
  }
  rings(g,t,preview){
    const c=this.c,w=this.w,h=this.h;const now=preview?t%10+10:g.time;
    const approach=g.profile?.approach||1.75;const active=g.notes.filter(n=>!n.result&&n.time-now<approach&&n.time-now>-g.window);
    const oldest=active[0];
    for(const n of [...active].reverse()){
      const [x,y]=this.point(n),remaining=n.time-now,p=clamp(remaining/approach,0,1),radius=Math.max(25,Math.min(38,w*.045));
      const alpha=n===oldest?1:.42;c.save();c.globalAlpha=alpha;
      const glow=c.createRadialGradient(x,y,radius*.2,x,y,radius*2.5);glow.addColorStop(0,n.accent?'#ffdf9b35':'#a9f2ef25');glow.addColorStop(1,'#a7eeed00');c.fillStyle=glow;c.fillRect(x-radius*2.5,y-radius*2.5,radius*5,radius*5);
      c.strokeStyle=n.accent?'#ffe6b2':'#d3f9ef';c.lineWidth=n===oldest?2.2:1.3;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.stroke();
      c.strokeStyle=remaining<.075?'#fff4cc':'#b1e8ec';c.lineWidth=2;c.shadowColor='#acf7ec';c.shadowBlur=13;c.beginPath();c.arc(x,y,radius+Math.max(0,p)*radius*2.8,0,Math.PI*2);c.stroke();c.shadowBlur=0;
      c.font=`${Math.round(radius*.65)}px Georgia`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f8f7dd';c.fillText(String(n.id%4+1),x,y);
      if(n===oldest){c.font='8px sans-serif';c.fillStyle='#d1eae4aa';c.fillText('SPACE',x,y+radius+20);}c.restore();
    }
    const [x,y]=this.sealPoint(g,t);this.seal(x,y,g,t,.95);
    for(let i=0;i<7;i++)this.fish(w*(.11+i*.135)+Math.sin(t*.35+i)*12,h*(.81+(i%2)*.045),.45,t+i,i===3);
  }
  draw(g,t,dt=0,preview=false){
    if(!this.bg)return;const c=this.c,w=this.w,h=this.h;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    this.background(g,t);this.mode==='rings'?this.rings(g,t,preview):this.runner(g,t,preview);
    for(const r of this.ripples){r.life-=dt;c.globalAlpha=Math.max(0,r.life)*.75;c.strokeStyle=r.color;c.lineWidth=r.good?2:1;c.beginPath();c.arc(r.x,r.y,30+(1-r.life)*75,0,Math.PI*2);c.stroke();}c.globalAlpha=1;this.ripples=this.ripples.filter(r=>r.life>0);
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=28*dt;c.globalAlpha=Math.max(0,p.life/p.max);this.ellipse(p.x,p.y,p.r,p.r,p.color);}c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    if(this.glow>0){c.fillStyle=`rgba(205,249,239,${this.glow})`;c.fillRect(0,0,w,h);this.glow=Math.max(0,this.glow-dt*.55);}
    if(g.danger>0){const danger=c.createRadialGradient(w*.45,h*.55,h*.10,w*.5,h*.5,Math.max(w,h)*.6);danger.addColorStop(0,'#36223e00');danger.addColorStop(1,`rgba(56,20,48,${g.danger*.7})`);c.fillStyle=danger;c.fillRect(0,0,w,h);}
    if(g.feedback&&g.time-g.feedback.at<.85&&!preview){
      const f=g.feedback,life=1-(g.time-f.at)/.85;const point=this.mode==='rings'&&f.note?this.point(f.note):this.sealPoint(g,t);
      c.save();c.globalAlpha=clamp(life,0,1);c.textAlign='center';c.font='italic 24px Georgia';c.shadowColor=this.sketch?'#fff9ed':'#133a55';c.shadowBlur=12;c.fillStyle=this.sketch?(f.result==='perfect'?'#926238':f.result==='miss'?'#a66586':'#585290'):(f.result==='perfect'?'#ffdf9c':f.result==='miss'?'#e3bac4':'#d9f3e8');
      c.fillText({perfect:'Perfect',good:'Good',soft:'Soft',miss:'Miss',early:'輕一點，等那一拍'}[f.result],point[0],point[1]-65-(1-life)*18);c.restore();
    }
    if(g.status==='won'){
      const [x,y]=this.sealPoint(g,t);for(let i=0;i<3;i++)this.seal(x+85+i*62,y+15+Math.sin(t+i)*5,{...g,growth:1,lastJump:null},t+i,.5);
    }
  }
}
