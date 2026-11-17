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
];
export const WORLD = {
  width: 2400,
  ground: 600,
  platforms: [
    { x: 570, y: 460, w: 230 },
    // Max jump height is ~184px (vy 650, gravity 1150); keep every platform below that.
    { x: 1100, y: 440, w: 260 },
    { x: 1620, y: 470, w: 210 },
  ],
  npcs: [
    { id: "elder", x: 240, name: "ผู้ใหญ่คำ", role: "เควส", icon: "📜" },
    { id: "potion", x: 620, name: "มีรา", role: "ร้านยา", icon: "🧪" },
    { id: "weapon", x: 1040, name: "อริน", role: "ร้านอาวุธ", icon: "⚔" },
    { id: "forge", x: 1420, name: "ลุงเหล็ก", role: "ตีบวก", icon: "⚒" },
  ],
  portal: 2180,
};
export const maxHp = (p) =>
  CLASSES[p.class].hp + (p.level - 1) * 12 + (p.armor ? 30 : 0);
export const maxMp = (p) => CLASSES[p.class].mp + (p.level - 1) * 5;
export const damage = (atk, def, mult = 1) =>
  Math.max(1, Math.floor((atk * mult * 100) / (100 + def)));
