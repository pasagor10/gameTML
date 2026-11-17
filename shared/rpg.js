export const SLOTS = {
  weapon: "อาวุธ",
  armor: "เกราะ",
  charm: "เครื่องราง",
  boots: "รองเท้า",
};
export const RARITIES = { common: "ทั่วไป", rare: "หายาก", epic: "มหากาพย์" };
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
};
export const CLASS_SKILLS = {
  swordsman: [
    { name: "คลื่นดาบ", icon: "〆", detail: "ฟันเป็นแนวหน้า · พลัง 160%" },
    { name: "ฟันทะลวง", icon: "⚔", detail: "ดาบหนักโจมตีหมู่ · พลัง 200%" },
    { name: "พลังจันทรา", icon: "☽", detail: "กวาดรอบตัว · พลัง 250%" },
  ],
  archer: [
    { name: "ศรสายลม", icon: "➶", detail: "ยิงเป้าหมายระยะไกล · พลัง 160%" },
    { name: "ศรทะลวง", icon: "⋙", detail: "ศรเจาะแนวศัตรู · พลัง 200%" },
    { name: "ฝนลูกศร", icon: "⤓", detail: "โจมตีหมู่รอบตัว · พลัง 250%" },
  ],
  mage: [
    { name: "ลูกพลัง", icon: "✧", detail: "เวทโจมตีด้านหน้า · พลัง 160%" },
    { name: "เวทระเบิด", icon: "❖", detail: "ระเบิดเวทโจมตีหมู่ · พลัง 200%" },
    { name: "พายุดารา", icon: "✦", detail: "พายุกวาดรอบตัว · พลัง 250%" },
  ],
};
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
  const spec = SPECIALIZATIONS[p.class]?.find((s) => s.id === p.specialization);
  for (const [key, value] of Object.entries(spec?.stats || {}))
    stats[key] = (stats[key] || 0) + value;
  return stats;
}
