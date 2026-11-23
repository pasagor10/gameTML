// Item icons drawn in code: every armour, helmet and ring tier has its own shape, coloured by
// rarity, on a rarity-framed tile. Weapons reuse the painted class weapons.
import {TIERS, drawWeaponIcon} from './weapons.js';

const OUT = '#1e1a2e';
const rainbow = (k = 0) => `hsl(${(k * 70 + 300) % 360} 90% 70%)`;
function poly(c, pts, fill, stroke = OUT, w = 2.4) {
  c.beginPath();pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));c.closePath();
  c.fillStyle = fill;c.fill();if (stroke) {c.strokeStyle = stroke;c.lineWidth = w;c.lineJoin = 'round';c.stroke();}
}
function oval(c, x, y, rx, ry, fill, stroke = OUT, w = 2.4) {
  c.beginPath();c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);c.fillStyle = fill;c.fill();if (stroke) {c.strokeStyle = stroke;c.lineWidth = w;c.stroke();}
}
function gem(c, x, y, r, col) {poly(c, [[x, y - r], [x + r * .8, y], [x, y + r], [x - r * .8, y]], col, OUT, 2);poly(c, [[x, y - r], [x + r * .4, y - r * .1], [x, y + r * .1]], '#ffffffaa', null);}
function shine(c, x, y, r) {const g = c.createRadialGradient(x, y, 0, x, y, r);g.addColorStop(0, '#ffffffcc');g.addColorStop(1, '#ffffff00');c.fillStyle = g;c.beginPath();c.arc(x, y, r, 0, 7);c.fill();}

