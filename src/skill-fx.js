// Canvas visuals for class attacks, class skills, drones and tiered projectiles.
// Every class-skill visual reads `lv` (1–5): bigger, more layers and particles each level,
// gold accents from Lv.3 and a prismatic finale at Lv.5.
import {TIERS} from './weapons.js';

const tierColor = (tier, time, fallback = '#8eeaff') => tier === 5 ? `hsl(${(time * 90) % 360} 95% 70%)` : tier >= 0 && TIERS[tier] ? TIERS[tier].color : fallback;
const prism = (time, offset = 0) => `hsl(${(time * 140 + offset) % 360} 100% 72%)`;
const level = f => Math.max(1, Math.min(5, f.lv || 1));
// Base colour per level: the skill's own colour, warmer gold from Lv.3, prismatic at Lv.5.
const accent = (lv, base, time, offset = 0) => lv >= 5 ? prism(time, offset) : lv >= 3 ? '#ffd36a' : base;

function glow(c, x, y, r, color) {
  if (r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
}
function ring(c, x, y, r, color, width, squash = .62) {
  if (r <= 0 || width <= 0) return;
  c.strokeStyle = color;c.lineWidth = width;c.beginPath();c.ellipse(x, y, r, r * squash, 0, 0, Math.PI * 2);c.stroke();
}
function star(c, x, y, r, color) {
  c.fillStyle = color;c.beginPath();
  for (let i = 0; i < 8; i++) {const a = i * Math.PI / 4, d = i % 2 ? r * .35 : r;c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);}
  c.closePath();c.fill();
}
// Ground rune circle used by the grander Lv.4–5 casts.
function runeCircle(c, r, color, time, spin = 1) {
  c.save();c.scale(1, .62);c.rotate(time * spin);
  c.strokeStyle = color;c.lineWidth = 2;c.beginPath();c.arc(0, 0, r, 0, Math.PI * 2);c.stroke();
  c.beginPath();c.arc(0, 0, r * .78, 0, Math.PI * 2);c.stroke();
  for (let i = 0; i < 6; i++) {const a = i * Math.PI / 3;c.beginPath();c.moveTo(Math.cos(a) * r * .78, Math.sin(a) * r * .78);c.lineTo(Math.cos(a + 2.1) * r * .78, Math.sin(a + 2.1) * r * .78);c.stroke();}
  c.restore();
}

