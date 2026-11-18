import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dungeonPlatforms,
  dungeonSpawn,
  dungeonEnemyCount,
  DUNGEON_ROSTERS,
  enemyStep,
} from "../shared/dungeons.js";
test("all floors have distinct reachable layouts, mirrored stages and varied supported spawns", () => {
  const layouts = new Set();
  for (let floor = 1; floor <= 10; floor++) {
    const platforms = dungeonPlatforms(floor, 1);
    layouts.add(JSON.stringify(platforms));
    assert.notDeepEqual(platforms, dungeonPlatforms(floor, 2));
    assert.ok(DUNGEON_ROSTERS[floor - 1].length >= 3);
    const heights = new Set();
    for (let stage = 1; stage <= 3; stage++) {
      const ledges = dungeonPlatforms(floor, stage);
      for (const p of ledges) {
        assert.ok(p.x > 0 && p.x + p.w < 2400);
        assert.ok(p.y >= 300 && p.y < 600);
      }
      const count = dungeonEnemyCount(floor, stage),
        slots = stage === 3 ? count - 1 : count;
      for (let n = 0; n < slots; n++) {
        const p = dungeonSpawn(floor, stage, n, false, count);
        heights.add(p.y);
        assert.ok(p.x > 100 && p.x < 2330);
        assert.ok(
          p.y === 600 ||
            ledges.some((l) => p.x >= l.x && p.x <= l.x + l.w && p.y === l.y),
        );
      }
    }
    assert.ok(heights.size >= 3);
  }
  assert.equal(layouts.size, 10);
});
test("ground monsters land on ledges and fall from edges; bats track vertical targets", () => {
  const e = { type: "wolf", x: 600, y: 430, spawnAt: 1 };
  for (let n = 0; n < 30; n++)
    enemyStep(
      e,
      { x: 600, y: 600 },
      [{ x: 500, y: 490, w: 200 }],
      0.05,
      n * 0.05,
    );
  assert.equal(e.y, 490);
  e.x = 850;
  for (let n = 0; n < 30; n++)
    enemyStep(
      e,
      { x: 850, y: 600 },
      [{ x: 500, y: 490, w: 200 }],
      0.05,
      n * 0.05,
    );
  assert.equal(e.y, 600);
  const bat = { type: "bat", x: 600, y: 400, spawnAt: 1 };
  enemyStep(bat, { x: 600, y: 600 }, [], 0.1, 2);
  assert.ok(bat.y > 400);
});
test("deeper floors field more monsters spread across the whole arena", () => {
  for (let floor = 1; floor <= 10; floor++) {
    for (const stage of [1, 2]) {
      const count = dungeonEnemyCount(floor, stage);
      assert.ok(count >= 10);
      if (floor > 1) assert.ok(count > dungeonEnemyCount(floor - 1, stage));
      const xs = Array.from(
        { length: count },
        (_, n) => dungeonSpawn(floor, stage, n, false, count).x,
      );
      assert.ok(Math.min(...xs) < 900 && Math.max(...xs) > 2050);
    }
  }
});
test("floor rank rewards fast, clean clears and every floor can reach SSS", async () => {
  const { dungeonRank, floorPar } =
    await import("../shared/dungeon-results.js");
  for (let floor = 1; floor <= 10; floor++) {
    const par = floorPar(floor);
    assert.equal(dungeonRank(par * 0.5, 30, 0, floor, 200).rank, "SSS");
    assert.equal(dungeonRank(par * 2, 30, 900, floor, 200).rank, "C");
  }
  const fast = dungeonRank(60, 20, 50, 1, 140),
    slow = dungeonRank(200, 20, 50, 1, 140);
  assert.ok(fast.score > slow.score);
  assert.ok(["SSS", "SS", "S", "A", "B", "C"].includes(slow.rank));
});
