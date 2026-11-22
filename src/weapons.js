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

// Forge points needed (cumulative) to reach each tier. Points come from levels after awakening,
// elites and bosses, so the weapon grows with play instead of from a shop.
export const FORGE_COST = [0, 4, 10, 18, 28, 40];
export const FORGE_POINTS = {level:1, elite:3, boss:6};

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

export function tierForForge(points) {
  let tier = 0;
  for (let i = 0; i < FORGE_COST.length; i++) if (points >= FORGE_COST[i]) tier = i;
  return tier;
}
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
function wings(c, tier, time, scale = 1) {
  // Mythic weapons carry feathered wings like the reference sheet; Unique+ get small fins.
  const t = TIERS[tier], flap = Math.sin(time * 6) * .08;
  for (const side of [-1, 1]) {
    c.save();c.scale(side * scale, scale);c.rotate(flap);
    for (let i = 0; i < 4; i++) shape(c, [[2, 0], [10 + i * 5, -6 - i * 4], [16 + i * 6, -2 - i * 3], [6, 3]], i % 2 ? '#ffffffdd' : (tier === 5 ? rainbow(time, i * 50) : t.glow), t.dark, .8);
    c.restore();
  }
}
function sparkle(c, tier, time, radius) {
  if (tier < 2) return;
  const t = TIERS[tier], n = tier + 1;
  for (let i = 0; i < n; i++) {
    const a = time * (1.5 + i * .2) + i * 2.4, r = radius * (.6 + .4 * Math.sin(time * 2 + i));
    glowDot(c, Math.cos(a) * r, Math.sin(a) * r * .8 - radius * .5, 3 + (tier >= 4 ? 1.5 : 0), tier === 5 ? rainbow(time, i * 70) : t.glow);
  }
}

// Origin = the hand grip; the weapon points up (negative y). Sized for the in-game hero (~150px tall).
export function drawWeapon(c, job, tier = 0, time = 0, {attacking = false} = {}) {
  const t = TIERS[Math.max(0, Math.min(5, tier))];
  const main = tier === 5 ? rainbow(time) : t.color;
  c.save();
  if (tier >= 1) glowDot(c, 0, job === 'gunner' ? -4 : -26, 18 + tier * 4, `${t.glow}${tier >= 4 ? '88' : '55'}`);
  if (job === 'mage') drawStaff(c, tier, t, main, time);
  else if (job === 'gunner') drawGun(c, tier, t, main, time, attacking);
  else drawSword(c, job === 'novice' ? -1 : tier, t, main, time);
  c.restore();
}

function drawSword(c, tier, t, main, time) {
  if (tier < 0) { // novice training blade
    shape(c, [[-2.5, -2], [-2, -34], [0, -40], [2, -34], [2.5, -2]], '#d9e4ee', '#5d6b7c');
    shape(c, [[-8, -1], [8, -1], [8, 2], [-8, 2]], '#9a7a4e', '#4b3b26');
    c.fillStyle = '#5b4632';c.fillRect(-1.5, 2, 3, 9);return;
  }
  const len = 40 + tier * 4, width = 3.5 + tier * .6;
  if (tier >= 5) {c.save();c.translate(0, -2);wings(c, tier, time, 1.1);c.restore();}
  // blade
  shape(c, [[-width, -3], [-width * .9, -len * .8], [0, -len], [width * .9, -len * .8], [width, -3]], '#f4fbff', t.dark, 1.6);
  shape(c, [[-width * .45, -5], [-width * .35, -len * .78], [0, -len * .92], [width * .35, -len * .78], [width * .45, -5]], main);
  if (tier >= 2) shape(c, [[-width - 3, -len * .35], [-width - 7, -len * .5], [-width, -len * .45]], main, t.dark, .8);
  if (tier >= 2) shape(c, [[width + 3, -len * .35], [width + 7, -len * .5], [width, -len * .45]], main, t.dark, .8);
  // guard
  const gw = 9 + tier * 1.6;
  shape(c, [[-gw, -2], [-gw * .6, -6 - tier], [0, -3], [gw * .6, -6 - tier], [gw, -2], [0, 2]], tier >= 3 ? '#ffd56a' : '#c9d4e0', t.dark);
  glowDot(c, 0, -2, 4 + tier, main);
  c.fillStyle = '#4a3a5a';c.fillRect(-1.6, 2, 3.2, 10);
  shape(c, [[-3, 12], [3, 12], [0, 16]], tier >= 3 ? '#ffd56a' : '#c9d4e0');
  sparkle(c, tier, time, len * .6);
}

