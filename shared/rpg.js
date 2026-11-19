import { SKILL_KITS } from "./skills.js";
import { bestiaryBonuses } from "./quests.js";
import { costumeSet } from "./costumes.js";
export const SLOTS = {
  weapon: "อาวุธ",
  armor: "เกราะ",
  charm: "เครื่องราง",
  boots: "รองเท้า",
};
export const RARITIES = {
  common: "ทั่วไป",
  rare: "หายาก",
  epic: "มหากาพย์",
  legendary: "ตำนาน",
  divine: "เทพ",
};
export const GEAR = {
  starter_swordsman: {
    name: "ดาบนักเดินทาง",
    icon: "⚔",
    slot: "weapon",
    rarity: "common",
    class: "swordsman",
    level: 1,
    stats: {},
  },
  starter_archer: {
    name: "ธนูนักเดินทาง",
    icon: "➶",
    slot: "weapon",
    rarity: "common",
    class: "archer",
    level: 1,
    stats: {},
  },
  starter_mage: {
    name: "คทานักเดินทาง",
    icon: "✦",
    slot: "weapon",
    rarity: "common",
    class: "mage",
    level: 1,
    stats: {},
  },
  starter_priest: {
    name: "ไม้เท้านักบวช",
    icon: "✚",
    slot: "weapon",
    rarity: "common",
    class: "priest",
    level: 1,
    stats: {},
  },
  nightfang_mace: {
    name: "คทาแสงจันทร์",
    icon: "✚",
    slot: "weapon",
    rarity: "rare",
    class: "priest",
    level: 1,
    floor: 1,
    lore: "แสงเงินบนยอดคทาขับไล่ฝูงค้างคาว",
    stats: { atk: 10, mp: 12, hp: 15 },
  },
  stoneheart_mace: {
    name: "คทาศิลาศักดิ์สิทธิ์",
    icon: "✚",
    slot: "weapon",
    rarity: "rare",
    class: "priest",
    level: 3,
    floor: 2,
    lore: "หินเรืองแสงที่ผู้พิทักษ์เฝ้าไว้นับพันปี",
    stats: { atk: 16, mp: 22, hp: 25 },
  },
  serpent_mace: {
    name: "คทาธรรมวารี",
    icon: "✚",
    slot: "weapon",
    rarity: "epic",
    class: "priest",
    level: 5,
    floor: 3,
    lore: "สายน้ำใต้ถ้ำชำระพิษให้บริสุทธิ์",
    stats: { atk: 23, mp: 34, hp: 40 },
  },
  dawn_scepter: {
    name: "คทารุ่งอรุณ",
    icon: "✚",
    slot: "weapon",
    rarity: "epic",
    class: "priest",
    level: 3,
    price: 220,
    stats: { atk: 17, mp: 20, hp: 30 },
  },
  nightfang_blade: {
    name: "ดาบเขี้ยวรัตติกาล",
    icon: "⚔",
    slot: "weapon",
    rarity: "rare",
    class: "swordsman",
    level: 1,
    floor: 1,
    lore: "คมดาบโค้งจากเขี้ยวราชาค้างคาว",
    stats: { atk: 12, def: 2 },
  },
  nightfang_bow: {
    name: "ธนูปีกทมิฬ",
    icon: "➶",
    slot: "weapon",
    rarity: "rare",
    class: "archer",
    level: 1,
    floor: 1,
    lore: "สายธนูสั่นพ้องกับเสียงสะท้อนในถ้ำ",
    stats: { atk: 10, range: 35 },
  },
  nightfang_staff: {
    name: "คทาเสียงสะท้อน",
    icon: "✦",
    slot: "weapon",
    rarity: "rare",
    class: "mage",
    level: 1,
    floor: 1,
    lore: "ผลึกบนยอดคทากักเก็บเสียงเวทมนตร์",
    stats: { atk: 11, mp: 15 },
  },
  nightwing_armor: {
    name: "เกราะปีกทมิฬ",
    icon: "🛡",
    slot: "armor",
    rarity: "rare",
    level: 1,
    floor: 1,
    lore: "เกราะหนังเบาที่รับแรงกระแทกได้ดี",
    stats: { hp: 38, def: 8 },
  },
  echo_charm: {
    name: "เครื่องรางเสียงสะท้อน",
    icon: "◈",
    slot: "charm",
    rarity: "rare",
    level: 1,
    floor: 1,
    lore: "เสียงแผ่วเบาช่วยประคองพลังระหว่างต่อสู้",
    stats: { atk: 4, mp: 18 },
  },
  wingstep_boots: {
    name: "รองเท้าก้าวปีก",
    icon: "♧",
    slot: "boots",
    rarity: "rare",
    level: 1,
    floor: 1,
    lore: "เบาจนแทบไม่ได้ยินเสียงฝีเท้า",
    stats: { speed: 18, def: 4 },
  },
  guardian_weapon: {
    name: "อาวุธผู้พิทักษ์",
    icon: "⚔",
    slot: "weapon",
    rarity: "rare",
    level: 1,
    price: 70,
    stats: { atk: 10 },
  },
  traveler_armor: {
    name: "เกราะนักเดินทาง",
    icon: "🛡",
    slot: "armor",
    rarity: "common",
    level: 1,
    price: 60,
    stats: { hp: 30, def: 15 },
  },
  moon_blade: {
    name: "ดาบเสี้ยวจันทร์",
    icon: "⚔",
    slot: "weapon",
    rarity: "epic",
    class: "swordsman",
    level: 3,
    price: 220,
    stats: { atk: 22, def: 3 },
  },
  forest_bow: {
    name: "ธนูพรายพฤกษ์",
    icon: "➶",
    slot: "weapon",
    rarity: "epic",
    class: "archer",
    level: 3,
    price: 220,
    stats: { atk: 18, range: 50 },
  },
  star_staff: {
    name: "คทาดารารัตน์",
    icon: "✦",
    slot: "weapon",
    rarity: "epic",
    class: "mage",
    level: 3,
    price: 220,
    stats: { atk: 20, mp: 25 },
  },
  stoneheart_blade: {
    name: "ดาบแก่นศิลา",
    icon: "⚔",
    slot: "weapon",
    rarity: "epic",
    class: "swordsman",
    level: 3,
    floor: 2,
    lore: "หนักแน่นดุจผู้พิทักษ์หิน",
    stats: { atk: 20, def: 7 },
  },
  stoneheart_bow: {
    name: "ธนูผลึกผา",
    icon: "➶",
    slot: "weapon",
    rarity: "epic",
    class: "archer",
    level: 3,
    floor: 2,
    lore: "ลูกศรผลึกคงวิถีได้ไกลกว่าธนูทั่วไป",
    stats: { atk: 17, range: 65 },
  },
  stoneheart_staff: {
    name: "คทาหัวใจศิลา",
    icon: "✦",
    slot: "weapon",
    rarity: "epic",
    class: "mage",
    level: 3,
    floor: 2,
    lore: "แก่นผลึกช่วยรักษากระแสเวทให้มั่นคง",
    stats: { atk: 19, mp: 32 },
  },
  stoneguard_armor: {
    name: "เกราะผู้พิทักษ์ศิลา",
    icon: "🛡",
    slot: "armor",
    rarity: "epic",
    level: 3,
    floor: 2,
    lore: "แผ่นเกราะผลึกซ้อนกันเพื่อกระจายแรง",
    stats: { hp: 60, def: 16 },
  },
  quarry_boots: {
    name: "รองเท้าย่ำผา",
    icon: "♧",
    slot: "boots",
    rarity: "epic",
    level: 3,
    floor: 2,
    lore: "พื้นรองเท้าเกาะหินและรับแรงกระแทก",
    stats: { hp: 20, speed: 20, def: 8 },
  },
  serpent_blade: {
    name: "ดาบพิษอสรพิษ",
    icon: "⚔",
    slot: "weapon",
    rarity: "epic",
    class: "swordsman",
    level: 5,
    floor: 3,
    lore: "คมดาบสีน้ำเงินที่กรีดเกล็ดหินได้",
    stats: { atk: 28, def: 5 },
  },
  serpent_bow: {
    name: "ธนูเกล็ดวารี",
    icon: "➶",
    slot: "weapon",
    rarity: "epic",
    class: "archer",
    level: 5,
    floor: 3,
    lore: "เกล็ดอสรพิษช่วยส่งลูกศรอย่างเงียบงัน",
    stats: { atk: 24, range: 85 },
  },
  serpent_staff: {
    name: "คทาเนตรอสรพิษ",
    icon: "✦",
    slot: "weapon",
    rarity: "epic",
    class: "mage",
    level: 5,
    floor: 3,
    lore: "ดวงตาผลึกตอบสนองต่อพลังเวทของผู้ถือ",
    stats: { atk: 27, mp: 42 },
  },
  serpent_scale_armor: {
    name: "เกราะเกล็ดอสรพิษ",
    icon: "🛡",
    slot: "armor",
    rarity: "epic",
    level: 5,
    floor: 3,
    lore: "เกล็ดซ้อนลื่นช่วยเบี่ยงคมอาวุธ",
    stats: { hp: 82, def: 21 },
  },
  venom_charm: {
    name: "เขี้ยวพิษผนึก",
    icon: "❖",
    slot: "charm",
    rarity: "epic",
    level: 5,
    floor: 3,
    lore: "พิษที่ผนึกไว้เปลี่ยนเป็นพลังโจมตี",
    stats: { atk: 10, mp: 28 },
  },
  tidewalker_boots: {
    name: "รองเท้าย่างวารี",
    icon: "♧",
    slot: "boots",
    rarity: "epic",
    level: 5,
    floor: 3,
    lore: "เคลื่อนผ่านพื้นเปียกโดยไม่เสียจังหวะ",
    stats: { speed: 32, def: 11 },
  },
  moonheart_talisman: {
    name: "ตราหัวใจจันทรา",
    icon: "✺",
    slot: "charm",
    rarity: "legendary",
    level: 5,
    floor: 3,
    lore: "เศษแสงหายากจากส่วนลึกของโพรงน้ำ",
    stats: { hp: 55, atk: 14, mp: 35, def: 5 },
  },
  crystal_charm: {
    name: "เครื่องรางผลึกฟ้า",
    icon: "◈",
    slot: "charm",
    rarity: "rare",
    level: 1,
    price: 95,
    stats: { mp: 25, atk: 3 },
  },
  wind_boots: {
    name: "รองเท้าสายลม",
    icon: "♧",
    slot: "boots",
    rarity: "rare",
    level: 1,
    price: 85,
    stats: { speed: 25, def: 2 },
  },
  cavern_charm: {
    name: "ตราผู้พิชิตถ้ำ",
    icon: "❖",
    slot: "charm",
    rarity: "epic",
    level: 1,
    stats: { hp: 35, atk: 7, mp: 15 },
  },
};

