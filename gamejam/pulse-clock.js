// Map the original key event timestamp onto the audible output clock.
// https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp
export function songTimeAt(ctx,anchor,startPosition,eventTime,now){
  const stamp=ctx.getOutputTimestamp?.();
  const sample=stamp?.performanceTime>0&&stamp.contextTime>=0
    ?stamp.contextTime+(eventTime-stamp.performanceTime)/1000
    :ctx.currentTime-(ctx.outputLatency||0)-(ctx.baseLatency||0)+(eventTime-now)/1000;
  return Math.max(startPosition,Math.min(ctx.currentTime,sample)-anchor);
}
