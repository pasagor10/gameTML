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
let rig = null, ready = false;
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
        if (--left === 0) ready = true;
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
const lerp = (a, b, t) => a + (b - a) * t;
const REST = {armF: -10, armB: 10, hand: 0};

// Bone angles in degrees (clockwise); positive arm angles swing the hand backwards.
// Arm angles past 180 mean the arm went over the top (a slash), not back down.
function poseFor({time, moving, phase, attacking, pose}) {
  const P = {};
  const set = (b, r = 0, x = 0, y = 0) => {P[b] = {r, x, y};};
  if (moving) {
    const s = Math.sin(phase);
    set('hips', 0, 0, -Math.abs(Math.cos(phase)) * 3.4);
    set('legF', -s * 34);set('legB', s * 34);
    set('armF', s * 24 - 12);set('armB', -s * 26 + 6);
    set('torso', 6);set('head', -3 + Math.sin(phase * 2) * 1.2);set('tail', 42 + Math.sin(phase * 2) * 9);
  } else {
    const s = Math.sin(time * 2.6);
    set('hips', 0, 0, s * 0.9);set('torso', s * .6);set('head', -s * 1.2);
    set('armF', REST.armF + s * 3);set('armB', REST.armB - s * 3);set('tail', 10 + Math.sin(time * 2.6 + 1) * 6);
  }
  const q = pose ? 1 - pose.life / pose.max : 0, kind = pose?.kind;
  const lean = (r, x = 0) => {P.torso.r += r;P.hips.x = (P.hips.x || 0) + x;};
  if (kind === 'slash') {
    // Wind-up behind, then over the top and down in front.
    const w = q < .3 ? ease(q / .3) : 1, k = q < .3 ? 0 : ease(Math.min(1, (q - .3) / .3));
    set('armF', lerp(lerp(-10, 100, w), 265, k));set('hand', lerp(lerp(0, 150, w), 145, k));
    set('armB', lerp(-25, 35, k));lean(lerp(-8, 14, k), lerp(-3, 7, k));
    set('legF', lerp(-6, -28, k));set('legB', lerp(6, 22, k));
  } else if (kind === 'raise') {
    const k = Math.sin(q * Math.PI);
    set('armF', 175);set('hand', 115);set('armB', -175);P.hips.y -= 4 * k;set('head', -6);
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
    // Basic attack: the follow-through of a slash, with a small shake.
    set('armF', 262 + Math.sin(time * 60) * 3);set('hand', 145);set('armB', 35);lean(12, 6);
    set('legF', -24);set('legB', 18);
  }
  return P;
}

function face({pose, attacking, time, back}) {
  if (back) return {eyes: null, mouth: null};
  const kind = pose?.kind;
  if (kind === 'recoil') return {eyes: 'wince', mouth: 'open'};
  if (kind === 'raise') return {eyes: 'happy', mouth: 'open'};
  if (kind || attacking) return {eyes: 'focus', mouth: 'flat'};
  // Blink for a moment every few seconds.
  return {eyes: (time % 3.4) < .12 ? 'closed' : 'round', mouth: 'smile'};
}

// Draw the knight with its feet at (0,0) in the caller's space, `size` px per rig unit.
// o: drawToonHero's options plus phase, left, back, colours {hair, cloth, scarf, eyes}.
export function drawCutoutKnight(c, o) {
  const {size, left, back, colours, tier = 0, plus = 0, time = 0, attacking = false} = o;
  const P = poseFor(o), f = face(o);
  const world = {};
  for (const [name, parent, bx, by] of rig.bones) {
    const p = P[name] || {r: 0, x: 0, y: 0}, par = parent ? world[parent] : {x: 0, y: 0, r: 0},
      lx = bx + (p.x || 0), ly = by + (p.y || 0), cr = Math.cos(par.r * D), sr = Math.sin(par.r * D);
    world[name] = {x: par.x + lx * cr - ly * sr, y: par.y + lx * sr + ly * cr, r: par.r + (p.r || 0)};
  }
  const looks = {headwear: 'hair', eyes: f.eyes, mouth: f.mouth, weapon: 'sword'};
  c.save();c.scale(left ? -size : size, size);
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
  if (back) weapon();
  if (!back) part('hair-back', 'head');
  part('sleeve', 'armB', 0, .78);part('hand', 'armB', 0, .86);
  part('leg', 'legB', 0, .78);
  if (!back) part('scarf-tail', 'tail');
  part('leg', 'legF');
  part('torso', 'torso');part('belt', 'torso');part('scarf', 'torso');
  part('face', 'head');
  if (back) {part('hair-back', 'head');part('scarf-tail', 'tail');}
  else {
    const eyes = rig.slots.eyes[looks.eyes] || {};
    for (const layer of ['base', 'iris', 'shine']) if (eyes[layer]) part(eyes[layer], 'head');
    part(rig.slots.mouth[looks.mouth].art, 'head');
    part('hair-front', 'head');
  }
  if (!back) weapon();
  part('sleeve', 'armF');part('hand', 'armF');
  c.restore();
}
