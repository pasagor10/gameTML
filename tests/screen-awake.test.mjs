import test from 'node:test';
import assert from 'node:assert/strict';
import { createScreenAwake } from '../public/screen-awake.js';
const sentinel = () => ({ released: false, addEventListener() {}, async release() { this.released = true; } });
test('wake lock releases when hidden and reacquires when visible', async () => {
  let visible = true;
  const locks = [];
  const awake = createScreenAwake({ visible: () => visible, request: async type => {
    assert.equal(type, 'screen'); const lock = sentinel(); locks.push(lock); return lock;
  }});
  await awake.sync(); await awake.sync();
  assert.equal(locks.length, 1);
  visible = false; await awake.sync(); assert.equal(locks[0].released, true);
  visible = true; await awake.sync(); assert.equal(locks.length, 2);
  await awake.setActive(false); assert.equal(locks[1].released, true);
});
test('pending acquisition is released if page hides before it resolves', async () => {
  let resolve, visible = true;
  const lock = sentinel();
  const awake = createScreenAwake({ visible: () => visible, request: () => new Promise(r => { resolve = r; }) });
  const pending = awake.sync();
  visible = false; await awake.sync(); resolve(lock); await pending;
  assert.equal(lock.released, true);
});
test('denied wake lock can be retried on another interaction', async () => {
  let attempts = 0;
  const states = [];
  const awake = createScreenAwake({ visible: () => true, onState: s => states.push(s), request: async () => {
    if (++attempts === 1) throw Error('Power saving'); return sentinel();
  }});
  await awake.sync(); await awake.sync();
  assert.deepEqual(states, ['unavailable', 'active']);
});
