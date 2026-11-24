// Cutout (paper-doll) knight: separate part pictures (face, eyes, mouth, hair, torso, arms, legs)
// from assets/sprites/heroes/cutout-knight/ placed on a small bone skeleton and posed in code
// every frame. Poses are worked out from the same inputs drawToonHero gets (time, stride,
// attacking, skill pose), so there is no per-hero state and any number of knights can share it.
// The weapon is still the tiered knight weapon from weapons.js, held in the rig's hand.
// Until the pictures are in (or outside a browser) cutoutReady() is false and toon.js keeps
// drawing the old code-drawn knight.
import {drawWeapon} from './weapons.js';

const DIR = '/assets/sprites/heroes/cutout-knight/';
const D = Math.PI / 180;
let rig = null, ready = false, resolveReady;
// Resolves once every part picture is in, so one-shot drawings (class cards, lobby) can redraw.
export const whenCutoutReady = new Promise(r => {resolveReady = r;});
const raster = new Map(); // art name -> canvas at rig.res
const tinted = new Map(); // `${art}|${colour}|${shade}` -> canvas

function load() {
  if (typeof Image === 'undefined' || typeof document === 'undefined' || typeof fetch === 'undefined') return;
  fetch(`${DIR}rig.json`).then(r => r.json()).then(data => {
    rig = data;
    const names = Object.keys(rig.arts);
    let left = names.length;
    for (const name of names) {
      const art = rig.arts[name], [w, h] = rig.frames[art.frame].size, img = new Image();
      img.onload = () => {
        // SVGs are drawn into a canvas at rig.res so they stay sharp when the hero is scaled up.
        const cv = document.createElement('canvas');cv.width = w * rig.res;cv.height = h * rig.res;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        raster.set(name, cv);
        if (--left === 0) {ready = true;resolveReady();}
      };
      img.onerror = () => {left = -1;};
      img.src = `${DIR}${art.file}`;
    }
  }).catch(() => {});
}
load();
export const cutoutReady = () => ready;

// Light-grey parts (hair, cloth, scarf, iris) take their colour by multiplying.
function partCanvas(name, colour, shade = 1) {
  const key = `${name}|${colour}|${shade}`;
  let cv = tinted.get(key);
  if (cv) return cv;
  const src = raster.get(name);
  if (!colour && shade === 1) return src;
  cv = document.createElement('canvas');cv.width = src.width;cv.height = src.height;
  const c = cv.getContext('2d');
  c.drawImage(src, 0, 0);
  c.globalCompositeOperation = 'multiply';
  if (colour) {c.fillStyle = colour;c.fillRect(0, 0, cv.width, cv.height);}
  if (shade !== 1) {const v = Math.round(255 * shade);c.fillStyle = `rgb(${v},${v},${v})`;c.fillRect(0, 0, cv.width, cv.height);}
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(src, 0, 0);
  tinted.set(key, cv);
  return cv;
}

const ease = t => 1 - (1 - t) ** 3;
const SWING = .2; // the knight's basic swing time in model.js
// Where a basic swing is: q runs 0..1 over the swing, k is the eased strike after a short wind-up,
// and consecutive swings alternate between an overhead chop and a rising cut. Without the timer
// (party allies only pass `attacking`), the swing simply loops on the clock.
function swingState(time, swing) {
  const left = swing == null ? SWING - (time % SWING) : Math.min(SWING, swing);
  const q = 1 - left / SWING, start = time - q * SWING;
  return {q, k: q < .2 ? 0 : ease(Math.min(1, (q - .2) / .3)), variant: Math.floor(start / .37) % 2};
}
const lerp = (a, b, t) => a + (b - a) * t;
const REST = {armF: -10, armB: 10, hand: 0};