export const FLOOR_LOOT = {
  1: {
    boss: "ราชาค้างคาว",
    weapons: {
      swordsman: "nightfang_blade",
      archer: "nightfang_bow",
      mage: "nightfang_staff",
      priest: "nightfang_mace",
    },
    pool: ["nightwing_armor", "echo_charm", "wingstep_boots"],
  },
  2: {
    boss: "ผู้พิทักษ์หิน",
    weapons: {
      swordsman: "stoneheart_blade",
      archer: "stoneheart_bow",
      mage: "stoneheart_staff",
      priest: "stoneheart_mace",
    },
    pool: ["stoneguard_armor", "crystal_charm", "quarry_boots"],
  },
  3: {
    boss: "อสรพิษถ้ำ",
    weapons: {
      swordsman: "serpent_blade",
      archer: "serpent_bow",
      mage: "serpent_staff",
      priest: "serpent_mace",
    },
    pool: [
      "serpent_scale_armor",
      "venom_charm",
      "tidewalker_boots",
      "moonheart_talisman",
    ],
  },
};

const ADVANCED_FLOOR_GEAR = [
  {
    floor: 4,
    theme: "สุสานเถาวัลย์",
    weapons: ["ดาบเพลิงเถาวัลย์", "ธนูหนามเพลิง", "คทารากเพลิง"],
    armor: "เกราะสุสานพฤกษา",
    charm: "เมล็ดหัวใจป่า",
    boots: "รองเท้ารากไพร",
  },
  {
    floor: 5,
    theme: "เตาหลอมใต้พิภพ",
    weapons: ["ดาบเตาหลอม", "ธนูสะเก็ดเพลิง", "คทาแกนลาวา"],
    armor: "เกราะหลอมเพลิง",
    charm: "หัวใจเตาหลอม",
    boots: "รองเท้าย่ำถ่าน",
  },
  {
    floor: 6,
    theme: "วิหารน้ำแข็ง",
    weapons: ["ดาบเหมันต์", "ธนูผลึกน้ำแข็ง", "คทาดาราเยือก"],
    armor: "เกราะวิหารน้ำแข็ง",
    charm: "จี้เกล็ดหิมะ",
    boots: "รองเท้าก้าวน้ำแข็ง",
  },
  {
    floor: 7,
    theme: "รังอัสนี",
    weapons: ["ดาบอัสนี", "ธนูปีกสายฟ้า", "คทาเมฆคำราม"],
    armor: "เกราะวิหคอัสนี",
    charm: "ดวงใจสายฟ้า",
    boots: "รองเท้าพายุ",
  },
  {
    floor: 8,
    theme: "หอเงาสะท้อน",
    weapons: ["ดาบเงาสะท้อน", "ธนูกระจกเงา", "คทารัตติกาล"],
    armor: "เกราะฝาแฝดเงา",
    charm: "กระจกจันทรา",
    boots: "รองเท้าก้าวเงา",
  },
  {
    floor: 9,
    theme: "ประตูมังกร",
    weapons: ["ดาบเขี้ยวมังกร", "ธนูเกล็ดมังกร", "คทาประตูมังกร"],
    armor: "เกราะนายทวาร",
    charm: "ตรามังกร",
    boots: "รองเท้าท่องเมฆ",
  },
  {
    floor: 10,
    theme: "หัวใจถ้ำหลวง",
    weapons: ["ดาบจันทราสิ้นสูญ", "ธนูจันทราสิ้นสูญ", "คทาจันทราสิ้นสูญ"],
    armor: "เกราะมังกรจันทรา",
    charm: "หัวใจถ้ำหลวง",
    boots: "รองเท้ามังกรทมิฬ",
  },
];

