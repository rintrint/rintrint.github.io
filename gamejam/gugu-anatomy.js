const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const CYANOSIS=[128,83,154];
// Coordinates are relative to each cropped sprite, not the untrimmed source.
export const SWIM_HEADS=[
  {neck:[.68,.85],eyes:[[.91,.30,.084,.37]],mouth:[.966,.625,.060,.17]},
  {neck:[.69,.85],eyes:[[.911,.39,.079,.34]],mouth:[.958,.66,.058,.16]},
  {neck:[.73,.87],eyes:[[.913,.505,.077,.26]],mouth:[.965,.752,.058,.13]},
];
export const PORTRAIT_HEAD={neck:[.44,.68],bottom:[.55,.80],eyes:[[.685,.38,.17,.22],[.850,.32,.17,.22]],mouth:[.80,.555,.22,.145],mouthSource:[1607,328,423,183]};
const biteEyes=[[[.667,.48],[.869,.425]],[[.67,.48],[.871,.425]],[[.638,.466],[.85,.407]],[[.668,.415],[.88,.364]],[[.661,.405],[.878,.36]],[[.66,.405],[.876,.36]]];
export function biteHead(frame){return {neck:[.46,.72],bottom:[.60,.78],eyes:biteEyes[frame].map(([x,y])=>[x,y,.17,.225])};}
export function headMask(x,y,head){
  const neck=smooth((x-head.neck[0])/(head.neck[1]-head.neck[0]));
  return neck*(head.bottom?1-smooth((y-head.bottom[0])/(head.bottom[1]-head.bottom[0])):1);
}
// Only the lower abdomen expands downward. Head, spine and tail stay registered.
export const BELLY_HINGE=.57;
export function bellyStretch(x,expansion){
  const u=clamp((x-.18)/.48);
  return 1+Math.sin(u*Math.PI)**2*.32*clamp(expansion);
}
export function bellyY(x,y,expansion){return y<=BELLY_HINGE?y:BELLY_HINGE+(y-BELLY_HINGE)*bellyStretch(x,expansion);}
