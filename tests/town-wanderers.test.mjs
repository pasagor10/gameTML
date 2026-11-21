import { test } from "node:test";
import assert from "node:assert/strict";
import { townWanderers, wandererPose } from "../shared/town-wanderers.js";

test("each town has five distinct cosmetic NPCs", () => {
  const cave = townWanderers("cave");
  const river = townWanderers("riverside");
  assert.equal(cave.length, 5);
  assert.equal(river.length, 5);
  assert.equal(new Set([...cave, ...river].map((n) => n.id)).size, 10);
  assert.ok([...cave, ...river].every((n) => n.ambient && n.name.endsWith("NPC")));
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