for (const tier of ADVANCED_FLOOR_GEAR) {
  const { floor } = tier,
    level = Math.min(20, floor * 2 - 1),
    weaponRarity = floor === 10 ? "legendary" : "epic",
    accessoryRarity = floor >= 8 ? "legendary" : "epic",
    ids = {
      swordsman: `floor_${floor}_swordsman_weapon`,
      archer: `floor_${floor}_archer_weapon`,
      mage: `floor_${floor}_mage_weapon`,
      priest: `floor_${floor}_priest_weapon`,
      armor: `floor_${floor}_armor`,
      charm: `floor_${floor}_charm`,
      boots: `floor_${floor}_boots`,
    };
  Object.assign(GEAR, {
    [ids.swordsman]: {
      name: tier.weapons[0],
      icon: "⚔",
      slot: "weapon",
      rarity: weaponRarity,
      class: "swordsman",
      level,
      floor,
      lore: `อาวุธนักดาบจาก${tier.theme}`,
      stats: { atk: 12 + floor * 5, def: 2 + Math.floor(floor / 2) },
    },
    [ids.archer]: {
      name: tier.weapons[1],
      icon: "➶",
      slot: "weapon",
      rarity: weaponRarity,
      class: "archer",
      level,
      floor,
      lore: `อาวุธนักธนูจาก${tier.theme}`,
      stats: { atk: 9 + floor * 5, range: 35 + floor * 12 },
    },
    [ids.mage]: {
      name: tier.weapons[2],
      icon: "✦",
      slot: "weapon",
      rarity: weaponRarity,
      class: "mage",
      level,
      floor,
      lore: `อาวุธจอมเวทจาก${tier.theme}`,
      stats: { atk: 11 + floor * 5, mp: 15 + floor * 7 },
    },
    [ids.priest]: {
      name: `คทาศักดิ์สิทธิ์${tier.theme}`,
      icon: "✚",
      slot: "weapon",
      rarity: weaponRarity,
      class: "priest",
      level,
      floor,
      lore: `อาวุธพระจาก${tier.theme}`,
      stats: { atk: 9 + floor * 5, mp: 12 + floor * 6, hp: 15 + floor * 10 },
    },
    [ids.armor]: {
      name: tier.armor,
      icon: "🛡",
      slot: "armor",
      rarity: floor === 10 ? "legendary" : "epic",
      level,
      floor,
      lore: `ชุดเกราะที่สร้างจากวัตถุดิบใน${tier.theme}`,
      stats: { hp: 30 + floor * 16, def: 8 + floor * 4 },
    },
    [ids.charm]: {
      name: tier.charm,
      icon: floor >= 8 ? "✺" : "❖",
      slot: "charm",
      rarity: accessoryRarity,
      level,
      floor,
      lore: `เครื่องรางที่เก็บพลังของ${tier.theme}`,
      stats: { atk: 3 + floor * 2, mp: 10 + floor * 7 },
    },
    [ids.boots]: {
      name: tier.boots,
      icon: "♧",
      slot: "boots",
      rarity: floor === 10 ? "legendary" : "epic",
      level,
      floor,
      lore: `รองเท้าสำหรับเดินทางผ่าน${tier.theme}`,
      stats: { speed: 12 + floor * 4, def: 2 + floor * 2 },
    },
  });
  FLOOR_LOOT[floor] = {
    weapons: {
      swordsman: ids.swordsman,
      archer: ids.archer,
      mage: ids.mage,
      priest: ids.priest,
    },
    pool: [ids.armor, ids.charm, ids.boots],
  };
}

