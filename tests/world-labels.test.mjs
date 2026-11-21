import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldLabels } from '../public/world-labels.js';

test('world labels use browser text independently of canvas scale and clean up on destroy', () => {
  const elements = [];
  const previous = globalThis.document;
  globalThis.document = { createElement() {
    const el = { style: {}, append(child) { this.child = child; }, remove() { this.removed = true; } };
    elements.push(el); return el;
  } };
  try {
    const events = {};
    const scene = { cameras: { main: { worldView: { x: 100, y: 50 }, zoom: .5 } }, renderScale: () => .5,
      events: { on: (name, fn) => events[name] = fn, once: (name, fn) => events[name] = fn, off() {} } };
    const register = createWorldLabels(scene, { append() {} });
    let destroy;
    const label = { x: 200, y: 150, text: 'มะลิ', style: { fontSize: '15px', color: '#fff' }, originX: .5, originY: 0,
      visible: true, active: true, setAlpha(a) { this.alpha = a; }, once(name, fn) { destroy = fn; } };
    register(label); events.postupdate();
    const el = elements[1];
    assert.equal(label.alpha, 0);
    assert.equal(el.textContent, 'มะลิ');
    assert.equal(el.style.fontSize, '15px');
    assert.equal(el.style.background, 'none');
    assert.equal(el.style.transform, 'translate(100px, 100px) translate(-50%, 0%)');
    label.visible = false; events.postupdate(); assert.equal(el.hidden, true);
    destroy(); assert.equal(el.removed, true);
    events.shutdown(); assert.equal(elements[0].removed, true);
  } finally { globalThis.document = previous; }
});