// Bone angles in degrees (clockwise); positive arm angles swing the hand backwards.
// Arm angles past 180 mean the arm went over the top (a slash), not back down.
// Part of a move: 0 before a, 1 after b, eased in between.
const seg = (q, a, b) => ease(Math.max(0, Math.min(1, (q - a) / (b - a))));
// Arm angle for the blade to point straight along the arm (see weapon(): blade angle = hand bone + 70 - 90).
const OUT = 110;
// A spin: which way the knight faces at turn t (one turn per 1), front-right, front-left, back-left, back-right.
const turnAt = t => [{left: false, back: false}, {left: true, back: false}, {left: true, back: true}, {left: false, back: true}][Math.floor(((t % 1) + 1) % 1 * 4)];
// One move per knight skill. q runs 0..1 over the 0.5 s skill pose; P.fx lists effects drawn around the knight.
const MOVES = {
  // Sword Whirl: two full spins with the blade held straight out and a ring of steel around the body.
  whirl({P, set, q}) {
    const k = Math.sin(q * Math.PI);
    P.turn = turnAt(Math.min(1, q / .9) * 2);
    set('armF', -95, 0, 0);set('hand', OUT);set('armB', 80);P.hips.y -= 2 * k;
    set('legF', -14);set('legB', 14);
    P.fx.push({type: 'ring', y: -34, r: 60, a: k});
  },
  // Dragon Storm: a faster triple spin, crouched low, inside two rings.
  dragonstorm({P, set, q}) {
    const k = Math.sin(q * Math.PI);
    P.turn = turnAt(Math.min(1, q / .95) * 3);
    set('armF', -80);set('hand', OUT);set('armB', 95);P.hips.y += 3 * k;
    set('legF', -24);set('legB', 24);
    P.fx.push({type: 'ring', y: -30, r: 72, a: k}, {type: 'ring', y: -30, r: 50, a: k * .7});
  },
  // Crescent Wave: a huge overhead slash that throws a moon-shaped wave off the blade.
  wave({P, set, lean, q}) {
    const w = seg(q, 0, .25), k = seg(q, .25, .5);
    set('armF', lerp(lerp(-10, 110, w), 290, k));set('hand', lerp(lerp(0, 150, w), 140, k));
    set('armB', lerp(lerp(10, -40, w), 50, k));
    lean(lerp(-10 * w, 20, k), lerp(-3 * w, 8, k));
    set('legF', -30 * k, 4 * k);set('legB', 24 * k);
    if (k > 0) P.smear = {from: 110, to: P.armF.r, k, q: q * .9, R: 80};
    if (q > .45) P.fx.push({type: 'crescent', x: 30 + seg(q, .45, 1) * 70, y: -40, r: 42, a: 1 - seg(q, .6, 1)});
  },
  // Judgement: point the sword at the sky, let it glow, then bring it down on the enemy.
  judgement({P, set, lean, q}) {
    const up = seg(q, 0, .25), down = seg(q, .7, .9);
    set('armF', lerp(lerp(-10, 222, up), 275, down));set('hand', lerp(lerp(0, OUT, up), 140, down));
    set('armB', lerp(10, -150, up) * (1 - down) + 30 * down);
    set('head', -10 * up * (1 - down));P.hips.y -= 4 * up * (1 - down);
    lean(lerp(-4 * up, 14, down), 6 * down);set('legF', -20 * down);set('legB', 16 * down);
    P.weaponBehind = q > .1 && q < .75;
    if (q > .25 && q < .8) P.fx.push({type: 'tipglow', r: 7 + Math.sin(q * 40) * 1.5, a: seg(q, .25, .4)});
    if (down > 0) P.smear = {from: 222, to: P.armF.r, k: down, q: .5 + down * .3, R: 70};
  },
  // Piercing Charge: crouch back, then dash through with the blade thrust out and speed lines behind.
  charge({P, set, lean, q}) {
    const c = seg(q, 0, .2), d = seg(q, .2, .4), r = seg(q, .8, 1);
    const out = d * (1 - r);
    set('armF', lerp(lerp(-10, 60, c), -95, d));set('hand', OUT);set('armB', lerp(10, 75, d));
    P.hips.x = lerp(-5 * c, 18, out);P.hips.y += lerp(3 * c, 1, d);
    lean(lerp(-8 * c, 24, out));set('legF', lerp(-10 * c, -48, out));set('legB', lerp(10 * c, 44, out));
    set('head', 6 * out);
    if (d > 0) P.fx.push({type: 'speed', a: out});
  },
  // Earth Split: jump with the sword overhead in both hands and stab it into the ground.
  quake({P, set, lean, q}) {
    const jump = seg(q, 0, .3), slam = seg(q, .3, .42);
    const air = jump * (1 - slam);
    set('armF', lerp(lerp(-10, 100, jump), -40, slam));set('hand', lerp(lerp(0, 120, jump), 150, slam));
    set('armB', lerp(lerp(10, 100, jump), -40, slam));
    P.hips.y += -18 * air + 5 * slam;lean(lerp(-8 * jump, 22, slam), 6 * slam);
    set('legF', lerp(-30 * air, -36, slam), 0, -4 * air);set('legB', lerp(30 * air, 30, slam), 0, -4 * air);
    if (q > .4) P.fx.push({type: 'shock', r: 20 + seg(q, .4, 1) * 70, a: 1 - seg(q, .55, 1)});
  },
  // Blade Rain: twirl the sword above the head like a beacon while light sparkles fall.
  bladerain({P, set, q, time}) {
    const k = Math.sin(q * Math.PI);
    set('armF', 215);set('hand', OUT + seg(q, .05, .9) * 1080);set('armB', -165);
    P.hips.y -= 5 * Math.abs(Math.sin(q * Math.PI * 2));set('head', -10);
    P.fx.push({type: 'tipglow', r: 6, a: k}, {type: 'sparkles', a: k, t: time});
  },
  // Heaven's Sword: leap up, sword cocked behind the head in both hands, and split the ground.
  heavensword({P, set, lean, q}) {
    const w = seg(q, 0, .32), k = seg(q, .32, .5);
    const air = w * (1 - k);
    set('armF', lerp(lerp(-10, 100, w), 292, k));set('hand', lerp(lerp(0, 120, w), 140, k));
    set('armB', lerp(lerp(10, 100, w), 285, k));
    P.hips.y += -14 * air + 3 * k;lean(lerp(-12 * w, 26, k), 8 * k);
    set('legF', lerp(-26 * air, -38, k), 0, -3 * air);set('legB', lerp(26 * air, 30, k), 0, -3 * air);
    if (k > 0) P.smear = {from: 100, to: P.armF.r, k, q: q * .9, R: 92};
    if (q > .48) P.fx.push({type: 'burst', x: 52, y: -4, r: 16 + seg(q, .48, .8) * 30, a: 1 - seg(q, .6, 1)});
  },
  // World Splitter: crouch with the blade low behind, then rip a giant rising cut that splits the screen.
  worldsplitter({P, set, lean, q}) {
    const w = seg(q, 0, .3), k = seg(q, .3, .5);
    set('armF', lerp(lerp(-10, 55, w), -150, k));set('hand', lerp(lerp(0, 80, w), 80, k));
    set('armB', lerp(lerp(10, 55, w), -140, k));
    P.hips.y += 5 * w * (1 - k) - 8 * k;lean(lerp(16 * w, -14, k), lerp(-4 * w, 8, k));
    set('legF', lerp(-10 * w, -30, k));set('legB', lerp(14 * w, 26, k));set('head', lerp(6 * w, -10, k));
    if (k > 0) P.smear = {from: 55, to: P.armF.r, k, q: q * .9, R: 96};
    if (q > .45) P.fx.push({type: 'streak', a: 1 - seg(q, .55, 1), w: seg(q, .45, .6)});
  }
};

