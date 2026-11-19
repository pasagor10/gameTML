import { DEEP_DUNGEONS } from "./deep-dungeons.js";
import { SLOT_MACHINE } from "./slots.js";
import { rpgBonuses } from "./rpg.js";
import { statEffects } from "./stats.js";
import { BASE_CRIT, BASE_CRIT_DAMAGE } from "./skills.js";
import { townPlatforms, TOWN_SPOTS, TOWN_WIDTH } from "./town-layout.js";
export const DUNGEON_ENERGY_MAX = 10;
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
  // Holy support: mid range, heals the party and blesses it with regen.
  priest: {
    name: "พระ",
    icon: "✚",
    hp: 150,
    mp: 130,
    atk: 23,
    def: 8,
    range: 270,
    speed: 250,
    color: 0xffe08a,
  },
};
// Potions: how much each restores and its own cooldown (seconds), so HP
// and MP potions can't be chugged back to back.
// Three sizes per kind; "hp" / "mp" are the original medium potions. Sizes
// of one kind share that kind's cooldown (potionCd.hp / potionCd.mp).
export const POTIONS = {
  hp_s: { kind: "hp", restore: 45, cooldown: 4 },
  hp: { kind: "hp", restore: 90, cooldown: 4 },
  hp_l: { kind: "hp", restore: 350, cooldown: 4 },
  mp_s: { kind: "mp", restore: 40, cooldown: 4 },
  mp: { kind: "mp", restore: 80, cooldown: 4 },
  mp_l: { kind: "mp", restore: 300, cooldown: 4 },
};
// Smallest first.
export const POTION_SIZES = {
  hp: ["hp_s", "hp", "hp_l"],
  mp: ["mp_s", "mp", "mp_l"],
};
// Stackable supplies that can be traded, sold in shops or discarded.
// Blessed stone: one guaranteed enhancement, no gold or ore (grand world boss reward).
export const BLESS_STONE = "stone_100";
export const STACK_SUPPLIES = [...Object.keys(POTIONS), "ore", BLESS_STONE];
export const potionCount = (inventory, kind) =>
  POTION_SIZES[kind].reduce((n, id) => n + (inventory?.[id] || 0), 0);
// Quick-use (R / G and auto-play): the smallest owned potion that refills
// what is missing, else the biggest one owned. null when none are left.
export function pickPotion(inventory, kind, missing) {
  const owned = POTION_SIZES[kind].filter((id) => inventory?.[id] > 0);
  return owned.find((id) => POTIONS[id].restore >= missing) || owned.at(-1) || null;
}
export const MAX_BUY = 999;
export const ITEMS = {
  hp_s: { name: "ยา HP เล็ก", icon: "🧪", price: 8 },
  hp: { name: "ยา HP กลาง", icon: "🧪", price: 15 },
  hp_l: { name: "ยา HP ใหญ่", icon: "🧪", price: 60 },
  mp_s: { name: "ยา MP เล็ก", icon: "💧", price: 8 },
  mp: { name: "ยา MP กลาง", icon: "💧", price: 15 },
  mp_l: { name: "ยา MP ใหญ่", icon: "💧", price: 60 },
  ore: { name: "แร่จันทรา", icon: "💎", price: 20 },
  stone_100: { name: "หินตีบวก 100%", icon: "🌟", price: 5000 },
  weapon: { name: "อาวุธผู้พิทักษ์", icon: "⚔", price: 70 },
  armor: { name: "เกราะนักเดินทาง", icon: "🛡", price: 60 },
};
// Floors 1-10 are the main story; 11-40 are the deep cave ("ห้วงลึก"),
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
  ...DEEP_DUNGEONS.map(({ roster, traits, ...floor }) => ({ ...floor, deep: true })),
];
// Difficulty bands shown on the dungeon cards.
export function floorDifficulty(floor) {
  if (floor > MAIN_FLOORS) return { id: "abyss", label: "ห้วงลึก" };
  if (floor >= 8) return { id: "extreme", label: "ยากมาก" };
  if (floor >= 5) return { id: "hard", label: "ยาก" };
  if (floor >= 3) return { id: "normal", label: "ปานกลาง" };
  return { id: "easy", label: "ปกติ" };
}
// Heroes grow up to MAX_LEVEL; levels past 40 are for the world boss.
export const MAX_LEVEL = 60;
export const expToLevel = (level) => level * 80;
// Monster strength by floor. Floor monsters stop growing with heroes at Lv.40 (reached around
// floor 15), so past it monsters grow at 40% of the old pace: floor 40 fights
// like floor 25. Rewards keep using the real floor.
export const SCALE_FLOOR = 15;
export const powerFloor = (floor) =>
  floor <= SCALE_FLOOR ? floor : SCALE_FLOOR + (floor - SCALE_FLOOR) * 0.4;
export const recommendedLevel = (floor) =>
  floor > MAIN_FLOORS ? Math.min(40, 30 + (floor - MAIN_FLOORS) * 2) : Math.max(1, floor * 3 - 2);
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
// Base stats (shared/stats.js) scale HP by VIT and MP by INT on top of the
// class, level and gear numbers.
export const maxHp = (p) => {
  const fx = statEffects(p);
  return Math.round(
    (CLASSES[p.class].hp + (p.level - 1) * 12 + (rpgBonuses(p).hp || 0)) * (1 + fx.hpPct) + fx.hpFlat,
  );
};
export const maxMp = (p) => {
  const fx = statEffects(p);
  return Math.round(
    (CLASSES[p.class].mp + (p.level - 1) * 5 + (rpgBonuses(p).mp || 0)) * (1 + fx.mpPct) + fx.mpFlat,
  );
};
export const damage = (atk, def, mult = 1) =>
  Math.max(1, Math.floor((atk * mult * 100) / (100 + def)));

export function combatStats(p) {
  const c = CLASSES[p.class],
    b = rpgBonuses(p),
    fx = statEffects(p);
  return {
    atk: c.atk + (p.level - 1) * 3 + (b.atk || 0) + fx.atk,
    def: c.def + (b.def || 0) + fx.def,
    speed: c.speed + (b.speed || 0),
    range: c.range + (b.range || 0) + fx.range,
    hp: maxHp(p),
    mp: maxMp(p),
    // Ragnarok-style derived stats.
    aspd: fx.aspd,
    flee: fx.flee,
    perfect: fx.perfect,
    crit: BASE_CRIT + fx.crit,
    critDamage: BASE_CRIT_DAMAGE + fx.critDamage,
    cast: fx.cast,
    heal: fx.heal,
    double: fx.double,
  };
}

export function combatPower(stats) {
  const crit = stats.crit ?? BASE_CRIT,
    critDamage = stats.critDamage ?? BASE_CRIT_DAMAGE,
    // Expected damage per second relative to a plain Lv.1 hero.
    tempo = (stats.aspd || 1) * (1 + (stats.double || 0)) * (1 + crit * (critDamage - 1)) / (1 + BASE_CRIT * (BASE_CRIT_DAMAGE - 1));
  return Math.round(
    stats.atk * 6 * tempo +
      (stats.hp * (1 + stats.def / 100)) / 2 / (1 - Math.min(0.4, (stats.flee || 0) + (stats.perfect || 0))) +
      stats.mp * 0.2 +
      stats.speed * 0.1 +
      stats.range * 0.05,
  );
}
