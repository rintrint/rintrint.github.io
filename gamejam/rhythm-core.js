/* Audio-clock driven rules shared by the two music editions. No renderer/audio dependencies. */
(function(root){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const DIFFICULTIES=Object.freeze({
    beginner:Object.freeze({label:'新手',stars:1,window:.24,perfect:.10,good:.17,approach:2.4,speed:.8,missCost:4,recovery:5,scoreScale:.8,description:'稀疏單拍 · 充裕提示 · 寬鬆判定'}),
    intermediate:Object.freeze({label:'中階',stars:3,window:.19,perfect:.075,good:.135,approach:1.75,speed:1,missCost:6,recovery:3,scoreScale:1,description:'連續單拍 · 加入反拍 · 標準判定'}),
    expert:Object.freeze({label:'高手',stars:5,window:.13,perfect:.045,good:.085,approach:1.15,speed:1.4,missCost:8,recovery:2,scoreScale:1.3,description:'密集連打 · 短促快拍 · 精準判定'})
  });
  class RhythmRun {
    constructor(track,mode='rings',practice=false,difficulty='intermediate'){this.track=track;this.mode=mode;this.practice=practice;this.difficulty=DIFFICULTIES[difficulty]?difficulty:'intermediate';this.profile=DIFFICULTIES[this.difficulty];this.reset();}
    reset(){
      this.notes=(this.track.charts?.[this.difficulty]||this.track.notes).map((n,i)=>({...n,id:i,result:null}));this.status='ready';this.time=-3;this.cursor=0;
      this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;this.misses=0;this.weight=0;this.air=100;this.food=0;
      this.events=[];this.lastPress=-100;this.lastJump=null;this.feedback=null;this.outcome=null;this.counts={perfect:0,good:0,soft:0,miss:0};
    }
    get window(){return this.profile.window+(this.practice?.05:0);}
    get accuracy(){const n=this.hits+this.misses;return n?Math.round(this.weight/n*100):100;}
    get progress(){return clamp(this.time/this.track.duration,0,1);}
    get growth(){return 1+clamp(this.food/Math.max(12,this.notes.length*.45),0,1)*.45;}
    get form(){return Math.min(2,Math.floor((this.growth-1)/.225+1e-6));}
    get danger(){return this.status==='playing'?clamp((35-this.air)/35,0,1):0;}
    get target(){return this.notes.find(n=>!n.result&&n.time>=this.time-this.window);}
    start(){this.status='playing';}
    pause(){if(this.status==='playing')this.status='paused';}
    resume(){if(this.status==='paused')this.status='playing';}
    judge(note,result,at,error=0){
      if(note.result)return;note.result=result;this.counts[result]++;
      if(result==='miss'){
        this.misses++;this.combo=0;this.air=Math.max(this.practice?1:0,this.air-this.profile.missCost);
      }else{
        this.hits++;this.food++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);
        const weight={perfect:1,good:.75,soft:.45}[result];this.weight+=weight;
        this.score+=Math.round(1000*weight*(1+Math.min(this.combo,50)/50)*this.profile.scoreScale);this.air=Math.min(100,this.air+(result==='perfect'?this.profile.recovery:Math.max(1,this.profile.recovery-1)));
      }
      const e={type:result==='miss'?'miss':'hit',result,note,at,error,combo:this.combo};this.events.push(e);this.feedback=e;
      if(this.air<=0){this.status='lost';this.outcome=this.growth>=1.4?'angel':'hungryGhost';this.events.push({type:'lost',at});}
    }
    update(time){
      if(this.status!=='playing')return;this.time=time;
      while(this.cursor<this.notes.length&&this.notes[this.cursor].time<time-this.window){
        const n=this.notes[this.cursor++];if(!n.result)this.judge(n,'miss',n.time+this.window);
        if(this.status!=='playing')return;
      }
      if(time>=this.track.duration){this.status='won';this.outcome='friends';this.events.push({type:'won',at:time});}
    }
    press(time){
      if(this.status!=='playing'||time<0||time-this.lastPress<.11)return null;
      this.update(time);if(this.status!=='playing')return null;this.lastPress=time;
      let candidate=null,dist=Infinity;
      for(let i=this.cursor;i<this.notes.length;i++){
        const n=this.notes[i];if(n.time>time+this.window)break;
        if(!n.result&&Math.abs(time-n.time)<dist){candidate=n;dist=Math.abs(time-n.time);}
      }
      const next=candidate?this.notes[candidate.id+1]:null;
      this.lastJump={at:time,duration:Math.min(.85,Math.max(.12,(next?next.time-time:1)*.86)),good:!!candidate,accent:!!candidate?.accent};
      if(!candidate){
        this.air=Math.max(this.practice?1:0,this.air-1);this.feedback={result:'early',at:time};this.events.push({type:'early',at:time});
        if(this.air<=0){this.status='lost';this.outcome=this.growth>=1.4?'angel':'hungryGhost';this.events.push({type:'lost',at:time});}return null;
      }
      const result=dist<=this.profile.perfect?'perfect':dist<=this.profile.good?'good':'soft';this.judge(candidate,result,time,time-candidate.time);return result;
    }
  }
  const api={RhythmRun,DIFFICULTIES,clamp};root.BreathRhythm=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
