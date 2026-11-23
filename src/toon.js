// TILMO's code-drawn cartoon style: hero, monsters and arenas are drawn with canvas paths so
// the whole game shares one look (soft fills, warm dark outlines), class outfits and stage
// themes change instantly, and nothing waits on generated art. Collision sizes and combat
// timing are untouched: this file only draws.
import {ARENA_SIZE, ARENA_HALF, ARENA_POLYGON} from './arena.js';
import {RUN_STRIDE} from './sprite-layout.js';
import {TIERS, drawWeapon} from './weapons.js';

const OUT = '#2b2133';
// Default outline width; the hero raises it while drawing so it reads as a bold sticker-like chibi.
let LW = 1.4;
// Soft cel shading: while SHADE is on, a solid #rrggbb fill becomes a gradient lit from the top-left
// (lighter highlight -> base colour -> darker shadow). Gradients are cached by colour and rounded
// box, so a moving hero reuses a small set instead of allocating new ones every frame.
let SHADE = false, SHADE_MIN = 3.5;
const shadeCache = new Map();
// Fixed-coordinate gradients (skin, hair) are built once and reused.
const gradCache = new Map();
const grad = (key, make) => {let g = gradCache.get(key);if (!g) {g = make();gradCache.set(key, g);}return g;};
const mix = (hex, to, t) => {const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
  return `rgb(${Math.round(r + (to[0] - r) * t)},${Math.round(g + (to[1] - g) * t)},${Math.round(b + (to[2] - b) * t)})`;};
function shaded(c, fill, x0, y0, x1, y1) {
  if (!SHADE || typeof fill !== 'string' || fill.length !== 7 || fill[0] !== '#' || y1 - y0 < SHADE_MIN) return fill;
  // Snap the box to a 4-unit grid: animated shapes reuse a handful of gradients instead of
  // missing the cache every frame (the shift is invisible on a soft gradient).
  x0 = Math.round(x0 / 4) * 4;y0 = Math.round(y0 / 4) * 4;x1 = Math.round(x1 / 4) * 4 || 4;y1 = Math.max(y0 + 4, Math.round(y1 / 4) * 4);
  const k = `${fill}|${x0}|${y0}|${x1}|${y1}`;
  let g = shadeCache.get(k);
  if (!g) {
    if (shadeCache.size > 8000) shadeCache.clear();
    g = c.createLinearGradient(x0 + (x1 - x0) * .2, y0, x0 + (x1 - x0) * .75, y1);
    g.addColorStop(0, mix(fill, [255, 252, 240], .32));g.addColorStop(.45, fill);g.addColorStop(1, mix(fill, [40, 24, 70], .3));
    shadeCache.set(k, g);
  }
  return g;
}
function E(c, x, y, rx, ry, fill, stroke = OUT, width = LW) {
  rx = Math.abs(rx);ry = Math.abs(ry);
  c.beginPath();c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {c.fillStyle = shaded(c, fill, x - rx, y - ry, x + rx, y + ry);c.fill();}
  if (stroke) {c.strokeStyle = stroke;c.lineWidth = width;c.stroke();}
}
function P(c, pts, fill, stroke = OUT, width = LW) {
  c.beginPath();let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y], i) => {i ? c.lineTo(x, y) : c.moveTo(x, y);if (x < x0) x0 = x;if (x > x1) x1 = x;if (y < y0) y0 = y;if (y > y1) y1 = y;});c.closePath();
  if (fill) {c.fillStyle = shaded(c, fill, x0, y0, x1, y1);c.fill();}
  if (stroke) {c.strokeStyle = stroke;c.lineWidth = width;c.lineJoin = 'round';c.stroke();}
}
function L(c, x, y, x2, y2, color, width, cap = 'round') {c.beginPath();c.moveTo(x, y);c.lineTo(x2, y2);c.strokeStyle = color;c.lineWidth = width;c.lineCap = cap;c.stroke();}
// Limb: dark outline stroke under a coloured stroke, so arms and legs read like the body.
function limb(c, x, y, x2, y2, color, width) {L(c, x, y, x2, y2, OUT, width + 2.6);L(c, x, y, x2, y2, color, width);}
function glowDot(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);g.addColorStop(0, color);g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
}

// ---------------------------------------------------------------- hero
const SKIN = '#ffe4cc', SKIN_DARK = '#f6b99a';
// Bright, saturated outfits in the style of the TILMO key art.
const OUTFIT = {
  novice: {top: '#b07a48', top2: '#6e4a2c', pants: '#3a4a8a', boots: '#7a4e30', cape: '#e8434f', sleeve: '#b07a48'},
  knight: {top: '#3f74d0', top2: '#24479a', pants: '#2c3c78', boots: '#9aa8c2', cape: '#e8434f', sleeve: '#dfe9f6', plate: '#eef4fb', plate2: '#9fb0c8'},
  mage: {top: '#7b55da', top2: '#43298c', pants: '#33246a', boots: '#56389a', cape: '#7b55da', sleeve: '#8c66e6', hat: '#6a46cc', hat2: '#33207a'},
  gunner: {top: '#25a896', top2: '#13685c', pants: '#4a3a2a', boots: '#7a4e30', cape: '#25a896', sleeve: '#25a896', vest: '#a8683a', hat: '#a8683a', hat2: '#683e1e'}
};
const HAIR = {a: ['#f4f6fd', '#8e9cc4'], b: ['#fbe8f3', '#b68ab8']};
const EYE = {mage: ['#4a2aa8', '#a98cff'], gunner: ['#0e6a5e', '#4fe0c4'], other: ['#1a4fa8', '#5cc6ff']};
export const HERO_TOON_SCALE = 1.45;
// Chibi proportions: the head (and everything worn on it) is enlarged around the neck.
const HEAD_SCALE = 1.3, NECK_Y = -32;

export function drawToonHero(c, x, y, o = {}) {
  const {time = 0, moving = false, job = 'novice', appearance = 'a', inv = 0, direction = 'se', distance, attacking = false, tier = 0, plus = 0, pose = null, armor = -1, helmet = -1} = o;
  const left = ['sw', 'w', 'nw'].includes(direction), back = ['n', 'ne', 'nw'].includes(direction);
  const phase = moving ? (distance !== undefined ? distance / RUN_STRIDE * Math.PI * 2 : time * 13) : 0;
  const sw = moving ? Math.sin(phase) : 0, bob = moving ? -Math.abs(Math.cos(phase)) * 3 : Math.sin(time * 3) * 1.1;
  const fit = OUTFIT[job] || OUTFIT.novice, accent = job === 'novice' ? '#ffd56a' : (tier === 5 ? '#ffd8f6' : TIERS[tier].color);
  const S = HERO_TOON_SCALE;
  LW = 1.9;SHADE = true;
  c.save();c.translate(x, y);
  E(c, 0, 1, 22, 7.5, '#10303055', null);
  const auraLv = job === 'novice' ? 0 : tier, auraCol = tier === 5 ? `hsl(${(time * 80) % 360} 95% 72%)` : accent;
  if (auraLv >= 2) groundAura(c, auraLv, auraCol, time);
  c.scale(left ? -S : S, S);
  if (auraLv >= 1) auraBack(c, auraLv, auraCol, time);
  if (inv > 0 && Math.floor(inv * 15) % 2) c.globalAlpha *= .45;
  // Skill poses: where the hands go, how the weapon is held, and how the body leans.
  const q = pose ? 1 - pose.life / pose.max : 0, pk = pose?.kind;
  let ax = attacking ? 16 : 15 + sw * 2, ay = attacking ? -27 : -19, bx = -14 - sw * 4, by = -17, wr = null, lift = 0, lean = 0, squash = 1;
  if (pk === 'raise') {ax = 13;ay = -52;bx = -13;by = -52;wr = -.15;lift = -5 * Math.sin(q * Math.PI);}
  else if (pk === 'spin') {squash = Math.cos(q * Math.PI * 4);ax = 21;ay = -26;bx = -20;by = -26;wr = 1.45;}
  else if (pk === 'slash') {ax = 19;ay = -36 + q * 18;wr = -2.1 + q * 3.4;lean = .14 * Math.sin(q * Math.PI);}
  else if (pk === 'thrust') {ax = 25;ay = -27;bx = -6;by = -22;wr = 1.35;lean = .16;}
  else if (pk === 'recoil') {ax = 13 - Math.sin(q * Math.PI) * 5;ay = -25;lean = -.12 * Math.sin(q * Math.PI);}
  else if (pk === 'throw') {if (q < .5) {ax = 5;ay = -50;wr = -.7;} else {ax = 23;ay = -30;wr = 1.2;}lean = .1;}
  if (wr !== null && job === 'gunner') wr -= 1.4;
  if (pk === 'recoil') wr = -.35;
  c.translate(0, bob + lift);c.rotate(lean);
  if (squash !== 1) c.scale(Math.abs(squash) < .2 ? .2 * Math.sign(squash || 1) : squash, 1);
  const flutter = Math.sin(time * 7 + phase) * 3;
  const scarf = job === 'novice' ? '#e0505e' : accent, scarfDark = job === 'novice' ? '#7a1a28' : OUT;
  const glove = job === 'knight' ? '#8d9bb0' : job === 'gunner' ? '#5a3a20' : SKIN;
  const weapon = () => {
    const hx = back ? -15 : ax, hy = back ? (attacking ? -27 : -19) : ay;
    c.save();c.translate(hx, hy);c.scale(1 / S, 1 / S);
    if (wr !== null) c.rotate(wr);
    else if (job === 'gunner') c.rotate(attacking ? -.18 : .05);
    else c.rotate(attacking ? (job === 'mage' ? -.25 : -1.1) : (job === 'mage' ? .08 : .35));
    drawWeapon(c, job, tier, time, {attacking, plus});c.restore();
  };
  if (back) weapon();
  // Cape / coat tails / long hair behind the body (in front of it when seen from behind).
  const behind = () => {
    if (job === 'knight' || job === 'novice') P(c, [[-9, -31], [9, -31], [13 - flutter, -6], [3, -9], [-4, -5], [-14 - flutter, -8]], fit.cape);
    if (job === 'gunner') P(c, [[-11, -18], [11, -18], [13 + flutter * .5, -3], [0, -6], [-13 + flutter * .5, -3]], fit.top2);
    if (back) P(c, [[-4, -31], [4, -31], [6 + flutter * .8, -13], [1, -16], [-3 + flutter * .8, -11]], scarf, scarfDark, 1.2);
    else P(c, [[-5, -33], [4, -33], [-12 - flutter * 1.2, -27], [-25 - flutter * 2, -24 + flutter * .6], [-17 - flutter, -31]], scarf, scarfDark, 1.2);
    if (armor === 5) for (const s of [-1, 1]) P(c, [[s * 6, -30], [s * 26, -46 - flutter], [s * 30, -30], [s * 22, -20], [s * 8, -22]], '#fff0ff', '#a05ac8', 1.2);
    if (appearance === 'b') { // long, soft wavy hair falling behind the shoulders
      const [h0, h1] = HAIR.b, f = flutter * .5;
      const g = grad('longHair', () => {const lg = c.createLinearGradient(0, -60, 0, -16);lg.addColorStop(0, '#ffffff');lg.addColorStop(.35, h0);lg.addColorStop(1, h1);return lg;});
      c.beginPath();c.moveTo(-20, -58);c.bezierCurveTo(-27, -46, -25, -30, -23 + f, -19);
      c.quadraticCurveTo(-19 + f, -14, -16 + f, -19);c.quadraticCurveTo(-12, -13, -8, -19);c.quadraticCurveTo(-4, -14, 0, -19);
      c.quadraticCurveTo(4, -14, 8, -19);c.quadraticCurveTo(12, -13, 16 + f, -19);c.quadraticCurveTo(19 + f, -14, 23 + f, -19);
      c.bezierCurveTo(25, -30, 27, -46, 20, -58);c.closePath();
      c.fillStyle = g;c.fill();c.strokeStyle = h1;c.lineWidth = LW;c.lineJoin = 'round';c.stroke();c.strokeStyle = OUT;c.lineWidth = LW * .55;c.stroke();
      c.lineCap = 'round';c.strokeStyle = h1;c.lineWidth = 1;
      for (const s of [-1, 1]) {c.beginPath();c.moveTo(s * 20, -46);c.quadraticCurveTo(s * 22, -34, s * 18.5 + f, -22);c.stroke();}
    }
  };
  if (!back) behind();
  // Legs: alternate lift and swing with the stride.
  for (const s of [-1, 1]) {
    const lift = Math.max(0, s * sw) * 4, fx = s * 5 + s * sw * 4;
    limb(c, s * 5, -14, fx, -3 - lift, fit.pants, 7);L(c, s * 5 - 1.6, -13, fx - 1.6, -5 - lift, '#ffffff30', 1.6);
    E(c, fx + 1.5, -1.8 - lift, 5.8, 3.8, fit.boots);E(c, fx + 3, -3.6 - lift, 2.2, 1.1, '#ffffffa0', null);
    L(c, fx - 2.2, -5 - lift, fx + 3.2, -5 - lift, job === 'knight' ? fit.plate2 : fit.top2, 2.2);
    if (job === 'knight') {const kx = (s * 5 + fx) / 2, ky = (-14 + -3 - lift) / 2;E(c, kx, ky, 3, 2.6, fit.plate, OUT, 1);E(c, kx - .6, ky - .8, 1, .7, '#ffffff99', null);}
  }
  // Back arm.
  const cuff = (x1, y1, x2, y2) => {const t = .78;E(c, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 3.2, 3.2, job === 'knight' ? fit.plate2 : fit.top2, OUT, 1);};
  const backArm = () => {limb(c, -10, -28, bx, by, fit.sleeve, 6.2);cuff(-10, -28, bx, by);E(c, bx, by + 1, 3.4, 3.4, glove);if (pk === 'raise') glowDot(c, bx, by, 9, `${accent}cc`);};
  if (!back) backArm();
  // Torso by class.
  if (job === 'mage') {
    P(c, [[-11, -31], [11, -31], [15, -7], [0, -5], [-15, -7]], fit.top);
    P(c, [[-2, -31], [2, -31], [3, -6], [-3, -6]], accent, OUT, 1);
    L(c, -12, -16, 12, -16, fit.top2, 3);
  } else {
    P(c, [[-11, -31], [11, -31], [12, -13], [-12, -13]], fit.top);
    if (job === 'knight') {P(c, [[-9, -30], [9, -30], [8, -17], [0, -14], [-8, -17]], fit.plate);P(c, [[-2, -27], [2, -27], [1.4, -18], [-1.4, -18]], accent, OUT, 1);
      for (const s of [-1, 1]) P(c, [[s * 8, -33], [s * 15, -31], [s * 15, -25], [s * 9, -26]], fit.plate, OUT, 1.2);}
    if (job === 'gunner') {P(c, [[-9, -30], [-2, -30], [-3, -14], [-10, -14]], fit.vest);P(c, [[9, -30], [2, -30], [3, -14], [10, -14]], fit.vest);}
    if (job === 'novice') P(c, [[-9, -31], [9, -31], [0, -24]], fit.top2, OUT, 1);
    L(c, -12, -14, 12, -14, '#5a3f2a', 3.5);E(c, 0, -14, 2.4, 2.2, accent, OUT, 1);
  }
  // Side shading gives the torso volume.
  P(c, job === 'mage' ? [[-11, -31], [-5, -31], [-6, -6], [-15, -7]] : [[-11, -31], [-5, -31], [-5.5, -13], [-12, -13]], '#0a0a2a30', null);
  if (armor < 0) outfitDetail(c, job, fit, accent, time);
  // Worn armour is drawn over the class outfit, one look per tier.
  if (armor >= 0) wornArmor(c, armor, time);
  if (job === 'gunner' || job === 'novice') {E(c, -9, -12.5, 3, 2.6, '#7a5230', OUT, 1);L(c, -10.5, -13.5, -7.5, -13.5, '#c89a5a', 1);}
  // In back view both arms hang under the cape, so they go on before it.
  if (back) {backArm();limb(c, 10, -28, 14 + sw * 4, -17, fit.sleeve, 6.2);E(c, 14 + sw * 4, -16, 3.4, 3.4, glove);}
  // Scarf wrapped at the neck.
  P(c, [[-10, -32], [10, -32], [9, -27], [-9, -27]], scarf, scarfDark, 1.1);if (!back) {P(c, [[4, -28], [10, -18 + flutter * .3], [6, -17], [1, -27]], scarf, scarfDark, 1);E(c, 4, -28.5, 2.8, 2.4, scarf, scarfDark, 1);}
  // Head: drawn enlarged around the neck so hats and helmets scale with it.
  const headOn = () => {c.save();c.translate(0, NECK_Y);c.scale(HEAD_SCALE, HEAD_SCALE);c.translate(0, -NECK_Y);};
  headOn();
  const fx = back ? 0 : 1.5;
  const skin = grad('skin', () => {const g = c.createRadialGradient(-6, -54, 3, 0, -46, 20);g.addColorStop(0, '#fff3e6');g.addColorStop(.6, SKIN);g.addColorStop(1, SKIN_DARK);return g;});
  E(c, 0, -46, 17, 15.5, skin);
  const [hair, hairDark] = HAIR[appearance] || HAIR.a;
  const hairFill = grad(`hair${appearance}`, () => {const g = c.createLinearGradient(0, -66, 0, -36);g.addColorStop(0, '#ffffff');g.addColorStop(.45, hair);g.addColorStop(1, hairDark);return g;});
  if (back) {
    hairBack(c, hairFill, hairDark);
    c.restore();behind();headOn();
  } else {
    // Face: big glossy anime eyes, soft blush and a small smile.
    const [irisDark, irisLight] = EYE[job] || EYE.other;
    for (const s of [-1, 1]) {
      const ex = fx + s * 6.2, ey = -43.6;
      E(c, ex + s * 3.6, -39.2, 3.4, 1.9, '#ff8f9a66', null);
      E(c, ex, ey, 3.9, 5, '#24203a', null);
      const iris = grad(`iris${irisDark}`, () => {const g = c.createLinearGradient(0, ey - 4, 0, ey + 4.6);g.addColorStop(0, irisDark);g.addColorStop(1, irisLight);return g;});
      E(c, ex, ey + .5, 3, 4, iris, null);
      E(c, ex, ey + .9, 1.5, 2, '#14102a', null);
      E(c, ex - 1.2, ey - 1.6, 1.5, 1.8, '#ffffff', null);
      E(c, ex + 1.3, ey + 2.2, .8, .8, '#ffffffd0', null);
      // Lash line hugging the top of the eye, with a small flick at the outer corner.
      c.beginPath();c.ellipse(ex, ey, 4.1, 5.2, 0, Math.PI * 1.08, Math.PI * 1.92);c.strokeStyle = '#1e1a2e';c.lineWidth = 2.2;c.lineCap = 'round';c.stroke();
      L(c, ex + s * 3.7, ey - 2.6, ex + s * 5.4, ey - 3.8, '#1e1a2e', 1.4);
    }
    c.beginPath();c.moveTo(fx - 2.2, -37.6);c.quadraticCurveTo(fx + .4, -35.4, fx + 2.6, -37.8);c.strokeStyle = '#a2464e';c.lineWidth = 1.3;c.lineCap = 'round';c.stroke();
    // Soft shadow under the fringe.
    c.save();c.beginPath();c.ellipse(0, -46, 17, 15.5, 0, 0, Math.PI * 2);c.clip();E(c, 0, -53, 18, 5, '#e99c8255', null);c.restore();
    // Fluffy rounded hair with tufted bangs, side locks and a glossy shine band.
    hairFront(c, hairFill, hairDark);
    if (appearance === 'b' && helmet < 0) {for (const [hx, hy, r] of [[13.5, -57, 2.6], [16, -53.5, 2.2], [11, -53.5, 2.2]]) E(c, hx, hy, r, r, '#ff8fb8', OUT, 1.1);E(c, 13.5, -55, 1.5, 1.5, '#ffe27a', OUT, .8);}
  }
  // A worn helmet replaces the class headgear.
  if (helmet >= 0) wornHelmet(c, helmet, time, flutter, back);
  else if (job === 'mage') {
    P(c, [[-21, -55], [21, -55], [16, -52], [-16, -52]], fit.hat2);
    P(c, [[-13, -55], [13, -55], [5, -72], [10 + flutter * .4, -84], [-3, -74], [-9, -64]], fit.hat);
    L(c, -12, -57, 12, -57, accent, 2.4);
    P(c, [[0, -66], [1.2, -63], [4, -63], [1.8, -61], [2.6, -58], [0, -60], [-2.6, -58], [-1.8, -61], [-4, -63], [-1.2, -63]], '#ffe39a', OUT, .8);
  } else if (job === 'gunner') {
    P(c, [[-23, -55], [23, -55], [18, -51], [-18, -51]], fit.hat2);
    P(c, [[-12, -55], [12, -55], [10, -66], [3, -64], [0, -67], [-3, -64], [-10, -66]], fit.hat);
    L(c, -12, -57, 12, -57, accent, 2.4);
  } else if (job === 'knight') {
    P(c, [[-17, -54], [17, -54], [15, -58], [0, -61], [-15, -58]], fit.plate, OUT, 1.2);
    E(c, 0, -57.5, 2.6, 2.4, accent, OUT, 1);
    for (const s of [-1, 1]) P(c, [[s * 15, -57], [s * 22, -64], [s * 21, -56]], fit.plate, OUT, 1);
  } else {
    L(c, -16, -55, 16, -55, '#8b6239', 3.4);
    if (!back) for (const gx of [-7, 7]) {E(c, gx, -56, 5, 4, '#ffda80', OUT, 1.2);E(c, gx, -56, 3.2, 2.5, '#459fc9', null);E(c, gx - 1.2, -57, 1.1, .8, '#e6fbff', null);}
  }
  c.restore();
  // Front arm (holds the weapon).
  if (pk === 'raise' || pk === 'thrust') glowDot(c, ax, ay, 10, `${accent}cc`);
  if (!back) {limb(c, 10, -28, ax, ay, fit.sleeve, 6.2);cuff(10, -28, ax, ay);weapon();E(c, ax, ay, 3.5, 3.5, glove);}
  if (auraLv >= 3) auraMotes(c, auraLv, auraCol, time);
  c.restore();
  LW = 1.4;SHADE = false;
}

