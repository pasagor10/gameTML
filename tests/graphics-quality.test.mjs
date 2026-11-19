import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, autoLevel, createAutoTuner, lower } from "../public/graphics-quality.js";
import { textureStats } from "../public/perf-overlay.js";

test("4 GB devices start Low; mid devices Medium; the rest High", () => {
  assert.equal(autoLevel({ deviceMemory: 4, cores: 8 }), "low");
  assert.equal(autoLevel({ deviceMemory: 2 }), "low");
  assert.equal(autoLevel({ deviceMemory: 6, cores: 8 }), "medium");
  assert.equal(autoLevel({ deviceMemory: 8, cores: 4 }), "medium");
  assert.equal(autoLevel({ deviceMemory: 8, cores: 8, coarse: true }), "medium");
  assert.equal(autoLevel({ deviceMemory: 8, cores: 8 }), "high");
  // Browsers without deviceMemory (Safari, Firefox) judge by the rest.
  assert.equal(autoLevel({ cores: 10 }), "high");
});

test("Low caps frames and resolution and drops the expensive passes", () => {
  const low = PRESETS.low;
  assert.equal(low.fps, 30);
  assert.ok(low.renderScale < 1);
  assert.equal(low.ambient, false);
  assert.equal(low.glow, false);
  assert.equal(low.rim, false);
  assert.equal(PRESETS.high.glow, true);
  assert.equal(lower("high"), "medium");
  assert.equal(lower("low"), "low");
});

test("auto steps down one level after 5 slow seconds, judged against the cap", () => {
  const t = createAutoTuner("high");
  for (let i = 0; i < 4; i++) assert.equal(t.tick(18, 0), null);
  assert.equal(t.tick(18, 0), "medium");
  // A fast second resets the count.
  for (let i = 0; i < 4; i++) t.tick(18, 0);
  t.tick(60, 0);
  for (let i = 0; i < 4; i++) assert.equal(t.tick(18, 0), null);
  assert.equal(t.tick(18, 0), "low");
  // Low is the floor; a 30 FPS cap running at 28 is not "slow".
  for (let i = 0; i < 10; i++) assert.equal(t.tick(28, 30), null);
  assert.equal(t.level, "low");
});

test("texture memory counts each source image once", () => {
  const img = {};
  const game = {
    textures: {
      list: {
        __DEFAULT: { source: [{ width: 32, height: 32 }] },
        a: { source: [{ image: img, width: 1024, height: 512 }] },
        b: { source: [{ image: img, width: 1024, height: 512 }] },
        c: { source: [{ image: {}, width: 256, height: 256 }] },
      },
    },
  };
  const s = textureStats(game);
  assert.equal(s.count, 3);
  assert.equal(s.mb, (1024 * 512 * 4 + 256 * 256 * 4) / 1048576);
});