function poseFor({time, moving, phase, attacking, pose, swing}) {
  const P = {};
  const set = (b, r = 0, x = 0, y = 0) => {P[b] = {r, x, y};};
  if (moving) {
    // Chibi patter: twice the cadence of the old sprites (a cycle per 48 world units, about six
    // quick steps a second at run speed) so the short legs nearly keep pace with the ground instead
    // of sliding. Each foot swings forward lifted and sweeps back planted; the body bounces on each
    // passing step, squashes a little as a foot lands, and waddles side to side.
    const p = phase * 2, s = Math.sin(p), bounce = Math.abs(Math.cos(p));
    const step = (name, a) => {
      const fwd = Math.sin(a), lift = Math.max(0, Math.cos(a));
      set(name, -fwd * 16 - lift * 10, fwd * 4, -lift * 6);
    };
    step('legF', p);step('legB', p + Math.PI);
    set('hips', 0, 0, -bounce * 3.2);
    set('torso', 6 + s * 3);set('head', -3 - s * 2.5 - bounce * 1.5);
    set('armF', -8 + s * 5);set('armB', -s * 34 + 4);
    set('tail', 40 + Math.sin(p * 2) * 12);
    P.squash = (1 - bounce) * .9;
  } else {
    const s = Math.sin(time * 2.6);
    set('hips', 0, 0, s * 0.9);set('torso', s * .6);set('head', -s * 1.2);
    set('armF', REST.armF + s * 3);set('armB', REST.armB - s * 3);set('tail', 10 + Math.sin(time * 2.6 + 1) * 6);
  }
  const q = pose ? 1 - pose.life / pose.max : 0, kind = pose?.kind;
  const lean = (r, x = 0) => {P.torso.r += r;P.hips.x = (P.hips.x || 0) + x;};
  // Knight skills each have their own move (MOVES below); other skill poses fall back to their kind.
  if (pose?.skill && MOVES[pose.skill]) {P.fx = [];MOVES[pose.skill]({P, set, lean, q, time});P.skill = pose.skill;return P;}
  if (kind === 'slash') {
    // Wind-up behind, then over the top and down in front.
    const w = q < .3 ? ease(q / .3) : 1, k = q < .3 ? 0 : ease(Math.min(1, (q - .3) / .3));
    set('armF', lerp(lerp(-10, 100, w), 265, k));set('hand', lerp(lerp(0, 150, w), 145, k));
    set('armB', lerp(-25, 35, k));lean(lerp(-8, 14, k), lerp(-3, 7, k));
    set('legF', lerp(-6, -28, k));set('legB', lerp(6, 22, k));
  } else if (kind === 'raise') {
    const k = Math.sin(q * Math.PI);
    set('armF', 205);set('hand', 95);set('armB', -175);P.hips.y -= 4 * k;set('head', -6);
  } else if (kind === 'spin') {
    set('armF', 265);set('hand', 105);set('armB', 90);lean(4);
  } else if (kind === 'thrust') {
    set('armF', 270);set('hand', 110);set('armB', 40);lean(14, 8);set('legF', -30);set('legB', 24);
  } else if (kind === 'recoil') {
    const k = Math.sin(q * Math.PI);
    set('armF', 30 * k - 10);set('armB', 30 * k + 10);lean(-14 * k, -5 * k);set('head', -12 * k);
  } else if (kind === 'hug') {
    const k = Math.sin(q * Math.PI);
    set('armF', -70 - 20 * k);set('hand', 60);set('armB', -60 - 20 * k);lean(10 * k);
  } else if (kind === 'throw') {
    if (q < .5) {set('armF', 150);set('hand', 160);lean(-6);} else {set('armF', 260);set('hand', 120);lean(10, 4);}
  } else if (attacking) {
    const s = swingState(time, swing);
    if (s.variant === 0) {
      // Overhead chop: cock the blade back, then whip it over the top and lunge in.
      const w = ease(Math.min(1, s.q / .2)), k = s.k;
      set('armF', lerp(lerp(-10, 120, w), 282, k));set('hand', lerp(lerp(0, 150, w), 138, k));
      set('armB', lerp(lerp(10, -35, w), 45, k));
      lean(lerp(-9 * w, 18, k), lerp(-3 * w, 8, k));P.hips.y += lerp(1.5 * w, -1.5, k);
      set('legF', lerp(-4 * w, -30, k), lerp(0, 4, k));set('legB', lerp(4 * w, 24, k));
      P.smear = {from: 120, to: P.armF.r, k, q: s.q};
    } else {
      // Rising cut: crouch with the blade low behind, then rip it up through the front.
      const w = ease(Math.min(1, s.q / .2)), k = s.k;
      set('armF', lerp(lerp(-10, 45, w), -150, k));set('hand', lerp(lerp(0, 75, w), 80, k));
      set('armB', lerp(lerp(10, 40, w), -40, k));
      lean(lerp(12 * w, -12, k), lerp(-2 * w, 6, k));P.hips.y += lerp(3 * w, -3.5, k);
      set('legF', lerp(-6 * w, -26, k), lerp(0, 4, k));set('legB', lerp(8 * w, 18, k));
      set('head', lerp(4 * w, -8, k));
      P.smear = {from: 45, to: P.armF.r, k, q: s.q};
    }
  }
  return P;
}

