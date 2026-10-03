// Edition eight only. The original chart clock and rules remain in tide-core.js.
export function hungerPose(time,reduced=false){
  const t=Math.max(0,time),cycle=Math.floor(t/7),age=t%7;
  return {cycle,frame:reduced||age>=2.4?0:Math.floor(age/.08)%3,breath:reduced?0:Math.sin(t*1.8)*.008};
}
export function soundCues(event,game){
  const cue=(key,volume=.45,delay=0,duration)=>({key,volume,delay,duration});
  switch(event.type){
    case 'breath':return event.big?[cue(game.initialAir>=90?'breathGood':'breathBad',.5)]:[];
    case 'bigBreath':return [cue('inhale',.85,0,1.7),cue('dive',.55,.7)];
    case 'splash':return [cue('dive',.5)];
    case 'call':return [cue('happy',.4)];
    case 'hit':
      if(event.note.kind==='fish')return [cue('eat',.25,0,.3)];
      if(['surface','exit'].includes(event.note.kind))return [cue('surface',.42),cue('fisher',.4,.05),...(event.note.kind==='surface'?[cue(event.result==='perfect'?'breathGood':'breathBad',.35,.3)]:[])];
      return [];
    case 'miss':return event.note.kind==='fish'||game.status==='lost'?[]:[cue('ice',.4)];
    case 'lost':return [...(['entry','leap'].includes(game.reason)?[cue('ice',.4)]:[]),cue(game.outcome==='angel'?'angel':'ghost',.5,.12)];
    case 'won':return game.outcome==='friends'?[cue('happy',.4),cue('belly',.45,1.4)]:[cue('sad',.3),cue('hungry',.5,1.8)];
    default:return [];
  }
}
