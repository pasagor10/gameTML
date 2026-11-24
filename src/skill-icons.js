// Cartoon skill icons drawn as inline SVG (64×64), same look as ui-icons.js:
// thick dark-brown outline, glossy gradients, white shine, a soft themed background per class.
const O = '#2a1606';
const W = 3; // outline width
let uid = 0;

const PAL = {
  gold: [[0, '#fff7c4'], [.45, '#ffcf3a'], [1, '#b8700a']],
  silver: [[0, '#ffffff'], [.5, '#d3dcea'], [1, '#7a88a2']],
  fire: [[0, '#fff6a8'], [.4, '#ffa21f'], [1, '#d8360a']],
  ice: [[0, '#ffffff'], [.45, '#a6ecff'], [1, '#2d8ad6']],
  violet: [[0, '#f6e2ff'], [.45, '#b66cff'], [1, '#5320a2']],
  green: [[0, '#f0ffc8'], [.45, '#7ed64c'], [1, '#2c751c']],
  red: [[0, '#ffc2c2'], [.45, '#f2384c'], [1, '#86081f']],
  blue: [[0, '#e0f4ff'], [.45, '#4fb2ff'], [1, '#1d55b4']],
  pink: [[0, '#fff2f8'], [.45, '#ff9cca'], [1, '#c43a7c']],
  teal: [[0, '#eafffa'], [.45, '#4fe2c2'], [1, '#148676']],
  brown: [[0, '#f4d29c'], [.5, '#b8763a'], [1, '#673812']],
  dark: [[0, '#8e7ea6'], [.5, '#40305a'], [1, '#150d22']],
  holy: [[0, '#ffffff'], [.55, '#fff3c8'], [1, '#e7b84e']],
  poison: [[0, '#f4ffd4'], [.45, '#a4e44c'], [1, '#467818']],
  steel: [[0, '#f2f6fb'], [.5, '#a9b6c8'], [1, '#55627a']],
  orange: [[0, '#fff0c8'], [.45, '#ffa64a'], [1, '#c4561a']],
  white: [[0, '#ffffff'], [.6, '#eef6ff'], [1, '#b9cbe0']],
};
const THEME = {
  general: ['#f2fbff', '#86bde6'], knight: ['#e2efff', '#5f8ccb'], mage: ['#f1e4ff', '#7553c2'], gunner: ['#fff0d6', '#d78a46'],
  archer: ['#e6fadb', '#57a45a'], drunkard: ['#fff3d0', '#d99a2e'], assassin: ['#efdcf7', '#64357f'], cleric: ['#fffdf0', '#f0b9cc'], god: ['#fff6d2', '#e09a2a'],
};

// Context: collects gradient defs so every icon instance gets unique ids.
function ctx() {
  const g = `sk${uid++}`;let n = 0, defs = '';
  const add = (type, stops, a = .35, b = .3) => {
    const id = `${g}${n++}`;const s = (stops || PAL.silver).map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
    defs += type === 'r' ? `<radialGradient id="${id}" cx="${a}" cy="${b}" r=".85">${s}</radialGradient>` : `<linearGradient id="${id}" x1="0" y1="0" x2="${a}" y2="${b}">${s}</linearGradient>`;
    return `url(#${id})`;
  };
  return {r: (p, cx, cy) => add('r', typeof p === 'string' ? PAL[p] : p, cx, cy), l: (p, x2 = 0, y2 = 1) => add('l', typeof p === 'string' ? PAL[p] : p, x2, y2), get defs() {return defs;}};
}
const ol = `stroke="${O}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round"`;
const shine = (x, y, rx, ry, rot = -25, op = .6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;
const tf = (x, y, a = 0, s = 1) => `transform="translate(${x} ${y}) rotate(${a}) scale(${s})"`;
// A thick coloured stroke with an outline around it (for swirls, beams, trails).
const rope = (d, color, w = 5, op = 1) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + W * 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const glowLine = (d, color, w = 4, op = .55) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
const spark = (x, y, s = 1, color = '#fff') => `<path ${tf(x, y, 0, s)} d="M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6z" fill="${color}"/>`;
const sparks = (list, color) => list.map(([x, y, s]) => spark(x, y, s, color)).join('');

// --- Shapes (drawn around 0,0 then placed with tf) -------------------------------------------
const sword = (c, x, y, a = 0, s = 1, blade = 'silver', hilt = 'gold') => `<g ${tf(x, y, a, s)}>
  <path d="M0-30 6-22V8H-6V-22z" fill="${c.l(blade, 1, 0)}" ${ol}/><path d="M0-27V5" stroke="#fff" stroke-width="1.6" opacity=".7"/>
  <rect x="-12" y="7" width="24" height="6" rx="3" fill="${c.l(hilt)}" ${ol}/><rect x="-3.5" y="13" width="7" height="11" rx="2" fill="#7a3f1a" ${ol}/>
  <circle cx="0" cy="27" r="4.5" fill="${c.r(hilt)}" ${ol}/></g>`;
const dagger = (c, x, y, a = 0, s = 1, blade = 'silver', hilt = 'dark') => `<g ${tf(x, y, a, s)}>
  <path d="M0-20C6-14 6-6 5 2H-5C-6-6-4-14 0-20z" fill="${c.l(blade, 1, 0)}" ${ol}/><path d="M0-17V0" stroke="#fff" stroke-width="1.4" opacity=".7"/>
  <rect x="-9" y="2" width="18" height="5" rx="2.5" fill="${c.l(hilt)}" ${ol}/><rect x="-3" y="7" width="6" height="9" rx="2" fill="#3a2540" ${ol}/></g>`;
const arrow = (c, x, y, a = 0, s = 1, head = 'silver', fl = 'green') => `<g ${tf(x, y, a, s)}>
  <path d="M0 26V-14" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M0 26V-14" stroke="#c98a4a" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M0-28 7-14H-7z" fill="${c.l(head, 1, 0)}" ${ol}/>
  <path d="M0 14-7 20V28L0 22zM0 14 7 20V28L0 22z" fill="${c.l(fl)}" ${ol}/></g>`;
const bolt = (c, x, y, a = 0, s = 1, p = 'gold') => `<path ${tf(x, y, a, s)} d="M4-26-12 2H0L-6 26 14-6H2L10-26z" fill="${c.l(p, 1, 1)}" ${ol}/>`;
const flame = (c, x, y, s = 1, p = 'fire') => `<g ${tf(x, y, 0, s)}><path d="M0-24C8-14 16-8 14 6 12 16 6 20 0 20S-12 16-14 6C-15-4-8-8-6-16-2-10 0-12 0-24z" fill="${c.r(p, .5, .7)}" ${ol}/>
  <path d="M0-2C4 2 6 6 5 11 4 15 2 16 0 16S-4 15-5 11C-6 6-2 4 0-2z" fill="#fff6b0"/></g>`;
const ball = (c, x, y, r, p, sh = true) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.r(p)}" ${ol}/>${sh ? shine(x - r * .35, y - r * .4, r * .38, r * .2) : ''}`;
const heart = (c, x, y, s = 1, p = 'red') => `<g ${tf(x, y, 0, s)}><path d="M0 20C-26 4-22-18-8-18-3-18 0-14 0-11 0-14 3-18 8-18 22-18 26 4 0 20z" fill="${c.r(p)}" ${ol}/>${shine(-9, -10, 6, 3.5)}</g>`;
const starPath = (n, R, r) => {let d = '';for (let i = 0; i < n * 2; i++) {const a = Math.PI * i / n - Math.PI / 2, q = i % 2 ? r : R;d += `${i ? 'L' : 'M'}${(Math.cos(a) * q).toFixed(1)} ${(Math.sin(a) * q).toFixed(1)}`;}return d + 'z';};
const star = (c, x, y, R, n = 5, p = 'gold', a = 0) => `<path ${tf(x, y, a)} d="${starPath(n, R, R * .48)}" fill="${c.r(p)}" ${ol}/>`;
const shield = (c, x, y, s = 1, p = 'steel', core = 'gold') => `<g ${tf(x, y, 0, s)}><path d="M0-24 20-16C20 4 14 16 0 24-14 16-20 4-20-16z" fill="${c.l(p, 1, 1)}" ${ol}/>
  <path d="M0-17 13-12C13 2 9 10 0 16-9 10-13 2-13-12z" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".55"/>${core ? `<circle cx="0" cy="-1" r="7" fill="${c.r(core)}" ${ol}/>` : ''}${shine(-9, -12, 5, 2.5, -30)}</g>`;