// Body armour on a 100x100 canvas: a cloth tunic, leather vest, steel cuirass, crystal plate,
// dragon-scale mail and a winged mythic plate.
const ARMOR_LOOK = [
  {body: '#c9b48a', trim: '#8a6a44'}, {body: '#a8683a', trim: '#5a3418'}, {body: '#c8d4e2', trim: '#6a7a92'},
  {body: '#8fe0ff', trim: '#2a7ab8'}, {body: '#d4473e', trim: '#6a1418'}, {body: '#fff0ff', trim: '#a05ac8'},
  {body: '#7af0c4', trim: '#137a5a'}, {body: '#d6f6ff', trim: '#2a6f9a'}, {body: '#5a46c8', trim: '#c4b4ff'}, {body: '#ff8ac8', trim: '#8a1a5a'}, {body: '#ffe58a', trim: '#8a6a10'}
];
function armor(c, look) {
  const {body, trim} = ARMOR_LOOK[look], tier = Math.min(5, look);
  if (tier === 5) {poly(c, [[30, 34], [8, 22], [14, 46], [28, 50]], '#ffd6f4');poly(c, [[70, 34], [92, 22], [86, 46], [72, 50]], '#ffd6f4');}
  // Shoulders, torso, collar.
  poly(c, [[26, 26], [40, 20], [50, 28], [60, 20], [74, 26], [80, 44], [70, 48], [70, 84], [30, 84], [30, 48], [20, 44]], body);
  if (tier >= 2) {oval(c, 25, 33, 12, 9, trim);oval(c, 75, 33, 12, 9, trim);}
  poly(c, [[40, 20], [50, 34], [60, 20], [56, 18], [50, 26], [44, 18]], trim, OUT, 2);
  if (tier === 0) {for (const y of [46, 58, 70]) oval(c, 50, y, 2.4, 2.4, trim, null);L(c, 30, 76, 70, 76, trim, 4);}
  if (tier === 1) {L(c, 50, 34, 50, 84, trim, 3);for (const y of [44, 56, 68]) {L(c, 44, y, 56, y + 4, trim, 2);L(c, 56, y, 44, y + 4, trim, 2);}poly(c, [[30, 70], [70, 70], [70, 78], [30, 78]], '#5a3418', OUT, 2);oval(c, 50, 74, 4, 4, '#d4a64a', OUT, 1.6);}
  if (tier === 2) {poly(c, [[36, 40], [64, 40], [62, 64], [50, 72], [38, 64]], '#e8eef6', trim, 2);L(c, 50, 42, 50, 70, trim, 2);for (const y of [76, 82]) L(c, 32, y, 68, y, trim, 2);}
  if (tier === 3) {gem(c, 50, 54, 12, '#d8f8ff');for (const [x, y] of [[38, 44], [62, 44], [40, 70], [60, 70]]) gem(c, x, y, 5, '#bff0ff');}
  if (tier === 4) {for (let row = 0; row < 5; row++) for (let i = 0; i < 4; i++) {const x = 36 + i * 9 + (row % 2) * 4.5, y = 42 + row * 8;c.beginPath();c.arc(x, y, 5, 0, Math.PI);c.strokeStyle = trim;c.lineWidth = 2;c.stroke();}gem(c, 50, 30, 6, '#ffd25a');}
  if (tier === 5) {for (let i = 0; i < 5; i++) gem(c, 34 + i * 8, 46 + (i % 2) * 5, 4.5, rainbow(i));gem(c, 50, 64, 10, '#ffffff');}
}
// Helmets: a headband, leather cap, steel helm, crystal crown, horned dragon helm and a halo crown.
function helmet(c, tier) {
  if (tier === 0) {oval(c, 50, 54, 30, 10, '#d4473e');poly(c, [[74, 54], [90, 66], [82, 70], [72, 60]], '#d4473e');poly(c, [[74, 56], [86, 76], [78, 78], [70, 60]], '#b8322a');oval(c, 50, 54, 4, 4, '#ffe08a', OUT, 1.6);return;}
  if (tier === 1) {c.beginPath();c.moveTo(20, 66);c.quadraticCurveTo(22, 22, 50, 20);c.quadraticCurveTo(78, 22, 80, 66);c.closePath();c.fillStyle = '#a8683a';c.fill();c.strokeStyle = OUT;c.lineWidth = 2.4;c.stroke();poly(c, [[18, 62], [82, 62], [86, 70], [14, 70]], '#5a3418');L(c, 50, 22, 50, 62, '#5a3418', 2);return;}
  if (tier === 2) {c.beginPath();c.moveTo(22, 74);c.quadraticCurveTo(20, 18, 50, 16);c.quadraticCurveTo(80, 18, 78, 74);c.closePath();c.fillStyle = '#c8d4e2';c.fill();c.strokeStyle = OUT;c.lineWidth = 2.4;c.stroke();poly(c, [[30, 46], [70, 46], [70, 54], [54, 54], [54, 74], [46, 74], [46, 54], [30, 54]], '#3a4658', OUT, 1.6);poly(c, [[46, 16], [54, 16], [56, 6], [44, 6]], '#d4473e');return;}
  if (tier === 3) {poly(c, [[20, 70], [22, 40], [34, 54], [42, 26], [50, 46], [58, 26], [66, 54], [78, 40], [80, 70]], '#8fe0ff');gem(c, 50, 60, 8, '#ffffff');gem(c, 32, 62, 5, '#bff0ff');gem(c, 68, 62, 5, '#bff0ff');return;}
  if (tier === 4) {poly(c, [[26, 46], [10, 18], [32, 34]], '#f4e4c4');poly(c, [[74, 46], [90, 18], [68, 34]], '#f4e4c4');c.beginPath();c.moveTo(22, 76);c.quadraticCurveTo(20, 22, 50, 20);c.quadraticCurveTo(80, 22, 78, 76);c.closePath();c.fillStyle = '#d4473e';c.fill();c.strokeStyle = OUT;c.lineWidth = 2.4;c.stroke();poly(c, [[30, 52], [46, 48], [44, 58], [30, 58]], '#ffd25a', OUT, 1.6);poly(c, [[70, 52], [54, 48], [56, 58], [70, 58]], '#ffd25a', OUT, 1.6);poly(c, [[50, 20], [56, 44], [50, 76], [44, 44]], '#9a1828', null);return;}
  const crown = tier > 5 ? TIERS[tier].color : '#ffe39a';
  c.beginPath();c.ellipse(50, 18, 26, 7, 0, 0, Math.PI * 2);c.strokeStyle = tier > 5 ? TIERS[tier].glow : '#ffe9a8';c.lineWidth = 4;c.stroke();
  if (tier > 5) for (const s of [-1, 1]) poly(c, [[50 + s * 26, 50], [50 + s * 44, 22], [50 + s * 34, 52]], TIERS[tier].glow);
  poly(c, [[20, 74], [24, 42], [36, 56], [50, 30], [64, 56], [76, 42], [80, 74]], crown);for (let i = 0; i < 3; i++) gem(c, 34 + i * 16, 64, 6, rainbow(i));
}
// Rings: a band in the tier's metal with a gem in the tier's colour.
const RING_LOOK = [['#c8783a', null], ['#d8e0ea', '#9fd8ff'], ['#e6eef8', '#3a6aff'], ['#ffd25a', '#ffffff'], ['#ffd25a', '#ff3a4a'], ['#fff0ff', 'rainbow'],
  ['#d8ffe8', '#3fe6a8'], ['#ffffff', '#9fe8ff'], ['#3a2a7a', '#8a6bff'], ['#ffd6ec', '#ff5ab0'], ['#ffe58a', '#ffffff']];
