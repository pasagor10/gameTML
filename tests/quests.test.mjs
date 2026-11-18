import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-quests-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter } = await import("../server/database.js");
const world = await import("../server/world.js");
const { combatStats, DUNGEON_ENERGY_MAX } = await import("../shared/config.js");
const {
  rollDailyQuests,
  questDay,
  questResetAt,
  bestiaryStars,
  bestiaryBonuses,
  ensureDaily,
  questReward,
  BESTIARY_TIERS,
  MONSTERS,
} = await import("../shared/quests.js");
const { DUNGEON_ROSTERS } = await import("../shared/dungeons.js");

function create(id, job = "swordsman", extra = {}) {
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
    ...extra,
  };
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(id, id, id, JSON.stringify(state));
  const p = world.makeRuntime(loadCharacter(id), { emit() {} });
  world.players.set(id, p);
  return p;
}
function killOne(p, i, t) {
  const e = i.enemies[0];
  e.x = p.x + 30;
  e.y = p.y;
  e.hp = 1;
  p.direction = 1;
  p.action = null;
  p.pending = null;
  p.cooldowns = {};
  world.attack(p, 0, t);
  world.tick(0.05, t + 0.17);
  return e;
}

test("daily quests are stable per character and day, fit unlocked floors and reset at Thai midnight", () => {
  const a = rollDailyQuests("hero", 100, 1),
    b = rollDailyQuests("hero", 100, 1);
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(a[0].kind, "kill");
  assert.ok(DUNGEON_ROSTERS[0].includes(a[0].target), "hunt only floor-1 monsters");
  assert.equal(new Set(a.map((q) => q.kind)).size, 3, "no duplicate goals");
  const days = new Set(Array.from({ length: 20 }, (_, d) => JSON.stringify(rollDailyQuests("hero", d, 10))));
  assert.ok(days.size > 5, "quests vary across days");
  // 17:00 UTC is midnight in Thailand.
  const evening = Date.UTC(2026, 10, 18, 16, 59) / 1000,
    midnight = Date.UTC(2026, 10, 18, 17, 0) / 1000;
  assert.equal(questDay(midnight) - questDay(evening), 1);
  assert.equal(questResetAt(evening), midnight);
});

test("monster book stars add permanent stats at each tier", () => {
  assert.equal(bestiaryStars(BESTIARY_TIERS[0] - 1), 0);
  assert.equal(bestiaryStars(BESTIARY_TIERS[0]), 1);
  assert.equal(bestiaryStars(BESTIARY_TIERS[2] + 5), 3);
  assert.deepEqual(bestiaryBonuses({ slime: 200, bat: 50, golem: 3 }), {
    hp: MONSTERS.slime.per * 2,
    speed: MONSTERS.bat.per,
  });
  const p = create("book-stats");
  const before = combatStats(p).hp;
  p.bestiary = { slime: 1000 };
  assert.equal(combatStats(p).hp, before + MONSTERS.slime.per * 3);
});

test("dungeon kills fill the book and quests, practice does not, and progress persists", () => {
  const p = create("book-kills", "mage");
  world.beginTraining(p);
  const training = world.instances.get(p.instance);
  killOne(p, training, Date.now() / 1000 + 100);
  assert.deepEqual(p.bestiary, {}, "practice slimes never count");
  world.returnTown(p);

  world.beginDungeon(p, 1);
  const i = world.instances.get(p.instance),
    t = Date.now() / 1000 + 2400;
  i.nextHazardAt = Infinity;
  const type = i.enemies[0].type;
  p.bestiary = { [type]: BESTIARY_TIERS[0] - 1 };
  const killAny = ensureDaily(p, Date.now() / 1000).quests.find((q) => q.kind === "killAny");
  const e = killOne(p, i, t);
  assert.equal(e.type, type);
  assert.equal(p.bestiary[type], BESTIARY_TIERS[0]);
  const star = i.events.find((ev) => ev.kind === "bestiary");
  assert.equal(star?.stars, 1);
  assert.equal(star.actorId, p.id);
  if (killAny) assert.equal(killAny.progress, 1);
  const saved = loadCharacter(p.id);
  assert.equal(saved.bestiary[type], BESTIARY_TIERS[0]);
  assert.deepEqual(saved.daily.quests, p.daily.quests);
  world.returnTown(p);
});

test("quest rewards claim once, chest needs every quest, and grants energy or ore", () => {
  const p = create("claims");
  const daily = ensureDaily(p, Date.now() / 1000);
  assert.throws(() => world.claimQuest(p, 0), /ยังไม่สำเร็จ/);
  assert.throws(() => world.claimQuest(p, "__proto__"), /ไม่พบภารกิจ/);
  assert.throws(() => world.claimQuest(p, 7), /ไม่พบภารกิจ/);
  assert.throws(() => world.claimQuest(p, "bonus"), /ครบทุกข้อ/);
  daily.quests.forEach((q) => (q.progress = q.goal));
  const gold = p.gold,
    ore = p.inventory.ore;
  p.energy = { points: 2, nextAt: Date.now() / 1000 + 600 };
  const r = world.claimQuest(p, 0);
  assert.equal(p.gold, gold + r.reward.gold);
  assert.equal(p.inventory.ore, ore + r.reward.ore);
  assert.equal(r.reward.energy, 0);
  assert.equal(p.energy.points, 2, "legacy energy is untouched");
  assert.throws(() => world.claimQuest(p, 0), /รับรางวัลแล้ว/);
  world.claimQuest(p, 1);
  world.claimQuest(p, 2);
  assert.equal(p.energy.points, 2);
  world.claimQuest(p, "bonus");
  assert.equal(p.energy.points, 2, "chest awards ore instead");
  assert.throws(() => world.claimQuest(p, "bonus"), /แล้ว/);
  assert.equal(loadCharacter(p.id).daily.bonusClaimed, true);

  const full = create("claims-full");
  ensureDaily(full, Date.now() / 1000).quests.forEach((q) => {
    q.progress = q.goal;
    q.claimed = true;
  });
  const fullOre = full.inventory.ore;
  world.claimQuest(full, "bonus");
  assert.equal(world.snapshot(full).self.energy.points, DUNGEON_ENERGY_MAX);
  assert.equal(full.inventory.ore, fullOre + 7, "full energy converts to ore");

  const capped = create("claims-capped");
  const quests = ensureDaily(capped, Date.now() / 1000).quests;
  quests[0].progress = quests[0].goal;
  capped.energy = { points: DUNGEON_ENERGY_MAX, nextAt: null };
  const before = capped.inventory.ore,
    got = world.claimQuest(capped, 0);
  assert.equal(got.reward.energy, 0);
  assert.equal(capped.inventory.ore, before + got.reward.ore);
  assert.equal(got.reward.ore, questReward(quests[0], capped.level).ore + 2);
});

test("snapshot carries today's quests, reset time and the book", () => {
  const p = create("snap");
  const self = world.snapshot(p).self;
  assert.equal(self.daily.quests.length, 3);
  assert.ok(self.daily.resetAt > Date.now() / 1000);
  assert.deepEqual(self.bestiary, {});
  assert.equal(world.snapshot(p).self.daily.day, self.daily.day);
});
