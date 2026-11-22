import {paintWeapon,PAINT_BOUNDS} from './weapon-paint.js';
// Class weapons: data shared by the simulation and the canvas renderer.
// Six rarity tiers follow the TILMO class-weapon sheet: Common → Rare → Epic → Unique → Legendary → Mythic.

export const TIERS = [
  {id:'common', name:'ทั่วไป', label:'Common', color:'#e6eef8', glow:'#ffffff', dark:'#7d8aa0', power:1},
  {id:'rare', name:'หายาก', label:'Rare', color:'#4fb6ff', glow:'#9fe0ff', dark:'#1f5fa8', power:1.25},
  {id:'epic', name:'มหากาพย์', label:'Epic', color:'#c46bff', glow:'#e6b8ff', dark:'#6a2aa8', power:1.55},
  {id:'unique', name:'เฉพาะตัว', label:'Unique', color:'#ffb52e', glow:'#ffe39a', dark:'#a8650f', power:1.9},
  {id:'legendary', name:'ตำนาน', label:'Legendary', color:'#ff4a55', glow:'#ffb0a0', dark:'#9a1828', power:2.35},
  {id:'mythic', name:'เทพนิยาย', label:'Mythic', color:'#ff8ae0', glow:'#fff1ff', dark:'#7a3fa8', power:3}
];

// Gear drops from monsters; each tier needs this hero level before it can be equipped.
export const REQ_LEVEL = [1, 12, 20, 28, 36, 45];

export const WEAPON_NAMES = {
  novice: ['ดาบฝึกหัด'],
  knight: ['ดาบเหล็กกล้า', 'ดาบผลึกฟ้า', 'ดาบเงาอเมทิสต์', 'ดาบสุริยะทอง', 'ดาบโลหิตมังกร', 'ดาบเทพนภา'],
  mage: ['คทาแก้วฝึกหัด', 'คทาวารีคริสตัล', 'คทาดวงดาวม่วง', 'คทาสุริยันทอง', 'คทาเพลิงโลกันตร์', 'คทาจักรวาลนิรันดร์'],
  gunner: ['ปืนพกนักสำรวจ', 'ปืนพลาสม่าฟ้า', 'ปืนอีเธอร์ม่วง', 'ปืนกลทองคำ', 'ปืนใหญ่เพลิงแดง', 'ปืนเทพสายรุ้ง']
};

// What each tier adds to the class's basic attack (shown in the UI, implemented in model.js).
export const TIER_PERKS = {
  knight: ['ฟันกวาดรอบตัว', 'ระยะฟัน +10%', 'ปล่อยคลื่นดาบทะลุ', 'คลื่นดาบ 3 สาย', 'ฟันสองจังหวะ', 'ฟันเร็วขึ้น 25%'],
  mage: ['ระเบิดเวทรอบตัว', 'รัศมีเวท +10%', 'ระเบิดซ้ำจังหวะที่สอง', 'สายฟ้าลามไป 3 ตัว', 'รัศมีเวท +15%', 'ร่ายเร็วขึ้น 25%'],
  gunner: ['ยิงรัวเป้าใกล้สุด', 'กระสุนทะลุ 1 ตัว', 'ยิงคู่ 2 นัด', 'ยิง 3 นัด ทะลุ 2 ตัว', 'กระสุนระเบิด', 'ยิงเร็วขึ้น 30%']
};

export function weaponName(job, tier) {
  const names = WEAPON_NAMES[job] || WEAPON_NAMES.novice;
  return names[Math.min(names.length - 1, tier)];
}

const rainbow = (time, offset = 0) => `hsl(${(time * 90 + offset) % 360} 95% 70%)`;

