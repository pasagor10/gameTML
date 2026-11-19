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
// Shift the schedule so the boss rose a minute ago (never the 20:00 grand boss).
const current = Date.now()/1000;
let risen = worldBossAt(current).startsAt;
if (worldBossAt(risen).grand) risen += WORLD_BOSS.every;
process.env.WORLD_BOSS_OFFSET = String(risen + 60 - current);
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

test("the yaksha and the naga take turns every half hour and close after twenty minutes", () => {
  const start = Date.parse("2026-11-18T20:00:00+07:00")/1000;
  assert.equal(worldBossAt(start-1).open, false);
  // 20:00 Bangkok is the grand boss; the other half hours are Nang Non.
  assert.equal(worldBossAt(start).grand, true);
  assert.equal(worldBossAt(start).name, "มหาเทพีนางนอน");
  assert.equal(worldBossAt(start + 1800).grand, false);
  const next = worldBossAt(start + 1800), after = worldBossAt(start + 3600);
  assert.ok(["yaksha", "naga"].includes(next.type));
  assert.ok(["yaksha", "naga"].includes(after.type));
  assert.notEqual(next.type, after.type, "bosses alternate each round");
  assert.equal(worldBossAt(start + 5400).type, next.type);
  assert.equal(worldBossAt(start).type, "naga", "the grand boss is the naga queen");
  assert.equal(worldBossAt(start - 1800).nextGrand, true);
  assert.equal(worldBossAt(start).open, true);
  assert.equal(worldBossAt(start+1199).open, true);
  assert.equal(worldBossAt(start+1200).open, false);
  assert.equal(worldBossAt(start).nextAt, start+1800);
  assert.equal(worldBossAt(start+1800).open, true);
});

test("divine weapons cover every class and stay outside ordinary loot and shops", async () => {
  const { GEAR, WORLD_BOSS_WEAPONS, FLOOR_LOOT } = await import("../shared/rpg.js");
  assert.equal(Object.keys(WORLD_BOSS_WEAPONS).length, 4);
  for (const [job, id] of Object.entries(WORLD_BOSS_WEAPONS)) {
    const g = GEAR[id];
    assert.equal(g.class, job);
    assert.equal(g.source, "world-boss");
    assert.equal(g.price, undefined);
    assert.ok(g.stats.atk > GEAR[`floor_10_${job}_weapon`].stats.atk);
    for (const table of Object.values(FLOOR_LOOT)) {
      assert.ok(!Object.values(table.weapons).includes(id));
      assert.ok(!table.pool.includes(id));
    }
  }
});

test("ranking and rewards follow the share of damage", () => {
  const r = worldRanking(new Map([["a", 100], ["b", 300], ["c", 0]]), new Map(), 1000);
  assert.deepEqual(r.map((x) => x.id), ["b", "a"], "no damage, no place");
  assert.equal(r[0].share, 0.3);
  const first = worldReward(1, 0.6),
    fifth = worldReward(5, 0.05);
  assert.ok(first.gold > fifth.gold && first.ore > fifth.ore && first.exp > fifth.exp);
  assert.equal(first.stones, 3);
  assert.equal(worldReward(2, .2).stones, 2);
  assert.equal(fifth.stones, 1);
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
    goldB = b.gold,
    stonesA = a.inventory.stone_high || 0,
    stonesB = b.inventory.stone_high || 0;
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
  assert.equal(i.rewards[a.id].stones, 3);
  assert.equal(i.rewards[b.id].stones, 2);
  assert.equal(a.inventory.stone_high - stonesA, 3, "high stones are the loot");
  assert.equal(b.inventory.stone_high - stonesB, 2, "paid at home too");
  assert.equal(loadCharacter(b.id).inventory.stone_high, stonesB + 2, "saved");
  const completed = world.worldBoss;
  completed.cycle = -1;
  world.updateWorldBoss();
  assert.equal(world.worldBoss, completed, "a completed boss cycle cannot respawn");
  completed.cycle = worldBossAt(world.worldBossClock()).cycle;
  assert.equal(res.hasNext, false);
  assert.ok(a.gold - goldA >= worldReward(1, 0).gold);
  assert.ok(b.gold - goldB >= worldReward(2, 0).gold, "paid at home too");
  assert.ok(!world.snapshot(a).worldBoss.open);
  assert.throws(() => world.joinWorldBoss(b), /บอสโลก/);
  world.nextStage(a);
  assert.equal(a.area, "town");
});

test("if time runs out the boss escapes and sends everyone home", () => {
  world.worldBoss.cycle = -1;
  const tomorrow = worldBossAt(world.worldBossClock()).nextAt + 60;
  world.updateWorldBoss(tomorrow);
  const i = arena(),
    a = world.live("wb-a");
  // Join directly for the simulated next day; the production clock is unchanged.
  i.members.push(a.id); a.area = "dungeon"; a.instance = i.id;
  world.worldBoss.endsAt = 0;
  world.updateWorldBoss(tomorrow);
  assert.equal(world.worldBoss.done, "escaped");
  assert.equal(a.area, "town");
  assert.ok(!world.instances.has(i.id));
});


test("global announcements warn at 10, 5 and 1 minutes without repeating", () => {
  const start = worldBossAt(world.worldBossClock()).nextAt + 86400;
  const before = world.announcements.length;
  for (const seconds of [600,300,60]) {
    world.updateWorldBoss(start-seconds);
    world.updateWorldBoss(start-seconds+1);
  }
  const notices = world.announcements.slice(before);
  assert.equal(notices.length, 3);
  const nextName = worldBossAt(start).name;
  assert.ok(notices.every(a => a.message.includes(nextName)), "warnings name the boss that comes next");
  assert.ok(notices[0].message.includes("10 นาที"));
});
