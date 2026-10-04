const cues=['surface','fisher','dive','inhale','breathGood','breathBad','button','ice','happy'];
const lead={surface:.12,fisher:.09,dive:.118,inhale:.082,breathGood:.04,breathBad:.062,button:.013,ice:.079,happy:.013};
export class ShoreAudio{
 constructor(){this.enabled=true;this.buffers={};this.voices=new Set();this.raw=Promise.all(cues.map(async k=>{const r=await fetch(`../assets/scenes/audio/${k}.mp3`);if(!r.ok)throw Error(`音效 ${k} 載入失敗`);return [k,await r.arrayBuffer()]}));this.raw.catch(()=>{});}
 async unlock(){
   if(!this.ctx){this.ctx=new AudioContext({latencyHint:'interactive'});this.bus=this.ctx.createGain();this.bus.gain.value=this.enabled?.65:0;const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.ratio.value=5;this.bus.connect(limiter);limiter.connect(this.ctx.destination);}
   await this.ctx.resume();
   if(!this.loading)this.loading=this.raw.then(items=>Promise.all(items.map(async([key,bytes])=>{this.buffers[key]=await this.ctx.decodeAudioData(bytes.slice(0))})));
   await this.loading;
 }
 get now(){return this.ctx?.currentTime??performance.now()/1000}
 mute(){this.enabled=!this.enabled;if(this.bus)this.bus.gain.setTargetAtTime(this.enabled?.65:0,this.ctx.currentTime,.02);return this.enabled}
 suspend(){return this.ctx?.suspend()}
 resume(){return this.ctx?.resume()}
 stop(){for(const voice of this.voices){try{voice.stop()}catch{}}this.voices.clear();this.phase='';}
 track(node){this.voices.add(node);node.onended=()=>{this.voices.delete(node);node.disconnect()};return node}
 sample(key,volume=.3,delay=0,duration){if(!this.ctx||!this.buffers[key])return;const at=this.now+delay,b=this.buffers[key],s=this.track(this.ctx.createBufferSource()),g=this.ctx.createGain();s.buffer=b;s.connect(g);g.connect(this.bus);const len=Math.min(duration??b.duration,b.duration-lead[key]);g.gain.setValueAtTime(volume,at);g.gain.setValueAtTime(volume,at+Math.max(0,len-.035));g.gain.linearRampToValueAtTime(0,at+len);s.start(at,lead[key]);s.stop(at+len);}
 tone(freq,at,volume=.07,length=.19,type='sine'){if(!this.ctx)return;const o=this.track(this.ctx.createOscillator()),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+length);o.connect(g);g.connect(this.bus);o.start(at);o.stop(at+length+.01)}
 phaseCues(g){
   this.phase=g.phase;const at=this.now;
   if(g.phase==='approach'){
     for(let i=0;i<8;i++)this.tone([261.63,329.63,392,493.88,440,392,329.63,293.66][i],at+i*.5,.027,.6,'triangle');
     for(let i=0;i<4;i++)this.tone(i===3?880:550,at+2+i*.5,i===3?.105:.075,.10,'triangle');
   }else if(g.phase==='breath'){
     for(let i=0;i<8;i++)this.tone([329.63,392,493.88,392][i%4],at+i*.5,.024,.55,'triangle');
   }else if(g.phase==='charge'){
     for(let i=0;i<4;i++)this.tone(i===3?1046.5:659.25,at+g.config.charge-1.85+i*.5,i===3?.13:.075,.16,'triangle');
   }
 }
 event(e,g){switch(e.type){case'phase':this.phaseCues(g);break;case'start':this.sample('button',.12);break;case'tug':this.sample('button',.15);break;case'surface':this.sample('surface',.37,.04,1.5);break;case'impact':this.sample('fisher',.6,e.delay,.7);this.sample('ice',.19,e.delay,.22);break;case'inhale':this.sample('breathGood',.33,0,.7);break;case'refill':this.sample('button',.12,0,.075);break;case'bigBreath':this.sample('inhale',.95,0,1.8);break;case'jump':this.sample('breathGood',.5,0,.8);this.sample('dive',.42,g.config.leap-.32,1.6);break;case'dive':this.sample('happy',.25,.1,.8);break;case'miss':this.sample('ice',.17,0,.14);break;case'fail':this.stop();this.sample('breathBad',.35);break;}}
}