function ring(c, tier) {
  const [metal, stone] = RING_LOOK[tier];
  c.beginPath();c.ellipse(50, 60, 26, 22, 0, 0, Math.PI * 2);c.strokeStyle = OUT;c.lineWidth = 13;c.stroke();c.strokeStyle = metal;c.lineWidth = 8;c.stroke();
  c.beginPath();c.ellipse(50, 60, 26, 22, 0, 3.6, 4.6);c.strokeStyle = '#ffffffaa';c.lineWidth = 3;c.stroke();
  if (!stone) return;
  poly(c, [[38, 40], [62, 40], [58, 32], [42, 32]], metal, OUT, 2);
  const r = 8 + Math.min(tier, 7) * 1.6;if (stone === 'rainbow') {for (let i = 0; i < 3; i++) gem(c, 50 + (i - 1) * 10, 26 - (i === 1 ? 4 : 0), r * .6, rainbow(i));}
  else gem(c, 50, 26, r, stone);
}
function L(c, x, y, x2, y2, color, w) {c.beginPath();c.moveTo(x, y);c.lineTo(x2, y2);c.strokeStyle = color;c.lineWidth = w;c.lineCap = 'round';c.stroke();}

// Draws a framed item tile filling the canvas. `plus` adds a +N badge.
export function drawItemIcon(c, item, size) {
  const t = TIERS[item.tier];
  if (item.kind === 'weapon') {drawWeaponIcon(c, item.job, item.tier, 0, size);}
  else {
    c.save();c.clearRect(0, 0, size, size);
    const g = c.createLinearGradient(0, 0, size, size);g.addColorStop(0, '#132544');g.addColorStop(1, t.dark);c.fillStyle = g;c.fillRect(0, 0, size, size);
    const s = size / 100;c.scale(s, s);if (item.tier >= 2) shine(c, 50, 50, 44);
    c.translate(50, 52);c.scale(.82, .82);c.translate(-50, -52);
    if (item.kind === 'armor') armor(c, item.tier);else if (item.kind === 'helmet') helmet(c, item.tier);else ring(c, item.tier);
    c.restore();
    c.strokeStyle = item.tier === 5 ? rainbow(1) : t.color;c.lineWidth = Math.max(2, size / 24);c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth);
  }
  if (item.plus) {
    const f = Math.round(size * .2);c.save();c.font = `800 ${f}px "Chakra Petch",sans-serif`;c.textAlign = 'right';c.textBaseline = 'top';
    c.lineWidth = f * .25;c.strokeStyle = '#1e1a2e';c.strokeText(`+${item.plus}`, size - size * .07, size * .05);c.fillStyle = item.plus >= 7 ? '#ffd25a' : '#ffffff';c.fillText(`+${item.plus}`, size - size * .07, size * .05);c.restore();
  }
}
