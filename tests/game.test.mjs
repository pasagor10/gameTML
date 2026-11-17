import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-engine-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, persist, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { damage, WORLD, combatStats, maxHp } =
  await import("../shared/config.js");
function create(id, job = "swordsman") {
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(id, id, null, Date.now());
  const state = {
    class: job,
    gender: "male",
    gold: 120,
    inventory: { hp: 5, mp: 3, ore: 3 },
    upgrade: 0,
    armor: false,
    weapon: false,
    level: 1,
    exp: 0,
    unlocked: 1,
    quest: 0,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(
    id,
    id,
    id,
    JSON.stringify(state),
  );
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}
test("damage is bounded, authoritative input ignores client gold and enforces cooldown", () => {
  assert.equal(damage(20, 100), 10);
  const p = create("combat");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance);
  i.enemies.forEach((e) => {
    e.x = p.x + 30;
  });
  const t = Date.now() / 1000;
  const before = i.enemies[0].hp;
  world.attack(p, 0, t);
  assert.equal(i.enemies[0].hp, before, "windup must not damage immediately");
  world.tick(0.05, t + 0.17);
  const hp = i.enemies[0].hp;
  world.attack(p, 0, t + 0.18);
  world.tick(0.05, t + 0.2);
  assert.equal(i.enemies[0].hp, hp, "recovery prevents an extra hit");
  assert.ok(hp < i.enemies[0].maxHp);
});
test("NPC purchases and enhancement are idempotent, stock sale atomic, no negative gold", () => {
  const a = create("seller"),
    b = create("buyer"),
    c = create("buyer2");
  world.buyNpc(a, "hp", "request-buy-01");
  world.buyNpc(a, "hp", "request-buy-01");
  assert.equal(a.inventory.hp, 6);
  assert.equal(a.gold, 105);
  world.enhance(a, "request-upgrade-01");
  world.enhance(a, "request-upgrade-01");
  assert.equal(a.upgrade, 1);
  assert.equal(a.inventory.ore, 2);
  const shop = world.createShop(a, {
    name: "Test",
    item: "ore",
    qty: 1,
    price: 20,
    key: "request-shop-01",
  });
  world.buyShop(b, { id: shop.id, key: "request-sale-01" });
  world.buyShop(b, { id: shop.id, key: "request-sale-01" });
  assert.equal(b.inventory.ore, 4);
  assert.throws(() =>
    world.buyShop(c, { id: shop.id, key: "request-sale-02" }),
  );
  assert.equal(b.gold, 100);
  assert.equal(c.gold, 120);
  assert.equal(a.gold, 95);
  world.closeShop(a, "request-close-01");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM shops").get().n, 0);
});
test("trade requires consent, revision reset, both confirmations and atomic transfers", () => {
  const a = create("trade-a"),
    b = create("trade-b");
  world.tradeAction(a, { action: "request", target: b.id });
  const t = [...world.trades.values()].find((t) => t.members.includes(a.id));
  assert.throws(() =>
    world.tradeAction(a, { action: "confirm", id: t.id, revision: 0 }),
  );
  world.tradeAction(b, { action: "accept", id: t.id });
  world.tradeAction(a, {
    action: "offer",
    id: t.id,
    gold: 10,
    item: "ore",
    qty: 1,
  });
  world.tradeAction(a, { action: "confirm", id: t.id, revision: t.revision });
  world.tradeAction(b, {
    action: "offer",
    id: t.id,
    gold: 5,
    item: "hp",
    qty: 1,
  });
  assert.equal(t.confirmed.length, 0);
  assert.throws(() =>
    world.tradeAction(a, { action: "confirm", id: t.id, revision: 1 }),
  );
  for (const p of [a, b])
    world.tradeAction(p, { action: "confirm", id: t.id, revision: t.revision });
  for (const p of [a, b])
    world.tradeAction(p, { action: "final", id: t.id, revision: t.revision });
  assert.equal(a.gold, 115);
  assert.equal(b.gold, 125);
  assert.equal(a.inventory.ore, 2);
  assert.equal(b.inventory.ore, 4);
  assert.equal(a.inventory.hp, 6);
  assert.equal(b.inventory.hp, 4);
  assert.equal(world.trades.has(t.id), false);
});
test("all classes clear 9 configured stages, unlocks persist and duplicate rewards prevented", () => {
  for (const job of ["swordsman", "archer", "mage"]) {
    const p = create("clear-" + job, job);
    for (let floor = 1; floor <= 3; floor++) {
      world.beginDungeon(p, floor);
      const i = world.instances.get(p.instance);
      for (let stage = 1; stage <= 3; stage++) {
        assert.equal(i.stage, stage);
        i.enemies.forEach((e) => {
          e.x = p.x + 30;
          e.hp = 1;
        });
        for (let n = 0; i.enemies.length && n < 20; n++) {
          p.cooldowns = {};
          p.mp = 999;
          const t = Date.now() / 1000 + 100 + n * 2;
          p.action = null;
          p.pending = null;
          world.attack(p, 3, t);
          world.tick(0.05, t + 0.43);
        }
        assert.equal(i.enemies.length, 0);
        assert.equal(i.clear, true);
        const gold = p.gold;
        p.cooldowns = {};
        p.action = null;
        p.pending = null;
        world.attack(p, 3, Date.now() / 1000 + 200);
        world.tick(0.05, Date.now() / 1000 + 201);
        assert.equal(p.gold, gold);
        if (stage < 3) world.nextStage(p);
      }
      world.returnTown(p);
    }
    assert.equal(p.quest, 3);
    assert.equal(
      p.ownedEquipment.filter((id) => id === "cavern_charm").length,
      1,
    );
    assert.ok(loadCharacter(p.id).ownedEquipment.includes("cavern_charm"));
    assert.equal(loadCharacter(p.id).quest, 3);
  }
});
test("party requires readiness, is capped at three, shares instances, movement and jump collide", () => {
  const a = create("party-a"),
    b = create("party-b"),
    c = create("party-c"),
    d = create("party-d");
  world.partyAction(a, { action: "create" });
  for (const p of [b, c])
    world.partyAction(p, { action: "join", target: a.party });
  assert.throws(() =>
    world.partyAction(d, { action: "join", target: a.party }),
  );
  assert.throws(() => world.beginDungeon(a, 1));
  for (const p of [b, c]) world.partyAction(p, { action: "ready" });
  world.beginDungeon(a, 1);
  assert.equal(a.instance, b.instance);
  assert.equal(b.instance, c.instance);
  world.returnTown(a);
  a.x = 100;
  a.y = WORLD.ground;
  a.jump = true;
  world.tick(0.05);
  assert.ok(a.y < 600);
  for (let n = 0; n < 100; n++) world.tick(0.05);
  assert.equal(a.y, 600);
  world.disconnect(b);
  assert.equal(b.auto, false);
  assert.equal(world.trades.size, 0);
});
test("training telegraphs can be dodged, hits can kill, and practice kills do not award currency", () => {
  const p = create("training-motion");
  world.beginTraining(p);
  const i = world.instances.get(p.instance),
    e = i.enemies[0],
    t = Date.now() / 1000 + 10;
  e.x = p.x + 50;
  e.attackAt = 0;
  world.tick(0.05, t);
  assert.ok(e.action);
  assert.equal(p.hp, 180);
  p.x = 100;
  world.tick(0.05, t + 0.43);
  assert.equal(p.hp, 180, "leaving the telegraph avoids impact");
  world.tick(0.05, t + 0.8);
  p.x = e.x - 50;
  world.tick(0.05, t + 2);
  p.hp = 1;
  world.tick(0.05, t + 2.43);
  assert.equal(p.hp, 0);
  assert.ok(p.diedAt);
  assert.equal(p.pending, null);
  world.returnTown(p);
  world.beginTraining(p);
  const practice = world.instances.get(p.instance),
    slime = practice.enemies[0];
  slime.x = p.x + 40;
  slime.hp = 1;
  const gold = p.gold,
    experience = p.exp,
    quest = p.quest;
  world.attack(p, 0, t + 5);
  world.tick(0.05, t + 5.17);
  assert.equal(practice.clear, true);
  assert.equal(p.gold, gold);
  assert.equal(p.exp, experience);
  assert.equal(p.quest, quest);
  world.tick(0.05, t + 8);
  assert.equal(practice.enemies.length, 1);
  assert.equal(practice.enemies[0].hp, 180);
  const packet = world.snapshot(p);
  assert.equal(packet.dungeon.training, true);
  assert.equal(typeof packet.self.grounded, "boolean");
});
test("animation state prioritizes death/hit and matches the shared impact timeline", async () => {
  const { heroPose, slimePose } = await import("../shared/motion.js");
  const p = {
    hp: 100,
    grounded: true,
    moving: false,
    action: { skill: 0, startedAt: 10, impactAt: 10.16, endsAt: 10.44 },
  };
  assert.equal(heroPose(p, 10.05).state, "attack");
  assert.ok(heroPose(p, 10.17).frame >= 2);
  assert.equal(
    heroPose({ ...p, action: null, grounded: false, vy: -400 }, 11).state,
    "jump",
  );
  assert.equal(heroPose({ ...p, hp: 0, diedAt: 10 }, 11).state, "death");
  assert.equal(heroPose({ ...p, hitAt: 10.1 }, 10.2).state, "hit");
  assert.equal(slimePose({ hp: 50, moving: true }, 10).state, "move");
  assert.equal(slimePose({ hp: 0, diedAt: 10 }, 11).frame, 3);
});
test("jump clears and lands on a platform, with a bounded ledge grace period", () => {
  const p = create("platform-motion"),
    t = Date.now() / 1000 + 500;
  p.x = WORLD.platforms[0].x + WORLD.platforms[0].w / 2;
  p.jump = true;
  for (let n = 0; n < 25; n++) world.tick(0.05, t + n * 0.05);
  assert.equal(p.y, WORLD.platforms[0].y);
  assert.equal(p.grounded, true);
  p.x = 820;
  p.y = 460;
  p.grounded = false;
  p.vy = 0;
  p.lastGroundAt = t + 2;
  p.jump = true;
  world.tick(0.05, t + 2.08);
  assert.ok(p.vy < 0, "short ledge grace should allow a jump");
  p.x = 820;
  p.y = 460;
  p.grounded = false;
  p.vy = 0;
  p.lastGroundAt = t + 3;
  p.jump = true;
  world.tick(0.05, t + 3.2);
  assert.ok(p.vy > 0, "expired ledge grace must not allow an air jump");
});
test("every town terrace is reachable from the ground or a connected lower terrace", () => {
  const t = Date.now() / 1000 + 900;
  for (const [n, platform] of WORLD.platforms.entries()) {
    const lower =
      platform.tier === 1
        ? null
        : WORLD.platforms.find(
            (q) =>
              q.tier === platform.tier - 1 &&
              Math.min(q.x + q.w, platform.x + platform.w) -
                Math.max(q.x, platform.x) >
                40,
          );
    assert.ok(platform.tier === 1 || lower, `connected lower tier for ${n}`);
    const p = create("reach-" + n);
    p.x = lower
      ? (Math.max(lower.x, platform.x) +
          Math.min(lower.x + lower.w, platform.x + platform.w)) /
        2
      : platform.x + platform.w / 2;
    p.y = lower?.y ?? WORLD.ground;
    p.vy = 0;
    p.grounded = true;
    p.jump = true;
    for (let k = 0; k < 30; k++) world.tick(0.05, t + n * 5 + k * 0.05);
    assert.equal(p.y, platform.y, `terrace ${n} at y=${platform.y}`);
    assert.equal(p.grounded, true);
    world.players.delete(p.id);
  }
});
test("dungeons retain their own reachable platforms", () => {
  const t = Date.now() / 1000 + 1000;
  for (const [n, platform] of WORLD.dungeonPlatforms.entries()) {
    const p = create("cave-reach-" + n);
    world.beginDungeon(p, 1);
    world.instances.get(p.instance).enemies.forEach((e) => {
      e.x = 2300;
    });
    p.x = platform.x + platform.w / 2;
    p.jump = true;
    for (let k = 0; k < 25; k++) world.tick(0.05, t + n * 5 + k * 0.05);
    assert.equal(p.y, platform.y);
    world.players.delete(p.id);
  }
});
test("one attack emits exactly one attack event, facing the windup direction", () => {
  const p = create("single-event"),
    t = Date.now() / 1000 + 1200;
  world.beginTraining(p);
  const i = world.instances.get(p.instance);
  i.enemies[0].x = p.x + 40;
  p.direction = 1;
  world.attack(p, 0, t);
  p.direction = -1;
  world.tick(0.05, t + 0.17);
  const attacks = i.events.filter(
    (e) => e.kind === "attack" && e.actorId === p.id,
  );
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].direction, 1);
  assert.ok(attacks.every((e) => e.range));
  world.returnTown(p);
});
test("snapshot shop list is cached and refreshed after shop actions", () => {
  const owner = create("cache-owner");
  const before = world.snapshot(owner).shops;
  assert.equal(world.snapshot(owner).shops, before, "reused between ticks");
  world.createShop(owner, {
    name: "แคช",
    item: "hp",
    price: 10,
    qty: 2,
    key: "cache-shop-0001",
  });
  const after = world.snapshot(owner).shops;
  assert.notEqual(after, before);
  assert.ok(after.some((s) => s.owner === owner.id && s.qty === 2));
  world.closeShop(owner, "cache-shop-close1");
  assert.ok(!world.snapshot(owner).shops.some((s) => s.owner === owner.id));
});
test("crystal traps warn, can be jumped or escaped, and only damage once", () => {
  const p = create("crystal-dodge");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 2000;
  i.enemies.forEach((e) => {
    e.x = 2300;
  });
  i.nextHazardAt = t;
  world.tick(0.05, t);
  const h = i.hazards[0],
    hp = p.hp;
  assert.ok(h.impactAt > t + 1, "visible warning before impact");
  assert.equal(p.hp, hp);
  p.x = h.x;
  p.y = 460;
  p.vy = 0;
  p.grounded = false;
  world.tick(0.05, h.impactAt);
  assert.equal(p.hp, hp, "jump clears eruption");
  world.tick(0.05, h.endsAt + 0.1);
  i.nextHazardAt = t + 2;
  world.tick(0.05, t + 2);
  const hit = i.hazards[0];
  p.x = hit.x;
  p.y = 600;
  p.vy = 0;
  world.tick(0.05, hit.impactAt);
  assert.ok(p.hp < hp, "standing in the warning is dangerous");
  const after = p.hp;
  world.tick(0.05, hit.impactAt + 0.1);
  assert.equal(p.hp, after, "one eruption cannot hit repeatedly");
  world.tick(0.05, hit.endsAt + 0.1);
  i.nextHazardAt = t + 4;
  world.tick(0.05, t + 4);
  const escaped = i.hazards[0];
  p.x = escaped.x + escaped.radius + 30;
  world.tick(0.05, escaped.impactAt);
  assert.equal(p.hp, after, "walking outside the circle dodges it");
  world.returnTown(p);
});
test("boss slam locks its aim, supports jump dodges, and accelerates below half health", () => {
  const p = create("boss-slam");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 2200;
  i.stage = 2;
  i.clear = true;
  world.nextStage(p);
  const boss = i.enemies[0];
  i.nextHazardAt = Infinity;
  p.x = boss.x - 200;
  world.tick(0.05, t);
  assert.equal(boss.action.kind, "slam");
  assert.equal(boss.action.x, p.x);
  assert.ok(boss.action.impactAt - t >= 0.9);
  const aim = boss.action.x,
    hp = p.hp;
  p.x = aim + boss.action.radius + 30;
  world.tick(0.05, t + 0.96);
  assert.equal(p.hp, hp, "leaving captured aim avoids damage");
  world.tick(0.05, t + 1.4);
  boss.attackCount = 0;
  boss.attackAt = 0;
  p.x = boss.x - 200;
  world.tick(0.05, t + 2);
  p.y = 455;
  p.vy = 0;
  p.grounded = false;
  world.tick(0.05, t + 2.96);
  assert.equal(p.hp, hp, "jumping avoids boss ground slam");
  boss.action = null;
  boss.hp = boss.maxHp / 2;
  boss.attackCount = 0;
  boss.attackAt = t + 3;
  p.x = boss.x - 200;
  world.tick(0.05, t + 4.1);
  assert.equal(boss.action.radius, 195, "enraged slam covers more ground");
  world.returnTown(p);
});
test("consecutive kills award bonus gold and MP, resetting after the window", () => {
  const p = create("kill-streak", "mage");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 2400;
  i.nextHazardAt = Infinity;
  i.enemies.forEach((e, n) => {
    e.x = 2000 + n * 20;
    e.hp = 1;
  });
  const gold = p.gold;
  for (let n = 0; n < 2; n++) {
    const e = i.enemies[0];
    e.x = p.x + 30;
    p.direction = 1;
    p.action = null;
    p.pending = null;
    p.cooldowns = {};
    world.attack(p, 0, t + n);
    world.tick(0.05, t + n + 0.17);
  }
  assert.equal(i.streak, 2);
  assert.equal(p.gold - gold, 23, "two base rewards plus second-kill bonus");
  assert.equal(i.events.find((e) => e.kind === "streak").bonus, 3);
  assert.equal(world.snapshot(p).dungeon.defeated, 2);
  const e = i.enemies[0];
  e.x = p.x + 30;
  p.action = null;
  p.pending = null;
  p.cooldowns = {};
  world.attack(p, 0, t + 8);
  world.tick(0.05, t + 8.17);
  assert.equal(i.streak, 1, "expired streak starts over");
  world.returnTown(p);
});
test("old saves retain purchased gear, upgrades, currency and bonuses during migration", () => {
  const p = create("rpg-legacy-save");
  const raw = JSON.parse(
    db.prepare("SELECT state FROM characters WHERE id=?").get(p.id).state,
  );
  raw.weapon = true;
  raw.armor = true;
  raw.upgrade = 2;
  db.prepare("UPDATE characters SET state=? WHERE id=?").run(
    JSON.stringify(raw),
    p.id,
  );
  const saved = loadCharacter(p.id);
  assert.equal(saved.equipment.weapon, "guardian_weapon");
  assert.equal(saved.equipment.armor, "traveler_armor");
  assert.equal(saved.gold, 120);
  assert.equal(combatStats(saved).atk, 25 + 16 + 10);
  assert.equal(combatStats(saved).def, 25);
  assert.equal(maxHp(saved), 210);
});
test("legacy equipment migrates; explicit gear changes stats and persists without duplicate charges", () => {
  const p = create("rpg-equipment");
  assert.ok(p.ownedEquipment.includes("starter_swordsman"));
  assert.equal(p.equipment.weapon, "starter_swordsman");
  p.gold = 1000;
  p.level = 5;
  world.savePlayer(p);
  const before = combatStats(p);
  world.buyEquipment(p, "moon_blade", "rpg-buy-weapon-01");
  world.buyEquipment(p, "moon_blade", "rpg-buy-weapon-01");
  assert.equal(p.gold, 780);
  assert.equal(
    p.equipment.weapon,
    "starter_swordsman",
    "purchase does not silently equip",
  );
  world.equip(p, "weapon", "moon_blade");
  assert.equal(combatStats(p).atk, before.atk + 22);
  assert.equal(combatStats(p).def, before.def + 3);
  world.buyEquipment(p, "crystal_charm", "rpg-buy-charm-01");
  world.equip(p, "charm", "crystal_charm");
  assert.equal(combatStats(p).mp, before.mp + 25);
  assert.throws(() => world.equip(p, "armor", "moon_blade"));
  assert.throws(() => world.equip(p, "boots", "wind_boots"));
  world.buyEquipment(p, "star_staff", "rpg-foreign-class");
  assert.throws(() => world.equip(p, "weapon", "star_staff"));
  const restored = loadCharacter(p.id);
  assert.equal(restored.equipment.weapon, "moon_blade");
  assert.equal(restored.equipment.charm, "crystal_charm");
  world.equip(p, "weapon", null);
  assert.equal(combatStats(p).atk, before.atk + 3);
  p.level = 1;
  assert.throws(() => world.equip(p, "weapon", "moon_blade"));
});
test("specializations validate class and level, update combat stats and clamp health on switching", () => {
  const p = create("rpg-specialization");
  assert.throws(() => world.specialize(p, "guardian"));
  p.level = 3;
  assert.throws(() => world.specialize(p, "ranger"));
  const before = combatStats(p);
  world.specialize(p, "guardian");
  assert.equal(maxHp(p), before.hp + 35);
  assert.equal(combatStats(p).def, before.def + 5);
  p.hp = maxHp(p);
  world.specialize(p, "duelist");
  assert.equal(p.hp, maxHp(p), "switching cannot retain HP above the new cap");
  assert.equal(combatStats(p).atk, before.atk + 7);
  assert.equal(loadCharacter(p.id).specialization, "duelist");
  world.beginDungeon(p, 1);
  assert.throws(() => world.specialize(p, "guardian"));
  assert.throws(() => world.equip(p, "weapon", null));
  world.returnTown(p);
});
test("WAL-safe backup opens independently with intact character state", async () => {
  const Database = (await import("better-sqlite3")).default;
  const file = path.join(dir, "verified-backup.sqlite");
  await db.backup(file);
  const restored = new Database(file, { readonly: true });
  assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
  assert.equal(
    restored.prepare("SELECT name FROM characters WHERE id=?").get("clear-mage")
      .name,
    "clear-mage",
  );
  restored.close();
});
process.on("exit", () => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