// Hair shapes in head space (head centre 0,-46, radius 17 x 15.5).
function hairDome(c) {
  c.moveTo(-17.6, -39);c.quadraticCurveTo(-21, -48, -18.5, -56);c.bezierCurveTo(-16, -68, 16, -68, 18.5, -56);c.quadraticCurveTo(21, -48, 17.6, -39);
}
function hairFront(c, fill, dark) {
  c.beginPath();hairDome(c);
  // Side lock up to the bangs, then rounded tufts across the forehead from right to left.
  c.quadraticCurveTo(15.5, -44, 14.5, -50);
  c.quadraticCurveTo(13.5, -46.5, 10.5, -48);c.quadraticCurveTo(9, -50, 6.5, -52);
  c.quadraticCurveTo(5.5, -47.5, 1.5, -48);c.quadraticCurveTo(0, -50, -2.5, -52);
  c.quadraticCurveTo(-4, -48, -8, -48.5);c.quadraticCurveTo(-9.5, -50, -12, -51);
  c.quadraticCurveTo(-13, -47.5, -14.5, -49.5);c.quadraticCurveTo(-15.5, -44, -17.6, -39);
  c.closePath();c.fillStyle = fill;c.fill();c.strokeStyle = dark;c.lineWidth = LW;c.lineJoin = 'round';c.stroke();
  c.strokeStyle = OUT;c.lineWidth = LW * .55;c.stroke();
  // Strand lines and shine.
  c.lineCap = 'round';c.strokeStyle = dark;c.lineWidth = 1;
  for (const [x1, y1, x2, y2, cx, cy] of [[6.5, -52, 9, -60, 9, -56], [-2.5, -52, -1, -61, -2.5, -57], [-12, -51, -12, -59, -13.5, -55]]) {c.beginPath();c.moveTo(x1, y1);c.quadraticCurveTo(cx, cy, x2, y2);c.stroke();}
  c.beginPath();c.moveTo(-13, -58.5);c.quadraticCurveTo(-3, -65, 9, -61.5);c.strokeStyle = '#ffffffe0';c.lineWidth = 2.4;c.stroke();
  E(c, 13, -60, 1.3, 1, '#ffffff', null);E(c, -15.5, -55, .9, 1.4, '#ffffffb0', null);
}
function hairBack(c, fill, dark) {
  c.beginPath();hairDome(c);
  c.quadraticCurveTo(16, -35, 11, -35.5);c.quadraticCurveTo(8, -39, 5.5, -35);c.quadraticCurveTo(2, -31, -1, -34.5);
  c.quadraticCurveTo(-4, -38, -7, -34.5);c.quadraticCurveTo(-11, -32, -12.5, -35.5);c.quadraticCurveTo(-16, -35, -17.6, -39);
  c.closePath();c.fillStyle = fill;c.fill();c.strokeStyle = dark;c.lineWidth = LW;c.lineJoin = 'round';c.stroke();
  c.strokeStyle = OUT;c.lineWidth = LW * .55;c.stroke();
  c.lineCap = 'round';c.strokeStyle = dark;c.lineWidth = 1;
  for (const x of [-8, 0, 8]) {c.beginPath();c.moveTo(x * 1.2, -38);c.quadraticCurveTo(x * .6, -50, x * .5, -60);c.stroke();}
  c.beginPath();c.moveTo(-12, -58);c.quadraticCurveTo(-2, -64.5, 10, -59.5);c.strokeStyle = '#ffffffd0';c.lineWidth = 2.4;c.stroke();
}
function outfitDetail(c, job, fit, accent, time) {
  if (job === 'knight') { // tabard crest + pauldron rivets
    P(c, [[-4, -25], [4, -25], [4, -20], [0, -17], [-4, -20]], accent, OUT, .9);L(c, 0, -24, 0, -18.5, '#ffffff', 1);L(c, -2.4, -22, 2.4, -22, '#ffffff', 1);
    for (const sx of [-1, 1]) for (const dx of [10, 13]) E(c, sx * dx, -30.5, .9, .9, '#ffe39a', null);
  } else if (job === 'mage') { // glowing hem runes and high collar
    P(c, [[-8, -31], [-11, -36], [-4, -32]], fit.top2, OUT, 1);P(c, [[8, -31], [11, -36], [4, -32]], fit.top2, OUT, 1);
    c.save();c.globalAlpha = .65 + .35 * Math.sin(time * 4);
    for (let i = 0; i < 5; i++) {const x = -10 + i * 5, y = -9 + Math.abs(i - 2) * .6;E(c, x, y, 1.3, 1.3, accent, null);if (i % 2 === 0) L(c, x - 1.4, y - 2.4, x + 1.4, y - 2.4, accent, .9);}
    c.restore();
  } else if (job === 'gunner') { // bandolier with brass shells
    L(c, -10, -31, 10, -15, OUT, 4.6);L(c, -10, -31, 10, -15, '#6a4422', 3);
    for (let i = 0; i < 5; i++) {const t = .12 + i * .18, x = -10 + 20 * t, y = -31 + 16 * t;c.save();c.translate(x, y);c.rotate(-.65);c.fillStyle = '#ffd25a';c.fillRect(-.9, -2.6, 1.8, 3.4);c.strokeStyle = OUT;c.lineWidth = .5;c.strokeRect(-.9, -2.6, 1.8, 3.4);c.restore();}
  } else { // patched tunic
    P(c, [[4, -24], [8, -24], [8, -20], [4, -20]], '#b88a5a', OUT, .8);L(c, 4.5, -23.5, 7.5, -20.5, '#5e4630', .6);
  }
}
// ---- Auras grow with weapon tier: Rare glow + rune ring, Epic rising motes, Legendary flame
// mantle, Mythic rainbow light pillar.
function groundAura(c, lv, col, time) {
  c.save();c.scale(1, .34);
  const R = 30 + lv * 3, pulse = .55 + .25 * Math.sin(time * 4);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);g.addColorStop(0, col);g.addColorStop(1, '#00000000');
  c.globalAlpha = .28 * pulse;c.fillStyle = g;c.beginPath();c.arc(0, 0, R * 1.3, 0, Math.PI * 2);c.fill();
  c.globalAlpha = .55 * pulse;c.strokeStyle = '#1e1a2e';c.lineWidth = 5;c.beginPath();c.arc(0, 0, R, 0, Math.PI * 2);c.stroke();
  c.globalAlpha = .9 * pulse;c.strokeStyle = col;c.lineWidth = 2.6;c.beginPath();c.arc(0, 0, R, 0, Math.PI * 2);c.stroke();
  c.lineWidth = 3.2;c.setLineDash([7, 9]);c.lineDashOffset = -time * 30;c.beginPath();c.arc(0, 0, R * .72, 0, Math.PI * 2);c.stroke();
  // Rune ticks orbiting the ring.
  c.setLineDash([]);c.globalAlpha = .9 * pulse;
  for (let i = 0; i < 6; i++) {const a = time * 1.2 + i * Math.PI / 3, x = Math.cos(a) * R, y = Math.sin(a) * R;c.save();c.translate(x, y);c.rotate(a);c.fillStyle = '#1e1a2e';c.fillRect(-2.5, -6.5, 5, 13);c.fillStyle = col;c.fillRect(-1.5, -5, 3, 10);c.restore();}
  c.restore();
}
function auraBack(c, lv, col, time) {
  c.save();c.globalCompositeOperation = 'lighter';
  // Soft body glow.
  const g = c.createRadialGradient(0, -34, 4, 0, -34, 42 + lv * 3);g.addColorStop(0, col);g.addColorStop(1, '#00000000');
  c.globalAlpha = .16 + lv * .035 + .05 * Math.sin(time * 3);c.fillStyle = g;c.beginPath();c.arc(0, -34, 42 + lv * 3, 0, Math.PI * 2);c.fill();
  if (lv >= 5) { // light pillar
    const h = 150, pg = c.createLinearGradient(0, 0, 0, -h);pg.addColorStop(0, col);pg.addColorStop(1, '#00000000');
    c.globalAlpha = .22 + .08 * Math.sin(time * 5);c.fillStyle = pg;c.beginPath();c.moveTo(-17, 0);c.lineTo(17, 0);c.lineTo(9, -h);c.lineTo(-9, -h);c.closePath();c.fill();
  }
  if (lv >= 4) { // flickering flame mantle hugging the silhouette
    for (const layer of [0, 1]) {
      const fg = c.createLinearGradient(0, 2, 0, -88);fg.addColorStop(0, col);fg.addColorStop(.7, layer ? '#ffffff60' : `${col}`);fg.addColorStop(1, '#00000000');
      c.globalAlpha = layer ? .22 : .32;c.fillStyle = fg;c.beginPath();c.moveTo(-14, 2);
      const steps = 9, W = layer ? 18 : 24;
      for (let i = 0; i <= steps; i++) {const t = i / steps, y = -t * (82 + layer * 6), w = W * Math.sin(Math.PI * (.15 + t * .85)) + 3 * Math.sin(time * 9 + i * 1.7 + layer);c.lineTo(-w, y);}
      for (let i = steps; i >= 0; i--) {const t = i / steps, y = -t * (82 + layer * 6), w = W * Math.sin(Math.PI * (.15 + t * .85)) + 3 * Math.sin(time * 8 + i * 1.3 + 2 + layer);c.lineTo(w, y);}
      c.closePath();c.fill();
    }
  }
  c.restore();
}
function auraMotes(c, lv, col, time) {
  c.save();c.strokeStyle = '#1e1a2e80';c.lineWidth = .6;
  const n = 5 + lv * 2;
  for (let i = 0; i < n; i++) {
    const ph = (time * (.45 + (i % 3) * .12) + i / n) % 1, x = Math.sin(i * 2.4) * (13 + (i % 4) * 3) + Math.sin(time * 2 + i) * 2.5, y = -2 - ph * 78, r = (1 - ph) * 2.4 + .6;
    c.globalAlpha = Math.sin(ph * Math.PI);c.fillStyle = i % 4 ? col : '#ffffff';
    c.beginPath();c.moveTo(x, y - r * 2);c.lineTo(x + r * .6, y - r * .6);c.lineTo(x + r * 2, y);c.lineTo(x + r * .6, y + r * .6);c.lineTo(x, y + r * 2);c.lineTo(x - r * .6, y + r * .6);c.lineTo(x - r * 2, y);c.lineTo(x - r * .6, y - r * .6);c.closePath();c.fill();c.stroke();
  }
  c.restore();
}
// Armour on the torso (x -12..12, y -31..-15) and shoulders.
const ARMOR_TOON = [['#c9b48a', '#8a6a44'], ['#a8683a', '#5a3418'], ['#d8e2ee', '#6a7a92'], ['#9fe6ff', '#2a7ab8'], ['#d4473e', '#6a1418'], ['#fff0ff', '#a05ac8'],
  ['#7af0c4', '#137a5a'], ['#d6f6ff', '#2a6f9a'], ['#5a46c8', '#c4b4ff'], ['#ff8ac8', '#8a1a5a'], ['#ffe58a', '#8a6a10'],
  ['#fffbe0', '#a8862a'], ['#ff9a5a', '#7a2a0a'], ['#8ae4ff', '#0a4a8a'], ['#c8ff7a', '#3a7a0a'], ['#ffc4f4', '#5a1a8a']];
function wornArmor(c, t, time) {
  const [body, trim] = ARMOR_TOON[t];
  P(c, [[-12, -31], [12, -31], [12, -16], [0, -14], [-12, -16]], body, OUT, 1.3);
  if (t === 0) {L(c, -11, -18, 11, -18, trim, 2.6);E(c, 0, -26, 1.4, 1.4, trim, null);E(c, 0, -22, 1.4, 1.4, trim, null);}
  else if (t === 1) {L(c, -10, -30, 8, -17, trim, 2.2);L(c, 10, -30, -8, -17, trim, 2.2);E(c, 0, -23.5, 2.2, 2.2, '#d4a64a', OUT, .8);}
  else {for (const s of [-1, 1]) {P(c, [[s * 7, -34], [s * 17, -32], [s * 17, -24], [s * 9, -25]], body, OUT, 1.2);if (t >= 2) L(c, s * 9, -30, s * 16, -29, trim, 1.4);}
    P(c, [[-8, -29], [8, -29], [7, -19], [0, -16], [-7, -19]], t === 2 ? '#f2f6fa' : body, trim, 1.2);
    if (t === 3) {P(c, [[0, -28], [3, -23], [0, -18], [-3, -23]], '#ffffff', '#2a7ab8', .8);glowDot(c, 0, -23, 9, '#bff0ff88');}
    if (t === 4) {for (let r = 0; r < 3; r++) for (let i = -1; i <= 1; i++) {c.beginPath();c.arc(i * 4 + (r % 2) * 2, -27 + r * 3.5, 2.2, 0, Math.PI);c.strokeStyle = trim;c.lineWidth = 1;c.stroke();}for (const s of [-1, 1]) P(c, [[s * 14, -33], [s * 19, -39], [s * 17, -31]], '#ffd25a', OUT, .8);}
    if (t === 5) {for (let i = 0; i < 3; i++) E(c, -4 + i * 4, -24, 1.8, 1.8, `hsl(${(time * 120 + i * 90) % 360} 90% 65%)`, null);glowDot(c, 0, -24, 11, '#fff1ff88');}
    if (t > 5) {const tc = TIERS[t];P(c, [[0, -29], [4, -23], [0, -17], [-4, -23]], tc.glow, trim, .9);glowDot(c, 0, -23, 12, `${tc.color}99`);for (const s of [-1, 1]) P(c, [[s * 15, -33], [s * 22, -41], [s * 18, -31]], tc.color, OUT, .8);}}
}
// Helmets on the head (centre 0,-46; crown at about y -62).
function wornHelmet(c, t, time, flutter, back = false) {
  if (t === 0) {L(c, -17, -53, 17, -53, OUT, 5);L(c, -17, -53, 17, -53, '#d4473e', 3.4);P(c, [[-16, -53], [-25, -48 + flutter * .5], [-22, -45], [-15, -50]], '#d4473e', OUT, 1);return;}
  if (t === 1) {c.beginPath();c.moveTo(-18, -50);c.quadraticCurveTo(-17, -68, 0, -68);c.quadraticCurveTo(17, -68, 18, -50);c.closePath();c.fillStyle = '#a8683a';c.fill();c.strokeStyle = OUT;c.lineWidth = 1.4;c.stroke();P(c, [[-20, -51], [20, -51], [22, -48], [-22, -48]], '#5a3418', OUT, 1);return;}
  if (t === 2) {c.beginPath();c.moveTo(-19, -46);c.quadraticCurveTo(-19, -70, 0, -70);c.quadraticCurveTo(19, -70, 19, -46);if (back) c.lineTo(-19, -46);else {c.lineTo(14, -46);c.lineTo(13, -52);c.lineTo(-13, -52);c.lineTo(-14, -46);}c.closePath();c.fillStyle = '#d8e2ee';c.fill();c.strokeStyle = OUT;c.lineWidth = 1.4;c.stroke();
    if (back) L(c, 0, -69, 0, -47, '#9aa8bc', 2);else L(c, 0, -52, 0, -44, '#6a7a92', 2.4);P(c, [[-2, -70], [2, -70], [6, -80 + flutter * .3], [-1, -76]], '#d4473e', OUT, 1);return;}
  if (t === 3) {P(c, [[-17, -54], [-16, -63], [-10, -58], [-5, -70], [0, -60], [5, -70], [10, -58], [16, -63], [17, -54]], '#9fe6ff', '#2a7ab8', 1.2);if (!back) P(c, [[0, -64], [2.5, -60], [0, -56], [-2.5, -60]], '#ffffff', '#2a7ab8', .8);glowDot(c, 0, -60, 12, '#bff0ff66');return;}
  if (t === 4) {for (const s of [-1, 1]) P(c, [[s * 13, -60], [s * 24, -76], [s * 22, -64], [s * 17, -56]], '#f4e4c4', OUT, 1.1);
    c.beginPath();c.moveTo(-19, -47);c.quadraticCurveTo(-19, -70, 0, -70);c.quadraticCurveTo(19, -70, 19, -47);c.lineTo(-19, -47);c.closePath();c.fillStyle = '#d4473e';c.fill();c.strokeStyle = OUT;c.lineWidth = 1.4;c.stroke();
    if (!back) {P(c, [[-12, -52], [-4, -54], [-5, -49], [-12, -49]], '#ffd25a', OUT, .8);P(c, [[12, -52], [4, -54], [5, -49], [12, -49]], '#ffd25a', OUT, .8);}else P(c, [[0, -70], [3, -62], [0, -48], [-3, -62]], '#9a1828', OUT, .8);return;}
  const tc = t > 5 ? TIERS[t] : null;
  c.beginPath();c.ellipse(0, -76, 15, 4, 0, 0, Math.PI * 2);c.strokeStyle = tc ? tc.glow : '#ffe9a8';c.lineWidth = 2.4;c.stroke();glowDot(c, 0, -76, 14, tc ? `${tc.color}77` : '#fff6c066');
  P(c, [[-16, -54], [-15, -64], [-9, -59], [0, -70], [9, -59], [15, -64], [16, -54]], tc ? tc.color : '#ffe39a', tc ? tc.dark : '#a8782a', 1.2);
  for (let i = 0; i < 3; i++) E(c, -7 + i * 7, -58, 1.9, 1.9, `hsl(${(time * 120 + i * 90) % 360} 90% 65%)`, null);
}

// ---------------------------------------------------------------- stage themes
export const THEMES = [
  {id: 'forest', bossName: 'ราชินีหนามพงไพร', ground: '#86b765', ground2: '#76a756', stone: '#c2bc9e', rim: '#8d8a70', edge: '#2f5a36', edge2: '#3f6e40', slime: ['#a6e070', '#5fa83e'], body: '#c0743a', body2: '#7a4420', accent: '#7fd35a', glow: '#d8ff9a', eye: '#2b2133', portal: '#5ef2d8'},
  {id: 'volcano', bossName: 'ยักษ์เพลิงหลอมเหล็ก', ground: '#5a4644', ground2: '#4a3838', stone: '#7a6560', rim: '#3a2a2a', edge: '#1e1416', edge2: '#2e1e1e', slime: ['#ffa04a', '#c4441a'], body: '#d2552a', body2: '#6a1c12', accent: '#ffb03a', glow: '#ffd27a', eye: '#ffe08a', portal: '#ff7a3a'},
  {id: 'ice', bossName: 'อัศวินวิญญาณน้ำแข็ง', ground: '#e6f1fa', ground2: '#cfe2f1', stone: '#b3cce2', rim: '#86a6c6', edge: '#5f82a8', edge2: '#7896bb', slime: ['#c4ecff', '#6ab4e8'], body: '#eef6ff', body2: '#8fb4d8', accent: '#7fd8ff', glow: '#e0f8ff', eye: '#1f6fc0', portal: '#9fe8ff'},
  {id: 'temple', bossName: 'ยักษ์ทองผู้พิทักษ์', ground: '#ecd59f', ground2: '#dcc084', stone: '#cfa45e', rim: '#9a6a2a', edge: '#5a3a1a', edge2: '#7a5226', slime: ['#ffdc70', '#d29a22'], body: '#d49440', body2: '#7a4a1a', accent: '#d23a3a', glow: '#fff0a8', eye: '#2b2133', portal: '#ffd25a'},
  {id: 'moon', bossName: 'จักรพรรดิจันทราดำ', ground: '#423e62', ground2: '#36325a', stone: '#5e5a86', rim: '#2a2648', edge: '#121026', edge2: '#1e1a38', slime: ['#c0b0ff', '#5a48b0'], body: '#4a3f7a', body2: '#1e1840', accent: '#d8dcff', glow: '#d6d0ff', eye: '#e8e4ff', portal: '#b48aff'},
  {id: 'crystal', bossName: 'มังกรคริสตัล', ground: '#34606c', ground2: '#2a505c', stone: '#467882', rim: '#1e3e48', edge: '#0c2228', edge2: '#14323a', slime: ['#88f4e4', '#2aa8a0'], body: '#3a9aa2', body2: '#18484e', accent: '#ff8ad8', glow: '#b0fff2', eye: '#ffe0f4', portal: '#ff8ad8'},
  {id: 'desert', bossName: 'ฟาโรห์ทรายทมิฬ', ground: '#f0d29a', ground2: '#e4c07e', stone: '#d8a868', rim: '#a8763a', edge: '#7a4a2a', edge2: '#8a5a32', slime: ['#ffe08a', '#e0a040'], body: '#c88a4a', body2: '#7a4a22', accent: '#3ad0c0', glow: '#fff0b0', eye: '#2b2133', portal: '#ffd25a'},
  {id: 'swamp', bossName: 'ราชากบหนองพิษ', ground: '#6a8a5a', ground2: '#5a7a4c', stone: '#7a8a6a', rim: '#4a5a3a', edge: '#1e2e22', edge2: '#2a3a2a', slime: ['#b8e86a', '#5a9a2a'], body: '#6ac05a', body2: '#3a7a3a', accent: '#c46bff', glow: '#e0ffb0', eye: '#2b2133', portal: '#c46bff'},
  {id: 'sky', bossName: 'พญาครุฑสายฟ้า', ground: '#d8ecff', ground2: '#c4dcf4', stone: '#ffffff', rim: '#a8c4e4', edge: '#6a9ad8', edge2: '#7aaae0', slime: ['#ffffff', '#9ac8ff'], body: '#7ac0ff', body2: '#3a7ad0', accent: '#ffd25a', glow: '#fffbe0', eye: '#2b2133', portal: '#ffe27a'},
  {id: 'deepsea', bossName: 'คราเคนยักษ์', ground: '#2a6a8a', ground2: '#245c7a', stone: '#3a8aa0', rim: '#1a4a62', edge: '#0a1e3a', edge2: '#102a48', slime: ['#7ae8ff', '#2a8ac8'], body: '#ff8a6a', body2: '#c84a3a', accent: '#ff9ad0', glow: '#c8f8ff', eye: '#2b2133', portal: '#7ae8ff'},
  {id: 'candy', bossName: 'ราชินีเค้กสตรอว์เบอร์รี', ground: '#ffe0ec', ground2: '#ffd0e2', stone: '#ffffff', rim: '#ff8ac8', edge: '#c84a8a', edge2: '#d85a9a', slime: ['#ffc4e8', '#ff6ab4'], body: '#ff8ac8', body2: '#c84a8a', accent: '#7ad0ff', glow: '#fff0f8', eye: '#2b2133', portal: '#ff8ac8'},
  {id: 'clockwork', bossName: 'ไททันฟันเฟือง', ground: '#a89a84', ground2: '#988a74', stone: '#c8b89a', rim: '#6a5a44', edge: '#2a2420', edge2: '#3a322a', slime: ['#ffd27a', '#c88a3a'], body: '#5a8ab0', body2: '#2a4a6a', accent: '#ffd25a', glow: '#fff0c0', eye: '#5ae8ff', portal: '#ffb43a'},
  {id: 'haunted', bossName: 'เจ้าชายแวมไพร์', ground: '#4a4258', ground2: '#3e374c', stone: '#6a6278', rim: '#2a2436', edge: '#100c18', edge2: '#1a1424', slime: ['#b0ff9a', '#4a9a5a'], body: '#6a4a8a', body2: '#3a1a4a', accent: '#9aff7a', glow: '#d0ffd0', eye: '#ff3a5a', portal: '#9aff7a'},
  {id: 'sakura', bossName: 'จิ้งจอกเก้าหาง', ground: '#f4e4dc', ground2: '#ecd4cc', stone: '#d8c0b4', rim: '#a87a6a', edge: '#4a2a3a', edge2: '#5a3448', slime: ['#ffd4e4', '#ff8ab4'], body: '#ff8ab4', body2: '#a83a6a', accent: '#ffb4d0', glow: '#fff0f6', eye: '#2b2133', portal: '#ff8ab4'},
  {id: 'void', bossName: 'มังกรกลืนดาว', ground: '#2a2050', ground2: '#221a44', stone: '#4a3a80', rim: '#1a1238', edge: '#05030f', edge2: '#0c0820', slime: ['#b4a8ff', '#5a40d0'], body: '#5a40d0', body2: '#1e1060', accent: '#ff8ad8', glow: '#e0d8ff', eye: '#ffe27a', portal: '#8a7aff'}
];
// Stages 1-10 are world 1 (forest), 11-20 world 2, and so on.
export function themeFor(stage = 1) {return THEMES[(Math.ceil(Math.max(1, stage) / 10) - 1) % THEMES.length];}

