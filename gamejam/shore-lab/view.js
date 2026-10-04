import {clamp,ease} from './core.js';
const lerp=(a,b,q)=>a+(b-a)*q;
const art={bg:'../assets/tide/ocean.png',props:'../assets/tide/props.png',seal:'../assets/tide/seal.png',swim:'../assets/floe/swim-thin.png',splash:'../assets/drift/splash.webp',mist:'../assets/drift/inhale-atlas.png',fx:'../assets/duet/effects-atlas.png',fisher:'assets/fisher-poses.png'};
const fisherRects=[[6,8,505,555],[565,52,470,490],[1052,91,479,480],[9,688,509,295],[559,614,476,352],[1065,605,470,401]];
const effectRects=[[0,24,383,334],[394,22,365,336],[778,38,352,328],[1154,95,375,262],[0,382,383,327],[390,414,390,292],[804,382,325,327],[1140,369,390,338],[0,719,383,290],[400,715,368,294],[795,720,335,289],[1138,779,394,230]];
export class ShoreView{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.images={};this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.ready=Promise.all(Object.entries(art).map(([k,path])=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{this.images[k]=i;resolve()};i.onerror=()=>reject(Error(`美術 ${k} 載入失敗`));i.src=path})));this.camera={x:640,y:360,zoom:1};}
 image(key,rect,x,y,w,{rotation=0,alpha=1,flip=false,anchor=.5}={}){const im=this.images[key];if(!im)return;rect??=[0,0,im.width,im.height];const h=w*rect[3]/rect[2],c=this.c;c.save();c.globalAlpha*=clamp(alpha);c.translate(x,y);c.rotate(rotation);c.scale(flip?-1:1,1);c.drawImage(im,...rect,-w*.5,-h*anchor,w,h);c.restore();}
 prop(name,x,y,w,opts={}){const im=this.images.props,r={ice:[0,.15,.56,.30],fish:[.60,.15,.38,.29],gold:[.07,.57,.43,.33],plant:[.57,.54,.41,.44]}[name];this.image('props',[r[0]*im.width,r[1]*im.height,r[2]*im.width,r[3]*im.height],x,y,w,opts)}
 person(index,x,y,w,opts={}){const im=this.images.fisher,r=fisherRects[index].map((v,i)=>v*(i%2?im.height/1024:im.width/1536));this.image('fisher',r,x,y,w,opts)}
 effect(index,x,y,w,opts={}){const im=this.images.fx,r=effectRects[index].map((v,i)=>v*(i%2?im.height/1024:im.width/1536));this.image('fx',r,x,y,w,opts)}
 cover(rect,dest){let im=this.images.bg;let q=Math.max(dest[2]/rect[2],dest[3]/rect[3]);const w=dest[2]/q,h=dest[3]/q;this.c.drawImage(im,rect[0]+(rect[2]-w)/2,rect[1]+(rect[3]-h)/2,w,h,...dest)}
 breathSeal(x,y,w,g){const im=this.images.seal,c=this.c,pulse=Math.exp(-(g.time-g.lastTap)*10),size=1+(g.phase==='breath'?g.air/100*.035+pulse*.015:.03*Math.sin(g.age*2)),width=w*size,h=width*im.height/im.width;const expand=g.phase==='charge'?ease(g.age/(g.config.charge-.35))*.26:g.air/100*.18+pulse*.045;c.save();c.translate(x,y);const top=-h*.5,hinge=.57;this.c.drawImage(im,0,0,im.width,im.height*hinge,-width/2,top,width,h*hinge);for(let col=0;col<64;col++){let u=(col+.5)/64,k=Math.sin(clamp((u-.18)/.48)*Math.PI)**2;this.c.drawImage(im,col*im.width/64,im.height*hinge,im.width/64,im.height*(1-hinge),-width/2+col*width/64,top+h*hinge,width/64+.4,h*(1-hinge)*(1+k*expand));}c.restore();}
 mist(x,y,w,age,g){let im=this.images.mist,c=this.c,pulse=Math.exp(-(g.time-g.lastTap)*7);const rect=[30*im.width/1536,35*im.height/1024,700*im.width/1536,585*im.height/1024];const inhale=g.phase==='charge'?ease(age/(g.config.charge-.35)):clamp(g.air/100);this.image('mist',rect,x+75*(1-inhale),y,w*(1.2-inhale*.65),{rotation:this.reduced?0:-age*.35,alpha:.38+pulse*.45});for(let i=0;i<5;i++){const q=(age*1.6+i*.2)%1;this.effect(2,x+150*(1-q),y+Math.sin(i*1.7)*65*(1-q),28+q*23,{alpha:Math.sin(q*Math.PI)*.4,rotation:-.4})}}
 scene(g,t){
   const c=this.c,im=this.images.bg;this.cover([0,0,im.width,im.height*.4],[-450,-360,2350,710]);this.cover([0,im.height*.34,im.width,im.height*.66],[-450,350,2350,940]);
   const wash=c.createLinearGradient(0,350,0,900);wash.addColorStop(0,'#4190a044');wash.addColorStop(1,'#153e63cc');c.fillStyle=wash;c.fillRect(-450,350,2350,940);
   for(let i=0;i<5;i++)this.effect(7,-170+i*420+Math.sin(t*.2+i)*40,600,500,{alpha:.15,rotation:-.12});
   this.prop('ice',650,335,1000);this.prop('ice',1370,331,500);this.prop('ice',-160,344,400);
   this.person(3,592,318,226);this.person(3,1250,306,220);
   this.effect(11,630,394,890,{alpha:.55});this.effect(11,1230,377,480,{alpha:.4});
   for(let i=0;i<7;i++)this.prop('plant',i*260-180,1010+(i%3)*35,180,{alpha:.5});
   for(let i=0;i<10;i++)this.effect(6,((i*213-t*(9+i%3*5))%1850+1850)%1850-200,490+(i*173%470)-t*4%40,25+i%3*12,{alpha:.2});
   for(let i=0;i<4;i++)this.prop(i%2?'fish':'gold',980+i*105-t*12%100,675+Math.sin(t*2+i)*13+i%2*30,39,{alpha:.5});
 }
 draw(g,dt=1/60){if(!this.images.fisher)return;const c=this.c,t=g.time||performance.now()/1000*.18,p=g.phase,a=g.age,v=g.version;
   let sx=365,sy=566,sw=264,angle=0,portrait=false;let fx=786,fy=212,fw=265,fi=0,fr=0,rod=false;
   let cam={x:680,y:425,zoom:1},impact=-10,waterBurst=-1,landPuff=-1;
   if(v==='b')cam={x:730,y:397,zoom:.96};if(v==='c')cam={x:500,y:505,zoom:1.38};
   if(p==='ready'){sx=v==='b'?490:380;sy=543+Math.sin(t*2)*5;angle=-.06;}
   if(p==='approach'){
     sx=lerp(v==='b'?380:270,566,ease(a/3.5));sy=lerp(585,500,ease(a/3.5))+Math.sin(a*4)*5;angle=-.11-ease(a/3.5)*.27;
     if(v==='b'){sy=530-Math.sin(a*6)*7;fx-=g.tug*18;fr=-g.tug*.05;sx-=Math.sin(a*7)*Math.exp(-(g.time-g.lastTap)*6)*22;}
     if(v==='c'){cam.x=lerp(430,542,ease(a/3.5));cam.zoom=1.38+ease(a/3.5)*.17;cam.y=515;}
   }
   if(p==='launch'){
     // The contact moment is shared by the pose change, rod release, splash and sound.
     const contact=v==='c'?.70:.38;impact=a-contact;
     // A short visual hold gives C weight without stopping the audio clock or input.
     const motionAge=v==='c'&&a>contact?Math.max(contact,a-.09):a;
     const rise=ease(motionAge/(v==='c'?1.05:.66));sx=lerp(566,649,rise);sy=lerp(503,252,rise);sw=lerp(264,285,rise);angle=lerp(-.6,.05,rise);portrait=rise>.7;
     if(impact>=0){const q=clamp((motionAge-contact)/(v==='c'?1.55:1.15));fi=q>.82?2:1;fx=786+q*(v==='b'?173:224);fy=212-Math.sin(q*Math.PI)*146+q*59;fr=fi===2?-.05:q*.72;rod=true;landPuff=q>.79?(q-.79)/.21:-1;}
     waterBurst=clamp((motionAge-.08)/1.1);cam.y=lerp(cam.y,290,ease(motionAge/.8));cam.x=lerp(cam.x,780,ease(motionAge/1.4));cam.zoom=v==='c'?lerp(1.55,1.1,ease(motionAge/1.2)):v==='b'?.96:1;
   }
   if(['breath','charge','leap','done'].includes(p)){
     portrait=true;sx=649;sy=256;sw=292;fi=2;fx=v==='b'?959:1010;fy=271;fr=-.05;rod=true;
     cam={x:v==='c'?738:800,y:v==='c'?271:304,zoom:v==='c'?1.22:v==='b'?.98:1.03};
     if(p==='charge'){angle=-ease(a/(g.config.charge-.35))*.10;sw*=1+ease(a/(g.config.charge-.35))*.04;}
     if(p==='leap'){
       const q=clamp(a/g.config.leap),travel=ease(q);sx=lerp(649,1250,travel);sy=lerp(254,505,travel)-Math.sin(q*Math.PI)*290;angle=-.42+q*1.15;portrait=q<.72;sw=lerp(292,264,q);cam.x=lerp(800,1120,ease(q));cam.y=lerp(300,410,ease(q));cam.zoom=v==='c'?lerp(1.22,1,ease(q)):1;waterBurst=q>.80?(q-.80)/.2:-1;
     }
     if(p==='done'){sx=1230;sy=520;portrait=false;angle=.08;cam={x:1080,y:410,zoom:1};}
   }
   if(p==='fail'){sy=565+Math.sin(a)*10;angle=.12;fi=0;cam={x:680,y:425,zoom:1};}
   const speed=this.reduced?1:1-Math.exp(-Math.max(.008,dt)*7);for(const k of ['x','y','zoom'])this.camera[k]=lerp(this.camera[k],cam[k],speed);
   const width=this.canvas.clientWidth,height=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2),cw=Math.round(width*dpr),ch=Math.round(height*dpr);if(this.canvas.width!==cw||this.canvas.height!==ch){this.canvas.width=cw;this.canvas.height=ch;}
   const scale=Math.min(cw/1280,ch/720);c.setTransform(1,0,0,1,0,0);c.fillStyle='#b4deed';c.fillRect(0,0,cw,ch);c.setTransform(scale,0,0,scale,(cw-1280*scale)/2,(ch-720*scale)/2);
   // Letterbox-free portrait layout: extend the paper sea behind the 16:9 action area.
   const extra=(ch/scale-720)/2;if(extra>0){this.cover([0,0,imSize(this.images.bg,0),imSize(this.images.bg,1)],[-0,-extra,1280,720+extra*2]);}
   c.save();let shake=impact>=0&&impact<.22&&!this.reduced?Math.sin(impact*105)*7*(1-impact/.22):0;c.translate(640+shake,360+shake*.3);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);this.scene(g,t);
   if(fi===0){const c2=this.c;c2.save();c2.strokeStyle='#416178b0';c2.lineWidth=2;c2.beginPath();c2.moveTo(fx-fw*.38,fy-20);c2.quadraticCurveTo(580,360,v==='b'?sx+sw*.46:582,v==='b'?sy-8:510);c2.stroke();c2.restore();}
   this.person(fi,fx,fy,fw,{rotation:fr});
   if(rod){const q=p==='launch'?clamp(Math.max(0,impact)/1.15):1;this.person(4,lerp(742,1108,q),lerp(180,295,q)-Math.sin(q*Math.PI)*180,208,{rotation:q*2.5});}
   if(landPuff>=0)this.person(5,fx,fy+80,230+landPuff*70,{alpha:1-landPuff*.75});
   if(!portrait)this.image('swim',[185,670,552,158],sx,sy,sw,{rotation:angle});
   else if(p==='breath'||p==='charge')this.breathSeal(sx,sy,sw,g);
   else this.image('seal',null,sx,sy,sw,{rotation:angle});
   if(p==='breath'||p==='charge')this.mist(sx+sw*.32,sy-24,220,a,g);
   if(waterBurst>=0&&waterBurst<1){let q=waterBurst,px=p==='leap'?1250:592;this.image('splash',[28,24,1245,846],px,334-q*45,410*(.6+q*.6),{alpha:Math.sin(q*Math.PI)*.87});for(let i=0;i<5;i++)this.effect(1,px+(i-2)*q*96,325-Math.sin(q*Math.PI)*112+i%2*24,80,{alpha:(1-q)*.65,rotation:(i-2)*.35});}
   if(impact>=0&&impact<.65)this.effect(0,724,234,250*(1+impact),{alpha:(1-impact/.65)*.9,rotation:-.15});
   if(p==='charge')this.effect(3,649,184,320+Math.sin(a*6)*10,{alpha:ease(a/2)*.4});
   if(p==='done')this.effect(0,1180,490,260,{alpha:.6});
   c.restore();
   const under=!g.onShore;const danger=under?clamp((35-g.air)/35):0;
   const shade=c.createLinearGradient(0,400,0,720);shade.addColorStop(0,'#10395100');shade.addColorStop(1,under?'#103951a8':'#eaf8f38a');c.fillStyle=shade;c.fillRect(-10,380,1300,360+extra);
   if(danger>0){let glow=c.createRadialGradient(580,390,170,600,410,770);glow.addColorStop(0,'#274b6200');glow.addColorStop(1,`rgba(41,36,78,${danger*(.35+.06*Math.sin(t*5))})`);c.fillStyle=glow;c.fillRect(-10,-extra,1300,720+extra*2);}
   if(v==='c'&&p==='launch'&&impact>0&&impact<.14&&!this.reduced){c.fillStyle=`rgba(255,251,223,${(1-impact/.14)*.32})`;c.fillRect(0,0,1280,720);}
 }
}
function imSize(im,i){return i?im.height:im.width}
