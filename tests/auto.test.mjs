import { test } from "node:test";
import assert from "node:assert/strict";
import { autoBrain } from "../server/auto.js";

const hero = (o = {}) => ({
  x: 400,
  y: 600,
  grounded: true,
  direction: 1,
  mp: 100,
  cooldowns: {},
  ...o,
});
const mob = (id, x, o = {}) => ({
  id,
  x,
  y: 600,
  hp: 100,
  maxHp: 100,
  type: "slime",
  aggro: true,
  ...o,
});
const ctx = (range = 130) => ({ range, mpMax: 100, platforms: [] });

test("auto never swings at empty air: walks to the monster first", () => {
  const p = hero();
  const plan = autoBrain(p, { enemies: [mob("a", 1400)] }, 10, ctx());
  assert.equal(plan.skill, null);
  assert.equal(plan.input, 1);
  assert.equal(autoBrain(p, { enemies: [] }, 10, ctx()).skill, null);
});

test("auto keeps its locked target instead of flip-flopping", () => {
  const p = hero(),
    a = mob("a", 700),
    b = mob("b", 0, { aggro: false });
  autoBrain(p, { enemies: [a, b] }, 10, ctx());
  assert.equal(p.autoTarget, "a");
  b.x = 290; // now a bit cheaper than a, but not worth abandoning the fight
  autoBrain(p, { enemies: [a, b] }, 10.2, ctx());
  assert.equal(p.autoTarget, "a");
  a.hp = 0; // target died: move on
  autoBrain(p, { enemies: [a, b] }, 10.4, ctx());
  assert.equal(p.autoTarget, "b");
});

test("auto picks skills by situation and saves big ones for crowds or bosses", () => {
  const lone = autoBrain(
    hero(),
    { enemies: [mob("a", 470, { hp: 20 })] },
    10,
    ctx(),
  );
  assert.equal(lone.skill, 0, "weak single monster: basic attack");
  const crowd = autoBrain(
    hero(),
    { enemies: [mob("a", 450), mob("b", 480), mob("c", 520)] },
    10,
    ctx(),
  );
  assert.equal(crowd.skill, 3, "three in reach: area skill");
  const boss = autoBrain(
    hero(),
    { enemies: [mob("a", 480, { boss: true, hp: 900, maxHp: 900 })] },
    10,
    ctx(),
  );
  assert.equal(boss.skill, 3);
  const dry = autoBrain(
    hero({ mp: 0 }),
    { enemies: [mob("a", 450), mob("b", 480), mob("c", 520)] },
    10,
    ctx(),
  );
  assert.equal(dry.skill, 0, "no MP: falls back to basic attacks");
});

test("ranged heroes keep distance and back off when a monster is on them", () => {
  const far = autoBrain(hero(), { enemies: [mob("a", 600)] }, 10, ctx(410));
  assert.equal(far.input, 0, "already in bow range: hold and shoot");
  assert.notEqual(far.skill, null);
  const close = autoBrain(hero(), { enemies: [mob("a", 440)] }, 10, ctx(410));
  assert.equal(close.input, -1);
});

test("auto hops out of a landing crystal or boss slam", () => {
  const i = {
    enemies: [mob("a", 900)],
    hazards: [{ x: 410, radius: 110, impactAt: 10.3, resolved: false }],
  };
  assert.equal(autoBrain(hero(), i, 10, ctx()).jump, true);
  i.hazards[0].impactAt = 11.2; // plenty of time: walk out instead
  const walk = autoBrain(hero(), i, 10, ctx());
  assert.equal(walk.jump, false);
  assert.equal(walk.input, -1);
});

test('auto uses the whole-map ultimate on a boss or crowd, respecting MP and cooldown', () => {
  const enemies = [mob('boss', 700, { boss: true })];
  assert.equal(autoBrain(hero({ class: 'swordsman' }), { enemies }, 100, ctx()).skill, 5);
  assert.notEqual(autoBrain(hero({ class: 'swordsman', mp: 49 }), { enemies }, 100, ctx()).skill, 5);
  assert.notEqual(autoBrain(hero({ class: 'swordsman', cooldowns: { 5: 90 } }), { enemies }, 100, ctx()).skill, 5);
  assert.equal(autoBrain(hero({ class: 'swordsman' }), { enemies: [mob('far', 1800, { boss: true })] }, 100, ctx()).skill, 5);
  assert.notEqual(autoBrain(hero({ class: 'swordsman' }), { enemies: [mob('a', 1800), mob('b', 1900)] }, 100, ctx()).skill, 5);
});

test('auto escapes danger instead of casting, even with no enemies left', () => {
  const p = hero({ class: 'swordsman' });
  const i = { enemies: [mob('boss', 450, { boss: true })], hazards: [{ x: 400, radius: 100, impactAt: 100.2 }] };
  const plan = autoBrain(p, i, 100, ctx());
  assert.equal(plan.evade, true);
  assert.equal(plan.skill, null);
  i.enemies = [];
  assert.equal(autoBrain(p, i, 100, ctx()).jump, true);
});