// ---------------------------------------------------------------- monsters
function hpBar(c, e, y) {
  if (e.hp >= e.max || e.type === 'boss') return;
  c.fillStyle = '#1e3a38cc';c.fillRect(-18, y, 36, 4);c.fillStyle = '#f2b38a';c.fillRect(-18, y, 36 * Math.max(0, e.hp / e.max), 4);
}
export function drawToonMonster(c, e, time, player) {
  const th = themeFor(e.stage), flash = e.flash > 0, f = col => flash ? '#fff6dc' : col;
  const t = time + e.id * .37, faceLeft = player.x < e.x;
  LW = 1.8;SHADE = !flash;SHADE_MIN = 9; // only bodies: crowds of monsters stay cheap
  c.save();c.translate(e.x, e.y);
  if (e.type === 'boss') bossAura(c, e, th, time);
  E(c, 0, 2, e.r * 1.1, e.r * .38, '#10303045', null);
  if (e.slow > 0) E(c, 0, 0, e.r * 1.35, e.r * .5, '#9fe0ff40', null);
  c.save();if (faceLeft) c.scale(-1, 1);
  if (e.rage) c.translate(Math.sin(time * 40) * (e.berserk ? 3 : 1.6), 0);
  if (e.berserk) c.scale(1.12, 1.12);
  if (VARIANT[th.id]?.[e.type]) VARIANT[th.id][e.type](c, th, f, t, e);
  else if (e.type === 'runner') runner(c, th, f, t, e);
  else if (e.type === 'brute') brute(c, th, f, t, e);
  else if (e.type === 'bomber') bomber(c, th, f, t, e);
  else if (e.type === 'imp') imp(c, th, f, t, e);
  else if (e.type === 'spitter') spitter(c, th, f, t, e);
  else if (e.type === 'archer') caster(c, th, f, t, e);
  else if (e.type === 'elite') beast(c, th, f, t, e);
  else if (e.raid) riftLord(c, f, t, e);
  else if (e.type === 'boss') titan(c, th, f, t, e);
  else slime(c, th, f, t, e);
  c.restore();
  if (e.rage) rageEmbers(c, e, time);
  if (e.berserk) {c.save();c.globalAlpha = .25 + .2 * Math.sin(time * 12);glowDot(c, 0, -e.r * 2.2, e.r * 3.2, '#ff1a2a');c.restore();}
  LW = 1.4;SHADE = false;SHADE_MIN = 3.5;
  hpBar(c, e, e.type === 'elite' ? -82 : e.type === 'brute' ? -80 : e.type === 'imp' ? -48 : e.type === 'spitter' ? -66 : -e.r * 3.4);
  c.restore();
}
// ---- World-specific monsters: each map dresses the shared behaviours in its own creatures.
const lift = e => e.warn ? Math.min(1, (1 - e.warn.t) / .6) : 0;
const armed = (e, t) => e.warn && Math.sin(t * 30) > 0;
function glowEyes(c, x, y, gap, r, col) {glowDot(c, x, y, gap * 3, `${col}66`);for (const s of [-1, 1]) E(c, x + s * gap, y, r, r * 1.2, col, null);}
function swingArm(c, x, y, raise, color, w, tip) {c.save();c.translate(x, y);c.rotate(.6 - raise * 2.2);limb(c, 0, 0, 10, 16, color, w);c.translate(10, 18);tip();c.restore();}
// Forest: a walking treant and a spore puffball.
function treant(c, th, f, t, e) {
  const step = Math.sin(t * 5) * 3, bark = f('#7a5634');
  for (const s of [-1, 1]) {limb(c, s * 8, -12, s * 11 + step * s, 0, bark, 8);P(c, [[s * 11 + step * s - 6, 0], [s * 11 + step * s + 7, 0], [s * 11 + step * s, -4]], bark, OUT, 1);}
  P(c, [[-15, -8], [15, -8], [13, -48], [-13, -48]], bark);for (const x of [-7, 6]) L(c, x, -12, x + 2, -40, '#5a3a20', 1.6);
  limb(c, -12, -38, -22, -22, bark, 6);L(c, -22, -22, -28, -18, OUT, 2);L(c, -22, -22, -24, -14, OUT, 2);
  E(c, 0, -60, 23, 15, f('#4f8a3a'));E(c, -12, -54, 12, 9, f('#5fa046'));E(c, 12, -56, 13, 9, f('#6ab84e'));E(c, 4, -68, 10, 6, f('#7fd35a'), null);
  for (const x of [1, 10]) E(c, x, -34, 3.2, 4.2, '#1a1008', null);glowEyes(c, 5.5, -34, 4.5, 1.6, th.glow);
  P(c, [[-1, -24], [12, -24], [10, -20], [7, -23], [4, -20], [1, -23]], '#1a1008', null);
  swingArm(c, 12, -40, lift(e), bark, 6, () => {for (const k of [-1, 0, 1]) L(c, 0, 0, k * 6, 8, OUT, 2.4);E(c, -2, -4, 6, 4, f('#5fa046'), OUT, 1);});
}
function sporePuff(c, th, f, t, e) {
  const pulse = e.warn ? 1 + Math.sin(t * 40) * .1 : 1, hop = Math.abs(Math.sin(t * 10)) * 2;
  c.translate(0, -hop);E(c, 0, -8, 7, 8, f('#f1d5b0'));eyes(c, 2, -9, 1.8, 3.2, th, f);blush(c, 2, -5, 1.4, 4.5);
  c.save();c.translate(0, -16);c.scale(pulse, pulse);
  c.beginPath();c.moveTo(-17, 2);c.bezierCurveTo(-17, -20, 17, -20, 17, 2);c.closePath();c.fillStyle = armed(e, t) ? '#ff4a3a' : f('#9a4ac8');c.fill();c.strokeStyle = OUT;c.lineWidth = 1.4;c.stroke();
  for (const [x, y, r] of [[-8, -6, 3], [5, -10, 3.6], [10, -2, 2.4], [-2, -1, 2]]) E(c, x, y, r, r * .8, '#f4e4ff', null);c.restore();
  for (let i = 0; i < 4; i++) {const ph = (t * .8 + i / 4) % 1;c.globalAlpha = 1 - ph;glowDot(c, Math.sin(i * 3 + t) * 10, -30 - ph * 18, 5, '#c8ff8a88');}c.globalAlpha = 1;
}
// Volcano: a magma golem with glowing cracks.
function magmaGolem(c, th, f, t, e) {
  const step = Math.sin(t * 4) * 3, rock = f('#3a2a2a'), lava = f('#ff7a2a');
  for (const s of [-1, 1]) {limb(c, s * 9, -14, s * 10 + step * s, -2, rock, 9);}
  P(c, [[-20, -12], [-12, -4], [14, -6], [20, -22], [14, -46], [-6, -50], [-20, -36]], rock);
  glowDot(c, -1, -28, 22, '#ff5a1a44');for (const [a, b, x, y] of [[-12, -38, -4, -26], [-4, -26, -10, -12], [-4, -26, 8, -18], [8, -18, 6, -40]]) {L(c, a, b, x, y, lava, 2.4);}
  limb(c, -16, -36, -24, -16, rock, 8);E(c, -24, -14, 7, 6, rock);
  P(c, [[4, -48], [18, -52], [24, -42], [16, -36], [4, -38]], rock);glowEyes(c, 15, -44, 3.6, 1.8, '#ffd27a');
  for (let i = 0; i < 3; i++) {const ph = (t + i / 3) % 1;c.globalAlpha = 1 - ph;E(c, -6 + i * 8, -52 - ph * 14, 2.2, 2.2, '#ffb03a', null);}c.globalAlpha = 1;
  swingArm(c, 14, -34, lift(e), rock, 8, () => {E(c, 0, 0, 10, 9, rock);L(c, -5, -3, 4, 4, lava, 2);});
}
// Ice: a yeti.
function yeti(c, th, f, t, e) {
  const step = Math.sin(t * 5) * 3, fur = f('#f4f8ff');
  for (const s of [-1, 1]) {limb(c, s * 9, -14, s * 10 + step * s, -2, fur, 9);E(c, s * 10 + step * s, -1, 7, 3.4, f('#8fb4d8'));}
  E(c, -2, -32, 20, 22, fur);for (let i = 0; i < 5; i++) P(c, [[-18 + i * 8, -16], [-14 + i * 8, -10], [-10 + i * 8, -16]], fur, null);
  limb(c, -15, -36, -24, -16, fur, 9);
  E(c, 10, -50, 12, 11, fur);E(c, 14, -47, 8, 7, f('#8fb4d8'));for (const s of [-1, 1]) P(c, [[8 + s * 5, -58], [8 + s * 12, -66], [8 + s * 8, -55]], f('#dbe6f2'), OUT, 1);
  eyes(c, 15, -49, 1.8, 3.2, th, f, true);P(c, [[11, -42], [20, -42], [16, -39]], '#1a2a4a', OUT, .8);fangs(c, 15.5, -42, 1.6, f);
  swingArm(c, 12, -38, lift(e), fur, 9, () => {E(c, 0, 0, 8, 7, fur);for (const k of [-1, 0, 1]) P(c, [[k * 4 - 1.5, 5], [k * 4, 10], [k * 4 + 1.5, 5]], f('#cfe2f1'), OUT, .8);});
}
// Temple: a stone guardian statue, a scarab bomber and a spitting cobra.
function stoneGuardian(c, th, f, t, e) {
  const step = Math.sin(t * 4) * 2, stone = f('#cfa45e'), gold = f('#ffd25a');
  for (const s of [-1, 1]) P(c, [[s * 12 - 5 + step * s, 0], [s * 12 + 5 + step * s, 0], [s * 10 + 4, -14], [s * 10 - 4, -14]], stone);
  P(c, [[-18, -14], [18, -14], [20, -44], [-20, -44]], stone);P(c, [[-18, -20], [18, -20], [18, -24], [-18, -24]], gold, OUT, 1);E(c, 0, -34, 5, 5, f('#d23a3a'), OUT, 1);
  P(c, [[-24, -46], [-14, -50], [-14, -40], [-24, -36]], stone);
  P(c, [[-2, -46], [18, -46], [18, -64], [-2, -64]], stone);P(c, [[-4, -64], [20, -64], [16, -72], [0, -72]], gold);
  glowEyes(c, 9, -56, 4, 1.6, '#ff3a2a');L(c, 2, -50, 16, -50, OUT, 2);
  swingArm(c, 16, -40, lift(e), stone, 8, () => {L(c, 0, 8, 0, -30, OUT, 6);L(c, 0, 8, 0, -30, f('#7a4a1a'), 3.5);P(c, [[0, -44], [6, -30], [-6, -30]], gold);});
}
function scarab(c, th, f, t, e) {
  const walk = Math.sin(t * 20) * 2;
  for (const x of [-7, 0, 7]) for (const s of [-1, 1]) L(c, x, -6, x + walk * s, 0, OUT, 1.6);
  c.save();if (e.warn) c.scale(1 + Math.sin(t * 40) * .06, 1 + Math.sin(t * 40) * .06);
  E(c, -1, -9, 13, 9, armed(e, t) ? '#ff4a3a' : f('#2a6a5a'));L(c, -1, -17, -1, -1, OUT, 1.2);E(c, -5, -13, 4, 2.4, '#ffffff40', null);
  E(c, 13, -8, 5, 4.5, f('#1e4a40'));for (const s of [-1, 1]) L(c, 16, -10, 21, -12 + s * 3, OUT, 1.4);glowEyes(c, 15, -9, 1.6, 1, '#ffd25a');
  E(c, -3, -20, 6, 5, f('#d29a22'));c.beginPath();c.moveTo(-3, -25);c.quadraticCurveTo(2, -31, 0, -34);c.strokeStyle = '#6a4a2a';c.lineWidth = 2;c.stroke();
  glowDot(c, 0, -35, 7 + Math.sin(t * 20) * 2, '#ffd27aaa');c.restore();
}
function cobra(c, th, f, t, e) {
  const sway = Math.sin(t * 3) * 3, body = f('#b8922a'), charge = e.warn ? 1 : 0;
  E(c, 0, -5, 16, 6, body);E(c, 0, -11, 12, 5, body);
  c.beginPath();c.moveTo(-4, -12);c.quadraticCurveTo(-6 + sway, -26, 2 + sway, -36);c.strokeStyle = OUT;c.lineWidth = 10;c.stroke();c.strokeStyle = body;c.lineWidth = 7;c.stroke();
  c.save();c.translate(2 + sway, -40);E(c, 0, 0, 12, 14, f('#d29a22'));E(c, 0, 1, 7, 10, f('#fff0a8'), null);
  for (const y of [-4, 2]) P(c, [[-4, y], [0, y + 4], [4, y]], f('#d23a3a'), null);
  E(c, 5, -9, 6, 5, body);glowEyes(c, 6, -10, 2.4, 1.2, '#ff3a2a');
  L(c, 10, -7, 15, -6, '#d23a3a', 1.2);glowDot(c, 13, -7, 6 + charge * 6, `${th.glow}aa`);c.restore();
}
// Moon: a werewolf, a ghost swarm, a floating eye and a shadow orb.
function werewolf(c, th, f, t, e) {
  const step = Math.sin(t * 6) * 3, fur = f('#3a3258');
  for (const s of [-1, 1]) {limb(c, s * 8, -14, s * 10 + step * s, -2, fur, 7);}
  E(c, -2, -30, 16, 19, fur);for (let i = 0; i < 4; i++) P(c, [[-14 + i * 5, -46], [-12 + i * 5, -54], [-9 + i * 5, -46]], fur, null);
  limb(c, -12, -36, -20, -16, fur, 7);for (const k of [-1, 0, 1]) L(c, -20, -16, -22 + k * 3, -10, f('#e8e4ff'), 1.6);
  E(c, 10, -48, 10, 9, fur);P(c, [[14, -50], [28, -44], [26, -40], [14, -42]], fur);E(c, 27, -44, 2, 1.8, OUT, null);
  for (const s of [0, 7]) P(c, [[2 + s, -54], [4 + s, -64], [8 + s, -55]], fur);
  glowEyes(c, 13, -50, 2.6, 1.3, '#ffe08a');fangs(c, 21, -41, 1.6, f);
  swingArm(c, 12, -38, lift(e), fur, 7, () => {for (const k of [-1, 0, 1]) P(c, [[k * 4 - 1.5, 0], [k * 5, 10], [k * 4 + 1.5, 0]], f('#e8e4ff'), OUT, .8);});
}
function ghost(c, th, f, t, e) {
  const hover = Math.sin(t * 5) * 3;c.translate(0, -18 + hover);c.globalAlpha = .88;
  c.beginPath();c.moveTo(-9, 2);c.bezierCurveTo(-11, -16, 11, -16, 9, 2);for (let i = 0; i < 4; i++) c.lineTo(9 - (i + .5) * 4.5, 6 + Math.sin(t * 10 + i) * 3), c.lineTo(9 - (i + 1) * 4.5, 2);
  c.closePath();c.fillStyle = f('#d8dcff');c.fill();c.strokeStyle = OUT;c.lineWidth = 1.2;c.stroke();c.globalAlpha = 1;
  glowDot(c, 0, -4, 12, '#b48aff44');eyes(c, 1.5, -6, 1.6, 3.4, th, f);blush(c, 1.5, -2.5, 1.4, 5.2);E(c, 1.5, -.5, 1.3, 1.6, f('#3a1a4a'), null);
}
function floatingEye(c, th, f, t, e) {
  const hover = Math.sin(t * 2.5) * 3, charge = e.warn ? 1 : 0;c.translate(0, -30 + hover);
  for (let i = 0; i < 4; i++) {c.beginPath();c.moveTo(-9 + i * 6, 8);c.quadraticCurveTo(-11 + i * 6 + Math.sin(t * 4 + i) * 4, 18, -9 + i * 6, 26);c.strokeStyle = OUT;c.lineWidth = 4;c.stroke();c.strokeStyle = f(th.body);c.lineWidth = 2.4;c.stroke();}
  E(c, 0, 0, 15, 14, f(th.body));E(c, 3, 0, 9, 9, f('#f4f0ff'), OUT, 1);glowDot(c, 5, 0, 10 + charge * 8, '#ff5aff66');E(c, 5, 0, 4 + charge, 5 + charge, f('#c03adf'), null);E(c, 5.6, 0, 1.6, 3.2, '#12081a', null);
  P(c, [[-12, -8], [0, -15], [14, -8], [12, -4], [0, -9], [-10, -4]], f(th.body2), OUT, 1);for (const x of [-8, 0, 8]) P(c, [[x - 2, -12], [x, -20], [x + 2, -12]], f(th.body2), OUT, .8);
}
function shadowOrb(c, th, f, t, e) {
  const pulse = e.warn ? 1 + Math.sin(t * 40) * .1 : 1, hover = Math.sin(t * 6) * 2;
  c.translate(0, -16 + hover);c.scale(pulse, pulse);glowDot(c, 0, 0, 22, armed(e, t) ? '#ff3a3a88' : '#b48aff55');
  E(c, 0, 0, 11, 11, armed(e, t) ? '#5a0a1a' : f('#120e24'));
  c.save();c.rotate(t * 3);c.scale(1, .35);c.beginPath();c.arc(0, 0, 17, 0, Math.PI * 1.6);c.strokeStyle = f('#b48aff');c.lineWidth = 3;c.stroke();c.restore();
  glowEyes(c, 2, -1, 3.4, 1.6, '#e8e4ff');
}
// Crystal: a crystal golem, a shard cluster, a crystal moth and a crystal turret.
function crystalGolem(c, th, f, t, e) {
  const step = Math.sin(t * 4) * 2, body = f(th.body), dark = f(th.body2), pink = f(th.accent);
  for (const s of [-1, 1]) P(c, [[s * 10 - 5 + step * s, 0], [s * 10 + 5 + step * s, 0], [s * 8 + 4, -16], [s * 8 - 4, -16]], dark);
  P(c, [[-18, -16], [18, -16], [22, -38], [8, -52], [-12, -50], [-22, -36]], body);P(c, [[-6, -46], [6, -48], [2, -24], [-4, -26]], f(th.glow), null);
  for (const [x, y, h] of [[-16, -48, 16], [-6, -52, 22], [6, -50, 14]]) P(c, [[x - 4, y + 4], [x, y - h], [x + 4, y + 4]], pink);
  P(c, [[-22, -36], [-28, -18], [-20, -16]], dark);
  P(c, [[4, -50], [20, -52], [22, -62], [8, -64]], body);glowEyes(c, 14, -57, 3.4, 1.5, th.eye);
  swingArm(c, 16, -38, lift(e), dark, 7, () => {P(c, [[-6, 2], [6, 2], [0, -26]], pink);P(c, [[-2, 0], [2, 0], [0, -18]], '#ffffff88', null);});
}
function shardCluster(c, th, f, t, e) {
  const walk = Math.sin(t * 16) * 2, hot = armed(e, t);
  for (const s of [-1, 1]) L(c, s * 5, -4, s * 6 + walk * s, 0, OUT, 2);
  c.save();if (e.warn) c.scale(1 + Math.sin(t * 40) * .08, 1 + Math.sin(t * 40) * .08);glowDot(c, 0, -14, 18, hot ? '#ff3a3a88' : `${th.glow}66`);
  for (const [x, h, w] of [[-8, 18, 5], [8, 16, 5], [0, 26, 6], [-3, 12, 4]]) P(c, [[x - w, -4], [x + w, -4], [x + w * .4, -4 - h], [x - w * .4, -4 - h - 3]], hot ? '#ff6a5a' : f(x ? th.accent : th.body));
  glowEyes(c, 1, -14, 3, 1.4, '#ffffff');c.restore();
}
function crystalMoth(c, th, f, t, e) {
  const flap = Math.sin(t * 20), hover = Math.sin(t * 6) * 3;c.translate(0, -20 + hover);
  for (const s of [-1, 1]) {c.save();c.scale(s, 1 - Math.abs(flap) * .3);P(c, [[1, -1], [14, -12], [18, -2], [12, 4], [2, 2]], f(th.accent));P(c, [[2, 2], [12, 6], [10, 12], [3, 6]], f(th.glow));c.restore();}
  E(c, 0, 0, 3.4, 8, f(th.body2));for (const s of [-1, 1]) L(c, s, -7, s * 5, -13, OUT, 1);glowEyes(c, 0, -5, 1.8, 1, '#ffffff');
}
function crystalTurret(c, th, f, t, e) {
  const charge = e.warn ? 1 : 0, spin = t * (2 + charge * 6);
  P(c, [[-12, 0], [12, 0], [8, -8], [-8, -8]], f(th.body2));P(c, [[-7, -8], [7, -8], [4, -40], [0, -48], [-4, -40]], f(th.body));P(c, [[-1, -12], [2, -12], [1, -38]], '#ffffff66', null);
  c.save();c.translate(0, -30);c.scale(1, .35);c.rotate(spin);for (let i = 0; i < 3; i++) {c.rotate(Math.PI * 2 / 3);P(c, [[12, -3], [20, 0], [12, 3]], f(th.accent), OUT, .8);}c.restore();
  glowDot(c, 0, -52, 10 + charge * 8, `${th.accent}aa`);E(c, 0, -52, 4 + charge * 1.5, 4 + charge * 1.5, f(th.eye), OUT, 1);
}
const VARIANT = {
  forest: {brute: treant, bomber: sporePuff},
  volcano: {brute: magmaGolem},
  ice: {brute: yeti},
  temple: {brute: stoneGuardian, bomber: scarab, spitter: cobra},
  moon: {brute: werewolf, imp: ghost, spitter: floatingEye, bomber: shadowOrb},
  crystal: {brute: crystalGolem, bomber: shardCluster, imp: crystalMoth, spitter: crystalTurret},
  desert: {brute: sandScorpion, bomber: cactusBomb, archer: mummyCaster},
  swamp: {runner: frog, spitter: snapFlower},
  sky: {bomber: cloudPuff, imp: birdling},
  deepsea: {imp: jellyfish, brute: crab, bomber: puffer},
  candy: {brute: gummyBear, bomber: cupcake, spitter: lollipop},
  clockwork: {brute: robot, imp: gearDrone, spitter: cannonBot},
  haunted: {bomber: pumpkin, brute: skeletonKnight, runner: batling},
  sakura: {bomber: lantern, brute: oni, runner: tanuki},
  void: {imp: starSprite, bomber: miniPlanet, spitter: ufo}
};
// Guardians stand on a pulsing dark sigil; enraged ones burn red.
function bossAura(c, e, th, time) {
  const R = e.r * (e.mini ? 2.2 : 3) * (e.berserk ? 1.25 : 1), rage = !!e.rage, col = rage ? '#ff2a3a' : th.portal;
  c.save();c.scale(1, .36);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.2);g.addColorStop(0, rage ? '#ff2a3a70' : '#1a0a2a70');g.addColorStop(1, '#00000000');
  c.fillStyle = g;c.beginPath();c.arc(0, 0, R * 1.2, 0, Math.PI * 2);c.fill();
  c.globalAlpha = .7 + .25 * Math.sin(time * (rage ? 10 : 4));c.strokeStyle = '#1e1a2e';c.lineWidth = 7;c.beginPath();c.arc(0, 0, R, 0, Math.PI * 2);c.stroke();
  c.strokeStyle = col;c.lineWidth = 3.5;c.stroke();
  c.save();c.rotate(time * (rage ? 1.6 : .6));for (let i = 0; i < 8; i++) {c.rotate(Math.PI / 4);c.beginPath();c.moveTo(R * .62, 0);c.lineTo(R * .86, -7);c.lineTo(R * .86, 7);c.closePath();c.fillStyle = col;c.fill();}c.restore();
  c.setLineDash([10, 12]);c.lineDashOffset = time * 40;c.lineWidth = 2.5;c.beginPath();c.arc(0, 0, R * .5, 0, Math.PI * 2);c.stroke();
  c.restore();
}
function rageEmbers(c, e, time) {
  c.save();
  for (let i = 0; i < 10; i++) {const ph = (time * .9 + i / 10) % 1, x = Math.sin(i * 2.1 + time) * e.r * 1.4, y = -e.r * .5 - ph * e.r * 5;c.globalAlpha = Math.sin(ph * Math.PI);E(c, x, y, 2.6 * (1 - ph) + 1, 2.6 * (1 - ph) + 1, i % 3 ? '#ff5a2a' : '#ffd27a', null);}
  c.restore();
}
function fangs(c, x, y, w, f) {for (let i = 0; i < 3; i++) P(c, [[x - w + i * w, y], [x - w + i * w + w * .5, y + w * .9], [x - w + i * w + w, y]], f('#fffaf0'), OUT, .8);}
// Brute: a hunched ogre with a heavy club it slams down.
function brute(c, th, f, t, e) {
  const step = Math.sin(t * 5), raise = e.warn ? Math.min(1, (1 - e.warn.t) / .6) : 0;
  for (const s of [-1, 1]) {limb(c, s * 9, -16, s * 10 + step * s * 3, -2, f(th.body2), 8);E(c, s * 10 + step * s * 3, -2, 6, 3.2, f(OUT), null);}
  E(c, -3, -30, 21, 19, f(th.body));E(c, -6, -38, 11, 6, '#ffffff22', null);
  P(c, [[-18, -40], [-8, -46], [2, -44], [-4, -36]], f(th.body2), OUT, 1);
  for (let i = 0; i < 3; i++) P(c, [[-18 + i * 8, -46], [-14 + i * 8, -56], [-10 + i * 8, -46]], f(th.stone), OUT, 1);
  limb(c, -16, -32, -22, -14, f(th.body), 8);
  E(c, 12, -42, 11, 10, f(th.body));
  for (const s of [-1, 1]) P(c, [[12 + s * 6, -50], [12 + s * 11, -62], [12 + s * 9, -48]], f('#efe6d0'), OUT, 1);
  eyes(c, 14, -44, 2.2, 4, th, f, true);glowDot(c, 15, -44, 8, '#ff3a2a55');
  P(c, [[6, -36], [20, -36], [18, -32], [8, -32]], f('#3a1a1a'), OUT, .8);fangs(c, 13, -36, 3, f);
  c.save();c.translate(14, -30);c.rotate(.6 - raise * 2.2);limb(c, 0, 0, 10, 16, f(th.body), 8);c.translate(10, 18);
  L(c, 0, 0, 0, -32, OUT, 8);L(c, 0, 0, 0, -32, f('#7a5a3a'), 5);E(c, 0, -36, 8, 11, f('#8a6a4a'));for (const k of [-1, 1]) P(c, [[k * 7, -40], [k * 13, -42], [k * 8, -34]], f('#d8d0c0'), OUT, .8);
  c.restore();
}
// Bomber: a walking bomb with a lit fuse; flashes red before it blows.
function bomber(c, th, f, t, e) {
  const arm = !!e.warn, pulse = arm ? 1 + Math.sin(t * 40) * .08 : 1, hop = Math.abs(Math.sin(t * 12)) * 2;
  c.translate(0, -hop);for (const s of [-1, 1]) E(c, s * 6, -1, 4, 2.6, f(th.body2));
  c.save();c.translate(0, -14);c.scale(pulse, pulse);
  E(c, 0, 0, 13, 13, arm && Math.sin(t * 30) > 0 ? '#ff4a3a' : f('#2a2a3a'));E(c, -4, -5, 4, 3, '#ffffff40', null);
  L(c, -12, 2, 12, 2, f(th.accent), 3);
  eyes(c, 3, -2, 2.2, 4, th, f, true);P(c, [[-2, 5], [8, 5], [3, 8]], f('#1a0a0a'), OUT, .8);
  P(c, [[-3, -13], [3, -13], [3, -10], [-3, -10]], f('#8a8a9a'));
  c.beginPath();c.moveTo(0, -13);c.quadraticCurveTo(6, -20, 3, -24);c.strokeStyle = '#6a4a2a';c.lineWidth = 2;c.stroke();
  glowDot(c, 3, -25, 8 + Math.sin(t * 20) * 2, '#ffd27aaa');E(c, 3, -25, 2.2, 2.2, '#fff4c0', null);
  c.restore();
}
// Imp: a tiny winged devil that swarms in packs.
function imp(c, th, f, t, e) {
  const flap = Math.sin(t * 22), hover = Math.sin(t * 6) * 3;
  c.translate(0, -20 + hover);
  for (const s of [-1, 1]) {c.save();c.scale(s, 1);c.rotate(flap * .4);P(c, [[2, -2], [14, -12], [16, -2], [11, 2], [6, 0]], f(th.body2));c.restore();}
  P(c, [[-4, 4], [-12, 10 + flap * 2], [-14, 6]], f(th.body2), OUT, .8);
  for (const s of [-1, 1]) P(c, [[s * 3, -6], [s * 7, -14], [s * 7.5, -4]], f(th.body), OUT, 1);
  E(c, 0, 0, 8.5, 8.2, f(th.body));E(c, -3, -4, 2.6, 1.6, '#ffffff80', null);
  eyes(c, 1.5, -.5, 1.6, 3.2, th, f);blush(c, 1.5, 3, 1.4, 5);
  c.beginPath();c.moveTo(.2, 4.2);c.quadraticCurveTo(1.5, 5.6, 2.8, 4.2);c.strokeStyle = f('#3a1a2a');c.lineWidth = 1;c.lineCap = 'round';c.stroke();
}
// Spitter: a horned hex-caster that fires a three-way spread.
function spitter(c, th, f, t, e) {
  const hover = Math.sin(t * 3) * 2, charge = e.warn ? 1 : 0;
  c.translate(0, hover);
  P(c, [[-13, -1], [13, -1], [9, -30], [-9, -30]], f(th.body2));
  for (let i = 0; i < 3; i++) L(c, -9 + i * 9, -4, -7 + i * 9, -14, f(th.accent), 1.4);
  P(c, [[-12, -28], [12, -28], [8, -44], [-8, -44]], f(th.body));
  for (const s of [-1, 1]) P(c, [[s * 7, -42], [s * 15, -56], [s * 11, -40]], f('#efe6d0'), OUT, 1);
  E(c, 0, -34, 7.5, 6, f('#1a1226'), OUT, 1);for (const s of [-1, 1]) E(c, 1 + s * 3, -34.5, 1.5, 1.8, th.glow, null);glowDot(c, 1, -34, 9, `${th.glow}88`);
  L(c, 14, 2, 18, -46, OUT, 4);L(c, 14, 2, 18, -46, f('#6a4a2a'), 2.2);
  for (let i = 0; i < 3; i++) {const a = t * 4 + i * 2.1, ox = 18 + Math.cos(a) * 9, oy = -50 + Math.sin(a) * 4;glowDot(c, ox, oy, 6 + charge * 4, `${th.glow}aa`);E(c, ox, oy, 2.4 + charge, 2.4 + charge, f(th.glow), OUT, .8);}
}
// Big glossy chibi eyes: dark oval, a tinted iris at the bottom and two highlights.
// `angry` adds a short slanted brow (tough monsters and bosses only).
function eyes(c, x, y, r, gap, th, f, angry = false) {
  const R = r * 1.3, iris = th.eye === '#2b2133' ? '#6a5ad0' : th.eye;
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    E(c, ex, y, R, R * 1.25, f('#221c36'), null);
    E(c, ex + R * .1, y + R * .45, R * .7, R * .6, f(iris), null);
    E(c, ex - R * .3, y - R * .4, R * .42, R * .48, '#ffffff', null);
    E(c, ex + R * .38, y + R * .5, R * .2, R * .2, '#ffffffcc', null);
    if (angry) L(c, ex - R * 1.1, y - R * 1.75 - s * R * .3, ex + R * 1.05, y - R * 1.35 + s * R * .3, f(OUT), Math.max(1.4, R * .42));
  }
}
function blush(c, x, y, rx, gap) {for (const s of [-1, 1]) E(c, x + s * gap, y, rx, rx * .5, '#ff7a9a66', null);}
function slime(c, th, f, t, e) {
  const squish = Math.sin(t * 5) * .08, w = e.r * 1.3 * (1 + squish), h = e.r * 1.75 * (1 - squish);
  // Rounded jelly dome with a soft flat base.
  c.beginPath();c.moveTo(-w, -h * .14);c.bezierCurveTo(-w * 1.1, -h * 1.32, w * 1.1, -h * 1.32, w, -h * .14);
  c.quadraticCurveTo(w * 1.02, 0, w * .7, 0);c.lineTo(-w * .7, 0);c.quadraticCurveTo(-w * 1.02, 0, -w, -h * .12);c.closePath();
  const g = c.createRadialGradient(-w * .3, -h * .75, 1, 0, -h * .4, w * 1.3);g.addColorStop(0, f('#ffffff'));g.addColorStop(.25, f(th.slime[0]));g.addColorStop(1, f(th.slime[1]));
  c.fillStyle = g;c.fill();c.strokeStyle = OUT;c.lineWidth = 1.9;c.stroke();
  // Glossy shine.
  c.beginPath();c.ellipse(-w * .45, -h * .62, w * .2, h * .12, -.6, 0, Math.PI * 2);c.fillStyle = '#ffffffd0';c.fill();
  E(c, -w * .18, -h * .78, w * .06, w * .06, '#ffffffd0', null);
  // Cute face: big eyes, blush and a little "w" mouth.
  const fy = -h * .42;
  eyes(c, w * .08, fy, e.r * .2, w * .34, th, f);blush(c, w * .08, fy + e.r * .42, e.r * .2, w * .58);
  c.beginPath();const mx = w * .08, my = fy + e.r * .4, mw = e.r * .12;c.moveTo(mx - mw * 2, my);c.quadraticCurveTo(mx - mw, my + mw * 1.6, mx, my);c.quadraticCurveTo(mx + mw, my + mw * 1.6, mx + mw * 2, my);
  c.strokeStyle = f('#3a1a2a');c.lineWidth = 1.3;c.lineCap = 'round';c.stroke();
  // Theme topper.
  const top = -h * .98;
  if (th.id === 'forest') {L(c, 0, top, 2, top - 7, '#4f8146', 2);E(c, 6, top - 8, 5, 2.6, f('#80b95b'), OUT, 1);}
  else if (th.id === 'volcano') P(c, [[-4, top + 2], [0, top - 9 - Math.sin(t * 9) * 2], [4, top + 2]], f('#ffd27a'), OUT, 1);
  else if (th.id === 'ice') for (const s of [-1, 0, 1]) P(c, [[s * 6 - 2.5, top + 3], [s * 6, top - 6 + Math.abs(s) * 2], [s * 6 + 2.5, top + 3]], f('#ffffff'), '#6a9ac8', 1);
  else if (th.id === 'temple') {E(c, 0, top - 2, 3.5, 3.5, f('#ffd25a'), OUT, 1);}
  else if (th.id === 'moon') {c.beginPath();c.arc(0, top - 4, 4.5, -2.2, 1.2);c.strokeStyle = f('#e8e4ff');c.lineWidth = 2.2;c.stroke();}
  else slimeTopper(c, th, f, t, top);
}
function runner(c, th, f, t, e) {
  const run = t * 14, bob = Math.abs(Math.sin(run)) * 2;
  c.translate(0, -bob);
  if (th.id === 'moon') { // bat
    const flap = Math.sin(t * 16) * .6;
    for (const s of [-1, 1]) {c.save();c.translate(0, -26);c.scale(s, 1);c.rotate(flap * .5);P(c, [[0, 0], [10, -10], [22, -6], [28, 4], [20, 2], [14, 8], [8, 3]], f(th.body2));c.restore();}
    E(c, 0, -26, 9, 8, f(th.body));for (const s of [-1, 1]) P(c, [[s * 3, -32], [s * 7, -40], [s * 8, -31]], f(th.body));
    eyes(c, 2, -27, 2, 3.8, th, f);blush(c, 2, -23, 1.8, 6);P(c, [[-2, -33], [6, -36], [3, -31]], f(th.accent), OUT, .8);return;
  }
  for (const [lx, ph] of [[-8, 0], [8, Math.PI]]) {const s = Math.sin(run + ph) * 4;limb(c, lx, -12, lx + s, -2, f(th.body2), 3.4);}
  // tail
  const tail = {forest: f('#7fd35a'), volcano: f('#ffb03a'), ice: f('#ffffff'), temple: f(th.body), crystal: f(th.accent)}[th.id] || f(th.body);
  P(c, [[-12, -18], [-24, -26 + Math.sin(t * 8) * 3], [-26, -18], [-14, -13]], tail);
  E(c, 0, -17, 14, 8.5, f(th.body));
  E(c, 3, -14, 8, 4, f('#ffffff40'), null);
  // head + ears
  E(c, 13, -24, 8, 7.5, f(th.body));
  const ear = th.id === 'ice' ? 12 : 7;
  for (const dx of [0, 6]) P(c, [[8 + dx, -29], [9 + dx, -29 - ear], [13 + dx, -30]], f(th.body2));
  E(c, 20, -22, 2, 1.6, OUT, null);
  eyes(c, 15, -26, 1.9, 3.4, th, f);blush(c, 15, -21.5, 1.6, 5);
  if (th.id === 'crystal') for (const s of [-1, 1]) P(c, [[2 + s * 6, -25], [s * 7, -33], [5 + s * 5, -24]], f(th.accent), OUT, 1);
  if (th.id === 'temple') {L(c, 5, -20, 9, -18, '#d23a3a', 3);}
}
function caster(c, th, f, t, e) {
  const hover = Math.sin(t * 3) * 2, charge = e.warn ? 1 : 0;
  c.translate(0, hover);
  P(c, [[-12, -2], [12, -2], [8, -26], [-8, -26]], f(th.body2));
  // Hood / cap.
  if (th.id === 'forest') {E(c, 0, -34, 17, 10, f('#d24a3a'));for (const [x, y] of [[-8, -37], [5, -39], [10, -33]]) E(c, x, y, 2.4, 1.8, '#ffe4be', null);E(c, 0, -26, 9, 7, f('#f1d5b0'));}
  else {P(c, [[-12, -24], [12, -24], [6, -42], [0, -46], [-6, -42]], f(th.body));E(c, 0, -28, 8, 6.5, f(th.id === 'ice' ? '#dff4ff' : '#2b2133'), OUT, 1);}
  eyes(c, 1, -28, 1.9, 3.4, th, f);blush(c, 1, -24, 1.6, 5.5);
  // Orb.
  const ox = 13, oy = -20, r = 4 + charge * 2 + Math.sin(t * 8) * .6;
  limb(c, 6, -16, ox - 2, oy + 2, f(th.body2), 3);
  glowDot(c, ox, oy, r * 3.2, `${th.glow}aa`);E(c, ox, oy, r, r, f(th.glow), OUT, 1);
}
function beast(c, th, f, t, e) {
  const step = Math.sin(t * 6) * 3, angry = !!e.warn;
  c.translate(0, angry ? Math.sin(t * 30) * 1.2 : 0);
  for (const [lx, ph] of [[-20, 0], [-8, Math.PI], [10, Math.PI], [22, 0]]) {const s = Math.sin(t * 6 + ph) * 4;limb(c, lx, -24, lx + s, -3, f(th.body2), 7);E(c, lx + s, -3, 5, 3, f(OUT), null);}
  // body
  E(c, 0, -36, 34, 22, f(th.body));
  E(c, -4, -44, 20, 8, f('#ffffff28'), null);
  // armour plates / crystals / spines along the back
  for (let i = 0; i < 5; i++) {const x = -22 + i * 10, y = -54 + Math.abs(i - 2) * 3;
    if (th.id === 'ice' || th.id === 'crystal') P(c, [[x - 4, y + 6], [x, y - 8], [x + 4, y + 6]], f(i % 2 ? th.accent : th.glow), OUT, 1);
    else P(c, [[x - 6, y + 5], [x - 2, y - 4], [x + 5, y - 3], [x + 6, y + 5]], f(th.stone), OUT, 1);}
  // head
  E(c, 30, -34 + step * .3, 15, 13, f(th.body));
  E(c, 40, -30, 6, 5, f(th.body2), OUT, 1);
  for (const s of [-1, 1]) E(c, 39 + s * 1.6, -31, 1, 1.4, OUT, null);
  eyes(c, 30, -40, 2.6, 5, th, f, true);
  glowDot(c, 30, -40, angry ? 18 : 11, angry ? '#ff3a2a88' : '#ff6a5a55');for (const s of [-1, 1]) E(c, 30 + s * 5 + .6, -39.6, 1.2, 1.4, '#ff3a2a', null);
  fangs(c, 38, -27, 2.2, f);
  // tusks / horns
  P(c, [[36, -26], [46, -20], [40, -25]], f('#fff4dc'), OUT, 1);
  P(c, [[22, -45], [18, -58], [27, -48]], f(th.id === 'temple' ? '#ffd25a' : '#efe6d0'), OUT, 1);
  P(c, [[32, -46], [34, -60], [37, -46]], f(th.id === 'temple' ? '#ffd25a' : '#efe6d0'), OUT, 1);
}
// Each stage's guardian has its own silhouette; `raise` (0..1) lifts the attack during a telegraph.
function titan(c, th, f, t, e) {
  const raise = e.warn ? Math.min(1, (1.1 - e.warn.t) / .6) : 0;
  ({forest: thornQueen, volcano: emberColossus, ice: frostRevenant, temple: goldenYaksha, moon: moonEmperor, crystal: crystalWyrm, desert: sandPharaoh, swamp: toadKing, sky: thunderRoc, deepsea: kraken, candy: cakeQueen, clockwork: gearTitan, haunted: vampireLord, sakura: kitsune, void: starDevourer}[th.id] || emberColossus)(c, th, f, t, raise);
}
// World boss: the rift lord, a four-armed horned demon floating out of a tear in the world.
function riftLord(c, f, t, e) {
  const raise = e.warn ? Math.min(1, (1.1 - e.warn.t) / .6) : 0, hover = Math.sin(t * 1.6) * 6, V = '#b45aff', PINK = '#ff4adf';
  c.scale(1.3, 1.3);
  // The rift behind it.
  c.save();c.translate(0, -190);c.scale(1, 1.45);
  const rg = c.createRadialGradient(0, 0, 10, 0, 0, 120);rg.addColorStop(0, '#05010a');rg.addColorStop(.7, '#2a0a4a');rg.addColorStop(1, '#2a0a4a00');
  c.fillStyle = rg;c.beginPath();c.ellipse(0, 0, 105, 120, 0, 0, Math.PI * 2);c.fill();
  for (let i = 0; i < 3; i++) {c.save();c.rotate(t * (.4 + i * .25) * (i % 2 ? -1 : 1));c.setLineDash([30 - i * 6, 18]);c.strokeStyle = i ? `${V}aa` : PINK;c.lineWidth = 4 - i;c.beginPath();c.ellipse(0, 0, 100 - i * 18, 112 - i * 20, 0, 0, Math.PI * 2);c.stroke();c.restore();}
  c.restore();
  c.translate(0, hover - 20);
  // Smoke tail instead of legs.
  for (let i = 0; i < 5; i++) {const ph = (t * .7 + i / 5) % 1;c.globalAlpha = .55 * (1 - ph);E(c, Math.sin(i * 2.3 + t) * 26, -10 + ph * 16, 34 - ph * 14, 12 - ph * 4, '#2a1a40', null);}c.globalAlpha = 1;
  P(c, [[-46, -40], [46, -40], [30, -6], [10, 4], [-12, -2], [-30, -8]], f('#1e1430'));
  // Lower arms reaching out with chains.
  for (const s of [-1, 1]) {
    const reach = s > 0 ? raise * 18 : 0;limb(c, s * 52, -120, s * (88 + reach), -70, f('#2a1c44'), 18);limb(c, s * (88 + reach), -70, s * (100 + reach), -40, f('#2a1c44'), 14);
    for (let k = -1; k <= 1; k++) P(c, [[s * (98 + reach) + k * 6, -38], [s * (102 + reach) + k * 8, -22], [s * (104 + reach) + k * 6 + s * 3, -36]], f('#efe6ff'), OUT, 1.2);
    for (let k = 0; k < 4; k++) E(c, s * (92 + reach) + Math.sin(t * 3 + k) * 2, -56 + k * 12, 4, 6, null, '#8a8aa8', 2);
  }
  // Torso with runes.
  P(c, [[-60, -150], [60, -150], [52, -90], [40, -40], [-40, -40], [-52, -90]], f('#2a1c44'));
  P(c, [[-60, -150], [-20, -150], [-10, -60], [-40, -40], [-52, -90]], f('#1e1430'), null);
  for (const [a, b, x, y] of [[-30, -136, -14, -104], [-14, -104, -26, -70], [26, -138, 12, -104], [12, -104, 28, -66], [0, -96, 0, -56]]) {L(c, a, b, x, y, V, 5);L(c, a, b, x, y, '#f4dcff', 1.6);}
  glowDot(c, 0, -112, 40, `${PINK}66`);E(c, 0, -112, 13, 13, f('#ff7aff'), OUT, 1.6);E(c, 0, -112, 6, 6, '#ffffff', null);
  for (const s of [-1, 1]) {E(c, s * 60, -146, 28, 20, f('#3a2a5a'));for (let k = 0; k < 3; k++) P(c, [[s * (44 + k * 12), -160], [s * (48 + k * 12), -182 - k * 4], [s * (54 + k * 12), -160]], f('#efe6ff'), OUT, 1.2);}
  // Upper arms raised, holding the dark orb.
  const orb = 22 + raise * 14 + Math.sin(t * 6) * 2;
  for (const s of [-1, 1]) {limb(c, s * 64, -150, s * 70, -210, f('#2a1c44'), 16);limb(c, s * 70, -210, s * 34, -246 - raise * 10, f('#2a1c44'), 13);}
  glowDot(c, 0, -258 - raise * 10, orb * 2.4, `${V}88`);E(c, 0, -258 - raise * 10, orb, orb, '#12061e', V, 3);
  c.save();c.translate(0, -258 - raise * 10);c.rotate(t * 3);for (let k = 0; k < 3; k++) {c.rotate(Math.PI * 2 / 3);c.beginPath();c.arc(0, 0, orb * .7, 0, 1.4);c.strokeStyle = PINK;c.lineWidth = 2.4;c.stroke();}c.restore();
  // Head: horned skull mask, three eyes, fanged jaw.
  c.save();c.translate(0, -176);
  c.save();c.rotate(-t * .5);c.strokeStyle = `${V}cc`;c.lineWidth = 2.5;c.beginPath();c.arc(0, -10, 54, 0, Math.PI * 2);c.stroke();for (let k = 0; k < 10; k++) {c.rotate(Math.PI / 5);P(c, [[50, -4], [60, 0], [50, 4]], V, null);}c.restore();
  for (const s of [-1, 1]) {P(c, [[s * 16, -26], [s * 44, -44], [s * 62, -78], [s * 58, -100], [s * 50, -74], [s * 34, -52], [s * 14, -34]], f('#e8dcc8'), OUT, 2);for (const k of [.3, .55, .8]) L(c, s * (16 + 40 * k), -28 - 50 * k, s * (22 + 40 * k), -34 - 50 * k, '#9a8a78', 2);}
  P(c, [[-30, -30], [30, -30], [34, 0], [22, 22], [-22, 22], [-34, 0]], f('#3a2a5a'));P(c, [[-24, -26], [24, -26], [26, -6], [-26, -6]], f('#1e1430'), null);
  for (const [x, y, r] of [[-13, -14, 5], [13, -14, 5], [0, -24, 4]]) {glowDot(c, x, y, r * 4, '#ff2a5a88');E(c, x, y, r, r * .8, '#ff3a6a', null);E(c, x, y, r * .35, r * .35, '#ffffff', null);}
  P(c, [[-22, 6], [22, 6], [16, 22], [-16, 22]], '#12061e', OUT, 1.4);for (let k = 0; k < 5; k++) P(c, [[-18 + k * 9, 6], [-14 + k * 9, 14], [-10 + k * 9, 6]], '#fffaf0', OUT, .8);
  c.restore();
  for (let i = 0; i < 8; i++) {const ph = (t * .5 + i / 8) % 1;c.globalAlpha = 1 - ph;glowDot(c, Math.sin(i * 1.9 + t) * 80, -60 - ph * 220, 5, i % 2 ? `${V}cc` : `${PINK}cc`);}c.globalAlpha = 1;
}
function crownSpikes(c, f, y, w, h, col, gem) {
  P(c, [[-w, y], [-w - 2, y - h], [-w * .5, y - h * .5], [0, y - h * 1.3], [w * .5, y - h * .5], [w + 2, y - h], [w, y]], f(col), OUT, 1.4);
  if (gem) E(c, 0, y - h * .45, 3.4, 3.4, f(gem), OUT, 1);
}
// Forest: a tall dryad queen in a flared vine gown with leafy hair and thorn whips.
function thornQueen(c, th, f, t, raise) {
  const sway = Math.sin(t * 1.6) * 3;
  P(c, [[-12, -100], [12, -100], [46 + sway, -4], [24, 0], [0, -6], [-24, 0], [-46 + sway, -4]], f('#3f7a4a'));
  for (let i = -2; i <= 2; i++) P(c, [[i * 14, -40], [i * 18 + sway - 8, -2], [i * 18 + sway + 8, -2]], f(i % 2 ? '#5a9e5a' : '#4a8a52'), OUT, 1);
  for (let i = 0; i < 6; i++) E(c, -30 + i * 12 + sway * .5, -12 - (i % 2) * 6, 4, 3, f('#d24a5a'), OUT, .8);
  P(c, [[-14, -150], [14, -150], [11, -100], [-11, -100]], f('#6aae5a'));
  P(c, [[-6, -146], [6, -146], [3, -104], [-3, -104]], f('#d24a5a'), OUT, 1);
  // leafy hair flowing behind the head
  for (const s of [-1, 1]) P(c, [[s * 10, -186], [s * 30, -170 + sway], [s * 34, -130 + sway], [s * 18, -144], [s * 12, -160]], f('#4a8a52'));
  E(c, 0, -168, 15, 17, f('#cfe8b0'));
  eyes(c, 2, -168, 3, 6, th, f, true);
  crownSpikes(c, f, -182, 13, 12, '#d24a5a', '#ffd25a');
  // whip arms
  for (const s of [-1, 1]) {
    const lift = s > 0 ? raise : 0;
    c.save();c.translate(s * 13, -146);c.rotate(s * (.5 - lift * 1.4));limb(c, 0, 0, 0, 34, f('#6aae5a'), 6);
    c.beginPath();c.moveTo(0, 34);for (let i = 1; i <= 7; i++) c.lineTo(Math.sin(i * 1.3 + t * 5) * 8 * s, 34 + i * 10);
    c.strokeStyle = OUT;c.lineWidth = 5;c.stroke();c.strokeStyle = f('#5a9a3a');c.lineWidth = 3;c.stroke();c.restore();
  }
}
// Volcano: a hulking forge golem, tiny head sunk between huge shoulders, magma cracks, giant hammer.
function emberColossus(c, th, f, t, raise) {
  const sway = Math.sin(t * 1.4) * 2;
  for (const s of [-1, 1]) {limb(c, s * 22, -60, s * 28, -10, f('#3a2a2a'), 22);E(c, s * 30, -6, 18, 8, f('#2a1e1e'));}
  P(c, [[-58, -150], [58, -150], [50, -70], [30, -50], [-30, -50], [-50, -70]], f('#4a3838'));
  for (const [x0, y0, x1, y1] of [[-30, -130, -12, -96], [-12, -96, -22, -66], [20, -140, 30, -104], [30, -104, 14, -78]]) {L(c, x0, y0, x1, y1, '#ff8a3a', 4);L(c, x0, y0, x1, y1, '#ffe08a', 1.6);}
  glowDot(c, 0, -104, 34, `${th.glow}77`);E(c, 0, -104, 12, 12, f('#ffb03a'), OUT, 1.6);
  for (const s of [-1, 1]) E(c, s * 54, -144, 26, 18, f('#5a4644'));
  E(c, 0, -158, 18, 14, f('#4a3838'));
  for (const s of [-1, 1]) E(c, s * 7, -160, 4, 2.6, f('#ffd27a'), null);
  glowDot(c, 0, -160, 24, '#ff8a3a66');
  P(c, [[-12, -172], [-6, -182], [0, -174], [6, -184], [12, -172]], f('#ff8a3a'), OUT, 1);
  limb(c, -60, -140, -70 - sway, -80, f('#4a3838'), 20);E(c, -70 - sway, -74, 14, 12, f('#5a4644'));
  c.save();c.translate(60, -140);c.rotate(-.2 - raise * 2.2);limb(c, 0, 0, 8, 60, f('#4a3838'), 20);E(c, 8, 64, 14, 12, f('#5a4644'));
  c.translate(8, 64);L(c, 0, -10, 0, 70, OUT, 10);L(c, 0, -10, 0, 70, f('#7a5a3a'), 6);
  P(c, [[-30, 62], [30, 62], [30, 96], [-30, 96]], f('#5a5a6a'));L(c, -28, 79, 28, 79, f('#ff8a3a'), 3);glowDot(c, 0, 79, 34, '#ff8a3a55');
  c.restore();
}
// Ice: a floating ghost knight — no legs, a wisp tail, horned helm with a glowing visor slit.
function frostRevenant(c, th, f, t, raise) {
  const hover = Math.sin(t * 2) * 6;
  c.translate(0, -18 + hover);
  c.globalAlpha *= .9;
  P(c, [[-34, -130], [34, -130], [26, -60], [10 + Math.sin(t * 4) * 8, -10], [0, 0], [-8 + Math.sin(t * 4 + 1) * 8, -14], [-26, -60]], f('#cfe8f8'), '#5f8ab3', 1.6);
  for (let i = 0; i < 4; i++) P(c, [[-30 + i * 18, -70], [-26 + i * 18 + Math.sin(t * 3 + i) * 4, -36], [-20 + i * 18, -70]], f('#e8f6ff'), '#86a6c6', 1);
  c.globalAlpha /= .9;
  P(c, [[-30, -150], [30, -150], [24, -96], [-24, -96]], f('#8fb4d8'));
  P(c, [[-18, -144], [18, -144], [12, -104], [0, -98], [-12, -104]], f('#dff4ff'), '#5f8ab3', 1.2);
  for (const s of [-1, 1]) {E(c, s * 34, -146, 16, 11, f('#b3cce2'));P(c, [[s * 26, -154], [s * 40, -172], [s * 46, -150]], f('#ffffff'), '#5f8ab3', 1);}
  E(c, 0, -170, 18, 19, f('#b3cce2'));
  P(c, [[-12, -172], [12, -172], [10, -167], [-10, -167]], f('#1a2a4a'), null);
  glowDot(c, 0, -170, 22, '#7fd8ff99');L(c, -9, -169.5, 9, -169.5, '#d6f6ff', 2.4);
  for (const s of [-1, 1]) P(c, [[s * 12, -182], [s * 26, -206], [s * 18, -180]], f('#ffffff'), '#5f8ab3', 1.2);
  limb(c, -34, -140, -40, -98, f('#8fb4d8'), 11);
  c.save();c.translate(34, -140);c.rotate(-.25 - raise * 1.8);limb(c, 0, 0, 6, 40, f('#8fb4d8'), 11);c.translate(6, 44);
  P(c, [[-5, -8], [5, -8], [4, 90], [0, 102], [-4, 90]], f('#dff6ff'), '#3a6a9a', 1.6);L(c, -14, -6, 14, -6, f('#8fb4d8'), 6);glowDot(c, 0, 50, 26, '#bfeaff66');
  c.restore();
}
// Temple: a stout Thai yaksha giant — big belly, tiered pointed crown, tusks and a heavy club.
function goldenYaksha(c, th, f, t, raise) {
  const sway = Math.sin(t * 1.5) * 2;
  for (const s of [-1, 1]) {limb(c, s * 20, -56, s * 30, -10, f('#3f8a5a'), 18);E(c, s * 32, -6, 14, 7, f('#d49440'));}
  P(c, [[-30, -60], [30, -60], [36, -36], [-36, -36]], f('#d23a3a'));
  E(c, 0, -92, 46, 42, f('#4fa86a'));
  P(c, [[-36, -126], [36, -126], [24, -92], [0, -84], [-24, -92]], f('#ffd25a'), OUT, 1.4);
  for (const s of [-1, 0, 1]) E(c, s * 14, -108, 4, 4, f('#d23a3a'), OUT, 1);
  for (const s of [-1, 1]) {E(c, s * 42, -126, 18, 13, f('#ffd25a'));P(c, [[s * 34, -136], [s * 50, -150], [s * 56, -128]], f('#ffd25a'), OUT, 1);}
  E(c, 0, -148, 22, 20, f('#4fa86a'));
  eyes(c, 2, -152, 4.6, 9, th, f, true);
  P(c, [[-12, -138], [12, -138], [10, -134], [-10, -134]], f('#8a1a1a'), null);
  for (const s of [-1, 1]) P(c, [[s * 8, -138], [s * 11, -128], [s * 13, -138]], f('#fff4dc'), OUT, 1);
  // Thai chada crown: stacked tiers to a tall spire.
  for (let i = 0; i < 4; i++) P(c, [[-18 + i * 4, -164 - i * 12], [18 - i * 4, -164 - i * 12], [14 - i * 4, -176 - i * 12], [-14 + i * 4, -176 - i * 12]], f(i % 2 ? '#e8b83a' : '#ffd25a'), OUT, 1.2);
  P(c, [[-4, -212], [4, -212], [0, -234]], f('#ffd25a'), OUT, 1.2);
  limb(c, -44, -120, -54 - sway, -74, f('#4fa86a'), 15);
  c.save();c.translate(44, -120);c.rotate(-.2 - raise * 2);limb(c, 0, 0, 8, 46, f('#4fa86a'), 15);c.translate(8, 50);
  L(c, 0, -6, 0, 40, OUT, 9);L(c, 0, -6, 0, 40, f('#7a4a1a'), 5.5);E(c, 0, 60, 15, 24, f('#d49440'));for (const y of [48, 62, 76]) L(c, -13, y, 13, y, f('#ffd25a'), 2.4);
  c.restore();
}
// Moon: a tall robed sorcerer-king floating before a dark moon, with a crescent staff.
function moonEmperor(c, th, f, t, raise) {
  const hover = Math.sin(t * 1.8) * 4;
  c.save();c.translate(0, -150);glowDot(c, 0, 0, 90, '#b48aff44');E(c, 0, 0, 52, 52, f('#1e1a38'), '#5e5a86', 3);c.beginPath();c.arc(14, -8, 44, 0, Math.PI * 2);c.fillStyle = f('#2e2a48');c.fill();c.restore();
  c.translate(0, hover);
  P(c, [[-20, -150], [20, -150], [40, -4], [-40, -4]], f('#2a2448'));
  P(c, [[-8, -150], [8, -150], [14, -4], [-14, -4]], f('#d8dcff'), OUT, 1);
  for (let i = 0; i < 4; i++) {const y = -124 + i * 28;P(c, [[0, y - 5], [1.6, y - 1.6], [5, y], [1.6, y + 1.6], [0, y + 5], [-1.6, y + 1.6], [-5, y], [-1.6, y - 1.6]], f('#8a7ad8'), null);}
  P(c, [[-28, -156], [28, -156], [20, -138], [-20, -138]], f('#4a3f7a'));
  for (const s of [-1, 1]) P(c, [[s * 14, -160], [s * 34, -186], [s * 30, -152]], f('#4a3f7a'), OUT, 1.2);
  E(c, 0, -170, 14, 15, f('#d8d4f0'));
  eyes(c, 1, -170, 2.8, 5.5, th, f, true);
  c.beginPath();c.arc(0, -190, 13, Math.PI * 1.1, Math.PI * 1.9);c.strokeStyle = OUT;c.lineWidth = 7;c.stroke();c.strokeStyle = f('#e8e4ff');c.lineWidth = 4;c.stroke();
  P(c, [[-6, -186], [0, -206], [6, -186]], f('#e8e4ff'), OUT, 1);
  limb(c, -18, -146, -32, -104, f('#2a2448'), 9);
  c.save();c.translate(18, -146);c.rotate(-.15 - raise * 1.2);limb(c, 0, 0, 14, 40, f('#2a2448'), 9);c.translate(14, 44);
  L(c, 0, -70, 0, 60, OUT, 7);L(c, 0, -70, 0, 60, f('#d8dcff'), 4);c.beginPath();c.arc(0, -78, 14, .6, 5.6);c.strokeStyle = f('#e8e4ff');c.lineWidth = 4;c.stroke();glowDot(c, 0, -78, 30 + raise * 20, '#c8c0ff77');
  c.restore();
  for (let i = 0; i < 3; i++) {const a = t * 1.5 + i * 2.1;glowDot(c, Math.cos(a) * 50, -120 + Math.sin(a) * 20, 10, '#b48affaa');}
}
// Crystal: a coiled serpent dragon of teal scales and crystal spines, head raised to strike.
function crystalWyrm(c, th, f, t, raise) {
  const segs = 9, pts = [];
  for (let i = 0; i < segs; i++) {const u = i / (segs - 1), a = u * Math.PI * 1.6 + Math.sin(t * 2) * .15;pts.push([Math.cos(a) * 46 * (1 - u * .5) - 10, -16 - u * 110 - Math.sin(a) * 14]);}
  for (let i = 0; i < segs; i++) {const [x, y] = pts[i], r = 24 - i * 1.6;E(c, x, y, r, r * .8, f(i % 2 ? th.body : '#2f8088'));
    if (i % 2 === 0) P(c, [[x - 5, y - r * .6], [x, y - r * .6 - 16], [x + 5, y - r * .6]], f(i % 4 ? th.accent : '#7ff0e0'), OUT, 1);}
  const [hx, hy] = pts[segs - 1], lift = raise * 18;
  c.save();c.translate(hx + 8, hy - 14 - lift);c.rotate(-.1 - raise * .3);
  E(c, 0, 0, 26, 18, f(th.body));P(c, [[14, -4], [42, 4], [40, 14], [14, 12]], f(th.body));
  P(c, [[22, 10], [40, 14], [26, 22]], f('#1a4a52'), OUT, 1);
  for (let i = 0; i < 3; i++) P(c, [[26 + i * 5, 12], [28 + i * 5, 18], [30 + i * 5, 12]], f('#ffffff'), null);
  eyes(c, 8, -4, 4, 6, th, f, true);glowDot(c, 8, -4, 20, '#ff8ad866');
  for (const [x, h] of [[-12, 30], [0, 24], [-22, 22]]) P(c, [[x - 4, -12], [x - 8, -12 - h], [x + 4, -12]], f(x ? '#7ff0e0' : th.accent), OUT, 1.2);
  c.restore();
}
// ---------------------------------------------------------------- arenas
function inside(x, y) {
  let hit = false;
  for (let i = 0, j = ARENA_POLYGON.length - 1; i < ARENA_POLYGON.length; j = i++) {
    const a = ARENA_POLYGON[i], b = ARENA_POLYGON[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
function edgeDistance(x, y) {
  let best = Infinity;
  for (let i = 0; i < ARENA_POLYGON.length; i++) {
    const a = ARENA_POLYGON[i], b = ARENA_POLYGON[(i + 1) % ARENA_POLYGON.length], dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l));best = Math.min(best, Math.hypot(x - a.x - u * dx, y - a.y - u * dy));
  }
  return best;
}
function seeded(seed) {let s = seed >>> 0;return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);}
// One prop per theme, drawn at (x, y) = its base, sized by s.
function prop(c, th, x, y, s, rng) {
  c.save();c.translate(x, y);c.scale(s, s);
  E(c, 0, 4, 34, 10, '#00000030', null);
  const id = th.id, v = rng();
  if (id === 'forest') {
    if (v < .7) {P(c, [[-7, 4], [-5, -50], [5, -50], [8, 4]], '#7a5a36');for (const [cx, cy, r, col] of [[-22, -62, 26, '#3f7a4a'], [20, -66, 28, '#4a8a52'], [0, -88, 30, '#5a9e5a'], [-8, -96, 16, '#7fbf6a']]) E(c, cx, cy, r, r * .85, col);}
    else {E(c, 0, -10, 26, 18, '#9aa596');E(c, -6, -18, 14, 6, '#c4cbbf', null);E(c, 4, -24, 12, 5, '#7fae5e', null);}
  } else if (id === 'volcano') {
    P(c, [[-30, 4], [-24, -30], [-6, -52], [12, -40], [28, -14], [30, 4]], '#2e2426');P(c, [[-24, -30], [-6, -52], [-2, -30]], '#4a3a3a', null);
    if (v < .5) {L(c, -10, -6, 0, -28, '#ff8a3a', 3);L(c, 0, -28, 8, -18, '#ff8a3a', 2.4);glowDot(c, -2, -20, 20, '#ff8a3a40');}
  } else if (id === 'ice') {
    if (v < .55) {P(c, [[-4, 4], [-3, -14], [3, -14], [4, 4]], '#7a5a40');for (let i = 0; i < 3; i++) P(c, [[-24 + i * 4, -10 - i * 22], [0, -46 - i * 22], [24 - i * 4, -10 - i * 22]], i % 2 ? '#f4fbff' : '#4f8a7a', '#2b4a5a');}
    else for (const [dx, h, w] of [[-12, 40, 9], [4, 58, 11], [16, 32, 8]]) P(c, [[dx - w, 4], [dx - w * .6, -h * .7], [dx, -h], [dx + w * .6, -h * .7], [dx + w, 4]], '#cfefff', '#5f8ab3');
  } else if (id === 'temple') {
    if (v < .6) {P(c, [[-12, 4], [-10, -80], [10, -80], [12, 4]], '#e8c47a');P(c, [[-16, -80], [16, -80], [12, -90], [-12, -90]], '#d49440');P(c, [[-15, 4], [15, 4], [15, -6], [-15, -6]], '#c99c55');L(c, -4, -10, -4, -74, '#c99c5580', 3);}
    else {E(c, 0, -2, 26, 9, '#3f8aa0');for (const a of [-1, 0, 1]) P(c, [[a * 10 - 5, -2], [a * 10, -16], [a * 10 + 5, -2]], '#ff9ab8', '#a84a6a', 1);}
  } else if (id === 'moon') {
    if (v < .55) {P(c, [[-11, 4], [-10, -90], [10, -90], [11, 4]], '#3a3660');P(c, [[-15, -90], [15, -90], [13, -98], [-13, -98]], '#5e5a86');c.beginPath();c.arc(0, -60, 6, .6, 5.6);c.strokeStyle = '#d8dcff';c.lineWidth = 2;c.stroke();}
    else {L(c, 0, 4, 0, -40, '#b8b4d0', 5);for (const a of [-.9, -.3, .4, 1]) L(c, 0, -30, Math.sin(a) * 26, -30 - Math.cos(a) * 26, '#b8b4d0', 2.4);}
  } else if (NEW_PROPS[id]) NEW_PROPS[id](c, v);
  else {
    const cols = ['#7ff0e0', '#ff8ad8', '#b48aff'], col = cols[Math.floor(v * 3)];
    for (const [dx, h, w] of [[-14, 34, 8], [0, 56, 11], [14, 40, 9]]) P(c, [[dx - w, 4], [dx - w * .7, -h * .75], [dx, -h], [dx + w * .7, -h * .75], [dx + w, 4]], col, '#14323a');
    glowDot(c, 0, -26, 40, `${col}40`);
  }
  c.restore();
}
// Per-theme ground palette and the cluster each theme scatters across the clearing.
const GROUND_LOOK = {
  forest: {path: '#d8c79a', pathEdge: '#b49f6e', pebble: '#eadfbf', tile: '#e6dab4', tuft: '#5f9a48', tuft2: '#8cc866'},
  volcano: {path: '#3a2c2c', pathEdge: '#22191a', pebble: '#5a4644', tile: '#4a3a38', tuft: '#ff7a2a', tuft2: '#7a5a50'},
  ice: {path: '#ffffff', pathEdge: '#bcd4ea', pebble: '#dbeaf6', tile: '#f4faff', tuft: '#a8c8e4', tuft2: '#e0f0ff'},
  temple: {path: '#c99c55', pathEdge: '#9a6a2a', pebble: '#e8c47a', tile: '#e8c47a', tuft: '#9ab84a', tuft2: '#c4d870'},
  moon: {path: '#5e5a86', pathEdge: '#2a2648', pebble: '#7a76a8', tile: '#6e6a98', tuft: '#8a7ad8', tuft2: '#b4a8ff'},
  crystal: {path: '#467882', pathEdge: '#1e3e48', pebble: '#5a909a', tile: '#5a909a', tuft: '#2aa8a0', tuft2: '#7ff0e0'},
  desert: {path: '#e8c47a', pathEdge: '#b88a4a', pebble: '#f8e4b8', tile: '#f4d8a0', tuft: '#a8a04a', tuft2: '#d8c070'},
  swamp: {path: '#8a7a5a', pathEdge: '#5a4a3a', pebble: '#a89a7a', tile: '#9a8a6a', tuft: '#3a7a3a', tuft2: '#7ab84a'},
  sky: {path: '#ffffff', pathEdge: '#b4d0ec', pebble: '#e8f4ff', tile: '#f4faff', tuft: '#ffe27a', tuft2: '#ffffff'},
  deepsea: {path: '#e8d8a8', pathEdge: '#a8986a', pebble: '#fff4d0', tile: '#d8c898', tuft: '#3ab86a', tuft2: '#7ae8a0'},
  candy: {path: '#ffffff', pathEdge: '#ff8ac8', pebble: '#ffe4f0', tile: '#fff4fa', tuft: '#7ad0ff', tuft2: '#ffe27a'},
  clockwork: {path: '#7a7068', pathEdge: '#4a4038', pebble: '#9a9088', tile: '#8a8078', tuft: '#c88a3a', tuft2: '#e8c47a'},
  haunted: {path: '#5e566e', pathEdge: '#2a2436', pebble: '#7a7290', tile: '#6a6280', tuft: '#4a6a4a', tuft2: '#7a9a6a'},
  sakura: {path: '#e8d0c0', pathEdge: '#b8907a', pebble: '#f8ece4', tile: '#f0dcd0', tuft: '#7ab85a', tuft2: '#ffb4d0'},
  void: {path: '#3a2e6a', pathEdge: '#140a30', pebble: '#5a4a90', tile: '#4a3a80', tuft: '#8a7aff', tuft2: '#ff8ad8'}
};
function groundCluster(c, th, look, x, y, rng) {
  const id = th.id;
  if (NEW_CLUSTERS[id]) return NEW_CLUSTERS[id](c, th, look, x, y, rng);
  if (id === 'forest') {
    if (rng() < .5) {for (let i = 0; i < 9; i++) {const a = rng() * 6.3, d = rng() * 40, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * .6, col = ['#fff4c4', '#ff9ab8', '#c9a8ff', '#ffd25a'][i % 4];L(c, fx, fy + 6, fx, fy, '#4f8a3e', 2);E(c, fx, fy, 4.5, 4, col, '#00000030', 1);E(c, fx, fy, 1.6, 1.6, '#ffe08a', null);}}
    else {E(c, x, y + 8, 46, 14, '#00000022', null);for (const [dx, dy, r, col] of [[-18, 0, 20, '#4a8a52'], [16, -2, 22, '#5a9e5a'], [0, -14, 22, '#6fb062'], [-6, -20, 10, '#8fcf76']]) E(c, x + dx, y + dy, r, r * .8, col, '#2f5a3680', 1.6);if (rng() < .5) for (const [dx, dy] of [[-10, -8], [12, -12], [2, -24]]) E(c, x + dx, y + dy, 3, 3, '#ff5a6a', null);}
  } else if (id === 'volcano') {
    c.save();c.shadowColor = '#ff6a1a';c.shadowBlur = 14;let px = x, py = y;for (let i = 0; i < 5; i++) {const nx = px + (rng() - .5) * 70, ny = py + (rng() - .3) * 40;L(c, px, py, nx, ny, '#ff8a3a', 3.4 - i * .4);L(c, px, py, nx, ny, '#ffe08a', 1.2);px = nx;py = ny;}c.restore();
    if (rng() < .5) {E(c, x + 30, y + 14, 16, 8, '#2a1e1e', '#1a1010', 1.6);E(c, x + 30, y + 13, 10, 5, '#ff7a2a', null);}
  } else if (id === 'ice') {
    if (rng() < .5) {E(c, x, y, 70, 30, '#cfeaff', '#9cc0de', 2);E(c, x - 14, y - 6, 40, 12, '#ffffffaa', null);L(c, x - 30, y + 4, x + 10, y - 6, '#ffffffcc', 2);}
    else for (const [dx, dy, r] of [[-20, 0, 26], [14, 4, 32], [0, -10, 20]]) {E(c, x + dx, y + dy, r, r * .45, '#ffffff', '#c4d8ea', 1.6);}
  } else if (id === 'temple') {
    if (rng() < .5) {for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (rng() < .75) P(c, [[x + i * 34 - 15, y + j * 20 - 9], [x + i * 34 + 15, y + j * 20 - 9], [x + i * 34 + 15, y + j * 20 + 9], [x + i * 34 - 15, y + j * 20 + 9]], look.tile, look.pathEdge, 1.4);}
    else {E(c, x, y + 4, 22, 9, '#00000026', null);P(c, [[x - 14, y + 4], [x - 12, y - 12], [x + 12, y - 12], [x + 14, y + 4]], '#cfa45e', '#7a4a1a', 1.6);E(c, x, y - 12, 13, 5, '#3f8aa0', '#7a4a1a', 1.4);for (const a of [-1, 0, 1]) E(c, x + a * 6, y - 16, 3, 4, '#ff9ab8', null);}
  } else if (id === 'moon') {
    const r = 22 + rng() * 34;E(c, x, y, r, r * .55, look.pathEdge, null);E(c, x + 2, y + 2, r * .82, r * .42, th.ground2, null);E(c, x - r * .3, y - r * .18, r * .3, r * .1, '#ffffff18', null);
    if (rng() < .4) for (let i = 0; i < 3; i++) glowDot(c, x + (rng() - .5) * r, y + (rng() - .5) * r * .4, 6, '#d6d0ff70');
  } else {
    const col = ['#7ff0e0', '#ff8ad8', '#b48aff'][Math.floor(rng() * 3)];glowDot(c, x, y - 10, 46, `${col}38`);
    for (const [dx, h, w] of [[-14, 22, 6], [0, 36, 8], [12, 26, 6], [-4, 16, 5]]) P(c, [[x + dx - w, y + 2], [x + dx - w * .6, y - h * .7], [x + dx, y - h], [x + dx + w * .6, y - h * .7], [x + dx + w, y + 2]], col, '#14323a', 1.4);
  }
}
// The arena is painted once per theme into a cache covering 1.3 arena widths (the camera never
// shows past the map square); the live layer adds the portal glow and drifting particles.
// SCALE/AREA keep decoration density and landmark positions from the original 2200 map.
const EXTENT = ARENA_SIZE * 1.3, arenaCache = new Map(), SCALE = ARENA_SIZE / 2200, AREA = SCALE * SCALE;
function paintArena(th, pixels) {
  const canvas = document.createElement('canvas');canvas.width = canvas.height = pixels;
  const c = canvas.getContext('2d'), k = pixels / EXTENT, rng = seeded(th.id.length * 7919 + 17);
  c.scale(k, k);c.translate(EXTENT / 2, EXTENT / 2);
  c.fillStyle = th.edge;c.fillRect(-EXTENT / 2, -EXTENT / 2, EXTENT, EXTENT);
  for (let i = 0; i < 260 * AREA; i++) {const x = (rng() - .5) * EXTENT, y = (rng() - .5) * EXTENT;E(c, x, y, 60 + rng() * 120, 30 + rng() * 50, th.edge2, null);}
  // Ground inside the walkable polygon: soft light pooling toward the centre, winding paths,
  // a paved plaza at the spawn point and themed clusters instead of scattered blots.
  const clip = () => {c.beginPath();ARENA_POLYGON.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));c.closePath();};
  clip();c.save();c.fillStyle = th.ground;c.fill();c.clip();
  const lightG = c.createRadialGradient(0, 0, 0, 0, 0, ARENA_HALF);lightG.addColorStop(0, '#ffffff22');lightG.addColorStop(.6, '#ffffff08');lightG.addColorStop(1, '#00000000');c.fillStyle = lightG;c.fillRect(-ARENA_HALF, -ARENA_HALF, ARENA_SIZE, ARENA_SIZE);
  // Low-contrast mottling in two tones, small enough to read as texture.
  for (let i = 0; i < 900 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE, r = 14 + rng() * 34;c.globalAlpha = .35 + rng() * .3;E(c, x, y, r, r * .5, rng() < .5 ? th.ground2 : th.ground, null);}
  c.globalAlpha = 1;
  const look = GROUND_LOOK[th.id];
  // Winding paths from the plaza toward the portal and out to the sides.
  const paths = [[[0, 0], [-80, -260], [40, -470], [-60, -720]], [[0, 0], [300, 120], [620, 60], [980, 220]], [[0, 0], [-320, 160], [-640, 380], [-900, 300]], [[0, 0], [120, 380], [-60, 680], [80, 980]]]
    .map(pts => pts.map(([x, y]) => [x * SCALE, y * SCALE]));
  const stroke = (pts, width, color) => {c.beginPath();c.moveTo(pts[0][0], pts[0][1]);for (let i = 1; i < pts.length - 1; i++) {const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);}const last = pts[pts.length - 1];c.lineTo(last[0], last[1]);c.strokeStyle = color;c.lineWidth = width;c.lineCap = 'round';c.lineJoin = 'round';c.stroke();};
  for (const pts of paths) stroke(pts, 118, look.pathEdge);
  for (const pts of paths) stroke(pts, 96, look.path);
  for (const pts of paths) for (let k = 0; k < 40 * SCALE; k++) {const seg = Math.floor(rng() * (pts.length - 1)), u = rng(), x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * u + (rng() - .5) * 70, y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * u + (rng() - .5) * 70, r = 5 + rng() * 9;E(c, x, y, r, r * .6, look.pebble, look.pathEdge, 1.2);}
  // Paved plaza with a rune ring where the hero starts.
  E(c, 0, 0, 240, 150, look.pathEdge, null);E(c, 0, 0, 226, 140, look.path, null);
  for (let ring = 0; ring < 3; ring++) {const rr = 70 + ring * 52, n = 10 + ring * 6;for (let i = 0; i < n; i++) {const a = (i + (ring % 2) * .5) / n * Math.PI * 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr * .62;E(c, x, y, 20 - ring * 2, 11 - ring, look.tile, look.pathEdge, 1.4);}}
  c.beginPath();c.ellipse(0, 0, 54, 33, 0, 0, Math.PI * 2);c.strokeStyle = th.portal;c.globalAlpha = .55;c.lineWidth = 4;c.stroke();c.beginPath();c.ellipse(0, 0, 40, 24, 0, 0, Math.PI * 2);c.lineWidth = 2;c.stroke();c.globalAlpha = 1;
  // Themed clusters away from the plaza.
  const spot = () => {for (let k = 0; k < 20; k++) {const x = (rng() - .5) * ARENA_SIZE * .95, y = (rng() - .5) * ARENA_SIZE * .95;if (inside(x, y) && Math.hypot(x, y * 1.6) > 300 && edgeDistance(x, y) > 60) return [x, y];}return null;};
  for (let i = 0; i < 34 * AREA; i++) {const at = spot();if (at) groundCluster(c, th, look, at[0], at[1], rng);}
  // Grass/ground tufts in two tones.
  for (let i = 0; i < 520 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE;if (Math.hypot(x, y * 1.6) < 250) continue;L(c, x - 3, y, x - 5, y - 9, look.tuft, 2.2);L(c, x, y, x, y - 12, look.tuft2, 2.4);L(c, x + 3, y, x + 6, y - 8, look.tuft, 2.2);}
  // Inner shade along the boundary so the clearing reads as a bowl.
  clip();c.strokeStyle = '#00000026';c.lineWidth = 220;c.stroke();c.strokeStyle = '#0000001c';c.lineWidth = 110;c.stroke();
  c.restore();
  // Stone rim along the boundary.
  c.beginPath();ARENA_POLYGON.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));c.closePath();
  c.strokeStyle = th.rim;c.lineWidth = 34;c.lineJoin = 'round';c.stroke();c.strokeStyle = th.stone;c.lineWidth = 20;c.stroke();
  // Props outside the play area, back to front.
  const props = [];
  for (let i = 0; i < 900 * AREA && props.length < 340 * AREA; i++) {const x = (rng() - .5) * EXTENT, y = (rng() - .5) * EXTENT;if (inside(x, y) || edgeDistance(x, y) < 40) continue;props.push({x, y, s: .9 + rng() * .9});}
  // A dense hedge of props hugging the boundary so the clearing reads as enclosed.
  for (let i = 0; i < ARENA_POLYGON.length; i++) {
    const a = ARENA_POLYGON[i], b = ARENA_POLYGON[(i + 1) % ARENA_POLYGON.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += 75) {
      const u = d / len, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u, m = Math.hypot(x, y) || 1, out = 55 + rng() * 70;
      const px = x + x / m * out, py = y + y / m * out;if (!inside(px, py)) props.push({x: px, y: py, s: .75 + rng() * .6});
    }
  }
  props.sort((a, b) => a.y - b.y);
  for (const p of props) prop(c, th, p.x, p.y, p.s, rng);
  // Portal gate at the top of the clearing.
  const gx = -60, gy = -720 * SCALE;
  P(c, [[gx - 70, gy + 20], [gx - 66, gy - 110], [gx - 40, gy - 150], [gx + 40, gy - 150], [gx + 66, gy - 110], [gx + 70, gy + 20], [gx + 46, gy + 20], [gx + 44, gy - 100], [gx, gy - 124], [gx - 44, gy - 100], [gx - 46, gy + 20]], th.stone, th.rim, 4);
  return canvas;
}
export function drawToonArena(c, time, stage = 1) {
  const th = themeFor(stage), transform = c.getTransform();
  const pixels = Math.max(512, Math.min(4096, Math.round(EXTENT * Math.abs(transform.a) / 128) * 128)), key = `${th.id}-${pixels}`;
  let canvas = arenaCache.get(key);
  if (!canvas) {for (const k of arenaCache.keys()) if (k.startsWith(`${th.id}-`)) arenaCache.delete(k);canvas = paintArena(th, pixels);arenaCache.set(key, canvas);}
  c.fillStyle = th.edge;c.fillRect(-ARENA_HALF * 3, -ARENA_HALF * 3, ARENA_SIZE * 3, ARENA_SIZE * 3);
  c.save();c.imageSmoothingEnabled = true;c.drawImage(canvas, -EXTENT / 2, -EXTENT / 2, EXTENT, EXTENT);c.restore();
  // Portal swirl and theme particles.
  const gx = -60, gy = -720 * SCALE;
  c.save();c.globalAlpha = .85;glowDot(c, gx, gy - 50, 70, `${th.portal}88`);
  for (let i = 0; i < 3; i++) {c.beginPath();c.ellipse(gx, gy - 50, 34 - i * 9, 52 - i * 13, 0, time * (1 + i * .5), time * (1 + i * .5) + 4.4);c.strokeStyle = i === 2 ? '#ffffff' : th.portal;c.lineWidth = 4 - i;c.stroke();}
  c.restore();
  const n = Math.round(26 * AREA);
  for (let i = 0; i < n; i++) {
    const x = Math.sin(i * 7.13) * 760 * SCALE + Math.sin(time * .4 + i) * 30;
    let y = Math.cos(i * 3.71) * 700 * SCALE;
    if (th.id === 'ice') y = ((i * 97 + time * 40) % (1500 * SCALE)) - 750 * SCALE;
    else if (th.id === 'volcano') y = 750 * SCALE - ((i * 97 + time * 35) % (1500 * SCALE));
    const a = .4 + .4 * Math.sin(time * 2 + i);
    c.globalAlpha = a;glowDot(c, x, y, th.id === 'ice' ? 4 : 7, th.id === 'ice' ? '#ffffff' : th.glow);
  }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- pets
// Companions drawn facing right with their feet at (0, 0), about 34 units tall; `moving` adds a run cycle.
const PET_AURA = {cat: '#4fb6ff', fox: '#c46bff', owl: '#ffb52e', dragon: '#ff4a55', qilin: '#ff8ae0'};
function petAura(c, col, time, big) {
  c.save();c.scale(1, .34);const R = big ? 24 : 18;
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);g.addColorStop(0, `${col}55`);g.addColorStop(1, `${col}00`);c.fillStyle = g;c.beginPath();c.arc(0, 0, R * 1.3, 0, Math.PI * 2);c.fill();
  c.setLineDash([6, 5]);c.lineDashOffset = -time * 30;c.strokeStyle = col;c.lineWidth = 2.4;c.beginPath();c.arc(0, 0, R, 0, Math.PI * 2);c.stroke();c.restore();
}
function flame(c, x, y, w, h, time, k, hot = '#ffe27a', mid = '#ff7a2a') {
  const f = Math.sin(time * 14 + k) * .18;c.save();c.translate(x, y);
  c.beginPath();c.moveTo(-w, 0);c.quadraticCurveTo(-w * 1.1, -h * .6, w * f * 3, -h);c.quadraticCurveTo(w * 1.1, -h * .55, w, 0);c.quadraticCurveTo(0, h * .25, -w, 0);
  const g = c.createLinearGradient(0, 0, 0, -h);g.addColorStop(0, mid);g.addColorStop(1, hot);c.fillStyle = g;c.fill();c.strokeStyle = OUT;c.lineWidth = 1.2;c.stroke();c.restore();
}
function fierceEye(c, x, y, r, iris, slant = 1) {
  P(c, [[x - r * 1.2, y - r * .2], [x + r * 1.1, y - r * .9 * slant], [x + r * 1.1, y + r * .7], [x - r * .9, y + r * .7]], '#ffffff', OUT, 1);
  E(c, x + r * .3, y + r * .05, r * .55, r * .65, iris, null);E(c, x + r * .4, y - r * .15, r * .18, r * .18, '#ffffff', null);
}
export function drawToonPet(c, id, time, moving = false, face = 1) {
  const run = moving ? time * 15 : time * 3, bob = moving ? Math.abs(Math.sin(run)) * 2.6 : Math.sin(time * 3) * .8;
  c.save();if (PET_AURA[id]) petAura(c, PET_AURA[id], time, id === 'dragon' || id === 'qilin');
  E(c, 0, 1, 13, 4, '#10303050', null);c.scale(face, 1);c.translate(0, -bob);
  const legs = (col, xs, w = 3) => {for (const [x, ph] of xs) {const sw = moving ? Math.sin(run + ph) * 3.4 : 0;limb(c, x, -7, x + sw, 0, col, w);}};
  if (id === 'chick') { // battle chick: headband and a twig sword
    legs('#e08a2a', [[-3, 0], [4, Math.PI]], 2);
    E(c, 0, -12, 11, 11, '#ffe14a');E(c, -4, -9, 5, 3.4, '#f4c42a', OUT, 1);E(c, 3, -6, 6, 3.6, '#fff4b0', null);
    P(c, [[-10, -17], [10, -17], [10, -13], [-10, -13]], '#d8322a', OUT, 1.2);
    for (const k of [0, 1]) {const fl = Math.sin(time * 9 + k) * 3;P(c, [[-10, -16], [-19, -18 + fl + k * 4], [-18, -13 + fl + k * 4], [-10, -14]], '#d8322a', OUT, 1);}
    fierceEye(c, 5, -12, 2.6, '#2b2133');L(c, 2, -16.5, 8.5, -14.5, OUT, 1.8);
    P(c, [[9, -11], [16, -9], [9, -7]], '#ff9a2a', OUT, 1.2);P(c, [[-2, -24], [1, -30], [3, -23]], '#ffe14a', OUT, 1);
    c.save();c.translate(11, -4);c.rotate(.55 + (moving ? Math.sin(run) * .25 : 0));L(c, 0, 0, 0, -15, OUT, 3.4);L(c, 0, 0, 0, -15, '#c8d4e2', 1.8);L(c, -3, -2, 3, -2, '#8a5a34', 2.4);c.restore();E(c, 10, -5, 2.6, 2.2, '#f4c42a', OUT, 1);
  } else if (id === 'cat') { // ninja cat: mask, scarf, glowing eyes
    legs('#1e2440', [[-8, 0], [-3, Math.PI], [5, 0], [9, Math.PI]], 3.2);
    c.beginPath();c.moveTo(-11, -12);c.bezierCurveTo(-22, -12, -20, -26 + Math.sin(time * 5) * 3, -14, -28);c.strokeStyle = OUT;c.lineWidth = 5;c.stroke();c.strokeStyle = '#2a3258';c.lineWidth = 3.2;c.stroke();
    E(c, -1, -12, 13, 7, '#2a3258');E(c, 1, -9, 7, 3, '#3a4478', null);
    for (let k = 0; k < 2; k++) {const fl = Math.sin(time * 10 + k * 1.3) * 3;P(c, [[3, -16], [-12 - k * 5, -20 + fl + k * 3], [-10 - k * 5, -15 + fl + k * 3], [3, -13]], '#e8384a', OUT, 1);}
    E(c, 9, -19, 8.5, 7.5, '#2a3258');for (const x of [4, 12]) P(c, [[x - 3, -23], [x, -32], [x + 3.5, -23]], '#2a3258', OUT, 1.2);
    P(c, [[2, -21], [17, -21], [16, -17], [3, -17]], '#11142a', null);for (const x of [7, 13]) {E(c, x, -19, 2.4, 1.3, '#bff6ff', null);glowDot(c, x, -19, 5, '#7fe8ff88');}
    P(c, [[3, -15], [17, -15], [12, -12], [6, -12]], '#e8384a', OUT, 1);
  } else if (id === 'fox') { // flame fox: three burning tails
    for (let k = 0; k < 3; k++) {c.save();c.translate(-10, -12);c.rotate(-1.9 + k * .45 + Math.sin(time * 6 + k) * .12);flame(c, 0, 0, 4.4, 20, time, k * 2);c.restore();}
    legs('#2a1410', [[-8, 0], [-3, Math.PI], [5, 0], [9, Math.PI]], 3.2);
    E(c, -1, -12, 12, 7, '#ff6a2a');E(c, 3, -9, 7, 3.4, '#fff4e0', null);
    E(c, 10, -19, 7.5, 7, '#ff6a2a');P(c, [[14, -21], [23, -17], [15, -14]], '#ff6a2a', OUT, 1.2);P(c, [[15, -16], [22, -17], [16, -14]], '#fff4e0', null);E(c, 22.5, -17.2, 1.3, 1.1, OUT, null);
    for (const x of [5, 11]) {P(c, [[x - 3, -23], [x, -33], [x + 3.5, -23]], '#ff6a2a', OUT, 1.2);P(c, [[x - 1.2, -24], [x, -30], [x + 1.6, -24]], '#2a1410', null);}
    fierceEye(c, 11, -20, 2.4, '#ffb000');glowDot(c, 12, -20, 7, '#ffb00055');
    for (let i = 0; i < 4; i++) {const ph = (time * 1.1 + i / 4) % 1;c.globalAlpha = 1 - ph;E(c, -14 + Math.sin(i * 3) * 6, -26 - ph * 16, 1.6, 1.6, i % 2 ? '#ffe27a' : '#ff7a2a', null);}c.globalAlpha = 1;
  } else if (id === 'owl') { // archmage owl: star hat, rune circle, orbs
    c.save();c.translate(0, -2);c.scale(1, .32);c.rotate(time * .8);c.strokeStyle = '#ffd25a';c.lineWidth = 2;c.beginPath();c.arc(0, 0, 15, 0, Math.PI * 2);c.stroke();
    for (let i = 0; i < 6; i++) {c.rotate(Math.PI / 3);c.beginPath();c.moveTo(11, 0);c.lineTo(15, -3);c.lineTo(15, 3);c.closePath();c.fillStyle = '#ffd25a';c.fill();}c.restore();
    c.translate(0, -8 + Math.sin(time * 4) * 2.5);const flap = Math.sin(time * 12) * .45;
    for (const sd of [-1, 1]) {c.save();c.scale(sd, 1);c.translate(6, -12);c.rotate(-.3 + flap);P(c, [[0, 0], [16, -10], [22, -4], [18, 0], [20, 5], [8, 6]], '#2e3a7a');for (const k of [6, 11, 16]) L(c, k, -2, k + 2, 4, '#5a6ac8', 1.2);c.restore();}
    E(c, 0, -12, 10, 11.5, '#3a4aa0');E(c, 0, -8, 6.5, 6.5, '#c8d0ff', null);
    for (const sd of [-1, 1]) {E(c, sd * 4.4, -15, 4.2, 4.2, '#fff8d0', OUT, 1.2);E(c, sd * 4.4 + .8, -15, 2, 2.4, '#1a1040', null);glowDot(c, sd * 4.4, -15, 6, '#ffe27a44');}
    L(c, -8, -20, -1, -18, OUT, 1.8);L(c, 8, -20, 1, -18, OUT, 1.8);P(c, [[-1.6, -12], [1.6, -12], [0, -8.5]], '#ffb03a', OUT, 1);
    P(c, [[-11, -22], [11, -22], [3, -38], [8, -42], [-1, -37]], '#5a2aa8', OUT, 1.4);P(c, [[-12, -23], [12, -23], [12, -20], [-12, -20]], '#ffd25a', OUT, 1);
    P(c, [[7, -42], [8.2, -39.6], [10.8, -39.4], [8.8, -37.8], [9.4, -35.2], [7, -36.6], [4.6, -35.2], [5.2, -37.8], [3.2, -39.4], [5.8, -39.6]], '#ffe27a', OUT, .8);
    for (let i = 0; i < 3; i++) {const a = time * 2.2 + i * 2.1;glowDot(c, Math.cos(a) * 18, -14 + Math.sin(a) * 7, 6, '#b8a0ffcc');E(c, Math.cos(a) * 18, -14 + Math.sin(a) * 7, 1.8, 1.8, '#ffffff', null);}
  } else if (id === 'dragon') { // fire drake: big wings, horns, back spikes, flame breath
    c.translate(0, -10 + Math.sin(time * 3.5) * 2.5);const flap = Math.sin(time * 9) * .55;
    c.save();c.translate(-3, -14);c.scale(.85, 1);c.rotate(-flap);P(c, [[0, 0], [-6, -22], [-18, -26], [-24, -12], [-20, -10], [-18, -2], [-8, 2]], '#8a1420');c.restore();
    c.beginPath();c.moveTo(-10, -6);c.bezierCurveTo(-22, -4, -26, -12, -30, -6 + Math.sin(time * 5) * 3);c.strokeStyle = OUT;c.lineWidth = 6;c.stroke();c.strokeStyle = '#d8283a';c.lineWidth = 4;c.stroke();
    P(c, [[-31, -8 + Math.sin(time * 5) * 3], [-36, -4 + Math.sin(time * 5) * 3], [-30, -2 + Math.sin(time * 5) * 3]], '#ffd25a', OUT, 1);
    for (const x of [-6, 4]) limb(c, x, -6, x + (moving ? Math.sin(run + x) * 2 : 0), 4, '#d8283a', 3.4);
    E(c, -1, -9, 12, 8.5, '#d8283a');for (let i = 0; i < 4; i++) P(c, [[-4 + i * 3, -2], [-2 + i * 3, -2], [-3 + i * 3, -9]], '#ffd27a', null);E(c, 1, -6, 7, 4, '#ffd27a', null);
    for (let i = 0; i < 4; i++) P(c, [[-10 + i * 5, -15], [-7 + i * 5, -21], [-5 + i * 5, -15]], '#ffd25a', OUT, 1);
    c.save();c.translate(-1, -16);c.rotate(flap * .9);P(c, [[0, 0], [10, -24], [22, -30], [26, -16], [21, -13], [21, -6], [10, 0]], '#b81c2c');for (const k of [[10, -24], [22, -30], [26, -16]]) L(c, 2, -1, k[0], k[1] + 3, '#6a0e18', 1.2);c.restore();
    E(c, 11, -18, 8, 7, '#d8283a');P(c, [[15, -21], [25, -18], [24, -13], [15, -13]], '#d8283a', OUT, 1.2);E(c, 23.5, -17.8, 1.1, 1, OUT, null);
    for (const x of [7, 12]) P(c, [[x - 2, -23], [x - 6, -33], [x + 2, -24.5]], '#fff0c0', OUT, 1);
    fierceEye(c, 13, -20, 2.3, '#ffe08a');P(c, [[17, -13.5], [19, -11], [21, -13.5]], '#fffaf0', OUT, .7);
    const puff = (time * 1.3) % 1;if (puff < .6) {c.globalAlpha = 1 - puff / .6;glowDot(c, 26 + puff * 6, -15, 4 + puff * 6, '#ff9a2aaa');E(c, 26 + puff * 6, -15, 1.6 + puff * 2, 1.6 + puff * 2, '#ffe27a', null);c.globalAlpha = 1;}
  } else if (id === 'qilin') { // golden qilin: flaming mane, antler horns, cloud hooves
    glowDot(c, 0, -18, 30, '#ffe39a44');
    for (const [x, ph] of [[-9, 0], [-4, Math.PI], [6, 0], [11, Math.PI]]) {const sw = moving ? Math.sin(run + ph) * 3.4 : 0;limb(c, x, -9, x + sw, -1, '#d4a034', 3.4);for (const k of [-1, 1]) E(c, x + sw + k * 2.4, 0, 2.6, 1.8, '#ffffff', OUT, .8);}
    for (let k = 0; k < 3; k++) {c.save();c.translate(-13, -14);c.rotate(-1.6 + k * .3);flame(c, 0, 0, 3.6, 14, time, k, '#e0fbff', '#4fb6ff');c.restore();}
    E(c, -1, -15, 14, 8, '#ffd25a');for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {c.beginPath();c.arc(-8 + i * 5 + r * 2.5, -16 + r * 4, 2.4, 0, Math.PI);c.strokeStyle = '#c4801a';c.lineWidth = 1.2;c.stroke();}
    P(c, [[6, -18], [10, -30], [18, -30], [14, -16]], '#ffd25a');
    for (let k = 0; k < 5; k++) {c.save();c.translate(6 + k * 1.6, -32 + k * 3.6);c.rotate(-2.2 + Math.sin(time * 5 + k) * .15);flame(c, 0, 0, 2.8, 10, time, k + 3, '#fff4ff', `hsl(${(k * 60 + time * 90) % 360} 90% 62%)`);c.restore();}
    E(c, 17, -31, 6.5, 5.5, '#ffd25a');P(c, [[20, -33], [27, -31], [26, -27], [20, -27]], '#ffd25a', OUT, 1.2);E(c, 26, -30, 1, .9, OUT, null);
    for (const [x, d] of [[14, 0], [18, 1]]) {L(c, x, -35, x + 2 + d * 2, -44, OUT, 3);L(c, x, -35, x + 2 + d * 2, -44, '#fff4c0', 1.6);L(c, x + 1 + d, -40, x + 5 + d * 2, -42, '#fff4c0', 1.4);}
    fierceEye(c, 19, -32, 2.2, '#4fb6ff');glowDot(c, 20, -32, 6, '#7fe8ff66');
    for (let i = 0; i < 5; i++) {const ph = (time * .8 + i / 5) % 1;c.globalAlpha = 1 - ph;glowDot(c, Math.sin(i * 2.4 + time) * 18, -6 - ph * 40, 3.4, `hsl(${i * 70} 95% 72%)`);}c.globalAlpha = 1;
  }
  c.restore();
}

