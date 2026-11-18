import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "tml-slots-"));
process.env.DB_PATH = path.join(dir, "test.sqlite");
const { db, loadCharacter, persist } = await import("../server/database.js");
const { spinSlotMachine } = await import("../server/slots.js");
const {
  SLOT_COST,
  SLOT_MACHINE,
  SLOT_REWARDS,
  SLOT_TOTAL_WEIGHT,
  slotRewardAt,
} = await import("../shared/slots.js");
const { GEAR } = await import("../shared/rpg.js");
let serial = 0;
function hero({
  gold = 5000,
  level = 20,
  unlocked = 10,
  job = "swordsman",
} = {}) {
  const id = "slot-hero-" + ++serial;
  db.prepare("INSERT INTO characters VALUES(?,?,?,?)").run(
    id,
    null,
    id,
    JSON.stringify({
      class: job,
      gender: "female",
      gold,
      level,
      unlocked,
      exp: 0,
      quest: 0,
      inventory: { hp: 0, mp: 0, ore: 0 },
      upgrade: 0,
    }),
  );
  return {
    ...loadCharacter(id),
    area: "town",
    hp: 100,
    x: SLOT_MACHINE.x,
    y: SLOT_MACHINE.y,
  };
}
const rngFor = (roll) => {
  let first = true;
  return (max) => {
    const n = first ? roll : 0;
    first = false;
    assert.ok(n < max);
    return n;
  };
};
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("published slot probabilities match every possible integer draw", () => {
  assert.equal(SLOT_COST, 1000);
  assert.equal(SLOT_TOTAL_WEIGHT, 10000);
  const counts = {};
  for (let n = 0; n < SLOT_TOTAL_WEIGHT; n++) {
    const reward = slotRewardAt(n);
    counts[reward.id] = (counts[reward.id] || 0) + 1;
  }
  for (const reward of SLOT_REWARDS)
    assert.equal(counts[reward.id], reward.weight);
  assert.throws(() => slotRewardAt(-1));
  assert.throws(() => slotRewardAt(10000));
});
test("charge and reward persist once, including replay after acknowledgement loss", () => {
  const p = hero(),
    key = "slots-once-0001";
  const result = spinSlotMachine(p, key, rngFor(0), 10000);
  assert.equal(result.item, "hp");
  assert.equal(result.qty, 15);
  assert.equal(p.gold, 4000);
  assert.equal(loadCharacter(p.id).inventory.hp, 15);
  const replay = spinSlotMachine(
    p,
    key,
    () => {
      throw Error("must not redraw");
    },
    10100,
  );
  assert.deepEqual(replay, result);
  assert.equal(loadCharacter(p.id).gold, 4000);
  assert.equal(loadCharacter(p.id).inventory.hp, 15);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM ledger WHERE actor=? AND action='slots:spin'",
      )
      .get(p.id).n,
    1,
  );
});
test("insufficient funds, remote use, dungeons, death and rapid new spins cannot charge", () => {
  for (const change of [
    { gold: 999 },
    { area: "dungeon" },
    { hp: 0 },
    { x: SLOT_MACHINE.x + 200 },
    { y: SLOT_MACHINE.y - 200 },
  ]) {
    const p = hero();
    Object.assign(p, change);
    if (change.gold !== undefined) persist(p);
    const before = loadCharacter(p.id).gold;
    assert.throws(() =>
      spinSlotMachine(p, "invalid-" + p.id, rngFor(0), 10000),
    );
    assert.equal(loadCharacter(p.id).gold, before);
    assert.equal(loadCharacter(p.id).inventory.hp, 0);
  }
  const p = hero();
  spinSlotMachine(p, "cooldown-first", rngFor(0), 10000);
  assert.throws(
    () => spinSlotMachine(p, "cooldown-second", rngFor(0), 11000),
    /รอ/,
  );
  assert.equal(loadCharacter(p.id).gold, 4000);
});
test("equipment matches the class, level and unlocked floors; duplicates convert to published ore", () => {
  const p = hero({ job: "archer" }),
    result = spinSlotMachine(p, "gear-first-key", rngFor(8000), 10000);
  const item = GEAR[result.item];
  assert.ok(item);
  assert.equal(item.rarity, "rare");
  assert.ok(!item.class || item.class === p.class);
  assert.ok(item.level <= p.level);
  assert.ok(!item.floor || item.floor <= p.unlocked);
  assert.ok(loadCharacter(p.id).ownedEquipment.includes(result.item));
  const duplicate = spinSlotMachine(p, "gear-second-key", rngFor(8000), 13000);
  assert.equal(duplicate.item, "ore");
  assert.equal(duplicate.qty, 7);
  assert.equal(duplicate.converted, true);
  const novice = hero({ level: 1, unlocked: 1 });
  const conversion = spinSlotMachine(
    novice,
    "legendary-no-pool",
    rngFor(9999),
    10000,
  );
  assert.equal(conversion.item, "ore");
  assert.equal(conversion.qty, 20);
  assert.equal(conversion.converted, true);
});
test("another character cannot reuse a paid request id", () => {
  const a = hero(),
    b = hero();
  spinSlotMachine(a, "shared-request-id", rngFor(0), 10000);
  assert.throws(
    () => spinSlotMachine(b, "shared-request-id", rngFor(0), 10000),
    /คำขอ/,
  );
  assert.equal(loadCharacter(b.id).gold, 5000);
});
