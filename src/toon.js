// TILMO's code-drawn cartoon style: hero, monsters and arenas are drawn with canvas paths so
// the whole game shares one look (soft fills, warm dark outlines), class outfits and stage
// themes change instantly, and nothing waits on generated art. Collision sizes and combat
// timing are untouched: this file only draws.
import {ARENA_SIZE, ARENA_HALF, ARENA_POLYGON} from './arena.js';
import {RUN_STRIDE} from './sprite-layout.js';
import {TIERS, drawWeapon} from './weapons.js';

const OUT = '#2b2133';
function E(c, x, y, rx, ry, fill, stroke = OUT, width = 1.4) {
  c.beginPath();c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  if (fill) {c.fillStyle = fill;c.fill();}
  if (stroke) {c.strokeStyle = stroke;c.lineWidth = width;c.stroke();}
}
function P(c, pts, fill, stroke = OUT, width = 1.4) {
  c.beginPath();pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));c.closePath();
  if (fill) {c.fillStyle = fill;c.fill();}
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
const SKIN = '#ffe2c6', SKIN_DARK = '#f0b996';
const OUTFIT = {
  novice: {top: '#8a6a4a', top2: '#5e4630', pants: '#3c3a4f', boots: '#6b4a32', cape: '#d04a58', sleeve: '#8a6a4a'},
  knight: {top: '#3b5f9a', top2: '#24406e', pants: '#2b3550', boots: '#8d9bb0', cape: '#d04a58', sleeve: '#d8e2ee', plate: '#e4ebf3', plate2: '#93a2b8'},
  mage: {top: '#6a4bb0', top2: '#3d2a70', pants: '#2e2450', boots: '#4a3570', cape: '#6a4bb0', sleeve: '#7d5cc4', hat: '#5a3fa0', hat2: '#2f2160'},
  gunner: {top: '#2d8a80', top2: '#185a54', pants: '#3a3428', boots: '#6b4a32', cape: '#2d8a80', sleeve: '#2d8a80', vest: '#8a5a32', hat: '#8a5a32', hat2: '#5a3a20'}
};
const HAIR = {a: ['#f1f4fb', '#9aa6c4'], b: ['#f3e6f0', '#b49ab8']};
export const HERO_TOON_SCALE = 1.45;