// ================================================================ worlds 7-15 (v0.30)
// Each new world has its own monsters (wired through VARIANT), a boss (through titan), arena props,
// ground clusters and a slime topper. Coordinates follow the rest of the file: feet at y=0, facing +x.
function smile(c, x, y, w, f, open = false) {
  c.beginPath();c.moveTo(x - w, y);c.quadraticCurveTo(x, y + w * 1.1, x + w, y);
  if (open) {c.closePath();c.fillStyle = f('#7a2a3a');c.fill();}
  c.strokeStyle = f('#3a1a2a');c.lineWidth = 1.2;c.lineCap = 'round';c.stroke();
}
function shine(c, x, y, rx, ry, rot = -.5) {c.beginPath();c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);c.fillStyle = '#ffffffb0';c.fill();}
function bolt(c, x, y, s, col) {P(c, [[x, y], [x + 4 * s, y + 8 * s], [x + 1 * s, y + 8 * s], [x + 5 * s, y + 17 * s], [x - 3 * s, y + 6 * s], [x, y + 6 * s]], col, OUT, 1);}
function star5(c, x, y, r, col, stroke = OUT, w = 1) {
  const pts = [];for (let i = 0; i < 10; i++) {const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);}
  P(c, pts, col, stroke, w);
}

// ---- 7 desert
function sandScorpion(c, th, f, t, e) {
  const walk = Math.sin(t * 14) * 2, strike = lift(e);
  for (const x of [-10, -2, 6]) for (const s of [-1, 1]) L(c, x, -10, x - 4 + walk * s, 0, f(OUT), 2.4);
  E(c, -2, -14, 20, 11, f(th.body));E(c, -8, -19, 8, 3, '#ffffff50', null);
  for (const x of [-12, -4]) L(c, x, -23, x + 2, -6, f(th.body2), 1.4);
  // Tail arcs over the back; it lunges forward when the attack is wound up.
  const segs = 5;for (let i = 0; i < segs; i++) {const a = Math.PI * (.95 - i * .2) - strike * .5, r = 22;E(c, -14 + Math.cos(a) * r * .8 + strike * i * 3, -24 - Math.sin(a) * r * (.4 + i * .14), 6 - i * .5, 5.5 - i * .5, f(th.body));}
  P(c, [[-2 + strike * 15, -56], [8 + strike * 15, -60], [2 + strike * 15, -48]], f('#3a2a3a'));
  E(c, 17, -15, 10, 9, f(th.body));
  for (const s of [-1, 1]) {const cy = -14 + s * 5;limb(c, 22, cy, 30, cy - 6 - strike * 4, f(th.body), 4);E(c, 33, cy - 8 - strike * 4, 6, 4.5, f(th.body2));P(c, [[33, cy - 12 - strike * 4], [42, cy - 10 - strike * 4], [36, cy - 7 - strike * 4]], f(th.body2), OUT, 1);}
  eyes(c, 19, -18, 1.8, 3.4, th, f, true);
}
function cactusBomb(c, th, f, t, e) {
  const hot = armed(e, t), sway = Math.sin(t * 6) * .06;
  c.save();c.rotate(sway);if (e.warn) c.scale(1 + Math.sin(t * 40) * .06, 1 + Math.sin(t * 40) * .06);
  P(c, [[-9, 0], [9, 0], [11, -8], [-11, -8]], f('#c86a3a'));L(c, -10, -6, 10, -6, f('#ffd27a'), 1.6);
  const body = hot ? '#ff5a4a' : f('#5ab84a');
  c.beginPath();c.moveTo(-7, -8);c.lineTo(-7, -26);c.arc(0, -26, 7, Math.PI, 0);c.lineTo(7, -8);c.closePath();c.fillStyle = body;c.fill();c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
  for (const s of [-1, 1]) {c.beginPath();c.moveTo(s * 7, -16);c.lineTo(s * 12, -16);c.lineTo(s * 12, -23);c.arc(s * 12, -23, 2.5, Math.PI, 0, s < 0);c.strokeStyle = OUT;c.lineWidth = 7.4;c.stroke();c.strokeStyle = body;c.lineWidth = 5;c.stroke();}
  shine(c, -3, -27, 1.6, 4, 0);
  for (const [x, y] of [[-4, -18], [4, -12], [3, -24]]) L(c, x, y, x + 1.2, y - 1.2, '#ffffffcc', 1);
  E(c, 0, -34, 3.4, 3.4, f('#ff8ac8'), OUT, 1);E(c, 0, -34, 1.3, 1.3, f('#ffe27a'), null);
  eyes(c, 0, -20, 1.4, 3, th, f);blush(c, 0, -16.5, 1.3, 4.5);
  c.restore();if (hot) glowDot(c, 0, -20, 24, '#ff6a3a66');
}
function mummyCaster(c, th, f, t, e) {
  const hover = Math.sin(t * 3) * 1.5;c.translate(0, hover);
  P(c, [[-11, 0], [11, 0], [9, -26], [-9, -26]], f('#e8dcc0'));
  for (let i = 0; i < 5; i++) L(c, -10 + i * .4, -4 - i * 5, 10 - i * .4, -7 - i * 5, f('#c8b896'), 1.4);
  E(c, 0, -32, 11, 10.5, f('#efe4c8'));
  for (let i = 0; i < 3; i++) L(c, -10, -37 + i * 5, 10, -34 + i * 5 - (i === 1 ? 3 : 0), f('#c8b896'), 1.4);
  eyes(c, 2, -31, 1.8, 3.8, th, f);blush(c, 2, -27, 1.5, 6);
  L(c, -11, -38, -20, -30 + Math.sin(t * 5) * 3, f('#e8dcc0'), 2.4);
  const ox = 15, oy = -20, r = 4 + (e.warn ? 2 : 0) + Math.sin(t * 8) * .6;
  limb(c, 7, -18, ox - 2, oy + 2, f('#e8dcc0'), 3.2);glowDot(c, ox, oy, r * 3.2, `${th.accent}aa`);E(c, ox, oy, r, r, f(th.accent), OUT, 1);
}
function sandPharaoh(c, th, f, t, raise) {
  const float = Math.sin(t * 2) * 4;c.translate(0, float);
  for (let i = 0; i < 3; i++) {c.save();c.scale(1, .3);c.globalAlpha = .35;c.beginPath();c.arc(0, -10, 50 + i * 16 + Math.sin(t * 3 + i) * 4, 0, Math.PI * 2);c.strokeStyle = f('#e8c47a');c.lineWidth = 4;c.stroke();c.restore();}
  P(c, [[-34, -10], [34, -10], [26, -96], [-26, -96]], f('#f4e8c8'));
  P(c, [[-28, -96], [28, -96], [24, -60], [0, -50], [-24, -60]], f('#3a6ad0'));
  for (let i = 0; i < 4; i++) L(c, -22 + i * 2, -86 + i * 8, 22 - i * 2, -86 + i * 8, f('#ffd25a'), 3);
  for (const y of [-40, -28]) L(c, -30, y, 30, y, f('#c8b896'), 2);
  // Nemes headdress with gold and blue stripes.
  P(c, [[-40, -96], [40, -96], [34, -150], [0, -168], [-34, -150]], f('#ffd25a'));
  for (let i = 0; i < 6; i++) L(c, -36 + i * 1.4, -100 - i * 9, 36 - i * 1.4, -100 - i * 9, f('#2a5ac0'), 3.2);
  E(c, 0, -124, 22, 22, f('#d8a05a'));E(c, -8, -132, 7, 4, '#ffffff40', null);
  eyes(c, 2, -126, 3.6, 8, th, f, true);for (const s of [-1, 1]) L(c, s * 8 + 2 + s * 4, -122, s * 8 + 2 + s * 10, -118, f(OUT), 2);
  P(c, [[-3, -112], [7, -112], [5, -96], [-1, -96]], f('#3a2a5a'));
  P(c, [[-6, -168], [6, -168], [4, -182], [-4, -182]], f('#3ad0c0'), OUT, 1.2);glowDot(c, 0, -176, 14, '#3ad0c066');
  limb(c, -30, -84, -40, -44, f('#d8a05a'), 10);
  c.save();c.translate(30, -84);c.rotate(-.3 - raise * 1.8);limb(c, 0, 0, 10, 36, f('#d8a05a'), 10);c.translate(10, 40);
  L(c, 0, -60, 0, 30, OUT, 7);L(c, 0, -60, 0, 30, f('#ffd25a'), 4);c.beginPath();c.arc(-8, -60, 8, 0, Math.PI, true);c.strokeStyle = OUT;c.lineWidth = 7;c.stroke();c.strokeStyle = f('#2a5ac0');c.lineWidth = 4;c.stroke();
  if (raise > .3) glowDot(c, 0, -60, 30 * raise, '#ffe27a99');c.restore();
}