// Returns true when the shot style is drawn here; otherwise the caller uses its default arrow.
export function drawShot(c, s, time) {
  const a = Math.atan2(s.vy, s.vx), color = tierColor(s.tier ?? 0, time), lv = level(s);
  if (s.style === 'bullet' || s.style === 'pellet' || s.style === 'drone') {
    c.save();c.translate(s.x, s.y);c.rotate(a);
    const pellet = s.style === 'pellet', drone = s.style === 'drone';
    const len = pellet ? 9 + lv * 2 : drone ? 14 + lv * 5 : 18 + (s.tier || 0) * 2;
    const core = drone ? accent(lv, '#7ef3ff', time) : pellet ? accent(lv, '#ffe08a', time) : color;
    glow(c, 0, 0, (pellet ? 7 : 11) + (pellet || drone ? lv * 2 : 0), `${TIERS[s.tier || 0].glow}aa`);
    c.strokeStyle = core;c.lineWidth = (pellet ? 2.5 : 4) + (drone ? lv * .6 : 0);c.lineCap = 'round';
    c.beginPath();c.moveTo(-len, 0);c.lineTo(2, 0);c.stroke();
    c.strokeStyle = '#fffbe6';c.lineWidth = 1.6;c.beginPath();c.moveTo(-len * .5, 0);c.lineTo(3, 0);c.stroke();
    c.restore();return true;
  }
  if (s.style === 'crescent') {
    const big = 1 + (lv - 1) * .16, col = s.lv ? accent(lv, color, time) : color;
    c.save();c.translate(s.x, s.y);c.rotate(a);c.scale(big, big * .9);
    glow(c, 0, 0, 30 + lv * 4, `${TIERS[Math.max(0, s.tier || 0)].glow}66`);
    // afterimages trail the blade from Lv.2
    for (let k = Math.min(3, lv - 1); k > 0; k--) {c.globalAlpha = .18 * (4 - k);c.strokeStyle = col;c.lineWidth = 6;c.beginPath();c.arc(-8 - k * 12, 0, 20, -1.1, 1.1);c.stroke();}
    c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {c.strokeStyle = i === 2 ? '#ffffff' : col;c.globalAlpha = .45 + i * .25;c.lineWidth = 9 - i * 3;c.beginPath();c.arc(-8, 0, 22 - i * 2, -1.2, 1.2);c.stroke();}
    if (lv >= 4) {c.globalAlpha = 1;for (let i = 0; i < 3; i++) star(c, -14 - i * 9, Math.sin(time * 20 + i) * 8, 3, '#fffbe0');}
    c.restore();return true;
  }
  if (s.style === 'rocket') { // body, fins and a flame trail
    c.save();c.translate(s.x, s.y);c.rotate(a);const k = 1 + (lv - 1) * .1;c.scale(k, k);
    for (let i = 1; i <= 4; i++) glow(c, -12 - i * 9, Math.sin(time * 40 + i) * 2, 10 - i * 1.5, i < 2 ? '#fff4b0ee' : '#ff8a3a99');
    c.fillStyle = '#e6eef8';c.strokeStyle = '#27394c';c.lineWidth = 1.5;c.beginPath();c.moveTo(14, 0);c.lineTo(4, -5);c.lineTo(-10, -5);c.lineTo(-10, 5);c.lineTo(4, 5);c.closePath();c.fill();c.stroke();
    c.fillStyle = accent(lv, '#ff5a4a', time);c.beginPath();c.moveTo(14, 0);c.lineTo(6, -5);c.lineTo(6, 5);c.closePath();c.fill();
    c.beginPath();c.moveTo(-10, -5);c.lineTo(-15, -10);c.lineTo(-6, -5);c.moveTo(-10, 5);c.lineTo(-15, 10);c.lineTo(-6, 5);c.fill();
    c.restore();return true;
  }
  return false;
}

