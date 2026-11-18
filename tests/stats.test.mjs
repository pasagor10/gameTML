import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  STAT_KEYS,
  pointsAt,
  pointsForLevel,
  raiseCost,
  spentOn,
  freePoints,
  applyRaise,
  autoPlan,
  statEffects,
  buildOf,
  ASPD_CAP,
} from "../shared/stats.js";
const dir = mkdtempSync(path.join(tmpdir(), "tml-stats-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { combatStats, combatPower, maxHp, maxMp } = await import("../shared/config.js");
const { ACTIONS } = await import("../shared/motion.js");

function create(id, job = "swordsman", level = 1) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = { class: job, gender: "male", gold: 1000, inventory: { hp: 5, mp: 3, ore: 3 },
    upgrade: 0, armor: false, weapon: false, level, exp: 0, unlocked: 1, quest: 0 };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}

test("status points follow RO: more per level as you grow, raises cost more the higher the stat", () => {
  assert.equal(pointsAt(1), 0);
  assert.equal(pointsForLevel(2), 3);
  assert.equal(pointsForLevel(5), 4);
  assert.equal(pointsForLevel(40), 11);
  assert.equal(pointsAt(40), 265);
  assert.equal(raiseCost(1), 2);
  assert.equal(raiseCost(10), 2);
  assert.equal(raiseCost(11), 3);
  assert.equal(spentOn(1), 0);
  assert.equal(spentOn(11), 20);
  // A Lv.40 hero can push one stat past 50 and still spread the rest.
  assert.ok(spentOn(51) < pointsAt(40) && spentOn(51) > pointsAt(40) / 2);
});

test("raises are validated: unknown stats, negatives, overspending and the cap are refused", () => {
  const p = { class: "archer", level: 10 };
  assert.equal(freePoints(p), pointsAt(10));
  assert.throws(() => applyRaise(p, { foo: 1 }), /ไม่ถูกต้อง/);
  assert.throws(() => applyRaise(p, { agi: -1 }), /ไม่ถูกต้อง/);
  assert.throws(() => applyRaise(p, { agi: 1.5 }), /ไม่ถูกต้อง/);
  assert.throws(() => applyRaise(p, {}), /ยังไม่ได้เลือก/);
  assert.throws(() => applyRaise(p, { agi: 99 }), /สูงสุด/);
  assert.throws(() => applyRaise(p, { agi: 30 }), /ไม่พอ/);
  applyRaise(p, { agi: 5, dex: 5 });
  assert.equal(p.attrs.agi, 6);
  assert.equal(freePoints(p), pointsAt(10) - 20);
});

test("each class attacks with its own stat; off-class attack stats only count a quarter", () => {
  const raise = (cls, stat) => statEffects({ class: cls, level: 40, attrs: { [stat]: 41 } }).atk;
  assert.equal(raise("swordsman", "str"), 64); // 40 × 1.2 + 4² bonus
  assert.equal(raise("archer", "dex"), 64);
  assert.equal(raise("mage", "int"), 64);
  assert.equal(raise("priest", "int"), 64);
  assert.equal(raise("mage", "str"), 16);
  assert.equal(raise("swordsman", "int"), 16);
  // DEX still adds a little ATK to every class.
  assert.equal(raise("swordsman", "dex"), 16 + 12);
});

test("VIT raises HP and DEF, INT raises MP; LUK raises crit", () => {
  const base = { class: "priest", level: 20 },
    tough = { ...base, attrs: { vit: 31, int: 31, luk: 21 } };
  assert.ok(maxHp(tough) > maxHp(base) * 1.3);
  assert.ok(maxMp(tough) > maxMp(base) * 1.3);
  assert.equal(combatStats(tough).def, combatStats(base).def + 15);
  assert.ok(Math.abs(combatStats(tough).crit - combatStats(base).crit - 0.06) < 1e-9);
  assert.ok(combatPower(combatStats(tough)) > combatPower(combatStats(base)));
});

test("AGI quickens the basic attack (ASPD), capped; archer AGI adds double strafe", () => {
  const slow = combatStats({ class: "archer", level: 40 }),
    fast = combatStats({ class: "archer", level: 40, attrs: { agi: 61 } }),
    max = combatStats({ class: "archer", level: 40, attrs: { agi: 99, dex: 99 } });
  assert.equal(slow.aspd, 1);
  assert.ok(fast.aspd > 1.7);
  assert.equal(max.aspd, ASPD_CAP);
  assert.ok(Math.abs(fast.double - 0.3) < 1e-9);
  assert.equal(combatStats({ class: "swordsman", level: 40, attrs: { agi: 61 } }).double, 0);
});

test("the server fires an AGI archer's shots faster and saves allocated stats", () => {
  const p = create("stat-archer", "archer", 40);
  world.raiseStats(p, { agi: 50 });
  assert.equal(loadCharacter(p.id).attrs.agi, 51);
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance);
  i.enemies.forEach((e) => { e.x = p.x + 60; e.y = p.y; e.hp = e.maxHp = 1e6; });
  const t = Date.now() / 1000,
    swing = ACTIONS[0].cooldown / combatStats(p).aspd;
  assert.ok(swing < ACTIONS[0].cooldown * 0.65);
  let shots = 0;
  for (let n = 0; n <= 40; n++) {
    const at = t + n * 0.05;
    const before = p.attackAt;
    world.attack(p, 0, at);
    if (p.attackAt !== before) shots++;
    world.tick(0.05, at);
  }
  // 2 s of held fire: a plain archer manages ~4 shots; this one well over 6.
  assert.ok(shots >= 6, `shots ${shots}`);
  world.returnTown(p);
});