export function drawToonHero(c, x, y, o = {}) {
  const {time = 0, moving = false, job = 'novice', appearance = 'a', inv = 0, direction = 'se', distance, attacking = false, tier = 0, pose = null, armor = 0} = o;
  const left = ['sw', 'w', 'nw'].includes(direction), back = ['n', 'ne', 'nw'].includes(direction);
  const phase = moving ? (distance !== undefined ? distance / RUN_STRIDE * Math.PI * 2 : time * 13) : 0;
  const sw = moving ? Math.sin(phase) : 0, bob = moving ? -Math.abs(Math.cos(phase)) * 3 : Math.sin(time * 3) * 1.1;
  const fit = OUTFIT[job] || OUTFIT.novice, accent = job === 'novice' ? '#ffd56a' : (tier === 5 ? '#ffd8f6' : TIERS[tier].color);
  const S = HERO_TOON_SCALE;
  c.save();c.translate(x, y);
  E(c, 0, 1, 22, 7.5, '#10303055', null);
  c.scale(left ? -S : S, S);
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
  const weapon = () => {
    const hx = back ? -15 : ax, hy = back ? (attacking ? -27 : -19) : ay;
    c.save();c.translate(hx, hy);c.scale(1 / S, 1 / S);
    if (wr !== null) c.rotate(wr);
    else if (job === 'gunner') c.rotate(attacking ? -.18 : .05);
    else c.rotate(attacking ? (job === 'mage' ? -.25 : -1.1) : (job === 'mage' ? .08 : .35));
    drawWeapon(c, job, tier, time, {attacking});c.restore();
  };
  if (back) weapon();
  // Cape / coat tails / long hair behind the body (in front of it when seen from behind).
  const behind = () => {
    if (job === 'knight' || job === 'novice') P(c, [[-9, -31], [9, -31], [13 - flutter, -6], [3, -9], [-4, -5], [-14 - flutter, -8]], fit.cape);
    if (job === 'gunner') P(c, [[-11, -18], [11, -18], [13 + flutter * .5, -3], [0, -6], [-13 + flutter * .5, -3]], fit.top2);
    if (appearance === 'b') {P(c, [[-15, -54], [-21, -34], [-17, -18], [-8, -26], [8, -26], [17, -18], [21, -34], [15, -54]], HAIR.b[0], HAIR.b[1]);
      P(c, [[12, -58], [26, -52 + flutter], [30, -36 + flutter], [22, -42], [14, -48]], HAIR.b[0], HAIR.b[1]);}
  };
  if (!back) behind();
  // Legs: alternate lift and swing with the stride.
  for (const s of [-1, 1]) {
    const lift = Math.max(0, s * sw) * 4, fx = s * 5 + s * sw * 4;
    limb(c, s * 5, -14, fx, -3 - lift, fit.pants, 5.5);
    E(c, fx + 1.5, -1.5 - lift, 4.6, 3, fit.boots);
  }
  // Back arm.
  limb(c, -10, -28, bx, by, fit.sleeve, 5);E(c, bx, by + 1, 2.8, 2.8, SKIN);
  if (pk === 'raise') glowDot(c, bx, by, 9, `${accent}cc`);
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
  // Worn armour shows as a coloured collar and shoulder trim.
  if (armor > 0) {const ac = TIERS[armor].color;L(c, -9, -31, 9, -31, OUT, 4.4);L(c, -9, -31, 9, -31, ac, 2.6);for (const sx of [-1, 1]) E(c, sx * 11, -29, 3.4, 2.6, ac, OUT, 1);}
  // Head.
  const fx = back ? 0 : 1.5;
  E(c, 0, -46, 17, 15.5, SKIN);
  const [hair, hairDark] = HAIR[appearance] || HAIR.a;
  if (back) {
    E(c, 0, -48, 17.5, 15.5, hair, hairDark);
    P(c, [[-18, -46], [-19, -56], [-12, -64], [-4, -61], [3, -66], [11, -62], [18, -56], [19, -46], [14, -36], [6, -40], [0, -34], [-6, -40], [-14, -36]], hair, hairDark);
    behind();
  } else {
    // Face: big anime eyes, blush, small mouth.
    for (const s of [-1, 1]) {E(c, fx + s * 6, -44, 3.4, 4.4, '#2b2f4a', null);E(c, fx + s * 6, -43, 2.4, 3, job === 'mage' ? '#7a5ad0' : job === 'gunner' ? '#2a9a8a' : '#3a8cd0', null);E(c, fx + s * 6 - 1, -45.5, 1.1, 1.3, '#fff', null);E(c, fx + s * 9, -39.5, 2.6, 1.2, '#f39a9a80', null);}
    L(c, fx - 1.5, -38.5, fx + 1.5, -38.8, '#a85e62', 1.2);
    // Spiky fringe.
    P(c, [[-18, -46], [-17, -56], [-10, -63], [-3, -60], [3, -64], [10, -61], [17, -56], [18, -46], [13, -51], [8, -47], [4, -53], [-1, -48], [-5, -53], [-10, -48], [-13, -52]], hair, hairDark);
  }
  // Class headgear.
  if (job === 'mage') {
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
    if (!back) for (const gx of [-7, 7]) {E(c, gx, -56, 5, 4, '#ffda80', OUT, 1);E(c, gx, -56, 3.2, 2.5, '#459fc9', null);}
  }
  // Front arm (holds the weapon).
  if (pk === 'raise' || pk === 'thrust') glowDot(c, ax, ay, 10, `${accent}cc`);
  if (!back) {limb(c, 10, -28, ax, ay, fit.sleeve, 5);if (!back) weapon();E(c, ax, ay, 3, 3, SKIN);}
  else limb(c, 10, -28, 14 + sw * 4, -17, fit.sleeve, 5);
  c.restore();
}

// ---------------------------------------------------------------- stage themes
export const THEMES = [
  {id: 'forest', bossName: 'ราชินีหนามพงไพร', ground: '#86b765', ground2: '#76a756', stone: '#c2bc9e', rim: '#8d8a70', edge: '#2f5a36', edge2: '#3f6e40', slime: ['#a6e070', '#5fa83e'], body: '#c0743a', body2: '#7a4420', accent: '#7fd35a', glow: '#d8ff9a', eye: '#2b2133', portal: '#5ef2d8'},
  {id: 'volcano', bossName: 'ยักษ์เพลิงหลอมเหล็ก', ground: '#5a4644', ground2: '#4a3838', stone: '#7a6560', rim: '#3a2a2a', edge: '#1e1416', edge2: '#2e1e1e', slime: ['#ffa04a', '#c4441a'], body: '#d2552a', body2: '#6a1c12', accent: '#ffb03a', glow: '#ffd27a', eye: '#ffe08a', portal: '#ff7a3a'},
  {id: 'ice', bossName: 'อัศวินวิญญาณน้ำแข็ง', ground: '#e6f1fa', ground2: '#cfe2f1', stone: '#b3cce2', rim: '#86a6c6', edge: '#5f82a8', edge2: '#7896bb', slime: ['#c4ecff', '#6ab4e8'], body: '#eef6ff', body2: '#8fb4d8', accent: '#7fd8ff', glow: '#e0f8ff', eye: '#1f6fc0', portal: '#9fe8ff'},
  {id: 'temple', bossName: 'ยักษ์ทองผู้พิทักษ์', ground: '#ecd59f', ground2: '#dcc084', stone: '#cfa45e', rim: '#9a6a2a', edge: '#5a3a1a', edge2: '#7a5226', slime: ['#ffdc70', '#d29a22'], body: '#d49440', body2: '#7a4a1a', accent: '#d23a3a', glow: '#fff0a8', eye: '#2b2133', portal: '#ffd25a'},
  {id: 'moon', bossName: 'จักรพรรดิจันทราดำ', ground: '#423e62', ground2: '#36325a', stone: '#5e5a86', rim: '#2a2648', edge: '#121026', edge2: '#1e1a38', slime: ['#c0b0ff', '#5a48b0'], body: '#4a3f7a', body2: '#1e1840', accent: '#d8dcff', glow: '#d6d0ff', eye: '#e8e4ff', portal: '#b48aff'},
  {id: 'crystal', bossName: 'มังกรคริสตัล', ground: '#34606c', ground2: '#2a505c', stone: '#467882', rim: '#1e3e48', edge: '#0c2228', edge2: '#14323a', slime: ['#88f4e4', '#2aa8a0'], body: '#3a9aa2', body2: '#18484e', accent: '#ff8ad8', glow: '#b0fff2', eye: '#ffe0f4', portal: '#ff8ad8'}
];
export function themeFor(stage = 1) {return THEMES[(Math.max(1, stage) - 1) % THEMES.length];}

