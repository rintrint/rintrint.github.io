import {RhythmView} from './rhythm-view.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// These source rectangles address the generated atlas directly; the original PNG stays intact.
const sprites={ice:[0,.15,.56,.30],fish:[.60,.15,.38,.29],gold:[.07,.57,.43,.33],plant:[.57,.54,.41,.44]};
export class SketchView extends RhythmView{
  constructor(canvas){
    super(canvas,'runner',{background:'assets/sketch/ocean.png',seal:'assets/sketch/seal.png'});this.sketch=true;
    const props=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.props=im;resolve();};im.onerror=()=>reject(new Error('手繪素材載入失敗'));im.src='assets/sketch/props.png';});
    this.ready=Promise.all([this.ready,props]);
  }
  sprite(name,x,y,width,height){const [a,b,w,h]=sprites[name],im=this.props;if(!im)return;this.c.drawImage(im,a*im.width,b*im.height,w*im.width,h*im.height,x-width/2,y-height/2,width,height);}
  background(g,t){
    const c=this.c,w=this.w,h=this.h,p=g.progress;
    const scale=Math.max(w*1.12/this.bg.width,h*1.06/this.bg.height),bw=this.bg.width*scale,bh=this.bg.height*scale;
    c.drawImage(this.bg,(w-bw)/2+Math.sin(t*.025)*w*.04,-h*.025,bw,bh);
    // Pastel day -> lavender dusk -> mint aurora, always retaining pencil texture.
    c.fillStyle=`rgba(162,133,211,${Math.sin(p*Math.PI)*.15})`;c.fillRect(0,0,w,h);
    c.save();c.globalCompositeOperation='soft-light';
    const beat=60/(g.track.pulseBpm||72),phase=((Math.max(0,g.time)-g.track.beatOffset)%beat+beat)%beat,pulse=Math.exp(-phase*8);
    for(let i=0;i<6;i++){
      const x=((w*.2*i-t*9)%(w*1.3)+w*1.3)%(w*1.3)-w*.15;
      const gradient=c.createLinearGradient(x,h*.29,x+w*.13,h);gradient.addColorStop(0,`rgba(255,249,199,${.2+pulse*.3})`);gradient.addColorStop(1,'#fff6ce00');
      c.fillStyle=gradient;c.beginPath();c.moveTo(x,h*.29);c.lineTo(x+w*.04,h*.29);c.lineTo(x+w*.28,h);c.lineTo(x+w*.1,h);c.closePath();c.fill();
    }c.restore();
    if(p>.55){c.save();c.globalAlpha=(p-.55)*.6;c.strokeStyle='#d5e7ad';c.lineWidth=18;c.filter='blur(7px)';c.beginPath();for(let x=0;x<=w;x+=16){const y=h*.09+Math.sin(x/w*5+t*.2)*h*.05;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();c.restore();}
    for(let i=0;i<18;i++){
      const x=((i*137-t*(12+i%3*7))%(w+50)+w+50)%(w+50)-25,y=h*.35+(i*73%(h*.53))+Math.sin(t+i)*5;
      c.strokeStyle='#fff9ed80';c.lineWidth=1.2;c.beginPath();c.arc(x,y,2+i%4,0,Math.PI*2);c.stroke();
    }
    for(let i=0;i<7;i++){const x=((i*227-t*29)%(w+200)+w+200)%(w+200)-100;c.globalAlpha=.55;this.sprite('plant',x,h-36,80+i%3*18,90+i%3*18);}c.globalAlpha=1;
  }
  seal(x,y,g,t,scale=1){
    const c=this.c,preview=g.status==='ready',jump=g.lastJump,q=jump?clamp((g.time-jump.at)/jump.duration,0,1):1;
    const width=Math.min(this.w*.29,205)*(preview?1.45:1),height=width*2/3;
    c.save();c.translate(x,y);c.rotate(q<1?Math.sin(q*Math.PI*2)*-.09:Math.sin(t*1.5)*.025);
    const squash=q<1?Math.sin(q*Math.PI*2)*.065:Math.sin(t*2)*.012;
    c.scale(scale*(g.growth||1)*(1-squash),scale*(g.growth||1)*(1+squash));
    c.drawImage(this.sealImage,-width/2,-height*.55,width,height);c.restore();
  }
  fish(x,y,size,t,gold=false){this.sprite(gold?'gold':'fish',x,y,54*size,42*size);}
  floe(x,y,width,accent,t){this.sprite('ice',x,y+23,width+16,(width+16)*.44);if(accent){const c=this.c;c.save();c.strokeStyle='#b39666';c.lineWidth=1.2;c.beginPath();c.moveTo(x-4,y-6);c.lineTo(x,y-12);c.lineTo(x+4,y-6);c.stroke();c.restore();}}
  emit(event,g){super.emit(event,g);if(event.type==='hit'){for(const p of this.particles.slice(-30))p.color=event.result==='perfect'?'#d4a153':'#8f86c1';for(const r of this.ripples.slice(-1))r.color='#8f86c1';this.glow=.055;}}
}