// ---- 8 swamp
function frog(c, th, f, t, e) {
  const hop = Math.max(0, Math.sin(t * 9)) * 10, squash = hop > 1 ? 1 : 1.08;c.translate(0, -hop);c.scale(1, 1 / squash);
  for (const s of [-1, 1]) E(c, s * 10, -3, 7, 4, f(th.body2));
  E(c, 0, -13, 15, 12, f(th.body));E(c, 0, -9, 10, 7, f('#e8f4b0'), null);shine(c, -7, -19, 4, 2.4);
  for (const s of [-1, 1]) {E(c, s * 7 + 2, -25, 6, 6, f(th.body));}
  eyes(c, 2, -25, 2, 7, th, f);blush(c, 2, -17, 2, 9);smile(c, 2, -15, 4, f);
  if (Math.sin(t * 3) > .85) {L(c, 6, -14, 22, -16, f('#ff7a9a'), 2.4);E(c, 23, -16, 2.4, 2.4, f('#ff7a9a'), OUT, 1);}
}
function snapFlower(c, th, f, t, e) {
  const sway = Math.sin(t * 2.5) * 3, open = e.warn ? .6 : .2 + Math.abs(Math.sin(t * 3)) * .2;
  E(c, 0, -2, 12, 4, f('#4a3a2a'));
  c.beginPath();c.moveTo(0, -2);c.quadraticCurveTo(-6, -20, sway, -36);c.strokeStyle = OUT;c.lineWidth = 6.6;c.stroke();c.strokeStyle = f('#4a9a3a');c.lineWidth = 4;c.stroke();
  for (const s of [-1, 1]) P(c, [[0, -12], [s * 14, -20], [s * 18, -12], [s * 6, -8]], f('#5ab84a'));
  c.save();c.translate(sway, -44);
  for (let i = 0; i < 6; i++) {c.save();c.rotate(i * Math.PI / 3 + t * .4);E(c, 0, -13, 6, 8, f(th.accent));c.restore();}
  E(c, 0, 0, 12, 11, f('#ff6a8a'));shine(c, -5, -5, 3.4, 2);
  c.beginPath();c.moveTo(-8, 3);c.quadraticCurveTo(0, 3 + 12 * open, 8, 3);c.closePath();c.fillStyle = f('#5a1a2a');c.fill();c.strokeStyle = OUT;c.lineWidth = 1.2;c.stroke();
  for (const x of [-5, 0, 5]) P(c, [[x - 1.8, 3], [x, 6], [x + 1.8, 3]], '#ffffff', OUT, .6);
  eyes(c, 0, -3, 1.7, 4, th, f, true);
  c.restore();
}
function toadKing(c, th, f, t, raise) {
  const breathe = Math.sin(t * 2) * 3;
  E(c, 0, -4, 70, 16, f('#3a8a4a'));E(c, -20, -8, 20, 5, '#ffffff30', null);
  for (const s of [-1, 1]) {E(c, s * 40, -16, 22, 14, f(th.body2));}
  E(c, 0, -64, 56 + breathe, 50, f(th.body));E(c, 0, -50, 38, 32, f('#e8f4b0'));shine(c, -26, -92, 12, 7);
  for (const [x, y] of [[-34, -76], [30, -88], [40, -60]]) E(c, x, y, 5, 4, f(th.body2), null);
  for (const s of [-1, 1]) E(c, s * 26, -112, 18, 18, f(th.body));
  eyes(c, 0, -112, 6, 26, th, f, true);blush(c, 0, -90, 7, 34);
  c.beginPath();c.moveTo(-30, -82);c.quadraticCurveTo(0, -66 + raise * 12, 30, -82);c.strokeStyle = OUT;c.lineWidth = 3;c.stroke();
  if (raise > .2) {c.beginPath();c.moveTo(-26, -80);c.quadraticCurveTo(0, -60, 26, -80);c.closePath();c.fillStyle = f('#7a2a3a');c.fill();}
  crownSpikes(c, f, -128, 26, 22, '#ffd25a', th.accent);
  c.save();c.translate(44, -60);c.rotate(-.4 - raise * 1.4);L(c, 0, 0, 0, -70, OUT, 7);L(c, 0, 0, 0, -70, f('#8a5a2a'), 4);E(c, 0, -74, 9, 9, f(th.accent));glowDot(c, 0, -74, 18, `${th.accent}88`);c.restore();
}