// Exclusive world-boss weapons: deliberately absent from shops and floor loot.
export const WORLD_BOSS_WEAPONS = {
  swordsman: "divine_nangnon_blade",
  archer: "divine_nangnon_bow",
  mage: "divine_nangnon_staff",
  priest: "divine_nangnon_scepter",
};
for (const [job, name, icon, stats] of [
  ["swordsman", "ดาบเทพนางนอน", "⚔", { atk: 125, def: 20, hp: 150 }],
  ["archer", "ธนูเทพนางนอน", "➶", { atk: 120, range: 200, speed: 25 }],
  ["mage", "คทาเทพนางนอน", "✦", { atk: 130, mp: 180 }],
  ["priest", "คทาพรเทพนางนอน", "✚", { atk: 115, mp: 160, hp: 220 }],
]) {
  GEAR[WORLD_BOSS_WEAPONS[job]] = {
    name, icon, slot: "weapon", rarity: "legendary", class: job, level: 19,
    source: "world-boss",
    lore: "อาวุธเทพ · ได้จากการปราบเจ้าแม่นางนอน บอสโลกเท่านั้น",
    stats,
  };
}

// Celestial relics complete the world-boss weapons without entering shops.
export const GRAND_BOSS_RELICS = ["celestial_guard_armor", "celestial_heart_charm", "celestial_wing_boots"];
for (const [id, name, slot, icon, stats, attrs] of [
  [GRAND_BOSS_RELICS[0], "เกราะเทพพิทักษ์ดารา", "armor", "♜", {def:105,hp:420,mp:80}, {vit:14,str:7}],
  [GRAND_BOSS_RELICS[1], "เครื่องรางหัวใจสวรรค์", "charm", "◆", {atk:42,hp:180,mp:220}, {int:12,luk:10}],
  [GRAND_BOSS_RELICS[2], "รองเท้าปีกสุริยัน", "boots", "♧", {def:40,hp:200,speed:40}, {agi:14,dex:8}],
]) GEAR[id] = {name,slot,icon,stats,attrs,rarity:"divine",level:40,source:"celestial-boss",
  lore:"สมบัติเทพแห่งดารา · Lv.40 ขึ้นไป ลุ้น 5% หลังชนะบอสดันชั้น 10+ หรือมหาบอส 20:00 น. · สวมแล้วเปล่งรัศมีสวรรค์"};

