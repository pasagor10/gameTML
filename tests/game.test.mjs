import { dungeonPlatforms } from "../shared/dungeons.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-engine-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, persist, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { damage, WORLD, combatStats, combatPower, maxHp, DUNGEON_ENERGY_MAX, DUNGEON_ENERGY_INTERVAL } =
  await import("../shared/config.js");
const { FLOOR_LOOT } = await import("../shared/rpg.js");
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
    e.y = p.y;
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
test("boss loot guarantees a class weapon, avoids duplicates, and power reflects gear", () => {
  const p = create("loot-plan", "archer");
  const before = combatPower(combatStats(p));
  const first = world.rollBossLoot(p, 1, true, () => 0.99);
  assert.equal(first, FLOOR_LOOT[1].weapons.archer);
  p.ownedEquipment.push(first);
  p.equipment.weapon = first;
  const after = combatPower(combatStats(p));
  assert.ok(after > before);
  const repeat = world.rollBossLoot(p, 1, false, () => 0);
  assert.equal(repeat, FLOOR_LOOT[1].pool[0]);
  assert.equal(world.rollBossLoot(p, 1, false, () => 0.9), null);
  p.ownedEquipment.push(...FLOOR_LOOT[1].pool);
  assert.equal(
    world.rollBossLoot(p, 1, false, () => 0),
    null,
  );
  const legendary = world.rollBossLoot(p, 3, false, () => 0.01);
  assert.equal(legendary, "moonheart_talisman");
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
test("all classes clear 30 configured stages, unlocks persist and duplicate rewards prevented", () => {
  for (const job of ["swordsman", "archer", "mage"]) {
    const p = create("clear-" + job, job);
    for (let floor = 1; floor <= 10; floor++) {
      if (p.energy) p.energy.nextAt -= DUNGEON_ENERGY_INTERVAL;
      world.beginDungeon(p, floor);
      const i = world.instances.get(p.instance);
      for (let stage = 1; stage <= 3; stage++) {
        assert.equal(i.stage, stage);
        i.enemies.forEach((e) => {
          e.x = p.x + 30;
          e.y = p.y;
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
    assert.equal(p.quest, 10);
    assert.equal(
      p.ownedEquipment.filter((id) => id === "cavern_charm").length,
      1,
    );
    assert.ok(loadCharacter(p.id).ownedEquipment.includes("cavern_charm"));
    assert.equal(loadCharacter(p.id).quest, 10);
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
test("the town is walkable all the way to the dungeon portal", () => {
  const p = create("walk-to-portal"),
    t = Date.now() / 1000 + 700;
  p.x = 400;
  p.input = 1;
  p.running = true;
  for (let n = 0; n < 400 && p.x < WORLD.portal; n++) {
    p.input = 1;
    p.lastInput = t + n * 0.05; // a held key keeps sending input
    world.tick(0.05, t + n * 0.05);
  }
  assert.ok(WORLD.townWidth >= WORLD.portal + 140, "portal inside the town");
  assert.ok(p.x >= WORLD.portal, `reached x=${Math.round(p.x)}`);
  world.players.delete(p.id);
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
test("every dungeon floor spawns its monsters inside the arena", async () => {
  const p = create("spawn-bounds"),
    floors = (await import("../shared/config.js")).FLOORS.length;
  p.unlocked = floors;
  for (let floor = 1; floor <= floors; floor++) {
    if (p.energy) p.energy.nextAt -= DUNGEON_ENERGY_INTERVAL;
    world.beginDungeon(p, floor);
    const i = world.instances.get(p.instance);
    assert.equal(i.enemies.length, 8 + Math.min(floor, 12) * 2);
    for (const e of i.enemies)
      assert.ok(
        e.x >= 70 && e.x <= WORLD.width - 70,
        `floor ${floor}: monster at x=${e.x}`,
      );
    world.instances.delete(p.instance);
    p.area = "town";
    p.instance = null;
  }
  world.players.delete(p.id);
});
test("every dungeon ledge is reachable by short jumps up its stairs", () => {
  const t = Date.now() / 1000 + 1000;
  for (let floor = 1; floor <= 10; floor++) {
    const p = create("cave-reach-" + floor);
    p.unlocked = 10;
    world.beginDungeon(p, floor);
    const instance = world.instances.get(p.instance);
    instance.enemies = [];
    instance.nextHazardAt = Infinity;
    for (let stage = 1; stage <= 3; stage++) {
      instance.stage = stage;
      const platforms = dungeonPlatforms(floor, stage),
        reached = [{ x: 0, w: 2400, y: 600 }];
      // Climb outward from the ground: a surface counts once a hero standing
      // on an overlapping surface below can jump onto it.
      for (let grew = true; grew;) {
        grew = false;
        for (const platform of platforms) {
          if (reached.includes(platform)) continue;
          const froms = reached
            .filter(
              (r) =>
                r.y > platform.y &&
                Math.max(r.x, platform.x) + 6 <
                  Math.min(r.x + r.w, platform.x + platform.w) - 6,
            )
            .sort((a, b) => a.y - b.y);
          for (const from of froms) {
            p.x =
              (Math.max(from.x, platform.x) +
                Math.min(from.x + from.w, platform.x + platform.w)) /
              2;
            p.y = from.y;
            p.vy = 0;
            p.vx = 0;
            p.input = 0;
            p.grounded = true;
            p.jump = true;
            for (let k = 0; k < 30; k++) world.tick(0.05, t + k * 0.05);
            if (p.y === platform.y) {
              reached.push(platform);
              grew = true;
              break;
            }
          }
        }
      }
      for (const platform of platforms)
        assert.ok(
          reached.includes(platform),
          `floor ${floor} stage ${stage} ledge x=${platform.x} y=${platform.y}`,
        );
      // Jumps stay short: nothing far above the ground is reachable directly.
      assert.ok(Math.max(...platforms.map((q) => 600 - q.y)) > 167);
    }
    world.instances.delete(p.instance);
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
  i.enemies = [boss];
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
  assert.ok(boss.exposedUntil > t + 3);
  world.tick(0.05, t + 1.4);
  p.x = boss.x - 45;
  p.direction = 1;
  world.attack(p, 0, t + 1.4);
  world.tick(0.05, t + 1.57);
  const hit = i.events.find((e) => e.targetId === boss.id && e.actorId === p.id);
  assert.equal(hit.amount, Math.floor(damage(combatStats(p).atk, 5) * (hit.crit ? 1.5 : 1) * 1.5));
  assert.equal(boss.action, null, "boss cannot attack during the opening");
  boss.attackCount = 0;
  boss.attackAt = 0;
  p.x = boss.x - 200;
  world.tick(0.05, t + 3.6);
  assert.equal(boss.action.kind, "slam");
  p.y = 455;
  p.vy = 0;
  p.grounded = false;
  world.tick(0.05, t + 4.56);
  assert.equal(p.hp, hp, "jumping avoids boss ground slam");
  assert.ok(boss.exposedUntil > t + 6);
  boss.action = null;
  boss.hp = boss.maxHp / 2;
  boss.attackCount = 0;
  boss.attackAt = t + 6;
  p.y = WORLD.ground;
  p.x = boss.x - 200;
  world.tick(0.05, t + 7.1);
  assert.equal(boss.action.radius, 195, "enraged slam covers more ground");
  world.returnTown(p);
});
test("supplies and runes are optional, personal, range-checked, and reward only once", () => {
  const a = create("explorer"),
    b = create("exploring-ally");
  world.partyAction(a, { action: "create" });
  world.partyAction(b, { action: "join", target: a.party });
  world.partyAction(b, { action: "ready" });
  world.beginDungeon(a, 1);
  const i = world.instances.get(a.instance);
  const use = (p, sign, stage = i.stage) => world.useDungeonSign(p, {
    id: sign.id, instanceId: i.id, floor: i.floor, stage,
  });
  const moveTo = (p, { x, y }) => Object.assign(p, { x, y });
  const [supplies] = i.signs;
  i.stageAt -= world.STAGE_INTRO + 1;
  assert.throws(() => use(a, supplies), /เข้าใกล้/);
  moveTo(a, supplies);
  a.hp = 1;
  a.mp = 0;
  use(a, supplies);
  assert.ok(a.hp > 1 && a.mp > 0);
  assert.throws(() => use(a, supplies), /สำรวจจุดนี้แล้ว/);
  assert.equal(world.snapshot(b).dungeon.signs[0].collected, false);
  i.clear = true;
  world.nextStage(a);
  i.stageAt -= world.STAGE_INTRO + 1;
  const [first, second, last] = i.signs;
  const gold = a.gold,
    ore = a.inventory.ore;
  moveTo(a, first);
  assert.throws(() => use(a, first, 1), /เข้าใกล้/);
  a.auto = true;
  assert.throws(() => use(a, first), /เข้าใกล้/);
  a.auto = false;
  use(a, first);
  moveTo(a, second);
  use(a, second);
  assert.equal(a.gold, gold);
  moveTo(a, last);
  use(a, last);
  assert.throws(() => use(a, last), /สำรวจจุดนี้แล้ว/);
  assert.equal(a.gold, gold + 25);
  assert.equal(a.inventory.ore, ore + 1);
  assert.equal(loadCharacter(a.id).gold, gold + 25);
  assert.equal(i.rewards[a.id].gold, 25);
  assert.equal(i.rewards[b.id].gold, 0);
  assert.ok(world.snapshot(a).dungeon.signs.every((sign) => sign.collected));
  i.clear = true;
  world.nextStage(a);
  assert.equal(i.stage, 3, "ally can skip the optional exploration");
  world.returnTown(a);
  world.returnTown(b);
  for (const p of [a, b]) world.players.delete(p.id);
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
    e.y = p.y;
    p.direction = 1;
    p.action = null;
    p.pending = null;
    p.cooldowns = {};
    world.attack(p, 0, t + n);
    world.tick(0.05, t + n + 0.17);
  }
  assert.equal(i.streak, 2);
  assert.ok(
    i.events.some(
      (e) => e.kind === "drop" && e.item === "gold" && e.actorId === p.id,
    ),
  );
  assert.equal(p.gold - gold, 11, "two base rewards plus second-kill bonus");
  assert.equal(i.events.find((e) => e.kind === "streak").bonus, 1);
  assert.equal(world.snapshot(p).dungeon.defeated, 2);
  const e = i.enemies[0];
  e.x = p.x + 30;
  e.y = p.y;
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
test("all gear slots enhance independently and upgrades follow equipped slots", () => {
  const p = create("enhance-all");
  const gear = {
    armor: "traveler_armor",
    charm: "echo_charm",
    boots: "wingstep_boots",
  };
  p.gold = 250;
  p.level = 10;
  assert.throws(() => world.enhance(p, "forge-empty-slot", "armor"), /สวมอุปกรณ์/);
  for (const [slot, id] of Object.entries(gear)) {
    p.ownedEquipment.push(id);
    world.equip(p, slot, id);
  }
  const before = combatStats(p);
  for (const slot of Object.keys(gear)) {
    world.enhance(p, `forge-test-${slot}`, slot);
    world.enhance(p, `forge-test-${slot}`, slot);
  }
  const after = combatStats(p);
  assert.equal(p.upgrade, 0);
  assert.equal(after.hp, before.hp + 8);
  assert.equal(after.def, before.def + 3);
  assert.equal(after.atk, before.atk + 1);
  assert.equal(after.mp, before.mp + 4);
  assert.equal(after.speed, before.speed + 2);
  assert.equal(p.gold, 160);
  assert.deepEqual(loadCharacter(p.id).enhancements, { armor: 1, charm: 1, boots: 1 });
  world.equip(p, "armor", null);
  assert.equal(p.enhancements.armor, 1);
  assert.ok(combatStats(p).hp < before.hp);
  world.equip(p, "armor", gear.armor);
  assert.equal(combatStats(p).hp, after.hp);
  world.players.delete(p.id);
});
test("dungeon energy regenerates offline, charges once per floor, and checks the whole party", () => {
  const leader = create("energy-lead"),
    ally = create("energy-ally"),
    t = Date.now() / 1000;
  world.partyAction(leader, { action: "create" });
  world.partyAction(ally, { action: "join", target: leader.party });
  world.partyAction(ally, { action: "ready" });
  ally.energy = { points: 0, nextAt: t + 600 };
  world.savePlayer(ally);
  assert.throws(() => world.beginDungeon(leader, 1), /พลังงาน/);
  assert.equal(world.snapshot(leader).self.energy.points, DUNGEON_ENERGY_MAX);
  assert.equal(loadCharacter(leader.id).energy, undefined);
  world.beginTraining(ally);
  assert.equal(world.snapshot(ally).self.energy.points, 0);
  world.returnTown(ally);
  ally.energy.nextAt = t - DUNGEON_ENERGY_INTERVAL - 60;
  world.savePlayer(ally);
  const reloaded = world.makeRuntime(loadCharacter(ally.id), { emit() {} });
  assert.equal(world.snapshot(reloaded).self.energy.points, 2);
  world.beginDungeon(leader, 1);
  assert.equal(loadCharacter(leader.id).energy.points, DUNGEON_ENERGY_MAX - 1);
  assert.equal(loadCharacter(ally.id).energy.points, 1);
  const i = world.instances.get(leader.instance);
  i.clear = true;
  world.nextStage(leader);
  assert.equal(ally.energy.points, 1);
  i.stage = 3;
  i.clear = i.completed = true;
  i.results = {};
  ally.unlocked = leader.unlocked = 2;
  world.nextStage(leader);
  assert.equal(loadCharacter(ally.id).energy.points, 0);
  assert.equal(loadCharacter(leader.id).energy.points, DUNGEON_ENERGY_MAX - 2);
  for (const p of [leader, ally]) {
    world.returnTown(p);
    world.players.delete(p.id);
  }
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
test("dungeon monsters guard their spots until a hero comes near, and elites hit harder", () => {
  const p = create("guards");
  p.unlocked = 10;
  for (const floor of [1, 10]) {
    world.beginDungeon(p, floor);
    const i = world.instances.get(p.instance),
      t = Date.now() / 1000 + 50;
    for (let k = 0; k < 40; k++) world.tick(0.05, t + k * 0.05);
    const awake = i.enemies.filter((e) => e.aggro);
    assert.ok(
      awake.length < i.enemies.length / 2,
      `floor ${floor}: ${awake.length} awake`,
    );
    const far = i.enemies.filter((e) => !e.aggro);
    assert.ok(far.every((e) => Math.abs(e.x - e.homeX) < 80));
    if (floor === 10) {
      assert.ok(
        i.enemies.some((e) => e.elite && e.maxHp > 2 * (55 + 240 + 14)),
      );
      const sleeper = far.at(-1);
      sleeper.hp = sleeper.maxHp;
      p.x = sleeper.x - 60;
      p.y = sleeper.y;
      world.tick(0.05, t + 3);
      assert.equal(sleeper.aggro, true, "stepping close wakes the guard");
    }
    world.returnTown(p);
  }
  world.players.delete(p.id);
});
test("boss clear shows a floor summary and lets the hero go on to the next floor", () => {
  const p = create("summary");
  p.unlocked = 1;
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance);
  for (let stage = 1; stage <= 3; stage++) {
    i.enemies.forEach((e) => {
      e.x = p.x + 30;
      e.y = p.y;
      e.hp = 1;
    });
    for (let n = 0; i.enemies.length && n < 20; n++) {
      p.cooldowns = {};
      p.mp = 999;
      p.action = null;
      p.pending = null;
      const t = Date.now() / 1000 + 100 + stage * 50 + n * 2;
      world.attack(p, 3, t);
      world.tick(0.05, t + 0.43);
    }
    if (stage < 3) world.nextStage(p);
  }
  const r = world.snapshot(p).dungeon.result;
  assert.ok(r, "summary is ready after the boss");
  assert.equal(r.floor, 1);
  assert.ok(r.seconds >= 0 && r.score > 0 && r.gold > 0 && r.exp > 0);
  assert.ok(["SSS", "SS", "S", "A", "B", "C"].includes(r.rank));
  assert.equal(r.hasNext, true);
  assert.equal(p.auto, false);
  world.nextStage(p);
  assert.equal(p.area, "dungeon");
  assert.equal(i.floor, 2);
  assert.equal(i.stage, 1);
  assert.equal(world.snapshot(p).dungeon.result, null);
  world.returnTown(p);
  world.players.delete(p.id);
});
test("player shops sell potions, ore and unequipped gear by the stack, atomically", () => {
  const seller = create("market-seller", "swordsman"),
    buyer = create("market-buyer", "archer");
  seller.ownedEquipment.push("moon_blade", "crystal_charm");
  seller.equipment.charm = "crystal_charm";
  seller.inventory.hp = 10;
  persist(seller);
  buyer.gold = 1000;
  persist(buyer);
  // Equipped and starter gear stay out of the shop.
  assert.throws(
    () =>
      world.createShop(seller, {
        name: "x",
        listings: [{ item: "crystal_charm", qty: 1, price: 50 }],
        key: "market-bad-0001",
      }),
    /ถอดอุปกรณ์/,
  );
  assert.throws(() =>
    world.createShop(seller, {
      name: "x",
      listings: [{ item: "starter_swordsman", qty: 1, price: 50 }],
      key: "market-bad-0002",
    }),
  );
  const shop = world.createShop(seller, {
    name: "ร้านครบ",
    listings: [
      { item: "hp", qty: 6, price: 12 },
      { item: "moon_blade", qty: 1, price: 300 },
    ],
    key: "market-open-0001",
  });
  assert.equal(seller.inventory.hp, 4);
  assert.ok(!seller.ownedEquipment.includes("moon_blade"));
  const ore = world.listShopItem(seller, {
    item: "ore",
    qty: 2,
    price: 25,
    key: "market-list-0001",
  });
  const listed = world.snapshot(buyer).shops.find((s) => s.id === shop.id);
  assert.equal(listed.listings.length, 3);
  const [hp, blade] = shop.listings;
  world.buyShop(buyer, { id: hp, qty: 4, key: "market-buy-0001" });
  world.buyShop(buyer, { id: hp, qty: 4, key: "market-buy-0001" });
  assert.equal(buyer.inventory.hp, 5 + 4);
  assert.equal(buyer.gold, 1000 - 48);
  assert.equal(seller.gold, 120 + 48);
  assert.throws(
    () => world.buyShop(buyer, { id: hp, qty: 3, key: "market-buy-0002" }),
    /ไม่พอ/,
  );
  world.buyShop(buyer, { id: blade, key: "market-buy-0003" });
  assert.ok(buyer.ownedEquipment.includes("moon_blade"));
  assert.throws(() =>
    world.buyShop(seller, { id: ore.id, key: "market-buy-0004" }),
  );
  const after = world.snapshot(seller).shops.find((s) => s.id === shop.id);
  assert.equal(after.sold, 5);
  assert.equal(after.earned, 348);
  assert.equal(after.listings.length, 2, "sold-out gear listing disappears");
  world.unlistShopItem(seller, { id: ore.id, key: "market-unlist-01" });
  assert.equal(seller.inventory.ore, 3);
  world.closeShop(seller, "market-close-0001");
  assert.equal(seller.inventory.hp, 6, "unsold potions come home");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM shop_listings").get().n, 0);
  world.players.delete(seller.id);
  world.players.delete(buyer.id);
});
test("ground monsters climb the stairs to reach a hero on a high ledge", () => {
  const p = create("stair-target");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 3000;
  i.nextHazardAt = Infinity;
  i.enemies = [i.enemies.find((e) => e.type !== "bat")];
  const e = i.enemies[0];
  Object.assign(e, { x: 640, y: 600, vy: 0, grounded: true, aggro: true });
  e.hp = e.maxHp = 1e9;
  p.hp = 1e9;
  for (let k = 0; k < 240; k++) {
    // Pin the hero on the 395-high ledge (205 px up, beyond one jump).
    Object.assign(p, { x: 1100, y: 395, vy: 0, grounded: true, input: 0 });
    world.tick(0.05, t + k * 0.05);
    if (e.y === 395) break;
  }
  assert.equal(e.y, 395, `monster stuck at x=${e.x} y=${e.y}`);
  world.returnTown(p);
  world.players.delete(p.id);
});
test("town stall spots never overlap NPCs, the cave gate or each other", async () => {
  const { SHOP_SPOTS } = await import("../shared/config.js");
  assert.ok(SHOP_SPOTS.length >= 5);
  for (const x of SHOP_SPOTS) {
    for (const n of WORLD.npcs)
      assert.ok(Math.abs(x - n.x) >= 170, `stall ${x} vs ${n.id}`);
    assert.ok(Math.abs(x - WORLD.portal) >= 280);
    assert.ok(x > 200 && x < WORLD.townWidth - 150);
  }
  for (let k = 1; k < SHOP_SPOTS.length; k++)
    assert.ok(SHOP_SPOTS[k] - SHOP_SPOTS[k - 1] >= 300);
});
test("auto battle clears a stage without wasting swings on empty air", () => {
  const p = create("auto-clear", "archer");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t0 = Date.now() / 1000 + 5000;
  i.nextHazardAt = Infinity;
  p.auto = true;
  let swings = 0,
    wasted = 0;
  for (let k = 0; k < 20 * 240 && !i.clear; k++) {
    p.hp = maxHp(p);
    p.lastInput = t0 + k * 0.05;
    const before = p.attackAt;
    world.tick(0.05, t0 + k * 0.05);
    if (p.attackAt !== before) {
      swings++;
      const reach = 410 + 220;
      if (!i.enemies.some((e) => e.hp > 0 && Math.abs(e.x - p.x) <= reach))
        wasted++;
    }
  }
  assert.equal(i.clear, true, `left ${i.enemies.length} monsters`);
  assert.ok(swings > 0);
  assert.equal(wasted, 0, "never attacks with nothing in reach");
  world.returnTown(p);
  world.players.delete(p.id);
});
test("specialization tiers pick costumes and tier 3 doubles the line's bonus", async () => {
  const { heroSkins, heroTier, rpgBonuses, SPECIALIZATIONS } =
    await import("../shared/rpg.js");
  const base = { class: "swordsman", gender: "female" };
  assert.deepEqual(heroSkins(base), ["swordsman-female"]);
  assert.deepEqual(heroSkins({ ...base, specialization: "guardian" }), [
    "swordsman-female-guardian-2",
    "swordsman-female",
  ]);
  assert.deepEqual(
    heroSkins({ ...base, specialization: "duelist", advanced: true }),
    [
      "swordsman-female-duelist-3",
      "swordsman-female-duelist-2",
      "swordsman-female",
    ],
  );
  const p = create("advance-hero", "swordsman");
  assert.throws(() => world.advanceClass(p), /สายพัฒนา/);
  p.level = 3;
  world.specialize(p, "guardian");
  assert.equal(heroTier(p), 2);
  assert.throws(() => world.advanceClass(p), /เลเวล 20/);
  const before = rpgBonuses(p);
  p.level = 20;
  world.advanceClass(p);
  assert.equal(heroTier(p), 3);
  const spec = SPECIALIZATIONS.swordsman.find((s) => s.id === "guardian");
  for (const [k, v] of Object.entries(spec.stats))
    assert.equal(rpgBonuses(p)[k], (before[k] || 0) + v);
  assert.equal(loadCharacter(p.id).advanced, true, "tier persists");
  assert.equal(world.snapshot(p).self.advanced, true);
  world.players.delete(p.id);
});
test("auto waits out the loading card and lets the last death play before the next stage", () => {
  const p = create("auto-pacing");
  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t0 = i.stageAt;
  p.auto = true;
  // Behind the loading card: no swing, no walking.
  world.tick(0.05, t0 + world.STAGE_INTRO - 0.5);
  assert.equal(p.action, null);
  assert.equal(p.input, 0);
  assert.ok(
    i.enemies.every((e) => e.attackAt > t0),
    "monsters hold their first swing too",
  );
  // Leave one weak monster in reach; auto finishes it, then lingers.
  const [last] = i.enemies;
  i.enemies = [last];
  Object.assign(last, { hp: 1, x: p.x + 60, y: p.y, attackAt: t0 + 99 });
  for (let k = 0; k < 40 && !i.clear; k++)
    world.tick(0.05, t0 + world.STAGE_INTRO + 0.1 + k * 0.05);
  assert.equal(i.clear, true);
  const clearedAt = i.clearedAt;
  world.tick(0.05, clearedAt + world.CLEAR_LINGER - 0.5);
  assert.equal(i.stage, 1, "still on the cleared stage while the death plays");
  world.tick(0.05, clearedAt + world.CLEAR_LINGER + 0.1);
  assert.equal(i.stage, 2);
  world.returnTown(p);
});