// ---- 9 sky islands
function cloudPuff(c, th, f, t, e) {
  const hover = Math.sin(t * 3) * 3, hot = armed(e, t);c.translate(0, -18 + hover);
  if (e.warn) c.scale(1 + Math.sin(t * 40) * .07, 1 + Math.sin(t * 40) * .07);
  const col = hot ? '#9aa4c8' : f('#ffffff');
  for (const [x, y, r] of [[-10, 0, 8], [10, 0, 8], [-5, -7, 9], [5, -8, 10], [0, 1, 10]]) E(c, x, y, r, r * .85, col, null);
  c.beginPath();for (const [x, y, r] of [[-10, 0, 8], [10, 0, 8], [-5, -7, 9], [5, -8, 10], [0, 1, 10]]) {c.moveTo(x + r, y);c.ellipse(x, y, r, r * .85, 0, 0, Math.PI * 2);}
  c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
  for (const [x, y, r] of [[-10, 0, 8], [10, 0, 8], [-5, -7, 9], [5, -8, 10], [0, 1, 10]]) E(c, x, y, r - 1, r * .85 - 1, col, null);
  shine(c, -6, -10, 4, 2);
  eyes(c, 0, -2, 1.6, 4, th, f);blush(c, 0, 2, 1.5, 7);smile(c, 0, 3.5, 2, f);
  if (hot || e.warn) bolt(c, 2, 8, 1, f('#ffe27a'));
}
function birdling(c, th, f, t, e) {
  const flap = Math.sin(t * 20), hover = Math.sin(t * 5) * 3;c.translate(0, -22 + hover);
  for (const s of [-1, 1]) {c.save();c.translate(-2, -2);c.scale(1, s);c.rotate(-.3 + flap * .6 * s);P(c, [[0, 0], [-6, -12], [-12, -10], [-10, -3]], f(th.body2));c.restore();}
  P(c, [[-9, 0], [-16, -3], [-15, 3]], f(th.body2));
  E(c, 0, 0, 9, 8.5, f(th.body));E(c, 1, 3, 5.5, 4, f('#fff8e0'), null);shine(c, -3, -4, 2.6, 1.6);
  P(c, [[-1, -8], [2, -14], [4, -8]], f('#ff7a5a'), OUT, 1);
  eyes(c, 3, -1, 1.4, 3.4, th, f);P(c, [[7, 0], [12, 1.5], [7, 3]], f('#ffb43a'), OUT, 1);
}
function thunderRoc(c, th, f, t, raise) {
  const flap = Math.sin(t * 3) * .25 - raise * .5, bob = Math.sin(t * 3) * 6;c.translate(0, -40 + bob);
  for (const s of [-1, 1]) {c.save();c.translate(s * 26, -60);c.scale(s, 1);c.rotate(-flap);
    P(c, [[0, 0], [40, -40], [80, -36], [96, -10], [70, -6], [84, 10], [56, 8], [60, 22], [30, 14]], f(th.body2));
    for (let i = 0; i < 4; i++) L(c, 30 + i * 14, -22 + i * 2, 40 + i * 14, 4 + i * 2, f('#ffffff60'), 2);c.restore();}
  E(c, 0, -50, 44, 50, f(th.body));E(c, 0, -34, 28, 30, f('#fff8e0'));shine(c, -20, -80, 12, 7);
  for (const s of [-1, 1]) limb(c, s * 14, 0, s * 18, 30, f('#ffb43a'), 6);
  for (let i = 0; i < 5; i++) P(c, [[-12 + i * 6, -96], [-20 + i * 10, -128 - (i % 2) * 10], [-6 + i * 6, -98]], f(i % 2 ? th.accent : '#ffffff'), OUT, 1.2);
  eyes(c, 4, -70, 5, 14, th, f, true);
  P(c, [[-8, -60], [8, -60], [24, -50], [8, -44], [-8, -48]], f('#ffb43a'));
  for (let i = 0; i < 3; i++) {const a = t * 2 + i * 2.1;bolt(c, Math.cos(a) * 70, -50 + Math.sin(a) * 30, 1.4 + raise, f('#ffe27a'));}
  if (raise > .3) glowDot(c, 0, -60, 90 * raise, '#ffe27a55');
}

