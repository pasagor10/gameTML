// Hand-painted class weapons, drawn to match the hero art: soft two-tone bevels, warm dark
// outlines, gem highlights. Each weapon is painted once into a cached bitmap (see weapons.js);
// glows and sparkles are added live on top.
// Coordinates: origin = the hand grip. Swords and staffs point up (-y); guns point forward (+x).

const OUT = '#2b2133';

function path(c, pts) {c.beginPath();pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));c.closePath();}
function fillPath(c, pts, fill, stroke = OUT, width = 1.5) {
  path(c, pts);c.fillStyle = fill;c.fill();
  if (stroke) {c.strokeStyle = stroke;c.lineWidth = width;c.lineJoin = 'round';c.stroke();}
}
function lin(c, x0, y0, x1, y1, stops) {const g = c.createLinearGradient(x0, y0, x1, y1);stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));return g;}
function gem(c, x, y, r, light, dark) {
  const g = c.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r);g.addColorStop(0, '#ffffff');g.addColorStop(.25, light);g.addColorStop(1, dark);
  c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fillStyle = g;c.fill();c.strokeStyle = OUT;c.lineWidth = 1.2;c.stroke();
  c.fillStyle = '#ffffffd0';c.beginPath();c.arc(x - r * .38, y - r * .4, r * .28, 0, Math.PI * 2);c.fill();
}
function diamond(c, x, y, rx, ry, light, dark) {
  fillPath(c, [[x, y - ry], [x + rx, y], [x, y + ry], [x - rx, y]], lin(c, x - rx, y - ry, x + rx, y + ry, ['#ffffff', light, dark]), OUT, 1.1);
}
function wrap(c, x, y0, y1, w, base, band) { // leather grip with diagonal bands
  fillPath(c, [[x - w, y0], [x + w, y0], [x + w, y1], [x - w, y1]], base);
  c.strokeStyle = band;c.lineWidth = 1.2;
  for (let y = y0 + 2.5; y < y1; y += 3) {c.beginPath();c.moveTo(x - w + .4, y + 1.2);c.lineTo(x + w - .4, y - 1.2);c.stroke();}
}
// Straight blade with a lit left bevel, shaded right bevel and a central ridge.
function blade(c, len, w, light, mid, dark, {tip = .82, base = -3, serrate = 0} = {}) {
  // Right edge from base to shoulder, with optional saw teeth.
  const edge = [[w, base]];
  for (let i = 1; i <= serrate; i++) {const y = base - (len * tip - 4) * i / (serrate + 1);edge.push([w, y + 2], [w + 2.6, y + 2], [w, y - 1.5]);}
  edge.push([w * .92, -len * tip]);
  const right = [[0, base], ...edge, [0, -len]], left = [[0, base], [-w, base], [-w * .92, -len * tip], [0, -len]];
  fillPath(c, right, lin(c, 0, 0, w, 0, [mid, dark]), null);
  fillPath(c, left, lin(c, -w, 0, 0, 0, [light, mid]), null);
  path(c, [[-w, base], [-w * .92, -len * tip], [0, -len], ...edge.slice().reverse()]);
  c.strokeStyle = OUT;c.lineWidth = 1.6;c.lineJoin = 'round';c.stroke();
  c.strokeStyle = '#ffffffb0';c.lineWidth = .9;c.beginPath();c.moveTo(-w * .55, base - 2);c.lineTo(-w * .5, -len * tip + 2);c.stroke();
  c.strokeStyle = dark;c.lineWidth = .8;c.beginPath();c.moveTo(0, base - 1);c.lineTo(0, -len + 4);c.stroke();
}

