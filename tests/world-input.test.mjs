import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorldPointer } from '../public/world-input.js';

test('hotspots ignore joystick, buttons, overlays and captured touches', () => {
  const canvas = {}, control = {};
  const doc = { elementFromPoint: () => canvas };
  assert.equal(isWorldPointer({ event: { target: control, clientX: 20, clientY: 30 } }, canvas, doc), false);
  assert.equal(isWorldPointer({ event: { target: canvas, clientX: 20, clientY: 30 } }, canvas, { elementFromPoint: () => control }), false);
  assert.equal(isWorldPointer({ event: { target: canvas } }, canvas, doc), false);
  assert.equal(isWorldPointer({}, canvas, doc), false);
});
test('direct canvas presses work for mouse and mobile touch coordinates', () => {
  const canvas = {};
  const doc = { elementFromPoint: (x,y) => x === 20 && y === 30 ? canvas : null };
  assert.equal(isWorldPointer({ event: { target: canvas, clientX: 20, clientY: 30 } }, canvas, doc), true);
  assert.equal(isWorldPointer({ event: { target: canvas, changedTouches: [{ clientX: 20, clientY: 30 }] } }, canvas, doc), true);
});