function face({pose, attacking, time, back}) {
  if (back) return {eyes: null, mouth: null};
  const kind = pose?.kind;
  if (pose?.skill && MOVES[pose.skill]) return {eyes: 'focus', mouth: 'open'};
  if (kind === 'recoil') return {eyes: 'wince', mouth: 'open'};
  if (kind === 'raise') return {eyes: 'happy', mouth: 'open'};
  if (kind || attacking) return {eyes: 'focus', mouth: attacking && !kind ? 'open' : 'flat'};
  // Blink for a moment every few seconds.
  return {eyes: (time % 3.4) > 3.28 ? 'closed' : 'round', mouth: 'smile'};
}

// Blade trail: a crescent swept by the sword tip from where the strike began to where the arm is
// now, thickest at the leading edge, fading out over the follow-through.
function smear(c, at, {from, to, k, q, R = 64}, tint) {
  if (k <= 0 || q > .85) return;
  const fade = q < .55 ? 1 : 1 - (q - .55) / .3, n = 16;
  const shape = (outer, inner) => {
    c.beginPath();
    for (let i = 0; i <= n; i++) {const a = (90 + lerp(from, to, i / n)) * D;c.lineTo(at.x + Math.cos(a) * R * outer, at.y + Math.sin(a) * R * outer);}
    for (let i = n; i >= 0; i--) {const t = i / n, a = (90 + lerp(from, to, t)) * D, r = R * (outer - inner * t);c.lineTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);}
    c.closePath();c.fill();
  };
  c.save();
  c.globalAlpha *= .55 * fade;c.fillStyle = tint || '#9fd8ff';shape(1.06, .62);
  c.globalAlpha /= .55;c.globalAlpha *= .9;c.fillStyle = '#ffffff';shape(1, .3);
  c.restore();
}

