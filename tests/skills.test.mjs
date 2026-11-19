import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-skills-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { SKILL_KITS, STATUSES, BUFFS, applyStatus, BOSS_CONTROL } = await import(
  "../shared/skills.js"
);
const { ACTIONS } = await import("../shared/motion.js");
const { CLASS_SKILLS } = await import("../shared/rpg.js");

function create(id, extra = {}) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = {
    class: "mage", gender: "male", gold: 100, inventory: { hp: 5, mp: 3, ore: 0 },
    upgrade: 0, armor: false, weapon: false, level: 20, exp: 0, unlocked: 3, quest: 2,
    ...extra,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}
// A dungeon with one sturdy monster right in front of the hero.
function arena(p, extra = {}) {
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance);
  i.nextHazardAt = Infinity;
  i.enemies = i.enemies.slice(0, 1);
  const e = Object.assign(i.enemies[0], {
    hp: 100000, maxHp: 100000, x: p.x + 60, y: p.y, aggro: true, boss: false,
    ...extra,
  });
  p.direction = 1;
  p.mp = 999;
  return { i, e };
}
function cast(p, skill, t) {
  p.action = null;
  p.pending = null;
  p.cooldowns = {};
  world.attack(p, skill, t);
  world.tick(0.02, t + ACTIONS[skill].windup + 0.01);
}

test("every class has three attack skills and a party buff, with distinct statuses", () => {
  for (const [cls, kit] of Object.entries(SKILL_KITS)) {
    assert.equal(kit.length, 6, cls);
    assert.ok(kit[5].hits > 0 && kit[5].power > 0, cls);
    assert.equal(CLASS_SKILLS[cls].length, 4);
    for (const s of kit.slice(1, 4)) {
      assert.ok(s.hits >= 2, `${cls} ${s.name} hits several times`);
      // Each attack skill leaves a status or heals the party.
      assert.ok(s.heal > 0 || STATUSES[s.status?.type], `${cls} ${s.name}`);
    }
    assert.ok(BUFFS[kit[4].buff]);
  }
  assert.equal(ACTIONS.length, 6);
  assert.equal(ACTIONS[5].cooldown, 45);
  assert.equal(ACTIONS[5].mp, 50);
});

test("a multi-hit skill sends one stacked line per strike", () => {
  const p = create("multi");
  const { i, e } = arena(p);
  const t = Date.now() / 1000 + 50;
  cast(p, 3, t);
  const hit = i.events.find((x) => x.kind === "damage" && x.targetId === e.id);
  assert.equal(hit.lines.length, SKILL_KITS.mage[3].hits);
  assert.equal(hit.amount, hit.lines.reduce((n, l) => n + l.amount, 0));
  assert.equal(e.hp, 100000 - hit.amount);
  world.returnTown(p);
});

test("burn ticks every second and can finish a monster", () => {
  const p = create("burn");
  const { i, e } = arena(p);
  const t = Date.now() / 1000 + 50;
  cast(p, 2, t); // fire blast always burns
  assert.ok(e.status.burn);
  const dps = e.status.burn.dps;
  assert.ok(dps > 0);
  e.hp = dps; // one tick from death
  world.tick(0.02, e.status.burn.tickAt + 0.01);
  const tick = i.events.find((x) => x.tick && x.status === "burn");
  assert.equal(tick.amount, dps);
  assert.equal(i.enemies.length, 0, "the burn finished it");
  assert.ok(i.clear);
  world.returnTown(p);
});

test("freeze and stun stop a monster in place; bosses shake it off sooner", () => {
  const p = create("freeze");
  const { i, e } = arena(p);
  const t = Date.now() / 1000 + 50;
  applyStatus(e, { type: "freeze", chance: 1, duration: 2 }, 10, t, 0);
  e.x = p.x + 300;
  const x = e.x;
  world.tick(0.1, t + 0.1);
  assert.equal(e.x, x, "frozen monsters don't move");
  assert.equal(e.action, null);
  const boss = { boss: true };
  applyStatus(boss, { type: "stun", chance: 1, duration: 2 }, 10, t, 0);
  assert.ok(Math.abs(boss.status.stun.until - (t + 2 * BOSS_CONTROL)) < 1e-9);
  world.returnTown(p);
});

test("poison stacks up to three times", () => {
  const e = {};
  const s = { type: "poison", chance: 1, duration: 5 };
  for (let n = 0; n < 5; n++) applyStatus(e, s, 100, 10, 0);
  assert.equal(e.status.poison.stacks, STATUSES.poison.stacks);
});

test("weaken makes the monster take more damage", () => {
  const p = create("weaken", { class: "swordsman" });
  const { i, e } = arena(p);
  const t = Date.now() / 1000 + 50;
  const orig = Math.random;
  Math.random = () => 0.99; // no crits, no proc rolls
  try {
    cast(p, 0, t);
    const plain = i.events.filter((x) => x.kind === "damage").at(-1).amount;
    applyStatus(e, { type: "weaken", chance: 1, duration: 6 }, 1, t + 1, 0);
    cast(p, 0, t + 1);
    const weak = i.events.filter((x) => x.kind === "damage").at(-1).amount;
    assert.ok(weak > plain, `${weak} > ${plain}`);
  } finally {
    Math.random = orig;
  }
  world.returnTown(p);
});

test("the buff skill puts a timed buff on the party and shows in the snapshot", () => {
  const p = create("buffer");
  const { i } = arena(p);
  const t = Date.now() / 1000 + 50;
  cast(p, 4, t);
  assert.ok(p.buffs.barrier.until > t);
  assert.ok(i.events.some((x) => x.kind === "buff" && x.buff === "barrier"));
  assert.ok(world.snapshot(p).self.buffs.barrier);
  world.returnTown(p);
});

test("a stunned hero can't swing", () => {
  const p = create("stunned", { class: "archer" });
  const { e } = arena(p);
  const t = Date.now() / 1000 + 50;
  applyStatus(p, { type: "stun", chance: 1, duration: 1 }, 10, t, 0);
  p.cooldowns = {};
  world.attack(p, 0, t + 0.1);
  assert.equal(p.pending, null);
  world.attack(p, 0, t + 1.2);
  assert.ok(p.pending, "free again after the stun");
  void e;
  world.returnTown(p);
});

test("priest heals the whole party and blessing regenerates", () => {
  const p = create("priest", { class: "priest" });
  const { i } = arena(p);
  const t = Date.now() / 1000 + 80;
  p.hp = 10;
  cast(p, 2, t);
  const heal = i.events.find((x) => x.kind === "heal" && x.targetId === p.id);
  assert.ok(heal && heal.amount > 0, "skill 2 heals");
  assert.equal(p.hp, 10 + heal.amount);
  cast(p, 4, t + 2);
  assert.ok(p.buffs.blessing);
  const before = p.hp;
  world.tick(0.02, t + 3);
  assert.ok(p.hp > before, "blessing regen ticks");
  world.returnTown(p);
});