export function drawZone(c, z, time) {
  const q = z.life / z.max, lv = level(z);
  c.save();c.globalAlpha = Math.min(1, q * 3);
  if (z.kind === 'whirl') {
    c.translate(z.x, z.y - 18);
    if (lv >= 4) {c.save();c.translate(0, 18);runeCircle(c, z.r * .95, accent(lv, '#9fe0ff', time), time, 1.5);c.restore();}
    glow(c, 0, 0, z.r * (1 + lv * .05), lv >= 3 ? '#ffd36a40' : '#9fe0ff40');
    const arcs = 2 + lv;
    for (let i = 0; i < arcs; i++) {
      const a = time * (12 + lv * 2) + i * Math.PI * 2 / arcs;
      c.strokeStyle = i === 0 ? '#ffffff' : accent(lv, '#bfefff', time, i * 50);c.lineWidth = 7 - Math.min(4, i * 1.2) + lv * .4;c.lineCap = 'round';
      c.beginPath();c.ellipse(0, 0, z.r * .9, z.r * .55, 0, a, a + 1.4);c.stroke();
    }
    if (lv >= 5) { // orbiting spirit blades
      for (let i = 0; i < 6; i++) {
        const a = -time * 6 + i * Math.PI / 3, x = Math.cos(a) * z.r * 1.05, y = Math.sin(a) * z.r * .62;
        c.save();c.translate(x, y);c.rotate(a + Math.PI / 2);glow(c, 0, 0, 14, '#ffffffaa');
        c.fillStyle = prism(time, i * 60);c.beginPath();c.moveTo(0, -16);c.lineTo(4, 0);c.lineTo(0, 6);c.lineTo(-4, 0);c.closePath();c.fill();c.restore();
      }
    }
    if (lv >= 3) for (let i = 0; i < lv * 3; i++) {const a = time * 9 + i * 2.4, r = z.r * (.4 + (i % 4) * .17);glow(c, Math.cos(a) * r, Math.sin(a) * r * .55, 4, '#fff3c0dd');}
  } else if (z.kind === 'vortex') {
    c.translate(z.x, z.y);
    if (lv >= 4) runeCircle(c, z.r * 1.05, accent(lv, '#c99cff', time), time, -1);
    glow(c, 0, 0, z.r * (1.1 + lv * .06), lv >= 5 ? '#ff7ad955' : '#7b3dff55');
    c.fillStyle = '#12052acc';c.beginPath();c.ellipse(0, 0, z.r * (.24 + lv * .02), z.r * (.15 + lv * .012), 0, 0, Math.PI * 2);c.fill();
    const arms = 3 + lv;
    for (let i = 0; i < arms; i++) {
      const a = -time * (4 + lv * .6) + i * Math.PI * 2 / arms;
      c.strokeStyle = lv >= 5 ? prism(time, i * 45) : i % 2 ? '#c99cff' : '#7ef3ff';c.lineWidth = 2.5 + lv * .3;
      c.beginPath();for (let k = 0; k <= 20; k++) {const t = k / 20, r = z.r * (1 - t * .85), b = a + t * 4;const x = Math.cos(b) * r, y = Math.sin(b) * r * .6;k ? c.lineTo(x, y) : c.moveTo(x, y);}c.stroke();
    }
    if (lv >= 3) for (let i = 0; i < lv * 3; i++) { // stars being swallowed
      const t = ((time * .8 + i * .137) % 1), a = i * 2.39 - time * 3, r = z.r * (1.1 - t);
      star(c, Math.cos(a) * r, Math.sin(a) * r * .6, 2 + (1 - t) * 3, lv >= 5 ? prism(time, i * 30) : '#fff1ff');
    }
    if (lv >= 5) ring(c, 0, 0, z.r * .45, '#ffffffcc', 2);
  } else if (z.kind === 'blizzard') { // icy ground ring with driving snow
    c.translate(z.x, z.y);
    if (lv >= 4) runeCircle(c, z.r, accent(lv, '#bfefff', time), time, .8);
    glow(c, 0, 0, z.r * 1.1, '#bfe9ff44');ring(c, 0, 0, z.r, '#e6f7ffcc', 3);
    for (let i = 0; i < 14 + lv * 4; i++) {const t = (time * (1.4 + (i % 3) * .3) + i * .37) % 1, a = i * 2.4, r = z.r * ((i * 37 % 100) / 100);
      const x = Math.cos(a) * r - 30 + t * 60, y = Math.sin(a) * r * .62 - 60 + t * 70;c.globalAlpha = Math.min(1, q * 3) * (1 - t);star(c, x, y, 3 + (i % 3), lv >= 5 ? prism(time, i * 25) : '#ffffff');}
  } else if (z.kind === 'mine') { // blinking disc
    c.translate(z.x, z.y);c.fillStyle = '#00000040';c.beginPath();c.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2);c.fill();
    c.fillStyle = '#4b5a3a';c.strokeStyle = '#1c2616';c.lineWidth = 1.6;c.beginPath();c.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);c.fill();c.stroke();
    const on = Math.floor(time * 4 + z.x) % 2 === 0;glow(c, 0, -2, on ? 10 : 5, on ? '#ff5a4acc' : '#ff5a4a55');c.fillStyle = '#ff5a4a';c.beginPath();c.arc(0, -2, 2.4, 0, Math.PI * 2);c.fill();
  }
  c.restore();
}

