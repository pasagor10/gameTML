import { dungeonRank } from "../shared/dungeon-results.js";
import {
  dungeonPlatforms,
  dungeonSpawn,
  dungeonEnemyCount,
  climbStep,
  DUNGEON_JUMP,
  isElite,
  rosterEntry,
  traitOf,
  enemyStep,
  dungeonSigns,
  withinDungeonSign,
} from "../shared/dungeons.js";
import {
  GEAR,
  SLOTS,
  FLOOR_LOOT,
  bossLootCandidates,
  SPECIALIZATIONS,
  initializeGear,
  ADVANCE_LEVEL,
  heroTier,
  enhancementLevel,
  enhancementChance,
  enhancementCost,
} from "../shared/rpg.js";
import { ACTIONS } from "../shared/motion.js";
import {
  applyRaise,
  autoPlan,
  baseStats,
  freePoints,
  resetCost,
  statEffects,
  LIGHTNING,
} from "../shared/stats.js";
import {
  WORLD_BOSS,
  worldBossAt,
  worldRanking,
  worldReward,
} from "../shared/world-boss.js";
import {
  SKILL_KITS,
  STATUSES,
  BUFFS,
  BASE_CRIT,
  skillOf,
  buffActive,
  statusActive,
  controlled,
  applyStatus,
} from "../shared/skills.js";
import {
  recordKill,
  ensureDaily,
  advanceQuests,
  questReward,
  questText,
  questResetAt,
  DAILY_BONUS,
  ENERGY_OVERFLOW_ORE,
} from "../shared/quests.js";
import {
  skyAt,
  nightBoss,
  nightFloor,
  nightReward,
  NIGHT_BOSS,
  NIGHT_CAVE,
} from "../shared/night.js";
// SKY_OFFSET (seconds) shifts the day/night clock, e.g. to test the night cave.
const SKY_OFFSET = Number(process.env.SKY_OFFSET) || 0;
export const skyNow = () => skyAt(Date.now() / 1000 + SKY_OFFSET);
import { autoBrain } from "./auto.js";
import { randomUUID } from "node:crypto";
import { db, loadCharacter, persist, atomic, log } from "./database.js";
import {
  CLASSES,
  ITEMS,
  POTIONS,
  FLOORS,
  MAIN_FLOORS,
  WORLD,
  areaWidth,
  maxHp,
  maxMp,
  damage,
  combatStats,
  combatPower,
  SHOP_SPOTS,
  DUNGEON_ENERGY_MAX,
  DUNGEON_ENERGY_INTERVAL,
} from "../shared/config.js";
export const players = new Map(),
  instances = new Map(),
  parties = new Map(),
  trades = new Map();
const now = () => Date.now() / 1000;
// Snapshots go out 20×/s per player; shops change only via the shop actions below.
let shopCache = null;
export function shopList() {
  if (shopCache) return shopCache;
  const listings = db
    .prepare(
      "SELECT id,shop,item,qty,price FROM shop_listings WHERE qty>0 ORDER BY created",
    )
    .all();
  return (shopCache = db
    .prepare(
      "SELECT s.id,s.owner,s.name,s.x,s.sold,s.earned,c.name AS ownerName FROM shops s JOIN characters c ON c.id=s.owner",
    )
    .all()
    .map((s) => {
      const items = listings.filter((l) => l.shop === s.id);
      // qty/item/price mirror the first listing for older clients.
      return {
        ...s,
        listings: items,
        item: items[0]?.item ?? null,
        qty: items.reduce((n, l) => n + l.qty, 0),
        price: items[0]?.price ?? 0,
      };
    }));
}
export function invalidateShops() {
  shopCache = null;
}
export function live(id) {
  return [...players.values()].find((p) => p.id === id);
}
export function sync(p) {
  const saved = loadCharacter(p.id);
  if (saved)
    Object.assign(p, {
      gold: saved.gold,
      inventory: saved.inventory,
      upgrade: saved.upgrade,
      enhancements: saved.enhancements,
      armor: saved.armor,
      weapon: saved.weapon,
      equipment: saved.equipment,
      ownedEquipment: saved.ownedEquipment,
      specialization: saved.specialization,
      advanced: saved.advanced,
    });
}
export function ensureTown(p) {
  if (p.area !== "town" || p.hp <= 0) throw Error("ทำรายการได้ในเมืองเท่านั้น");
}
const validInt = (n, min, max) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
export function buyNpc(p, item, key) {
  ensureTown(p);
  if (!ITEMS[item]) throw Error("ไม่มีสินค้านี้");
  const result = atomic(p.id, "npc:buy", key, () => {
    const c = loadCharacter(p.id),
      cost = ITEMS[item].price;
    if (c.gold < cost) throw Error("ทองไม่พอ");
    if (["weapon", "armor"].includes(item) && c[item])
      throw Error("มีอุปกรณ์นี้แล้ว");
    c.gold -= cost;
    if (["weapon", "armor"].includes(item)) {
      c[item] = true;
      const id = item === "weapon" ? "guardian_weapon" : "traveler_armor";
      c.ownedEquipment = [...new Set([...c.ownedEquipment, id])];
      c.equipment[item] = id;
    } else c.inventory[item] = (c.inventory[item] || 0) + 1;
    persist(c);
    return { message: "ซื้อ " + ITEMS[item].name + " สำเร็จ" };
  });
  sync(p);
  return result;
}
export function buyEquipment(p, id, key) {
  ensureTown(p);
  const item = GEAR[id];
  if (!item?.price) throw Error("ไม่มีอุปกรณ์นี้ในร้าน");
  const result = atomic(p.id, "equipment:buy", key, () => {
    const c = loadCharacter(p.id);
    if (c.ownedEquipment.includes(id)) throw Error("มีอุปกรณ์นี้แล้ว");
    if (c.gold < item.price) throw Error("ทองไม่พอ");
    c.gold -= item.price;
    c.ownedEquipment.push(id);
    persist(c);
    return {
      message: "ได้รับ " + item.name + " · สวมใส่ได้ในกระเป๋า",
      item: id,
      rarity: item.rarity,
    };
  });
  sync(p);
  return result;
}
export function discardItem(p, id, key) {
  ensureTown(p);
  const result = atomic(p.id, "inventory:discard", key, () => {
    const c = loadCharacter(p.id);
    const gear = GEAR[id];
    if (gear) {
      if (id.startsWith("starter_")) throw Error("ทิ้งอุปกรณ์เริ่มต้นไม่ได้");
      if (Object.values(c.equipment).includes(id)) throw Error("ถอดอุปกรณ์ก่อนทิ้ง");
      const index = c.ownedEquipment.indexOf(id);
      if (index < 0) throw Error("ไม่มีอุปกรณ์นี้");
      c.ownedEquipment.splice(index, 1);
    } else {
      if (!["hp", "mp", "ore"].includes(id) || !(c.inventory[id] > 0)) throw Error("ไม่มีไอเทมนี้");
      c.inventory[id] -= 1;
    }
    persist(c);
    return { message: "ทิ้งไอเทม 1 ชิ้นแล้ว" };
  });
  sync(p);
  return result;
}

export function equip(p, slot, id) {
  ensureTown(p);
  if (!Object.hasOwn(SLOTS, slot)) throw Error("ช่องอุปกรณ์ไม่ถูกต้อง");
  const item = GEAR[id];
  if (
    id !== null &&
    (!item || item.slot !== slot || !p.ownedEquipment.includes(id))
  )
    throw Error("ไม่มีอุปกรณ์นี้");
  if (item?.class && item.class !== p.class) throw Error("อุปกรณ์ไม่ตรงอาชีพ");
  if (item && p.level < item.level) throw Error("เลเวลยังไม่ถึง");
  p.equipment[slot] = id;
  p.hp = Math.min(p.hp, maxHp(p));
  p.mp = Math.min(p.mp, maxMp(p));
  savePlayer(p);
  return {
    message: item ? "สวมใส่ " + item.name : "ถอดอุปกรณ์แล้ว",
    equipped: id,
    rarity: item?.rarity || "common",
  };
}

export function rollBossLoot(p, floor, firstClear, random = Math.random) {
  const table = FLOOR_LOOT[floor];
  if (!table) return null;
  const weapon = table.weapons[p.class];
  if (firstClear && weapon && !p.ownedEquipment.includes(weapon)) return weapon;
  const candidates = bossLootCandidates(floor, p.class, p.ownedEquipment);
  if (!candidates.length) return null;
  const legendary = candidates.find((id) => GEAR[id].rarity === "legendary");
  const roll = random();
  if (legendary && roll < 0.03) return legendary;
  if (roll >= 0.35) return null;
  const regular = candidates.filter((id) => id !== legendary);
  return regular[Math.floor(random() * regular.length)] || null;
}
// Tier 3: a specialized hero at ADVANCE_LEVEL takes the advanced form.
export function advanceClass(p) {
  ensureTown(p);
  if (!p.specialization) throw Error("เลือกสายพัฒนาก่อนเลื่อนขั้น");
  if (p.advanced) throw Error("เลื่อนขั้นแล้ว");
  if (p.level < ADVANCE_LEVEL) throw Error("เลื่อนขั้นได้เมื่อเลเวล " + ADVANCE_LEVEL);
  p.advanced = true;
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  savePlayer(p);
  return { message: "เลื่อนขั้นอาชีพสำเร็จ! พลังสายพัฒนาเพิ่มเป็น 2 เท่า" };
}
export function specialize(p, id) {
  ensureTown(p);
  if (p.level < 3) throw Error("ปลดล็อกสายพัฒนาเมื่อเลเวล 3");
  if (!SPECIALIZATIONS[p.class].some((s) => s.id === id))
    throw Error("สายพัฒนาไม่ตรงอาชีพ");
  p.specialization = id;
  p.hp = Math.min(p.hp, maxHp(p));
  p.mp = Math.min(p.mp, maxMp(p));
  savePlayer(p);
  return { message: "เลือกสายพัฒนาแล้ว" };
}
export function enhance(p, key, slot = "weapon") {
  ensureTown(p);
  if (!Object.hasOwn(SLOTS, slot)) throw Error("ช่องอุปกรณ์ไม่ถูกต้อง");
  const result = atomic(p.id, "enhance", key, () => {
    const c = loadCharacter(p.id),
      level = enhancementLevel(c, slot),
      cost = enhancementCost(level);
    if (!c.equipment[slot]) throw Error("สวมอุปกรณ์ในช่องนี้ก่อน");
    if (level >= 10) throw Error("อุปกรณ์ถึง +10 แล้ว");
    if (c.gold < cost.gold || (c.inventory.ore || 0) < cost.ore)
      throw Error(`ต้องมีทอง ${cost.gold} และแร่จันทรา ${cost.ore} ชิ้น`);
    c.gold -= cost.gold;
    c.inventory.ore -= cost.ore;
    const success = Math.random() < enhancementChance(level);
    if (success) {
      if (slot === "weapon") c.upgrade = level + 1;
      else c.enhancements[slot] = level + 1;
    }
    persist(c);
    return {
      message: success ? `${SLOTS[slot]} ตีบวกสำเร็จ +${level + 1}` : "ตีบวกไม่สำเร็จ ระดับเดิมคงอยู่",
      success,
    };
  });
  sync(p);
  const done = advanceQuests(p, wallClock(), "enhance");
  savePlayer(p);
  if (done.length) result.message += " · ภารกิจสำเร็จ: " + questText(done[0]);
  return result;
}
// Night boss: the first clear each night pays in full (plus a chance at an
// unowned boss item); later clears that night give a small purse only.
function nightRewards(i, m, t) {
  const first = m.nightClear !== i.night.cycle,
    r = nightReward(i.floor),
    gold = first ? r.gold : Math.round(r.gold * 0.2),
    ore = first ? r.ore : 0,
    gained = first ? 300 + i.floor * 30 : 40,
    reward = i.rewards?.[m.id],
    spot = { x: i.lastDrop?.x ?? m.x, y: i.lastDrop?.y ?? m.y - 110 };
  m.gold += gold;
  m.inventory.ore = (m.inventory.ore || 0) + ore;
  exp(m, gained);
  if (reward) {
    reward.gold += gold;
    reward.ore += ore;
    reward.exp += gained;
  }
  if (ore)
    i.events.push({
      id: randomUUID(),
      kind: "material",
      actorId: m.id,
      ...spot,
      item: "ore",
      amount: ore,
      at: t,
    });
  if (first) {
    m.nightClear = i.night.cycle;
    const pool = bossLootCandidates(
      Math.min(i.floor, MAIN_FLOORS),
      m.class,
      m.ownedEquipment,
    );
    if (pool.length && Math.random() < r.itemChance) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      m.ownedEquipment.push(item);
      reward?.items.push(item);
      i.events.push({
        id: randomUUID(),
        kind: "loot",
        actorId: m.id,
        ...spot,
        item,
        rarity: GEAR[item].rarity,
        at: t,
      });
    }
  }
  questEvents(i, m, advanceQuests(m, wallClock(), "boss"), m.x, m.y - 160, t);
}
// Monsters are tougher and fewer: each has this much more HP, and each kill
// pays this much more so a run still earns about the same.
const MONSTER_HP = 2.5,
  KILL_PAY = 1.8;
