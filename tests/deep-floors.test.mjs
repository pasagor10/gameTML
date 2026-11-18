import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-deep-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { FLOORS, MAIN_FLOORS, floorDifficulty } = await import("../shared/config.js");
const { FLOOR_VARIANTS, TRAITS, rosterEntry, DUNGEON_ROSTERS } = await import(
  "../shared/dungeons.js"
);

function create(id, extra = {}) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = {
    class: "swordsman",
    gender: "male",
    gold: 120,
    inventory: { hp: 5, mp: 3, ore: 3 },
    upgrade: 0,
    armor: false,
    weapon: false,
    level: 30,
    exp: 0,
    unlocked: 1,
    quest: 0,
    ...extra,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}

test("five deep floors follow floor 10, each with its own monster lineup", () => {
  assert.equal(FLOORS.length, MAIN_FLOORS + 5);
  assert.equal(DUNGEON_ROSTERS.length, FLOORS.length);
  const lineups = new Set();
  for (let floor = MAIN_FLOORS + 1; floor <= FLOORS.length; floor++) {
    assert.ok(FLOORS[floor - 1].deep);
    assert.equal(floorDifficulty(floor).id, "abyss");
    const names = FLOOR_VARIANTS[floor].map((v) => v.name);
    assert.equal(new Set(names).size, 3);
    for (const v of FLOOR_VARIANTS[floor]) assert.ok(TRAITS[v.trait], v.trait);
    lineups.add(JSON.stringify([0, 1, 2].map((n) => rosterEntry(floor, n))));
  }
  assert.equal(lineups.size, 5, "no two deep floors share a lineup");
  const allNames = Object.values(FLOOR_VARIANTS).flat().map((v) => v.name);
  assert.equal(new Set(allNames).size, allNames.length, "every variant is unique");
});

test("deep floors unlock only after floor 10 and spawn trait variants", () => {
  const p = create("deep-lock", { unlocked: MAIN_FLOORS });
  assert.throws(() => world.beginDungeon(p, MAIN_FLOORS + 1));
  p.unlocked = MAIN_FLOORS + 1;
  world.beginDungeon(p, MAIN_FLOORS + 1);
  const i = world.instances.get(p.instance);
  assert.ok(i.enemies.length > 0);
  for (const e of i.enemies) {
    assert.ok(e.variant, "every deep monster is a named variant");
    assert.ok(TRAITS[e.trait]);
  }
  world.returnTown(p);
});

test("traits change combat: armor cuts damage, regen heals, giants have more HP", () => {
  const p = create("deep-traits", { unlocked: 15 });
  world.beginDungeon(p, 12);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 3000;
  i.nextHazardAt = Infinity;
  const giant = i.enemies.find((e) => e.trait === "giant" && !e.elite),
    plain = i.enemies.find((e) => e.trait !== "giant" && !e.elite);
  assert.ok(giant.maxHp > plain.maxHp * 1.5);

  // Same hit on an armored and an unarmored monster.
  const armored = i.enemies.find((e) => e.trait === "armored"),
    other = i.enemies.find((e) => e.trait === "frenzy");
  const hit = (e) => {
    for (const o of i.enemies) o.x = 2300;
    e.x = p.x + 30;
    e.y = p.y;
    e.hp = e.maxHp = 100000;
    p.direction = 1;
    p.action = null;
    p.pending = null;
    p.cooldowns = {};
    const orig = Math.random;
    Math.random = () => 0.5; // no crit
    world.attack(p, 0, t);
    world.tick(0.05, t + 0.17);
    Math.random = orig;
    return 100000 - e.hp;
  };
  const a = hit(armored),
    b = hit(other);
  assert.ok(a < b * 0.7, `armored took ${a} vs ${b}`);
  world.returnTown(p);

  world.beginDungeon(p, 11);
  const j = world.instances.get(p.instance);
  j.nextHazardAt = Infinity;
  const slime = j.enemies.find((e) => e.trait === "regen");
  for (const o of j.enemies) o.x = 2300;
  slime.hp = slime.maxHp / 2;
  slime.hitAt = 0;
  world.tick(0.5, t + 10);
  assert.ok(slime.hp > slime.maxHp / 2, "regen heals when left alone");
  world.returnTown(p);
});

test("deep boss pays more ore and can drop floor-10 gear", () => {
  const p = create("deep-boss", { unlocked: 13, quest: 12 });
  world.beginDungeon(p, 13);
  const i = world.instances.get(p.instance);
  i.stage = 3;
  i.nextHazardAt = Infinity;
  const t = Date.now() / 1000 + 4000;
  const ore = p.inventory.ore;
  i.enemies = [i.enemies[0]];
  const e = i.enemies[0];
  Object.assign(e, { boss: true, hp: 1, x: p.x + 30, y: p.y, type: FLOORS[12].bossType });
  p.direction = 1;
  world.attack(p, 0, t);
  world.tick(0.05, t + 0.17);
  assert.ok(i.completed);
  const rewards = i.rewards[p.id];
  assert.ok(
    rewards.items.length > 0 || p.inventory.ore - ore >= 2 + (13 - MAIN_FLOORS),
    "a floor-10 item or the deep ore payout",
  );
  assert.equal(p.unlocked, 14);
  world.returnTown(p);
});
