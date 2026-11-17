import { randomUUID } from "node:crypto";
import { db, loadCharacter, persist, atomic, log } from "./database.js";
import {
  CLASSES,
  ITEMS,
  FLOORS,
  WORLD,
  maxHp,
  maxMp,
  damage,
} from "../shared/config.js";
export const players = new Map(),
  instances = new Map(),
  parties = new Map(),
  trades = new Map();
const now = () => Date.now() / 1000;
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
    if (["weapon", "armor"].includes(item)) c[item] = true;
    else c.inventory[item] = (c.inventory[item] || 0) + 1;
    persist(c);
    return { message: "ซื้อ " + ITEMS[item].name + " สำเร็จ" };
  });
  sync(p);
  return result;
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
  if (!p.inventory[type]) throw Error("ยาหมด");
  if (
    (type === "hp" && p.hp >= maxHp(p)) ||
    (type === "mp" && p.mp >= maxMp(p))
  )
    throw Error("พลังเต็มแล้ว");
  p.inventory[type]--;
  p.potionAt = now();
  if (type === "hp") p.hp = Math.min(maxHp(p), p.hp + 90);
  else p.mp = Math.min(maxMp(p), p.mp + 80);
  persist(p);
}
export function makeRuntime(c, socket) {
  return {
    ...c,
    socket,
    x: 480,
    y: WORLD.ground,
    vy: 0,
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
  if (!validInt(floor, 1, 3)) throw Error("ชั้นไม่ถูกต้อง");
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
    m.x = 180;
    m.y = 600;
    m.hp = maxHp(m);
    m.mp = maxMp(m);
    m.auto = false;
  }
  if (party) party.ready.clear();
  return { message: "เข้าสู่ " + FLOORS[floor - 1].name };
}
function spawnStage(i) {
  i.clear = false;
  i.enemies = [];
  const boss = i.stage === 3,
    count = boss ? 1 : 4 + i.floor;
  for (let n = 0; n < count; n++) {
    const max = boss ? 280 + i.floor * 140 : 45 + i.floor * 12 + i.stage * 10;
    i.enemies.push({
      id: randomUUID(),
      x: 700 + n * 230,
      y: 600,
      hp: max,
      maxHp: max,
      type: boss
        ? ["batking", "golem", "serpent"][i.floor - 1]
        : ["slime", "bat", "boar", "mushroom", "wolf", "goblin"][
            (n + i.stage + i.floor) % 6
          ],
      boss,
      direction: -1,
      attackAt: 0,
    });
  }
  i.events = [];
}
export function nextStage(p) {
  const i = instances.get(p.instance);
  if (!i || !i.clear) throw Error("กำจัดมอนสเตอร์ให้หมดก่อน");
  if (i.stage === 3) return returnTown(p);
  i.stage++;
  spawnStage(i);
  for (const id of i.members) {
    const m = live(id);
    if (m) {
      m.x = 180;
      m.y = 600;
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
export function attack(p, skill = 0) {
  if (![0, 1, 2, 3].includes(skill) || p.area !== "dungeon" || p.hp <= 0)
    return;
  const t = now(),
    c = CLASSES[p.class],
    cool = [0.45, 2, 4, 7][skill];
  if (t - (p.cooldowns[skill] || 0) < cool || p.mp < skill * 8) return;
  const i = instances.get(p.instance);
  if (!i || i.clear) return;
  p.cooldowns[skill] = t;
  p.attackAt = t;
  p.mp -= skill * 8;
  const range = c.range + (skill === 3 ? 160 : skill === 2 ? 80 : 0);
  i.events.push({
    id: randomUUID(),
    kind: "attack",
    x: p.x,
    y: p.y - 50,
    color: c.color,
    direction: p.direction,
    class: p.class,
    skill,
    at: t,
  });
  let hits = 0;
  for (const e of i.enemies) {
    if (
      e.hp <= 0 ||
      Math.abs(e.x - p.x) > range ||
      Math.abs(e.y - p.y) > 130 ||
      ((e.x - p.x) * p.direction < -35 && skill !== 3)
    )
      continue;
    if (p.class === "archer" && skill < 2 && hits > 0) continue;
    const crit = Math.random() < 0.12,
      amount =
        damage(
          c.atk + (p.level - 1) * 3 + p.upgrade * 8 + (p.weapon ? 10 : 0),
          i.floor * 5,
          [1, 1.6, 2, 2.5][skill],
        ) * (crit ? 1.5 : 1);
    e.hp -= Math.floor(amount);
    hits++;
    i.events.push({
      id: randomUUID(),
      kind: "damage",
      x: e.x,
      y: e.y - 80,
      amount: Math.floor(amount),
      crit,
      at: t,
    });
    if (e.hp <= 0) {
      for (const id of i.members) {
        const m = live(id);
        if (m && m.hp > 0) {
          m.gold += e.boss ? 50 + i.floor * 20 : 8 + i.floor * 2;
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
    if (i.stage === 3 && !i.completed) {
      i.completed = true;
      for (const id of i.members) {
        const m = live(id);
        if (m) {
          m.unlocked = Math.min(3, Math.max(m.unlocked, i.floor + 1));
          m.gold += 80;
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
function physics(p, dt) {
  const previous = p.y;
  p.x = Math.max(
    45,
    Math.min(WORLD.width - 45, p.x + p.input * CLASSES[p.class].speed * dt),
  );
  if (p.jump && p.grounded) {
    p.vy = -490;
    p.grounded = false;
  }
  p.jump = false;
  p.vy += 1150 * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  let floor = WORLD.ground;
  if (p.vy >= 0)
    for (const platform of WORLD.platforms)
      if (
        p.x >= platform.x &&
        p.x <= platform.x + platform.w &&
        previous <= platform.y + 2 &&
        p.y >= platform.y
      ) {
        floor = Math.min(floor, platform.y);
      }
  if (p.y >= floor && p.vy >= 0) {
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
  }
  if (p.input) p.direction = Math.sign(p.input);
}
export function tick(dt) {
  const t = now();
  for (const p of players.values()) {
    if (p.hp <= 0) continue;
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
          Math.abs(dist) > CLASSES[p.class].range * 0.75 ? Math.sign(dist) : 0;
        if (p.y < 540) {
          p.input = Math.sign(dist);
          p.jump = false;
        }
        attack(p, 3);
        attack(p, 2);
        attack(p, 1);
        attack(p, 0);
        if (p.hp < maxHp(p) * 0.4 && p.inventory.hp) {
          try {
            potion(p);
          } catch {}
        }
        if (p.mp < 20 && p.inventory.mp) {
          try {
            potion(p, "mp");
          } catch {}
        }
      } else if (i.clear && t - (p.nextAt || 0) > 2) {
        p.nextAt = t;
        nextStage(p);
      }
    }
    physics(p, dt);
    p.mp = Math.min(maxMp(p), p.mp + dt * 2);
  }
  for (const i of instances.values()) {
    i.events = i.events.filter((e) => t - e.at < 1.2);
    for (const e of i.enemies) {
      const targets = i.members
          .map(live)
          .filter((p) => p && p.hp > 0)
          .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x)),
        p = targets[0];
      if (!p) continue;
      const distance = p.x - e.x;
      e.direction = Math.sign(distance) || 1;
      if (Math.abs(distance) > 70)
        e.x += Math.sign(distance) * (e.boss ? 75 : 90) * dt;
      if (
        Math.abs(distance) < (e.boss ? 115 : 80) &&
        Math.abs(p.y - e.y) < 110 &&
        t - e.attackAt > 1.4
      ) {
        e.attackAt = t;
        const amount = damage(
          e.boss ? 25 + i.floor * 5 : 13 + i.floor * 3,
          CLASSES[p.class].def + (p.armor ? 15 : 0),
        );
        p.hp = Math.max(0, p.hp - amount);
        i.events.push({
          id: randomUUID(),
          kind: "damage",
          x: p.x,
          y: p.y - 85,
          amount: -amount,
          at: t,
        });
        if (!p.hp) {
          p.auto = false;
          p.input = 0;
          savePlayer(p);
        }
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
    moving: !!m.input,
    hp: m.hp,
    maxHp: maxHp(m),
    level: m.level,
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
          enemies: i.enemies,
          events: i.events,
        }
      : null,
    shops: db
      .prepare(
        "SELECT s.*,c.name AS ownerName FROM shops s JOIN characters c ON c.id=s.owner",
      )
      .all(),
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