// ---------------------------------------------------------------- monsters
function hpBar(c, e, y) {
  if (e.hp >= e.max || e.type === 'boss') return;
  c.fillStyle = '#1e3a38cc';c.fillRect(-18, y, 36, 4);c.fillStyle = '#f2b38a';c.fillRect(-18, y, 36 * Math.max(0, e.hp / e.max), 4);
}
export function drawToonMonster(c, e, time, player) {
  const th = themeFor(e.stage), flash = e.flash > 0, f = col => flash ? '#fff6dc' : col;
  const t = time + e.id * .37, faceLeft = player.x < e.x;
  c.save();c.translate(e.x, e.y);
  E(c, 0, 2, e.r * 1.1, e.r * .38, '#10303045', null);
  if (e.slow > 0) E(c, 0, 0, e.r * 1.35, e.r * .5, '#9fe0ff40', null);
  c.save();if (faceLeft) c.scale(-1, 1);
  if (e.type === 'runner') runner(c, th, f, t, e);
  else if (e.type === 'archer') caster(c, th, f, t, e);
  else if (e.type === 'elite') beast(c, th, f, t, e);
  else if (e.type === 'boss') titan(c, th, f, t, e);
  else slime(c, th, f, t, e);
  c.restore();
  hpBar(c, e, e.type === 'elite' ? -82 : -e.r * 3.4);
  c.restore();
}
function eyes(c, x, y, r, gap, th, f, angry = false) {
  for (const s of [-1, 1]) {E(c, x + s * gap, y, r, r * 1.2, f('#ffffff'), OUT, 1);E(c, x + s * gap + r * .25, y + r * .1, r * .6, r * .75, f(th.eye === '#2b2133' ? '#2b2133' : th.eye), null);
    if (angry) L(c, x + s * gap - r * 1.2, y - r * 1.6 - s * r * .2, x + s * gap + r * 1.1, y - r * 1.3 + s * r * .3, OUT, 1.6);}
}
function slime(c, th, f, t, e) {
  const squish = Math.sin(t * 5) * .08, w = e.r * 1.45 * (1 + squish), h = e.r * 1.25 * (1 - squish);
  c.beginPath();c.moveTo(-w, 0);c.bezierCurveTo(-w * 1.05, -h * 1.3, w * 1.05, -h * 1.3, w, 0);c.closePath();
  const g = c.createLinearGradient(0, -h, 0, 0);g.addColorStop(0, f(th.slime[0]));g.addColorStop(1, f(th.slime[1]));c.fillStyle = g;c.fill();c.strokeStyle = OUT;c.lineWidth = 1.5;c.stroke();
  E(c, -w * .4, -h * .7, w * .22, h * .14, '#ffffff90', null);
  eyes(c, w * .15, -h * .5, 2.6, 5.5, th, f);
  // Theme topper.
  const top = -h * .98;
  if (th.id === 'forest') {L(c, 0, top, 2, top - 7, '#4f8146', 2);E(c, 6, top - 8, 5, 2.6, f('#80b95b'), OUT, 1);}
  else if (th.id === 'volcano') P(c, [[-4, top + 2], [0, top - 9 - Math.sin(t * 9) * 2], [4, top + 2]], f('#ffd27a'), OUT, 1);
  else if (th.id === 'ice') for (const s of [-1, 0, 1]) P(c, [[s * 6 - 2.5, top + 3], [s * 6, top - 6 + Math.abs(s) * 2], [s * 6 + 2.5, top + 3]], f('#ffffff'), '#6a9ac8', 1);
  else if (th.id === 'temple') {E(c, 0, top - 2, 3.5, 3.5, f('#ffd25a'), OUT, 1);}
  else if (th.id === 'moon') {c.beginPath();c.arc(0, top - 4, 4.5, -2.2, 1.2);c.strokeStyle = f('#e8e4ff');c.lineWidth = 2.2;c.stroke();}
  else P(c, [[0, top - 9], [3, top], [0, top + 2], [-3, top]], f(th.accent), OUT, 1);
}
function runner(c, th, f, t, e) {
  const run = t * 14, bob = Math.abs(Math.sin(run)) * 2;
  c.translate(0, -bob);
  if (th.id === 'moon') { // bat
    const flap = Math.sin(t * 16) * .6;
    for (const s of [-1, 1]) {c.save();c.translate(0, -26);c.scale(s, 1);c.rotate(flap * .5);P(c, [[0, 0], [10, -10], [22, -6], [28, 4], [20, 2], [14, 8], [8, 3]], f(th.body2));c.restore();}
    E(c, 0, -26, 9, 8, f(th.body));for (const s of [-1, 1]) P(c, [[s * 3, -32], [s * 7, -40], [s * 8, -31]], f(th.body));
    eyes(c, 2, -27, 2, 3.6, th, f, true);P(c, [[-2, -33], [6, -36], [3, -31]], f(th.accent), OUT, .8);return;
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
  eyes(c, 15, -26, 1.8, 3, th, f, true);
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
  eyes(c, 1, -28, 1.8, 3.2, th, f, true);
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
  if (angry) glowDot(c, 30, -40, 14, '#ff6a5a55');
  // tusks / horns
  P(c, [[36, -26], [46, -20], [40, -25]], f('#fff4dc'), OUT, 1);
  P(c, [[22, -45], [18, -58], [27, -48]], f(th.id === 'temple' ? '#ffd25a' : '#efe6d0'), OUT, 1);
  P(c, [[32, -46], [34, -60], [37, -46]], f(th.id === 'temple' ? '#ffd25a' : '#efe6d0'), OUT, 1);
}
// Each stage's guardian has its own silhouette; `raise` (0..1) lifts the attack during a telegraph.
function titan(c, th, f, t, e) {
  const raise = e.warn ? Math.min(1, (1.1 - e.warn.t) / .6) : 0;
  ({forest: thornQueen, volcano: emberColossus, ice: frostRevenant, temple: goldenYaksha, moon: moonEmperor, crystal: crystalWyrm}[th.id] || emberColossus)(c, th, f, t, raise);
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
  } else {
    const cols = ['#7ff0e0', '#ff8ad8', '#b48aff'], col = cols[Math.floor(v * 3)];
    for (const [dx, h, w] of [[-14, 34, 8], [0, 56, 11], [14, 40, 9]]) P(c, [[dx - w, 4], [dx - w * .7, -h * .75], [dx, -h], [dx + w * .7, -h * .75], [dx + w, 4]], col, '#14323a');
    glowDot(c, 0, -26, 40, `${col}40`);
  }
  c.restore();
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
  // Ground inside the walkable polygon.
  c.beginPath();ARENA_POLYGON.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));c.closePath();
  c.save();c.fillStyle = th.ground;c.fill();c.clip();
  for (let i = 0; i < 220 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE;E(c, x, y, 40 + rng() * 90, 20 + rng() * 40, th.ground2, null);}
  for (let i = 0; i < 130 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE, r = 18 + rng() * 26;E(c, x, y, r, r * .55, th.stone, th.rim, 2);E(c, x - r * .2, y - r * .15, r * .5, r * .2, '#ffffff22', null);}
  for (let i = 0; i < 260 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE;L(c, x, y, x + 2, y - 8, th.ground2, 2.4);L(c, x + 4, y, x + 7, y - 6, th.ground2, 2);}
  const bloom = {forest: ['#fff4c4', '#c9a8ff'], volcano: ['#ff8a3a', '#ffd27a'], ice: ['#ffffff', '#bfe9ff'], temple: ['#ff9ab8', '#ffd25a'], moon: ['#d8dcff', '#b48aff'], crystal: ['#ff8ad8', '#7ff0e0']}[th.id];
  for (let i = 0; i < 600 * AREA; i++) {const x = (rng() - .5) * ARENA_SIZE, y = (rng() - .5) * ARENA_SIZE;if (!inside(x, y) || edgeDistance(x, y) > 120) continue;E(c, x, y, 4, 3, bloom[i % 2], null);E(c, x, y, 1.6, 1.4, '#ffffffaa', null);}
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