export function drawDrone(c, d, time, tier) {
  const lv = level(d);
  c.save();c.translate(d.x, d.y + Math.sin(time * 4 + d.x) * 3);const s = 1 + (lv - 1) * .1;c.scale(s, s);
  c.fillStyle = '#12304a40';c.beginPath();c.ellipse(0, 70, 12, 4, 0, 0, Math.PI * 2);c.fill();
  glow(c, 0, 0, 20 + lv * 3, lv >= 3 ? '#ffd36a55' : `${TIERS[tier].glow}55`);
  if (lv >= 4) ring(c, 0, 0, 20, accent(lv, '#9fe0ff', time), 1.5, .4);
  c.fillStyle = lv >= 3 ? '#fff4d6' : '#e6eef8';c.strokeStyle = '#27394c';c.lineWidth = 1.6;
  c.beginPath();c.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);c.fill();c.stroke();
  c.fillStyle = '#10223a';c.beginPath();c.ellipse(0, 1, 8, 5, 0, 0, Math.PI * 2);c.fill();
  c.fillStyle = accent(lv, tierColor(tier, time), time);c.beginPath();c.arc(-3, 1, 1.8, 0, Math.PI * 2);c.arc(3, 1, 1.8, 0, Math.PI * 2);c.fill();
  c.strokeStyle = '#9fe0ff';c.lineWidth = 2;const spin = time * 30;
  c.beginPath();c.moveTo(-18 + Math.cos(spin) * 5, -9);c.lineTo(-18 - Math.cos(spin) * 5, -9);c.moveTo(18 + Math.cos(spin) * 5, -9);c.lineTo(18 - Math.cos(spin) * 5, -9);c.stroke();
  if (lv >= 5) for (let i = 0; i < 3; i++) glow(c, Math.cos(time * 5 + i * 2.1) * 22, Math.sin(time * 5 + i * 2.1) * 9, 4, prism(time, i * 120));
  c.restore();
}

