import test from 'node:test';
import assert from 'node:assert/strict';
import { createShakeSettings, setScreenShakeEnabled, shakeCamera } from '../public/screen-shake.js';
test('screen shake defaults off and persists explicit on/off choices',()=>{
  const data=new Map(); const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const first=createShakeSettings(storage);
  assert.equal(first.get(),false);
  first.set(true);assert.equal(createShakeSettings(storage).get(),true);
  first.set(false);assert.equal(createShakeSettings(storage).get(),false);
});
test('blocked storage retains session preference without crashing',()=>{
  const settings=createShakeSettings({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(settings.get(),false);settings.set(true);assert.equal(settings.get(),true);
});
test('camera shake is suppressed until enabled and stops triggering after disabling',()=>{
  const calls=[];const camera={shake:(...args)=>calls.push(args)};
  setScreenShakeEnabled(false);shakeCamera(camera,100,.01);assert.equal(calls.length,0);
  setScreenShakeEnabled(true);shakeCamera(camera,100,.01);assert.deepEqual(calls,[[100,.01]]);
  setScreenShakeEnabled(false);shakeCamera(camera,100,.01);assert.equal(calls.length,1);
});