const SWORDS = [
  // 0 Steel
  c => {
    blade(c, 44, 5.25, '#ffffff', '#d5dee9', '#8e9db0');
    fillPath(c, [[-11, -4], [11, -4], [12, -1], [-12, -1]], lin(c, 0, -4, 0, -1, ['#d7dee7', '#7f8a99']));
    wrap(c, 0, -1, 11, 2.2, '#6b4a32', '#3f2b1d');gem(c, 0, 13.5, 3, '#d7dee7', '#6d7887');
  },
  // 1 Sky crystal
  c => {
    blade(c, 48, 6.0, '#f1fbff', '#8fd3ff', '#2f7fd0');
    c.strokeStyle = '#ffffffaa';c.lineWidth = .8;for (const y of [-14, -26, -38]) {c.beginPath();c.moveTo(-4, y + 3);c.lineTo(0, y);c.lineTo(4, y + 3);c.stroke();}
    fillPath(c, [[-13, -3], [-9, -7], [0, -4], [9, -7], [13, -3], [0, 0]], lin(c, 0, -7, 0, 0, ['#f2f6fb', '#9fb1c6']));
    gem(c, 0, -3.5, 2.8, '#bfe9ff', '#1f6fc0');wrap(c, 0, 0, 11, 2.2, '#2c4a7a', '#182c4d');diamond(c, 0, 14, 3, 3.6, '#bfe9ff', '#2f7fd0');
  },
  // 2 Amethyst shadow
  c => {
    blade(c, 52, 6.5, '#e5d0ff', '#9a6bea', '#3f2275', {serrate: 4});
    c.strokeStyle = '#f2ddff';c.lineWidth = 1;c.beginPath();c.moveTo(-1.6, -8);c.lineTo(-1.6, -40);c.stroke();
    fillPath(c, [[-15, -1], [-12, -8], [-6, -5], [0, -8], [6, -5], [12, -8], [15, -1], [0, 1]], lin(c, 0, -8, 0, 1, ['#6a4a8f', '#2b1a44']));
    gem(c, 0, -4, 3.2, '#e6b8ff', '#5a1fa0');wrap(c, 0, 1, 12, 2.2, '#3a2552', '#1d1230');diamond(c, 0, 15, 3.2, 4, '#d6a8ff', '#4a1f85');
  },
  // 3 Golden sun
  c => {
    blade(c, 55, 7.0, '#fffbe8', '#ffe08a', '#d29a22');
    c.fillStyle = '#e8a92a';c.fillRect(-.9, -46, 1.8, 40);
    for (let i = 0; i < 10; i++) {const a = i / 10 * Math.PI * 2;fillPath(c, [[Math.cos(a - .18) * 6, -3 + Math.sin(a - .18) * 6], [Math.cos(a) * 11, -3 + Math.sin(a) * 11], [Math.cos(a + .18) * 6, -3 + Math.sin(a + .18) * 6]], '#ffc94a', OUT, .9);}
    c.beginPath();c.arc(0, -3, 6.5, 0, Math.PI * 2);c.fillStyle = lin(c, 0, -9, 0, 3, ['#fff1b0', '#d99a1f']);c.fill();c.strokeStyle = OUT;c.lineWidth = 1.2;c.stroke();
    gem(c, 0, -3, 3.3, '#ffb36b', '#c24a10');wrap(c, 0, 3, 13, 2.3, '#a8322c', '#6a1c18');gem(c, 0, 15.5, 3.2, '#fff1b0', '#c98a1a');
  },
  // 4 Dragon blood
  c => {
    blade(c, 58, 7.5, '#ffd0c8', '#f05a5a', '#8a1424', {serrate: 3, tip: .78});
    c.strokeStyle = '#2a0f18';c.lineWidth = 1.6;c.beginPath();c.moveTo(1.5, -6);c.lineTo(1.5, -44);c.stroke();
    for (const s of [-1, 1]) fillPath(c, [[0, -2], [s * 8, -8], [s * 17, -13], [s * 13, -6], [s * 18, -4], [s * 9, 0]], lin(c, 0, -13, 0, 0, ['#5a1d2a', '#22090f']));
    fillPath(c, [[-4, -3], [0, -9], [4, -3], [0, 1]], '#3a1220');
    gem(c, 0, -3, 3.4, '#ff9a8a', '#a3101e');wrap(c, 0, 1, 13, 2.4, '#2b1218', '#5a2230');
    fillPath(c, [[-3.5, 13], [3.5, 13], [2, 18], [0, 20], [-2, 18]], '#5a1d2a');
  },
  // 5 Celestial
  c => {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) fillPath(c, [[s * 3, -2], [s * (10 + i * 5), -7 - i * 4.5], [s * (15 + i * 6), -3 - i * 3.5], [s * 6, 2]], i % 2 ? '#ffffff' : '#e8f4ff', '#6f86b0', 1);
    blade(c, 62, 8.0, '#ffffff', '#f3eaff', '#a7b6ff');
    c.strokeStyle = lin(c, 0, -8, 0, -56, ['#ff9ad8', '#9ad8ff', '#c8ffb0', '#ffe39a']);c.lineWidth = 1.8;c.beginPath();c.moveTo(0, -6);c.lineTo(0, -54);c.stroke();
    diamond(c, 0, -3, 4.2, 5.2, '#ffd8f6', '#8a6bff');wrap(c, 0, 2, 13, 2.3, '#f2f4ff', '#b9c2e8');
    fillPath(c, [[0, 13], [3, 16], [0, 21], [-3, 16]], lin(c, 0, 13, 0, 21, ['#ffffff', '#ffd76a']));
  }
];

