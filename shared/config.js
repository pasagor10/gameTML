import { SLOT_MACHINE } from "./slots.js";
import { rpgBonuses } from "./rpg.js";
import { townPlatforms, TOWN_SPOTS, TOWN_WIDTH } from "./town-layout.js";
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
export const FLOORS = [
  { name: "ปากถ้ำต้องคำสาป", boss: "ราชาค้างคาว", color: 0x9870df },
  { name: "ถ้ำหินเรืองแสง", boss: "ผู้พิทักษ์หิน", color: 0x64d9f7 },
  { name: "โพรงน้ำใต้ดิน", boss: "อสรพิษถ้ำ", color: 0x52d7b8 },
  { name: "สุสานเถาวัลย์", boss: "ราชินีรากไม้", color: 0x7abf62 },
  { name: "เตาหลอมใต้พิภพ", boss: "ยักษ์เตาหลอม", color: 0xef7048 },
  { name: "วิหารน้ำแข็ง", boss: "ผู้พิทักษ์เหมันต์", color: 0x8fd9ef },
  { name: "รังอัสนี", boss: "วิหคสายฟ้า", color: 0xd8ba55 },
  { name: "หอเงาสะท้อน", boss: "ฝาแฝดเงา", color: 0x8c72c7 },
  { name: "ประตูมังกร", boss: "นายทวารมังกร", color: 0xb34f5e },
  { name: "หัวใจถ้ำหลวง", boss: "มังกรจันทราทมิฬ", color: 0x5f4a94 },
];
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
    atk:
      c.atk +
      (p.level - 1) * 3 +
      (p.equipment?.weapon === null ? 0 : p.upgrade * 8) +
      (b.atk || 0),
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