export const DIVINE_DROP_CHANCE = .05;
export function rollDivineLoot(player, floor, random = Math.random) {
  if (player.level < 40 || floor < 10) return null;
  const pool = GRAND_BOSS_RELICS.filter(id => !player.ownedEquipment.includes(id));
  if (!pool.length || random() >= DIVINE_DROP_CHANCE) return null;
  return pool[Math.min(pool.length-1, Math.floor(random()*pool.length))];
}

// Base-stat bonuses on gear (RO style "+3 DEX"): weapons push their class's
// attack stat, other slots a fixed pair. Higher level and rarity give more,
// so two pieces that share a picture still differ by level and bonus.
const ATTR_LINES = {
  weapon: {
    swordsman: ["str", "dex"],
    archer: ["dex", "agi"],
    mage: ["int", "dex"],
    priest: ["int", "vit"],
  },
  armor: ["vit", "str"],
  charm: ["int", "luk"],
  boots: ["agi", "luk"],
};
const RARITY_ATTR = { common: 0, rare: 0, epic: 1, legendary: 2, divine: 4 };
for (const g of Object.values(GEAR)) {
  if (g.attrs || g.rarity === "common") continue;
  const lines = g.slot === "weapon" ? ATTR_LINES.weapon[g.class] : ATTR_LINES[g.slot];
  if (!lines) continue;
  const main = Math.max(1, Math.round(g.level / 3)) + RARITY_ATTR[g.rarity],
    second = Math.floor(main / 2);
  g.attrs = { [lines[0]]: main, ...(second ? { [lines[1]]: second } : {}) };
}
// Base stats added by everything the hero wears.
export function gearAttrs(p) {
  const out = {};
  for (const id of Object.values(p?.equipment || {}))
    for (const [k, v] of Object.entries(GEAR[id]?.attrs || {})) out[k] = (out[k] || 0) + v;
  return out;
}