function shaft(c, y0, y1, w, light, dark, band) {
  fillPath(c, [[-w, y0], [w, y0], [w * .8, y1], [-w * .8, y1]], lin(c, -w, 0, w, 0, [light, dark]));
  if (band) {c.strokeStyle = band;c.lineWidth = 1.4;for (let y = y0 - 8; y > y1 + 4; y -= 14) {c.beginPath();c.moveTo(-w - .4, y);c.lineTo(w + .4, y - 1.5);c.stroke();}}
}
const STAFFS = [
  // 0 Glass
  c => {
    shaft(c, 18, -50, 2.7, '#b88757', '#6b4526');
    for (const s of [-1, 1]) fillPath(c, [[s * 1.5, -48], [s * 7, -56], [s * 6, -64], [s * 3, -58]], '#8f6238');
    gem(c, 0, -60, 6, '#eef8ff', '#8fb6d6');
  },
  // 1 Water crystal
  c => {
    shaft(c, 18, -54, 2.84, '#eef2f7', '#8e9bb0', '#5c7aa8');
    fillPath(c, [[0, -52], [-10, -58], [-11, -68], [-6, -62], [0, -58], [6, -62], [11, -68], [10, -58]], lin(c, 0, -68, 0, -52, ['#f2f6fb', '#9aa9bf']));
    fillPath(c, [[0, -80], [5.5, -68], [0, -58], [-5.5, -68]], lin(c, -5, -80, 5, -58, ['#ffffff', '#7fd0ff', '#1f6fc0']), OUT, 1.2);
    c.fillStyle = '#ffffffb0';c.beginPath();c.ellipse(-1.6, -70, 1.1, 4, .2, 0, Math.PI * 2);c.fill();
  },
  // 2 Purple star
  c => {
    shaft(c, 18, -56, 2.97, '#6b4a8f', '#33204d', '#c9a0ff');
    c.beginPath();c.arc(0, -70, 11, Math.PI * .15, Math.PI * .85, true);c.strokeStyle = '#e8d8ff';c.lineWidth = 2.4;c.stroke();
    const star = [];for (let i = 0; i < 10; i++) {const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 9.5;star.push([Math.cos(a) * r, -70 + Math.sin(a) * r]);}
    fillPath(c, star, lin(c, -9, -80, 9, -60, ['#ffffff', '#d6a8ff', '#7a3fd0']), OUT, 1.2);
    gem(c, 0, -54, 2.6, '#e6b8ff', '#5a1fa0');
  },
  // 3 Sun gold
  c => {
    shaft(c, 18, -58, 3.1, '#fff0b0', '#c98a1a', '#a8322c');
    c.beginPath();c.arc(0, -72, 11, 0, Math.PI * 2);c.strokeStyle = OUT;c.lineWidth = 4.6;c.stroke();c.strokeStyle = '#ffd25a';c.lineWidth = 3;c.stroke();
    for (let i = 0; i < 12; i++) {const a = i / 12 * Math.PI * 2;fillPath(c, [[Math.cos(a - .12) * 12, -72 + Math.sin(a - .12) * 12], [Math.cos(a) * (i % 2 ? 16 : 19), -72 + Math.sin(a) * (i % 2 ? 16 : 19)], [Math.cos(a + .12) * 12, -72 + Math.sin(a + .12) * 12]], '#ffc94a', OUT, .9);}
    gem(c, 0, -72, 6.5, '#ffd08a', '#d2531a');
  },
  // 4 Hellfire
  c => {
    shaft(c, 18, -58, 3.24, '#5a2230', '#1e0a10', '#ff6a3a');
    for (const s of [-1, 1]) fillPath(c, [[s * 2, -56], [s * 10, -62], [s * 13, -76], [s * 8, -68], [s * 4, -64]], lin(c, 0, -76, 0, -56, ['#3a1220', '#14060a']));
    fillPath(c, [[0, -90], [5, -80], [8, -72], [5, -64], [0, -62], [-5, -64], [-8, -72], [-5, -80], [-2, -76]], lin(c, 0, -90, 0, -62, ['#fff0a0', '#ff8a2a', '#c4141e']), OUT, 1.2);
    gem(c, 0, -69, 3.6, '#ffe08a', '#d2331a');
  },
  // 5 Celestial
  c => {
    shaft(c, 18, -60, 3.24, '#ffffff', '#c8cff0', '#ffd76a');
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) fillPath(c, [[s * 3, -64], [s * (10 + i * 4.5), -70 - i * 5], [s * (14 + i * 5), -64 - i * 4], [s * 5, -60]], i % 2 ? '#ffffff' : '#e8f4ff', '#6f86b0', 1);
    fillPath(c, [[0, -92], [7, -78], [0, -64], [-7, -78]], lin(c, -7, -92, 7, -64, ['#ff9ad8', '#9ad8ff', '#c8ffb0', '#ffe39a']), OUT, 1.3);
    c.fillStyle = '#ffffffc0';c.beginPath();c.ellipse(-2, -80, 1.3, 5, .2, 0, Math.PI * 2);c.fill();
  }
];

