const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function oxygenReaction(air,time,underwater=true,reduced=false){
  const severity=underwater?clamp((60-air)/60):0,critical=underwater?clamp((25-air)/25):0;
  const pulse=reduced?0:Math.sin(time*(5+severity*7));
  return {severity,tint:severity*.78,expression:clamp((55-air)/40)*(underwater?1:0),shiver:reduced?0:Math.sin(time*27)*critical*.009,
    heave:pulse*severity*.055,tailStrength:1-severity*.65,stoop:severity*.09,
    pulse:reduced?1:.68+.32*Math.sin(time*(4+severity*4))**2};
}
export function gateCue(g){
  const active=g.status==='playing'||g.status==='paused'&&g.beforePause==='playing';
  if(!active)return {mode:'none',strength:0};
  if(g.phase==='surface')return {mode:'refill',remaining:g.breathRemaining,strength:g.air<80?1:.4,critical:g.breathRemaining<1.5&&g.air<80};
  if(g.phase!=='underwater')return {mode:'none',strength:0};
  if(g.time-g.missedGateAt<1.5)return {mode:'missed',strength:1};
  const note=g.notes.slice(g.cursor).find(n=>!n.result&&['surface','exit'].includes(n.kind));
  const remaining=note?g.noteTime(note)-g.time:Infinity;
  return remaining>=-g.window&&remaining<=3.5?{mode:'approach',note,remaining,strength:.45+.55*clamp(1-remaining/3.5)}:{mode:'none',strength:0};
}
