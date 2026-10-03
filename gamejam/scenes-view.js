import {JourneyView} from './tide-view.js';
import {hungerPose} from './scenes-media.js';
const labels={surface:'冰洞換氣',dive:'下海',leap:'大吸氣 · 跨洞',exit:'最後上岸',call:'呼喚朋友'};
export class ScenesView extends JourneyView {
  constructor(canvas){super(canvas);this.flow=new window.BreathScenes.SceneFlow();
    const hunger=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.hungerImage=im;resolve();};im.onerror=()=>reject(Error('肚子餓動畫載入失敗'));im.src='assets/scenes/hunger-strip.png';});
    this.ready=Promise.all([this.ready,hunger]);
  }
  hungryPortrait(x,y,width,time){
    const pose=hungerPose(time,this.reduced),im=this.hungerImage,c=this.c,cell=im.width/3;
    c.save();c.translate(x,y+width*.25);c.scale(1+pose.breath,1-pose.breath);
    // Equal atlas cells keep the three hand-drawn poses on the same baseline.
    c.drawImage(im,pose.frame*cell,im.height*.22,cell,im.height*.67,-width/2,-width*.67,width,width*.67);c.restore();
    this.canvasFrame=pose.frame;
  }
  scenery(dive,t,g){
    const c=this.c,w=this.w,h=this.h,im=this.bg;
    // Crop the same pencil painting into two cameras, preserving the sixth edition's palette.
    const crop=dive?[0,im.height*.39,im.width,im.height*.61]:[0,0,im.width,im.height*.49];
    const zoom=Math.max(w/crop[2],h/crop[3]),cw=w/zoom,ch=h/zoom;
    c.drawImage(im,crop[0]+(crop[2]-cw)/2,crop[1]+(crop[3]-ch)/2,cw,ch,0,0,w,h);
    if(dive){
      const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#70b9cf38');shade.addColorStop(1,'#195674ab');c.fillStyle=shade;c.fillRect(0,0,w,h);
      c.save();c.globalCompositeOperation='screen';
      for(let i=0;i<5;i++){const x=w*(i*.23-.12)+Math.sin(t*.12+i)*25;const ray=c.createLinearGradient(x,0,x+w*.23,h);ray.addColorStop(0,'#e6f9e13d');ray.addColorStop(1,'#daffff00');c.fillStyle=ray;c.beginPath();c.moveTo(x,0);c.lineTo(x+30,0);c.lineTo(x+w*.36,h);c.lineTo(x+w*.14,h);c.fill();}c.restore();
      for(let i=0;i<28;i++){const x=((i*173-t*(8+i%5))%(w+60)+w+60)%(w+60)-30,y=(i*79+t*-(3+i%3))%h;c.strokeStyle='#dcf5ff55';c.lineWidth=1;c.beginPath();c.arc(x,y,1.5+i%3,0,Math.PI*2);c.stroke();}
      c.globalAlpha=.35;for(let i=0;i<6;i++)this.sprite('plant',i*w/5-t*4%70,h,100+i%3*30,170);c.globalAlpha=1;
      // Distant schools are deliberately faint and smaller than playable fish.
      c.globalAlpha=.18;for(let i=0;i<15;i++)this.fish((i*143-t*10+w*10)%w,h*(.3+(i%4)*.13),.35,t);c.globalAlpha=1;
    }else{
      const light=c.createRadialGradient(w*.7,h*.25,0,w*.7,h*.25,w*.7);light.addColorStop(0,'#fffde36b');light.addColorStop(1,'#effaff00');c.fillStyle=light;c.fillRect(0,0,w,h);
      c.strokeStyle='#fffcef77';c.lineWidth=2;for(let j=0;j<7;j++){c.beginPath();for(let x=0;x<=w;x+=12){const y=h*(.61+j*.047)+Math.sin(x*.012+t*.55+j)*3;x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
      const floeWidth=Math.min(w*.9,930),ending=['won','lost'].includes(g.status);
      this.sprite('ice',w*.52,h*(ending?.60:.72),floeWidth,floeWidth*.32);
    }
    if(g.progress>.55){c.fillStyle='#a1d9d918';c.fillRect(0,0,w,h);}
  }
  portrait(x,y,width,t,{flat=false,ghost=false,flip=false,scale=1,animated=false}={}){
    const c=this.c,p=this.pose(this.game,t);
    c.save();c.translate(x,y);c.globalAlpha=ghost?.6:1;
    if(animated)c.rotate((p.angle||0)*.6);
    c.scale((flip?-1:1)*scale*(flat?1.16:(p.sx||1)),scale*(flat?.61:(p.sy||1)));
    c.drawImage(this.sealImage,-width/2,-width/3,width,width*2/3);c.restore();
  }
  draw(g,t,dt=0){
    if(!this.bg||!this.sealImage)return;
    this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;
    const scene=this.flow.update(g,dt),c=this.c,w=this.w,h=this.h,ending=scene==='ending',dive=scene==='dive'||ending&&g.outcome==='hungryGhost';
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.scenery(dive,t,g);
    const width=Math.min(340,w*(ending?.4:.47)),sx=w*(dive?.40:.52),sy=h*(dive?.52:ending?(w<760?.53:.49):(w<760?.635:.61)),growth=ending?1.15:this.motion.growth;
    if(dive&&!ending){
      const body=Math.min(250,w*.38)*growth,mouth=sx+body*.32,speed=Math.min(380,Math.max(160,w*.30))*(g.difficulty==='expert'?1.15:g.difficulty==='beginner'?.8:1);
      const leapAge=g.time-this.leapAt,leapLift=leapAge>=0&&leapAge<1.5?Math.sin(leapAge/1.5*Math.PI)*h*.22:0;
      this.portrait(sx,sy-this.motion.height*h*.15-leapLift,body,t,{animated:true});
      if(leapLift>0)this.text('呼——  一大口氣，跳向下一個洞！',w*.5,h*.32,14,'#f5f5d3');
      // Targets cross the mouth at their judgement time, independent of camera transitions.
      c.strokeStyle='#e8fcff66';c.setLineDash([2,7]);c.beginPath();c.moveTo(mouth,h*.38);c.lineTo(mouth,h*.67);c.stroke();c.setLineDash([]);
      for(const n of g.notes){const left=n.time-g.time;if(n.result||left<-.35||left>(w-mouth)/speed+.4)continue;const x=mouth+left*speed,y=sy-body*.06;
        if(n.kind==='fish'){for(let k=0;k<n.fish;k++)this.fish(x+k*18,y+(k%2)*12,.82,t,n.accent);if(n.fish>1)this.text(`×${n.fish}`,x,y-28,11,'#edfaf5');}
        else{this.ellipse(x,y,28,28,'#eafaff25');c.strokeStyle=n.kind==='leap'?'#ffe4a4':'#e2f9ff';c.lineWidth=2;c.beginPath();c.arc(x,y,28,0,Math.PI*2);c.stroke();this.text(labels[n.kind],x,y-46,12,'#e9fcff');if(['surface','exit'].includes(n.kind)){this.sprite('ice',x,h*.29,135,45);this.fisherman(x-30,h*.265);c.strokeStyle='#e6f9fa99';c.beginPath();c.moveTo(x+28,h*.29);c.lineTo(x,y-32);c.stroke();}}
      }
      const age=g.time-this.hitAt;if(age>=0&&age<.5){c.strokeStyle=`rgba(241,248,210,${1-age*2})`;c.lineWidth=2;c.beginPath();c.arc(mouth,sy-body*.06,20+age*70,0,Math.PI*2);c.stroke();if(g.feedback?.note.kind==='fish')this.text(`+${g.feedback.note.fish}`,mouth,sy-60-age*40,19,'#ffefbc');}
    }else{
      this.ellipse(sx,sy+width*.23,width*.37*growth,7,'#527c941f');
      const ghost=g.outcome==='hungryGhost',angel=g.outcome==='angel';
      if(scene==='start'&&this.hungerImage)this.hungryPortrait(sx,sy,width*1.15,t);
      else this.portrait(sx,sy-(ghost?20:0),width,t,{flat:g.outcome==='rest',ghost,scale:growth});
      if(scene==='start')this.text('咕嚕……海裡有小魚嗎？',sx,h*.75,12,'#547f96');
      if(angel){c.strokeStyle='#cdb16c';c.lineWidth=3;c.beginPath();c.ellipse(sx,sy-width*.31,35,8,0,0,Math.PI*2);c.stroke();for(const side of [-1,1]){c.save();c.translate(sx+side*width*.3,sy);c.rotate(side*.35);for(let i=0;i<4;i++)this.ellipse(side*i*11,-i*9,23,12,'#fffdefe8');c.restore();}}
      if(ghost){this.text('肚子還是空空的……',sx,sy-width*.38,17,'#d8f6ff');}
      if(g.outcome==='friends'||g.called&&g.food>=360){this.portrait(sx-width*.72,sy+20,width*.65,t,{flip:true});this.portrait(sx+width*.70,sy+15,width*.7,t);this.text('下一次，一起游吧。',sx,sy-width*.4,17);}
      const breathing=g.status==='breathing'||g.status==='paused'&&g.beforePause==='breathing';
      if(breathing){const r=Math.min(w*.18,h*.16),x=sx,y=h*.47,q=g.breathSize(t);c.lineWidth=2;c.strokeStyle='#62a3b5';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.fillStyle=q>=.9?'#f9e5a438':'#b6ecf044';c.strokeStyle=q>=.9?'#c7a04f':'#9ed5df';c.beginPath();c.arc(x,y,r*q,0,Math.PI*2);c.fill();c.stroke();this.text(`${Math.round(Math.min(1,q)*100)}%`,x,y+5,25);}
      if(g.status==='playing'&&scene==='breath'){
        const next=g.target,remain=next?next.time-g.time:0;
        if(next){const x=w*.75,y=h*.48,r=31;c.strokeStyle='#70a8bc';c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.strokeStyle='#c1a565';c.beginPath();c.arc(x,y,r+Math.max(0,Math.min(4,remain))*22,0,Math.PI*2);c.stroke();this.text(labels[next.kind]||'準備',x,y+5,11);}
        for(const p of this.topples){const age=g.time-p.at;if(age<1.8)this.fisherman(sx+width*.5+age*35,h*.64+age*age*12,age);}
      }
    }
    for(const p of this.splashes){const age=g.time-p.at;if(age>=0&&age<1)for(let i=0;i<22;i++){const a=i/22*Math.PI;this.ellipse(sx+Math.cos(a)*age*180,h*.62-Math.sin(a)*age*200+age*age*100,2,5,`rgba(244,255,255,${1-age})`);}}
    this.splashes=this.splashes.filter(p=>g.time-p.at<1);this.topples=this.topples.filter(p=>g.time-p.at<2);
    if(g.danger&&!ending){const v=c.createRadialGradient(sx,sy,h*.15,sx,sy,Math.max(w,h)*.7);v.addColorStop(0,'#173f5900');v.addColorStop(1,`rgba(16,45,65,${g.danger*.87})`);c.fillStyle=v;c.fillRect(0,0,w,h);}
    const attack=g.track.attacks?.find(a=>a.time>=g.time-.09&&a.time<=g.time);if(attack&&!this.reduced){c.fillStyle=`rgba(255,248,210,${Math.min(.045,attack.strength*.02)})`;c.fillRect(0,0,w,h);}
    if(this.flow.veil&&!this.reduced){c.fillStyle=`rgba(224,247,250,${this.flow.veil*.68})`;c.fillRect(0,0,w,h);}
  }
}
