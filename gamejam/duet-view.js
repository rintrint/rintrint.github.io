import {ScenesView} from './scenes-view.js';
import {DuetMotion} from './duet-motion.js';
const names={surface:'換氣',dive:'下海',leap:'大吸氣',exit:'上岸',call:'呼喚'};
// Trim atlas gutters so neighbouring droplets never bleed into another effect.
const effectRects=[[0,24,383,334],[394,22,365,336],[778,38,352,328],[1154,95,375,262],[0,382,383,327],[390,414,390,292],[804,382,325,327],[1140,369,390,338],[0,719,383,290],[400,715,368,294],[795,720,335,289],[1138,779,394,230]];
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('雙潮美術載入失敗'));im.src=src;});
export function duetGeometry(w,h,approach,multiplier=1){return {x:w*.32,upper:h*.49,lower:h*.70,speed:(w*.68+60)/approach*multiplier};}
export class DuetView extends ScenesView{
  constructor(canvas){super(canvas);this.speedMultiplier=1;this.hideNotes=false;this.fx=[];this.caught=[];this.duet=new DuetMotion();
    this.ready=Promise.all([this.ready,load('assets/duet/effects-atlas.png'),load('assets/duet/seal-eating.png')]).then(([,effects,eating])=>{this.effects=effects;this.eating=eating;});
  }
  reset(g){super.reset(g);this.duet=new DuetMotion(g.time);this.fx=[];this.caught=[];}
  asset(index,x,y,width,height=width*8/9,{alpha=1,rotation=0,flip=false}={}){
    if(!this.effects)return;const c=this.c,im=this.effects,[a,b,sw,sh]=effectRects[index],sx=im.width/1536,sy=im.height/1024;
    c.save();c.translate(x,y);c.rotate(rotation);c.scale(flip?-1:1,1);c.globalAlpha*=alpha;c.drawImage(im,a*sx,b*sy,sw*sx,sh*sy,-width/2,-height/2,width,height);c.restore();
  }
  emit(e,g){
    if(e.type==='hit'){
      super.emit(e,g);this.duet.hit(e.note.lane,g.time,e.note.kind==='fish');
      this.fx.push({at:g.time,lane:e.note.lane,index:e.note.kind==='fish'?0:['surface','exit','dive'].includes(e.note.kind)?1:3});
      if(e.note.kind==='fish')this.caught.push({at:g.time,lane:e.note.lane,gold:e.note.lane==='upper',fish:e.note.fish});
      if(['surface','exit'].includes(e.note.kind))this.fx.push({at:g.time,lane:'upper',index:9,fall:true});
    }else if(e.type==='miss')this.fx.push({at:g.time,lane:e.note.lane||'lower',index:6,miss:true});
  }
  scenery(dive,t,g){
    const c=this.c,w=this.w,h=this.h,im=this.bg,crop=dive?[0,im.height*.39,im.width,im.height*.61]:[0,0,im.width,im.height*.49];
    const zoom=Math.max(w/crop[2],h/crop[3]),cw=w/zoom,ch=h/zoom;
    c.drawImage(im,(im.width-cw)/2,crop[1]+(crop[3]-ch)/2,cw,ch,0,0,w,h);
    if(dive){
      const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#3d8ca538');shade.addColorStop(1,'#154a69b3');c.fillStyle=shade;c.fillRect(0,0,w,h);
      for(let i=0;i<3;i++)this.asset(7,w*(.15+i*.42)+Math.sin(t*.12+i)*35,h*.40,w*.7,h*.9,{alpha:.17});
      for(let i=0;i<8;i++)this.asset(6,(i*179-t*(12+i%3)+w*30)%(w+100)-50,(i*119-t*8+h*30)%(h+100)-50,24+i%3*13,35+i%3*15,{alpha:.15});
      c.save();c.globalAlpha=.35;for(let i=0;i<6;i++)this.sprite('plant',i*w/5-t*5%80,h,110+i%3*30,165);c.restore();
    }else{
      for(let i=0;i<3;i++)this.asset(11,w*(.2+i*.35)-t*3%90,h*(.61+i*.11),w*.46,h*.06,{alpha:.5});
      const floe=Math.min(w*.9,930);this.sprite('ice',w*.52,h*(['won','lost'].includes(g.status)?.60:.72),floe,floe*.32);
    }
  }
  eatingSeal(x,y,width,frame){
    const c=this.c,im=this.eating,cell=im.width/3,sh=im.height/2;
    // Registration is at the mouth, keeping sprite changes independent of judging.
    const anchor=[[.84,.57],[.84,.57],[.81,.57],[.83,.49],[.84,.49],[.84,.49]][frame];
    c.save();c.translate(x,y);const squash=this.reduced?0:this.duet.squash;c.scale(1+squash*.24,1-squash*.24);
    c.drawImage(im,(frame%3)*cell,Math.floor(frame/3)*sh,cell,sh,-width*anchor[0],-width*anchor[1],width,width);c.restore();
  }
  draw(g,t,dt=0){
    if(!this.bg||!this.effects||!this.eating)return;
    this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;this.duet.advance(g.time);
    if(g.status==='paused')dt=0;const scene=this.flow.update(g,dt),c=this.c,w=this.w,h=this.h;
    const playing=g.status==='playing'||g.status==='paused'&&g.beforePause==='playing',ending=scene==='ending',dive=scene==='dive'||ending&&g.outcome==='hungryGhost';
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.scenery(dive,t,g);
    if(playing){
      const lane=duetGeometry(w,h,g.profile.approach,this.speedMultiplier),body=Math.min(225,w*.24)*this.motion.growth;
      const sy=lane.upper+(lane.lower-lane.upper)*this.duet.y;
      for(const key of ['upper','lower']){
        this.asset(11,(lane.x+w)/2,lane[key],w-lane.x,30,{alpha:dive?.22:.45});
        this.asset(10,lane.x,lane[key],55,65,{alpha:.5});
        this.text(key==='upper'?'D  上排':'J  下排',Math.max(40,lane.x-body*.80),lane[key]-34,w<760?13:17,dive?'#f5fbff':'#315f79');
      }
      this.asset(2,lane.x-body*.75,sy+20,body*.7,body*.43,{alpha:.45,flip:true,rotation:-.15});
      this.eatingSeal(lane.x,sy,body,this.duet.frame);
      if(!this.hideNotes)for(const n of g.notes){
        if(n.result)continue;const x=lane.x+(n.time-g.time)*lane.speed,y=lane[n.lane];if(x<lane.x-90||x>w+90)continue;
        if(n.kind==='fish'){
          this.fish(x,y,w<760?.77:1.12,t,n.lane==='upper');
          if(n.fish>1)this.text(`×${n.fish}`,x,y+31,w<760?13:16,dive?'#f3ffff':'#315b77');
        }else{
          this.asset(['surface','exit'].includes(n.kind)?5:n.kind==='dive'?1:3,x,y,w<760?68:91,w<760?58:75);
          this.text(names[n.kind],x,y-40,w<760?13:19,dive?'#fff8d8':'#345f78');
          if(['surface','exit'].includes(n.kind))this.asset(9,x+15,y-94,90,80);
        }
      }
      for(const f of this.caught){const age=g.time-f.at;if(age<0||age>.12)continue;const q=age/.12,ease=1-(1-q)**2;
        this.fish(lane.x+30*(1-ease),lane[f.lane]+(sy-lane[f.lane])*ease-Math.sin(q*Math.PI)*18,(w<760?.77:1.12)*(1-q*.8),t,f.gold);
      }this.caught=this.caught.filter(f=>g.time-f.at<.12);
      for(const f of this.fx){const age=g.time-f.at,span=f.fall?1.1:.46;if(age<0||age>span)continue;const q=age/span;
        if(f.fall)this.asset(9,lane.x+q*120,lane.upper-55+q*q*130,120,107,{rotation:q*2.3,alpha:1-q});
        else this.asset(f.index,lane.x, lane[f.lane],(f.index===1?190:115)*(1+q*.8),(f.index===1?155:102)*(1+q*.5),{alpha:(1-q)*(f.miss?.45:.83),rotation:f.miss?q*.2:0});
      }this.fx=this.fx.filter(f=>g.time-f.at<1.1);
      if(g.danger){const v=c.createRadialGradient(lane.x,sy,h*.15,lane.x,sy,Math.max(w,h)*.8);v.addColorStop(0,'#173f5900');v.addColorStop(1,`rgba(16,45,65,${g.danger*.8})`);c.fillStyle=v;c.fillRect(0,0,w,h);}
      this.canvas.dataset.biteFrame=this.duet.frame;this.canvas.dataset.sealLane=this.duet.y.toFixed(3);
    }else{
      const width=Math.min(340,w*.47),sx=w*.52,sy=h*(ending?(w<760?.49:.46):w<760?.64:.61);
      if(scene==='start')this.hungryPortrait(sx,sy,width*1.15,t);
      else{
        if(g.outcome==='angel')this.asset(8,sx,sy-width*.12,width*1.5,width*1.2);
        this.portrait(sx,sy,width,t,{flat:g.outcome==='rest',ghost:g.outcome==='hungryGhost',scale:ending?1.12:1});
        if(g.outcome==='friends'){this.portrait(sx-width*.76,sy+18,width*.65,t,{flip:true});this.portrait(sx+width*.72,sy+12,width*.65,t);this.asset(10,sx,sy-width*.37,width*.8,width*.3,{alpha:.75});}
      }
      const breathing=g.status==='breathing'||g.status==='paused'&&g.beforePause==='breathing';
      if(breathing){const size=Math.min(w*.4,h*.33),x=sx,y=h*.44,q=g.breathSize(t);this.asset(4,x,y,size,size,{alpha:.5});this.asset(4,x,y,size*q,size*q,{alpha:.95});this.text(`${Math.round(Math.min(1,q)*100)}%`,x,y+8,28);}
      if(scene==='start')this.text('咕嚕……跟著鼓點，吃一口小魚。',sx,h*.755,w<760?12:15,'#456f88');
    }
    if(this.flow.veil&&!this.reduced){c.fillStyle=`rgba(225,251,255,${this.flow.veil*.18})`;c.fillRect(0,0,w,h);}
  }
}
