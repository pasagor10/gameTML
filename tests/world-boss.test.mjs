import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-worldboss-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { WORLD_BOSS, worldBossAt, worldRanking, worldReward } = await import(
  "../shared/world-boss.js"
);
// Shift the schedule so the boss rose a minute ago.
const into = (Date.now() / 1000) % WORLD_BOSS.every;
process.env.WORLD_BOSS_OFFSET = String(60 - into);
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");

function create(id, extra = {}) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = {
    class: "mage", gender: "male", gold: 100, inventory: { hp: 5, mp: 3, ore: 0 },
    upgrade: 0, armor: false, weapon: false, level: 30, exp: 0, unlocked: 10, quest: 9,
    ...extra,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}
const arena = () => world.instances.get(world.worldBoss.instanceId);
const bossOf = (i) => i.enemies.find((e) => e.boss);

test("the world boss keeps a half-hour schedule and rotates", () => {
  const base = 1000 * WORLD_BOSS.every;
  assert.ok(worldBossAt(base + 10).open);
  assert.ok(!worldBossAt(base + WORLD_BOSS.window + 1).open);
  assert.equal(worldBossAt(base + 10).nextAt, base + WORLD_BOSS.every);
  assert.notEqual(worldBossAt(base).name, worldBossAt(base + WORLD_BOSS.every).name);
});

test("ranking and rewards follow the share of damage", () => {
  const r = worldRanking(new Map([["a", 100], ["b", 300], ["c", 0]]), new Map(), 1000);
  assert.deepEqual(r.map((x) => x.id), ["b", "a"], "no damage, no place");
  assert.equal(r[0].share, 0.3);
  const first = worldReward(1, 0.6),
    fifth = worldReward(5, 0.05);
  assert.ok(first.gold > fifth.gold && first.ore > fifth.ore && first.exp > fifth.exp);
  assert.equal(first.itemChance, 1);
});

test("heroes join one shared arena; each newcomer toughens the boss", () => {
  world.updateWorldBoss();
  const i = arena();
  assert.ok(i?.world, "arena opened on schedule");
  const a = create("wb-a"),
    b = create("wb-b");
  world.joinWorldBoss(a);
  assert.equal(bossOf(i).maxHp, WORLD_BOSS.hp);
  world.joinWorldBoss(b);
  assert.equal(bossOf(i).maxHp, WORLD_BOSS.hp + WORLD_BOSS.hpPerHero);
  assert.equal(a.instance, i.id);
  assert.equal(b.instance, i.id);
  assert.throws(() => world.joinWorldBoss(a), /เมือง/);
  // Leaving and coming back doesn't grow it again.
  world.returnTown(b);
  world.joinWorldBoss(b);
  assert.equal(bossOf(i).maxHp, WORLD_BOSS.hp + WORLD_BOSS.hpPerHero);
  const view = world.snapshot(a).worldBoss;
  assert.ok(view.open);
  assert.equal(view.heroes, 2);
  assert.equal(world.snapshot(a).dungeon.world.name, i.world.name);
});

test("the arena stays open when everyone steps out", () => {
  const i = arena();
  for (const id of [...i.members]) world.returnTown(world.live(id));
  assert.ok(world.instances.has(i.id));
  world.joinWorldBoss(world.live("wb-a"));
  world.joinWorldBoss(world.live("wb-b"));
});

test("guards pour out as the boss's health falls", () => {
  const i = arena(),
    boss = bossOf(i);
  boss.hp = boss.maxHp * 0.7;
  world.tick(0.02, Date.now() / 1000 + 100);
  assert.equal(i.summoned, 1);
  assert.equal(i.enemies.filter((e) => !e.boss).length, WORLD_BOSS.summonCount);
});

test("everyone who hit it is paid by place, even after going home", () => {
  const i = arena(),
    boss = bossOf(i),
    a = world.live("wb-a"),
    b = world.live("wb-b");
  i.nextHazardAt = Infinity;
  const t = Date.now() / 1000 + 200;
  // b chips in a little, then heads home.
  boss.x = b.x + 60;
  boss.y = b.y;
  b.direction = 1;
  b.cooldowns = {};
  world.attack(b, 0, t);
  world.tick(0.02, t + 0.2);
  assert.ok(world.worldBoss.damage.get("wb-b") > 0);
  world.returnTown(b);
  const goldA = a.gold,
    goldB = b.gold;
  // a lands the big blows and the finisher.
  world.worldBoss.damage.set("wb-a", 50000);
  boss.hp = 1;
  boss.x = a.x + 60;
  boss.y = a.y;
  a.direction = 1;
  a.action = null;
  a.pending = null;
  a.cooldowns = {};
  world.attack(a, 0, t + 1);
  world.tick(0.02, t + 1.2);
  assert.ok(i.completed);
  assert.equal(world.worldBoss.done, "killed");
  assert.equal(i.enemies.length, 0, "the guards scatter with their master");
  const res = i.results[a.id];
  assert.equal(res.world.place, 1);
  assert.equal(res.hasNext, false);
  assert.ok(a.gold - goldA >= worldReward(1, 0).gold);
  assert.ok(b.gold - goldB >= worldReward(2, 0).gold, "paid at home too");
  assert.ok(!world.snapshot(a).worldBoss.open);
  assert.throws(() => world.joinWorldBoss(b), /บอสโลก/);
  world.nextStage(a);
  assert.equal(a.area, "town");
});

test("if time runs out the boss escapes and sends everyone home", () => {
  world.worldBoss.cycle = -1; // pretend the last one is old: a new one opens
  world.updateWorldBoss();
  const i = arena(),
    a = world.live("wb-a");
  world.joinWorldBoss(a);
  world.worldBoss.endsAt = 0;
  world.updateWorldBoss();
  assert.equal(world.worldBoss.done, "escaped");
  assert.equal(a.area, "town");
  assert.ok(!world.instances.has(i.id));
});