function drawStaff(c, tier, t, main, time) {
  const top = -48 - tier * 3;
  c.strokeStyle = tier >= 3 ? '#e9b949' : '#8b6a48';c.lineWidth = 3.4;c.lineCap = 'round';
  c.beginPath();c.moveTo(0, 14);c.lineTo(0, top + 10);c.stroke();
  c.strokeStyle = t.dark;c.lineWidth = 1;c.beginPath();c.moveTo(-1.7, 14);c.lineTo(-1.7, top + 10);c.stroke();
  // head prongs cradle the orb
  shape(c, [[-3, top + 12], [-9 - tier, top + 2], [-6, top - 4], [-2, top + 6]], tier >= 3 ? '#ffd56a' : '#b8c7d8', t.dark, .9);
  shape(c, [[3, top + 12], [9 + tier, top + 2], [6, top - 4], [2, top + 6]], tier >= 3 ? '#ffd56a' : '#b8c7d8', t.dark, .9);
  if (tier >= 5) {c.save();c.translate(0, top + 4);wings(c, tier, time, .9);c.restore();}
  const orbR = 6 + tier * .9;
  glowDot(c, 0, top, orbR * 2.6, `${t.glow}99`);
  c.fillStyle = main;c.beginPath();c.arc(0, top, orbR, 0, Math.PI * 2);c.fill();
  c.fillStyle = '#ffffffcc';c.beginPath();c.arc(-orbR * .35, top - orbR * .35, orbR * .35, 0, Math.PI * 2);c.fill();
  if (tier >= 2) { // orbiting rings
    c.strokeStyle = `${t.glow}cc`;c.lineWidth = 1.2;
    for (let i = 0; i < Math.min(3, tier - 1); i++) {c.beginPath();c.ellipse(0, top, orbR + 7 + i * 4, (orbR + 3) * .45, time * (1 + i * .4) + i, 0, Math.PI * 2);c.stroke();}
  }
  if (tier >= 4) { // halo
    c.strokeStyle = tier === 5 ? rainbow(time, 120) : t.color;c.lineWidth = 2;
    c.beginPath();c.ellipse(0, top - orbR - 6, 9, 3, 0, 0, Math.PI * 2);c.stroke();
  }
  sparkle(c, tier, time, 26);
}

function drawGun(c, tier, t, main, time, attacking) {
  // Held pointing forward (+x) with the grip at the origin.
  const len = 22 + tier * 3.2, h = 7 + tier * .7;
  c.save();c.rotate(-.12);
  if (tier >= 5) {c.save();c.translate(4, -h);c.rotate(-1.3);wings(c, tier, time, .8);c.restore();}
  shape(c, [[-6, -h * .2], [len, -h * .2], [len, -h * 1.1], [-2, -h * 1.1], [-8, -h * .6]], '#e9eef5', t.dark, 1.3);
  shape(c, [[0, -h * .45], [len - 2, -h * .45], [len - 2, -h * .9], [2, -h * .9]], main);
  if (tier >= 2) shape(c, [[len, -h * .9], [len + 6 + tier, -h * .8], [len + 6 + tier, -h * .45], [len, -h * .4]], '#c9d4e0', t.dark, .9); // muzzle
  if (tier >= 3) shape(c, [[4, -h * 1.1], [12, -h * 1.9], [18, -h * 1.9], [16, -h * 1.1]], '#ffd56a', t.dark, .9); // scope
  if (tier >= 4) {glowDot(c, len * .45, -h * .65, 6, t.glow);}
  shape(c, [[-3, -h * .25], [3, -h * .25], [1, 10], [-6, 9]], '#5a4a6a', t.dark); // grip
  c.strokeStyle = t.dark;c.lineWidth = .8;c.beginPath();c.moveTo(2, -h * .2);c.lineTo(6, 3);c.lineTo(8, -h * .2);c.stroke(); // trigger guard
  if (attacking) {glowDot(c, len + 8 + tier, -h * .65, 10 + tier * 2, '#fff4b0');}
  c.restore();
  sparkle(c, tier, time, 22);
}

// Small framed icon for HUD/collection cards.
export function drawWeaponIcon(c, job, tier, time = 0, size = 72) {
  const t = TIERS[tier];
  c.save();c.clearRect(0, 0, size, size);
  const g = c.createLinearGradient(0, 0, size, size);g.addColorStop(0, '#0c1a3a');g.addColorStop(1, `${t.dark}`);
  c.fillStyle = g;c.fillRect(0, 0, size, size);
  c.strokeStyle = tier === 5 ? rainbow(time) : t.color;c.lineWidth = 3;c.strokeRect(1.5, 1.5, size - 3, size - 3);
  c.translate(size / 2, size * (job === 'gunner' ? .55 : .78));
  const s = size / 62;c.scale(s, s);
  if (job === 'gunner') c.translate(-14, 0);else c.rotate(.5);
  drawWeapon(c, job, tier, time);
  c.restore();
}
