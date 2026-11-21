import { test } from "node:test";
import assert from "node:assert/strict";
import { costumeSet } from "../shared/costumes.js";
import { readFileSync } from "node:fs";
import { townWanderers, wandererPose } from "../shared/town-wanderers.js";

test("each town has five distinct cosmetic NPCs", () => {
  const cave = townWanderers("cave");
  const river = townWanderers("riverside");
  const index = JSON.parse(readFileSync(new URL("../public/assets/sprites/index.json", import.meta.url)));
  const outfits = [...cave, ...river].map((n) => costumeSet(n));
  assert.equal(new Set(outfits).size, 10);
  assert.ok(outfits.every((set) => set && index.sets[set]), "every outfit has usable artwork");
  assert.equal(cave.length, 5);
  assert.equal(river.length, 5);
  assert.equal(new Set([...cave, ...river].map((n) => n.id)).size, 10);
  assert.ok([...cave, ...river].every((n) => n.ambient && !n.name.includes("NPC")));
});

test("strolls stay on the ground inside the map and include rests and both directions", () => {
  for (const npc of [...townWanderers("cave"), ...townWanderers("riverside")]) {
    const directions = new Set();
    let rested = false;
    for (let time = 0; time < 120; time += 0.1) {
      const pose = wandererPose(npc, time);
      assert.ok(pose.x >= 100 && pose.x <= 2140);
      assert.equal(pose.y, 600);
      directions.add(pose.direction);
      rested ||= !pose.moving;
    }
    assert.equal(directions.size, 2);
    assert.ok(rested);
  }
});