const cloud = (c, x, y, s = 1, p = 'white') => `<path ${tf(x, y, 0, s)} d="M-18 8C-26 8-26-4-18-4-18-14-4-16 0-8 4-16 18-14 16-2 26-2 26 8 18 8z" fill="${c.r(p, .4, .2)}" ${ol}/>`;
const gem = (c, x, y, s = 1, p = 'ice') => `<g ${tf(x, y, 0, s)}><path d="M-12-6-6-14H6L12-6 0 16z" fill="${c.l(p, 1, 1)}" ${ol}/><path d="M-12-6H12M-6-14-3-6 0 16 3-6 6-14" fill="none" stroke="#fff" stroke-width="1.2" opacity=".6"/></g>`;
const eye = (c, x, y, s = 1, iris = 'blue') => `<g ${tf(x, y, 0, s)}><path d="M-22 0C-12-14 12-14 22 0 12 14-12 14-22 0z" fill="#fffdf6" ${ol}/><circle r="9" fill="${c.r(iris)}" ${ol}/><circle r="4" fill="${O}"/><circle cx="-3" cy="-3" r="2.2" fill="#fff"/></g>`;
const skull = (c, x, y, s = 1, p = 'white', eyes = '#7dff6a') => `<g ${tf(x, y, 0, s)}><path d="M0-18C-12-18-18-10-18-1-18 5-15 8-11 10V16H11V10C15 8 18 5 18-1 18-10 12-18 0-18z" fill="${c.r(p)}" ${ol}/>
  <ellipse cx="-7" cy="0" rx="5" ry="5.5" fill="#2a1630"/><ellipse cx="7" cy="0" rx="5" ry="5.5" fill="#2a1630"/><circle cx="-6" cy="-1" r="1.8" fill="${eyes}"/><circle cx="8" cy="-1" r="1.8" fill="${eyes}"/>
  <path d="M0 6-2.5 10H2.5z" fill="#2a1630"/><path d="M-5 13V17M0 13V17M5 13V17" stroke="#8d7e99" stroke-width="1.6"/></g>`;
const wing = (c, x, y, s = 1, flip = false, p = 'white') => `<g ${tf(x, y, 0, s)}><g transform="scale(${flip ? -1 : 1} 1)"><path d="M0 0C6-14 18-20 30-18 26-14 28-12 24-10 28-8 26-5 21-4 24-1 20 2 14 2 10 6 4 6 0 0z" fill="${c.l(p, 1, 1)}" ${ol}/>
  <path d="M8 0C14-4 20-6 24-10M8 3C13 0 18-1 21-4" fill="none" stroke="#c9b48a" stroke-width="1.4"/></g></g>`;
