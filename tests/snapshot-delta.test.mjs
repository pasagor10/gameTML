import { test } from "node:test";
import assert from "node:assert/strict";
import { createSnapshotMemo, packSnapshot, mergeSnapshot } from "../shared/snapshot-delta.js";

// What a client sees after JSON transport: undefined fields vanish.
const wire = (v) => JSON.parse(JSON.stringify(v));
// Cold fields that became undefined arrive as null; treat them alike.
const norm = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x === null ? undefined : x)));

const hero = (id, x, extra = {}) => ({
  id, name: "H" + id, class: "mage", gender: "female", x, y: 600, vx: 0,
  hp: 100, maxHp: 100, level: 5, equipment: { weapon: "staff-1" }, buffs: null, ...extra,
});
const frames = [
  { time: 1, area: "town", online: 2, dungeon: null, shops: [{ id: 1 }], party: null,
    self: { ...hero("a", 10), gold: 5, inventory: { hp: 3 }, hitAt: 0.5 },
    players: [hero("b", 40)] },
  { time: 2, area: "town", online: 2, dungeon: null, shops: [{ id: 1 }], party: null,
    self: { ...hero("a", 12), gold: 5, inventory: { hp: 3 } },
    players: [hero("b", 44, { level: 6 })] },
  { time: 3, area: "town", online: 3, dungeon: null, shops: [], party: { id: "p" },
    self: { ...hero("a", 12), gold: 9, inventory: { hp: 2 }, skin: undefined, diedAt: 3 },
    players: [hero("b", 44, { level: 6 }), hero("c", 90)] },
  { time: 4, area: "dungeon", online: 3, dungeon: { floor: 2, enemies: [{ id: 1, hp: 9, maxHp: 9, type: "bat", boss: false, x: 5 }] }, shops: [], party: null,
    self: { ...hero("a", 1), gold: 9, inventory: { hp: 2 } },
    players: [hero("c", 91)] },
  { time: 5, area: "dungeon", online: 3, dungeon: { floor: 2, enemies: [{ id: 1, hp: 4, maxHp: 9, type: "bat", boss: false, x: 7, hitAt: 5 }, { id: 2, hp: 30, maxHp: 30, type: "golem", boss: true, x: 90 }] }, shops: [], party: null,
    self: { ...hero("a", 2), gold: 9, inventory: { hp: 2 } },
    players: [hero("c", 92)] },
];

test("snapshot deltas rebuild every full snapshot", () => {
  const memo = createSnapshotMemo(), cache = {};
  let merged = null;
  for (let round = 0; round < 60; round++)
    for (const frame of frames) {
      const packet = wire(packSnapshot(memo, frame));
      merged = mergeSnapshot(merged, packet, cache);
      assert.deepEqual(norm(merged), norm(wire(frame)));
      // Hot fields never linger from an earlier packet.
      assert.equal(merged.self.diedAt, frame.self.diedAt);
      assert.equal(merged.self.hitAt, frame.self.hitAt);
    }
});

test("unchanged fields are left out after the first packet", () => {
  const memo = createSnapshotMemo();
  packSnapshot(memo, frames[0]);
  const second = packSnapshot(memo, frames[0]);
  assert.equal(second.self.inventory, undefined);
  assert.equal(second.shops, undefined);
  assert.equal(second.players[0].cold, undefined);
  assert.equal(second.players[0].x, 40);
});
