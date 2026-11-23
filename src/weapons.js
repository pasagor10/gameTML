import {paintWeapon,PAINT_BOUNDS} from './weapon-paint.js';
// Class weapons: data shared by the simulation and the canvas renderer.
// Six rarity tiers follow the TILMO class-weapon sheet: Common → Rare → Epic → Unique → Legendary → Mythic.

export const TIERS = [
  {id:'common', name:'ทั่วไป', label:'Common', color:'#e6eef8', glow:'#ffffff', dark:'#7d8aa0', power:1},
  {id:'rare', name:'หายาก', label:'Rare', color:'#4fb6ff', glow:'#9fe0ff', dark:'#1f5fa8', power:1.25},
  {id:'epic', name:'มหากาพย์', label:'Epic', color:'#c46bff', glow:'#e6b8ff', dark:'#6a2aa8', power:1.55},
  {id:'unique', name:'เฉพาะตัว', label:'Unique', color:'#ffb52e', glow:'#ffe39a', dark:'#a8650f', power:1.9},
  {id:'legendary', name:'ตำนาน', label:'Legendary', color:'#ff4a55', glow:'#ffb0a0', dark:'#9a1828', power:2.35},
  {id:'mythic', name:'เทพนิยาย', label:'Mythic', color:'#ff8ae0', glow:'#fff1ff', dark:'#7a3fa8', power:3},
  // Late-game tiers (Lv.50-80) reuse the Mythic silhouettes recoloured in their own hue.
  {id:'ancient', name:'โบราณ', label:'Ancient', color:'#3fe6a8', glow:'#b8ffe0', dark:'#137a5a', power:3.6},
  {id:'celestial', name:'สวรรค์', label:'Celestial', color:'#9fe8ff', glow:'#eafcff', dark:'#2a6f9a', power:4.3},
  {id:'abyssal', name:'อเวจี', label:'Abyssal', color:'#8a6bff', glow:'#d2c4ff', dark:'#2e1a8a', power:5.1},
  {id:'cosmic', name:'จักรวาล', label:'Cosmic', color:'#ff5ab0', glow:'#ffc4e4', dark:'#8a1a5a', power:6.2},
  {id:'eternal', name:'นิรันดร์', label:'Eternal', color:'#ffd94a', glow:'#fff6c8', dark:'#8a6a10', power:7.5}
];
// Silhouette used to paint a tier: new tiers borrow Mythic's shape.
export const artTier = tier => Math.max(0, Math.min(5, tier));

// Gear drops from monsters; each tier needs this hero level before it can be equipped.
export const REQ_LEVEL = [1, 12, 20, 28, 36, 45, 50, 55, 60, 70, 80];

export const WEAPON_NAMES = {
  novice: ['ดาบฝึกหัด'],
  knight: ['ดาบเหล็กกล้า', 'ดาบผลึกฟ้า', 'ดาบเงาอเมทิสต์', 'ดาบสุริยะทอง', 'ดาบโลหิตมังกร', 'ดาบเทพนภา', 'ดาบหยกโบราณ', 'ดาบนภาสวรรค์', 'ดาบอเวจีทมิฬ', 'ดาบดาราจักร', 'ดาบนิรันดร์กาล'],
  mage: ['คทาแก้วฝึกหัด', 'คทาวารีคริสตัล', 'คทาดวงดาวม่วง', 'คทาสุริยันทอง', 'คทาเพลิงโลกันตร์', 'คทาจักรวาลนิรันดร์', 'คทาหยกโบราณ', 'คทานภาสวรรค์', 'คทาอเวจีทมิฬ', 'คทาดาราจักร', 'คทานิรันดร์กาล'],
  gunner: ['ปืนพกนักสำรวจ', 'ปืนพลาสม่าฟ้า', 'ปืนอีเธอร์ม่วง', 'ปืนกลทองคำ', 'ปืนใหญ่เพลิงแดง', 'ปืนเทพสายรุ้ง', 'ปืนหยกโบราณ', 'ปืนนภาสวรรค์', 'ปืนอเวจีทมิฬ', 'ปืนดาราจักร', 'ปืนนิรันดร์กาล']
};