test("DEX shortens a skill's cast; monsters can miss an agile hero", () => {
  const p = create("stat-dodge", "archer", 30);
  world.raiseStats(p, { dex: 30 });
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000;
  p.mp = 500;
  world.attack(p, 1, t);
  assert.ok(p.action.impactAt - t < ACTIONS[1].windup * 0.85);
  p.attrs.agi = 80;
  const e = i.enemies[0];
  assert.equal(world.dodged(i, p, e, t, 0.01), true);
  assert.ok(i.events.some((ev) => ev.kind === "miss" && ev.targetId === p.id));
  assert.equal(world.dodged(i, p, e, t, 0.99), false);
  // Bosses are only dodged half as often.
  const flee = combatStats(p).flee + combatStats(p).perfect;
  assert.equal(world.dodged(i, p, { boss: true }, t, flee * 0.6), false);
  world.returnTown(p);
});

test("auto allocation follows the class build and reset refunds, free once then gold", () => {
  const p = create("stat-auto", "archer", 20);
  p.specialization = "scout";
  assert.deepEqual(Object.keys(buildOf(p).weights)[0], "agi");
  const plan = autoPlan(p);
  assert.ok(plan.agi > plan.dex && plan.dex > (plan.luk || 0));
  world.autoStats(p);
  assert.ok(freePoints(p) < 3);
  assert.throws(() => world.raiseStats(p, { str: 5 }), /ไม่พอ/);
  const gold = p.gold;
  world.resetStats(p);
  assert.equal(p.gold, gold, "the first reset is free");
  assert.equal(freePoints(p), pointsAt(20));
  assert.ok(STAT_KEYS.every((k) => (p.attrs?.[k] ?? 1) === 1));
  world.raiseStats(p, { dex: 2 });
  world.resetStats(p);
  assert.equal(p.gold, gold - 300);
  assert.equal(loadCharacter(p.id).statResets, 2);
});

test("auto play spends new points along the build on level up", () => {
  const p = create("stat-level", "mage", 1);
  p.auto = true;
  world.players.set(p.id, p);
  p.exp = 0;
  // Level up through the kill reward path's exp().
  world.grantExp(p, 80 + 160);
  assert.equal(p.level, 3);
  assert.ok(freePoints(p) < 2);
  assert.ok(p.attrs.int > 1);
});

process.on("exit", () => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
