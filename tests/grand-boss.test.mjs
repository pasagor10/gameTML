import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "tml-grand-")), "test.sqlite");
const { WORLD_BOSS, GRAND_BOSS, worldBossAt, nextGrandIn } = await import("../shared/world-boss.js");
// Shift the schedule so today's 20:00 grand boss rose a minute ago.
const current = Date.now() / 1000,
  grandStart = current + nextGrandIn(current) - (nextGrandIn(current) === 0 ? current % 1800 : 0);
process.env.WORLD_BOSS_OFFSET = String(grandStart + 60 - current);
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { BLESS_STONE } = await import("../shared/config.js");

function create(id) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify({
    class: "mage", gender: "male", gold: 100, inventory: { hp: 5, mp: 3, ore: 0 },
    upgrade: 0, armor: false, weapon: false, level: 30, exp: 0, unlocked: 10, quest: 9,
  }));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}

test("the grand boss rises at 20:00 Bangkok time only", () => {
  const eight = Date.parse("2026-11-18T20:00:00+07:00") / 1000;
  assert.equal(worldBossAt(eight).grand, true);
  for (const h of [-1800, 1800, 3600, -43200]) assert.equal(worldBossAt(eight + h).grand, false);
  assert.equal(worldBossAt(eight + 86400).grand, true);
  assert.equal(nextGrandIn(eight - 600), 600);
  assert.equal(nextGrandIn(eight + 60), 0);
});

test("it is three times tankier and every hero who joined gets a blessed stone", () => {
  world.updateWorldBoss();
  const i = world.instances.get(world.worldBoss.instanceId);
  assert.equal(i.world.grand, true);
  const boss = i.enemies.find((e) => e.boss);
  assert.equal(boss.grand, true);
  assert.equal(boss.maxHp, WORLD_BOSS.hp * GRAND_BOSS.hpMul);
  const a = create("grand-a"), b = create("grand-b");
  world.joinWorldBoss(a);
  world.joinWorldBoss(b);
  assert.equal(boss.maxHp, (WORLD_BOSS.hp + WORLD_BOSS.hpPerHero) * GRAND_BOSS.hpMul);
  // b joins but never lands a hit, then goes home: still gets the stone.
  world.returnTown(b);
  const t = Date.now() / 1000;
  world.worldBoss.damage.set(a.id, 50000);
  Object.assign(boss, { hp: 1, x: a.x + 60, y: a.y });
  i.mech = null;
  i.mechAt = Infinity;
  Object.assign(a, { direction: 1, action: null, pending: null, cooldowns: {} });
  world.attack(a, 0, t);
  world.tick(0.02, t + 0.2);
  assert.equal(world.worldBoss.done, "killed");
  assert.equal(a.inventory[BLESS_STONE], 1);
  assert.equal(b.inventory[BLESS_STONE], 1);
  assert.equal(loadCharacter(b.id).inventory[BLESS_STONE], 1, "saved");
});

test("a blessed stone always succeeds and costs no gold or ore", () => {
  const p = create("stone-user");
  db.prepare("UPDATE characters SET state=json_set(state,'$.inventory.stone_100',1,'$.upgrade',12,'$.gold',0) WHERE id=?").run(p.id);
  assert.ok(loadCharacter(p.id).equipment.weapon, "starter gear has a weapon");
  const r = world.enhance(p, "bless-stone-test-1", "weapon", true);
  assert.equal(r.success, true);
  const after = loadCharacter(p.id);
  assert.equal(after.upgrade, 13);
  assert.equal(after.inventory.stone_100, 0);
  assert.equal(after.gold, 0);
  assert.throws(() => world.enhance(p, "bless-stone-test-2", "weapon", true), /หินตีบวก/);
});