// ---- 10 deep sea
function jellyfish(c, th, f, t, e) {
  const pulse = Math.sin(t * 5), hover = pulse * 3;c.translate(0, -24 + hover);
  for (let i = 0; i < 5; i++) {const x = -8 + i * 4;c.beginPath();c.moveTo(x, 2);c.quadraticCurveTo(x + Math.sin(t * 6 + i) * 4, 10, x + Math.sin(t * 5 + i) * 3, 18);c.strokeStyle = f('#ff9ad0');c.lineWidth = 2;c.lineCap = 'round';c.stroke();}
  glowDot(c, 0, -2, 22, '#ff9ad055');
  c.beginPath();c.moveTo(-12, 2);c.bezierCurveTo(-13 - pulse, -18, 13 + pulse, -18, 12, 2);
  for (let i = 0; i < 4; i++) c.quadraticCurveTo(12 - i * 6 - 3, 6, 12 - (i + 1) * 6, 2);
  c.closePath();c.globalAlpha = .9;c.fillStyle = f('#ffb4e0');c.fill();c.globalAlpha = 1;c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
  shine(c, -5, -9, 3.6, 2);eyes(c, 0, -4, 1.6, 4, th, f);blush(c, 0, -.5, 1.5, 7);
}
function crab(c, th, f, t, e) {
  const walk = Math.sin(t * 16) * 2, pinch = lift(e);
  for (const x of [-12, -6, 6, 12]) L(c, x, -8, x * 1.5 + walk * Math.sign(x), 0, f(OUT), 2.6);
  for (const s of [-1, 1]) {limb(c, s * 14, -18, s * 24, -30 - pinch * 8, f(th.body), 5);c.save();c.translate(s * 26, -36 - pinch * 8);c.scale(s, 1);
    E(c, 0, 0, 9, 7, f(th.body));P(c, [[2, -6], [12, -10 - pinch * 4], [8, -2]], f(th.body2));c.restore();}
  E(c, 0, -16, 20, 13, f(th.body));E(c, -6, -22, 8, 3.4, '#ffffff50', null);
  for (const s of [-1, 1]) {L(c, s * 5, -26, s * 6, -34, f(OUT), 2);E(c, s * 6, -36, 4, 4, f('#ffffff'));E(c, s * 6 + 1, -36, 2.2, 2.6, f('#221c36'), null);E(c, s * 6, -37, .9, .9, '#ffffff', null);}
  smile(c, 0, -12, 4, f);blush(c, 0, -14, 2, 10);
}
function puffer(c, th, f, t, e) {
  const puff = e.warn ? 1.4 : 1 + Math.sin(t * 3) * .05, hot = armed(e, t);c.translate(0, -16);c.scale(puff, puff);
  P(c, [[-12, 0], [-20, -6], [-20, 6]], f(th.accent));
  for (let i = 0; i < 12; i++) {const a = i * Math.PI / 6;P(c, [[Math.cos(a - .15) * 11, Math.sin(a - .15) * 11], [Math.cos(a) * 16, Math.sin(a) * 16], [Math.cos(a + .15) * 11, Math.sin(a + .15) * 11]], f('#fff4c0'), OUT, .8);}
  E(c, 0, 0, 12, 11.5, hot ? '#ff5a4a' : f('#ffd25a'));E(c, 0, 4, 8, 5, f('#fff8e0'), null);shine(c, -4, -5, 3.4, 2);
  eyes(c, 3, -2, 1.5, 3.6, th, f);E(c, 6, 4, 1.6, 1.6, f('#7a2a3a'), OUT, .8);
}
function kraken(c, th, f, t, raise) {
  for (let i = 0; i < 8; i++) {const s = i < 4 ? -1 : 1, k = i % 4, base = s * (14 + k * 10), sw = Math.sin(t * 2 + i) * 14 - (k === 3 ? raise * 30 * s : 0);
    c.beginPath();c.moveTo(base, -40);c.bezierCurveTo(base + s * 20, -20, base + s * 30 + sw, 0, base + s * 46 + sw, -10 - k * 8);
    c.strokeStyle = OUT;c.lineWidth = 17 - k;c.lineCap = 'round';c.stroke();c.strokeStyle = f(i % 2 ? th.body : '#ff9a7a');c.lineWidth = 14 - k;c.stroke();
    for (let j = 1; j < 4; j++) E(c, base + s * (10 + j * 9) + sw * j / 4, -26 + j * 4, 2, 2, f('#ffe0d0'), null);}
  E(c, 0, -96, 52, 64, f(th.body));shine(c, -24, -132, 14, 9);
  for (const [x, y] of [[-30, -110], [26, -130], [34, -80], [-16, -150]]) E(c, x, y, 6, 5, f(th.body2), null);
  eyes(c, 0, -80, 7, 20, th, f, true);
  c.beginPath();c.moveTo(-14, -58);c.quadraticCurveTo(0, -48 - raise * 8, 14, -58);c.strokeStyle = OUT;c.lineWidth = 3;c.stroke();
  P(c, [[-36, -150], [36, -150], [26, -172], [-26, -172]], f('#2a2a3a'));P(c, [[-46, -150], [46, -150], [40, -144], [-40, -144]], f('#2a2a3a'));
  E(c, 0, -161, 6, 5, f('#fff4dc'), OUT, 1);for (const s of [-1, 1]) L(c, s * 3, -158, s * 8, -153, f(OUT), 2);
}

// ---- 11 candy land
function gummyBear(c, th, f, t, e) {
  const step = Math.sin(t * 6) * 3, col = f(['#ff6a8a', '#ffb43a', '#5ad06a'][e.id % 3]);
  c.save();c.globalAlpha = .92;
  for (const s of [-1, 1]) E(c, s * 9 + step * s * .3, -6, 7, 7, col);
  E(c, 0, -26, 17, 19, col);for (const s of [-1, 1]) E(c, s * 16, -32 + (s > 0 ? -lift(e) * 10 : 0), 6, 9, col);
  E(c, 0, -52, 14, 13, col);for (const s of [-1, 1]) E(c, s * 11, -62, 5, 5, col);
  c.restore();shine(c, -7, -34, 4, 8, -.2);shine(c, -6, -58, 3.4, 2);
  E(c, 0, -26, 9, 10, '#ffffff30', null);
  eyes(c, 1, -53, 1.8, 4.2, th, f);E(c, 1, -47, 2.4, 1.8, f('#3a1a2a'), null);blush(c, 1, -48, 1.8, 7.5);
}
function cupcake(c, th, f, t, e) {
  const hot = armed(e, t), bounce = Math.abs(Math.sin(t * 5)) * 3;c.translate(0, -bounce);
  if (e.warn) c.scale(1 + Math.sin(t * 40) * .07, 1 + Math.sin(t * 40) * .07);
  P(c, [[-11, -12], [11, -12], [8, 0], [-8, 0]], f('#7ac8ff'));for (let i = -2; i <= 2; i++) L(c, i * 4, -11, i * 3, -1, f('#4a98d8'), 1.2);
  for (const [x, y, r] of [[-8, -15, 6], [8, -15, 6], [0, -16, 8], [-4, -22, 6], [4, -23, 6], [0, -28, 4.5]]) E(c, x, y, r, r * .85, hot ? '#ff5a4a' : f('#ffc4e0'), null);
  c.beginPath();c.moveTo(-14, -13);c.bezierCurveTo(-16, -30, 16, -30, 14, -13);c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
  shine(c, -5, -24, 3, 1.8);for (const [x, y, col] of [[-6, -18, '#ffe27a'], [5, -20, '#7ad0ff'], [1, -25, '#5ad06a'], [-2, -15, '#c46bff']]) L(c, x, y, x + 1.6, y - 1, col, 1.6);
  E(c, 1, -34, 3.6, 3.6, f('#ff3a4a'), OUT, 1);L(c, 1, -37, 3, -41, f('#4a8a3a'), 1.4);
  eyes(c, 0, -7, 1.3, 3.2, th, f);blush(c, 0, -4, 1.2, 5.5);
  if (hot) glowDot(c, 0, -14, 22, '#ff6a3a66');
}
function lollipop(c, th, f, t, e) {
  const sway = Math.sin(t * 2) * 2;
  E(c, 0, -2, 10, 3.6, f('#ffffff'));L(c, 0, -2, sway, -38, OUT, 5);L(c, 0, -2, sway, -38, f('#ffffff'), 3);
  c.save();c.translate(sway, -50);c.rotate(t * (e.warn ? 6 : 1));
  E(c, 0, 0, 14, 14, f('#ff8ac8'));for (let i = 0; i < 3; i++) {c.beginPath();c.arc(0, 0, 4 + i * 3.4, i, i + 4);c.strokeStyle = f(['#ffffff', '#7ad0ff', '#ffe27a'][i]);c.lineWidth = 2.4;c.stroke();}
  c.restore();shine(c, sway - 6, -56, 3.4, 2);
  eyes(c, sway + 1, -50, 1.7, 4.2, th, f, !!e.warn);blush(c, sway + 1, -46, 1.5, 7);
  if (e.warn) glowDot(c, sway + 14, -50, 12, `${th.glow}cc`);
}
function cakeQueen(c, th, f, t, raise) {
  const sway = Math.sin(t * 1.6) * 2;
  P(c, [[-50, 0], [50, 0], [46, -40], [-46, -40]], f('#ffe8c8'));for (let i = 0; i < 7; i++) E(c, -42 + i * 14, -40, 8, 6, f('#ff8ac8'), null);
  L(c, -48, -16, 48, -16, f('#ff8ac8'), 4);
  P(c, [[-36, -40], [36, -40], [32, -78], [-32, -78]], f('#ffc4e0'));for (let i = 0; i < 5; i++) E(c, -26 + i * 13, -78, 7, 5, f('#ffffff'), null);
  for (let i = 0; i < 6; i++) E(c, -30 + i * 12, -58, 3, 3, f(['#ff3a4a', '#ffe27a', '#7ad0ff'][i % 3]), OUT, .8);
  E(c, 0, -104, 26, 26, f('#ffe4cc'));shine(c, -10, -114, 6, 4);
  for (const s of [-1, 1]) {c.beginPath();c.arc(s * 24, -112, 12, 0, Math.PI * 2);c.fillStyle = f('#ff6aa0');c.fill();c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();}
  c.beginPath();c.moveTo(-26, -110);c.bezierCurveTo(-30, -150, 30, -150, 26, -110);c.quadraticCurveTo(14, -122, 0, -120);c.quadraticCurveTo(-14, -122, -26, -110);c.fillStyle = f('#ff6aa0');c.fill();c.strokeStyle = OUT;c.stroke();
  eyes(c, 2, -102, 4, 9, th, f, true);blush(c, 2, -94, 4, 15);smile(c, 2, -91, 5, f);
  // Strawberry crown.
  P(c, [[-12, -134], [12, -134], [8, -158], [0, -164], [-8, -158]], f('#ff3a4a'));for (const [x, y] of [[-5, -146], [4, -150], [0, -140]]) E(c, x, y, 1.2, 1.6, '#ffe27a', null);
  for (const s of [-1, 0, 1]) P(c, [[s * 6, -162], [s * 6 - 4, -170], [s * 6 + 4, -170]], f('#4ab84a'), OUT, 1);
  c.save();c.translate(36, -70);c.rotate(-.3 - raise * 1.6 + sway * .02);L(c, 0, 0, 0, -60, OUT, 8);
  for (let i = 0; i < 6; i++) L(c, 0, -i * 10, 0, -i * 10 - 10, f(i % 2 ? '#ff3a4a' : '#ffffff'), 5);
  c.beginPath();c.arc(-8, -60, 8, 0, Math.PI, true);c.strokeStyle = OUT;c.lineWidth = 8;c.stroke();c.strokeStyle = f('#ff3a4a');c.lineWidth = 5;c.stroke();c.restore();
}

// ---- 12 clockwork city
function robot(c, th, f, t, e) {
  const step = Math.sin(t * 6) * 3, punch = lift(e);
  for (const s of [-1, 1]) {limb(c, s * 8, -16, s * 9 + step * s, -2, f('#6a7a8a'), 6);P(c, [[s * 9 + step * s - 6, 0], [s * 9 + step * s + 6, 0], [s * 9 + step * s + 6, -4], [s * 9 + step * s - 6, -4]], f(th.body2));}
  P(c, [[-18, -16], [18, -16], [18, -50], [-18, -50]], f(th.body));
  for (const [x, y] of [[-14, -46], [14, -46], [-14, -20], [14, -20]]) E(c, x, y, 1.4, 1.4, f('#ffe27a'), null);
  c.save();c.translate(0, -33);c.rotate(t * 2);for (let i = 0; i < 8; i++) {c.rotate(Math.PI / 4);P(c, [[-2, -10], [2, -10], [2, -7], [-2, -7]], f('#ffd25a'), OUT, .8);}E(c, 0, 0, 7, 7, f('#ffd25a'), OUT, 1.2);E(c, 0, 0, 2.6, 2.6, f(th.body2), null);c.restore();
  P(c, [[-14, -50], [14, -50], [14, -72], [-14, -72]], f('#c8d0d8'));P(c, [[-10, -54], [10, -54], [10, -68], [-10, -68]], f('#1a2a3a'));
  for (const s of [-1, 1]) {E(c, s * 4 + 1, -61, 2.2, 2.8, f(th.eye), null);E(c, s * 4 + .4, -62, .8, .8, '#ffffff', null);}
  L(c, 0, -72, 0, -80, f(OUT), 2);E(c, 0, -82, 2.6, 2.6, f('#ff4a3a'), OUT, 1);if (Math.sin(t * 6) > 0) glowDot(c, 0, -82, 7, '#ff4a3a88');
  limb(c, -18, -44, -24, -26, f('#6a7a8a'), 5);
  c.save();c.translate(18, -44);c.rotate(.5 - punch * 2);limb(c, 0, 0, 8, 16, f('#6a7a8a'), 5);E(c, 9, 20, 6, 6, f(th.body2));c.restore();
}
function gearDrone(c, th, f, t, e) {
  const hover = Math.sin(t * 6) * 3;c.translate(0, -24 + hover);
  L(c, 0, -10, 0, -16, f(OUT), 2);c.save();c.translate(0, -17);c.scale(Math.cos(t * 30), 1);E(c, 0, 0, 12, 2, f('#c8d0d8'));c.restore();
  c.save();c.rotate(t * 3);for (let i = 0; i < 8; i++) {c.rotate(Math.PI / 4);P(c, [[-2.4, -12], [2.4, -12], [2.4, -8], [-2.4, -8]], f(th.body), OUT, .8);}c.restore();
  E(c, 0, 0, 9.5, 9.5, f(th.body));E(c, 0, 0, 5.4, 5.4, f('#1a2a3a'), OUT, 1);E(c, .6, .4, 2.6, 2.6, f(th.eye), null);E(c, -.6, -1, 1, 1, '#ffffff', null);
  glowDot(c, 0, 0, 12, `${th.eye}44`);
}
function cannonBot(c, th, f, t, e) {
  const recoil = e.warn ? Math.sin(t * 30) * 1.5 : 0;
  for (const s of [-1, 1]) {E(c, s * 9, -5, 6, 6, f('#3a3a4a'));E(c, s * 9, -5, 2.2, 2.2, f('#c8d0d8'), null);}
  P(c, [[-14, -8], [14, -8], [12, -26], [-12, -26]], f(th.body));
  c.save();c.translate(4 - recoil, -24);c.rotate(-.35);P(c, [[-4, -4], [20, -6], [20, 6], [-4, 4]], f('#4a4a5a'));E(c, 20, 0, 3, 6, f('#1a1a2a'));c.restore();
  E(c, -2, -30, 9, 8, f('#c8d0d8'));P(c, [[-8, -33], [6, -33], [6, -27], [-8, -27]], f('#1a2a3a'));
  for (const s of [-1, 1]) E(c, -1 + s * 3, -30, 1.4, 1.6, f(th.eye), null);
  if (e.warn) glowDot(c, 26, -32, 12, '#ffd25acc');
}
function gearTitan(c, th, f, t, raise) {
  const step = Math.sin(t * 1.6) * 4;
  for (const s of [-1, 1]) {limb(c, s * 24, -70, s * 30 + step * s, -12, f('#6a7a8a'), 20);P(c, [[s * 30 - 18, 0], [s * 30 + 18, 0], [s * 30 + 16, -14], [s * 30 - 16, -14]], f(th.body2));}
  P(c, [[-50, -70], [50, -70], [56, -150], [-56, -150]], f(th.body));shine(c, -36, -138, 10, 6);
  c.save();c.translate(0, -110);c.rotate(t * 1.2);for (let i = 0; i < 10; i++) {c.rotate(Math.PI / 5);P(c, [[-5, -32], [5, -32], [5, -24], [-5, -24]], f('#ffd25a'), OUT, 1.2);}
  E(c, 0, 0, 26, 26, f('#ffd25a'), OUT, 2);E(c, 0, 0, 10, 10, f(th.body2));c.restore();
  glowDot(c, 0, -110, 30, `${th.accent}55`);
  for (const s of [-1, 1]) P(c, [[s * 40, -150], [s * 52, -150], [s * 50, -186], [s * 42, -186]], f('#4a4a5a'));
  for (let i = 0; i < 3; i++) {const k = (t * .8 + i / 3) % 1;E(c, -46 + k * 6, -190 - k * 40, 6 + k * 8, 5 + k * 6, `rgba(220,220,230,${.6 * (1 - k)})`, null);}
  P(c, [[-30, -150], [30, -150], [26, -192], [-26, -192]], f('#c8d0d8'));P(c, [[-22, -160], [22, -160], [22, -180], [-22, -180]], f('#1a2a3a'));
  eyes(c, 0, -170, 4, 10, {eye: th.eye}, f, true);
  limb(c, -54, -136, -66, -90, f('#6a7a8a'), 14);E(c, -68, -84, 12, 12, f(th.body2));
  c.save();c.translate(54, -136);c.rotate(-.2 - raise * 2);limb(c, 0, 0, 10, 46, f('#6a7a8a'), 14);c.translate(10, 52);
  P(c, [[-6, 0], [6, 0], [6, 40], [-6, 40]], f('#c8d0d8'));c.beginPath();c.arc(0, 50, 16, Math.PI * 1.25, Math.PI * 1.75 + Math.PI);c.strokeStyle = OUT;c.lineWidth = 12;c.stroke();c.strokeStyle = f('#c8d0d8');c.lineWidth = 8;c.stroke();c.restore();
}

// ---- 13 vampire castle
function batling(c, th, f, t, e) {
  const flap = Math.sin(t * 16) * .6, bob = Math.sin(t * 8) * 3;c.translate(0, -24 + bob);
  for (const s of [-1, 1]) {c.save();c.scale(s, 1);c.rotate(flap * .5);P(c, [[4, 0], [14, -10], [26, -6], [30, 4], [22, 2], [16, 8], [10, 3]], f(th.body2));c.restore();}
  E(c, 0, 0, 10, 9, f(th.body));for (const s of [-1, 1]) P(c, [[s * 3, -6], [s * 8, -15], [s * 9, -5]], f(th.body));shine(c, -4, -4, 2.6, 1.6);
  eyes(c, 1, -1, 1.8, 3.8, th, f);blush(c, 1, 3, 1.6, 6.5);for (const s of [-1, 1]) P(c, [[1 + s * 1.6, 4.4], [1 + s * 1.6, 7], [1 + s * 2.8, 4.4]], '#ffffff', OUT, .6);
}
function pumpkin(c, th, f, t, e) {
  const hot = armed(e, t), bounce = Math.abs(Math.sin(t * 4)) * 3;c.translate(0, -bounce);
  if (e.warn) c.scale(1 + Math.sin(t * 40) * .07, 1 + Math.sin(t * 40) * .07);
  const col = hot ? '#ff5a3a' : f('#ff9a2a');
  for (const [x, r] of [[-8, 9], [8, 9], [0, 11]]) E(c, x, -12, r, 11, col);
  L(c, 0, -23, 2, -29, f('#4a6a2a'), 3);P(c, [[2, -27], [10, -32], [6, -26]], f('#5ab84a'), OUT, 1);shine(c, -9, -17, 2.6, 4, -.3);
  glowDot(c, 0, -10, 14, '#ffd25a66');
  for (const s of [-1, 1]) P(c, [[s * 5 - 3, -15], [s * 5 + 3, -15], [s * 5, -19]], f('#ffe27a'), OUT, 1);
  P(c, [[-7, -8], [7, -8], [5, -4], [2, -6], [-1, -4], [-4, -6], [-6, -4]], f('#ffe27a'), OUT, 1);
  if (hot) glowDot(c, 0, -12, 26, '#ff6a3a66');
}
function skeletonKnight(c, th, f, t, e) {
  const step = Math.sin(t * 5) * 3, bone = f('#f4f0e4');
  for (const s of [-1, 1]) limb(c, s * 6, -18, s * 7 + step * s, -2, bone, 3.6);
  for (let i = 0; i < 4; i++) L(c, -9, -24 - i * 6, 9, -24 - i * 6, bone, 2.6);L(c, 0, -20, 0, -46, bone, 3.6);
  P(c, [[-14, -46], [14, -46], [12, -36], [-12, -36]], f(th.body));
  E(c, 0, -58, 13, 12, bone);for (const s of [-1, 1]) E(c, 1 + s * 5, -58, 3.6, 4, f('#2a1a2a'), null);for (const s of [-1, 1]) E(c, 1 + s * 5, -58, 1.4, 1.4, f(th.accent), null);
  for (let i = -1; i <= 1; i++) L(c, i * 3 + 1, -51, i * 3 + 1, -48, f(OUT), 1.2);
  c.beginPath();c.moveTo(-14, -58);c.quadraticCurveTo(-14, -74, 0, -74);c.quadraticCurveTo(14, -74, 14, -58);c.lineTo(10, -62);c.lineTo(-10, -62);c.closePath();c.fillStyle = f('#6a6a7a');c.fill();c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
  P(c, [[-2, -74], [2, -74], [8, -86 + Math.sin(t * 6) * 2], [-1, -80]], f(th.accent), OUT, 1);
  limb(c, -12, -42, -18, -26, bone, 3);
  swingArm(c, 12, -42, lift(e), bone, 3, () => {L(c, 0, 0, 0, 26, OUT, 5);L(c, 0, 0, 0, 26, f('#c8d0d8'), 3);L(c, -6, 0, 6, 0, f('#8a6a3a'), 3);});
}
function vampireLord(c, th, f, t, raise) {
  const sway = Math.sin(t * 1.4) * 3, open = raise;
  for (const s of [-1, 1]) {c.save();c.scale(s, 1);P(c, [[10, -150], [50 + open * 50, -150 + open * 20], [70 + open * 50, -40], [60 + open * 40, 0], [20, 0]], f('#2a0a1a'));
    P(c, [[14, -146], [44 + open * 44, -140 + open * 20], [56 + open * 44, -40], [24, -6]], f('#9a1a3a'), null);c.restore();}
  P(c, [[-26, 0], [26, 0], [22, -120], [-22, -120]], f(th.body2));
  P(c, [[-6, -120], [6, -120], [4, -60], [-4, -60]], f('#ffffff'));E(c, 0, -100, 4, 4, f('#ff3a5a'), OUT, 1);glowDot(c, 0, -100, 10, '#ff3a5a88');
  for (const s of [-1, 1]) P(c, [[0, -128], [s * 34, -150], [s * 30, -118]], f('#9a1a3a'));
  E(c, 0, -152, 22, 24, f('#f0e4f4'));shine(c, -9, -162, 6, 3.6);
  P(c, [[-24, -158], [-22, -176], [0, -182], [22, -176], [24, -158], [14, -170], [0, -162], [-14, -170]], f('#1a0a1a'));
  eyes(c, 2, -150, 3.8, 8.5, {eye: '#ff3a5a'}, f, true);
  c.beginPath();c.moveTo(-8, -136);c.quadraticCurveTo(2, -132, 12, -136);c.strokeStyle = OUT;c.lineWidth = 2;c.stroke();for (const s of [-1, 1]) P(c, [[2 + s * 4, -135], [2 + s * 4.6, -129], [2 + s * 6, -135]], '#ffffff', OUT, .8);
  for (let i = 0; i < 4; i++) {const a = t * 1.6 + i * 1.57, x = Math.cos(a) * 80, y = -120 + Math.sin(a * 2) * 30;c.save();c.translate(x + sway, y);c.scale(.6, .6);batling(c, {...th, body: '#3a2a4a', body2: '#1a0a2a'}, f, t + i, {id: i});c.restore();}
  if (raise > .3) glowDot(c, 0, -110, 80 * raise, '#ff3a5a44');
}