export function bossLootCandidates(floor, job, owned = []) {
  const table = FLOOR_LOOT[floor];
  if (!table) return [];
  return [table.weapons[job], ...table.pool].filter(
    (id) => id && !owned.includes(id),
  );
}
export const SPECIALIZATIONS = {
  swordsman: [
    {
      id: "guardian",
      name: "ผู้พิทักษ์",
      role: "ยืนแนวหน้า",
      icon: "🛡",
      description: "ทนทาน รับการโจมตีให้ทีม",
      stats: { hp: 35, def: 5 },
    },
    {
      id: "duelist",
      name: "นักดาบจันทรา",
      role: "โจมตีประชิด",
      icon: "⚔",
      description: "เน้นพลังโจมตีและเคลื่อนที่เร็ว",
      stats: { atk: 7, speed: 15 },
    },
  ],
  archer: [
    {
      id: "ranger",
      name: "พรานพฤกษา",
      role: "โจมตีระยะไกล",
      icon: "➶",
      description: "ยิงไกล คุมระยะจากศัตรู",
      stats: { atk: 5, range: 60 },
    },
    {
      id: "scout",
      name: "ผู้เฝ้าพงไพร",
      role: "เคลื่อนที่คล่องตัว",
      icon: "♧",
      description: "วิ่งเร็วขึ้น หลบจังหวะอันตราย",
      stats: { speed: 35, def: 3 },
    },
  ],
  mage: [
    {
      id: "arcanist",
      name: "จอมเวทดารา",
      role: "พลังเวท",
      icon: "✦",
      description: "เร่งพลังโจมตีและพลังเวทสำรอง",
      stats: { atk: 8, mp: 20 },
    },
    {
      id: "oracle",
      name: "ผู้พยากรณ์",
      role: "เวทสายสมดุล",
      icon: "☽",
      description: "HP และ MP มากขึ้น ต่อสู้ได้นาน",
      stats: { hp: 25, mp: 40, def: 2 },
    },
  ],
  priest: [
    {
      id: "bishop",
      name: "พระผู้ประสาทพร",
      role: "ฟื้นฟูทีม",
      icon: "✙",
      description: "HP และ MP มากขึ้น ยืนหยัดให้ทีมรอด",
      stats: { hp: 30, mp: 35 },
    },
    {
      id: "templar",
      name: "พระนักรบ",
      role: "แสงสายรบ",
      icon: "☀",
      description: "แสงศักดิ์สิทธิ์ตีแรงขึ้นและทนทาน",
      stats: { atk: 6, def: 4 },
    },
  ],
};
// Q, W, E attacks and the S party buff (shared/skills.js).
export const CLASS_SKILLS = Object.fromEntries(
  Object.entries(SKILL_KITS).map(([cls, kit]) => [cls, kit.slice(1, 5)]),
);
export const ENHANCEMENT_BONUSES = {
  weapon: { atk: 8 },
  armor: { hp: 8, def: 2 },
  charm: { mp: 4, atk: 1 },
  boots: { speed: 2, def: 1 },
};
export const enhancementLevel = (p, slot) =>
  (slot === "weapon" ? p.upgrade : p.enhancements?.[slot]) || 0;
