import {ScenesView} from './scenes-view.js';
import {SWIM_SCALE} from './floe-settings.js';
import {fishPosition,noteVisible,swimPose} from './drift-media.js?v=11.2';
import {hungerPose} from './scenes-media.js';
import {GuguMotion} from './gugu-motion.js?v=13.2';
import {oxygenReaction,gateCue} from './gugu-feedback.js?v=13.3';
import {CYANOSIS,SWIM_HEADS,PORTRAIT_HEAD,biteHead,headMask,BELLY_HINGE,bellyStretch} from './gugu-anatomy.js?v=13.3';
const names={surface:'換氣',dive:'下海',leap:'大吸氣',exit:'上岸',call:'呼喚'};
// Trim atlas gutters so neighbouring droplets never bleed into another effect.
const effectRects=[[0,24,383,334],[394,22,365,336],[778,38,352,328],[1154,95,375,262],[0,382,383,327],[390,414,390,292],[804,382,325,327],[1140,369,390,338],[0,719,383,290],[400,715,368,294],[795,720,335,289],[1138,779,394,230]];
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('雙潮美術載入失敗'));im.src=src;});
export function floeGeometry(w,h,approach,multiplier=1){return {x:w*(w<760?.47:.35),upper:w<760?Math.max(360,h*.47):h*.49,lower:h*(w<760?.63:.68),speed:(w*.68+60)/approach*multiplier};}
export function friendsLayout(w,h){
  const width=Math.min(330,w*.42,h*.40),gap=width*.04;
  const baseline=Math.max(238,h*.53),y=baseline-width*.30;
  return {width,baseline,y,left:w*.5-(width+gap)/2,right:w*.5+(width+gap)/2};
}
export class GuguView extends ScenesView{
  constructor(canvas){super(canvas);this.speedMultiplier=1;this.hideNotes=false;this.fx=[];this.caught=[];this.duet=new GuguMotion();
    this.ready=Promise.all([this.ready,load('assets/duet/effects-atlas.png'),load('assets/duet/seal-eating.png'),Promise.all(['assets/drift/art.json','assets/gugu/art.json'].map(src=>fetch(src).then(r=>{if(!r.ok)throw Error('美術資料讀取失敗');return r.json();}))).then(([base,extra])=>({...base,...extra})),load('assets/drift/inhale-atlas.png'),load('assets/floe/menu-ocean.png'),fetch('assets/floe/swim-forms.json?v=12.6').then(r=>{if(!r.ok)throw Error('游泳素材讀取失敗');return r.json();}),load('assets/gugu/breath-crisis.png'),load('assets/gugu/breathless-expressions.png')]).then(async([,effects,eating,art,inhale,menu,forms,crisis,expressions])=>{
      this.effects=effects;this.eating=eating;this.art=art;this.inhaleImage=inhale;this.menuImage=menu;this.swimForms=forms;this.crisisImage=crisis;this.expressions=expressions;
      await Promise.all([...Object.values(art),...forms].map(async a=>{a.image=await load(a.src);}));
    });
  }
  reset(g){super.reset(g);this.duet=new GuguMotion(g.time);this.fx=[];this.caught=[];this.endingTime=0;}
  input(lane,time){this.duet.input(lane,time);}
  paintExpression(ctx,head,w,h,strength){
    if(!this.expressions||!strength)return;
    const mark=(feature,source,flip=false)=>{
      const [x,y,fw,fh]=feature,cx=x*w,cy=y*h,rx=fw*w*.60,ry=fh*h*.60;
      ctx.save();ctx.translate(cx,cy);ctx.scale(rx,ry);
      const skin=ctx.createRadialGradient(0,0,0,0,0,1);skin.addColorStop(0,`rgba(244,250,253,${strength})`);skin.addColorStop(.80,`rgba(244,250,253,${strength})`);skin.addColorStop(1,'rgba(244,250,253,0)');
      ctx.fillStyle=skin;ctx.fillRect(-1,-1,2,2);ctx.restore();
      const width=Math.min(fw*w*.90,fh*h*.90*source[2]/source[3]),height=width*source[3]/source[2];
      ctx.save();ctx.translate(cx,cy);ctx.scale(flip?-1:1,1);ctx.globalAlpha=strength;
      ctx.drawImage(this.expressions,...source,-width/2,-height/2,width,height);ctx.restore();
    };
    head.eyes.forEach((eye,i)=>mark(eye,[977,221,195,227],head.eyes.length===2&&i===1));
    if(head.mouth)mark(head.mouth,head.mouthSource||[1753,346,134,165]);
  }
  tintedSprite(image,rect,amount=0,head=null){
    const tone=Math.round(amount*30),key=image.src+':'+rect.join(',')+':'+JSON.stringify(head);
    if(!tone||!head)return {image,rect};
    this.tints??=new Map();let cached=this.tints.get(key);
    if(!cached){
      const layer=document.createElement('canvas');layer.width=rect[2];layer.height=rect[3];
      const ctx=layer.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,...rect,0,0,layer.width,layer.height);
      const original=ctx.getImageData(0,0,layer.width,layer.height),mask=new Float32Array(layer.width*layer.height);
      for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++)mask[y*layer.width+x]=headMask(x/layer.width,y/layer.height,head);
      cached={image:layer,rect:[0,0,layer.width,layer.height],original,mask};this.tints.set(key,cached);
    }
    if(cached.tone!==tone){
      const ctx=cached.image.getContext('2d'),w=cached.image.width,h=cached.image.height,alpha=tone/30;
      ctx.putImageData(cached.original,0,0);
      this.paintExpression(ctx,head,w,h,Math.max(0,Math.min(1,(alpha/.78*60-5)/40)));
      const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,original=cached.original.data;
      for(let p=0,i=0;p<cached.mask.length;p++,i+=4){
        const tint=alpha*cached.mask[p];
        if(!cached.mask[p]){for(let ch=0;ch<4;ch++)data[i+ch]=original[i+ch];continue;}
        for(let ch=0;ch<3;ch++)data[i+ch]*=1-tint*(1-CYANOSIS[ch]/255);
        data[i+3]=original[i+3];
      }
      ctx.putImageData(pixels,0,0);cached.tone=tone;
    }
    return cached;
  }
  // All seal poses use one intact source rectangle and one uniform scale.
  sealSprite(image,rect,x,y,width,{anchor=[.5,.5],alpha=1,rotation=0,flip=false,scale=1,tint=0,head=null}={}){
    const c=this.c,height=width*rect[3]/rect[2],source=this.tintedSprite(image,rect,tint,head);
    c.save();c.translate(x,y);c.rotate(rotation);c.scale((flip?-1:1)*scale,scale);c.globalAlpha*=alpha;
    c.drawImage(source.image,...source.rect,-width*anchor[0],-height*anchor[1],width,height);c.restore();
  }
  portrait(x,y,width,t,{flat=false,ghost=false,flip=false,scale=1,animated=false}={}){
    const im=this.sealImage;
    this.sealSprite(im,[0,0,im.width,im.height],x,y,width,{flip,scale,alpha:ghost?.6:1,rotation:flat?-.08:animated&&!this.reduced?Math.sin(t*2)*.015:0});
  }
  hungryPortrait(x,y,width,time){
    const pose=hungerPose(time,this.reduced),im=this.hungerImage,cell=im.width/3;
    const rect=[pose.frame*cell,Math.round(im.height*.22),cell,Math.round(im.height*.67)];
    this.sealSprite(im,rect,x,y+width*.25,width,{anchor:[.5,1],scale:1+pose.breath});
    this.canvasFrame=pose.frame;
  }
  illustration(key,x,y,width,{alpha=1,rotation=0,flip=false}={}){
    const a=this.art?.[key];if(!a?.image)return;
    this.sealSprite(a.image,a.rect,x,y,width,{alpha,rotation,flip});
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
      const floe=Math.min(w*.9,930),friends=g.outcome==='friends';
      const iceY=friends?friendsLayout(w,h).baseline+floe*.07:h*(['won','lost'].includes(g.status)?.60:breathing&&w<760?.64:.72);
      this.sprite('ice',w*(friends?.5:.52),iceY,floe,floe*.32);
    }
  }
  eatingSeal(x,y,width,frame){
    const c=this.c,swim=this.swimForms[this.game.form],t=this.game.time,pose=swimPose(t,this.reduced),health=this.health||oxygenReaction(100,t);
    const bite=this.duet.bites.find(b=>b.start<=t&&b.end>t);
    const mix=bite?Math.min(1,(bite.end-t)/.035):0;
    if(swim?.image&&mix<1){
      // Pivot at the mouth: breathing and shivering never shift the hit point.
      const scale=pose.breath+health.heave*.5+(this.reduced?0:this.duet.impulse*.018);
      this.sealSprite(swim.image,swim.rect,x,y,width,{anchor:swim.anchor,alpha:1-mix,tint:health.tint,head:SWIM_HEADS[this.game.form],scale,
        rotation:pose.roll*health.tailStrength+health.shiver-health.stoop*.45});
    }
    this.canvas.dataset.sealPose=frame?'eating':'swimming';
    this.canvas.dataset.sealForm=swim.id;
    if(!frame||mix<=0)return;
    // Keep the original bite artwork's proportions instead of flattening it.
    c.save();c.globalAlpha*=mix;this.eatPose(x,y,width,frame);c.restore();
  }
  eatPose(x,y,width,frame){
    const im=this.eating,cell=im.width/3,sh=im.height/2;
    // Registration is at the mouth, keeping sprite changes independent of judging.
    const anchor=[[.84,.57],[.84,.57],[.81,.57],[.83,.49],[.84,.49],[.84,.49]][frame];
    this.sealSprite(im,[(frame%3)*cell,Math.floor(frame/3)*sh,cell,sh],x,y,width,{anchor,tint:this.health?.tint||0,head:biteHead(frame)});
  }
  mistSprite(index,x,y,width,height,rotation=0,alpha=1){
    const rects=[[30,35,700,585],[753,155,766,374],[20,634,842,342],[975,628,457,339]],im=this.inhaleImage;
    if(!im)return;const [a,b,sw,sh]=rects[index],c=this.c;
    c.save();c.translate(x,y);c.rotate(rotation);c.globalAlpha*=alpha;
    c.drawImage(im,a*im.width/1536,b*im.height/1024,sw*im.width/1536,sh*im.height/1024,-width/2,-height/2,width,height);c.restore();
  }
  inhalePortrait(x,y,width,state){
    const im=this.tintedSprite(this.sealImage,[0,0,this.sealImage.width,this.sealImage.height],this.health?.tint||0,PORTRAIT_HEAD).image,height=width*im.height/im.width,layer=this.breathLayer??=document.createElement('canvas');
    const columns=Math.ceil(width*this.dpr),ph=columns*im.height/im.width,hinge=ph*BELLY_HINGE;
    if(layer.width!==columns||layer.height!==Math.ceil(ph*1.22)){layer.width=columns;layer.height=Math.ceil(ph*1.22);}
    const ctx=layer.getContext('2d');ctx.clearRect(0,0,layer.width,layer.height);
    // The upper half is unchanged. Only the abdomen below the fixed spine expands.
    ctx.drawImage(im,0,0,im.width,im.height*BELLY_HINGE,0,0,columns,hinge);
    for(let i=0;i<columns;i++){
      const q=(i+.5)/columns,stretch=bellyStretch(q,state.expansion);
      ctx.drawImage(im,i*im.width/columns,im.height*BELLY_HINGE,im.width/columns,im.height*(1-BELLY_HINGE),i,hinge,1,(ph-hinge)*stretch);
    }
    const scale=width/columns;this.c.drawImage(layer,x-width/2,y-height/2,width,layer.height*scale);
    this.canvas.dataset.bellyScale=bellyStretch(.42,state.expansion).toFixed(3);this.canvas.dataset.chestScale='1.000';
  }
  inhalation(x,y,width,time){
    const c=this.c,state=this.game.breathVisual();
    const mouth={x:x+width*.306,y},size=Math.min(this.h*.34,this.w*.31);
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
    const px=this.w*(this.w<760?.5:.80),py=this.w<760?Math.max(250,this.h*.33):Math.max(290,this.h*.45);
    if(!this.game.openingBreath){
      this.text(`${this.game.breathRemaining.toFixed(1)} 秒後下海`,px,py,this.w<760?27:38,'#a54139');
    }
    this.canvas.dataset.breathRing=state.ringScale.toFixed(3);this.canvas.dataset.breathPhase=this.game.openingBreath?'timed':'roll';
  }
  text(value,x,y,size,color){super.text(value,x,y,Math.max(this.w<760?14:16,size),color);}
  menu(g,t){
    const c=this.c,w=this.w,h=this.h,im=this.menuImage;
    c.drawImage(im,0,0,im.width,im.height,0,0,w,h);
    const small=w<760,width=small?Math.min(205,w*.52):Math.min(350,w*.28);
    this.portrait(w*(small?.24:.255),h*(small?.59:.64)+(this.reduced?0:Math.sin(t*1.3)*3),width,t);
  }
  friendsEnding(t,float){
    const {left,right,y,width,baseline}=friendsLayout(this.w,this.h);
    this.portrait(left,y,width,t);
    const friend=this.art.friend,height=width*friend.rect[3]/friend.rect[2];
    this.illustration('friend',right,baseline-height/2+float*.35,width);
    this.asset(10,this.w*.5,y-width*.38,width*.56,width*.21,{alpha:.75});
    Object.assign(this.canvas.dataset,{endingSeals:2,endingCenter:this.w*.5});
  }
  draw(g,t,dt=0){
    if(!this.bg||!this.effects||!this.eating||!this.swimForms?.every(a=>a.image))return;
    this.ensureGame(g);this.motion.advance(g.time);this.motion.events.length=0;this.duet.advance(g.time);
    if(g.status==='paused')dt=0;const scene=this.flow.update(g,dt),c=this.c,w=this.w,h=this.h;
    const playing=g.status==='playing'||g.status==='paused'&&g.beforePause==='playing',ending=scene==='ending',dive=scene==='dive'||ending&&g.outcome==='hungryGhost';
    this.health=oxygenReaction(g.air,t,playing&&g.phase!=='shore',this.reduced);this.cue=gateCue(g);
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.scenery(dive,t,g);
    if(g.status==='ready'){this.menu(g,t);return;}
    const urgency=Math.max(this.cue.strength*.66,this.health.severity*.32);
    if(urgency&&this.crisisImage){c.save();c.globalAlpha=urgency*(this.reduced?1:.86+.14*Math.sin(t*5)**2);c.drawImage(this.crisisImage,0,0,w,h);c.restore();}
    Object.assign(this.canvas.dataset,{oxygenStress:this.health.severity.toFixed(3),oxygenTint:this.health.tint.toFixed(3),oxygenRegion:'head',expression:this.health.expression.toFixed(3),gateCue:this.cue.mode});
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
          c.save();if(this.cue.note===n){c.shadowColor='#ffd38b';c.shadowBlur=24;}
          this.asset(['surface','exit'].includes(n.kind)?5:n.kind==='dive'?1:3,x,y,w<760?82:112,w<760?70:91);c.restore();
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
      this.canvas.dataset.biteFrame=this.duet.frame;this.canvas.dataset.sealLane=this.duet.y.toFixed(3);this.canvas.dataset.inputCount=this.duet.inputCount;
    }else{
      if(ending)this.endingTime=(this.endingTime||0)+dt;
      const float=this.reduced?0:Math.sin((this.endingTime||0)*2)*5;
      const breathing=g.breathingActive;
      const width=breathing?Math.min(430,w*.70):Math.min(340,w*.47),sx=breathing?w*.40:w*.52,sy=h*(breathing?.50:ending?(w<760?.49:.46):w<760?.64:.61);
      if(scene==='start')this.portrait(sx,sy+(this.reduced?0:Math.sin(t*1.3)*3),width*1.15,t);
      else if(breathing){this.inhalePortrait(sx,sy,width,g.breathVisual());this.inhalation(sx,sy,width,t);}
      else{
        if(g.outcome==='angel')this.illustration('angel',sx,sy-15+float,width*1.16);
        else if(g.outcome==='hungryGhost'){
          c.save();c.globalAlpha=.76;this.hungryPortrait(sx,sy+float,width*1.12,this.endingTime);c.restore();
        }else if(g.outcome==='friends')this.friendsEnding(t,float);
        else this.portrait(sx,sy,width,t,{flat:g.outcome==='rest',scale:ending?1.12:1});
      }
      if(scene==='start')this.text('咕嚕……跟著鼓點，吃一口小魚。',sx,h*.755,w<760?12:15,'#456f88');
    }
    if(this.flow.veil&&!this.reduced){c.fillStyle=`rgba(225,251,255,${this.flow.veil*.18})`;c.fillRect(0,0,w,h);}
  }
}
