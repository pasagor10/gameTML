import { SLOT_MACHINE } from "./slots.js";
import { rpgBonuses } from "./rpg.js";
import { townPlatforms, TOWN_SPOTS, TOWN_WIDTH } from "./town-layout.js";
export const DUNGEON_ENERGY_MAX = 5;
export const DUNGEON_ENERGY_INTERVAL = 30 * 60;
export const CLASSES = {
  swordsman: {
    name: "นักดาบ",
    icon: "⚔",
    hp: 180,
    mp: 60,
    atk: 25,
    def: 10,
    range: 130,
    speed: 240,
    color: 0xffb754,
  },
  archer: {
    name: "นักธนู",
    icon: "➶",
    hp: 140,
    mp: 90,
    atk: 21,
    def: 6,
    range: 410,
    speed: 290,
    color: 0x8cddaa,
  },
  mage: {
    name: "จอมเวท",
    icon: "✦",
    hp: 115,
    mp: 150,
    atk: 31,
    def: 4,
    range: 350,
    speed: 250,
    color: 0xbe9dff,
  },
};
export const ITEMS = {
  hp: { name: "ยาฟื้นฟู HP", icon: "🧪", price: 15 },
  mp: { name: "ยาฟื้นฟู MP", icon: "💧", price: 15 },
  ore: { name: "แร่จันทรา", icon: "💎", price: 20 },
  weapon: { name: "อาวุธผู้พิทักษ์", icon: "⚔", price: 70 },
  armor: { name: "เกราะนักเดินทาง", icon: "🛡", price: 60 },
};
// Floors 1-10 are the main story; 11-15 are the deep cave ("ห้วงลึก"),
// opened by beating floor 10, with their own monster variants (shared/dungeons.js).
export const MAIN_FLOORS = 10;
export const FLOORS = [
  { name: "ปากถ้ำต้องคำสาป", boss: "ราชาค้างคาว", color: 0x9870df, tint: 0xe5d5ff, prefix: "ค้างคาวถ้ำ", bossType: "batking", icon: "🦇" },
  { name: "ถ้ำหินเรืองแสง", boss: "ผู้พิทักษ์หิน", color: 0x64d9f7, tint: 0xddd0b8, prefix: "ศิลาผา", bossType: "golem", icon: "🪨" },
  { name: "โพรงน้ำใต้ดิน", boss: "อสรพิษถ้ำ", color: 0x52d7b8, tint: 0xafffe0, prefix: "วารี", bossType: "serpent", icon: "🐍" },
  { name: "สุสานเถาวัลย์", boss: "ราชินีรากไม้", color: 0x7abf62, tint: 0xc8efa9, prefix: "รากไพร", bossType: "batking", icon: "🌿" },
  { name: "เตาหลอมใต้พิภพ", boss: "ยักษ์เตาหลอม", color: 0xef7048, tint: 0xffb18a, prefix: "เพลิง", bossType: "golem", icon: "🔥" },
  { name: "วิหารน้ำแข็ง", boss: "ผู้พิทักษ์เหมันต์", color: 0x8fd9ef, tint: 0xbdeaff, prefix: "เหมันต์", bossType: "serpent", icon: "❄" },
  { name: "รังอัสนี", boss: "วิหคสายฟ้า", color: 0xd8ba55, tint: 0xffe7a3, prefix: "อัสนี", bossType: "batking", icon: "⚡" },
  { name: "หอเงาสะท้อน", boss: "ฝาแฝดเงา", color: 0x8c72c7, tint: 0xcab1ef, prefix: "เงา", bossType: "golem", icon: "☽" },
  { name: "ประตูมังกร", boss: "นายทวารมังกร", color: 0xb34f5e, tint: 0xffc0a3, prefix: "มังกร", bossType: "serpent", icon: "🐉" },
  { name: "หัวใจถ้ำหลวง", boss: "มังกรจันทราทมิฬ", color: 0x5f4a94, tint: 0xd4d4ff, prefix: "จันทรา", bossType: "batking", icon: "✺" },
  { name: "ห้วงน้ำไร้แสง", boss: "เจ้าแม่วารีมืด", color: 0x2f7d99, tint: 0x8fd0e8, prefix: "ห้วงน้ำ", bossType: "serpent", icon: "🌊", deep: true },
  { name: "ป่าเห็ดต้องสาป", boss: "ยักษ์เห็ดศิลา", color: 0xa4569c, tint: 0xf0b6e6, prefix: "ราสาป", bossType: "golem", icon: "🍄", deep: true },
  { name: "เหมืองเพลิงร้าง", boss: "พญาค้างคาวลาวา", color: 0xd8462c, tint: 0xff9c78, prefix: "ลาวา", bossType: "batking", icon: "🌋", deep: true },
  { name: "หุบเงาวิญญาณ", boss: "นาคาเงาวิญญาณ", color: 0x4c6f8f, tint: 0xa8c4ff, prefix: "วิญญาณ", bossType: "serpent", icon: "👻", deep: true },
  { name: "บัลลังก์จันทราดับ", boss: "จักรพรรดิหินจันทรา", color: 0x3b2c63, tint: 0xc9a8ff, prefix: "จันทราดับ", bossType: "golem", icon: "🌑", deep: true },
];
// Difficulty bands shown on the dungeon cards.
export function floorDifficulty(floor) {
  if (floor > MAIN_FLOORS) return { id: "abyss", label: "ห้วงลึก" };
  if (floor >= 8) return { id: "extreme", label: "ยากมาก" };
  if (floor >= 5) return { id: "hard", label: "ยาก" };
  if (floor >= 3) return { id: "normal", label: "ปานกลาง" };
  return { id: "easy", label: "ปกติ" };
}
export const recommendedLevel = (floor) =>
  floor > MAIN_FLOORS ? 30 + (floor - MAIN_FLOORS) * 2 : Math.max(1, floor * 3 - 2);
