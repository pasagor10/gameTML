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
  assert.ok(Math.abs(combatStats(tough).crit - combatStats(base).crit - 0.08) < 1e-9);
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

test("heroes level past 40 up to Lv.60 and stop there", async () => {
  const { MAX_LEVEL, expToLevel } = await import("../shared/config.js");
  assert.equal(MAX_LEVEL, 60);
  const p = create("lv-cap", "swordsman", 40);
  const hp40 = maxHp(p), atk40 = combatStats(p).atk, pts40 = freePoints(p);
  world.grantExp(p, expToLevel(40));
  assert.equal(p.level, 41);
  assert.ok(maxHp(p) > hp40 && combatStats(p).atk > atk40 && freePoints(p) > pts40);
  let rest = 0;
  for (let l = 41; l < 60; l++) rest += expToLevel(l);
  world.grantExp(p, rest + 999999);
  assert.equal(p.level, 60);
});

test("HP and MP potions each have their own cooldown", () => {
  const p = create("potion-cd", "mage", 5),
    t = Date.now() / 1000;
  p.hp = 10;
  p.mp = 10;
  world.potion(p, "hp", t);
  assert.throws(() => world.potion(p, "hp", t + 1), /ยังไม่พร้อม/);
  world.potion(p, "mp", t + 1);
  assert.throws(() => world.potion(p, "mp", t + 2), /ยังไม่พร้อม/);
  p.hp = 10;
  world.potion(p, "hp", t + 4.1);
  assert.equal(p.inventory.hp, 3);
  assert.equal(p.inventory.mp, 2);
});

test("gear carries base-stat bonuses that grow with level and rarity, and crits hit harder", async () => {
  const { GEAR, gearAttrs } = await import("../shared/rpg.js");
  const low = GEAR.floor_4_archer_weapon.attrs,
    high = GEAR.floor_10_archer_weapon.attrs;
  assert.ok(low.dex > 0 && high.dex > low.dex, "the archer bow pushes DEX, more at higher tiers");
  assert.equal(GEAR.starter_archer.attrs, undefined);
  const p = { class: "archer", level: 20, equipment: { weapon: "floor_10_archer_weapon" } };
  assert.deepEqual(gearAttrs(p), high);
  assert.equal(statEffects(p).stats.dex, 1 + high.dex);
  const plain = combatStats({ class: "archer", level: 1 });
  assert.ok(plain.crit >= 0.2 && plain.critDamage >= 1.75);
});

test("archer rapid fire: back-to-back shots chain and hold the aim between them", async () => {
  const { rapidFireFrame, AIM_HOLD } = await import("../public/sprite-sets.js");
  const p = create("rapid-chain", "archer", 40);
  world.raiseStats(p, { agi: 40 });
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance);
  i.enemies.forEach((e) => { e.x = p.x + 60; e.y = p.y; e.hp = e.maxHp = 1e6; });
  const t = Date.now() / 1000,
    chains = [];
  for (let n = 0; n <= 30; n++) {
    const at = t + n * 0.05, before = p.attackAt;
    world.attack(p, 0, at);
    if (p.attackAt !== before) chains.push(p.action.chain);
    world.tick(0.05, at);
  }
  assert.equal(chains[0], 0);
  assert.deepEqual(chains.slice(0, 4), [0, 1, 2, 3], "every follow-up shot extends the chain");
  const shot = i.events.find((e) => e.kind === "attack" && e.chain >= 2);
  assert.ok(shot, "attack events carry the chain for the client effects");
  world.returnTown(p);
  // The 6-frame painted clip: hit on frame 4, so aim = 3 and release = 4.
  const durations = [70, 70, 80, 70, 90, 110],
    clip = { hitMs: 290, durations, total: 490, frames: durations.map(() => ({})) },
    action = { skill: 0, chain: 2, startedAt: 0, impactAt: 0.1, endsAt: 0.3 },
    archer = { class: "archer", action };
  assert.equal(rapidFireFrame(clip, archer, { state: "attack" }, 0.05), 3);
  assert.equal(rapidFireFrame(clip, archer, { state: "attack" }, 0.15), 4);
  assert.equal(rapidFireFrame(clip, archer, { state: "idle" }, 0.3 + AIM_HOLD / 2), 3, "holds the aim between shots");
  assert.equal(rapidFireFrame(clip, archer, { state: "idle" }, 0.3 + AIM_HOLD + 0.1), null);
  assert.equal(rapidFireFrame(clip, { ...archer, action: { ...action, chain: 0 } }, { state: "attack" }, 0.05), null,
    "the first shot plays the full draw");
  assert.equal(rapidFireFrame(clip, { class: "mage", action }, { state: "attack" }, 0.05), null);
});

process.on("exit", () => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