// Draw the knight with its feet at (0,0) in the caller's space, `size` px per rig unit.
// o: drawToonHero's options plus phase, left, back, colours {hair, cloth, scarf, eyes}.
export function drawCutoutKnight(c, o) {
  const {size, colours, tier = 0, plus = 0, time = 0, attacking = false} = o;
  const P = poseFor(o), f = face(o);
  // A spinning skill turns the knight round: mirror against the facing it started with.
  const left = P.turn ? P.turn.left !== o.left : o.left, back = P.turn ? P.turn.back : o.back;
  if (P.turn && back) {f.eyes = null;f.mouth = null;}
  const world = {};
  for (const [name, parent, bx, by] of rig.bones) {
    const p = P[name] || {r: 0, x: 0, y: 0}, par = parent ? world[parent] : {x: 0, y: 0, r: 0},
      lx = bx + (p.x || 0), ly = by + (p.y || 0), cr = Math.cos(par.r * D), sr = Math.sin(par.r * D);
    world[name] = {x: par.x + lx * cr - ly * sr, y: par.y + lx * sr + ly * cr, r: par.r + (p.r || 0)};
  }
  const looks = {headwear: 'hood', eyes: f.eyes, mouth: f.mouth, weapon: 'sword'};
  c.save();c.scale(left ? -size : size, size);
  // Landing squash: wider and shorter, feet stay on the ground.
  if (P.squash) c.scale(1 + P.squash * .035, 1 - P.squash * .035);
  const part = (name, bone, rot = 0, shade = 1) => {
    const art = rig.arts[name], fr = rig.frames[art.frame], b = world[bone];
    c.save();c.translate(b.x, b.y);c.rotate((b.r + rot) * D);
    c.drawImage(partCanvas(name, art.tint ? colours[art.tint] : null, shade), -fr.pivot[0], -fr.pivot[1], fr.size[0], fr.size[1]);
    c.restore();
  };
  // The knight's own tiered weapon replaces the rig's sword picture.
  const weapon = () => {
    const b = world.hand;
    c.save();c.translate(b.x, b.y);c.rotate((b.r + 70) * D);c.scale(1 / size, 1 / size);
    drawWeapon(c, 'knight', tier, time, {attacking, plus});c.restore();
  };
  if (P.fx) for (const e of P.fx) effect(c, e, world, colours.scarf, true);
  // Headwear: the onesie hood (or plain hair) behind the head, bangs over the face, hood rim and trim on top.
  const hw = rig.slots.headwear[looks.headwear];
  // A sword raised overhead goes behind the big chibi head instead of across the face.
  const behindHead = back || P.weaponBehind;
  if (behindHead) weapon();
  if (!back) part(hw.back, 'head');
  part('sleeve', 'armB', 0, .78);part('hand', 'armB', 0, .86);
  part('leg', 'legB', 0, .78);part('boot', 'legB', 0, .8);
  if (!back) part('scarf-tail', 'tail');
  part('leg', 'legF');part('boot', 'legF');
  part('torso', 'torso');part('belt', 'torso');part('scarf', 'torso');
  part('face', 'head');
  // From behind the hood's back covers its face rim and only the ears stick out.
  if (back) {if (hw.front) part(hw.front, 'head');part(hw.back, 'head');part('scarf-tail', 'tail');}
  else {
    const eyes = rig.slots.eyes[looks.eyes] || {};
    for (const layer of ['base', 'iris', 'shine']) if (eyes[layer]) part(eyes[layer], 'head');
    part(rig.slots.mouth[looks.mouth].art, 'head');
    part(hw.bangs, 'head');
    if (hw.front) part(hw.front, 'head');
    if (hw.trim) part(hw.trim, 'head');
  }
  // The trail follows the arm in world space, so it stays on the blade while the body leans.
  if (P.smear) {const lean = world.armF.r - P.armF.r;smear(c, world.armF, {...P.smear, from: P.smear.from + lean, to: P.smear.to + lean}, colours.scarf);}
  if (!behindHead) weapon();
  part('sleeve', 'armF');part('hand', 'armF');
  if (P.fx) for (const e of P.fx) effect(c, e, world, colours.scarf, false);
  c.restore();
}

