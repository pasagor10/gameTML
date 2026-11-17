import {
  GEAR,
  SLOTS,
  FLOOR_LOOT,
  bossLootCandidates,
  SPECIALIZATIONS,
  initializeGear,
} from "../shared/rpg.js";
import { ACTIONS } from "../shared/motion.js";
import { randomUUID } from "node:crypto";
import { db, loadCharacter, persist, atomic, log } from "./database.js";
import {
  CLASSES,
  ITEMS,
  FLOORS,
  WORLD,
  areaWidth,
  maxHp,
  maxMp,
  damage,
  combatStats,
  combatPower,
} from "../shared/config.js";
export const players = new Map(),
  instances = new Map(),
  parties = new Map(),
  trades = new Map();
const now = () => Date.now() / 1000;
// Snapshots go out 20×/s per player; shops change only via the three shop actions below.
let shopCache = null;
export function shopList() {
  return (shopCache ??= db
    .prepare(
      "SELECT s.*,c.name AS ownerName FROM shops s JOIN characters c ON c.id=s.owner",
    )
    .all());
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
      armor: saved.armor,
      weapon: saved.weapon,
      equipment: saved.equipment,
      ownedEquipment: saved.ownedEquipment,
      specialization: saved.specialization,
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
  if (legendary && random() < 0.05) return legendary;
  const regular = candidates.filter((id) => id !== legendary);
  const pool = regular.length ? regular : candidates;
  return pool[Math.floor(random() * pool.length)];
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
export function enhance(p, key) {
  ensureTown(p);
  const result = atomic(p.id, "enhance", key, () => {
    const c = loadCharacter(p.id),
      cost = (c.upgrade + 1) * 30;
    if (c.upgrade >= 10) throw Error("อุปกรณ์ถึง +10 แล้ว");
    if (c.gold < cost || (c.inventory.ore || 0) < 1)
      throw Error("ต้องมีทอง " + cost + " และแร่จันทรา 1 ชิ้น");
    c.gold -= cost;
    c.inventory.ore--;
    const chance =
        c.upgrade < 3 ? 1 : c.upgrade < 6 ? 0.7 : c.upgrade < 9 ? 0.4 : 0.15,
      success = Math.random() < chance;
    if (success) c.upgrade++;
    persist(c);
    return {
      message: success ? "ตีบวกสำเร็จ +" + c.upgrade : "ตีบวกไม่สำเร็จ ระดับเดิมคงอยู่",
      success,
    };
  });
  sync(p);
  return result;
}
export function createShop(p, { name, item, price, qty, key }) {
  ensureTown(p);
  if (
    !["hp", "mp", "ore"].includes(item) ||
    !validInt(qty, 1, 999) ||
    !validInt(price, 1, 100000) ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.length > 35
  )
    throw Error("ข้อมูลร้านไม่ถูกต้อง");
  const result = atomic(p.id, "shop:create", key, () => {
    if (
      db
        .prepare(
          "SELECT s.id FROM shops s JOIN characters c ON c.id=s.owner WHERE c.user_id=?",
        )
        .get(p.userId)
    )
      throw Error("เปิดได้หนึ่งร้านต่อบัญชี");
    const c = loadCharacter(p.id);
    if (c.inventory[item] < qty) throw Error("ไอเทมไม่พอ");
    c.inventory[item] -= qty;
    persist(c);
    const used = db
        .prepare("SELECT x FROM shops")
        .all()
        .map((s) => s.x),
      x = [440, 820, 1230, 1770, 1930].find((v) => !used.includes(v));
    if (!x) throw Error("พื้นที่ร้านเต็ม");
    const id = randomUUID();
    db.prepare("INSERT INTO shops VALUES(?,?,?,?,?,?,?)").run(
      id,
      p.id,
      name.trim(),
      item,
      qty,
      price,
      x,
    );
    return { message: "เปิดร้านแล้ว ไอเทมถูกเก็บเข้าร้าน", id };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function buyShop(p, { id, key }) {
  ensureTown(p);
  const result = atomic(p.id, "shop:buy", key, () => {
    const s = db.prepare("SELECT * FROM shops WHERE id=?").get(id);
    if (!s || s.qty < 1) throw Error("สินค้าหมดแล้ว");
    if (s.owner === p.id) throw Error("ซื้อสินค้าจากร้านตัวเองไม่ได้");
    const c = loadCharacter(p.id),
      seller = loadCharacter(s.owner);
    if (c.gold < s.price) throw Error("ทองไม่พอ");
    c.gold -= s.price;
    c.inventory[s.item] = (c.inventory[s.item] || 0) + 1;
    seller.gold += s.price;
    persist(c);
    persist(seller);
    db.prepare("UPDATE shops SET qty=qty-1 WHERE id=? AND qty>0").run(id);
    return { message: "ซื้อสินค้าจาก " + s.name + " สำเร็จ" };
  });
  invalidateShops();
  sync(p);
  const shop = db.prepare("SELECT owner FROM shops WHERE id=?").get(id);
  const seller = shop && live(shop.owner);
  if (seller) sync(seller);
  return result;
}
export function closeShop(p, key) {
  ensureTown(p);
  const result = atomic(p.id, "shop:close", key, () => {
    const s = db.prepare("SELECT * FROM shops WHERE owner=?").get(p.id);
    if (!s) throw Error("ยังไม่มีร้าน");
    const c = loadCharacter(p.id);
    c.inventory[s.item] = (c.inventory[s.item] || 0) + s.qty;
    persist(c);
    db.prepare("DELETE FROM shops WHERE id=?").run(s.id);
    return { message: "ปิดร้านและคืนสินค้าคงเหลือแล้ว" };
  });
  invalidateShops();
  sync(p);
  return result;
}
export function potion(p, type = "hp") {
  if (
    !["hp", "mp"].includes(type) ||
    p.hp <= 0 ||
    now() - (p.potionAt || 0) < 1
  )
    throw Error("ยังใช้ยาไม่ได้");
  const training = instances.get(p.instance)?.training;
  if (!p.inventory[type] && !training) throw Error("ยาหมด");
  if (
    (type === "hp" && p.hp >= maxHp(p)) ||
    (type === "mp" && p.mp >= maxMp(p))
  )
    throw Error("พลังเต็มแล้ว");
  if (!training) p.inventory[type]--;
  p.potionAt = now();
  if (type === "hp") p.hp = Math.min(maxHp(p), p.hp + 90);
  else p.mp = Math.min(maxMp(p), p.mp + 80);
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
    "armor",
    "weapon",
    "level",
    "exp",
    "unlocked",
    "quest",
    "equipment",
    "ownedEquipment",
    "specialization",
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
export function beginDungeon(p, floor) {
  if (!validInt(floor, 1, FLOORS.length)) throw Error("ชั้นไม่ถูกต้อง");
  const party = parties.get(p.party),
    members = party ? party.members.map(live).filter(Boolean) : [p];
  if (party && party.leader !== p.id) throw Error("ให้หัวหน้าปาร์ตี้เริ่มดันเจียน");
  if (members.some((m) => m.area !== "town" || m.unlocked < floor || m.hp <= 0))
    throw Error("สมาชิกต้องอยู่เมืองและปลดล็อกชั้นนี้แล้ว");
  if (party && members.some((m) => m.id !== p.id && !party.ready.has(m.id)))
    throw Error("สมาชิกทุกคนต้องกดพร้อมก่อน");
  const id = randomUUID(),
    instance = {
      id,
      floor,
      stage: 1,
      members: members.map((m) => m.id),
      enemies: [],
      clear: false,
      completed: false,
      events: [],
      emptyAt: null,
    };
  instances.set(id, instance);
  spawnStage(instance);
  for (const m of members) {
    m.area = "dungeon";
    m.instance = id;
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
  if (party) party.ready.clear();
  return { message: "เข้าสู่ " + FLOORS[floor - 1].name };
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
  i.enemies = [];
  i.hazards = [];
  i.nextHazardAt = now() + 4;
  i.streak = 0;
  i.streakUntil = 0;
  i.defeated = 0;
  const boss = i.stage === 3,
    count = boss ? 1 : 4 + i.floor,
    // Spread the pack inside the arena: 230 px apart, closer on deep floors.
    gap = Math.min(230, (WORLD.width - 850) / Math.max(1, count - 1));
  for (let n = 0; n < count; n++) {
    const max = boss
      ? 300 + i.floor * 220 + i.floor * i.floor * 55
      : 45 + i.floor * 18 + i.stage * 12;
    i.enemies.push({
      id: randomUUID(),
      x: Math.round(700 + n * gap),
      y: 600,
      hp: max,
      maxHp: max,
      type: boss
        ? ["batking", "golem", "serpent"][(i.floor - 1) % 3]
        : ["slime", "bat", "boar", "mushroom", "wolf", "goblin"][
            (n + i.stage + i.floor) % 6
          ],
      boss,
      spawnAt: now() + n * 0.06,
      attackCount: 0,
      direction: -1,
      attackAt: 0,
    });
  }
  i.totalEnemies = i.enemies.length;
  i.events = [];
}
export function nextStage(p) {
  const i = instances.get(p.instance);
  if (!i || !i.clear) throw Error("กำจัดมอนสเตอร์ให้หมดก่อน");
  if (i.training) {
    spawnTraining(i);
    return { message: "เริ่มฝึกรอบใหม่" };
  }
  if (i.stage === 3) return returnTown(p);
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
  return { message: "เข้าสู่ด่าน " + i.stage };
}
export function returnTown(p) {
  if (p.instance) {
    const i = instances.get(p.instance);
    if (i) {
      i.members = i.members.filter((id) => id !== p.id);
      if (!i.members.length) instances.delete(i.id);
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
    p.hp = maxHp(p);
    p.mp = maxMp(p);
  }
}
export function attack(p, skill = 0, t = now()) {
  if (
    !ACTIONS[skill] ||
    p.area !== "dungeon" ||
    p.hp <= 0 ||
    t - (p.hitAt || 0) < 0.14 ||
    p.pending ||
    (p.action && t < p.action.endsAt)
  )
    return;
  const spec = ACTIONS[skill],
    i = instances.get(p.instance);
  if (
    !i ||
    i.clear ||
    t - (p.cooldowns[skill] || 0) < spec.cooldown ||
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
    impactAt: t + spec.windup,
    endsAt: t + spec.windup + spec.recovery,
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
  i.events.push({
    id: randomUUID(),
    kind: "attack",
    actorId: p.id,
    x: p.x,
    y: p.y - 50,
    color: c.color,
    direction: a.direction,
    class: p.class,
    skill,
    range: combatStats(p).range + ACTIONS[skill].rangeBonus,
    combo: a.combo,
    at: t,
  });
  const range = combatStats(p).range + ACTIONS[skill].rangeBonus;
  let hits = 0;
  for (const e of i.enemies) {
    if (
      e.hp <= 0 ||
      Math.abs(e.x - p.x) > range ||
      Math.abs(e.y - p.y) > 130 ||
      ((e.x - p.x) * a.direction < -35 && skill !== 3)
    )
      continue;
    if (p.class === "archer" && skill < 2 && hits > 0) continue;
    const crit = Math.random() < 0.12,
      amount =
        damage(combatStats(p).atk, i.floor * 5, [1, 1.6, 2, 2.5][skill]) *
        (crit ? 1.5 : 1);
    e.hp -= Math.floor(amount);
    e.hitAt = t;
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
      amount: Math.floor(amount),
      crit,
      at: t,
    });
    if (e.hp <= 0 && !i.training) {
      i.defeated = (i.defeated || 0) + 1;
      i.streak = t <= (i.streakUntil || 0) ? i.streak + 1 : 1;
      i.streakUntil = t + 5;
      const bonus = Math.min(12, (i.streak - 1) * 3);
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
          m.gold += (e.boss ? 50 + i.floor * 20 : 8 + i.floor * 2) + bonus;
          m.mp = Math.min(maxMp(m), m.mp + (bonus ? 4 : 0));
          exp(m, e.boss ? 110 : 20);
          if (Math.random() < 0.4) m.inventory.ore++;
          savePlayer(m);
        }
      }
    }
  }
  i.enemies = i.enemies.filter((e) => e.hp > 0);
  if (!i.enemies.length) {
    i.clear = true;
    if (i.stage === 3 && !i.completed && !i.training) {
      i.completed = true;
      for (const id of i.members) {
        const m = live(id);
        if (m) {
          const firstClear = m.quest < i.floor;
          m.unlocked = Math.min(
            FLOORS.length,
            Math.max(m.unlocked, i.floor + 1),
          );
          m.gold += 80;
          const item = rollBossLoot(m, i.floor, firstClear);
          if (item) {
            m.ownedEquipment.push(item);
            i.events.push({
              id: randomUUID(),
              kind: "loot",
              actorId: m.id,
              x: m.x,
              y: m.y - 110,
              item,
              rarity: GEAR[item].rarity,
              at: t,
            });
          } else {
            const ore = 2 + i.floor;
            m.inventory.ore = (m.inventory.ore || 0) + ore;
            i.events.push({
              id: randomUUID(),
              kind: "material",
              actorId: m.id,
              x: m.x,
              y: m.y - 110,
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
            i.events.push({
              id: randomUUID(),
              kind: "loot",
              actorId: m.id,
              x: m.x,
              y: m.y - 110,
              item: "cavern_charm",
              rarity: GEAR.cavern_charm.rarity,
              at: t,
            });
          }
          m.quest = Math.max(m.quest, i.floor);
          savePlayer(m);
        }
      }
      log(p.id, "boss:clear", { floor: i.floor, instance: i.id });
    }
  }
}
export function partyAction(p, { action, target }) {
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
    p.vy = -650;
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
      : WORLD.dungeonPlatforms)
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
// All damage and rewards stay authoritative, including environmental attacks.
function dealDungeonDamage(i, p, base, actorId, direction, t) {
  const amount = damage(base, combatStats(p).def);
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
  if (!p.hp) {
    p.diedAt = t;
    p.auto = false;
    p.input = 0;
    savePlayer(p);
  }
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
    if (p.auto && i) {
      const enemies = i.enemies.filter((e) => e.hp > 0),
        e = enemies.sort(
          (a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x),
        )[0];
      if (e) {
        const dist = e.x - p.x;
        p.direction = Math.sign(dist) || 1;
        p.input =
          Math.abs(dist) > combatStats(p).range * 0.75 ? Math.sign(dist) : 0;
        if (p.y < 540) {
          p.input = Math.sign(dist);
          p.jump = false;
        }
        p.running = true;
        attack(p, 3, t);
        attack(p, 2, t);
        attack(p, 1, t);
        attack(p, 0, t);
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
      } else if (i.clear && t - (p.nextAt || 0) > 2) {
        p.nextAt = t;
        nextStage(p);
      }
    }
    resolveAttack(p, t);
    physics(p, dt, t);
    p.mp = Math.min(maxMp(p), p.mp + dt * 2);
  }
  for (const i of instances.values()) {
    i.events = i.events.filter((e) => t - e.at < 1.2);
    if (i.training && i.clear) {
      if (!i.respawnAt) i.respawnAt = t + 2.5;
      if (t >= i.respawnAt) spawnTraining(i);
    }
    updateCrystalHazards(i, t);
    for (const e of i.enemies) {
      const p = i.members
        .map(live)
        .filter((p) => p && p.hp > 0)
        .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
      e.moving = false;
      if (!p) {
        e.action = null;
        continue;
      }
      const distance = p.x - e.x;
      if (e.action) {
        const a = e.action;
        if (!a.resolved && t >= a.impactAt) {
          a.resolved = true;
          if (a.kind === "slam") {
            for (const id of i.members) {
              const target = live(id);
              if (
                target?.hp > 0 &&
                Math.abs(target.x - a.x) < a.radius &&
                Math.abs(target.y - WORLD.ground) < 65
              )
                dealDungeonDamage(
                  i,
                  target,
                  30 + i.floor * 6,
                  e.id,
                  a.direction,
                  t,
                );
            }
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
            Math.abs(p.y - e.y) < 100
          ) {
            dealDungeonDamage(
              i,
              p,
              i.training ? 18 : e.boss ? 25 + i.floor * 5 : 13 + i.floor * 3,
              e.id,
              a.direction,
              t,
            );
          }
        }
        if (t >= a.endsAt) e.action = null;
        continue;
      }
      e.direction = Math.sign(distance) || 1;
      if (t - (e.hitAt || 0) < 0.14) continue;
      const enraged = e.boss && e.hp <= e.maxHp * 0.5;
      const slam = e.boss && (e.attackCount || 0) % 3 === 0;
      if (Math.abs(distance) > 70) {
        e.x += Math.sign(distance) * (e.boss ? (enraged ? 110 : 75) : 90) * dt;
        e.moving = true;
      }
      if (
        Math.abs(distance) < (slam ? 650 : e.boss ? 115 : 82) &&
        (slam || Math.abs(p.y - e.y) < 110) &&
        t - e.attackAt > (enraged ? 1.05 : 1.4)
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
  const i = instances.get(p.instance),
    party = parties.get(p.party),
    trade = [...trades.values()].find((t) => t.members.includes(p.id));
  const publicPlayer = (m) => ({
    id: m.id,
    name: m.name,
    class: m.class,
    gender: m.gender,
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
  });
  return {
    time: now(),
    self: {
      ...publicPlayer(p),
      gold: p.gold,
      mp: p.mp,
      maxMp: maxMp(p),
      exp: p.exp,
      inventory: p.inventory,
      equipment: p.equipment,
      ownedEquipment: p.ownedEquipment,
      specialization: p.specialization,
      stats: combatStats(p),
      power: combatPower(combatStats(p)),
      upgrade: p.upgrade,
      weapon: p.weapon,
      armor: p.armor,
      unlocked: p.unlocked,
      quest: p.quest,
      auto: p.auto,
      cooldowns: p.cooldowns,
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
          training: !!i.training,
          instanceId: i.id,
          enemies: i.enemies,
          hazards: i.hazards || [],
          defeated: i.defeated || 0,
          totalEnemies: i.totalEnemies || i.enemies.length,
          streak: i.streak || 0,
          streakUntil: i.streakUntil || 0,
          events: i.events,
        }
      : null,
    shops: shopList(),
    party: party
      ? {
          ...party,
          ready: [...party.ready],
          members: party.members.map((id) => {
            const m = live(id);
            return { id, name: m?.name, leader: id === party.leader };
          }),
        }
      : null,
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