function glowDot(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
}
function shape(c, points, fill, stroke, width = 1.4) {
  c.beginPath();points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));c.closePath();
  c.fillStyle = fill;c.fill();if (stroke) {c.strokeStyle = stroke;c.lineWidth = width;c.lineJoin = 'round';c.stroke();}
}
function sparkle(c, tier, time, radius) {
  if (tier < 2) return;
  const t = TIERS[tier], n = tier + 1;
  for (let i = 0; i < n; i++) {
    const a = time * (1.5 + i * .2) + i * 2.4, r = radius * (.6 + .4 * Math.sin(time * 2 + i));
    glowDot(c, Math.cos(a) * r, Math.sin(a) * r * .8 - radius * .5, 3 + (tier >= 4 ? 1.5 : 0), tier === 5 ? rainbow(time, i * 70) : t.glow);
  }
}

// Weapons are painted in the hero's art style (weapon-paint.js) once per class and tier into a
// cached bitmap at 4x, so drawing them every frame is a single drawImage.
const CACHE_SCALE = 4, cache = new Map();
const GUN_TIP = [27, 33, 35, 42, 47, 49];
function bitmap(job, tier) {
  const key = `${job}-${tier}`;if (cache.has(key)) return cache.get(key);
  if (typeof document === 'undefined') return null;
  const [x, y, w, h] = PAINT_BOUNDS[job] || PAINT_BOUNDS.novice, canvas = document.createElement('canvas');
  canvas.width = w * CACHE_SCALE;canvas.height = h * CACHE_SCALE;
  const c = canvas.getContext('2d');c.scale(CACHE_SCALE, CACHE_SCALE);c.translate(-x, -y);paintWeapon(c, job, tier);
  const entry = {canvas, x, y, w, h};cache.set(key, entry);return entry;
}
export function loadWeaponArt() {
  for (const job of ['knight', 'mage', 'gunner']) for (let t = 0; t < TIERS.length; t++) bitmap(job, t);
  bitmap('novice', 0);return Promise.resolve();
}

// Origin = the hand grip; the weapon points up (negative y). Sized for the in-game hero (~150px tall).
export function drawWeapon(c, job, tier = 0, time = 0, {attacking = false} = {}) {
  tier = Math.max(0, Math.min(5, tier));const t = TIERS[tier], gun = job === 'gunner';
  const art = bitmap(job === 'novice' || !PAINT_BOUNDS[job] ? 'novice' : job, job === 'novice' ? 0 : tier);
  c.save();
  if (tier >= 1 && job !== 'novice') glowDot(c, gun ? 18 : 0, gun ? -6 : job === 'mage' ? -64 : -30, 16 + tier * 4, `${tier === 5 ? '#ffffff' : t.glow}${tier >= 4 ? '88' : '50'}`);
  if (art) c.drawImage(art.canvas, art.x, art.y, art.w, art.h);
  if (gun && attacking) glowDot(c, GUN_TIP[tier] + 4, -5, 10 + tier * 2, '#fff4b0');
  if (job !== 'novice') {c.save();if (gun) c.translate(20, 14);else if (job === 'mage') c.translate(0, -36);sparkle(c, tier, time, gun ? 22 : 26);c.restore();}
  c.restore();
}

// Small framed icon for HUD/collection cards.
export function drawWeaponIcon(c, job, tier, time = 0, size = 72) {
  const t = TIERS[tier];
  c.save();c.clearRect(0, 0, size, size);
  const g = c.createLinearGradient(0, 0, size, size);g.addColorStop(0, '#0c1a3a');g.addColorStop(1, `${t.dark}`);
  c.fillStyle = g;c.fillRect(0, 0, size, size);
  c.strokeStyle = tier === 5 ? rainbow(time) : t.color;c.lineWidth = 3;c.strokeRect(1.5, 1.5, size - 3, size - 3);
  // Fit the painted weapon's bounds into the frame; long weapons lie on the diagonal.
  const [bx, by, bw, bh] = PAINT_BOUNDS[job] || PAINT_BOUNDS.novice, gun = job === 'gunner';
  const span = gun ? Math.max(bw, bh) : (bw + bh) * Math.SQRT1_2, s = size * .84 / span;
  c.translate(size / 2, size / 2);c.scale(s, s);if (!gun) c.rotate(Math.PI / 4);c.translate(-(bx + bw / 2), -(by + bh / 2));
  drawWeapon(c, job, tier, time);
  c.restore();
}