// Skill effects in rig space (forward is +x, feet at 0).
// `behind` is the pass drawn before the body: only rings have a part there (their far half).
function effect(c, e, world, tint, behind) {
  if (!(e.a > 0) || (behind && e.type !== 'ring')) return;
  const glow = tint || '#9fd8ff';
  c.save();c.globalAlpha *= Math.min(1, e.a);
  if (e.type === 'ring') {
    // A flattened ring of steel around the body, brighter at the front.
    const [a0, a1] = behind ? [Math.PI, Math.PI * 2] : [0, Math.PI];
    c.lineWidth = 6;c.strokeStyle = glow;c.globalAlpha *= .6;
    c.beginPath();c.ellipse(0, e.y, e.r, e.r * .42, 0, a0, a1);c.stroke();
    c.lineWidth = 2.5;c.strokeStyle = '#ffffff';c.globalAlpha /= behind ? 1.2 : .6;
    c.beginPath();c.ellipse(0, e.y, e.r, e.r * .42, 0, a0, a1);c.stroke();
  } else if (e.type === 'crescent') {
    // The flying moon wave.
    c.translate(e.x, e.y);c.fillStyle = glow;c.globalAlpha *= .7;
    c.beginPath();c.arc(0, 0, e.r, -1.35, 1.35);c.arc(-e.r * .45, 0, e.r * .85, 1.1, -1.1, true);c.closePath();c.fill();
    c.fillStyle = '#ffffff';c.globalAlpha /= .7;
    c.beginPath();c.arc(0, 0, e.r * .92, -1.2, 1.2);c.arc(-e.r * .3, 0, e.r * .8, 1.05, -1.05, true);c.closePath();c.fill();
  } else if (e.type === 'tipglow' || e.type === 'sparkles') {
    // Light gathering at the sword tip (blade angle = hand bone - 20 degrees, about 44 units long).
    const h = world.hand, a = (h.r - 20) * D, x = h.x + Math.cos(a) * 44, y = h.y + Math.sin(a) * 44;
    if (e.type === 'tipglow') {
      const g = c.createRadialGradient(x, y, 0, x, y, e.r * 2);g.addColorStop(0, '#ffffff');g.addColorStop(.35, glow);g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;c.beginPath();c.arc(x, y, e.r * 2, 0, Math.PI * 2);c.fill();
    } else {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) {const sx = x + Math.sin(i * 2.4) * 34, sy = y + ((e.t * 90 + i * 23) % 80);const r = 1.6 + (i % 3);
        c.beginPath();c.moveTo(sx, sy - r * 2);c.lineTo(sx + r * .6, sy);c.lineTo(sx, sy + r * 2);c.lineTo(sx - r * .6, sy);c.closePath();c.fill();}
    }
  } else if (e.type === 'speed') {
    // Speed lines streaming behind the dash.
    c.strokeStyle = '#ffffff';c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {const y = -10 - i * 11, x = -24 - (i % 2) * 12;c.lineWidth = 2.5 - (i % 3) * .5;
      c.beginPath();c.moveTo(x, y);c.lineTo(x - 30 - (i * 7) % 18, y);c.stroke();}
  } else if (e.type === 'shock') {
    // Ground shockwave with cracks.
    c.strokeStyle = glow;c.lineWidth = 5;c.beginPath();c.ellipse(26, 0, e.r, e.r * .32, 0, 0, Math.PI * 2);c.stroke();
    c.strokeStyle = '#3a2a2a';c.lineWidth = 2.4;c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {const a = i / 6 * Math.PI * 2 + .3, l = Math.min(e.r, 40);
      c.beginPath();c.moveTo(26, 0);c.lineTo(26 + Math.cos(a) * l * .5, Math.sin(a) * l * .16 + 2);c.lineTo(26 + Math.cos(a + .2) * l, Math.sin(a + .2) * l * .32);c.stroke();}
  } else if (e.type === 'burst') {
    // Star-shaped impact flash.
    c.translate(e.x, e.y);c.fillStyle = glow;
    c.beginPath();for (let i = 0; i < 16; i++) {const r = i % 2 ? e.r * .4 : e.r, a = i / 16 * Math.PI * 2;c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .7);}c.closePath();c.fill();
    c.fillStyle = '#ffffff';c.beginPath();c.ellipse(0, 0, e.r * .35, e.r * .25, 0, 0, Math.PI * 2);c.fill();
  } else if (e.type === 'streak') {
    // A long diagonal split line across the screen.
    c.translate(10, -40);c.rotate(-.5);const L = 150 * e.w;
    c.fillStyle = glow;c.globalAlpha *= .6;c.beginPath();c.ellipse(0, 0, L, 7, 0, 0, Math.PI * 2);c.fill();
    c.fillStyle = '#ffffff';c.globalAlpha /= .6;c.beginPath();c.ellipse(0, 0, L, 2.6, 0, 0, Math.PI * 2);c.fill();
  }
  c.restore();
}