// What each tier adds to the class's basic attack (shown in the UI, implemented in model.js).
export const TIER_PERKS = {
  knight: ['ฟันกวาดรอบตัว', 'ระยะฟัน +10%', 'ปล่อยคลื่นดาบทะลุ', 'คลื่นดาบ 3 สาย', 'ฟันสองจังหวะ', 'ฟันเร็วขึ้น 25%', 'พลังฟัน ×3.6', 'พลังฟัน ×4.3', 'พลังฟัน ×5.1', 'พลังฟัน ×6.2', 'พลังฟัน ×7.5'],
  mage: ['ระเบิดเวทรอบตัว', 'รัศมีเวท +10%', 'ระเบิดซ้ำจังหวะที่สอง', 'สายฟ้าลามไป 3 ตัว', 'รัศมีเวท +15%', 'ร่ายเร็วขึ้น 25%', 'พลังเวท ×3.6', 'พลังเวท ×4.3', 'พลังเวท ×5.1', 'พลังเวท ×6.2', 'พลังเวท ×7.5'],
  gunner: ['ยิงรัวเป้าใกล้สุด', 'กระสุนทะลุ 1 ตัว', 'ยิงคู่ 2 นัด', 'ยิง 3 นัด ทะลุ 2 ตัว', 'กระสุนระเบิด', 'ยิงเร็วขึ้น 30%', 'พลังยิง ×3.6', 'พลังยิง ×4.3', 'พลังยิง ×5.1', 'พลังยิง ×6.2', 'พลังยิง ×7.5']
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
  const t = TIERS[tier], n = Math.min(9, tier + 1);
  for (let i = 0; i < n; i++) {
    const a = time * (1.5 + i * .2) + i * 2.4, r = radius * (.6 + .4 * Math.sin(time * 2 + i));
    glowDot(c, Math.cos(a) * r, Math.sin(a) * r * .8 - radius * .5, 3 + (tier >= 4 ? 1.5 : 0) + (tier > 5 ? 1 : 0), tier === 5 ? rainbow(time, i * 70) : i % 2 && tier > 5 ? t.color : t.glow);
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
  const c = canvas.getContext('2d');c.scale(CACHE_SCALE, CACHE_SCALE);c.translate(-x, -y);paintWeapon(c, job, artTier(tier));
  // Late tiers: recolour the Mythic weapon in the tier's hue, keeping its shading.
  if (tier > 5) {c.globalCompositeOperation = 'color';c.fillStyle = TIERS[tier].color;c.fillRect(x, y, w, h);c.globalCompositeOperation = 'destination-in';c.drawImage(paintOnly(job, x, y, w, h), x, y, w, h);c.globalCompositeOperation = 'source-over';}
  const entry = {canvas, x, y, w, h};cache.set(key, entry);return entry;
}
function paintOnly(job, x, y, w, h) {
  const m = document.createElement('canvas');m.width = w * CACHE_SCALE;m.height = h * CACHE_SCALE;
  const c = m.getContext('2d');c.scale(CACHE_SCALE, CACHE_SCALE);c.translate(-x, -y);paintWeapon(c, job, 5);return m;
}
export function loadWeaponArt() {
  for (const job of ['knight', 'mage', 'gunner']) for (let t = 0; t < TIERS.length; t++) bitmap(job, t);
  bitmap('novice', 0);return Promise.resolve();
}

// Origin = the hand grip; the weapon points up (negative y). Sized for the in-game hero (~150px tall).
export function drawWeapon(c, job, tier = 0, time = 0, {attacking = false, plus = 0} = {}) {
  tier = Math.max(0, Math.min(TIERS.length - 1, tier));const t = TIERS[tier], gun = job === 'gunner';
  const art = bitmap(job === 'novice' || !PAINT_BOUNDS[job] ? 'novice' : job, job === 'novice' ? 0 : tier);
  c.save();
  if (tier >= 1 && job !== 'novice') glowDot(c, gun ? 18 : 0, gun ? -6 : job === 'mage' ? -64 : -30, 16 + Math.min(tier, 8) * 4, `${tier === 5 ? '#ffffff' : t.glow}${tier >= 4 ? '88' : '50'}`);
  if (art && plus > 0) plusAura(c, art, job === 'novice' ? 'novice' : job, tier, plus, time);
  if (art) c.drawImage(art.canvas, art.x, art.y, art.w, art.h);
  if (art && plus >= 7) plusSparks(c, art, plus, time);
  if (gun && attacking) glowDot(c, GUN_TIP[artTier(tier)] + 4, -5, 10 + Math.min(tier, 7) * 2, '#fff4b0');
  if (job !== 'novice') {c.save();if (gun) c.translate(20, 14);else if (job === 'mage') c.translate(0, -36);sparkle(c, tier, time, gun ? 22 : 26);c.restore();}
  c.restore();
}

// ---- Enhancement (+N) glow on the held weapon: a soft silhouette glow cached per weapon and
// level band, pulsing behind the art. +1-3 white, +4-6 blue, +7-9 gold with sparks, +10 rainbow.
const PLUS_BANDS = [[1, '#ffffff', .6], [4, '#4ab4ff', .9], [7, '#ffc23a', 1], [10, '#ff8ae0', 1]];
const plusBand = plus => PLUS_BANDS.filter(([from]) => plus >= from).pop();
const auraCache = new Map(), AURA_PAD = 10;
function auraBitmap(key, art, color, blur, layers) {
  let m = auraCache.get(key);if (m) return m;
  m = document.createElement('canvas');const pad = AURA_PAD * CACHE_SCALE;m.width = art.canvas.width + pad * 2;m.height = art.canvas.height + pad * 2;
  const c = m.getContext('2d'), far = m.width * 2;
  // Draw only the shadow: the art itself lands off-canvas, its blurred silhouette lands at the pad.
  // Stacking layers turns a faint blur into a solid glow.
  c.shadowColor = color;c.shadowBlur = blur * CACHE_SCALE;c.shadowOffsetX = far;
  for (let i = 0; i < layers; i++) c.drawImage(art.canvas, pad - far, pad);
  auraCache.set(key, m);return m;
}
function plusAura(c, art, job, tier, plus, time) {
  const [from, color, strength] = plusBand(plus);
  const pulse = .7 + .3 * Math.sin(time * (from >= 7 ? 5 : 3.2));
  const put = (col, alpha) => {
    const box = [art.x - AURA_PAD, art.y - AURA_PAD, art.w + AURA_PAD * 2, art.h + AURA_PAD * 2];
    c.globalCompositeOperation = 'lighter';c.globalAlpha = alpha * pulse;c.drawImage(auraBitmap(`${job}-${tier}-${col}-halo`, art, col, from >= 7 ? 8 : from >= 4 ? 6 : 4.5, 6), ...box);c.globalCompositeOperation = 'source-over';
    c.globalAlpha = Math.min(1, alpha * (.6 + .4 * pulse));c.drawImage(auraBitmap(`${job}-${tier}-${col}-rim`, art, col, 1.3, 5), ...box);
  };
  c.save();
  if (from >= 10) { // cycles pink -> cyan -> gold
    const cols = ['#ff6ad0', '#4ae0ff', '#ffd23a'], ph = (time * .8) % 3, i = Math.floor(ph), f = ph - i;
    put(cols[i], 1 - f);put(cols[(i + 1) % 3], f);
  }
  else put(color, strength);
  c.restore();
}
function plusSparks(c, art, plus, time) {
  const n = plus >= 10 ? 7 : 4;c.save();c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ph = (time * .9 + i / n) % 1, x = art.x + art.w * (.2 + .6 * ((i * .618) % 1)) + Math.sin(time * 3 + i) * 2, y = art.y + art.h * (1 - ph), r = 1.2 + 1.6 * Math.sin(ph * Math.PI);
    c.globalAlpha = Math.sin(ph * Math.PI);c.fillStyle = plus >= 10 ? rainbow(time, i * 50) : i % 2 ? '#fff6c0' : '#ffcf4a';
    c.beginPath();c.moveTo(x, y - r * 2);c.lineTo(x + r * .5, y - r * .5);c.lineTo(x + r * 2, y);c.lineTo(x + r * .5, y + r * .5);c.lineTo(x, y + r * 2);c.lineTo(x - r * .5, y + r * .5);c.lineTo(x - r * 2, y);c.lineTo(x - r * .5, y - r * .5);c.closePath();c.fill();
  }
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
