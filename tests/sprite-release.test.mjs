import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpriteRegistry } from "../public/sprite-sets.js";

// A scene with just enough of Phaser's loader, caches and texture manager
// for the registry: loads complete when start() is called.
function mockScene(index) {
  const textures = new Map(),
    json = new Map(),
    handlers = { filecomplete: [], complete: [] },
    queue = [],
    loads = [];
  const scene = {
    spriteSetIndex: index,
    time: { now: 0 },
    textures: {
      exists: (k) => textures.has(k),
      get: (k) => textures.get(k),
      remove: (k) => textures.delete(k),
    },
    cache: {
      json: {
        get: (k) => json.get(k),
        exists: (k) => json.has(k),
        remove: (k) => json.delete(k),
      },
    },
    load: {
      on: (ev, fn) => handlers[ev]?.push(fn),
      json: (key, url) => queue.push({ type: "json", key, url }),
      image: (key, url) => queue.push({ type: "image", key, url }),
      isLoading: () => false,
      start() {
        while (queue.length) {
          const f = queue.shift();
          loads.push(f.key);
          if (f.type === "json") {
            json.set(f.key, {
              durationSeconds: 1,
              fallback: { cellSize: [64, 64], pages: [{ file: "p0.png", firstFrame: 0, frameCount: 2, columns: 2 }] },
            });
            // The page is queued from animation.json, as queueSpriteSets does.
            queue.push({ type: "image", key: `${f.key}:p0.png` });
          } else {
            const frames = new Set();
            textures.set(f.key, { has: (n) => frames.has(n), add: (n) => frames.add(n), setFilter() {} });
          }
          handlers.filecomplete.forEach((fn) => fn(f.key, f.type));
        }
        handlers.complete.forEach((fn) => fn());
      },
    },
  };
  return { scene, textures, json, loads };
}

const INDEX = {
  monsters: {
    bat: { dir: "monsters/bat", actions: { idle: "idle", move: "move" } },
    wolf: { dir: "monsters/wolf", actions: { idle: "idle" } },
  },
  npcs: { elder: { dir: "npcs/elder", actions: { idle: "idle" } } },
};

test("sets nobody shows for a minute are released, and come back on demand", () => {
  const { scene, textures, json, loads } = mockScene(INDEX);
  const reg = createSpriteRegistry(scene);
  reg.want("monsters", "bat");
  reg.want("monsters", "wolf");
  reg.want("npcs", "elder");
  assert.ok(reg.monsters.has("bat") && reg.monsters.has("wolf"));
  const batPage = "sprite:monsters/bat:idle:p0.png";
  assert.ok(textures.has(batPage));

  // A bat is on screen; the wolf left. Under a minute nothing goes.
  scene.time.now = 30000;
  assert.deepEqual(reg.sweep(new Set([batPage]), 60000), []);
  scene.time.now = 61000;
  assert.deepEqual(reg.sweep(new Set([batPage]), 60000), ["monsters|wolf"]);
  assert.ok(!reg.monsters.has("wolf"));
  assert.ok(!textures.has("sprite:monsters/wolf:idle:p0.png"), "texture freed");
  assert.ok(!json.has("sprite:monsters/wolf:idle"), "manifest freed");
  assert.ok(reg.monsters.has("bat"), "the set on screen stays");
  assert.ok(reg.npcs.has("elder"), "townsfolk are never released");

  // Over budget (idle 0): anything unused goes, but never a set under 5 s old.
  scene.time.now = 64000;
  reg.want("monsters", "wolf");
  assert.ok(reg.monsters.has("wolf"), "loads again on demand");
  assert.equal(loads.filter((k) => k === "sprite:monsters/wolf:idle").length, 2);
  scene.time.now = 67000;
  assert.deepEqual(reg.sweep(new Set(), 0), ["monsters|bat"], "the 3 s old wolf stays");
  scene.time.now = 70000;
  assert.deepEqual(reg.sweep(new Set(), 0), ["monsters|wolf"]);
});
