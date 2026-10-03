const test=require('node:test'),assert=require('node:assert/strict');
const {BeatRecording}=require('./beat-recorder-core.js');
test('manual timestamps export as seconds only, one point per TXT line',()=>{const r=new BeatRecording(200);[0,1.23456,12.3,65.008].forEach(t=>r.add(t));assert.equal(r.text,'0.000\n1.235\n12.300\n65.008\n');});
test('invalid, duplicate and out-of-order points cannot corrupt TXT',()=>{const r=new BeatRecording(10);for(const t of [-1,NaN,Infinity,'1',10])assert.equal(r.add(t),false);r.add(2);assert.equal(r.add(2.0001),false);assert.equal(r.add(1),false);assert.equal(r.text,'2.000\n');});
test('undo and restoration preserve manual timing without quantization',()=>{const r=new BeatRecording(100,[1.013,2.297,3.499]);r.undo();assert.equal(r.text,'1.013\n2.297\n');const restored=new BeatRecording(100,JSON.parse(JSON.stringify(r.points)));assert.equal(restored.text,r.text);});