// Daily quests use the real calendar even when combat runs on a test clock.
const wallClock = () => Date.now() / 1000;

// ---- World boss: one shared arena every hero online can join.
// WORLD_BOSS_OFFSET (seconds) shifts its schedule, e.g. to test it now.
const WB_OFFSET = Number(process.env.WORLD_BOSS_OFFSET) || 0;
export const worldBossClock = () => wallClock() + WB_OFFSET;
// { cycle, instanceId, endsAt, done: null|"killed"|"escaped", damage, names, joined }
export const announcements = db.prepare("SELECT data,created FROM ledger WHERE action='announcement' ORDER BY created DESC LIMIT 40").all().reverse().map(row => ({ ...JSON.parse(row.data), at: row.created / 1000 }));
function announce(id, message) {
  if (announcements.some(a => a.id === id)) return;
  announcements.push({ id, message, at: wallClock() });
  if (announcements.length > 40) announcements.shift();
  log(null, "announcement", { id, message });
}
const completedWorldCycles = new Set(db.prepare("SELECT data FROM ledger WHERE action='worldboss:down' ORDER BY created DESC LIMIT 60").all().map(row => JSON.parse(row.data).cycle));
export let worldBoss = null;
function openWorldBoss(sched) {
  const id = randomUUID(),
    i = {
      id,
      floor: WORLD_BOSS.floor,
      stage: 3,
      world: { name: sched.name, type: sched.type, tint: sched.tint, cycle: sched.cycle },
      members: [],
      enemies: [],
      clear: false,
      completed: false,
      events: [],
      rewards: {},
      killCount: 0,
      summoned: 0,
    };
  instances.set(id, i);
  i.startedAt = now();
  spawnStage(i);
  worldBoss = {
    cycle: sched.cycle,
    instanceId: id,
    endsAt: sched.endsAt,
    done: null,
    damage: new Map(),
    names: new Map(),
    joined: new Set(),
  };
  announce(`worldboss:${sched.cycle}:open`, "เจ้าแม่นางนอนปรากฏแล้ว! ร่วมปราบบอสโลก รับของตำนานตามอันดับดาเมจ · ปิดสนาม 20:30 น.");
  log(null, "worldboss:open", { cycle: sched.cycle, boss: sched.name });
  return i;
}
// Keeps the schedule: opens the arena on time, lets the boss escape at the end.
export function updateWorldBoss(clock = worldBossClock()) {
  const sched = worldBossAt(clock);
  const until = sched.nextAt - clock;
  if (!sched.open && until > 0 && until <= 600) {
    const minutes = until <= 60 ? 1 : until <= 300 ? 5 : 10;
    announce(`worldboss:${sched.cycle + 1}:warning:${minutes}`, `อีกไม่เกิน ${minutes} นาที เจ้าแม่นางนอนจะปรากฏเวลา 20:00 น. เตรียมรับอุปกรณ์ตำนานตามดาเมจ!`);
  }
  if (sched.open && !completedWorldCycles.has(sched.cycle) && worldBoss?.cycle !== sched.cycle) {
    if (worldBoss) closeWorldBoss();
    openWorldBoss(sched);
  } else if (worldBoss && !worldBoss.done && clock >= worldBoss.endsAt) {
    worldBoss.done = "escaped";
    announce(`worldboss:${worldBoss.cycle}:escaped`, "เจ้าแม่นางนอนลับหายไปแล้ว พบกันพรุ่งนี้ 20:00 น.");
    closeWorldBoss();
  }
}
function closeWorldBoss() {
  const i = instances.get(worldBoss.instanceId);
  if (!i) return;
  for (const id of [...i.members]) {
    const m = live(id);
    if (m) {
      returnTown(m);
      m.socket?.emit?.("toast", { message: `${i.world.name} หนีไปแล้ว… รอบหน้าลุยกันใหม่` });
    }
  }
  instances.delete(i.id);
}
export function joinWorldBoss(p) {
  const i = worldBoss && !worldBoss.done && instances.get(worldBoss.instanceId);
  if (!i || i.completed) throw Error("ตอนนี้ยังไม่มีบอสโลก");
  if (p.area !== "town") throw Error("กลับเมืองก่อนเข้าร่วม");
  if (p.hp <= 0) throw Error("ฟื้นพลังก่อนเข้าร่วม");
  const boss = i.enemies.find((e) => e.boss);
  if (!boss) throw Error("บอสโลกพ่ายแพ้แล้ว");
  // Every new hero makes the boss tougher, once per appearance.
  if (!worldBoss.joined.has(p.id)) {
    worldBoss.joined.add(p.id);
    if (worldBoss.joined.size > 1) {
      boss.maxHp += WORLD_BOSS.hpPerHero;
      boss.hp += WORLD_BOSS.hpPerHero;
    }
  }
  worldBoss.names.set(p.id, p.name);
  if (!i.members.includes(p.id)) i.members.push(p.id);
  i.rewards[p.id] ??= { gold: 0, exp: 0, ore: 0, items: [], damage: 0 };
  enterInstance(p, i);
  p.x = 320 + Math.round(Math.random() * 160);
  return { message: `เข้าร่วมศึกบอสโลก · ${i.world.name}` };
}
function creditWorld(i, id, amount) {
  if (!i.world || !worldBoss || worldBoss.instanceId !== i.id || !id) return;
  worldBoss.damage.set(id, (worldBoss.damage.get(id) || 0) + amount);
}
// Guards pour out as the boss's health passes each mark.
function worldSummons(i, t) {
  const boss = i.enemies.find((e) => e.boss);
  if (!boss) return;
  while (
    i.summoned < WORLD_BOSS.summonAt.length &&
    boss.hp <= boss.maxHp * WORLD_BOSS.summonAt[i.summoned]
  ) {
    i.summoned++;
    for (let n = 0; n < WORLD_BOSS.summonCount; n++) {
      const entry = rosterEntry(i.floor, n + i.summoned),
        mods = traitOf({ trait: entry.variant?.trait || null }),
        max = Math.round((55 + i.floor * 24 + 3 * 14) * 2 * (mods.hp || 1)),
        x = Math.max(200, Math.min(2200, boss.x + (n % 2 ? 1 : -1) * (120 + n * 70)));
      i.enemies.push({
        id: randomUUID(),
        x,
        y: WORLD.ground,
        homeX: x,
        homeY: WORLD.ground,
        grounded: true,
        hp: max,
        maxHp: max,
        type: entry.type,
        variant: entry.variant?.name || null,
        trait: entry.variant?.trait || null,
        boss: false,
        elite: true,
        aggro: true,
        speed: Math.round((85 + i.floor * 5 + 15) * (mods.speed || 1)),
        spawnAt: t + n * 0.08,
        attackCount: 0,
        direction: -1,
        attackAt: t,
      });
    }
    i.events.push({
      id: randomUUID(),
      kind: "summon",
      x: boss.x,
      y: boss.y - 260,
      count: WORLD_BOSS.summonCount,
      at: t,
    });
  }
}
// The boss fell: pay everyone who hit it, by their share of the damage.
function worldBossDown(i, t) {
  worldBoss.done = "killed";
  completedWorldCycles.add(worldBoss.cycle);
  const boss = { maxHp: i.bossMaxHp || 1 },
    ranking = worldRanking(worldBoss.damage, worldBoss.names, boss.maxHp);
  i.ranking = ranking;
  for (const r of ranking) {
    const saved = !live(r.id) && loadCharacter(r.id);
    const m = live(r.id) || (saved && makeRuntime(saved, { emit() {} }));
    if (!m) continue;
    const pay = worldReward(r.place, r.share),
      reward = (i.rewards[m.id] ??= { gold: 0, exp: 0, ore: 0, items: [], damage: 0 });
    m.gold += pay.gold;
    m.inventory.ore = (m.inventory.ore || 0) + pay.ore;
    exp(m, pay.exp);
    reward.gold += pay.gold;
    reward.ore += pay.ore;
    reward.exp += pay.exp;
    for (let n = 0; n < pay.itemCount; n++) {
      const pool = bossLootCandidates(MAIN_FLOORS, m.class, m.ownedEquipment)
        .filter(id => GEAR[id].rarity === "legendary");
      if (!pool.length) { m.inventory.ore += 15; reward.ore += 15; continue; }
      const item = pool[Math.floor(Math.random() * pool.length)];
      m.ownedEquipment.push(item);
      reward.items.push(item);
      if (m.instance === i.id) i.events.push({ id: randomUUID(), kind: "loot", actorId: m.id,
        x: i.lastDrop?.x ?? m.x, y: i.lastDrop?.y ?? m.y - 110, item, rarity: GEAR[item].rarity, at: t });
    }
    if (m.instance === i.id) {
      questEvents(i, m, advanceQuests(m, wallClock(), "boss"), m.x, m.y - 160, t);
    } else {
      advanceQuests(m, wallClock(), "boss");
      m.socket?.emit?.("toast", {
        message: `บอสโลกพ่ายแพ้! อันดับ ${r.place} · +${pay.gold} ทอง · แร่ ×${pay.ore}`,
      });
    }
    savePlayer(m);
  }
  announce(`worldboss:${worldBoss.cycle}:down`, `เจ้าแม่นางนอนถูกปราบแล้ว! ${ranking.slice(0,3).map(r => `อันดับ ${r.place} ${r.name} (${Math.round(r.damage).toLocaleString()} ดาเมจ)`).join(" · ")} · ส่งของรางวัลเข้ากระเป๋าแล้ว`);
  log(null, "worldboss:down", { cycle: worldBoss.cycle, heroes: ranking.length });
}
// What a hero sees of the world boss, in town or in the arena.
function worldBossView(p) {
  const clock = worldBossClock(),
    sched = worldBossAt(clock),
    wb = worldBoss?.cycle === sched.cycle ? worldBoss : null,
    i = wb && instances.get(wb.instanceId),
    boss = i?.enemies.find((e) => e.boss),
    maxHp = boss?.maxHp || i?.bossMaxHp || WORLD_BOSS.hp,
    ranking = wb ? i?.ranking || worldRanking(wb.damage, wb.names, maxHp) : [],
    me = ranking.find((r) => r.id === p.id);
  return {
    name: sched.name,
    type: sched.type,
    cycle: sched.cycle,
    open: !!(wb && !wb.done && sched.open),
    done: wb?.done || null,
    left: Math.max(0, Math.round(sched.endsAt - clock)),
    nextIn: Math.max(0, Math.round(sched.nextAt - clock)),
    hp: boss ? Math.ceil(boss.hp) : 0,
    maxHp,
    heroes: wb?.joined.size || 0,
    fighting: i?.members.length || 0,
    ranking: ranking.slice(0, 5).map(({ id, name, damage, share, place }) => ({
      id, name, damage, share, place,
    })),
    mine: me ? { damage: me.damage, share: me.share, place: me.place } : null,
    joined: !!wb?.joined.has(p.id),
  };
}
function questEvents(i, m, done, x, y, t) {
  for (const q of done)
    i.events.push({
      id: randomUUID(),
      kind: "quest",
      actorId: m.id,
      text: questText(q),
      x,
      y,
      at: t,
    });
}
export function claimQuest(p, index) {
  const t = wallClock(),
    daily = ensureDaily(p, t);
  if (index === "bonus") {
    if (daily.bonusClaimed) throw Error("รับหีบรางวัลวันนี้แล้ว");
    if (!daily.quests.every((q) => q.claimed))
      throw Error("รับรางวัลภารกิจให้ครบทุกข้อก่อน");
    daily.bonusClaimed = true;
    const gold = DAILY_BONUS.goldPerLevel * p.level,
      { gained, spare } = grantEnergy(p, t, DAILY_BONUS.energy);
    const ore = DAILY_BONUS.ore + spare;
    p.gold += gold;
    p.inventory.ore = (p.inventory.ore || 0) + ore;
    savePlayer(p);
    return {
      message: `เปิดหีบประจำวัน · +${gold} ทอง · แร่ ×${ore}`,
      reward: { gold, ore, energy: gained },
    };
  }
  if (!validInt(index, 0, daily.quests.length - 1)) throw Error("ไม่พบภารกิจ");
  const q = daily.quests[index];
  if (q.claimed) throw Error("รับรางวัลแล้ว");
  if (q.progress < q.goal) throw Error("ภารกิจยังไม่สำเร็จ");
  q.claimed = true;
  const base = questReward(q, p.level),
    { gained, spare } = grantEnergy(p, t, base.energy || 0),
    reward = { ...base, ore: base.ore + spare, energy: gained };
  p.gold += reward.gold;
  p.inventory.ore = (p.inventory.ore || 0) + reward.ore;
  exp(p, reward.exp);
  savePlayer(p);
  return {
    message: `รับรางวัล · +${reward.gold} ทอง · +${reward.exp} EXP · แร่ ×${reward.ore}${base.energy ? `` : ""}`,
    reward,
  };
}
// Legacy energy rewards now grant bonus ore; dungeon entry is unlimited.
function grantEnergy(p, t, amount) {
  return { gained: 0, spare: amount * ENERGY_OVERFLOW_ORE };
}

