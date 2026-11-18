import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { heroLooks, lookTier } from "../shared/appearance.js";
import { GEAR, FLOOR_LOOT, bossLootCandidates } from "../shared/rpg.js";
import { CLASSES } from "../shared/config.js";

const index = JSON.parse(readFileSync("public/assets/sprites/index.json", "utf8"));
// The painted priest's looks (heroes are pixel art now; the layered painted
// rig stays supported).
const painted = JSON.parse(readFileSync("tests/fixtures/painted-priest.json", "utf8"));

test("gear sets the look tier: starter, then floor depth", () => {
  assert.equal(lookTier(GEAR.starter_priest), 1);
  assert.equal(lookTier(GEAR.nightfang_mace), 2);
  assert.equal(lookTier(GEAR.floor_5_priest_weapon), 3);
  assert.equal(lookTier(GEAR.floor_10_armor), 4);
  assert.deepEqual(heroLooks({ equipment: { weapon: "starter_priest", armor: null } }), {
    outfit: "robe-1", head: "hair", weapon: "staff-1",
  });
  assert.deepEqual(heroLooks({ equipment: { weapon: "floor_9_priest_weapon", armor: "floor_6_armor" } }), {
    outfit: "robe-3", head: "hood", weapon: "staff-4",
  });
});

test("a costume overrides the look but only with a look that exists", () => {
  const looks = painted.layers.looks;
  const p = { equipment: {}, costume: { head: "mitre", weapon: "laser-sword" } };
  assert.deepEqual(heroLooks(p, looks), { outfit: "robe-1", head: "mitre", weapon: "staff-1" });
});

test("priests get their own weapon from every boss floor", () => {
  for (const floor of Object.keys(FLOOR_LOOT)) {
    const id = FLOOR_LOOT[floor].weapons.priest;
    assert.equal(GEAR[id]?.class, "priest", `floor ${floor}`);
    assert.ok(bossLootCandidates(+floor, "priest").includes(id));
  }
});

test("every item picture has gear colours", () => {
  const palette = JSON.parse(readFileSync("public/assets/items/palette.json", "utf8"));
  for (const i of [0, 5, 11]) {
    const p = palette[`armor-${i}`];
    for (const key of ["main", "trim", "gem"]) assert.match(p[key], /^#[0-9a-f]{6}$/);
  }
});
