import test from 'node:test';
import assert from 'node:assert/strict';
import { measureHudLayout } from '../public/hud-layout.js';
test('quest follows profile height and stays above movement controls', () => {
  const screen = { top: 0, left: 0, height: 390 };
  for (const bottom of [72, 94, 120]) {
    const layout = measureHudLayout(screen, { bottom, right: 198 }, { top: 270 });
    assert.equal(layout.questTop, bottom + 10);
    assert.ok(layout.questTop + layout.questHeight <= 222);
    assert.equal(layout.chatLeft, 208);
  }
});