export const MAX_ENHANCE = 15;
// From +10 up a failed attempt breaks the piece back to +0.
export const ENHANCE_BREAK_LEVEL = 10;
const HIGH_CHANCES = [0.12, 0.1, 0.08, 0.06, 0.05]; // +10→11 … +14→15
export const enhancementChance = (level) =>
  level < 3 ? 1 : level < 6 ? 0.7 : level < 9 ? 0.4 : level < 10 ? 0.15
    : HIGH_CHANCES[level - 10] ?? 0;
// Weapon glow: an equipped weapon at +11 or higher lights up the hero,
// one colour per level (other slots do not count).
export const WEAPON_GLOW_LEVEL = 11;
export const weaponGlowLevel = (p) =>
  p?.equipment?.weapon && (p.upgrade || 0) >= WEAPON_GLOW_LEVEL
    ? Math.min(p.upgrade, MAX_ENHANCE)
    : 0;
export const enhancementCost = (level) => ({
  gold: (level + 1) * 30,
  ore: 1 + Math.floor(level / 3),
});
export function initializeGear(p) {
  const starter = `starter_${p.class}`;
  p.ownedEquipment = [
    ...new Set([
      starter,
      ...(p.ownedEquipment || []),
      ...(p.weapon ? ["guardian_weapon"] : []),
      ...(p.armor ? ["traveler_armor"] : []),
    ]),
  ];
  p.equipment ??= {
    weapon: p.weapon ? "guardian_weapon" : starter,
    armor: p.armor ? "traveler_armor" : null,
    charm: null,
    boots: null,
  };
  p.specialization ??= null;
  p.enhancements ??= {};
  return p;
}
export function rpgBonuses(p) {
  const stats = {};
  const equipment = p.equipment || {
    weapon: p.weapon ? "guardian_weapon" : null,
    armor: p.armor ? "traveler_armor" : null,
  };
  for (const id of Object.values(equipment))
    for (const [key, value] of Object.entries(GEAR[id]?.stats || {}))
      stats[key] = (stats[key] || 0) + value;
  for (const [slot, bonus] of Object.entries(ENHANCEMENT_BONUSES)) {
    if (!equipment[slot] && !(slot === "weapon" && !p.equipment)) continue;
    const level = enhancementLevel(p, slot);
    if (!level) continue;
    for (const [stat, points] of Object.entries(bonus))
      stats[stat] = (stats[stat] || 0) + points * level;
  }
  const spec = SPECIALIZATIONS[p.class]?.find((s) => s.id === p.specialization);
  // Tier 3 (advanced) doubles the specialization's bonus.
  const mult = spec && p.advanced ? 2 : 1;
  for (const [key, value] of Object.entries(spec?.stats || {}))
    stats[key] = (stats[key] || 0) + value * mult;
  // Monster book stars are permanent, whatever is equipped.
  for (const [key, value] of Object.entries(bestiaryBonuses(p.bestiary)))
    stats[key] = (stats[key] || 0) + value;
  return stats;
}
// Class tiers: 1 = base class, 2 = specialization (Lv.3), 3 = advanced (Lv.20).
export const ADVANCE_LEVEL = 20;
export const heroTier = (p) => (p?.specialization ? (p.advanced ? 3 : 2) : 1);
// Sprite set names to try, most specific first: the costume of this
// specialization and tier, then the lower tier, then the plain class look.
// A worn costume (p.skin, shared/costumes.js) comes before all of them.
export function heroSkins(p) {
  const base = `${p.class}-${p.gender}`,
    tier = heroTier(p),
    worn = costumeSet(p),
    spec = `${base}-${p.specialization}`,
    skins =
      tier === 1 ? [base] : tier === 3 ? [`${spec}-3`, `${spec}-2`, base] : [`${spec}-2`, base];
  return worn ? [worn, ...skins] : skins;
}