// ---- 14 sakura spirits
function tanuki(c, th, f, t, e) {
  const run = t * 12, bob = Math.abs(Math.sin(run)) * 2;c.translate(0, -bob);
  for (const [x, ph] of [[-6, 0], [6, Math.PI]]) {const s = Math.sin(run + ph) * 3;limb(c, x, -8, x + s, -1, f('#5a3a2a'), 4);}
  P(c, [[-12, -14], [-24, -20 + Math.sin(t * 8) * 2], [-22, -10]], f('#8a6a4a'));for (let i = 0; i < 2; i++) L(c, -16 - i * 3, -18 + i, -16 - i * 3, -12 + i, f('#3a2a1a'), 2);
  E(c, 0, -14, 13, 10, f('#a88a6a'));E(c, 2, -11, 7, 6, f('#f0e4c8'), null);
  E(c, 8, -24, 10, 9, f('#a88a6a'));for (const dx of [2, 13]) E(c, dx, -32, 3.6, 3.6, f('#5a3a2a'));
  for (const s of [-1, 1]) E(c, 9 + s * 3.6, -24, 3.4, 2.8, f('#3a2a1a'), null);
  eyes(c, 9, -24, 1.4, 3.6, th, f);E(c, 15, -21, 1.4, 1.2, f(OUT), null);blush(c, 9, -20, 1.4, 6);
  P(c, [[4, -34], [14, -40], [10, -32]], f('#5ab84a'), OUT, 1);
}
function lantern(c, th, f, t, e) {
  const hot = armed(e, t), sway = Math.sin(t * 3) * .1;c.translate(0, -20);c.rotate(sway);
  if (e.warn) c.scale(1 + Math.sin(t * 40) * .07, 1 + Math.sin(t * 40) * .07);
  glowDot(c, 0, 0, 24, hot ? '#ff4a3a88' : '#ffb43a55');
  P(c, [[-6, -15], [6, -15], [6, -12], [-6, -12]], f('#2a1a1a'));P(c, [[-6, 15], [6, 15], [6, 12], [-6, 12]], f('#2a1a1a'));
  E(c, 0, 0, 12, 13, hot ? '#ff5a4a' : f('#ff6a5a'));for (const y of [-7, 0, 7]) L(c, -11 + Math.abs(y) * .3, y, 11 - Math.abs(y) * .3, y, f('#c83a3a'), 1);
  shine(c, -5, -5, 2.4, 4, -.2);L(c, 0, 15, 0, 22, f('#ffd25a'), 2);
  eyes(c, 0, -1, 1.5, 4, th, f);blush(c, 0, 3, 1.4, 7);smile(c, 0, 4.5, 2.2, f, true);
}
function oni(c, th, f, t, e) {
  const step = Math.sin(t * 5) * 3, skin = f('#ff6a5a');
  for (const s of [-1, 1]) limb(c, s * 9, -20, s * 10 + step * s, -2, skin, 8);
  P(c, [[-16, -22], [16, -22], [14, -10], [-14, -10]], f('#ffd25a'));for (const x of [-8, 0, 8]) L(c, x, -21, x - 2, -11, f(OUT), 2);
  E(c, 0, -36, 18, 16, skin);E(c, 0, -32, 9, 7, '#ffffff30', null);
  E(c, 0, -60, 15, 14, skin);shine(c, -6, -66, 4, 2.4);
  for (const s of [-1, 1]) P(c, [[s * 6, -72], [s * 10, -86], [s * 12, -70]], f('#fff4dc'), OUT, 1);
  P(c, [[-13, -66], [-6, -76], [0, -68], [6, -76], [13, -66], [8, -70], [0, -64], [-8, -70]], f('#2a1a2a'));
  eyes(c, 2, -59, 2.2, 5, th, f, true);for (const s of [-1, 1]) P(c, [[2 + s * 4, -51], [2 + s * 4.6, -47], [2 + s * 6, -51]], '#ffffff', OUT, .7);
  limb(c, -16, -42, -24, -26, skin, 6);
  swingArm(c, 16, -44, lift(e), skin, 6, () => {L(c, 0, -4, 0, 34, OUT, 11);L(c, 0, -4, 0, 34, f('#8a5a2a'), 8);for (const y of [12, 22, 30]) E(c, 0, y, 2, 2, f('#c8d0d8'), OUT, .8);});
}
function kitsune(c, th, f, t, raise) {
  for (let i = 0; i < 9; i++) {const a = -Math.PI / 2 + (i - 4) * .3 + Math.sin(t * 1.5 + i) * .08 - raise * (i - 4) * .05, L1 = 90 + (i % 2) * 10;
    c.save();c.translate(0, -70);c.rotate(a + Math.PI / 2);
    c.beginPath();c.moveTo(-8, 0);c.quadraticCurveTo(-20, -L1 * .5, -6, -L1);c.quadraticCurveTo(10, -L1 * .6, 8, 0);c.closePath();c.fillStyle = f('#fff0f4');c.fill();c.strokeStyle = OUT;c.lineWidth = LW;c.stroke();
    E(c, -4, -L1 + 12, 6, 10, f(th.body), null);c.restore();}
  P(c, [[-34, 0], [34, 0], [26, -100], [-26, -100]], f('#ffffff'));P(c, [[-34, 0], [-4, 0], [-10, -100], [-26, -100]], f('#c83a5a'));
  L(c, -30, -50, 30, -50, f('#ffd25a'), 6);for (let i = 0; i < 4; i++) E(c, -18 + i * 12, -24, 4, 3, f(th.body), null);
  E(c, 0, -128, 30, 28, f('#fff4f0'));shine(c, -12, -140, 8, 4);
  for (const s of [-1, 1]) {P(c, [[s * 10, -150], [s * 26, -184], [s * 30, -142]], f('#fff4f0'));P(c, [[s * 14, -152], [s * 25, -176], [s * 26, -148]], f(th.body), null);}
  P(c, [[-6, -116], [6, -116], [16, -108], [0, -102], [-16, -108]], f('#fff4f0'), null);E(c, 4, -112, 3, 2.4, f(OUT), null);
  eyes(c, 2, -128, 4.2, 10, {eye: '#ff5a8a'}, f, true);for (const s of [-1, 1]) L(c, 2 + s * 14, -136, 2 + s * 20, -132, f('#ff3a5a'), 2.4);
  for (let i = 0; i < 4; i++) {const a = t * 2 + i * 1.57, x = Math.cos(a) * 64, y = -100 + Math.sin(a) * 26;flame(c, x, y, 7 + raise * 4, 14 + raise * 6, t, i, '#ffe0ff', '#ff6ae0');}
}

// ---- 15 cosmic void
function starSprite(c, th, f, t, e) {
  const hover = Math.sin(t * 4) * 3;c.translate(0, -24 + hover);
  for (let i = 1; i < 4; i++) {c.globalAlpha = .3 / i;star5(c, -i * 6, i * 2, 6 - i, f(th.accent), null);}c.globalAlpha = 1;
  glowDot(c, 0, 0, 18, '#ffe27a66');c.save();c.rotate(Math.sin(t * 3) * .2);star5(c, 0, 0, 13, f('#ffe27a'), OUT, LW);c.restore();shine(c, -4, -5, 2.4, 1.4);
  eyes(c, 0, 0, 1.4, 3.4, th, f);blush(c, 0, 3.6, 1.3, 6);
}
function miniPlanet(c, th, f, t, e) {
  const hot = armed(e, t), hover = Math.sin(t * 3) * 2;c.translate(0, -18 + hover);
  if (e.warn) c.scale(1 + Math.sin(t * 40) * .07, 1 + Math.sin(t * 40) * .07);
  c.beginPath();c.ellipse(0, 0, 19, 5, -.3, Math.PI, Math.PI * 2);c.strokeStyle = OUT;c.lineWidth = 4.4;c.stroke();c.strokeStyle = f('#ffd25a');c.lineWidth = 2.4;c.stroke();
  E(c, 0, 0, 11, 11, hot ? '#ff5a4a' : f(['#5ab4ff', '#ff8ac8', '#7ae0a0'][e.id % 3]));
  for (const [x, y, r] of [[-4, 4, 2.4], [5, -4, 1.6]]) E(c, x, y, r, r, '#00000022', null);shine(c, -4, -5, 3, 1.8);
  c.beginPath();c.ellipse(0, 0, 19, 5, -.3, 0, Math.PI);c.strokeStyle = OUT;c.lineWidth = 4.4;c.stroke();c.strokeStyle = f('#ffd25a');c.lineWidth = 2.4;c.stroke();
  eyes(c, 1, -1, 1.3, 3.4, th, f);blush(c, 1, 3, 1.2, 6);
  if (hot) glowDot(c, 0, 0, 24, '#ff6a3a66');
}
function ufo(c, th, f, t, e) {
  const hover = Math.sin(t * 3) * 3, tilt = Math.sin(t * 2) * .1;c.translate(0, -26 + hover);c.rotate(tilt);
  if (e.warn) {c.globalAlpha = .4;P(c, [[-8, 6], [8, 6], [18, 26], [-18, 26]], '#b8ffe0', null);c.globalAlpha = 1;}
  E(c, 0, -6, 9, 9, f('#b8ffe0'), OUT, LW);E(c, -3, -9, 2.6, 2, '#ffffffc0', null);
  E(c, 0, -5, 5, 5, f('#7ae06a'));for (const s of [-1, 1]) {E(c, s * 2.2, -6, 1.6, 2.2, f('#221c36'), null);E(c, s * 2.2 - .5, -7, .6, .6, '#ffffff', null);}
  E(c, 0, 1, 20, 6, f('#c8d0d8'));E(c, 0, 0, 12, 3, '#ffffff60', null);
  for (let i = 0; i < 5; i++) E(c, -12 + i * 6, 2.4, 1.6, 1.6, (Math.floor(t * 6) + i) % 2 ? '#ffe27a' : '#ff6ad0', null);
}
function starDevourer(c, th, f, t, raise) {
  const coil = t * .8;
  for (let i = 12; i >= 0; i--) {const k = i / 12, a = coil + k * 5, x = Math.cos(a) * (50 - k * 10), y = -40 - k * 20 + Math.sin(a) * 14, r = 26 - k * 10;
    const g = c.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r);g.addColorStop(0, f('#8a7aff'));g.addColorStop(1, f(th.body2));
    E(c, x, y, r, r * .9, g);for (let s = 0; s < 2; s++) E(c, x + Math.cos(i * 3 + s) * r * .5, y + Math.sin(i * 2 + s) * r * .4, 1.2, 1.2, '#ffffffcc', null);}
  for (const s of [-1, 1]) {c.save();c.translate(s * 30, -120);c.scale(s, 1);c.rotate(-.3 - raise * .3 + Math.sin(t * 2) * .1);
    P(c, [[0, 0], [50, -50], [90, -40], [70, -20], [96, -6], [60, 4], [70, 20], [30, 10]], f('#2a1a6a'));for (let i = 0; i < 3; i++) L(c, 10 + i * 20, -4, 40 + i * 20, -36 + i * 8, f('#8a7aff'), 2);c.restore();}
  E(c, 0, -130, 40, 36, f(th.body));shine(c, -16, -150, 10, 5);
  for (const s of [-1, 1]) P(c, [[s * 16, -160], [s * 30, -200], [s * 32, -156]], f('#ffd25a'), OUT, 1.4);
  P(c, [[-30, -116], [30, -116], [44, -102], [0, -88 - raise * 10], [-44, -102]], f(th.body2));
  if (raise > .1) {E(c, 0, -104, 20, 8 + raise * 8, f('#140a2a'));glowDot(c, 0, -104, 30 * raise, '#ffe27a88');}
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(c, [[s * (8 + i * 8), -114], [s * (10 + i * 8), -108], [s * (12 + i * 8), -114]], '#ffffff', OUT, .8);
  eyes(c, 0, -136, 5, 13, th, f, true);
  for (let i = 0; i < 6; i++) {const a = t * .6 + i * 1.05;star5(c, Math.cos(a) * 110, -110 + Math.sin(a) * 50, 5 + (i % 2) * 2, f('#ffe27a'), null);}
  if (raise > .3) glowDot(c, 0, -120, 120 * raise, '#8a7aff44');
}

// Slime toppers for the new worlds (worlds 1-6 keep their own in slime()).
function slimeTopper(c, th, f, t, top) {
  const id = th.id;
  if (id === 'desert') P(c, [[-6, top + 2], [0, top - 8], [6, top + 2]], f('#e8c47a'), OUT, 1);
  else if (id === 'swamp') {E(c, 0, top, 8, 2.6, f('#4ab84a'), OUT, 1);E(c, 3, top - 3, 2.6, 2.6, f('#ff8ac8'), OUT, .8);}
  else if (id === 'sky') for (const [x, r] of [[-3, 3.4], [3, 3.4], [0, 4.2]]) E(c, x, top - 3, r, r * .8, f('#ffffff'), OUT, .8);
  else if (id === 'deepsea') for (const [x, y, r] of [[-2, -4, 2], [2, -9, 1.6], [-1, -13, 1.2]]) E(c, x, top + y, r, r, '#d8f8ffcc', OUT, .6);
  else if (id === 'candy') {L(c, 0, top, 2, top - 6, f('#4a8a3a'), 1.4);E(c, 2, top - 8, 3.4, 3.4, f('#ff3a4a'), OUT, 1);}
  else if (id === 'clockwork') {L(c, 0, top, 0, top - 7, f(OUT), 1.6);E(c, 0, top - 9, 2.4, 2.4, f('#ff4a3a'), OUT, .8);}
  else if (id === 'haunted') for (const s of [-1, 1]) P(c, [[s * 2, top], [s * 9, top - 5], [s * 7, top + 2]], f('#3a2a4a'), OUT, .8);
  else if (id === 'sakura') for (let i = 0; i < 5; i++) {const a = i * 1.257;E(c, Math.cos(a) * 3, top - 3 + Math.sin(a) * 3, 2.4, 2.4, f('#ffc4dc'), OUT, .6);}
  else if (id === 'void') {c.beginPath();c.ellipse(0, top - 2, 8, 2.4, 0, 0, Math.PI * 2);c.strokeStyle = f('#ffd25a');c.lineWidth = 1.6;c.stroke();}
  else P(c, [[0, top - 9], [3, top], [0, top + 2], [-3, top]], f(th.accent), OUT, 1);
}

// Arena props (painted once per arena) for the new worlds.
const NEW_PROPS = {
  desert(c, v) {
    if (v < .6) {for (const [x, y, h] of [[0, 4, 70]]) {c.beginPath();c.moveTo(x - 8, y);c.lineTo(x - 8, -h + 8);c.arc(x, -h + 8, 8, Math.PI, 0);c.lineTo(x + 8, y);c.closePath();c.fillStyle = '#5ab84a';c.fill();c.strokeStyle = OUT;c.lineWidth = 2;c.stroke();}
      for (const s of [-1, 1]) {c.beginPath();c.moveTo(s * 8, -30);c.lineTo(s * 18, -30);c.lineTo(s * 18, -46);c.strokeStyle = OUT;c.lineWidth = 11;c.lineCap = 'round';c.stroke();c.strokeStyle = '#5ab84a';c.lineWidth = 8;c.stroke();}
      L(c, -3, -10, -3, -58, '#8ad86a', 2);}
    else {P(c, [[-34, 4], [0, -48], [34, 4]], '#e8c47a');P(c, [[0, -48], [34, 4], [8, 4]], '#c89a4a', null);for (let i = 1; i < 4; i++) L(c, -34 + i * 8.5, 4 - i * 13, 34 - i * 8.5, 4 - i * 13, '#a8763a80', 1.6);}
  },
  swamp(c, v) {
    if (v < .55) {P(c, [[-6, 4], [-4, -40], [4, -40], [6, 4]], '#5a4a3a');for (const [x, y, a] of [[-4, -36, -.8], [4, -30, .9], [0, -40, -.1]]) {c.save();c.translate(x, y);c.rotate(a);L(c, 0, 0, 0, -22, '#5a4a3a', 4);c.restore();}
      for (const [x, y] of [[-14, -60], [14, -54], [0, -66]]) {L(c, x, y + 10, x, y + 30, '#8aa86a', 1.4);}}
    else {E(c, 0, -14, 16, 6, '#c46bff');P(c, [[-4, -14], [-6, 2], [6, 2], [4, -14]], '#e8e0c8');E(c, 0, -18, 22, 12, '#c46bff');for (const [x, y] of [[-10, -20], [6, -24], [10, -16]]) E(c, x, y, 3, 2.4, '#f0d8ff', null);}
  },
  sky(c, v) {
    if (v < .5) for (const [x, y, r] of [[-18, -6, 16], [16, -6, 18], [0, -18, 20]]) E(c, x, y, r, r * .7, '#ffffff', '#a8c8e8', 2);
    else {P(c, [[-10, 4], [-9, -76], [9, -76], [10, 4]], '#f4fbff');P(c, [[-14, -76], [14, -76], [12, -84], [-12, -84]], '#d8e8f8');for (const x of [-4, 4]) L(c, x, -4, x, -72, '#d8e8f880', 2);glowDot(c, 0, -90, 16, '#ffe27a66');}
  },
  deepsea(c, v) {
    if (v < .55) {const col = ['#ff7a9a', '#ffb43a', '#c46bff'][Math.floor(v * 6) % 3];for (const [x1, y1, x2, y2] of [[0, 4, 0, -40], [0, -20, -16, -44], [0, -26, 14, -52], [-10, -34, -20, -60], [10, -42, 18, -66]]) {L(c, x1, y1, x2, y2, OUT, 9);L(c, x1, y1, x2, y2, col, 6);}}
    else {for (let i = 0; i < 3; i++) {c.beginPath();c.moveTo(-8 + i * 8, 4);c.quadraticCurveTo(-16 + i * 8, -30, -6 + i * 8 + Math.sin(i) * 6, -60 - i * 6);c.strokeStyle = OUT;c.lineWidth = 7;c.stroke();c.strokeStyle = '#3ab86a';c.lineWidth = 4.4;c.stroke();}
      E(c, 18, -2, 9, 6, '#ffe0d0');for (let i = -2; i <= 2; i++) L(c, 18, 3, 18 + i * 3.4, -6, '#d8a890', 1.2);}
  },
  candy(c, v) {
    if (v < .55) {L(c, 0, 4, 0, -50, OUT, 6);L(c, 0, 4, 0, -50, '#ffffff', 4);E(c, 0, -66, 20, 20, '#ff8ac8');for (let i = 0; i < 3; i++) {c.beginPath();c.arc(0, -66, 5 + i * 5, i, i + 4.2);c.strokeStyle = ['#ffffff', '#7ad0ff', '#ffe27a'][i];c.lineWidth = 3.4;c.stroke();}}
    else {c.beginPath();c.moveTo(0, 4);c.lineTo(0, -54);c.arc(-12, -54, 12, 0, Math.PI, true);c.strokeStyle = OUT;c.lineWidth = 11;c.stroke();c.strokeStyle = '#ffffff';c.lineWidth = 8;c.stroke();c.setLineDash([6, 6]);c.strokeStyle = '#ff3a4a';c.stroke();c.setLineDash([]);}
  },
  clockwork(c, v) {
    if (v < .5) {c.save();c.translate(0, -36);for (let i = 0; i < 10; i++) {c.rotate(Math.PI / 5);P(c, [[-5, -34], [5, -34], [5, -26], [-5, -26]], '#c88a3a');}E(c, 0, 0, 28, 28, '#c88a3a');E(c, 0, 0, 10, 10, '#5a4a3a');c.restore();}
    else {P(c, [[-12, 4], [-12, -80], [12, -80], [12, 4]], '#6a5a4a');P(c, [[-16, -80], [16, -80], [16, -88], [-16, -88]], '#4a3a2a');for (const y of [-20, -44, -66]) L(c, -12, y, 12, y, '#c88a3a', 3);for (let i = 0; i < 3; i++) E(c, i * 6 - 4, -100 - i * 16, 8 + i * 4, 6 + i * 3, `rgba(220,220,230,${.5 - i * .12})`, null);}
  },
  haunted(c, v) {
    if (v < .55) {c.beginPath();c.moveTo(-14, 4);c.lineTo(-14, -30);c.arc(0, -30, 14, Math.PI, 0);c.lineTo(14, 4);c.closePath();c.fillStyle = '#8a8a9a';c.fill();c.strokeStyle = OUT;c.lineWidth = 2;c.stroke();L(c, 0, -36, 0, -18, '#5a5a6a', 3);L(c, -6, -30, 6, -30, '#5a5a6a', 3);}
    else {P(c, [[-6, 4], [-4, -60], [4, -60], [6, 4]], '#3a2a3a');for (const [x, y, a] of [[0, -50, -.9], [0, -40, 1], [0, -60, .2]]) {c.save();c.translate(x, y);c.rotate(a);L(c, 0, 0, 0, -26, '#3a2a3a', 4);c.restore();}
      L(c, 14, -44, 14, -34, '#3a2a3a', 1.4);E(c, 14, -30, 4, 5, '#ffb43a', OUT, 1);glowDot(c, 14, -30, 16, '#ffb43a66');}
  },
  sakura(c, v) {
    if (v < .65) {P(c, [[-6, 4], [-4, -50], [4, -50], [6, 4]], '#6a4a3a');for (const [cx, cy, r, col] of [[-22, -60, 24, '#ffb4d0'], [20, -64, 26, '#ffc4dc'], [0, -84, 28, '#ffd4e4'], [-8, -92, 14, '#ffe4ee']]) E(c, cx, cy, r, r * .85, col);
      for (let i = 0; i < 5; i++) E(c, -20 + i * 10, -70 + (i % 2) * 14, 2.4, 2.4, '#ff8ab4', null);}
    else {for (const x of [-26, 26]) P(c, [[x - 4, 4], [x - 4, -66], [x + 4, -66], [x + 4, 4]], '#e83a3a');P(c, [[-40, -66], [40, -66], [44, -76], [-44, -76]], '#e83a3a');P(c, [[-34, -52], [34, -52], [34, -46], [-34, -46]], '#c82a2a');}
  },
  void(c, v) {
    if (v < .5) {const col = ['#5ab4ff', '#ff8ac8', '#7ae0a0'][Math.floor(v * 6) % 3];glowDot(c, 0, -40, 50, `${col}40`);E(c, 0, -40, 24, 24, col);E(c, -8, -48, 8, 5, '#ffffff50', null);c.beginPath();c.ellipse(0, -40, 40, 9, -.3, 0, Math.PI * 2);c.strokeStyle = '#ffd25a';c.lineWidth = 3;c.stroke();}
    else {for (const [dx, h, w] of [[-12, 40, 8], [2, 60, 10], [14, 34, 7]]) P(c, [[dx - w, 4], [dx - w * .6, -h * .7], [dx, -h], [dx + w * .6, -h * .7], [dx + w, 4]], '#8a7aff', '#140a40');star5(c, 2, -70, 8, '#ffe27a');}
  }
};
// Ground decoration clusters for the new worlds.
const NEW_CLUSTERS = {
  desert(c, th, look, x, y, rng) {for (let i = 0; i < 4; i++) {c.beginPath();c.moveTo(x - 40, y + i * 9);c.quadraticCurveTo(x, y - 8 + i * 9, x + 40, y + i * 9);c.strokeStyle = look.pathEdge;c.lineWidth = 2;c.stroke();}if (rng() < .4) E(c, x + 20, y - 4, 8, 4, '#f4f0e4', '#a8a090', 1.2);},
  swamp(c, th, look, x, y, rng) {E(c, x, y, 50, 20, '#3a5a4a', '#2a3a2a', 2);E(c, x - 12, y - 4, 20, 5, '#ffffff20', null);for (let i = 0; i < 3; i++) {const px = x + (rng() - .5) * 60, py = y + (rng() - .5) * 20;E(c, px, py, 9, 4, '#4ab84a', '#2a6a2a', 1.2);}},
  sky(c, th, look, x, y, rng) {for (const [dx, dy, r] of [[-20, 0, 22], [16, 2, 26], [0, -8, 18]]) E(c, x + dx, y + dy, r, r * .45, '#ffffff', '#c4dcf0', 1.6);},
  deepsea(c, th, look, x, y, rng) {for (let i = 0; i < 6; i++) E(c, x + (rng() - .5) * 60, y + (rng() - .5) * 30, 2 + rng() * 4, 2 + rng() * 4, '#d8f8ff70', '#ffffff90', 1);if (rng() < .5) {E(c, x, y + 4, 12, 7, '#ff9a7a', OUT, 1.4);for (let i = -2; i <= 2; i++) L(c, x, y + 9, x + i * 4, y - 1, '#d86a5a', 1);}},
  candy(c, th, look, x, y, rng) {for (let i = 0; i < 14; i++) {const a = rng() * 6.3, d = rng() * 46, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5;c.save();c.translate(px, py);c.rotate(rng() * 3);L(c, -3, 0, 3, 0, ['#ff3a4a', '#7ad0ff', '#ffe27a', '#5ad06a', '#c46bff'][i % 5], 2.4);c.restore();}},
  clockwork(c, th, look, x, y, rng) {c.save();c.translate(x, y);c.scale(1, .5);for (let i = 0; i < 8; i++) {c.rotate(Math.PI / 4);P(c, [[-4, -24], [4, -24], [4, -18], [-4, -18]], '#8a6a3a');}E(c, 0, 0, 20, 20, '#8a6a3a', '#4a3a2a', 2);E(c, 0, 0, 7, 7, look.path, null);c.restore();},
  haunted(c, th, look, x, y, rng) {for (let i = 0; i < 3; i++) {const px = x + (rng() - .5) * 70, py = y + (rng() - .5) * 24;L(c, px - 6, py, px + 6, py - 2, '#e8e4d8', 2.4);E(c, px - 6, py, 2, 2, '#e8e4d8', null);E(c, px + 6, py - 2, 2, 2, '#e8e4d8', null);}if (rng() < .4) glowDot(c, x, y - 10, 20, '#9aff9a30');},
  sakura(c, th, look, x, y, rng) {for (let i = 0; i < 12; i++) {const a = rng() * 6.3, d = rng() * 50, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .5;c.save();c.translate(px, py);c.rotate(rng() * 6);E(c, 0, 0, 3.4, 2, ['#ffb4d0', '#ffd4e4', '#ff8ab4'][i % 3], null);c.restore();}},
  void(c, th, look, x, y, rng) {for (let i = 0; i < 6; i++) {const px = x + (rng() - .5) * 80, py = y + (rng() - .5) * 30;star5(c, px, py, 2 + rng() * 3, ['#ffe27a', '#ffffff', '#b4a8ff'][i % 3], null);}glowDot(c, x, y, 30, '#8a7aff30');}
};
