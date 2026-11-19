import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-deep-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { FLOORS, MAIN_FLOORS, floorDifficulty, recommendedLevel } = await import("../shared/config.js");
const { FLOOR_VARIANTS, TRAITS, rosterEntry, DUNGEON_ROSTERS, dungeonPlatforms, dungeonEnemyCount } = await import(
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

test("thirty deep floors follow floor 10, each with its own monster lineup", () => {
  assert.equal(FLOORS.length, 40);
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
  assert.equal(lineups.size, 30, "no two deep floors share a lineup");
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

test("deep boss drops its own floor gear and unlocks the next floor", () => {
  const p = create("deep-boss", { unlocked: 13, quest: 40 });
  world.beginDungeon(p, 13);
  const i = world.instances.get(p.instance);
  i.stage = 3;
  i.nextHazardAt = Infinity;
  const t = Date.now() / 1000 + 4000;
  i.enemies = [i.enemies[0]];
  const e = i.enemies[0];
  Object.assign(e, { boss: true, hp: 1, x: p.x + 30, y: p.y, type: FLOORS[12].bossType });
  p.direction = 1;
  world.attack(p, 0, t);
  world.tick(0.05, t + 0.17);
  assert.ok(i.completed);
  const rewards = i.rewards[p.id];
  const drop = rewards.items.find(id => id.startsWith("deep_13_"));
  assert.ok(drop, "repeat clears award the actual floor's missing equipment");
  assert.ok(loadCharacter(p.id).ownedEquipment.includes(drop), "loot persists");
  assert.equal(p.unlocked, 14);
  world.returnTown(p);
});


test("all 25 added floors spawn three complete stages with reachable geometry and bosses", () => {
  const names = new Set(FLOORS.map(f => f.name));
  assert.equal(names.size, 40);
  for (let floor = 16; floor <= 40; floor++) {
    const p = create(`expanded-${floor}`, { unlocked: floor, level: 40 });
    assert.throws(() => world.beginDungeon(p, floor + 1));
    world.beginDungeon(p, floor);
    const i = world.instances.get(p.instance);
    for (let stage = 1; stage <= 3; stage++) {
      assert.equal(i.stage, stage);
      assert.equal(i.enemies.length, dungeonEnemyCount(floor, stage));
      assert.ok(i.enemies.every(e => Number.isFinite(e.maxHp) && e.maxHp > 0));
      assert.ok(dungeonPlatforms(floor, stage).every(p => p.x >= 0 && p.x + p.w <= 2400 && p.y < 600));
      for (const e of i.enemies.filter(e => !e.boss)) {
        assert.ok(FLOOR_VARIANTS[floor].some(v => v.name === e.variant));
        assert.ok(TRAITS[e.trait]);
      }
      if (stage < 3) {
        i.clear = true;
        world.nextStage(p);
      } else {
        assert.equal(i.enemies.filter(e => e.boss).length, 1);
        assert.equal(i.enemies[0].type, FLOORS[floor - 1].bossType);
      }
    }
    assert.ok(recommendedLevel(floor) <= 40, "recommendations respect the hero level cap");
    world.returnTown(p);
  }
});

test("new floor clears persist rewards and unlocks; floor 40 ends the dungeon", () => {
  for (const floor of [15, 16, 39, 40]) {
    const p = create(`expanded-clear-${floor}`, { unlocked: floor, quest: floor - 1, level: 40 });
    world.beginDungeon(p, floor);
    const i = world.instances.get(p.instance);
    for (let stage = 1; stage < 3; stage++) {
      i.clear = true;
      world.nextStage(p);
    }
    i.nextHazardAt = Infinity;
    const boss = i.enemies.find(e => e.boss);
    i.enemies = [boss];
    Object.assign(boss, { hp: 1, x: p.x + 30, y: p.y });
    p.direction = 1;
    const t = Date.now() / 1000 + 5000 + floor;
    world.attack(p, 0, t);
    world.tick(0.05, t + 0.17);
    assert.ok(i.completed, `floor ${floor} clears`);
    assert.equal(p.unlocked, Math.min(40, floor + 1));
    assert.equal(p.quest, floor);
    assert.ok(i.rewards[p.id].gold > 0);
    assert.ok(i.rewards[p.id].items.length || i.rewards[p.id].ore >= 2 + floor - MAIN_FLOORS);
    assert.equal(loadCharacter(p.id).unlocked, Math.min(40, floor + 1));
    assert.equal(i.results[p.id].hasNext, floor < 40);
    world.nextStage(p);
    if (floor === 40) {
      assert.equal(p.area, "town");
      assert.throws(() => world.beginDungeon(p, 41), /ชั้นไม่ถูกต้อง/);
    } else {
      assert.equal(i.floor, floor + 1);
      assert.equal(i.stage, 1);
      world.returnTown(p);
    }
  }
});

test("floors past 15 grow gently, since heroes stop levelling at 40", async () => {
  const { powerFloor } = await import("../shared/config.js");
  assert.equal(powerFloor(10), 10);
  assert.equal(powerFloor(15), 15);
  assert.equal(powerFloor(40), 25);
  const bossHp = (floor) => {
    const p = create(`scale-${floor}`, { unlocked: floor, level: 40 });
    world.beginDungeon(p, floor);
    const i = world.instances.get(p.instance);
    for (let stage = 1; stage < 3; stage++) { i.clear = true; world.nextStage(p); }
    const hp = i.enemies.find((e) => e.boss).maxHp;
    world.returnTown(p);
    return hp;
  };
  const ratio = bossHp(40) / bossHp(15);
  assert.ok(ratio > 1.5 && ratio < 3, `floor 40 boss is ${ratio.toFixed(2)}x floor 15`);
});

test("deep floor loot is guaranteed until each class has the full unique set", async () => {
  const { FLOOR_LOOT, GEAR } = await import("../shared/rpg.js");
  for (const job of ["swordsman", "archer", "mage", "priest"]) {
    let atk = 0;
    for (let floor = 11; floor <= 40; floor++) {
      const table = FLOOR_LOOT[floor];
      const hero = { class: job, ownedEquipment: [], quest: 40 };
      const wanted = [table.weapons[job], ...table.pool];
      for (let n = 0; n < 4; n++) {
        const id = world.rollBossLoot(hero, floor, false, () => 0.9999);
        assert.ok(wanted.includes(id));
        assert.ok(!hero.ownedEquipment.includes(id));
        assert.equal(GEAR[id].floor, floor);
        assert.ok(GEAR[id].level <= 60);
        hero.ownedEquipment.push(id);
      }
      assert.equal(world.rollBossLoot(hero, floor, false, () => 0), null);
      const weapon = GEAR[table.weapons[job]];
      assert.ok(weapon.stats.atk > atk, "deeper floor improves weapon");
      atk = weapon.stats.atk;
    }
    const final = GEAR[FLOOR_LOOT[40].weapons[job]];
    assert.equal(final.level, 60);
    assert.equal(final.rarity, "divine");
    assert.ok(final.stats.atk > 130);
  }
  for (const slot of ["armor", "charm", "boots"])
    assert.equal(GEAR[`deep_40_${slot}`].rarity, "divine");
});
