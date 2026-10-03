import {JourneyAudio} from './tide-audio.js';
import {soundCues} from './scenes-media.js';

export class ScenesAudio extends JourneyAudio {
  constructor(){
    super();this.samples=new Map();this.voices=new Set();this.cooldowns=new Map();this.menuToken=0;
    this.sampleBus=this.ctx.createGain();this.sampleBus.gain.value=.8;
    this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-9;this.limiter.knee.value=12;this.limiter.ratio.value=5;this.limiter.attack.value=.003;this.limiter.release.value=.15;
    this.sampleBus.connect(this.limiter);this.limiter.connect(this.master);
  }
  async loadSamples(){
    if(!this.loadingSamples)this.loadingSamples=(async()=>{
      const response=await fetch('assets/scenes/audio-manifest.json');if(!response.ok)throw Error('音效清單讀取失敗');this.manifest=await response.json();
      await Promise.all(Object.entries(this.manifest).filter(([key])=>key!=='menu').map(([key,data])=>this.decodeSample(key,data)));
    })().catch(e=>{this.loadingSamples=null;throw e;});
    return this.loadingSamples;
  }
  async decodeSample(key,data){
    if(this.samples.has(key))return this.samples.get(key);
    const response=await fetch('assets/scenes/'+data.file);if(!response.ok)throw Error(`音效載入失敗：${data.source}`);
    const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.samples.set(key,buffer);return buffer;
  }
  sample(key,{volume=.45,delay=0,duration,loop=false}={}){
    const buffer=this.samples.get(key);if(!buffer||!this.enabled)return null;
    const now=this.ctx.currentTime,at=now+delay,limit=key==='eat'?.085:key==='button'?.06:0;
    if(at-(this.cooldowns.get(key)??-100)<limit)return null;this.cooldowns.set(key,at);
    // Remove measured leading silence; normalize conservatively without modifying source files.
    const data=this.manifest[key],offset=loop?0:Math.min(data.lead,buffer.duration-.01),length=Math.min(duration??buffer.duration-offset,buffer.duration-offset);
    const gain=this.ctx.createGain(),node=this.ctx.createBufferSource(),level=volume*Math.min(2.5,.85/Math.max(.1,data.peak));
    node.buffer=buffer;node.loop=loop;gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(level,at+.008);
    if(!loop){gain.gain.setValueAtTime(level,at+Math.max(.009,length-.04));gain.gain.linearRampToValueAtTime(.0001,at+length);}
    node.connect(gain);gain.connect(this.sampleBus);
    this.lastCue=key;const voice={node,gain,key};this.voices.add(voice);node.onended=()=>{node.disconnect();gain.disconnect();this.voices.delete(voice);};
    node.start(at,offset);if(!loop)node.stop(at+length);return voice;
  }
  stopEffects(){for(const v of [...this.voices])if(v!==this.menuVoice){try{v.node.stop();}catch{}v.node.disconnect();v.gain.disconnect();this.voices.delete(v);}this.cooldowns.clear();}
  stopMenu(){this.menuToken++;if(this.menuVoice){const v=this.menuVoice;try{v.node.stop();}catch{}v.node.disconnect();v.gain.disconnect();this.voices.delete(v);this.menuVoice=null;}}
  async menu(){
    if(this.menuVoice||!this.enabled)return;const token=++this.menuToken;await this.ctx.resume();await this.loadSamples();
    this.menuLoad??=this.decodeSample('menu',this.manifest.menu).catch(e=>{this.menuLoad=null;throw e;});await this.menuLoad;
    if(token!==this.menuToken||this.running||!this.enabled)return;
    this.menuVoice=this.sample('menu',{volume:.22,loop:true});
  }
  play(from=0){this.stopMenu();super.play(from);}
  event(event,game){
    if(['won','lost'].includes(event.type))this.stopEffects();
    for(const {key,...options} of soundCues(event,game))this.sample(key,options);
  }
  silence(){this.stopMenu();this.stopEffects();this.pause();}
}
