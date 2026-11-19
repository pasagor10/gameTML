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

test("weapon lifesteal uses real damage, caps at max HP and needs equipped weapon", async () => {
  const { maxHp } = await import("../shared/config.js");
  const p = create("weapon-drain");
  const { i, e } = arena(p);
  p.equipment.weapon = "rescue_1_mage";
  p.hp = 10;
  world.applyWeaponHit(p, e, 100, 100, 10, i, 0);
  assert.equal(p.hp, 18);
  p.hp = maxHp(p) - 1;
  world.applyWeaponHit(p, e, 1000, 1000, 11, i, 0);
  assert.equal(p.hp, maxHp(p));
  p.equipment.weapon = "starter_mage";
  p.hp = 10;
  world.applyWeaponHit(p, e, 100, 100, 12, i, 0);
  assert.equal(p.hp, 10);
  world.returnTown(p);
});

test("weapon poison and fire coexist; freeze lasts 3s with cooldown and boss resistance", () => {
  const p = create("weapon-procs");
  const { i, e } = arena(p);
  for (const [tier, type] of [[2, "poison"], [3, "burn"], [4, "freeze"]]) {
    p.equipment.weapon = `rescue_${tier}_mage`;
    assert.equal(world.applyWeaponHit(p, e, 100, 100, 10, i, 0), type);
    assert.equal(e.status[type].by, p.id);
  }
  assert.equal(e.status.freeze.until, 13);
  assert.ok(e.status.poison && e.status.burn);
  assert.equal(world.applyWeaponHit(p, e, 100, 100, 14, i, 0), null);
  assert.equal(world.applyWeaponHit(p, e, 100, 100, 18, i, 0), "freeze");
  const boss = { boss: true, hp: 1000 };
  world.applyWeaponHit(p, boss, 100, 100, 20, i, 0);
  assert.equal(boss.status.freeze.until, 20 + 3 * BOSS_CONTROL);
  assert.equal(world.applyWeaponHit(p, { hp: 0 }, 100, 100, 30, i, 0), null);
  world.returnTown(p);
});

test("normal attacks trigger weapon effects through authoritative combat", () => {
  const p = create("weapon-combat", { class: "swordsman" });
  const { i, e } = arena(p);
  p.equipment.weapon = "rescue_4_swordsman";
  const orig = Math.random;
  Math.random = () => 0.01;
  try { cast(p, 0, Date.now() / 1000 + 50); }
  finally { Math.random = orig; }
  assert.ok(e.status.freeze);
  assert.ok(i.events.some(x => x.kind === "damage" && x.status === "freeze"));
  assert.ok(world.snapshot(p).dungeon.enemies.some(x => x.status?.freeze));
  world.returnTown(p);
});

test("all four class buffs reach every living party member, stack and exclude strangers", () => {
  const caster = create("party-buffer");
  const ally = create("party-ally");
  const stranger = create("party-stranger");
  const dead = create("party-dead");
  const { i } = arena(caster);
  for (const p of [ally, stranger, dead]) {
    p.instance = i.id; p.area = "dungeon"; i.members.push(p.id);
    p.x = caster.x; p.y = caster.y;
  }
  dead.hp = 0;
  caster.party = ally.party = dead.party = "effect-test-party";
  world.parties.set(caster.party, { id: caster.party, leader: caster.id,
    members: [caster.id, ally.id, dead.id], ready: new Set() });
  const t = Date.now() / 1000 + 50;
  for (const [n, cls] of ["swordsman", "archer", "mage", "priest"].entries()) {
    caster.class = cls; caster.mp = 999;
    cast(caster, 4, t + n * 0.2);
    const buff = SKILL_KITS[cls][4].buff;
    assert.ok(caster.buffs[buff]);
    assert.ok(ally.buffs[buff]);
    assert.equal(ally.buffs[buff].by, caster.id);
    assert.ok(!stranger.buffs?.[buff]);
    assert.ok(!dead.buffs?.[buff]);
  }
  assert.equal(Object.keys(ally.buffs).length, 4);
  assert.ok(world.snapshot(caster).party.members.find(m => m.id === ally.id).buffs.blessing);
  const before = ally.hp;
  ally.hp = 10;
  world.tick(0.02, t + 2);
  assert.ok(ally.hp > 10 && ally.hp <= before);
  for (const p of [caster, ally, stranger, dead]) world.returnTown(p);
  world.parties.delete("effect-test-party");
});

test("a frozen hero cannot move, jump or resolve a queued attack until thawed", () => {
  const p = create("frozen-hero");
  arena(p);
  const t = Date.now() / 1000 + 50;
  p.input = 1; p.jump = true; p.lastInput = t; p.vx = 200;
  applyStatus(p, { type: "freeze", chance: 1, duration: 3 }, 10, t, 0);
  world.attack(p, 0, t + 0.1);
  assert.equal(p.pending, null);
  const x = p.x;
  world.tick(0.02, t + 0.2);
  assert.equal(p.x, x);
  assert.equal(p.input, 0);
  world.attack(p, 0, t + 3.1);
  assert.ok(p.pending);
  world.returnTown(p);
});

test("status HUD shows buff names, debuff stacks and remaining time", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../public/status-ui.js", import.meta.url), "utf8")
    .replace('"/shared/skills.js"', JSON.stringify(new URL("../shared/skills.js", import.meta.url).href));
  const ui = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const p = { buffs: { rage: { until: 22 } }, status: { poison: { until: 15, stacks: 3 }, freeze: { until: 9 } } };
  const markup = ui.effectsMarkup(p, 10);
  assert.match(markup, /บัฟ: ปลุกพลังนักรบ/);
  assert.match(markup, /ดีบัฟ: พิษ ×3/);
  assert.match(markup, /12s/);
  assert.match(markup, /5s/);
  assert.doesNotMatch(markup, /แช่แข็ง/);
  assert.equal(ui.effectsMarkup(p, 30), "");
});
