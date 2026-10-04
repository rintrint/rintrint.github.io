import test from 'node:test';
import assert from 'node:assert/strict';
import {ShoreView} from './view.js';

test('a cold load with the fisherman arriving before effects never starts a partial frame', async t=>{
  const originalImage=globalThis.Image,originalMedia=globalThis.matchMedia,pending=[];
  t.after(()=>{globalThis.Image=originalImage;globalThis.matchMedia=originalMedia});
  globalThis.matchMedia=()=>({matches:false});
  globalThis.Image=class{constructor(){this.width=1536;this.height=1024}set src(value){this.path=value;pending.push(this)}};
  const view=new ShoreView({getContext:()=>({})});
  let ready=false;view.ready.then(()=>{ready=true});
  const fisher=pending.find(i=>i.path.includes('fisher-poses'));
  const effects=pending.find(i=>i.path.includes('effects-atlas'));
  fisher.onload();
  assert.doesNotThrow(()=>view.draw({}));
  for(const im of pending)if(im!==fisher&&im!==effects)im.onload();
  await Promise.resolve();
  assert.equal(ready,false);
  assert.doesNotThrow(()=>view.draw({}));
  effects.onload();await view.ready;
  assert.equal(Object.keys(view.images).length,pending.length);
});
