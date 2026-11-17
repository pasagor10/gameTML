import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-engine-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, persist, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { damage, WORLD } = await import("../shared/config.js");
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
  p.x = 600;
  p.jump = true;
  for (let n = 0; n < 25; n++) world.tick(0.05, t + n * 0.05);
  assert.equal(p.y, 460);
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
test("every platform is reachable from the ground with one jump", () => {
  const t = Date.now() / 1000 + 900;
  for (const [n, platform] of WORLD.platforms.entries()) {
    const p = create("reach-" + n);
    p.x = platform.x + platform.w / 2;
    p.jump = true;
    for (let k = 0; k < 30; k++) world.tick(0.05, t + n * 5 + k * 0.05);
    assert.equal(p.y, platform.y, `platform ${n} at y=${platform.y}`);
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