// Anything in the bag can go on sale: potions and ore by the stack, and any
// owned gear that is not equipped (starter gear is bound to its class).
const SHOP_STOCK = ["hp", "mp", "ore"],
  SHOP_LIMIT = 12;
// Stalls opened on the old, shorter town map move to the current free spots.
db.transaction(() => {
  const taken = new Set(),
    move = [];
  for (const s of db.prepare("SELECT id,x FROM shops ORDER BY rowid").all())
    if (SHOP_SPOTS.includes(s.x) && !taken.has(s.x)) taken.add(s.x);
    else move.push(s);
  for (const s of move) {
    const x = SHOP_SPOTS.find((v) => !taken.has(v));
    if (x === undefined) break;
    taken.add(x);
    db.prepare("UPDATE shops SET x=? WHERE id=?").run(x, s.id);
  }
})();
export function sellable(c, item) {
  if (SHOP_STOCK.includes(item)) return c.inventory[item] || 0;
  if (!GEAR[item] || item.startsWith("starter_")) return 0;
  if (!c.ownedEquipment.includes(item)) return 0;
  return Object.values(c.equipment || {}).includes(item) ? 0 : 1;
}
function takeStock(c, item, qty) {
  if (sellable(c, item) < qty)
    throw Error(
      GEAR[item] && Object.values(c.equipment || {}).includes(item)
        ? "ถอดอุปกรณ์ก่อนวางขาย"
        : "ไอเทมไม่พอ",
    );
  if (SHOP_STOCK.includes(item)) c.inventory[item] -= qty;
  else c.ownedEquipment = c.ownedEquipment.filter((id) => id !== item);
}
function giveStock(c, item, qty) {
  if (SHOP_STOCK.includes(item))
    c.inventory[item] = (c.inventory[item] || 0) + qty;
  else if (!c.ownedEquipment.includes(item)) c.ownedEquipment.push(item);
}
function validListing({ item, qty, price }) {
  const gear = !!GEAR[item] && !SHOP_STOCK.includes(item);
  if (
    (!SHOP_STOCK.includes(item) && !gear) ||
    !validInt(qty, 1, gear ? 1 : 999) ||
    !validInt(price, 1, 1000000)
  )
    throw Error("ข้อมูลสินค้าไม่ถูกต้อง");
}
function ownShop(p) {
  return db.prepare("SELECT * FROM shops WHERE owner=?").get(p.id);
}
function addListing(p, shopId, listing) {
  const count = db
    .prepare("SELECT COUNT(*) n FROM shop_listings WHERE shop=? AND qty>0")
    .get(shopId).n;
  if (count >= SHOP_LIMIT)
    throw Error("วางขายได้สูงสุด " + SHOP_LIMIT + " รายการ");
  const c = loadCharacter(p.id);
  takeStock(c, listing.item, listing.qty);
  persist(c);
  const id = randomUUID();
  db.prepare("INSERT INTO shop_listings VALUES(?,?,?,?,?,?)").run(
    id,
    shopId,
    listing.item,
    listing.qty,
    listing.price,
    Date.now(),
  );
  return id;
}
const stockName = (item) => ITEMS[item]?.name || GEAR[item]?.name || item;
export function createShop(p, { name, item, price, qty, listings, key }) {
  ensureTown(p);
  const stock = listings ?? [{ item, qty, price }];
  if (
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.length > 35 ||
    !Array.isArray(stock) ||
    stock.length < 1 ||
    stock.length > SHOP_LIMIT
  )
    throw Error("ข้อมูลร้านไม่ถูกต้อง");
  stock.forEach(validListing);
  const result = atomic(p.id, "shop:create", key, () => {
    if (
      db
        .prepare(
          "SELECT s.id FROM shops s JOIN characters c ON c.id=s.owner WHERE c.user_id=?",
        )
        .get(p.userId)
    )
      throw Error("เปิดได้หนึ่งร้านต่อบัญชี");
    const used = db
        .prepare("SELECT x FROM shops")
        .all()
        .map((s) => s.x),
      x = SHOP_SPOTS.find((v) => !used.includes(v));
    if (!x) throw Error("พื้นที่ร้านเต็ม");
    const id = randomUUID();
    db.prepare(
      "INSERT INTO shops(id,owner,name,item,qty,price,x) VALUES(?,?,?,NULL,0,1,?)",
    ).run(id, p.id, name.trim(), x);
    const ids = stock.map((l) => addListing(p, id, l));
    return { message: "เปิดร้านแล้ว สินค้าถูกเก็บเข้าร้าน", id, listings: ids };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function listShopItem(p, { item, qty, price, key }) {
  ensureTown(p);
  validListing({ item, qty, price });
  const result = atomic(p.id, "shop:list", key, () => {
    const s = ownShop(p);
    if (!s) throw Error("ยังไม่มีร้าน");
    const id = addListing(p, s.id, { item, qty, price });
    return { message: "วางขาย " + stockName(item) + " แล้ว", id };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function unlistShopItem(p, { id, key }) {
  ensureTown(p);
  const result = atomic(p.id, "shop:unlist", key, () => {
    const l = db
      .prepare(
        "SELECT l.* FROM shop_listings l JOIN shops s ON s.id=l.shop WHERE l.id=? AND s.owner=?",
      )
      .get(id, p.id);
    if (!l) throw Error("ไม่พบสินค้านี้ในร้าน");
    const c = loadCharacter(p.id);
    giveStock(c, l.item, l.qty);
    persist(c);
    db.prepare("DELETE FROM shop_listings WHERE id=?").run(l.id);
    return { message: "เก็บ " + stockName(l.item) + " คืนกระเป๋าแล้ว" };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function buyShop(p, { id, qty = 1, key }) {
  ensureTown(p);
  if (!validInt(qty, 1, 999)) throw Error("จำนวนไม่ถูกต้อง");
  let ownerId = null;
  const result = atomic(p.id, "shop:buy", key, () => {
    // Older clients send the shop id: buy from its first listing.
    const l =
      db.prepare("SELECT * FROM shop_listings WHERE id=?").get(id) ||
      db
        .prepare(
          "SELECT * FROM shop_listings WHERE shop=? AND qty>0 ORDER BY created",
        )
        .get(id);
    if (!l || l.qty < qty) throw Error(l?.qty ? "สินค้าเหลือไม่พอ" : "สินค้าหมดแล้ว");
    const s = db.prepare("SELECT * FROM shops WHERE id=?").get(l.shop);
    if (s.owner === p.id) throw Error("ซื้อสินค้าจากร้านตัวเองไม่ได้");
    const c = loadCharacter(p.id),
      seller = loadCharacter(s.owner),
      total = l.price * qty;
    if (GEAR[l.item] && c.ownedEquipment.includes(l.item))
      throw Error("มีอุปกรณ์ชิ้นนี้อยู่แล้ว");
    if (c.gold < total) throw Error("ทองไม่พอ");
    c.gold -= total;
    giveStock(c, l.item, qty);
    seller.gold += total;
    persist(c);
    persist(seller);
    db.prepare("UPDATE shop_listings SET qty=qty-? WHERE id=?").run(qty, l.id);
    db.prepare("DELETE FROM shop_listings WHERE id=? AND qty=0").run(l.id);
    db.prepare("UPDATE shops SET sold=sold+?, earned=earned+? WHERE id=?").run(
      qty,
      total,
      s.id,
    );
    ownerId = s.owner;
    return {
      message: `ซื้อ ${stockName(l.item)} ×${qty} จาก ${s.name} สำเร็จ`,
      total,
    };
  });
  invalidateShops();
  sync(p);
  const seller = live(
    ownerId ??
      db
        .prepare(
          "SELECT s.owner FROM shop_listings l JOIN shops s ON s.id=l.shop WHERE l.id=?",
        )
        .get(id)?.owner,
  );
  if (seller) sync(seller);
  return result;
}
export function closeShop(p, key) {
  ensureTown(p);
  const result = atomic(p.id, "shop:close", key, () => {
    const s = ownShop(p);
    if (!s) throw Error("ยังไม่มีร้าน");
    const c = loadCharacter(p.id);
    for (const l of db
      .prepare("SELECT * FROM shop_listings WHERE shop=?")
      .all(s.id))
      giveStock(c, l.item, l.qty);
    persist(c);
    db.prepare("DELETE FROM shop_listings WHERE shop=?").run(s.id);
    db.prepare("DELETE FROM shops WHERE id=?").run(s.id);
    return {
      message: `ปิดร้านแล้ว · ขายได้รวม ${s.earned} ทอง · คืนสินค้าที่เหลือแล้ว`,
    };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function potion(p, type = "hp", t = now()) {
  if (!POTIONS[type] || p.hp <= 0) throw Error("ยังใช้ยาไม่ได้");
  p.potionCd ??= {};
  const left = POTIONS[type].cooldown - (t - (p.potionCd[type] || 0));
  if (left > 0)
    throw Error(`ยา ${type.toUpperCase()} ยังไม่พร้อม · อีก ${Math.ceil(left)} วิ`);
  const training = instances.get(p.instance)?.training;
  if (!p.inventory[type] && !training) throw Error("ยาหมด");
  if (
    (type === "hp" && p.hp >= maxHp(p)) ||
    (type === "mp" && p.mp >= maxMp(p))
  )
    throw Error("พลังเต็มแล้ว");
  if (!training) p.inventory[type]--;
  p.potionCd[type] = t;
  if (type === "hp") p.hp = Math.min(maxHp(p), p.hp + POTIONS.hp.restore);
  else p.mp = Math.min(maxMp(p), p.mp + POTIONS.mp.restore);
  if (!training) persist(p);
}
export function makeRuntime(c, socket) {
  initializeGear(c);
  return {
    ...c,
    socket,
    x: 480,
    y: WORLD.ground,
    vy: 0,
    vx: 0,
    running: false,
    action: null,
    pending: null,
    hitAt: 0,
    diedAt: 0,
    reviveAt: 0,
    direction: 1,
    input: 0,
    jump: false,
    grounded: true,
    area: "town",
    instance: null,
    auto: false,
    attackAt: 0,
    cooldowns: {},
    bestiary: c.bestiary || {},
    lastInput: 0,
    lastSeq: -1,
    hp: maxHp(c),
    mp: maxMp(c),
  };
}
export function stored(p) {
  const fields = [
    "class",
    "gender",
    "gold",
    "inventory",
    "upgrade",
    "enhancements",
    "energy",
    "armor",
    "weapon",
    "level",
    "exp",
    "unlocked",
    "quest",
    "equipment",
    "ownedEquipment",
    "specialization",
    "advanced",
    "daily",
    "bestiary",
    "nightClear",
    "attrs",
    "statResets",
  ];
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    ...Object.fromEntries(fields.map((f) => [f, p[f]])),
  };
}
export function savePlayer(p) {
  persist(stored(p));
}
function dungeonEnergy(p, t) {
  const full = { points: DUNGEON_ENERGY_MAX, nextAt: null };
  if (!p.energy || p.energy.points >= full.points) return full;
  if (t < p.energy.nextAt) return p.energy;
  const recovered = 1 + Math.floor((t - p.energy.nextAt) / DUNGEON_ENERGY_INTERVAL);
  const points = p.energy.points + recovered;
  return points >= full.points
    ? full
    : { points, nextAt: p.energy.nextAt + recovered * DUNGEON_ENERGY_INTERVAL };
}
export function beginDungeon(p, floor) {
  if (!validInt(floor, 1, FLOORS.length)) throw Error("ชั้นไม่ถูกต้อง");
  const party = parties.get(p.party),
    members = party ? party.members.map(live).filter(Boolean) : [p];
  if (party && party.leader !== p.id) throw Error("ให้หัวหน้าปาร์ตี้เริ่มดันเจียน");
  if (members.some((m) => m.area !== "town" || m.unlocked < floor || m.hp <= 0))
    throw Error("สมาชิกต้องอยู่เมืองและปลดล็อกชั้นนี้แล้ว");
  if (party && members.some((m) => m.id !== p.id && !party.ready.has(m.id)))
    throw Error("สมาชิกทุกคนต้องกดพร้อมก่อน");
  openInstance(members, floor, 1);
  if (party) party.ready.clear();
  return { message: "เข้าสู่ " + FLOORS[floor - 1].name };
}
// The night cave: free, boss stage only, open while it is night.
export function beginNightCave(p) {
  const sky = skyNow();
  if (!sky.night) throw Error("ถ้ำลึกลับปรากฏเฉพาะตอนกลางคืน");
  const party = parties.get(p.party),
    members = party ? party.members.map(live).filter(Boolean) : [p];
  if (party && party.leader !== p.id) throw Error("ให้หัวหน้าปาร์ตี้พาเข้าถ้ำ");
  if (members.some((m) => m.area !== "town" || m.hp <= 0))
    throw Error("สมาชิกทุกคนต้องอยู่ในเมือง");
  if (p.x > NIGHT_CAVE.x + NIGHT_CAVE.reach)
    throw Error("เดินไปที่ปากถ้ำลึกลับก่อน");
  if (party && members.some((m) => m.id !== p.id && !party.ready.has(m.id)))
    throw Error("สมาชิกทุกคนต้องกดพร้อมก่อน");
  const boss = nightBoss(sky.cycle);
  openInstance(members, nightFloor(members), 3, {
    night: { ...boss, cycle: sky.cycle },
  });
  if (party) party.ready.clear();
  return { message: "ก้าวเข้าสู่ถ้ำลึกลับ… " + boss.name + " ตื่นแล้ว!" };
}
function openInstance(members, floor, stage, extra = {}) {
  const id = randomUUID(),
    instance = {
      id,
      floor,
      stage,
      ...extra,
      members: members.map((m) => m.id),
      enemies: [],
      clear: false,
      completed: false,
      events: [],
      emptyAt: null,
    };
  instances.set(id, instance);
  instance.startedAt = now();
  instance.rewards = Object.fromEntries(
    members.map((m) => [
      m.id,
      { gold: 0, exp: 0, ore: 0, items: [], damage: 0 },
    ]),
  );
  instance.killCount = 0;
  spawnStage(instance);
  for (const m of members) enterInstance(m, instance);
  return instance;
}
function enterInstance(m, instance) {
  {
    m.area = "dungeon";
    m.instance = instance.id;
    m.x = 380;
    m.y = 600;
    m.hp = maxHp(m);
    m.mp = maxMp(m);
    m.auto = false;
    m.action = null;
    m.pending = null;
    m.diedAt = 0;
    m.reviveAt = 0;
    m.hitAt = 0;
    m.grounded = true;
    m.vx = 0;
    m.vy = 0;
    m.jump = false;
    m.input = 0;
  }
}
export function beginTraining(p) {
  ensureTown(p);
  const id = randomUUID();
  const i = {
    id,
    floor: 1,
    stage: 1,
    members: [p.id],
    enemies: [],
    clear: false,
    completed: false,
    training: true,
    events: [],
  };
  instances.set(id, i);
  spawnTraining(i);
  p.area = "dungeon";
  p.instance = id;
  p.x = 460;
  p.y = 600;
  p.vx = 0;
  p.vy = 0;
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  p.action = null;
  p.pending = null;
  p.auto = false;
  p.diedAt = 0;
  p.reviveAt = 0;
  p.hitAt = 0;
  p.grounded = true;
  p.jump = false;
  p.input = 0;
  return { message: "สนามฝึก · สไลม์ไม่มีรางวัล ฝึกได้โดยไม่เสียความคืบหน้า" };
}
function spawnTraining(i) {
  i.clear = false;
  i.enemies = [
    {
      id: randomUUID(),
      type: "slime",
      x: 900,
      y: 600,
      hp: 180,
      maxHp: 180,
      boss: false,
      direction: -1,
      attackAt: now(),
      action: null,
      hitAt: 0,
      spawnAt: now(),
    },
  ];
  i.respawnAt = 0;
}
function spawnStage(i) {
  i.clear = false;
  i.clearedAt = 0;
  i.stageAt = now();
  i.enemies = [];
  i.hazards = [];
  i.nextHazardAt = now() + 4;
  i.streak = 0;
  i.streakUntil = 0;
  i.defeated = 0;
  i.lastDrop = null;
  const count = i.world ? 1 : dungeonEnemyCount(i.floor, i.stage);
  for (let n = 0; n < count; n++) {
    // Stage 3: the boss first, then its guards; other stages fill the arena.
    const boss = i.stage === 3 && n === 0,
      slot = i.stage === 3 ? n - 1 : n,
      elite = !boss && isElite(i.floor, i.stage, slot),
      entry = boss ? null : rosterEntry(i.floor, slot + i.stage),
      trait = entry?.variant?.trait || null,
      mods = traitOf({ trait }),
      base = boss && i.world
        ? WORLD_BOSS.hp
        : boss
        ? Math.round(
            (300 + i.floor * 220 + i.floor * i.floor * 55) *
              1.2 *
              (i.night ? NIGHT_BOSS.hp : 1),
          )
        : (55 + i.floor * 24 + i.stage * 14) * MONSTER_HP,
      max = Math.round(base * (elite ? 2.2 : 1) * (mods.hp || 1)),
      spot = dungeonSpawn(i.floor, i.stage, slot, boss, count);
    i.enemies.push({
      id: randomUUID(),
      ...spot,
      homeX: spot.x,
      homeY: spot.y,
      grounded: true,
      hp: max,
      maxHp: max,
      type: boss
        ? i.world?.type || i.night?.type || FLOORS[i.floor - 1].bossType
        : entry.type,
      night: boss && !!i.night,
      world: boss && !!i.world,
      power: boss ? (i.world ? WORLD_BOSS.damage : i.night ? NIGHT_BOSS.damage : 1) : 1,
      variant: entry?.variant?.name || null,
      trait,
      boss,
      elite,
      aggro: boss,
      speed: boss
        ? 75
        : Math.round((85 + i.floor * 5 + (elite ? 15 : 0)) * (mods.speed || 1)),
      spawnAt: now() + n * 0.06,
      attackCount: 0,
      direction: -1,
      // No swings while the loading card is still up (cooldown ~1-1.4 s).
      attackAt: now() + STAGE_INTRO - 1,
    });
  }
  i.totalEnemies = i.enemies.length;
  i.events = [];
  i.signs = dungeonSigns(i.floor, i.stage);
  i.collectedSigns = new Map();
}
export function useDungeonSign(p, data) {
  const i = instances.get(p.instance);
  const sign = i?.signs?.find((entry) => entry.id === data?.id);
  if (
    !sign ||
    i.id !== data.instanceId ||
    i.floor !== data.floor ||
    i.stage !== data.stage ||
    !i.members.includes(p.id) ||
    p.hp <= 0 ||
    p.auto ||
    now() - i.stageAt < STAGE_INTRO ||
    !withinDungeonSign(p, sign)
  )
    throw Error("เข้าใกล้จุดสำรวจแล้วกดใช้งาน");

  const collected = i.collectedSigns.get(p.id) || new Set();
  if (collected.has(sign.id)) throw Error("สำรวจจุดนี้แล้ว");
  let message;
  if (i.stage === 1) {
    p.hp = Math.min(maxHp(p), p.hp + Math.ceil(maxHp(p) * 0.35));
    p.mp = Math.min(maxMp(p), p.mp + Math.ceil(maxMp(p) * 0.5));
    message = "เปิดกล่องเสบียง · ฟื้น HP และ MP";
  } else if (collected.size + 1 === i.signs.length) {
    const gold = 20 + i.floor * 5;
    const inventory = { ...p.inventory, ore: p.inventory.ore + 1 };
    questEvents(i, p, advanceQuests(p, wallClock(), "rune"), sign.x ?? p.x, p.y - 150, now());
    persist({ ...stored(p), gold: p.gold + gold, inventory });
    p.gold += gold;
    p.inventory = inventory;
    i.rewards[p.id].gold += gold;
    i.rewards[p.id].ore++;
    message = `ไขผนึกรูนสำเร็จ · +${gold} ทอง · แร่ ×1`;
  } else {
    message = `เก็บรูน ${collected.size + 1} / ${i.signs.length}`;
  }
  collected.add(sign.id);
  i.collectedSigns.set(p.id, collected);
  return { message };
}
// The client shows a loading card for ~1.5 s (plus a 0.45 s fade) when the
// stage changes, so heroes on auto and the monsters hold off until it clears.
export const STAGE_INTRO = 2;
// After the last monster falls, auto waits this long before moving on so the
// death animation and loot drops are actually seen.
export const CLEAR_LINGER = 2.6;
export function nextStage(p) {
  const i = instances.get(p.instance);
  if (!i || !i.clear) throw Error("กำจัดมอนสเตอร์ให้หมดก่อน");
  if (i.training) {
    spawnTraining(i);
    return { message: "เริ่มฝึกรอบใหม่" };
  }
  if (i.stage === 3) {
    if (!i.completed || !i.results) throw Error("รอสรุปผลก่อน");
    if (i.members.length > 1 && parties.get(p.party)?.leader !== p.id)
      throw Error("ให้หัวหน้าปาร์ตี้เลือกไปชั้นถัดไป");
    if (i.night || i.world || i.floor >= FLOORS.length) return returnTown(p);
    const members = i.members.map(live).filter(Boolean);
    if (members.some((m) => m.unlocked < i.floor + 1))
      throw Error("สมาชิกยังไม่ปลดล็อกชั้นถัดไป");
      i.floor++;
    i.stage = 0;
    i.completed = false;
    i.results = null;
    i.startedAt = now();
    i.killCount = 0;
    i.rewards = Object.fromEntries(
      i.members.map((id) => [
        id,
        { gold: 0, exp: 0, ore: 0, items: [], damage: 0 },
      ]),
    );
  }
  const newFloor = i.stage === 0;
  i.stage++;
  spawnStage(i);
  for (const id of i.members) {
    const m = live(id);
    if (m) {
      m.x = 380;
      m.y = 600;
      m.vx = 0;
      m.vy = 0;
      m.grounded = true;
      m.jump = false;
      m.input = 0;
      m.hitAt = 0;
      m.pending = null;
      m.action = null;
      m.hp = Math.min(maxHp(m), m.hp + 40);
      m.mp = Math.min(maxMp(m), m.mp + 35);
    }
  }
  return {
    message: newFloor
      ? "ลงสู่ชั้น " + i.floor + " · " + FLOORS[i.floor - 1].name
      : "เข้าสู่ด่าน " + i.stage,
  };
}
export function returnTown(p) {
  if (p.instance) {
    const i = instances.get(p.instance);
    if (i) {
      i.members = i.members.filter((id) => id !== p.id);
      if (!i.members.length && !i.world) instances.delete(i.id);
    }
  }
  p.area = "town";
  p.instance = null;
  p.auto = false;
  p.x = 480;
  p.action = null;
  p.pending = null;
  p.diedAt = 0;
  p.reviveAt = now();
  p.hitAt = 0;
  p.grounded = true;
  p.jump = false;
  p.input = 0;
  p.vx = 0;
  p.y = 600;
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  p.vy = 0;
  return { message: "กลับเมืองหน้าถ้ำหลวง" };
}
function exp(p, n) {
  p.exp += n;
  while (p.exp >= p.level * 80 && p.level < 40) {
    p.exp -= p.level * 80;
    p.level++;
    // Auto play spends the new status points along the class build.
    if (p.auto) autoStats(p, true);
    p.hp = maxHp(p);
    p.mp = maxMp(p);
  }
}
export const grantExp = exp;
// Status points (shared/stats.js). Raises are { str: 2, agi: 1 }.
export function raiseStats(p, adds) {
  applyRaise(p, adds);
  savePlayer(p);
  return { message: "อัพสเตตัสแล้ว", attrs: baseStats(p), statPoints: freePoints(p) };
}
export function autoStats(p, quiet = false) {
  const adds = autoPlan(p);
  if (!Object.keys(adds).length) {
    if (quiet) return null;
    throw Error("แต้มสเตตัสไม่พอ");
  }
  applyRaise(p, adds);
  if (!quiet) savePlayer(p);
  return { message: "อัพสเตตัสตามสายแล้ว", adds };
}
export function resetStats(p) {
  ensureTown(p);
  const cost = resetCost(p);
  if (p.gold < cost) throw Error(`รีเซ็ตต้องใช้ ${cost} ทอง`);
  if (!Object.values(baseStats(p)).some((v) => v > 1)) throw Error("ยังไม่ได้อัพสเตตัส");
  p.gold -= cost;
  p.statResets = (p.statResets || 0) + 1;
  p.attrs = null;
  p.hp = Math.min(p.hp, maxHp(p));
  p.mp = Math.min(p.mp, maxMp(p));
  savePlayer(p);
  log(p.id, "stats:reset", { cost });
  return { message: cost ? `รีเซ็ตสเตตัสแล้ว (−${cost} ทอง)` : "รีเซ็ตสเตตัสฟรีแล้ว" };
}
// Attacks per second multiplier: AGI, plus the archer's lightning draw.
function aspdOf(p, t) {
  return combatStats(p).aspd * (t < (p.lightningUntil || 0) ? 1 + LIGHTNING.aspd : 1);
}
export function attack(p, skill = 0, t = now()) {
  if (
    !ACTIONS[skill] ||
    p.area !== "dungeon" ||
    statusActive(p, "stun", t) ||
    p.hp <= 0 ||
    t - (p.hitAt || 0) < 0.14 ||
    p.pending ||
    (p.action && t < p.action.endsAt)
  )
    return;
  const spec = ACTIONS[skill],
    i = instances.get(p.instance);
  // AGI speeds up the basic attack (ASPD); DEX shortens a skill's cast.
  const stats = combatStats(p),
    tempo = skill ? 1 : aspdOf(p, t),
    windup = skill ? spec.windup * (1 - stats.cast) : spec.windup / tempo,
    recovery = spec.recovery / tempo,
    cooldown = spec.cooldown / tempo;
  if (
    !i ||
    i.clear ||
    t - (p.cooldowns[skill] || 0) < cooldown ||
    p.mp < spec.mp
  )
    return;
  p.cooldowns[skill] = t;
  p.mp -= spec.mp;
  p.attackAt = t;
  p.combo = skill
    ? 0
    : t - (p.lastSlash || 0) < 1.2
      ? ((p.combo || 0) + 1) % 3
      : 0;
  p.lastSlash = t;
  p.action = {
    kind: skill ? "skill" : "attack",
    skill,
    combo: p.combo,
    direction: p.direction,
    startedAt: t,
    impactAt: t + windup,
    endsAt: t + windup + recovery,
  };
  p.pending = { ...p.action };
}
function resolveAttack(p, t) {
  const a = p.pending;
  if (!a || t < a.impactAt) return;
  p.pending = null;
  const i = instances.get(p.instance),
    c = CLASSES[p.class],
    skill = a.skill;
  if (!i || i.clear || p.hp <= 0) return;
  // Archer AGI: a basic shot may loose a second arrow (double strafe).
  const twin = combatStats(p).double,
    double = !skill && twin > 0 && Math.random() < twin;
  i.events.push({
    id: randomUUID(),
    kind: "attack",
    double,
    actorId: p.id,
    x: p.x,
    y: p.y - 50,
    color: c.color,
    direction: a.direction,
    class: p.class,
    // 1 base, 2 specialization, 3 advanced: the client scales skill FX by it.
    tier: heroTier(p),
    skill,
    range: combatStats(p).range + ACTIONS[skill].rangeBonus,
    combo: a.combo,
    at: t,
  });
  const kit = skillOf(p.class, skill);
  if (kit.buff) {
    // Party buff: everyone alive in this instance.
    for (const id of i.members) {
      const m = live(id);
      if (!m || m.hp <= 0) continue;
      m.buffs = {
        ...(m.buffs || {}),
        [kit.buff]: { until: t + kit.duration, power: 1 + combatStats(p).heal },
      };
      i.events.push({
        id: randomUUID(),
        kind: "buff",
        targetId: m.id,
        actorId: p.id,
        buff: kit.buff,
        x: m.x,
        y: m.y - 120,
        at: t,
      });
    }
    return;
  }
  const range = combatStats(p).range + ACTIONS[skill].rangeBonus;
  const stats = combatStats(p),
    critChance = stats.crit + (buffActive(p, "focus", t) ? BUFFS.focus.crit : 0),
    rage = buffActive(p, "rage", t) ? 1 + BUFFS.rage.damage : 1;
  let hits = 0,
    anyCrit = false;
  for (const e of i.enemies) {
    if (
      e.hp <= 0 ||
      Math.abs(e.x - p.x) > range ||
      Math.abs(e.y - p.y) > 130 ||
      ((e.x - p.x) * a.direction < -35 && skill !== 3)
    )
      continue;
    if ((p.class === "archer" || p.class === "priest") && skill < 2 && hits > 0) continue;
    // Every strike of a skill rolls its own crit, like a stack of numbers.
    const mult =
        (t < (e.exposedUntil || 0) ? 1.5 : 1) *
        (traitOf(e).taken || 1) *
        (statusActive(e, "weaken", t) ? STATUSES.weaken.taken : 1) *
        rage,
      lines = Array.from({ length: kit.hits * (double ? 2 : 1) }, () => {
        const crit = Math.random() < critChance;
        return {
          amount: Math.max(
            1,
            // ±8% spread so a stack never reads as one number repeated.
            Math.floor(
              damage(stats.atk, i.floor * 5, kit.power) *
                (crit ? stats.critDamage : 1) *
                mult *
                (0.92 + Math.random() * 0.16),
            ),
          ),
          crit,
        };
      }),
      amount = lines.reduce((n, l) => n + l.amount, 0),
      crit = lines.some((l) => l.crit);
    anyCrit ||= crit;
    if (e.boss) creditWorld(i, p.id, Math.min(amount, e.hp));
    e.hp -= amount;
    const status = e.hp > 0 && applyStatus(e, kit.status, lines[0].amount, t) ? kit.status.type : null;
    if (status && e.status[status]) e.status[status].by = p.id;
    if (status && STATUSES[status].control) e.action = null;
    e.hitAt = t;
    e.aggro = true;
    e.hitDirection = a.direction;
    e.x = Math.max(
      70,
      Math.min(
        WORLD.width - 70,
        e.x + a.direction * (e.boss ? 2 : skill ? 24 : 10),
      ),
    );
    hits++;
    i.events.push({
      id: randomUUID(),
      kind: "damage",
      targetId: e.id,
      actorId: p.id,
      x: e.x,
      y: e.y - 80,
      amount,
      crit,
      lines,
      status,
      double,
      at: t,
    });
    if (e.hp <= 0) enemyDown(i, e, t);
  }
  // Archer AGI 40+: a crit quickens the next shots (lightning draw).
  if (anyCrit && statEffects(p).lightning) {
    if (t >= (p.lightningUntil || 0))
      i.events.push({ id: randomUUID(), kind: "status", targetId: p.id, status: "lightning", x: p.x, y: p.y - 130, at: t });
    p.lightningUntil = t + LIGHTNING.duration;
  }
  if (kit.heal) healParty(i, kit.heal * (1 + stats.heal), t);
  checkClear(i, t, p);
}
// Restores a share of max HP to every living hero in the instance.
function healParty(i, share, t) {
  for (const id of i.members) {
    const m = live(id);
    if (!m || m.hp <= 0) continue;
    const amount = Math.min(maxHp(m) - m.hp, Math.round(maxHp(m) * share));
    if (amount <= 0) continue;
    m.hp += amount;
    i.events.push({ id: randomUUID(), kind: "heal", targetId: m.id, x: m.x, y: m.y - 110, amount, at: t });
  }
}
// A monster fell: count it, pay every hero in the instance, advance quests.
function enemyDown(i, e, t) {
  if (e.hp <= 0 && !i.training) {
    i.killCount = (i.killCount || 0) + 1;
    i.lastDrop = { x: e.x, y: e.y - 70 };
    i.defeated = (i.defeated || 0) + 1;
    i.streak = t <= (i.streakUntil || 0) ? i.streak + 1 : 1;
    i.streakUntil = t + 5;
    const bonus = Math.min(4, i.streak - 1);
    if (bonus)
      i.events.push({
        id: randomUUID(),
        kind: "streak",
        x: e.x,
        y: e.y - 115,
        streak: i.streak,
        bonus,
        at: t,
      });
    for (const id of i.members) {
      const m = live(id);
      if (m && m.hp > 0) {
        const gold =
            (e.boss
              ? 28 + i.floor * 10
              : Math.round((4 + i.floor) * KILL_PAY) * (e.elite ? 2 : 1)) + bonus,
          gained = e.boss ? 110 : Math.round((e.elite ? 45 : 20) * KILL_PAY),
          reward = i.rewards?.[m.id];
        // LUK finds a little more gold.
        const found = Math.round(gold * (1 + statEffects(m).gold));
        m.gold += found;
        m.mp = Math.min(maxMp(m), m.mp + (bonus ? 4 : 0));
        if (reward) {
          reward.gold += found;
          reward.exp += gained;
        }
        exp(m, gained);
        i.events.push({
          id: randomUUID(),
          kind: "drop",
          actorId: m.id,
          x: e.x - 24,
          y: e.y - 45,
          item: "gold",
          at: t,
        });
        if (Math.random() < (e.boss ? 0.5 : e.elite ? 0.35 : 0.12)) {
          m.inventory.ore++;
          if (i.rewards?.[m.id]) i.rewards[m.id].ore++;
          i.events.push({
            id: randomUUID(),
            kind: "drop",
            actorId: m.id,
            x: e.x + 32,
            y: e.y - 55,
            item: "ore",
            at: t,
          });
        }
        const wall = wallClock(),
          done = advanceQuests(m, wall, "killAny");
        if (!e.boss) {
          done.push(...advanceQuests(m, wall, "kill", e.type));
          const stars = recordKill(m, e.type);
          if (stars)
            i.events.push({
              id: randomUUID(),
              kind: "bestiary",
              actorId: m.id,
              type: e.type,
              stars,
              x: e.x,
              y: e.y - 150,
              at: t,
            });
        }
        if (e.elite) done.push(...advanceQuests(m, wall, "elite"));
        questEvents(i, m, done, e.x, e.y - 130, t);
        savePlayer(m);
      }
    }
  }
}
// The last monster fell: clear the stage, and finish the run after a boss.
function checkClear(i, t, p) {
  if (i.world && !i.enemies.some((e) => e.boss && e.hp > 0)) {
    i.bossMaxHp ??= i.enemies.find((e) => e.boss)?.maxHp;
    i.enemies = [];
  }
  i.enemies = i.enemies.filter((e) => e.hp > 0);
  if (!i.enemies.length) {
    if (!i.clear) i.clearedAt = t;
    i.clear = true;
    if (i.stage === 3 && !i.completed && !i.training) {
      i.completed = true;
      for (const id of i.members) {
        const m = live(id);
        if (m && (i.night || i.world)) {
          if (i.night) nightRewards(i, m, t);
          savePlayer(m);
          continue;
        }
        if (m) {
          const firstClear = m.quest < i.floor;
          m.unlocked = Math.min(
            FLOORS.length,
            Math.max(m.unlocked, i.floor + 1),
          );
          m.gold += 40;
          if (i.rewards?.[m.id]) i.rewards[m.id].gold += 40;
          // Deep floors keep dropping the floor-10 legendary pool.
          const deep = i.floor > MAIN_FLOORS,
            item = rollBossLoot(m, deep ? MAIN_FLOORS : i.floor, firstClear && !deep);
          if (item) {
            m.ownedEquipment.push(item);
            i.rewards?.[m.id]?.items.push(item);
            i.events.push({
              id: randomUUID(),
              kind: "loot",
              actorId: m.id,
              x: i.lastDrop?.x ?? m.x,
              y: i.lastDrop?.y ?? m.y - 110,
              item,
              rarity: GEAR[item].rarity,
              at: t,
            });
          } else {
            const ore = deep ? 2 + (i.floor - MAIN_FLOORS) : i.floor >= 6 ? 2 : 1;
            if (i.rewards?.[m.id]) i.rewards[m.id].ore += ore;
            m.inventory.ore = (m.inventory.ore || 0) + ore;
            i.events.push({
              id: randomUUID(),
              kind: "material",
              actorId: m.id,
              x: i.lastDrop?.x ?? m.x,
              y: i.lastDrop?.y ?? m.y - 110,
              item: "ore",
              amount: ore,
              at: t,
            });
          }
          if (
            i.floor === 3 &&
            firstClear &&
            !m.ownedEquipment.includes("cavern_charm")
          ) {
            m.ownedEquipment.push("cavern_charm");
            i.rewards?.[m.id]?.items.push("cavern_charm");
            i.events.push({
              id: randomUUID(),
              kind: "loot",
              actorId: m.id,
              x: i.lastDrop?.x ?? m.x,
              y: i.lastDrop?.y ?? m.y - 110,
              item: "cavern_charm",
              rarity: GEAR.cavern_charm.rarity,
              at: t,
            });
          }
          m.quest = Math.max(m.quest, i.floor);
          questEvents(
            i,
            m,
            advanceQuests(m, wallClock(), "boss"),
            m.x,
            m.y - 160,
            t,
          );
          savePlayer(m);
        }
      }
      if (i.world) worldBossDown(i, t);
      const seconds = Math.max(0, Math.round(t - i.startedAt));
      i.results = Object.fromEntries(
        i.members.map((id) => {
          const rewards = i.rewards?.[id] || {
            gold: 0,
            exp: 0,
            ore: 0,
            items: [],
            damage: 0,
          };
          const m = live(id);
          if (m) {
            m.auto = false;
            m.input = 0;
            m.pending = null;
            m.action = null;
          }
          return [
            id,
            {
              floor: i.floor,
              seconds,
              defeated: i.killCount,
              ...rewards,
              ...dungeonRank(
                seconds,
                i.killCount,
                rewards.damage,
                i.floor,
                m ? maxHp(m) : 100,
              ),
              night: i.night?.name || null,
              world: i.world
                ? {
                    name: i.world.name,
                    place: i.ranking?.find((r) => r.id === id)?.place || null,
                    share: i.ranking?.find((r) => r.id === id)?.share || 0,
                    heroes: i.ranking?.length || 0,
                  }
                : null,
              hasNext:
                !i.night &&
                !i.world &&
                i.floor < FLOORS.length &&
                i.members
                  .map(live)
                  .filter(Boolean)
                  .every((x) => x.unlocked >= i.floor + 1),
            },
          ];
        }),
      );
      log(p?.id ?? null, "boss:clear", { floor: i.floor, instance: i.id });
    }
  }
}
export function onlineRoster() {
  return [...players.values()].map(p => ({ id: p.id, name: p.name, class: p.class, level: p.level, area: p.area, inParty: !!p.party }));
}

export const partyInvites = new Map();
export function partyAction(p, { action, target, inviteId }) {
  if (["invite", "accept", "decline"].includes(action)) {
    ensureTown(p);
    if (action === "invite") {
      const other = live(target);
      if (!other || other.id === p.id || other.area !== "town" || other.party) throw Error("ผู้เล่นนี้ยังรับคำเชิญไม่ได้");
      const existing = parties.get(p.party);
      if (existing && (existing.leader !== p.id || existing.members.length >= 3)) throw Error("เฉพาะหัวหน้าทีมที่มีที่ว่างเท่านั้นที่ชวนได้");
      const pending = partyInvites.get(other.id);
      if (pending?.expires > now()) throw Error("ผู้เล่นนี้มีคำเชิญรอตอบอยู่");
      if (!existing) partyAction(p, { action: "create" });
      partyInvites.set(other.id, { id: randomUUID(), from: p.id, party: p.party, expires: now() + 30 });
      return { message: "ส่งคำเชิญปาร์ตี้แล้ว" };
    }
    const invite = partyInvites.get(p.id);
    if (!invite || invite.id !== inviteId) throw Error("ไม่พบคำเชิญนี้");
    partyInvites.delete(p.id);
    if (action === "decline") return { message: "ปฏิเสธคำเชิญแล้ว" };
    const party = parties.get(invite.party);
    if (invite.expires <= now() || !live(invite.from) || party?.leader !== invite.from) throw Error("คำเชิญหมดอายุแล้ว");
    return partyAction(p, { action: "join", target: invite.party });
  }
  if (action === "create") {
    if (p.party) throw Error("อยู่ในปาร์ตี้แล้ว");
    const id = randomUUID();
    parties.set(id, { id, leader: p.id, members: [p.id], ready: new Set() });
    p.party = id;
    return { message: "สร้างปาร์ตี้แล้ว ให้เพื่อนกดเข้าร่วม" };
  }
  const party = parties.get(action === "join" ? target : p.party);
  if (!party) throw Error("ไม่พบปาร์ตี้");
  if (action === "join") {
    if (
      p.party ||
      party.members.length >= 3 ||
      p.area !== "town" ||
      party.members.some((id) => live(id)?.area !== "town")
    )
      throw Error("เข้าปาร์ตี้ไม่ได้");
    party.members.push(p.id);
    p.party = party.id;
  } else if (action === "ready") {
    if (p.area !== "town") throw Error("กดพร้อมในเมือง");
    party.ready.has(p.id) ? party.ready.delete(p.id) : party.ready.add(p.id);
  } else if (action === "leave") {
    if (p.area !== "town") throw Error("กลับเมืองก่อนออกปาร์ตี้");
    party.members = party.members.filter((id) => id !== p.id);
    party.ready.delete(p.id);
    p.party = null;
    if (!party.members.length) parties.delete(party.id);
    else if (party.leader === p.id) party.leader = party.members[0];
  }
  return { message: "อัปเดตปาร์ตี้แล้ว" };
}
export function tradeAction(
  p,
  { action, target, id, gold = 0, item = "ore", qty = 0, revision },
) {
  ensureTown(p);
  if (action === "request") {
    const other = live(target);
    if (
      !other ||
      other.id === p.id ||
      other.area !== "town" ||
      [...trades.values()].some(
        (t) => t.members.includes(p.id) || t.members.includes(other.id),
      )
    )
      throw Error("ผู้เล่นนี้ยังแลกเปลี่ยนไม่ได้");
    const t = {
      id: randomUUID(),
      members: [p.id, other.id],
      accepted: false,
      revision: 0,
      offers: {
        [p.id]: { gold: 0, item: "ore", qty: 0 },
        [other.id]: { gold: 0, item: "ore", qty: 0 },
      },
      confirmed: [],
      final: [],
      expires: Date.now() + 180000,
    };
    trades.set(t.id, t);
    return { message: "ส่งคำขอแลกเปลี่ยนแล้ว" };
  }
  const t = trades.get(id);
  if (!t || !t.members.includes(p.id) || Date.now() > t.expires)
    throw Error("รายการหมดอายุ");
  if (action === "cancel") {
    trades.delete(t.id);
    return { message: "ยกเลิกรายการ" };
  }
  if (action === "accept") {
    if (t.members[1] !== p.id) throw Error("ให้ผู้รับคำขอตอบรับ");
    t.accepted = true;
  } else if (action === "offer") {
    if (
      !t.accepted ||
      !validInt(gold, 0, 1000000) ||
      !validInt(qty, 0, 999) ||
      !["hp", "mp", "ore"].includes(item)
    )
      throw Error("ข้อเสนอไม่ถูกต้อง");
    if (p.gold < gold || p.inventory[item] < qty) throw Error("ทรัพย์สินไม่พอ");
    t.offers[p.id] = { gold, item, qty };
    t.revision++;
    t.confirmed = [];
    t.final = [];
  } else if (action === "confirm" || action === "final") {
    if (!t.accepted || revision !== t.revision)
      throw Error("รายการเปลี่ยน กรุณาตรวจสอบใหม่");
    if (action === "confirm") {
      if (!t.confirmed.includes(p.id)) t.confirmed.push(p.id);
    } else {
      if (t.confirmed.length !== 2) throw Error("ทั้งสองฝ่ายต้องยืนยันรอบแรก");
      if (!t.final.includes(p.id)) t.final.push(p.id);
      if (t.final.length === 2) {
        db.transaction(() => {
          const chars = t.members.map(loadCharacter);
          if (
            chars.some((c) => !c) ||
            t.members.some((id) => live(id)?.area !== "town")
          )
            throw Error("ผู้เล่นไม่พร้อม");
          for (const c of chars) {
            const o = t.offers[c.id];
            if (c.gold < o.gold || c.inventory[o.item] < o.qty)
              throw Error("ทรัพย์สินเปลี่ยนไป");
          }
          for (let n = 0; n < 2; n++) {
            const c = chars[n],
              other = chars[1 - n],
              o = t.offers[c.id];
            c.gold -= o.gold;
            other.gold += o.gold;
            c.inventory[o.item] -= o.qty;
            other.inventory[o.item] = (other.inventory[o.item] || 0) + o.qty;
          }
          chars.forEach(persist);
          log(p.id, "trade:complete", {
            id: t.id,
            revision: t.revision,
            offers: t.offers,
          });
        })();
        for (const id of t.members) {
          const m = live(id);
          if (m) sync(m);
        }
        trades.delete(t.id);
        return { message: "แลกเปลี่ยนสำเร็จ" };
      }
    }
  }
  return { message: "อัปเดตการแลกเปลี่ยนแล้ว" };
}
export function disconnect(p) {
  partyInvites.delete(p.id);
  for (const [id, invite] of partyInvites) if (invite.from === p.id) partyInvites.delete(id);
  savePlayer(p);
  returnTown(p);
  if (p.party) partyAction(p, { action: "leave" });
  for (const [id, t] of trades) if (t.members.includes(p.id)) trades.delete(id);
}
function physics(p, dt, t) {
  const previous = p.y;
  if (p.grounded) p.lastGroundAt = t;
  if (p.jump) p.jumpBufferedAt = t;
  const actionSlow = p.action && t < p.action.endsAt ? 0.36 : 1;
  const target =
    p.input * combatStats(p).speed * (p.running ? 1.25 : 0.78) * actionSlow;
  const acceleration = (p.grounded ? (p.input ? 1900 : 2400) : 900) * dt;
  p.vx =
    (p.vx || 0) +
    Math.sign(target - (p.vx || 0)) *
      Math.min(Math.abs(target - (p.vx || 0)), acceleration);
  p.x = Math.max(45, Math.min(areaWidth(p.area) - 45, p.x + p.vx * dt));
  if (
    p.hp > 0 &&
    t - (p.jumpBufferedAt || 0) < 0.13 &&
    (p.grounded || t - (p.lastGroundAt || 0) < 0.1)
  ) {
    p.vy = p.area === "dungeon" ? -DUNGEON_JUMP : -650;
    p.grounded = false;
    p.lastGroundAt = -100;
    p.jumpBufferedAt = -100;
  }
  p.jump = false;
  p.vy += 1150 * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  let floor = WORLD.ground;
  if (p.vy >= 0)
    for (const platform of p.area === "town"
      ? WORLD.platforms
      : dungeonPlatforms(
          instances.get(p.instance)?.floor,
          instances.get(p.instance)?.stage,
          instances.get(p.instance)?.training,
        ))
      if (
        p.x >= platform.x &&
        p.x <= platform.x + platform.w &&
        previous <= platform.y + 2 &&
        p.y >= platform.y
      )
        floor = Math.min(floor, platform.y);
  if (p.y >= floor && p.vy >= 0) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  }
  if (p.action && t < p.action.endsAt) p.direction = p.action.direction;
  else if (p.input) p.direction = Math.sign(p.input);
}
// Monsters whose bite leaves a status on heroes.
const VENOM = {
  serpent: { type: "poison", chance: 0.35, duration: 5 },
  mushroom: { type: "poison", chance: 0.3, duration: 5 },
  wolf: { type: "bleed", chance: 0.3, duration: 4 },
  golem: { type: "slow", chance: 0.3, duration: 2.5 },
};
// Damage-over-time ticks once a second. Heroes never die to it (min 1 HP).
function tickStatuses(i, x, t, hero) {
  for (const [type, s] of Object.entries(x.status || {})) {
    if (t >= s.until) {
      delete x.status[type];
      continue;
    }
    if (!s.dps || t < s.tickAt) continue;
    s.tickAt = t + 1;
    let amount = s.dps * s.stacks;
    if (hero) amount = Math.min(amount, x.hp - 1);
    if (amount <= 0) continue;
    if (!hero && x.boss) creditWorld(i, s.by, Math.min(amount, x.hp));
    x.hp -= amount;
    i.events.push({
      id: randomUUID(),
      kind: "damage",
      targetId: x.id,
      x: x.x,
      y: x.y - 80,
      amount: hero ? -amount : amount,
      status: type,
      tick: true,
      at: t,
    });
  }
}
// All damage and rewards stay authoritative, including environmental attacks.
// AGI flee and LUK perfect dodge against a monster's swing (halved against
// bosses). A dodge shows MISS over the hero.
export function dodged(i, p, e, t, roll = Math.random()) {
  const stats = combatStats(p),
    chance = Math.min(0.4, stats.flee + stats.perfect) * (e.boss ? 0.5 : 1);
  if (roll >= chance) return false;
  i.events.push({ id: randomUUID(), kind: "miss", targetId: p.id, x: p.x, y: p.y - 95, at: t });
  return true;
}
function dealDungeonDamage(i, p, base, actorId, direction, t, status = null) {
  const guard = buffActive(p, "barrier", t) ? 1 - BUFFS.barrier.guard : 1,
    amount = Math.max(1, Math.round(damage(base, combatStats(p).def) * guard));
  if (i.rewards?.[p.id]) i.rewards[p.id].damage += Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - amount);
  p.hitAt = t;
  p.hitDirection = direction;
  p.pending = null;
  p.action = null;
  i.streak = 0;
  i.streakUntil = 0;
  i.events.push({
    id: randomUUID(),
    kind: "damage",
    targetId: p.id,
    actorId,
    x: p.x,
    y: p.y - 85,
    amount: -amount,
    at: t,
  });
  if (p.hp > 0 && status && applyStatus(p, status, amount, t)) {
    if (status.type === "stun") {
      p.input = 0;
      p.pending = null;
    }
    i.events.push({
      id: randomUUID(),
      kind: "status",
      targetId: p.id,
      status: status.type,
      x: p.x,
      y: p.y - 130,
      at: t,
    });
  }
  if (!p.hp) {
    p.diedAt = t;
    p.auto = false;
    p.input = 0;
    savePlayer(p);
  }
  return amount;
}
function updateCrystalHazards(i, t) {
  if (i.training || i.clear) {
    i.hazards = [];
    return;
  }
  i.hazards = (i.hazards || []).filter((h) => t < h.endsAt);
  const active = i.members.map(live).filter((p) => p?.hp > 0);
  if (!active.length) return;
  if (t >= i.nextHazardAt && !i.hazards.length) {
    const p = active[(i.defeated || 0) % active.length];
    i.hazards.push({
      id: randomUUID(),
      x: Math.max(160, Math.min(2240, p.x + (p.direction || 1) * 100)),
      radius: 110,
      startedAt: t,
      impactAt: t + 1.2,
      endsAt: t + 1.65,
      resolved: false,
    });
    i.nextHazardAt = t + (i.stage === 2 ? 4.5 : 6);
  }
  for (const h of i.hazards) {
    if (h.resolved || t < h.impactAt) continue;
    h.resolved = true;
    for (const p of active)
      if (Math.abs(p.x - h.x) < h.radius && Math.abs(p.y - WORLD.ground) < 65)
        dealDungeonDamage(
          i,
          p,
          15 + i.floor * 3,
          h.id,
          Math.sign(p.x - h.x) || 1,
          t,
        );
    i.events.push({
      id: randomUUID(),
      kind: "eruption",
      x: h.x,
      y: WORLD.ground,
      radius: h.radius,
      at: t,
    });
  }
}
export function tick(dt, t = now()) {
  for (const p of players.values()) {
    if (p.hp <= 0) {
      p.input = 0;
      p.pending = null;
      p.action = null;
      physics(p, dt, t);
      continue;
    }
    if (t - p.lastInput > 0.3) p.input = 0;
    const i = instances.get(p.instance);
    if (i && p.status) tickStatuses(i, p, t, true);
    // Blessing: regen once a second while it lasts.
    if (i && buffActive(p, "blessing", t) && t >= (p.regenAt || 0)) {
      p.regenAt = t + 1;
      const amount = Math.min(maxHp(p) - p.hp, Math.round(maxHp(p) * BUFFS.blessing.regen * (p.buffs.blessing.power || 1)));
      if (amount > 0) {
        p.hp += amount;
        i.events.push({ id: randomUUID(), kind: "heal", targetId: p.id, x: p.x, y: p.y - 110, amount, at: t });
      }
    }
    if (statusActive(p, "stun", t)) p.input = 0;
    if (p.auto && i) {
      if (t - (i.stageAt || 0) < STAGE_INTRO) {
        // Still behind the loading card: stand still, don't swing yet.
        p.input = 0;
      } else if (i.enemies.some((e) => e.hp > 0)) {
        const plan = autoBrain(p, i, t, {
          range: combatStats(p).range,
          mpMax: maxMp(p),
          aspd: aspdOf(p, t),
          platforms: dungeonPlatforms(i.floor, i.stage, i.training),
        });
        p.input = plan.input;
        p.running = true;
        if (plan.jump && p.grounded) p.jumpBufferedAt = t;
        // Turn only between swings so a windup keeps its aim.
        if (!p.action || t >= p.action.endsAt) p.direction = plan.direction;
        if (plan.skill !== null) attack(p, plan.skill, t);
        if (p.hp < maxHp(p) * 0.4 && (p.inventory.hp || i.training)) {
          try {
            potion(p);
          } catch {}
        }
        if (p.mp < 20 && (p.inventory.mp || i.training)) {
          try {
            potion(p, "mp");
          } catch {}
        }
      } else if (
        i.clear &&
        !i.completed &&
        t - (i.clearedAt || 0) > CLEAR_LINGER &&
        t - (p.nextAt || 0) > 2
      ) {
        p.nextAt = t;
        nextStage(p);
      }
    }
    resolveAttack(p, t);
    if (statusActive(p, "stun", t)) p.input = 0;
    physics(p, dt, t);
    // VIT and INT regenerate a little HP / MP every tick.
    const fx = statEffects(p);
    p.mp = Math.min(maxMp(p), p.mp + dt * (2 + fx.mpRegen));
    if (fx.hpRegen) p.hp = Math.min(maxHp(p), p.hp + dt * fx.hpRegen);
  }
  updateWorldBoss();
  for (const i of instances.values()) {
    i.events = i.events.filter((e) => t - e.at < 1.2);
    if (i.world && !i.clear) worldSummons(i, t);
    if (i.training && i.clear) {
      if (!i.respawnAt) i.respawnAt = t + 2.5;
      if (t >= i.respawnAt) spawnTraining(i);
    }
    updateCrystalHazards(i, t);
    if (!i.clear) {
      for (const e of i.enemies) {
        if (!e.status || e.hp <= 0) continue;
        tickStatuses(i, e, t, false);
        if (e.hp <= 0) enemyDown(i, e, t);
      }
      if (i.enemies.some((e) => e.hp <= 0)) {
        const m = i.members.map(live).find(Boolean);
        if (m || i.world) checkClear(i, t, m);
        else i.enemies = i.enemies.filter((e) => e.hp > 0);
      }
    }
    for (const e of i.enemies) {
      const p = i.members
        .map(live)
        .filter((p) => p && p.hp > 0)
        .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
      e.moving = false;
      const mods = traitOf(e),
        frenzied = mods.frenzy && e.hp <= e.maxHp * 0.5;
      if (controlled(e, t)) {
        e.action = null;
        continue;
      }
      const slowed = statusActive(e, "slow", t) ? STATUSES.slow.speed : 1;
      if (mods.regen && e.hp > 0 && t - (e.hitAt || 0) > 3 && !e.status?.burn && !e.status?.poison && !e.status?.bleed)
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * mods.regen * dt);
      if (!p) {
        e.action = null;
        continue;
      }
      // Monsters guard their spot until a hero comes close, then call the pack.
      if (!e.aggro && !i.training) {
        const reach = e.type === "bat" ? 340 : 280;
        if (Math.abs(p.x - e.x) < reach && Math.abs(p.y - e.y) < 280) {
          e.aggro = true;
          for (const o of i.enemies)
            if (!o.aggro && Math.abs(o.x - e.x) < 130) o.aggro = true;
        }
      }
      if (!e.aggro && !i.training) {
        const homeX = e.homeX ?? e.x,
          goal = homeX + Math.sin(t * 0.6 + (e.spawnAt || 0) * 7) * 55;
        enemyStep(
          e,
          { x: e.x, y: (e.homeY ?? e.y) + 45 },
          dungeonPlatforms(i.floor, i.stage),
          dt,
          t,
        );
        if (Math.abs(goal - e.x) > 4) {
          e.direction = Math.sign(goal - e.x);
          e.x += e.direction * 30 * dt;
          e.moving = true;
        }
        continue;
      }
      enemyStep(e, p, dungeonPlatforms(i.floor, i.stage, i.training), dt, t);
      const distance = p.x - e.x;
      if (e.action) {
        const a = e.action;
        if (!a.resolved && t >= a.impactAt) {
          a.resolved = true;
          if (a.kind === "slam") {
            let landed = false;
            for (const id of i.members) {
              const target = live(id);
              if (
                target?.hp > 0 &&
                Math.abs(target.x - a.x) < a.radius &&
                Math.abs(target.y - WORLD.ground) < 65
              ) {
                landed = true;
                dealDungeonDamage(
                  i,
                  target,
                  Math.round((30 + i.floor * 6) * (e.power || 1)),
                  e.id,
                  a.direction,
                  t,
                  { type: "stun", chance: 1, duration: 0.9 },
                );
              }
            }
            if (!landed) e.exposedUntil = a.endsAt + 2.2;
            i.events.push({
              id: randomUUID(),
              kind: "eruption",
              x: a.x,
              y: WORLD.ground,
              radius: a.radius,
              at: t,
            });
          } else if (
            Math.abs(p.x - e.x) < (e.boss ? 130 : 100) &&
            Math.abs(p.y - e.y) < 100 &&
            !dodged(i, p, e, t)
          ) {
            const dealt = dealDungeonDamage(
              i,
              p,
              i.training
                ? 18
                : e.boss
                  ? Math.round((28 + i.floor * 6) * (e.power || 1))
                  : Math.round(
                      (15 + i.floor * 4) *
                        (e.elite ? 1.5 : 1) *
                        (mods.damage || 1) *
                        (frenzied ? 1.3 : 1),
                    ),
              e.id,
              a.direction,
              t,
              VENOM[e.type],
            );
            if (mods.drain && dealt > 0) {
              const heal = Math.min(e.maxHp - e.hp, Math.round(dealt * mods.drain));
              e.hp += heal;
              if (heal > 0)
                i.events.push({
                  id: randomUUID(),
                  kind: "heal",
                  targetId: e.id,
                  x: e.x,
                  y: e.y - 90,
                  amount: heal,
                  at: t,
                });
            }
          }
        }
        if (t >= a.endsAt) e.action = null;
        continue;
      }
      if (t < (e.exposedUntil || 0)) continue;
      e.direction = Math.sign(distance) || 1;
      if (t - (e.hitAt || 0) < 0.14) continue;
      const enraged = e.boss && e.hp <= e.maxHp * 0.5;
      const slam = e.boss && (e.attackCount || 0) % 3 === 0;
      // Climbing: walk to the next stair step; otherwise close in on the hero.
      const climbing = e.goalX !== undefined && e.goalX !== p.x,
        chase = (e.goalX ?? p.x) - e.x,
        step = climbing
          ? Math.abs(chase) > 4
            ? Math.sign(chase)
            : 0
          : Math.abs(distance) > 70
            ? Math.sign(distance)
            : 0;
      if (step) {
        e.x +=
          step *
          (e.boss ? (enraged ? 110 : 75) : (e.speed || 90) * (frenzied ? 1.4 : 1)) *
          slowed *
          dt;
        e.moving = true;
      }
      if (
        Math.abs(distance) < (slam ? 650 : e.boss ? 115 : 82) &&
        (slam || Math.abs(p.y - e.y) < 110) &&
        t - e.attackAt >
          (e.boss
            ? enraged
              ? 1.05
              : 1.4
            : Math.max(0.95, 1.4 - Math.min(i.floor, 12) * 0.03) *
              (e.elite ? 0.85 : 1) *
              (mods.cooldown || 1) *
              (frenzied ? 0.7 : 1)) /
            slowed
      ) {
        e.attackAt = t;
        e.attackCount = (e.attackCount || 0) + 1;
        e.action = {
          kind: slam ? "slam" : "attack",
          x: p.x,
          radius: enraged ? 195 : 165,
          direction: e.direction,
          startedAt: t,
          impactAt: t + (slam ? 0.95 : 0.42),
          endsAt: t + (slam ? 1.3 : 0.72),
        };
      }
    }
  }
  for (const [id, tr] of trades) if (Date.now() > tr.expires) trades.delete(id);
}
export function snapshot(p) {
  const t = now(),
    stats = combatStats(p),
    i = instances.get(p.instance),
    collected = i?.collectedSigns?.get(p.id),
    party = parties.get(p.party),
    trade = [...trades.values()].find((t) => t.members.includes(p.id));
  const publicPlayer = (m) => ({
    id: m.id,
    name: m.name,
    class: m.class,
    gender: m.gender,
    specialization: m.specialization || null,
    advanced: !!m.advanced,
    x: m.x,
    y: m.y,
    direction: m.direction,
    moving: Math.abs(m.vx || 0) > 8,
    vx: m.vx || 0,
    running: m.running,
    grounded: m.grounded,
    vy: m.vy,
    action: m.action,
    hitAt: m.hitAt,
    hitDirection: m.hitDirection,
    diedAt: m.diedAt,
    reviveAt: m.reviveAt,
    hp: m.hp,
    maxHp: maxHp(m),
    level: m.level,
    equipment: m.equipment,
    upgrade: m.upgrade,
    attackAt: m.attackAt,
    buffs: m.buffs || null,
    status: m.status || null,
  });
  return {
    time: t,
    self: {
      ...publicPlayer(p),
      gold: p.gold,
      mp: p.mp,
      maxMp: stats.mp,
      exp: p.exp,
      inventory: p.inventory,
      equipment: p.equipment,
      ownedEquipment: p.ownedEquipment,
      specialization: p.specialization,
      stats,
      power: combatPower(stats),
      attrs: baseStats(p),
      statPoints: freePoints(p),
      statResets: p.statResets || 0,
      lightningUntil: p.lightningUntil || 0,
      upgrade: p.upgrade,
      enhancements: p.enhancements,
      energy: dungeonEnergy(p, t),
      weapon: p.weapon,
      armor: p.armor,
      unlocked: p.unlocked,
      quest: p.quest,
      daily: { ...ensureDaily(p, wallClock()), resetAt: questResetAt(wallClock()) },
      bestiary: p.bestiary || {},
      auto: p.auto,
      cooldowns: p.cooldowns,
      potionCd: p.potionCd || {},
    },
    area: p.area,
    players: [...players.values()]
      .filter(
        (m) => m.id !== p.id && m.area === p.area && m.instance === p.instance,
      )
      .map(publicPlayer),
    dungeon: i
      ? {
          floor: i.floor,
          stage: i.stage,
          clear: i.clear,
          completed: i.completed,
          result: i.results?.[p.id] || null,
          training: !!i.training,
          night: i.night || null,
          world: i.world || null,
          instanceId: i.id,
          enemies: i.enemies,
          hazards: i.hazards || [],
          signs:
            i.signs?.map((sign) => ({
              ...sign,
              collected: collected?.has(sign.id) ?? false,
            })) || [],
          defeated: i.defeated || 0,
          totalEnemies: i.totalEnemies || i.enemies.length,
          streak: i.streak || 0,
          streakUntil: i.streakUntil || 0,
          events: i.events,
        }
      : null,
    sky: skyNow(),
    worldBoss: worldBossView(p),
    nightCleared: p.nightClear,
    shops: shopList(),
    party: party
      ? {
          ...party,
          ready: [...party.ready],
          members: party.members.map((id) => {
            const m = live(id);
            return { id, name: m?.name, leader: id === party.leader, hp: m?.hp ?? 0, maxHp: m ? maxHp(m) : 1, area: m?.area };
          }),
        }
      : null,
    partyInvite: (() => {
      const invite = partyInvites.get(p.id);
      if (!invite || invite.expires <= t || p.party || !live(invite.from) || parties.get(invite.party)?.leader !== invite.from) {
        partyInvites.delete(p.id); return null;
      }
      return { id: invite.id, name: live(invite.from).name, expires: invite.expires };
    })(),
    parties: [...parties.values()].map((v) => ({
      id: v.id,
      name: live(v.leader)?.name,
      count: v.members.length,
    })),
    trade: trade
      ? {
          ...trade,
          names: Object.fromEntries(
            trade.members.map((id) => [id, live(id)?.name]),
          ),
        }
      : null,
    online: players.size,
  };
}
