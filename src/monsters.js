// Pixel monsters ported from the old game (../gm/public/assets/sprites/monsters) as placeholders
// until TILMO's own monster art is remade. Slimes keep TILMO's painted art (scene-art.js).
const BASE = '/assets/monsters/old';
const ACTIONS = ['move', 'attack'];

// Which old monster stands in for each TILMO enemy role. Elites and bosses rotate by stage so
// endless runs keep meeting new guardians.
const ROLE_SKINS = {
  runner: ['wolf', 'bat'],
  archer: ['goblin', 'mushroom'],
  elite: ['boar', 'golem', 'frost-scarab', 'storm-roc'],
  boss: ['thorn-queen', 'ember-colossus', 'frost-revenant', 'yaksha', 'moon-emperor']
};
export const BOSS_NAMES = {
  'thorn-queen': 'ราชินีหนามพงไพร', 'ember-colossus': 'ยักษ์เพลิงหลอมเหล็ก', 'frost-revenant': 'อัศวินวิญญาณน้ำแข็ง',
  yaksha: 'ยักษ์ทองผู้พิทักษ์', 'moon-emperor': 'จักรพรรดิจันทราดำ'
};
// Art faces right unless listed (from the old game's sprites/index.json).
const ART_FACES_LEFT = new Set(['yaksha', 'frost-scarab']);
// On-screen body height in world units for each role (hero is ~150 tall).
const HEIGHT = {runner: 54, archer: 60, elite: 96, boss: 190};

export function skinFor(type, stage = 1) {
  const list = ROLE_SKINS[type];
  return list ? list[(Math.max(1, stage) - 1) % list.length] : null;
}

const sheets = new Map(); // `${skin}/${action}` -> {img, meta}
export const monsterStatus = {ready: false, loaded: 0, error: null};

function loadImage(url) {
  return new Promise((resolve, reject) => {const img = new Image();img.onload = () => resolve(img);img.onerror = () => reject(new Error(url));img.src = url;});
}
export async function loadMonsters() {
  const skins = [...new Set(Object.values(ROLE_SKINS).flat())];
  await Promise.all(skins.flatMap(skin => ACTIONS.map(async action => {
    try {
      const meta = await fetch(`${BASE}/${skin}/${action}/animation.json`).then(r => {if (!r.ok) throw new Error(r.status);return r.json();});
      const page = meta.fallback.pages[0];
      const img = await loadImage(`${BASE}/${skin}/${action}/${page.file}`);
      sheets.set(`${skin}/${action}`, {img, meta, page});monsterStatus.loaded++;
    } catch (error) {monsterStatus.error = String(error.message || error);}
  })));
  monsterStatus.ready = sheets.size > 0;
  if (monsterStatus.error) console.warn('Monster art fallback:', monsterStatus.error);
}

// Draws the ported pixel monster; returns false so the caller can fall back (slimes, not loaded).
export function drawMonster(c, e, time, player) {
  const skin = skinFor(e.type, e.stage);
  if (!skin) return false;
  const sheet = sheets.get(`${skin}/${e.warn ? 'attack' : 'move'}`) || sheets.get(`${skin}/move`);
  if (!sheet) return false;
  const {img, meta, page} = sheet;
  const [cw, ch] = meta.fallback.cellSize, count = page.frameCount;
  const frameMs = meta.durationsMs.reduce((a, b) => a + b, 0) / meta.durationsMs.length;
  const frame = Math.floor((time * 1000 + e.id * 97) / frameMs) % count;
  const sx = (frame % page.columns) * cw, sy = Math.floor(frame / page.columns) * ch;
  const scale = HEIGHT[e.type] / (meta.bodyHeightPx || ch), [ax, ay] = meta.sourceAnchor;
  const faceLeft = player.x < e.x, flip = ART_FACES_LEFT.has(skin) ? !faceLeft : faceLeft;
  c.save();c.translate(e.x, e.y);
  c.fillStyle = '#123c4240';c.beginPath();c.ellipse(0, 2, e.r * 1.1, e.r * .4, 0, 0, Math.PI * 2);c.fill();
  if (e.slow > 0) {c.fillStyle = '#9fe0ff40';c.beginPath();c.ellipse(0, 0, e.r * 1.3, e.r * .5, 0, 0, Math.PI * 2);c.fill();}
  if (flip) c.scale(-1, 1);
  c.imageSmoothingEnabled = false;
  c.drawImage(img, sx, sy, cw, ch, -ax * scale, -ay * scale, cw * scale, ch * scale);
  if (e.flash > 0) { // hit flash: brighten the same frame
    c.globalCompositeOperation = 'lighter';c.globalAlpha = Math.min(1, e.flash * 6) * .6;
    c.drawImage(img, sx, sy, cw, ch, -ax * scale, -ay * scale, cw * scale, ch * scale);
  }
  c.restore();
  return true;
}