function grip(c, w, light, dark) {fillPath(c, [[-3.5, -1], [3.5, -1], [2.2, 11], [-5.5, 10]], lin(c, -5, 0, 4, 0, [light, dark]));}
function trigger(c) {c.strokeStyle = OUT;c.lineWidth = 1.2;c.beginPath();c.moveTo(4.5, -1);c.quadraticCurveTo(7, 5, 10, -1);c.stroke();}
const GUNS = [
  // 0 Explorer pistol
  c => {
    grip(c, 0, '#9a6b42', '#5e3f24');trigger(c);
    fillPath(c, [[-6, -1], [16, -1], [16, -7], [-4, -7], [-7, -4]], lin(c, 0, -7, 0, -1, ['#e8eef5', '#8e9bb0']));
    fillPath(c, [[16, -2.5], [26, -2.5], [26, -6.5], [16, -6.5]], lin(c, 0, -6.5, 0, -2.5, ['#c9d4e0', '#6d7887']));
    c.fillStyle = OUT;c.fillRect(24, -6, 2, 1.5);
  },
  // 1 Plasma blue
  c => {
    grip(c, 0, '#3a4a6a', '#1c2640');trigger(c);
    fillPath(c, [[-7, 0], [22, 0], [28, -3], [28, -8], [18, -10], [-4, -10], [-8, -5]], lin(c, 0, -10, 0, 0, ['#ffffff', '#c9d6e8']));
    fillPath(c, [[0, -4.5], [20, -4.5], [20, -7], [0, -7]], lin(c, 0, 0, 20, 0, ['#2f7fd0', '#8fe0ff']), null);
    gem(c, 6, -5.6, 2.2, '#bfefff', '#1f6fc0');gem(c, 14, -5.6, 2.2, '#bfefff', '#1f6fc0');
    fillPath(c, [[28, -3], [32, -4], [32, -7], [28, -8]], '#8fe0ff');
  },
  // 2 Ether purple
  c => {
    grip(c, 0, '#4a2a6a', '#22113a');trigger(c);
    fillPath(c, [[-8, 0], [18, 0], [20, -3], [34, -3], [34, -8], [18, -8], [16, -11], [-5, -11], [-9, -6]], lin(c, 0, -11, 0, 0, ['#c9a8ef', '#5a2f8f']));
    for (const x of [21, 26, 31]) {c.beginPath();c.ellipse(x, -5.5, 1.6, 4.4, 0, 0, Math.PI * 2);c.fillStyle = '#e6b8ff';c.fill();c.strokeStyle = OUT;c.lineWidth = 1;c.stroke();}
    gem(c, 6, -6, 3, '#f2ddff', '#7a3fd0');
  },
  // 3 Golden machine gun
  c => {
    grip(c, 0, '#a8322c', '#5a1612');trigger(c);
    fillPath(c, [[-10, 0], [20, 0], [22, -12], [-6, -12], [-11, -6]], lin(c, 0, -12, 0, 0, ['#fff1b0', '#d99a1f']));
    for (const y of [-3, -6, -9]) fillPath(c, [[20, y + 1.1], [40, y + 1.1], [40, y - 1.1], [20, y - 1.1]], lin(c, 0, y - 1, 0, y + 1, ['#fff6d0', '#a8781a']), OUT, .8);
    fillPath(c, [[37, 0], [41, 0], [41, -11], [37, -11]], '#c98a1a');
    c.beginPath();c.arc(8, 4, 6, 0, Math.PI * 2);c.fillStyle = lin(c, 2, 0, 14, 8, ['#ffe08a', '#a8781a']);c.fill();c.strokeStyle = OUT;c.lineWidth = 1.3;c.stroke();
    fillPath(c, [[0, -12], [12, -12], [10, -16], [2, -16]], '#ffd25a');
  },
  // 4 Dragon cannon
  c => {
    grip(c, 0, '#3a1220', '#14060a');trigger(c);
    fillPath(c, [[-11, 1], [26, 1], [28, -2], [40, -1], [46, 3], [46, -17], [40, -13], [28, -12], [26, -15], [-7, -15], [-12, -8]], lin(c, 0, -15, 0, 1, ['#ff8a7a', '#a3101e', '#4a0a12']));
    c.strokeStyle = '#2a0f18';c.lineWidth = 1.2;for (const x of [4, 10, 16]) {c.beginPath();c.moveTo(x, -14);c.lineTo(x + 3, -1);c.stroke();}
    for (const x of [6, 14]) fillPath(c, [[x, -15], [x + 3, -21], [x + 5, -15]], '#ffb36b');
    gem(c, 30, -6.5, 3.4, '#ffe08a', '#d2331a');
  },
  // 5 Rainbow divine
  c => {
    for (let i = 0; i < 4; i++) fillPath(c, [[0, -12], [-6 - i * 4, -18 - i * 3.5], [-2 - i * 4, -13 - i * 2.5], [4, -10]], i % 2 ? '#ffffff' : '#e8f4ff', '#6f86b0', 1);
    grip(c, 0, '#ffffff', '#c8cff0');trigger(c);
    fillPath(c, [[-10, 0], [24, 0], [30, -3], [46, -4], [48, -7], [46, -10], [30, -11], [24, -14], [-6, -14], [-11, -7]], lin(c, 0, -14, 0, 0, ['#ffffff', '#e8ecff', '#b9c2e8']));
    c.strokeStyle = lin(c, 0, 0, 46, 0, ['#ff9ad8', '#9ad8ff', '#c8ffb0', '#ffe39a']);c.lineWidth = 2.4;c.beginPath();c.moveTo(-4, -7);c.lineTo(44, -7);c.stroke();
    diamond(c, 10, -7, 4.4, 5.4, '#ffd8f6', '#8a6bff');
  }
];
function trainingSword(c) {
  blade(c, 38, 4.75, '#e8c89a', '#c49a64', '#8a6238');
  fillPath(c, [[-8, -4], [8, -4], [8, -1], [-8, -1]], '#7a5636');wrap(c, 0, -1, 9, 2, '#5b4632', '#3a2a1c');
}

// Bounds of each class's weapon in local units, used to size the cached bitmap.
export const PAINT_BOUNDS = {novice: [-14, -44, 28, 58], knight: [-26, -70, 52, 94], mage: [-24, -98, 48, 120], gunner: [-24, -26, 76, 42]};
export function paintWeapon(c, job, tier) {
  if (job === 'knight') SWORDS[tier](c);
  else if (job === 'mage') STAFFS[tier](c);
  else if (job === 'gunner') GUNS[tier](c);
  else trainingSword(c);
}