// Returns true when handled; the caller falls back to the original effect renderer.
export function drawSkillEffect(c, f, time) {
  const q = 1 - f.life / f.max, lv = level(f);
  if (f.kind === 'arcane') {
    const color = tierColor(f.tier ?? 0, time, '#c46bff');
    c.translate(f.x, f.y);glow(c, 0, 0, f.r, '#b06bff33');
    ring(c, 0, 0, f.r * (.4 + q * .6), color, 8 * (1 - q) + 2);ring(c, 0, 0, f.r * (.25 + q * .5), '#ffffff', 2);
    for (let i = 0; i < 6; i++) {const a = i * 1.047 + q * 3;glow(c, Math.cos(a) * f.r * q, Math.sin(a) * f.r * q * .62, 7, '#f0d9ffcc');}
    return true;
  }
  if (f.kind === 'muzzle') {
    c.translate(f.x, f.y);c.rotate(f.a);const s = 1 + (lv - 1) * .25;c.scale(s, s);glow(c, 6, 0, 18, lv >= 3 ? '#ffd36add' : '#fff1a0dd');
    c.fillStyle = '#fffbe0';c.beginPath();c.moveTo(0, -5);c.lineTo(22, 0);c.lineTo(0, 5);c.closePath();c.fill();
    if (lv >= 4) {c.fillStyle = accent(lv, '#ffd36a', time);c.beginPath();c.moveTo(4, -9);c.lineTo(16, -3);c.lineTo(4, 0);c.closePath();c.fill();c.beginPath();c.moveTo(4, 9);c.lineTo(16, 3);c.lineTo(4, 0);c.closePath();c.fill();}
    return true;
  }
  if (f.kind === 'dashline') { // charge / beam: a bright streak along the struck line
    const col = f.color || '#bfefff', w = (f.width || 30) * (1 - q * .6);
    c.globalAlpha *= 1 - q;c.lineCap = 'round';
    c.strokeStyle = `${col}55`;c.lineWidth = w * 2;c.beginPath();c.moveTo(f.x, f.y);c.lineTo(f.tx, f.ty);c.stroke();
    c.strokeStyle = col;c.lineWidth = w * .8;c.beginPath();c.moveTo(f.x, f.y);c.lineTo(f.tx, f.ty);c.stroke();
    c.strokeStyle = '#ffffff';c.lineWidth = w * .25;c.beginPath();c.moveTo(f.x, f.y);c.lineTo(f.tx, f.ty);c.stroke();
    for (let i = 0; i < 4 + lv * 2; i++) {const u = (i + .5) / (4 + lv * 2);glow(c, f.x + (f.tx - f.x) * u, f.y + (f.ty - f.y) * u + Math.sin(i * 3 + time * 20) * w * .5, 6 + lv, lv >= 5 ? prism(time, i * 30) : '#ffffffaa');}
    return true;
  }
  if (f.kind === 'explosion' && f.style === 'earth') { // ground slam: cracks and flying rocks
    c.translate(f.x, f.y);const r = f.r * (.4 + q * .7);
    glow(c, 0, 0, f.r * .9, '#c9a46a55');ring(c, 0, 0, r, '#e6c88a', 10 * (1 - q) + 2);ring(c, 0, 0, r * .7, accent(lv, '#a8783a', time), 4 * (1 - q) + 1);
    c.strokeStyle = '#5a3a20';c.lineWidth = 3;for (let i = 0; i < 6 + lv; i++) {const a = i * Math.PI * 2 / (6 + lv);c.beginPath();c.moveTo(Math.cos(a) * 14, Math.sin(a) * 9);c.lineTo(Math.cos(a + .2) * r * .6, Math.sin(a + .2) * r * .37);c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .62);c.stroke();}
    for (let i = 0; i < 8; i++) {const a = i * .8 + lv, d = r * .8, h = Math.sin(q * Math.PI) * (30 + lv * 6);c.fillStyle = '#8a6a44';c.beginPath();c.arc(Math.cos(a) * d, Math.sin(a) * d * .62 - h, 4 + (i % 3), 0, Math.PI * 2);c.fill();}
    return true;
  }
  if (f.kind === 'explosion') {
    const holy = f.style === 'holy';
    c.translate(f.x, f.y);
    if (lv >= 4) {c.save();c.globalAlpha *= 1 - q;runeCircle(c, f.r * 1.1, holy ? '#fff3b0' : '#ffb24e', time, holy ? 2 : -2);c.restore();}
    glow(c, 0, 0, f.r * (.6 + q * .6) * (1 + lv * .05), holy ? (lv >= 5 ? '#ffffffdd' : '#fff1b0cc') : lv >= 5 ? '#ff7ad9cc' : '#ffb24ecc');
    ring(c, 0, 0, f.r * (.3 + q * .8), holy ? '#ffffff' : '#fff1c0', (6 + lv) * (1 - q) + 1);
    if (lv >= 3) ring(c, 0, 0, f.r * (.15 + q * 1.1), accent(lv, holy ? '#ffe68a' : '#ff9a4a', time), 3 * (1 - q) + .5);
    const bits = 6 + lv * 2;
    for (let i = 0; i < bits; i++) {const a = i * Math.PI * 2 / bits + lv, r = f.r * q * (1 + (i % 2) * .2);glow(c, Math.cos(a) * r, Math.sin(a) * r * .62 - q * lv * 6, 5 + lv, lv >= 5 ? prism(time, i * 30) : holy ? '#fff6c8cc' : '#ff7a3acc');}
    if (holy && lv >= 3) {c.globalAlpha *= (1 - q);c.fillStyle = '#fffbe0aa';c.fillRect(-6 - lv, -220, 12 + lv * 2, 220);} // pillar of light
    return true;
  }
  if (f.kind === 'blade') { // light sword falling onto the target
    const s = 1 + (lv - 1) * .2, col = accent(lv, '#ffcf5a', time);
    c.translate(f.x, f.y);const drop = (1 - Math.min(1, q * 1.4)) * (160 + lv * 20);
    if (lv >= 4) {c.save();c.globalAlpha *= .8;runeCircle(c, 34 * s, col, time, 3);c.restore();}
    glow(c, 0, 0, 40 * s, lv >= 3 ? '#ffe9a0aa' : '#ffe9a066');
    if (lv >= 3) {c.save();c.globalAlpha *= .35;c.fillStyle = '#fffbe0';c.fillRect(-7 * s, -drop - 260, 14 * s, 260);c.restore();}
    c.translate(0, -drop);c.scale(s, s);c.fillStyle = '#fffbe8';c.strokeStyle = col;c.lineWidth = 2;
    c.beginPath();c.moveTo(-5, -70);c.lineTo(5, -70);c.lineTo(6, -12);c.lineTo(0, 0);c.lineTo(-6, -12);c.closePath();c.fill();c.stroke();
    c.fillStyle = col;c.fillRect(-14, -74, 28, 5);
    if (lv >= 5) {c.fillStyle = '#ffffffcc';for (const side of [-1, 1]) {c.beginPath();c.moveTo(side * 14, -72);c.lineTo(side * 34, -92);c.lineTo(side * 24, -70);c.closePath();c.fill();}}
    return true;
  }
  if (f.kind === 'meteor') {
    c.translate(f.x, f.y);c.save();c.globalAlpha = .5 + Math.sin(time * 20) * .15;
    c.fillStyle = lv >= 5 ? '#ff3a8a55' : '#ff5a3a55';c.beginPath();c.ellipse(0, 0, f.r, f.r * .62, 0, 0, Math.PI * 2);c.fill();c.restore();
    ring(c, 0, 0, f.r, '#ffd9a0', 2.5);ring(c, 0, 0, f.r * q, '#ff8a5a', 2);
    if (lv >= 4) runeCircle(c, f.r * .9, accent(lv, '#ffb24e', time), time, 2);
    const fall = (1 - q) * (260 + lv * 30), size = 1 + (lv - 1) * .25, mx = fall * .5, my = -fall;
    for (let k = 1; k <= 2 + lv; k++) glow(c, mx + k * 9 * size, my - k * 18 * size, (16 - k * 1.5) * size, lv >= 5 ? prism(time, k * 40) + '' : '#ff8a3a88'); // fiery tail
    glow(c, mx, my, 26 * size, '#ffb24eee');glow(c, mx, my, 12 * size, '#fff7d0');
    return true;
  }
  if (f.kind === 'nova') {
    c.translate(f.x, f.y);
    const rings = Math.min(4, lv);
    for (let i = 0; i < rings; i++) {const t = Math.max(0, q - i * .12);ring(c, 0, 0, f.r * t, i === 0 ? '#ffffff' : accent(lv, '#e6c8ff', time, i * 70), (14 - i * 3) * (1 - t) + 2);}
    glow(c, 0, 0, f.r * q, lv >= 5 ? '#ff7ad930' : '#c99cff30');
    if (lv >= 3) for (let i = 0; i < 6 + lv * 2; i++) {const a = i * Math.PI * 2 / (6 + lv * 2) + time;c.strokeStyle = accent(lv, '#fff1ff', time, i * 20);c.lineWidth = 2;c.beginPath();c.moveTo(Math.cos(a) * f.r * q * .5, Math.sin(a) * f.r * q * .31);c.lineTo(Math.cos(a) * f.r * q, Math.sin(a) * f.r * q * .62);c.stroke();}
    if (lv >= 5) star(c, 0, -30, 26 * (1 - q), '#ffffffee');
    return true;
  }
  if (f.kind === 'lob') { // grenade arc
    const x = f.x + (f.tx - f.x) * q, y = f.y + (f.ty - f.y) * q - Math.sin(q * Math.PI) * (90 + lv * 10);
    c.fillStyle = '#00000030';c.beginPath();c.ellipse(f.x + (f.tx - f.x) * q, f.y + 30 + (f.ty - f.y) * q, 7, 3, 0, 0, Math.PI * 2);c.fill();
    for (let k = 1; k <= lv; k++) {const t = Math.max(0, q - k * .05);glow(c, f.x + (f.tx - f.x) * t, f.y + (f.ty - f.y) * t - Math.sin(t * Math.PI) * (90 + lv * 10), 6, accent(lv, '#ffdf6a', time, k * 40) + '');}
    const s = 1 + (lv - 1) * .12;c.translate(x, y);c.rotate(q * 12);c.scale(s, s);c.fillStyle = lv >= 3 ? '#6a5a2a' : '#4b5a3a';c.strokeStyle = '#1c2616';c.lineWidth = 1.5;
    c.beginPath();c.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2);c.fill();c.stroke();glow(c, 0, -8, 6, '#ffdf6acc');return true;
  }
  return false;
}