const swirl = (cx, cy, r, color, turns = 1.6, w = 5) => {let d = '';const steps = 40;for (let i = 0; i <= steps; i++) {const t = i / steps, a = t * turns * Math.PI * 2, q = r * (1 - t * .85);d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * q).toFixed(1)} ${(cy + Math.sin(a) * q).toFixed(1)}`;}return rope(d, color, w);};
const ringArc = (cx, cy, r, color, w = 5, from = -40, to = 280) => {const p = a => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r].map(v => v.toFixed(1));const [x1, y1] = p(from), [x2, y2] = p(to);return rope(`M${x1} ${y1}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`, color, w);};
const rays = (cx, cy, r1, r2, n, color, w = 3, op = .85, rot = 0) => Array.from({length: n}, (_, i) => {const a = (i / n * 360 + rot) * Math.PI / 180;return `<path d="M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;}).join('');
const speed = (list, color = '#ffffff', op = .8) => list.map(([x1, y1, x2, y2, w = 3]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`).join('');
const snowflake = (x, y, s = 1, color = '#fff') => `<g ${tf(x, y, 0, s)} stroke="${color}" stroke-width="2.2" stroke-linecap="round">${[0, 60, 120].map(a => `<path transform="rotate(${a})" d="M0-7V7M-2.5-5 0-3 2.5-5M-2.5 5 0 3 2.5 5"/>`).join('')}</g>`;
const bullet = (c, x, y, a = 0, s = 1) => `<g ${tf(x, y, a, s)}><path d="M-4 8V-2C-4-8 0-12 0-12S4-8 4-2V8z" fill="${c.l('gold', 1, 0)}" ${ol}/><rect x="-4.5" y="6" width="9" height="5" rx="1" fill="${c.l('brown')}" ${ol}/></g>`;
const rocket = (c, x, y, a = 0, s = 1, body = 'red') => `<g ${tf(x, y, a, s)}><path d="M-5 16C-10 22-6 30 0 34 6 30 10 22 5 16z" fill="${c.r('fire', .5, .2)}" ${ol}/>
  <path d="M-8 6-16 18-8 16zM8 6 16 18 8 16z" fill="${c.l('steel')}" ${ol}/><path d="M0-24C8-16 9-4 8 16H-8C-9-4-8-16 0-24z" fill="${c.l(body, 1, 0)}" ${ol}/>
  <circle cx="0" cy="-4" r="4" fill="${c.r('ice')}" ${ol}/>${shine(-4, -14, 2.2, 5, 15)}</g>`;
const book = (c, x, y, s = 1, p = 'red') => `<g ${tf(x, y, 0, s)}><path d="M-24-12C-14-16-6-14 0-10 6-14 14-16 24-12V14C14 10 6 12 0 16-6 12-14 10-24 14z" fill="#fffaf0" ${ol}/>
  <path d="M0-10V16" stroke="${O}" stroke-width="2"/><path d="M-19-6C-12-8-7-7-4-5M-19 0C-12-2-7-1-4 1M19-6C12-8 7-7 4-5M19 0C12-2 7-1 4 1" stroke="#c9b48a" stroke-width="1.5" fill="none"/>
  <path d="M-24 14C-14 10-6 12 0 16 6 12 14 10 24 14V18C14 14 6 16 0 20-6 16-14 14-24 18z" fill="${c.l(p)}" ${ol}/></g>`;
const feather = (c, x, y, a = 0, s = 1, p = 'white') => `<g ${tf(x, y, a, s)}><path d="M0-22C10-14 10 4 2 14L0 22-2 14C-10 4-10-14 0-22z" fill="${c.l(p, 1, 0)}" ${ol}/><path d="M0-18V22" stroke="#b9a37a" stroke-width="1.6"/></g>`;
const cross = (c, x, y, s = 1, p = 'holy') => `<path ${tf(x, y, 0, s)} d="M-5-24H5V-10H18V0H5V24H-5V0H-18V-10H-5z" fill="${c.l(p, 1, 1)}" ${ol}/>`;
const sun = (c, x, y, r, p = 'gold', n = 12) => `${rays(x, y, r + 3, r + 11, n, '#fff2a8', 4, .9)}${ball(c, x, y, r, p)}`;
const crown = (c, x, y, s = 1, p = 'gold') => `<g ${tf(x, y, 0, s)}><path d="M-18 8-20-10-10-2 0-14 10-2 20-10 18 8z" fill="${c.l(p)}" ${ol}/><circle cx="0" cy="2" r="3.5" fill="${c.r('red')}" ${ol}/></g>`;
const bow = (c, x, y, a = 0, s = 1, p = 'brown') => `<g ${tf(x, y, a, s)}><path d="M-4-26C14-18 14 18-4 26" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M-4-26C14-18 14 18-4 26" fill="none" stroke="${c.l(p, 1, 0)}" stroke-width="5" stroke-linecap="round"/>
  <path d="M-4-26V26" stroke="#fff6dc" stroke-width="1.6"/></g>`;
const thorn = (c, d, p = 'green') => `${rope(d, '#5aa83a', 5)}`;
const planet = (c, x, y, r, p = 'blue') => `${ball(c, x, y, r, p)}<path d="M${x - r * .6} ${y - r * .1}c${r * .3} ${r * .2} ${r * .5} 0 ${r * .7} ${r * .3}M${x - r * .2} ${y + r * .5}c${r * .2} -${r * .2} ${r * .5} -${r * .1} ${r * .6} 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".5"/>`;
const drop = (c, x, y, s = 1, p = 'red') => `<path ${tf(x, y, 0, s)} d="M0-10C4-4 7 0 7 4A7 7 0 0 1-7 4C-7 0-4-4 0-10z" fill="${c.r(p)}" ${ol}/>`;
const mist = (c, x, y, s = 1, p = 'poison') => `<path ${tf(x, y, 0, s)} d="M-22 10C-30 8-28-4-20-4-22-14-8-18-2-10 2-20 18-18 18-6 28-6 30 8 20 10z" fill="${c.r(p, .4, .3)}" ${ol}/>`;
const vine = d => `${rope(d, '#4f9e34', 6)}`;
const spikes = (pts, color = '#e9f7c8') => pts.map(([x, y, a]) => `<path ${tf(x, y, a)} d="M-3 0 0-8 3 0z" fill="${color}" ${ol} stroke-width="2"/>`).join('');

const fist = (c, x, y, s = 1, p = 'gold', a = 0) => `<g ${tf(x, y, a, s)}><rect x="-15" y="-8" width="30" height="24" rx="8" fill="${c.l(p, 1, 1)}" ${ol}/>${[-10.5, -3.5, 3.5, 10.5].map(k => `<circle cx="${k}" cy="-8" r="4.6" fill="${c.r(p)}" ${ol}/>`).join('')}
  <path d="M-15 4C-6 2 2 4 6 8" fill="none" ${ol}/><rect x="-11" y="16" width="22" height="9" rx="3" fill="${c.l('brown')}" ${ol}/>${shine(-8, -9, 3, 1.6)}</g>`;
const dragon = (c, d, hx, hy, ha = 0, color = '#5fd06a', s = 1) => `${rope(d, color, 9 * s)}<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${2 * s}" stroke-dasharray="1 6" stroke-linecap="round" opacity=".7"/>
  <g ${tf(hx, hy, ha, s)}><path d="M-4-8 4-16 6-6M-8-6-10-16-2-8" fill="#fff3c0" ${ol} stroke-width="2"/><ellipse rx="10" ry="8" fill="${color}" ${ol}/><path d="M6 2 14 4 6 6" fill="${color}" ${ol} stroke-width="2"/><circle cx="2" cy="-2" r="2.4" fill="#fff"/><circle cx="2.6" cy="-2" r="1.3" fill="${O}"/></g>`;

const pistol = (c, x, y, a = 0, s = 1, body = 'steel') => `<g ${tf(x, y, a, s)}><rect x="-6" y="-12" width="30" height="10" rx="3" fill="${c.l(body, 0, 1)}" ${ol}/><rect x="-14" y="-14" width="14" height="14" rx="4" fill="${c.l('dark', 0, 1)}" ${ol}/>
  <path d="M-14 -2H0L-2 18C-2 22-14 22-14 16z" fill="${c.l('brown', 1, 0)}" ${ol}/><path d="M0 0C6 0 6 8 0 8" fill="none" ${ol} stroke-width="2.5"/>${shine(4, -9, 6, 1.5, 0)}</g>`;
const blunder = (c, x, y, a = 0, s = 1) => `<g ${tf(x, y, a, s)}><path d="M-26 6-8-2H4V8H-8L-24 16z" fill="${c.l('brown', 1, 1)}" ${ol}/><path d="M2-4H18L28-10V16L18 10H2z" fill="${c.l('gold', 0, 1)}" ${ol}/><path d="M6-4V10M12-4V10" stroke="#a8640a" stroke-width="2"/>${shine(12, -1, 6, 1.5, 0)}</g>`;
const satellite = (c, x, y, a = 0, s = 1) => `<g ${tf(x, y, a, s)}><rect x="-24" y="-6" width="16" height="12" rx="1.5" fill="${c.l('blue', 1, 1)}" ${ol}/><rect x="8" y="-6" width="16" height="12" rx="1.5" fill="${c.l('blue', 1, 1)}" ${ol}/><path d="M-20-6V6M-14-6V6M12-6V6M18-6V6" stroke="#bfe6ff" stroke-width="1.4"/>
  <rect x="-8" y="-9" width="16" height="18" rx="4" fill="${c.l('steel', 1, 1)}" ${ol}/><path d="M-5 9 0 16 5 9z" fill="${c.l('steel')}" ${ol}/><circle cx="0" cy="-1" r="3" fill="${c.r('ice')}" ${ol} stroke-width="2"/></g>`;

const mug = (c, x, y, a = 0, s = 1) => `<g ${tf(x, y, a, s)}><path d="M12-8H18C24-8 24 10 18 10H12" fill="none" stroke="${O}" stroke-width="8"/><path d="M12-8H18C24-8 24 10 18 10H12" fill="none" stroke="#e8f4ff" stroke-width="3.5"/>
  <rect x="-14" y="-12" width="28" height="32" rx="4" fill="${c.l('gold', 1, 0)}" ${ol}/><path d="M-7-6V14M0-6V14M7-6V14" stroke="#fff6c0" stroke-width="2" opacity=".7"/>
  <path d="M-17-10C-20-18-12-24-6-20-2-26 8-26 10-19 18-22 22-14 16-9z" fill="#fffdf4" ${ol}/>${shine(-8, -17, 4, 2)}</g>`;
const bottle = (c, x, y, a = 0, s = 1) => `<g ${tf(x, y, a, s)}><path d="M-3-22H3V-12C9-8 9-4 9 4V18C9 21 7 22 4 22H-4C-7 22-9 21-9 18V4C-9-4-9-8-3-12z" fill="${c.l([[0, '#c6f0b0'], [.5, '#4fa83a'], [1, '#1f5a1a']], 1, 0)}" ${ol}/><rect x="-4" y="-26" width="8" height="5" rx="1.5" fill="${c.l('gold')}" ${ol} stroke-width="2"/><rect x="-7" y="2" width="14" height="9" rx="2" fill="#fff3d0" ${ol} stroke-width="2"/>${shine(-4, -4, 2, 6, 0)}</g>`;
const keg = (c, x, y, s = 1) => `<g ${tf(x, y, 0, s)}><path d="M-16-18C-20-6-20 6-16 18H16C20 6 20-6 16-18z" fill="${c.l('brown', 1, 0)}" ${ol}/><path d="M-18-9H18M-18 9H18" stroke="${O}" stroke-width="4"/><path d="M-18-9H18M-18 9H18" stroke="#c9ced8" stroke-width="2"/><rect x="-4" y="-3" width="8" height="6" rx="1" fill="${c.l('gold')}" ${ol} stroke-width="2"/>${shine(-9, -12, 2.5, 5, 0)}</g>`;
const foam = (c, x, y, s = 1) => `<path ${tf(x, y, 0, s)} d="M-14 4C-20 4-20-6-12-6-12-14 0-14 2-8 6-14 16-12 14-4 20-2 18 6 12 6z" fill="#fffdf4" ${ol}/>`;
const beerD = (c, d, w = 7) => rope(d, '#ffc02e', w);

// --- The icons -------------------------------------------------------------------------------
const ICONS = {
  // general
  fire: c => `${ringArc(32, 33, 18, '#ffb43a', 4, 0, 359)}${[0, 72, 144, 216, 288].map(a => {const x = 32 + Math.cos(a * Math.PI / 180) * 18, y = 33 + Math.sin(a * Math.PI / 180) * 18;return flame(c, x, y, .42);}).join('')}${ball(c, 32, 33, 7, 'fire')}`,
  ice: c => `${speed([[8, 50, 18, 40, 3], [14, 56, 22, 48, 2]], '#e6fbff')}<g ${tf(33, 30, 45)}><path d="M0-28 8-12 4 24H-4L-8-12z" fill="${c.l('ice', 1, 0)}" ${ol}/><path d="M0-24V20" stroke="#fff" stroke-width="1.8" opacity=".8"/><path d="M-12 14 12 14 8 20H-8z" fill="${c.l('steel')}" ${ol}/></g>${sparks([[50, 14, .8], [14, 18, .6], [52, 46, .5]])}`,
  spark: c => `${bolt(c, 34, 32, 8, 1, 'violet')}${ball(c, 12, 14, 4.5, 'violet')}${ball(c, 54, 18, 4, 'violet')}${ball(c, 50, 52, 4.5, 'violet')}${glowLine('M12 14L24 20M44 22L54 18M42 46L50 52', '#f0d4ff', 2.5, .9)}${sparks([[20, 48, .6], [56, 34, .5]])}`,
  gust: c => `${swirl(30, 32, 22, '#9ff0c6', 1.4, 5)}${speed([[6, 22, 20, 22], [4, 44, 16, 44]], '#ffffff')}<path ${tf(50, 16, 30)} d="M0-7C6-4 6 4 0 7-6 4-6-4 0-7z" fill="${c.l('green')}" ${ol} stroke-width="2"/><path ${tf(46, 50, -20, .8)} d="M0-7C6-4 6 4 0 7-6 4-6-4 0-7z" fill="${c.l('green')}" ${ol} stroke-width="2"/>`,
  area: c => `<circle cx="32" cy="34" r="26" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="5 5" opacity=".9"/>${heart(c, 32, 33, 1.05, 'red')}${sparks([[10, 12, .6], [54, 14, .7]])}`,
  haste: c => `${speed([[4, 30, 16, 30], [2, 40, 14, 40], [6, 50, 16, 50]], '#ffffff')}<g ${tf(36, 36)}><path d="M-14-14H2V2L16 6C20 8 20 14 16 14H-14z" fill="${c.l('blue', 1, 1)}" ${ol}/><path d="M-14 10H16" stroke="#fff" stroke-width="2"/><rect x="-16" y="12" width="34" height="5" rx="2.5" fill="${c.l('white')}" ${ol}/></g>${wing(c, 26, 24, .7, true)}`,
  ascension: c => `${rays(32, 30, 18, 28, 10, '#fff0a0', 3, .8)}<g ${tf(32, 34)}><path d="M0-10C6-10 8-4 8 2 8 10 4 16 0 22-4 16-8 10-8 2-8-4-6-10 0-10z" fill="${c.r('gold')}" ${ol}/><circle cx="0" cy="-14" r="7" fill="${c.r('gold')}" ${ol}/><path d="M-2-14 2-15" stroke="${O}" stroke-width="2"/><path d="M0-8 4-12 6-10z" fill="#ff8a2a"/></g>${wing(c, 26, 26, .75, true, 'fire')}${wing(c, 38, 26, .75, false, 'fire')}${sparks([[14, 52, .6], [50, 52, .6]], '#fff6b0')}`,
  titanbody: c => `<g ${tf(32, 33)}><path d="M-22-14C-16-22-6-22 0-18 6-22 16-22 22-14L18 20C10 26-10 26-18 20z" fill="${c.l('steel', 1, 1)}" ${ol}/><path d="M0-16V22M-14-6C-8-2 8-2 14-6" stroke="${O}" stroke-width="2.2" fill="none"/>
    <circle cx="0" cy="6" r="6" fill="${c.r('gold')}" ${ol}/><path d="M-24-14-30-6-22 0M24-14 30-6 22 0" fill="${c.l('gold')}" ${ol}/>${shine(-12, -12, 5, 2.5)}</g>`,
  warlord: c => `<path d="M14 58V8" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M14 58V8" stroke="#b8763a" stroke-width="3.5" stroke-linecap="round"/><path d="M16 10H52L44 22 52 34H16z" fill="${c.l('red', 1, 1)}" ${ol}/>${crown(c, 32, 22, .55)}${ball(c, 14, 7, 4, 'gold')}`,
  might: c => `${rays(32, 30, 18, 30, 12, '#fff3a0', 3.5, .9)}${fist(c, 32, 32, 1.05, 'gold')}${sparks([[10, 12, .7], [54, 50, .6]])}`,
  vigor: c => `${gem(c, 32, 30, 1.4, 'pink')}${heart(c, 32, 26, .45, 'pink')}${sparks([[12, 16, .7], [52, 12, .6], [50, 50, .5]])}`,
  // knight
  whirl: c => `${ringArc(32, 32, 26, '#ff8a9a', 4, 200, 470)}${[0, 120, 240].map(a => {const r = (a - 90) * Math.PI / 180;return sword(c, 32 + Math.cos(r) * 13, 32 + Math.sin(r) * 13, a, .48);}).join('')}${ball(c, 32, 32, 5, 'red')}`,
  wave: c => `<path d="M10 52C14 24 34 10 56 10 40 18 30 32 28 52z" fill="${c.l('ice', 1, 1)}" ${ol}/>${sword(c, 40, 38, 45, .7)}${speed([[6, 30, 14, 26], [4, 40, 12, 38]])}`,
  judgement: c => `${cloud(c, 32, 12, .9, 'white')}${rays(32, 52, 6, 12, 8, '#fff0a0', 3)}${sword(c, 32, 34, 180, .8, 'holy', 'gold')}`,
  charge: c => `${speed([[4, 22, 24, 22, 4], [2, 34, 20, 34, 4], [6, 46, 26, 46, 4]], '#bfe6ff')}${sword(c, 40, 34, 90, .75)}`,
  quake: c => `<path d="M4 46H60V60H4z" fill="${c.l('brown')}" ${ol}/><path d="M32 46 26 53 31 60M32 46 40 52 37 60M16 46 12 54M48 46 54 55" stroke="#ff9a2a" stroke-width="2.8" fill="none" stroke-linecap="round"/>${fist(c, 32, 26, .8, 'steel', 180)}${speed([[12, 36, 6, 30, 3], [52, 36, 58, 30, 3], [22, 40, 18, 34, 2], [42, 40, 46, 34, 2]], '#ffe0a0')}${ball(c, 10, 42, 3, 'brown', false)}${ball(c, 56, 41, 2.6, 'brown', false)}`,
  bladerain: c => `${sword(c, 16, 22, 180, .42, 'holy')}${sword(c, 32, 32, 180, .5, 'holy')}${sword(c, 48, 20, 180, .42, 'holy')}${sword(c, 24, 46, 180, .36, 'holy')}${sword(c, 44, 48, 180, .36, 'holy')}`,
  heavensword: c => `${rays(32, 30, 14, 30, 12, '#fff6b8', 3, .9)}${ringArc(32, 12, 9, '#fff3a0', 3, 0, 359)}${wing(c, 26, 26, .8, true, 'holy')}${wing(c, 38, 26, .8, false, 'holy')}${sword(c, 32, 34, 180, .85, 'holy', 'gold')}`,
  dragonstorm: c => `${sword(c, 32, 34, 180, .62)}${dragon(c, 'M10 56C2 40 14 30 26 34 40 38 52 32 50 20', 50, 16, -20, '#5fd06a', .9)}${sparks([[12, 14, .7], [54, 44, .6]])}`,
  worldsplitter: c => `${planet(c, 32, 40, 18, 'teal')}<path d="M18 30 46 52" stroke="#fff3a0" stroke-width="5" stroke-linecap="round"/><path d="M18 30 46 52" stroke="#ff8a2a" stroke-width="2"/>${sword(c, 38, 22, 135, .72, 'holy')}${sparks([[10, 12, .7], [54, 30, .6]])}`,
  ironwill: c => `${shield(c, 32, 33, 1.15, 'steel', null)}${heart(c, 32, 31, .42, 'red')}`,
  bloodlust: c => `<circle cx="32" cy="32" r="22" fill="#ff5a6a" opacity=".25"/>${sword(c, 30, 32, 35, .85, 'red', 'dark')}${drop(c, 48, 46, 1)}${drop(c, 16, 50, .7)}${drop(c, 52, 26, .55)}`,
  // mage
  meteor: c => `${speed([[48, 8, 34, 24, 7], [58, 16, 42, 30, 6], [54, 2, 42, 14, 4]], '#ffcf6a', .9)}<g ${tf(26, 38)}><circle r="15" fill="${c.r('fire')}" ${ol}/><circle cx="-4" cy="4" r="3.5" fill="#d0461a"/><circle cx="5" cy="-3" r="2.5" fill="#d0461a"/><circle cx="4" cy="7" r="2" fill="#d0461a"/>${shine(-6, -7, 5, 2.5)}</g>`,
  vortex: c => `${swirl(32, 32, 26, '#c48cff', 2.2, 5)}${ball(c, 32, 32, 6, 'violet')}${sparks([[52, 10, .6], [10, 52, .6]])}`,
  nova: c => `${rays(32, 32, 10, 28, 16, '#ffffff', 3, .85)}${star(c, 32, 32, 18, 4, 'blue')}${ball(c, 32, 32, 6, 'white', false)}`,
  blizzard2: c => `${cloud(c, 32, 22, 1.1, 'white')}${snowflake(18, 44, 1, '#ffffff')}${snowflake(34, 52, 1.1, '#ffffff')}${snowflake(48, 42, .9, '#ffffff')}${speed([[12, 36, 8, 42, 2], [42, 36, 38, 44, 2]], '#e0f6ff')}`,
  thunder: c => `${cloud(c, 32, 14, .95, 'dark')}${bolt(c, 32, 38, 0, .95, 'gold')}<path d="M18 58C24 52 40 52 46 58" stroke="#fff3a0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  beam: c => `<path d="M24 40 58 6" stroke="#f3dcff" stroke-width="14" stroke-linecap="round" opacity=".55"/>${rope('M24 40 58 6', '#c070ff', 6)}<path d="M24 40 58 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M6 58 22 42" stroke="${O}" stroke-width="8" stroke-linecap="round"/><path d="M6 58 22 42" stroke="#9a5a2a" stroke-width="4" stroke-linecap="round"/>${gem(c, 24, 40, .55, 'violet')}`,
  starfall: c => `${speed([[56, 6, 40, 22, 5], [46, 2, 30, 18, 4], [60, 26, 50, 36, 4]], '#ffe0ff', .85)}${star(c, 34, 28, 9, 5, 'pink', 15)}${star(c, 22, 18, 6, 5, 'violet', -10)}${star(c, 44, 44, 7, 5, 'gold')}${sparks([[12, 46, .7], [26, 54, .5]])}`,
  singularity: c => `<ellipse cx="32" cy="32" rx="28" ry="11" fill="none" stroke="${O}" stroke-width="9" transform="rotate(-20 32 32)"/><ellipse cx="32" cy="32" rx="28" ry="11" fill="none" stroke="#ff6ad8" stroke-width="4.5" transform="rotate(-20 32 32)"/><circle cx="32" cy="32" r="13" fill="#120a1e" ${ol}/><path d="M23 24C27 20 33 19 37 21" stroke="#ff9ae6" stroke-width="2" fill="none"/>${sparks([[12, 12, .6], [52, 50, .6], [54, 14, .4]])}`,
  divinenova: c => `${sun(c, 32, 32, 15, 'gold', 14)}${ringArc(32, 32, 24, '#fff6b8', 3, 0, 359)}`,
  manaflow: c => `${swirl(32, 34, 26, '#7ee8ff', 1.3, 4)}${ball(c, 32, 32, 11, 'ice')}`,
  arcanemind: c => `${crown(c, 32, 18, .9, 'gold')}${eye(c, 32, 40, .95, 'violet')}`,
  // gunner
  scatter: c => `${blunder(c, 30, 40, -30, .85)}${[[50, 14], [57, 25], [55, 37], [44, 8]].map(([x, y]) => ball(c, x, y, 3.4, 'gold', false)).join('')}${speed([[44, 24, 49, 18, 2], [46, 28, 53, 29, 2]], '#fff3a0')}`,
  grenade: c => `<g ${tf(30, 36)}><ellipse rx="16" ry="18" fill="${c.r('green')}" ${ol}/><path d="M-16 0H16M-10-14V14M10-14V14" stroke="#2c5a1a" stroke-width="2" opacity=".7"/>${shine(-6, -8, 5, 2.5)}<rect x="-6" y="-24" width="12" height="7" rx="2" fill="${c.l('steel')}" ${ol}/></g><path d="M36 12C42 6 48 8 50 4" stroke="${O}" stroke-width="3" fill="none"/>${spark(51, 4, 1, '#ffe86a')}`,
  drone: c => `<g ${tf(32, 30)}><rect x="-14" y="-10" width="28" height="20" rx="9" fill="${c.l('steel', 1, 1)}" ${ol}/><circle r="6" fill="${c.r('ice')}" ${ol}/><circle r="2.2" fill="${O}"/><path d="M-14 0H-26M14 0H26" stroke="${O}" stroke-width="3"/><ellipse cx="-26" cy="-4" rx="8" ry="2.5" fill="#cfe9ff" ${ol} stroke-width="2"/><ellipse cx="26" cy="-4" rx="8" ry="2.5" fill="#cfe9ff" ${ol} stroke-width="2"/><rect x="-3" y="10" width="6" height="8" fill="${c.l('steel')}" ${ol}/></g>${speed([[24, 54, 24, 60, 3], [40, 54, 40, 60, 3]], '#7fdcff')}`,
  rocket: c => `${rocket(c, 32, 28, 45, .9, 'red')}${sparks([[10, 12, .6], [54, 52, .5]])}`,
  mine: c => `<ellipse cx="32" cy="44" rx="24" ry="9" fill="${c.l('brown')}" ${ol}/><path d="M10 40C10 26 54 26 54 40z" fill="${c.l('red', 1, 1)}" ${ol}/><rect x="28" y="22" width="8" height="8" rx="2" fill="${c.l('steel')}" ${ol}/>${ball(c, 32, 18, 3.5, 'gold')}${rays(32, 18, 5, 9, 6, '#fff3a0', 2)}`,
  barrage: c => `${bullet(c, 16, 18, 160, .9)}${bullet(c, 32, 26, 165, 1)}${bullet(c, 48, 16, 155, .9)}${bullet(c, 24, 44, 170, .8)}${bullet(c, 44, 46, 160, .8)}${speed([[18, 6, 16, 10, 2], [34, 10, 32, 16, 2], [50, 4, 48, 8, 2]], '#fff3a0')}`,
  orbital: c => `${planet(c, 40, 62, 22, 'blue')}<path d="M22 22 42 48" stroke="#bff4ff" stroke-width="12" stroke-linecap="round" opacity=".55"/>${rope('M22 22 42 48', '#4fd8ff', 4)}<path d="M22 22 42 48" stroke="#fff" stroke-width="1.5"/>${satellite(c, 20, 16, -35, .85)}${sparks([[52, 10, .7], [8, 40, .5]])}`,
  annihilation: c => `${rocket(c, 14, 30, 30, .45)}${rocket(c, 26, 22, 30, .5)}${rocket(c, 40, 18, 30, .55)}${rocket(c, 50, 34, 30, .45)}${rocket(c, 32, 42, 30, .45)}`,
  railgun: c => `<path d="M34 30 62 10" stroke="#d6faff" stroke-width="14" stroke-linecap="round" opacity=".6"/>${rope('M34 30 62 10', '#3fd6ff', 5)}<path d="M34 30 62 10" stroke="#fff" stroke-width="1.6"/><g ${tf(24, 38, -36)}><rect x="-22" y="-8" width="40" height="16" rx="5" fill="${c.l('steel', 1, 1)}" ${ol}/><rect x="14" y="-5" width="10" height="10" rx="2" fill="${c.l('dark')}" ${ol}/><rect x="-14" y="8" width="9" height="12" rx="2" fill="${c.l('dark')}" ${ol}/><path d="M-14-8V8M-6-8V8M2-8V8" stroke="#3fd6ff" stroke-width="2.4"/>${shine(-4, -4, 9, 1.6, 0)}</g>`,
  deadeye: c => `<circle cx="32" cy="32" r="24" fill="none" stroke="${O}" stroke-width="7"/><circle cx="32" cy="32" r="24" fill="none" stroke="#ffcf3a" stroke-width="3.5"/>${eye(c, 32, 32, .9, 'gold')}<path d="M32 2V12M32 52V62M2 32H12M52 32H62" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M32 2V12M32 52V62M2 32H12M52 32H62" stroke="#ffcf3a" stroke-width="2.5" stroke-linecap="round"/>`,
  quickdraw: c => `${speed([[6, 16, 18, 22, 3], [4, 28, 16, 30, 3], [8, 40, 18, 38, 3]], '#ffffff')}${pistol(c, 30, 36, -12, 1.05)}${spark(56, 24, 1.3, '#fff3a0')}${ringArc(26, 44, 14, '#ffffff', 2, 100, 250)}`,
  // archer
  piercingarrow: c => `${arrow(c, 32, 32, 45, .95, 'silver', 'green')}${speed([[6, 58, 14, 50, 4]], '#c8ffb0')}<circle cx="32" cy="32" r="10" fill="none" stroke="#e9ffd2" stroke-width="2.5" opacity=".8"/>`,
  volleyfan: c => `${arrow(c, 22, 34, -30, .6, 'gold', 'green')}${arrow(c, 32, 30, 0, .65, 'gold', 'green')}${arrow(c, 42, 34, 30, .6, 'gold', 'green')}${speed([[8, 56, 20, 50, 3], [44, 50, 56, 56, 3]], '#e6ffe0')}`,
  thorntrap: c => `<ellipse cx="32" cy="46" rx="26" ry="10" fill="${c.r('brown')}" ${ol}/>${vine('M8 46C14 30 20 30 22 44M24 46C28 22 36 22 40 46M42 46C44 30 52 30 56 44')}${spikes([[14, 34, -30], [22, 38, 30], [30, 28, -20], [38, 32, 30], [46, 34, -30], [53, 36, 30]])}`,
  arrowrain: c => `${cloud(c, 32, 12, .9, 'white')}${arrow(c, 18, 40, 180, .42, 'silver', 'green')}${arrow(c, 32, 46, 180, .48, 'silver', 'green')}${arrow(c, 46, 40, 180, .42, 'silver', 'green')}`,
  galearrow: c => `${swirl(30, 34, 24, '#c8fff0', 1.2, 4)}${arrow(c, 34, 30, 70, .8, 'silver', 'teal')}`,
  snarefield: c => `${vine('M32 10C50 10 56 26 50 40 44 54 22 56 14 44 8 32 16 20 28 22 40 24 42 38 32 40')}${spikes([[46, 12, 40], [56, 32, 90], [40, 54, 170], [12, 40, 250], [20, 22, 300]])}`,
  dragonarrow: c => `${arrow(c, 34, 30, 45, .9, 'gold', 'teal')}${dragon(c, 'M8 52C6 38 18 34 26 40 36 48 50 44 52 30', 52, 24, -40, '#4fd0b0', .85)}`,
  arrowstorm: c => `${cloud(c, 32, 14, 1.1, 'dark')}${arrow(c, 14, 44, 175, .36, 'gold', 'gold')}${arrow(c, 26, 48, 180, .38, 'gold', 'gold')}${arrow(c, 38, 46, 185, .38, 'gold', 'gold')}${arrow(c, 50, 44, 180, .36, 'gold', 'gold')}${bolt(c, 50, 30, 10, .35, 'gold')}`,
  celestialbow: c => `${bow(c, 24, 32, 0, 1, 'gold')}${[-24, -12, 0, 12, 24].map(a => `<path d="M22 32L${(22 + Math.cos(a * Math.PI / 180) * 36).toFixed(1)} ${(32 + Math.sin(a * Math.PI / 180) * 36).toFixed(1)}" stroke="#fff6c0" stroke-width="3" stroke-linecap="round"/>`).join('')}${star(c, 54, 32, 6, 5, 'gold')}${sparks([[48, 12, .6], [48, 52, .6]])}`,
  eagleeye: c => `<path ${tf(14, 18, -30)} d="M0-10C8-6 8 6 0 10-8 6-8-6 0-10z" fill="${c.l('green')}" ${ol} stroke-width="2"/><path ${tf(50, 48, 30)} d="M0-10C8-6 8 6 0 10-8 6-8-6 0-10z" fill="${c.l('green')}" ${ol} stroke-width="2"/>${eye(c, 32, 32, 1.05, 'gold')}${spark(48, 18, 1.1, '#fff')}`,
  bowmastery: c => `<path d="M10 46C6 32 12 18 22 12M54 46C58 32 52 18 42 12" stroke="#7ed64c" stroke-width="5" fill="none" stroke-linecap="round"/>${bow(c, 26, 32, 0, .85, 'brown')}<rect x="36" y="16" width="12" height="32" rx="4" fill="${c.l('brown', 1, 0)}" ${ol}/>${arrow(c, 40, 12, 0, .3, 'silver', 'red')}${arrow(c, 45, 12, 0, .3, 'silver', 'red')}`,
  // assassin
  fanofknives: c => `${dagger(c, 20, 36, -35, .9, 'silver', 'violet')}${dagger(c, 32, 30, 0, .95, 'silver', 'violet')}${dagger(c, 44, 36, 35, .9, 'silver', 'violet')}${speed([[12, 58, 18, 50, 3], [32, 60, 32, 52, 3], [52, 58, 46, 50, 3]], '#d6a8ff')}`,
  shadowcut: c => `<path d="M6 54 58 10" stroke="#3a1a4e" stroke-width="12" stroke-linecap="round" opacity=".7"/>${rope('M6 54 58 10', '#b66cff', 4)}${dagger(c, 34, 32, 50, 1.05, 'dark', 'violet')}`,
  toxicmist: c => `${mist(c, 32, 38, 1.05, 'poison')}${skull(c, 32, 32, .6, 'white', '#7dff6a')}${ball(c, 12, 18, 3, 'poison')}${ball(c, 52, 14, 4, 'poison')}`,
  phantomstrike: c => `<g opacity=".55">${dagger(c, 18, 26, 180, .7, 'violet', 'dark')}${dagger(c, 46, 22, 180, .7, 'violet', 'dark')}</g>${dagger(c, 32, 34, 180, 1, 'dark', 'violet')}${speed([[32, 4, 32, 12, 3], [18, 4, 18, 10, 2], [46, 2, 46, 8, 2]], '#d6a8ff')}`,
  blooddance: c => `${swirl(32, 32, 26, '#ff4a6a', 1.1, 4)}${dagger(c, 24, 28, -50, .8, 'red', 'dark')}${dagger(c, 40, 38, 130, .8, 'red', 'dark')}${drop(c, 52, 14, .7)}`,
  deathmark: c => `${ringArc(32, 32, 24, '#b66cff', 4, 0, 359)}${rays(32, 32, 24, 30, 8, '#d6a8ff', 2.5)}${skull(c, 32, 32, .85, 'violet', '#ffe0ff')}`,
  eclipseblades: c => `<circle cx="32" cy="32" r="20" fill="#d9a8ff" opacity=".55"/><circle cx="32" cy="32" r="16" fill="#140a1e" ${ol}/><circle cx="38" cy="28" r="14" fill="${c.r('violet')}" opacity=".4"/>${dagger(c, 16, 44, -40, .7, 'silver', 'violet')}${dagger(c, 48, 44, 40, .7, 'silver', 'violet')}`,
  serpentmist: c => `${mist(c, 32, 46, .9, 'violet')}<path d="M16 50C8 36 22 28 30 34 38 40 50 32 46 20 44 12 36 10 32 14 40 6 54 8 56 20 58 34 44 46 30 42 22 40 18 46 22 54z" fill="${c.l('poison', 1, 1)}" ${ol}/><circle cx="38" cy="14" r="2.2" fill="#ff3a5a"/><path d="M33 16 28 18 33 18" stroke="#ff3a5a" stroke-width="1.8" fill="none"/>`,
  thousandcuts: c => `${rays(32, 32, 8, 30, 12, '#c48cff', 4, .85)}${[0, 72, 144, 216, 288].map(a => dagger(c, 32 + Math.cos((a - 90) * Math.PI / 180) * 16, 32 + Math.sin((a - 90) * Math.PI / 180) * 16, a, .55, 'violet', 'dark')).join('')}${ball(c, 32, 32, 5, 'violet')}`,
  killerinstinct: c => `<path d="M4 32C16 12 48 12 60 32 48 52 16 52 4 32z" fill="#1a0e24" ${ol}/><ellipse cx="32" cy="32" rx="14" ry="13" fill="${c.r('red')}" ${ol}/><ellipse cx="32" cy="32" rx="3" ry="11" fill="${O}"/><circle cx="27" cy="26" r="2.4" fill="#fff"/>`,
  soulsteal: c => `${dagger(c, 22, 38, -40, 1, 'dark', 'violet')}<path d="M48 14C56 18 56 28 48 30 52 26 48 22 44 24 38 26 36 32 34 36 32 28 38 12 48 14z" fill="${c.r('teal', .5, .4)}" ${ol}/><circle cx="48" cy="20" r="1.5" fill="${O}"/><circle cx="52" cy="21" r="1.5" fill="${O}"/>`,
  // drunkard
  beerspray: c => `${beerD(c, 'M26 30C36 22 46 18 58 18', 8)}${[[40, 18], [50, 14], [56, 24]].map(([x, y]) => ball(c, x, y, 3.2, 'white', false)).join('')}${mug(c, 20, 40, 40, .7)}${speed([[34, 34, 46, 30, 2], [36, 40, 50, 38, 2]], '#fff3a0')}`,
  foamfan: c => `${foam(c, 32, 14, .7)}${foam(c, 14, 28, .6)}${foam(c, 50, 28, .6)}${mug(c, 32, 44, 0, .62)}${speed([[24, 34, 18, 30, 2], [40, 34, 46, 30, 2], [32, 30, 32, 24, 2]], '#fff3a0')}`,
  beerpuddle: c => `<ellipse cx="32" cy="44" rx="26" ry="11" fill="${c.r('gold', .4, .3)}" ${ol}/><ellipse cx="24" cy="41" rx="8" ry="3" fill="#fff6c0" opacity=".8"/>${ball(c, 44, 44, 3, 'white', false)}${ball(c, 18, 48, 2.5, 'white', false)}${bottle(c, 36, 24, 70, .7)}`,
  bottlerain: c => `${cloud(c, 32, 12, .85, 'white')}${bottle(c, 16, 40, 160, .55)}${bottle(c, 32, 46, 185, .6)}${bottle(c, 48, 38, 200, .55)}`,
  bellybump: c => `${speed([[6, 22, 14, 26, 3], [4, 36, 12, 36, 3], [6, 50, 14, 46, 3], [58, 22, 50, 26, 3], [60, 36, 52, 36, 3], [58, 50, 50, 46, 3]], '#ffffff')}<ellipse cx="32" cy="36" rx="18" ry="17" fill="${c.r([[0, '#ffe9d0'], [.6, '#ffc9a0'], [1, '#d88a5a']])}" ${ol}/><path d="M14 30C22 26 42 26 50 30" stroke="${O}" stroke-width="2.5" fill="none"/><rect x="14" y="18" width="36" height="10" rx="4" fill="${c.l('dark')}" ${ol}/><circle cx="32" cy="40" r="2" fill="${O}"/>${shine(24, 32, 5, 2.5)}`,
  bearhug: c => `${ringArc(32, 34, 24, '#ffc02e', 4, 0, 359)}<g ${tf(32, 34)}><path d="M-20-4C-26 6-22 18-10 18M20-4C26 6 22 18 10 18" fill="none" stroke="${O}" stroke-width="11" stroke-linecap="round"/><path d="M-20-4C-26 6-22 18-10 18M20-4C26 6 22 18 10 18" fill="none" stroke="#ffc9a0" stroke-width="6" stroke-linecap="round"/></g>${heart(c, 32, 32, .42, 'red')}`,
  beertsunami: c => `<path d="M2 60C6 40 18 24 36 22 50 20 58 30 54 40 50 32 40 32 36 40 32 48 40 56 50 60z" fill="${c.l('gold', 1, 1)}" ${ol}/>${foam(c, 46, 22, .8)}${ball(c, 20, 44, 3, 'white', false)}${ball(c, 28, 52, 2.5, 'white', false)}`,
  kegdrop: c => `${speed([[20, 4, 20, 14, 3], [44, 4, 44, 14, 3]], '#ffffff')}${keg(c, 32, 30, 1)}<path d="M10 56H54" stroke="#fff3a0" stroke-width="3" stroke-linecap="round"/>${rays(32, 58, 4, 10, 6, '#fff3a0', 2.5, .9, 180)}`,
  happyhour: c => `${rays(32, 30, 14, 28, 10, '#fff3a0', 3, .85)}${mug(c, 22, 34, -18, .62)}${mug(c, 44, 34, 18, .62)}${sparks([[33, 14, 1.1], [14, 12, .6], [52, 12, .6]], '#fff')}`,
  ironliver: c => `${shield(c, 32, 34, 1.1, 'steel', null)}<path d="M20 30C20 22 30 20 36 24 42 20 48 26 44 34 40 42 26 42 20 30z" fill="${c.r([[0, '#ffc2b0'], [.5, '#d0584a'], [1, '#7a1f1a']])}" ${ol}/>${shine(26, 27, 3, 1.6)}`,
  liquidcourage: c => `${mug(c, 28, 38, -10, .75)}${fist(c, 46, 22, .45, 'orange', -20)}${sparks([[12, 14, .7], [54, 46, .6]], '#fff')}`,
  // cleric
  smite: c => `${cloud(c, 32, 10, .8, 'white')}<path d="M32 16 24 58H40z" fill="#fff6c0" opacity=".7"/>${rope('M32 18V54', '#ffd85a', 6)}<path d="M32 18V54" stroke="#fff" stroke-width="2"/>${rays(32, 56, 4, 10, 8, '#fff3a0', 2.5)}`,
  holywave: c => `${[0, 1, 2].map(i => rope(`M${12 + i * 12} 54C${4 + i * 12} 40 ${4 + i * 12} 24 ${12 + i * 12} 10`, '#fff3c0', 5)).join('')}${sparks([[54, 18, .8], [56, 44, .6]], '#ffe680')}`,
  sanctuary: c => `<ellipse cx="32" cy="44" rx="26" ry="11" fill="${c.r('holy')}" ${ol}/><ellipse cx="32" cy="44" rx="18" ry="7" fill="none" stroke="#e7b84e" stroke-width="2"/>${rays(32, 44, 0, 0, 1, '#fff', 0)}<path d="M20 44V20M44 44V20" stroke="#fff6c0" stroke-width="5" opacity=".6" stroke-linecap="round"/>${heart(c, 32, 24, .42, 'pink')}${sparks([[14, 30, .6], [50, 32, .6]], '#fff')}`,
  purify: c => `${cloud(c, 32, 12, .95, 'white')}${[16, 32, 48].map(x => `<path d="M${x} 18V54" stroke="#fff3a0" stroke-width="7" stroke-linecap="round" opacity=".75"/><path d="M${x} 18V54" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`).join('')}${sparks([[24, 52, .7], [40, 56, .7]], '#ffe680')}`,
  lightlance: c => `${rays(48, 16, 8, 16, 10, '#fff3a0', 3)}<g ${tf(30, 34, 45)}><path d="M0 28V-14" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M0 28V-14" stroke="#e7b84e" stroke-width="3.2" stroke-linecap="round"/><path d="M0-30 8-12H-8z" fill="${c.l('holy', 1, 0)}" ${ol}/></g>`,
  dawncircle: c => `<circle cx="32" cy="32" r="24" fill="none" stroke="#ffd0e0" stroke-width="10" opacity=".6"/>${ringArc(32, 32, 22, '#ffb3cf', 5, 0, 359)}${ringArc(32, 32, 22, '#fff3a0', 2, 0, 359)}${sparks([[32, 8, .8], [54, 34, .7], [12, 40, .7]], '#fff')}`,
  seraphstorm: c => `${wing(c, 26, 22, .7, true, 'holy')}${wing(c, 38, 22, .7, false, 'holy')}${wing(c, 26, 32, .6, true, 'pink')}${wing(c, 38, 32, .6, false, 'pink')}${ball(c, 32, 18, 6, 'holy')}${ringArc(32, 9, 6, '#ffe680', 2.5, 0, 359)}${sword(c, 32, 42, 180, .5, 'holy', 'gold')}`,
  solarsanctum: c => `${sun(c, 32, 14, 8, 'gold', 10)}<path d="M12 58V34L32 22 52 34V58z" fill="${c.l('white', 1, 1)}" ${ol}/><path d="M26 58V44C26 38 38 38 38 44V58z" fill="${c.l('gold')}" ${ol}/><path d="M12 34H52" stroke="${O}" stroke-width="2"/>${cross(c, 32, 30, .22, 'gold')}`,
  judgementcross: c => `${rays(32, 32, 14, 30, 5, '#fff3a0', 5, .9, -90)}${cross(c, 32, 34, 1, 'holy')}`,
  resolve: c => `${shield(c, 32, 34, 1.1, 'holy', null)}${flame(c, 32, 30, .5, 'fire')}`,
  blessedmind: c => `${book(c, 32, 40, .95, 'pink')}${feather(c, 44, 18, 30, .55)}${sparks([[16, 14, .8], [30, 10, .6]], '#ffe680')}`,
};

// Which background each icon sits on: its group, or gold for the legendary Lv.70+ skills.
const GROUPS = {
  general: ['fire', 'ice', 'spark', 'gust', 'area', 'haste', 'ascension', 'titanbody', 'warlord', 'might', 'vigor'],
  knight: ['whirl', 'wave', 'judgement', 'charge', 'quake', 'bladerain', 'heavensword', 'dragonstorm', 'worldsplitter', 'ironwill', 'bloodlust'],
  mage: ['meteor', 'vortex', 'nova', 'blizzard2', 'thunder', 'beam', 'starfall', 'singularity', 'divinenova', 'manaflow', 'arcanemind'],
  gunner: ['scatter', 'grenade', 'drone', 'rocket', 'mine', 'barrage', 'orbital', 'annihilation', 'railgun', 'deadeye', 'quickdraw'],
  archer: ['piercingarrow', 'volleyfan', 'thorntrap', 'arrowrain', 'galearrow', 'snarefield', 'dragonarrow', 'arrowstorm', 'celestialbow', 'eagleeye', 'bowmastery'],
  assassin: ['fanofknives', 'shadowcut', 'toxicmist', 'phantomstrike', 'blooddance', 'deathmark', 'eclipseblades', 'serpentmist', 'thousandcuts', 'killerinstinct', 'soulsteal'],
  drunkard: ['beerspray', 'foamfan', 'beerpuddle', 'bottlerain', 'bellybump', 'bearhug', 'beertsunami', 'kegdrop', 'happyhour', 'ironliver', 'liquidcourage'],
  cleric: ['smite', 'holywave', 'sanctuary', 'purify', 'lightlance', 'dawncircle', 'seraphstorm', 'solarsanctum', 'judgementcross', 'resolve', 'blessedmind'],
};
const THEME_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ids]) => ids.map((id, i) => [id, g !== 'general' && i >= 6 && i < 9 ? 'god' : g])));
export const SKILL_ICON_IDS = Object.keys(ICONS);
export const SKILL_ICON_GROUPS = GROUPS;
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ids]) => ids.map(id => [id, g])));
export const skillIconGroup = id => GROUP_OF[id] || '';

export function skillIconSvg(id) {
  const draw = ICONS[id];if (!draw) return '';
  const c = ctx(), [a, b] = THEME[THEME_OF[id] || 'general'], body = draw(c), bg = c.r([[0, a], [1, b]], .5, .4);
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${c.defs}</defs><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="30" r="24" fill="#fff" opacity=".18"/>${body}</svg>`;
}