export const WORLD = {
  width: 2400,
  ground: 600,
  // Town ledges, NPC spots and the portal come from the kit layout.
  platforms: townPlatforms(),
  dungeonPlatforms: [
    { x: 570, y: 460, w: 230 },
    { x: 1100, y: 440, w: 260 },
    { x: 1620, y: 470, w: 210 },
  ],
  npcs: [
    {
      id: "elder",
      x: TOWN_SPOTS.elder,
      name: "ผู้ใหญ่คำ",
      role: "เควส",
      icon: "📜",
    },
    {
      id: "potion",
      x: TOWN_SPOTS.potion,
      name: "มีรา",
      role: "ร้านยา",
      icon: "🧪",
    },
    {
      id: "weapon",
      x: TOWN_SPOTS.weapon,
      name: "อริน",
      role: "ร้านอาวุธ",
      icon: "⚔",
    },
    {
      id: "forge",
      x: TOWN_SPOTS.forge,
      name: "ลุงเหล็ก",
      role: "ตีบวก",
      icon: "⚒",
    },
  ],
  portal: TOWN_SPOTS.portal.x,
  portalY: TOWN_SPOTS.portal.y,
  townWidth: TOWN_WIDTH,
};
// Player stall spots: clear of every NPC, the cave gate and each other, so
// nothing in town ever stacks on top of something else.
export const SHOP_SPOTS = (() => {
  const keepOut = [...WORLD.npcs.map((n) => [n.x, 170]), [SLOT_MACHINE.x, 155], [WORLD.portal, 280]],
    spots = [];
  for (let x = 300; x <= WORLD.townWidth - 200; x += 10)
    if (
      keepOut.every(([c, r]) => Math.abs(x - c) >= r) &&
      (!spots.length || x - spots.at(-1) >= 300)
    )
      spots.push(x);
  return spots.slice(0, 8);
})();
// Walkable width of an area: the town is as long as its kit layout.
export const areaWidth = (area) =>
  area === "town" ? WORLD.townWidth : WORLD.width;
export const maxHp = (p) =>
  CLASSES[p.class].hp + (p.level - 1) * 12 + (rpgBonuses(p).hp || 0);
export const maxMp = (p) =>
  CLASSES[p.class].mp + (p.level - 1) * 5 + (rpgBonuses(p).mp || 0);
export const damage = (atk, def, mult = 1) =>
  Math.max(1, Math.floor((atk * mult * 100) / (100 + def)));

export function combatStats(p) {
  const c = CLASSES[p.class],
    b = rpgBonuses(p);
  return {
    atk: c.atk + (p.level - 1) * 3 + (b.atk || 0),
    def: c.def + (b.def || 0),
    speed: c.speed + (b.speed || 0),
    range: c.range + (b.range || 0),
    hp: maxHp(p),
    mp: maxMp(p),
  };
}

export function combatPower(stats) {
  return Math.round(
    stats.atk * 6 +
      (stats.hp * (1 + stats.def / 100)) / 2 +
      stats.mp * 0.2 +
      stats.speed * 0.1 +
      stats.range * 0.05,
  );
}
