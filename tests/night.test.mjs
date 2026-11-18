import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-night-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { skyAt, DAY_CYCLE, NIGHT_CAVE, NIGHT_BOSS, nightBoss, nightFloor, nightReward } =
  await import("../shared/night.js");
// Shift the world clock so it is night right now for the server under test.
const at = Date.now() / 1000,
  into = ((at % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;
process.env.SKY_OFFSET = String(2800 - into);
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");

function create(id, extra = {}) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = {
    class: "mage", gender: "male", gold: 100, inventory: { hp: 5, mp: 3, ore: 0 },
    upgrade: 0, armor: false, weapon: false, level: 10, exp: 0, unlocked: 5, quest: 4,
    ...extra,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}
function killBoss(p, t) {
  const i = world.instances.get(p.instance);
  i.nextHazardAt = Infinity;
  i.enemies = i.enemies.filter((e) => e.boss);
  const e = i.enemies[0];
  Object.assign(e, { hp: 1, x: p.x + 30, y: p.y });
  p.direction = 1;
  p.action = null;
  p.pending = null;
  p.cooldowns = {};
  world.attack(p, 0, t);
  world.tick(0.05, t + 0.17);
  return i;
}

test("the sky cycles day, dusk, night and dawn with a smooth darkness curve", () => {
  const base = 100 * DAY_CYCLE;
  assert.equal(skyAt(base + 600).phase, "day");
  assert.equal(skyAt(base + 600).dark, 0);
  const dusk = skyAt(base + 2160);
  assert.equal(dusk.phase, "dusk");
  assert.ok(dusk.dark > 0.4 && dusk.dark < 0.6);
  const night = skyAt(base + 2800);
  assert.ok(night.night);
  assert.equal(night.dark, 1);
  assert.equal(night.changeAt, base + 3360, "night ends at dawn");
  assert.equal(skyAt(base + 600).changeAt, base + 2280, "day counts down to nightfall");
  assert.equal(skyAt(base + 3500).changeAt, base + DAY_CYCLE + 2280);
  assert.notEqual(nightBoss(1).type, nightBoss(2).type, "bosses rotate nightly");
});

test("night boss strength follows the best hero in the party", () => {
  assert.equal(nightFloor([{ quest: 0 }]), 1);
  assert.equal(nightFloor([{ quest: 3 }, { quest: 9 }]), 9);
  assert.equal(nightFloor([{ quest: 99 }]), 15);
});

test("the night cave needs night, the cave mouth, and spawns a giant boss", () => {
  const p = create("night-enter");
  p.x = 1200;
  assert.throws(() => world.beginNightCave(p), /ปากถ้ำ/);
  p.x = NIGHT_CAVE.x;
  const energy = world.snapshot(p).self.energy.points;
  world.beginNightCave(p);
  const i = world.instances.get(p.instance);
  assert.equal(i.stage, 3);
  assert.equal(i.floor, 4);
  const boss = i.enemies.find((e) => e.boss);
  assert.ok(boss.night);
  assert.equal(boss.type, i.night.type);
  const normal = Math.round((300 + 4 * 220 + 16 * 55) * 1.2);
  assert.equal(boss.maxHp, Math.round(normal * NIGHT_BOSS.hp));
  assert.equal(world.snapshot(p).self.energy.points, energy, "no energy spent");
  assert.ok(world.snapshot(p).sky.night);
  world.returnTown(p);
});

test("first night clear pays in full once, repeats give a small purse, no unlocks", () => {
  const p = create("night-reward");
  p.x = NIGHT_CAVE.x;
  world.beginNightCave(p);
  const t = Date.now() / 1000 + 5000,
    gold = p.gold,
    ore = p.inventory.ore;
  const i = killBoss(p, t);
  assert.ok(i.completed);
  const r = nightReward(4);
  const killGold = 28 + 4 * 10; // the usual boss kill drop
  assert.equal(p.gold - gold, r.gold + killGold);
  // Plus the regular 50% boss ore drop.
  assert.ok([r.ore, r.ore + 1].includes(p.inventory.ore - ore));
  assert.equal(p.unlocked, 5, "night cave never unlocks floors");
  assert.equal(p.quest, 4);
  assert.equal(i.results[p.id].hasNext, false);
  assert.equal(loadCharacter(p.id).nightClear, i.night.cycle);
  world.nextStage(p);
  assert.equal(p.area, "town", "next from the night cave goes home");

  p.x = NIGHT_CAVE.x;
  world.beginNightCave(p);
  const gold2 = p.gold;
  killBoss(p, t + 100);
  assert.equal(p.gold - gold2, Math.round(r.gold * 0.2) + killGold);
  world.returnTown(p);
});

test("the night cave closes by day", async () => {
  process.env.SKY_OFFSET = String(600 - into);
  // A fresh import picks up the daytime offset.
  const fresh = await import("../server/world.js?day");
  const p = fresh.makeRuntime(create("night-day"), { emit() {} });
  p.x = NIGHT_CAVE.x;
  assert.throws(() => fresh.beginNightCave(p), /กลางคืน/);
});
