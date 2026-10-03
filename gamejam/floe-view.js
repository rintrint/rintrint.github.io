import {ScenesView} from './scenes-view.js';
import {SWIM_SCALE} from './floe-settings.js';
import {fishPosition,noteVisible,swimPose,breathColumn} from './drift-media.js?v=11.2';
import {FloeMotion} from './floe-motion.js?v=12.2';
const names={surface:'換氣',dive:'下海',leap:'大吸氣',exit:'上岸',call:'呼喚'};
// Trim atlas gutters so neighbouring droplets never bleed into another effect.
const effectRects=[[0,24,383,334],[394,22,365,336],[778,38,352,328],[1154,95,375,262],[0,382,383,327],[390,414,390,292],[804,382,325,327],[1140,369,390,338],[0,719,383,290],[400,715,368,294],[795,720,335,289],[1138,779,394,230]];
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('雙潮美術載入失敗'));im.src=src;});
export function floeGeometry(w,h,approach,multiplier=1){return {x:w*(w<760?.47:.35),upper:w<760?Math.max(360,h*.47):h*.49,lower:h*(w<760?.63:.68),speed:(w*.68+60)/approach*multiplier};}
export class FloeView extends ScenesView{
  constructor(canvas){super(canvas);this.speedMultiplier=1;this.hideNotes=false;this.fx=[];this.caught=[];this.duet=new FloeMotion();
    this.ready=Promise.all([this.ready,load('assets/duet/effects-atlas.png'),load('assets/duet/seal-eating.png'),fetch('assets/drift/art.json').then(r=>{if(!r.ok)throw Error('美術資料讀取失敗');return r.json();}),load('assets/drift/inhale-atlas.png'),load('assets/floe/menu-ocean.png'),fetch('assets/floe/swim-forms.json?v=12.6').then(r=>{if(!r.ok)throw Error('游泳素材讀取失敗');return r.json();})]).then(async([,effects,eating,art,inhale,menu,forms])=>{
      this.effects=effects;this.eating=eating;this.art=art;this.inhaleImage=inhale;this.menuImage=menu;this.swimForms=forms;
      await Promise.all([...Object.values(art),...forms].map(async a=>{a.image=await load(a.src);}));
    });
  }
  reset(g){super.reset(g);this.duet=new FloeMotion(g.time);this.fx=[];this.caught=[];this.endingTime=0;}
  input(lane,time){this.duet.input(lane,time);}
  illustration(key,x,y,width,{alpha=1,rotation=0,flip=false,scaleY=1}={}){
    const a=this.art?.[key];if(!a?.image)return;
    const c=this.c,[sx,sy,sw,sh]=a.rect,height=width*sh/sw;
    c.save();c.translate(x,y);c.rotate(rotation);c.scale(flip?-1:1,scaleY);c.globalAlpha*=alpha;
    c.drawImage(a.image,sx,sy,sw,sh,-width/2,-height/2,width,height);c.restore();
  }
  asset(index,x,y,width,height=width*8/9,{alpha=1,rotation=0,flip=false}={}){
    if(index===1||index===9){this.illustration(index===1?'splash':'fisher',x,y,width,{alpha,rotation,flip});return;}
    if(!this.effects)return;const c=this.c,im=this.effects,[a,b,sw,sh]=effectRects[index],sx=im.width/1536,sy=im.height/1024;
    c.save();c.translate(x,y);c.rotate(rotation);c.scale(flip?-1:1,1);c.globalAlpha*=alpha;c.drawImage(im,a*sx,b*sy,sw*sx,sh*sy,-width/2,-height/2,width,height);c.restore();
  }
  emit(e,g){
    if(e.type==='hit'){
      super.emit(e,g);this.duet.hit(e.note.lane,g.time,e.note.kind==='fish');
      this.fx.push({at:g.time,lane:e.note.lane,index:e.note.kind==='fish'?0:['surface','exit','dive'].includes(e.note.kind)?1:3});
      if(e.note.kind==='fish')this.caught.push({at:g.time,lane:e.note.lane,gold:e.note.lane==='upper',fish:e.note.fish});
      if(['surface','exit'].includes(e.note.kind))this.fx.push({at:g.time,lane:'upper',index:9,fall:true});
    }else if(e.type==='splash'||e.type==='bigBreath'){this.duet.input('lower',g.time);this.fx.push({at:g.time,lane:'lower',index:1});}
    else if(e.type==='miss')this.fx.push({at:g.time,lane:e.note.lane||'lower',index:6,miss:true});
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
      const breathing=g.breathingActive;
      const floe=Math.min(w*.9,930);this.sprite('ice',w*.52,h*(['won','lost'].includes(g.status)?.60:breathing&&w<760?.64:.72),floe,floe*.32);
    }
  }
  eatingSeal(x,y,width,frame){
    const c=this.c,swim=this.swimForms[this.game.form],t=this.game.time,pose=swimPose(t,this.reduced);
    const bite=this.duet.bites.find(b=>b.start<=t&&b.end>t);
    const mix=bite?Math.min(1,(t-bite.start)/.025,(bite.end-t)/.035):0;
    if(swim?.image&&mix<1){
      const [sx,sy,sw,sh]=swim.rect,height=width*sh/sw,[ax,ay]=swim.anchor;
      c.save();c.translate(x,y);c.rotate(pose.roll);c.scale(1,pose.breath);c.globalAlpha*=1-mix;
      // Deform the tail gently, while the mouth stays fixed at the judgement point.
      for(let i=0;i<24;i++){
        const q=i/24,part=sw/24,wiggle=pose.wave*width*(1-q)**2;
        c.drawImage(swim.image,sx+i*part,sy,Math.min(part+.5,sw-i*part),sh,(q-ax)*width,-height*ay+wiggle,width/24+.4,height);
      }
      c.restore();
    }
    this.canvas.dataset.sealPose=frame?'eating':'swimming';
    this.canvas.dataset.sealForm=swim.id;
    if(!frame||mix<=0)return;
    // Match the upright bite atlas to this swimming body's proportions.
    // Growing seals must retain their body size throughout the bite, too.
    const heightScale=(swim.rect[3]/swim.rect[2])/.65;
    c.save();c.globalAlpha*=mix;this.eatPose(x,y,width*1.08,frame,heightScale);c.restore();
  }
  eatPose(x,y,width,frame,heightScale=1){
    const c=this.c,im=this.eating,cell=im.width/3,sh=im.height/2;
    // Registration is at the mouth, keeping sprite changes independent of judging.
    const anchor=[[.84,.57],[.84,.57],[.81,.57],[.83,.49],[.84,.49],[.84,.49]][frame];
    c.save();c.translate(x,y);const squash=this.reduced?0:this.duet.squash;c.scale(1+squash*.24,(1-squash*.24)*heightScale);
    c.drawImage(im,(frame%3)*cell,Math.floor(frame/3)*sh,cell,sh,-width*anchor[0],-width*anchor[1],width,width);c.restore();
  }
  mistSprite(index,x,y,width,height,rotation=0,alpha=1){
    const rects=[[30,35,700,585],[753,155,766,374],[20,634,842,342],[975,628,457,339]],im=this.inhaleImage;
    if(!im)return;const [a,b,sw,sh]=rects[index],c=this.c;
    c.save();c.translate(x,y);c.rotate(rotation);c.globalAlpha*=alpha;
    c.drawImage(im,a*im.width/1536,b*im.height/1024,sw*im.width/1536,sh*im.height/1024,-width/2,-height/2,width,height);c.restore();
  }
  inhalePortrait(x,y,width,state){
    const c=this.c,im=this.sealImage,height=width*2/3,base=y+height*.4;
    // Warp into integer-aligned offscreen pixels, avoiding translucent seams between strips.
    const layer=this.breathLayer||=(document.createElement('canvas')),columns=Math.ceil(width*this.dpr),ph=Math.ceil(height*this.dpr),anchor=ph*1.25;
    if(layer.width!==columns||layer.height!==Math.ceil(ph*1.4)){layer.width=columns;layer.height=Math.ceil(ph*1.4);}
    const ctx=layer.getContext('2d');ctx.clearRect(0,0,layer.width,layer.height);
    for(let i=0;i<columns;i++){
      const q=i/columns,stretch=breathColumn(q+.5/columns,state.expansion),sw=im.width/columns;
      ctx.drawImage(im,i*sw,0,sw,im.height,i,anchor-ph*.9*stretch,1,ph*stretch);
    }
    c.drawImage(layer,x-width/2,base-anchor/this.dpr,width,layer.height/this.dpr);
    this.canvas.dataset.chestScale=breathColumn(.39,state.expansion).toFixed(3);
  }
  inhalation(x,y,width,time){
    const c=this.c,state=this.game.breathVisual(),mouth={x:x+width*.306,y:y},size=Math.min(this.h*.34,this.w*.31);
    const center=mouth.x+size*(.13+.55*(1-state.expansion));
    this.mistSprite(0,center,mouth.y-10,size*state.ringScale,size*state.ringScale,this.reduced?0:-time*.42,state.mist*.82);
    if(!this.reduced){
      for(let i=0;i<8;i++){
        const p=(time*.9+i/8)%1,angle=-1.05+(i%4)*.66,reach=(size*1.15)*(1-p)**1.4+12;
        const px=mouth.x+Math.cos(angle)*reach,py=mouth.y+Math.sin(angle)*reach+Math.sin(p*Math.PI*2+i)*6*(1-p);
        this.mistSprite(i%2+1,px,py,(45+size*.29)*(1-p*.48),19+size*.06,angle+Math.PI,Math.sin(p*Math.PI)*.68*state.mist);
      }
    }
    this.mistSprite(3,mouth.x+13,mouth.y+2,35+state.fill*27,22+state.fill*17,Math.PI,state.mist*(.14+.4*state.fill));
    const px=this.w*.5,py=this.h*(this.w<760?.29:.25);
    this.text(`自動下海倒數 ${this.game.breathRemaining.toFixed(1)} 秒`,px,py,this.w<760?21:28,'#345f78');
    this.text(`${Math.round(state.fill*100)}%${state.fill>=1?' · 吸飽了！':''}`,px,py+42,this.w<760?31:39,state.ready?'#ac8040':'#3d7f97');
    this.canvas.dataset.breathRing=state.ringScale.toFixed(3);this.canvas.dataset.breathPhase='roll';
  }
  text(value,x,y,size,color){super.text(value,x,y,Math.max(this.w<760?14:16,size),color);}
  menu(g,t){
    const c=this.c,w=this.w,h=this.h,im=this.menuImage;
    c.drawImage(im,0,0,im.width,im.height,0,0,w,h);
    const small=w<760,width=small?Math.min(205,w*.52):Math.min(350,w*.28);
    this.portrait(w*(small?.24:.255),h*(small?.59:.64)+(this.reduced?0:Math.sin(t*1.3)*3),width,t);
  }
  draw(g,t,dt=0){
    if(!this.bg||!this.effects||!this.eating||!this.swimForms?.every(a=>a.image))return;
    this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;this.duet.advance(g.time);
    if(g.status==='paused')dt=0;const scene=this.flow.update(g,dt),c=this.c,w=this.w,h=this.h;
    const playing=g.status==='playing'||g.status==='paused'&&g.beforePause==='playing',ending=scene==='ending',dive=scene==='dive'||ending&&g.outcome==='hungryGhost';
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.scenery(dive,t,g);
    if(g.status==='ready'){this.menu(g,t);return;}
    if(playing&&!g.breathingActive){
      const lane=floeGeometry(w,h,g.profile.approach,this.speedMultiplier),body=Math.min(225,w*.24)*SWIM_SCALE*this.motion.growth;
      this.canvas.dataset.swimScale=SWIM_SCALE;this.canvas.dataset.effectiveSpeed=this.speedMultiplier;
      const sy=lane.upper+(lane.lower-lane.upper)*this.duet.y;
      for(const key of ['upper','lower']){
        this.asset(11,(lane.x+w)/2,lane[key],w-lane.x,30,{alpha:dive?.22:.45});
        this.asset(10,lane.x,lane[key],55,65,{alpha:.5});
        this.text(key==='upper'?'D / F / ↑':'J / K / ↓',Math.max(54,lane.x-body*.80),lane[key]-34,w<760?12:16,dive?'#f5fbff':'#315f79');
      }
      this.asset(2,lane.x-body*.75,sy+20,body*.7,body*.43,{alpha:.45,flip:true,rotation:-.15});
      this.eatingSeal(lane.x,sy,body,this.duet.frame);
      let missedVisible=0;
      if(!this.hideNotes)for(const n of g.notes){
        const {x,y}=fishPosition(n,g,lane);if(!noteVisible(n,x,w))continue;
        if(n.result==='miss'&&n.kind==='fish')missedVisible++;
        if(n.kind==='fish'){
          this.fish(x,y,w<760?.77:1.12,t,n.lane==='upper');
          if(n.fish>1)this.text(`×${n.fish}`,x,y+31,w<760?13:16,dive?'#f3ffff':'#315b77');
        }else{
          this.asset(['surface','exit'].includes(n.kind)?5:n.kind==='dive'?1:3,x,y,w<760?68:91,w<760?58:75);
          this.text(names[n.kind],x,y-40,w<760?13:19,dive?'#fff8d8':'#345f78');
          if(['surface','exit'].includes(n.kind))this.asset(9,x+12,y-101,w<760?95:135,100);
        }
      }
      this.canvas.dataset.missedVisible=missedVisible;
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
      if(ending)this.endingTime=(this.endingTime||0)+dt;
      const float=this.reduced?0:Math.sin((this.endingTime||0)*2)*5;
      const breathing=g.breathingActive;
      const width=breathing?Math.min(430,w*.70):Math.min(340,w*.47),sx=breathing?w*.40:w*.52,sy=h*(breathing?(w<760?.53:.57):ending?(w<760?.49:.46):w<760?.64:.61);
      if(scene==='start')this.portrait(sx,sy+(this.reduced?0:Math.sin(t*1.3)*3),width*1.15,t);
      else if(breathing){this.inhalePortrait(sx,sy,width,g.breathVisual());this.inhalation(sx,sy,width,t);}
      else{
        if(g.outcome==='angel')this.illustration('angel',sx,sy-15+float,width*1.16);
        else if(g.outcome==='hungryGhost'){
          c.save();c.globalAlpha=.76;this.hungryPortrait(sx,sy+float,width*1.12,this.endingTime);c.restore();
        }else this.portrait(sx,sy,width,t,{flat:g.outcome==='rest',scale:ending?1.12:1});
        if(g.outcome==='friends'){this.portrait(sx-width*.76,sy+18,width*.65,t,{flip:true});this.illustration('friend',sx+width*.72,sy+12+float*.5,width*.74);this.asset(10,sx,sy-width*.37,width*.8,width*.3,{alpha:.75});}
      }
      if(scene==='start')this.text('咕嚕……跟著鼓點，吃一口小魚。',sx,h*.755,w<760?12:15,'#456f88');
    }
    if(this.flow.veil&&!this.reduced){c.fillStyle=`rgba(225,251,255,${this.flow.veil*.18})`;c.fillRect(0,0,w,h);}
  }
}
