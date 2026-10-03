const {SURFACE,HEIGHT,HOLES,clamp}=window.BreathJourney;
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`無法載入 ${src}`));i.src=src;});
export class Ice2D {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera=-100;this.ready=Promise.all([load('assets/glacier-world.png'),load('assets/seal.png')]).then(([bg,seal])=>{this.bg=bg;this.sprite=seal;});}
  resize(w,h,dpr){this.canvas.width=w*Math.min(dpr,2);this.canvas.height=h*Math.min(dpr,2);this.scale=this.canvas.height/HEIGHT;this.width=this.canvas.width/this.scale;}
  ellipse(x,y,rx,ry,fill){const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
  line(points,color,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  floe(a,b,t){
    const c=this.ctx,top=SURFACE-5;c.beginPath();c.moveTo(a,top);
    for(let x=a;x<=b;x+=18)c.lineTo(x,top-9-Math.sin(x*.026)*5);
    c.lineTo(b,top+20);
    for(let x=b;x>=a;x-=23)c.lineTo(x,top+32+Math.sin(x*.034)*17+Math.abs(Math.sin(x*.037))*31);
    c.closePath();const grad=c.createLinearGradient(0,top-20,0,top+92);grad.addColorStop(0,'#f3fbfc');grad.addColorStop(.26,'#cceaf1');grad.addColorStop(.65,'#6cb7d6');grad.addColorStop(1,'#42799c');c.fillStyle=grad;c.fill();
    c.save();c.clip();
    for(let x=a+30;x<b;x+=53){this.line([[x,top+5],[x-16,top+28],[x+5,top+63]],'#edfaff55',1.4);this.line([[x+7,top+30],[x+30,top+15]],'#f4fbff44',.9);}
    const reflected=c.createLinearGradient(a,top,b,top+70);reflected.addColorStop(0,'#72add300');reflected.addColorStop(.45,'#fff4dd44');reflected.addColorStop(1,'#6cd2e600');c.fillStyle=reflected;c.fillRect(a,top,b-a,100);c.restore();
    c.beginPath();c.moveTo(a-5,top-2);for(let x=a;x<b;x+=15)c.lineTo(x,top-11-Math.sin(x*.026)*5);c.lineTo(b+3,top-3);c.strokeStyle='#fff7eaf0';c.lineWidth=4;c.stroke();
    // Dripping facets catch the changing light.
    for(let x=a+40;x<b-25;x+=110){c.beginPath();c.moveTo(x,top+24);c.lineTo(x+12,top+72+(x%43));c.lineTo(x+28,top+22);c.fillStyle='#addfe566';c.fill();}
  }
  fisher(x,index,g,t){
    const c=this.ctx,knock=g.fisherKnocks[index],p=knock===undefined?0:clamp((g.time-knock)/.8,0,1);
    c.save();c.translate(x+50+p*43,SURFACE-15);c.rotate(p*1.5);
    this.line([[-13,0],[-17,-31],[10,-31],[14,0]],'#354e66',4);
    this.ellipse(1,-27,18,7,'#c46f50');
    c.fillStyle='#244257';c.fillRect(-2,-17,12,13);c.fillRect(8,-8,20,9);
    c.beginPath();c.moveTo(-18,-29);c.quadraticCurveTo(-25,-55,-8,-68);c.quadraticCurveTo(14,-79,20,-55);c.lineTo(23,-27);c.closePath();const coat=c.createLinearGradient(-20,-60,20,-20);coat.addColorStop(0,'#eabc70');coat.addColorStop(1,'#bc7452');c.fillStyle=coat;c.fill();
    this.ellipse(5,-65,20,21,'#e7ceb3');this.ellipse(10,-66,12,13,'#d39e83');this.ellipse(15,-67,2,2,'#334a5c');
    c.fillStyle='#56707d';c.fillRect(-12,-87,27,8);this.ellipse(1,-86,14,7,'#728796');
    this.line([[9,-46],[-15,-49],[-45,-76]],'#dbb991',7);
    this.line([[-15,-53],[-44,-104],[-67,-113]],'#4d4f57',2.5);
    c.restore();
    if(p<.5){this.line([[x-17,SURFACE-128],[x-14,SURFACE+70]],'#f5ead380',.7);this.ellipse(x-14,SURFACE+73,3,5,'#e7b678');}
  }
  seal(x,y,g,t,scale=1,friend=false,direction=null){
    const c=this.ctx;c.save();c.translate(x,y);const face=direction??g.facing;
    const growth=friend?1:(this.growth||g.growth)*(1+g.eatPulse*.055);
    c.scale(face*scale*growth,scale*growth);
    const land=!g.underwater&&!g.transition&&g.stage!=='dying';
    const flatten=(g.status==='title'||g.stage==='breathe')?.57+g.oxygen*.0033:1;
    const breath=g.holding?g.charge*.12:Math.sin(t*1.6)*.012;
    c.scale(1,flatten+breath+Math.min(g.food/g.goal,1)*.1);
    const tilt=g.transition?.type==='greatLeap'?Math.sin(g.transition.t/g.transition.duration*Math.PI)*-.35:g.underwater?clamp(g.vy*.001,-.2,.2)*face:0;
    c.rotate(tilt+(friend?0:g.danger*.12));if(land)this.ellipse(0,28,66,7,'#345d7628');
    const width=178,height=92;
    if(this.sprite){
      c.globalAlpha=friend?.96:g.stage==='dying'?Math.max(.12,1-g.deathTime*.4):1;
      for(let i=0;i<28;i++){
        const sway=g.underwater?Math.sin(t*5+i*.11)*3*Math.pow(1-i/28,2):0;
        c.drawImage(this.sprite,i*this.sprite.width/28,0,this.sprite.width/28,this.sprite.height,-width/2+i*width/28,-height*.57+sway,width/28+.5,height);
      }
    }
    c.restore();
    if(g.status==='title'){c.save();c.fillStyle='#617f91';c.font='13px sans-serif';c.textAlign='center';c.fillText('咕嚕…',x-10,y-52);c.restore();}
  }
  spirit(g,t){
    const c=this.ctx,p=clamp(g.deathTime/3.6,0,1),x=g.x,y=g.y-25-p*155;
    c.save();c.translate(x,y);c.scale(g.growth,g.growth);c.globalAlpha=Math.min(.88,p*2);
    c.shadowColor=g.outcome==='angel'?'#fff0b5':'#9ac4ed';c.shadowBlur=25;
    if(g.outcome==='angel'){
      for(const side of [-1,1])for(let i=0;i<5;i++){
        c.save();c.translate(side*35,-4);c.rotate(side*(-.9+i*.16+Math.sin(t*2)*.08));
        this.ellipse(side*(24+i*3),-12,34-i*3,8,'#fff6df');c.restore();
      }
      c.strokeStyle='#ffe7a5';c.lineWidth=3;c.beginPath();c.ellipse(26,-57,26,7,-.1,0,Math.PI*2);c.stroke();
      c.restore();this.seal(x,y,g,t,g.growth*.84,true,1);return;
    }
    c.beginPath();c.moveTo(-65,28);c.bezierCurveTo(-65,-32,1,-50,42,-29);c.bezierCurveTo(83,-14,78,26,54,30);
    for(let i=0;i<5;i++)c.quadraticCurveTo(45-i*23,51+Math.sin(t*2+i)*6,31-i*23,29);
    c.closePath();c.fillStyle='#c7d8e9';c.fill();c.shadowBlur=0;
    this.ellipse(37,-6,4,7,'#355074');this.ellipse(55,-6,4,7,'#355074');this.ellipse(47,12,6,9,'#516b8b');
    this.ellipse(-19,4,23,12,'#7f9cb54a');c.fillStyle='#d7e8f1';c.font='11px sans-serif';c.fillText('咕嚕…',-64,-50);c.restore();
  }
  fish(f,t,pulse){const c=this.ctx;c.save();c.translate(f.x,f.y+Math.sin(t*2+f.phase)*4);c.scale(Math.sin(f.phase)>0?1:-1,1);
    const size=1+f.tier*.1;c.scale(size,size);const color=['#b8edf1','#f0daa9','#efb37e'][f.tier];
    c.shadowColor=color;c.shadowBlur=4+pulse*8;
    c.beginPath();c.moveTo(-11,0);c.bezierCurveTo(-3,-9,11,-8,20,0);c.bezierCurveTo(10,10,-4,8,-11,0);c.lineTo(-22,-8+Math.sin(t*6+f.phase)*2);c.lineTo(-20,9);c.closePath();
    const grad=c.createLinearGradient(0,-8,0,8);grad.addColorStop(0,'#f5fff6');grad.addColorStop(.4,color);grad.addColorStop(1,'#527c95');c.fillStyle=grad;c.fill();c.shadowBlur=0;
    this.ellipse(13,-1,1.6,1.8,'#274f64');this.line([[-2,0],[6,0]],'#fffbec77',1);c.restore();}
  render(g,t,fx){
    if(!this.bg)return;const c=this.ctx,w=this.width;
    if(this.growth===undefined||g.stage==='breathe')this.growth=g.growth;
    this.growth+=(g.growth-this.growth)*.09;
    const target=g.x-w*.38;this.camera+=(target-this.camera)*.09;
    const leap=g.transition?.type==='greatLeap'?Math.sin(g.transition.t/g.transition.duration*Math.PI):0;
    const zoom=1-leap*.12,lift=leap*80,waterline=SURFACE*zoom+lift;
    c.setTransform(this.scale,0,0,this.scale,0,0);c.clearRect(0,0,w,HEIGHT);
    c.drawImage(this.bg,-35-Math.sin(this.camera*.0005)*15,0,w+80,HEIGHT*waterline/SURFACE);
    // Light rises and falls throughout the world, replacing a separate timing widget.
    const wash=c.createLinearGradient(0,SURFACE,0,HEIGHT);wash.addColorStop(0,`rgba(113,232,237,${.035+g.pulse*.11})`);wash.addColorStop(1,'rgba(31,72,140,0)');c.fillStyle=wash;c.fillRect(0,SURFACE,w,HEIGHT-SURFACE);
    c.save();c.translate(w*.5*(1-zoom),lift);c.scale(zoom,zoom);c.translate(-this.camera,0);
    const active=g.stage==='entry'?g.x:g.targetHole;
    for(let i=0;i<HOLES.length;i++){
      const x=HOLES[i];if(x<this.camera-100||x>this.camera+w+100)continue;
      const selected=Math.abs(x-active)<20;
      const beam=c.createLinearGradient(x,SURFACE,x,HEIGHT);beam.addColorStop(0,`rgba(214,249,248,${selected?.26+g.pulse*.35:.08})`);beam.addColorStop(.6,`rgba(148,211,232,${selected?.06:0})`);beam.addColorStop(1,'rgba(90,200,230,0)');
      c.beginPath();c.moveTo(x-29,SURFACE);c.lineTo(x+24,SURFACE);c.lineTo(x+125,HEIGHT);c.lineTo(x-115,HEIGHT);c.closePath();c.fillStyle=beam;c.fill();
      if(selected){c.strokeStyle=`rgba(255,243,211,${.25+g.pulse*.6})`;c.lineWidth=1.5;c.beginPath();c.ellipse(x,SURFACE+7,40+g.pulse*8,5,0,0,Math.PI*2);c.stroke();}
    }
    for(const f of g.fish)if(f.active&&f.x>this.camera-40&&f.x<this.camera+w+40)this.fish(f,t,g.pulse);
    let start=-600;for(const hole of [...HOLES,4400]){const end=hole-48;if(end>this.camera&&start<this.camera+w)this.floe(Math.max(start,this.camera-100),Math.min(end,this.camera+w+100),t);start=hole+48;}
    for(const index of [1,2])if(HOLES[index]>this.camera-100&&HOLES[index]<this.camera+w+100)this.fisher(HOLES[index],index,g,t);
    if(g.checkpoint===2&&!g.jumpDone){c.save();c.font='11px sans-serif';c.fillStyle='#eff7f3aa';c.textAlign='center';c.fillText('另一個洞，在海風的那一端。',HOLES[3],SURFACE-105);c.restore();}
    // Fine wind-borne snow, animated at a different speed from the scenery.
    for(let i=0;i<44;i++){const x=this.camera+((i*109.3+t*7)%w),y=(i*61.7+t*10)%190;this.ellipse(x,y,.8+(i%3)*.5,.8+(i%3)*.5,'#fffaf7a0');}
    for(let i=0;i<55;i++){const x=this.camera+(i*83.9+t*(3+i%3))%w,y=SURFACE+75+(i*53.1-t*5)%560;this.ellipse(x,y,.6+(i%3)*.4,.6+(i%3)*.4,`rgba(174,238,242,${.12+g.pulse*.12})`);}
    if(g.evolutionGlow>0){c.save();c.strokeStyle=`rgba(255,225,159,${g.evolutionGlow*.65})`;c.lineWidth=3;c.beginPath();c.ellipse(g.x,g.y,80+(1-g.evolutionGlow)*110,45+(1-g.evolutionGlow)*65,0,0,Math.PI*2);c.stroke();c.restore();}
    this.seal(g.x,g.y-(!g.underwater&&!g.transition&&g.stage!=='dying'?(this.growth-1)*30:0)+(g.stage==='dying'?Math.min(g.deathTime,3)*12:0),g,t,1.05);
    if(g.stage==='dying')this.spirit(g,t);
    if(g.stage==='ending'||g.status==='won')for(let i=0;i<3;i++){
      const p=clamp((g.endingTime-i*.65)/4,0,1),tx=g.x+(110+i*74)*clamp((w*.62-55)/260,.5,1);
      this.seal(tx+(1-p)*380,SURFACE-30+(1-p)*145,g,t,.62+i*.065,true,-1);
      if(p>.95){c.fillStyle='#eac5ba';c.font='17px serif';c.fillText('♡',tx+5,SURFACE-94-Math.sin(t+i)*5);}
    }
    for(const p of fx.particles){c.globalAlpha=clamp(p.life/p.max,0,1);if(p.type==='bubble'){c.strokeStyle='#d7f6f1';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y,p.size,0,Math.PI*2);c.stroke();this.ellipse(p.x-p.size*.25,p.y-p.size*.3,p.size*.18,p.size*.12,'#ffffffbb');}else this.ellipse(p.x,p.y,p.size,p.size,p.color);}
    c.globalAlpha=1;
    for(const ring of fx.rings){c.strokeStyle=`rgba(226,248,251,${ring.life*.45})`;c.lineWidth=2;c.beginPath();c.ellipse(ring.x,SURFACE+3,20+(1.8-ring.life)*90,4+(1.8-ring.life)*8,0,0,Math.PI*2);c.stroke();}
    if(fx.word&&fx.word.life>0){c.globalAlpha=Math.min(1,fx.word.life);c.fillStyle='#fff7da';c.font='15px sans-serif';c.textAlign='center';c.shadowColor='#174266';c.shadowBlur=12;c.fillText(fx.word.text,g.x,g.y-65-(2-fx.word.life)*12);c.shadowBlur=0;c.globalAlpha=1;}
    c.restore();
    const vignette=c.createRadialGradient(w*.5,420,100,w*.5,450,Math.max(w,HEIGHT)*.65);vignette.addColorStop(0,'#061b3500');vignette.addColorStop(1,'#071d4255');c.fillStyle=vignette;c.fillRect(0,0,w,HEIGHT);
    if(g.underwater&&g.oxygen<25){c.fillStyle=`rgba(56,21,55,${(1-g.oxygen/25)*.22})`;c.fillRect(0,0,w,HEIGHT);}
  }
}
