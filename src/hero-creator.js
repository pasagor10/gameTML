// Character creator: pick hair, face, skin and outfit for the cutout hero, watch it move on a
// small stage, then name it. Used for new heroes and for restyling an existing one.
// Every option list comes from hero-look.js, so a new hair style or outfit shows up here as soon
// as it is added there (with its pictures in the rig).
import {LOOK, lookChoices, encodeLook, randomLook} from './hero-look.js';
import {drawToonHero} from './toon.js';
import {whenCutoutReady, cutoutReady} from './cutout.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const POSES = [
  {id: 'idle', name: 'ยืน'},
  {id: 'walk', name: 'เดิน'},
  {id: 'attack', name: 'ฟันดาบ'},
  {id: 'skill', name: 'ท่าสกิล'}
];
const SKILLS = ['whirl', 'wave', 'judgement', 'charge'];
const DIRECTIONS = ['se', 'sw', 'nw', 'ne'];
// Thumbnails frame part of the hero: [centre y in px at scale 1, zoom]. The hero is about 130px tall.
const FRAMES = {head: [-90, 1.55], face: [-76, 2.4], body: [-66, .98]};
const GROUPS = {
  hair: [['hair', 'tiles', 'head', 'ทรงผม'], ['hairColour', 'swatches', null, 'สีผม']],
  face: [['eyes', 'tiles', 'face', 'ดวงตา'], ['eyeColour', 'swatches', null, 'สีตา'], ['mouth', 'tiles', 'face', 'ปาก'], ['skin', 'swatches', null, 'สีผิว']],
  outfit: [['outfit', 'tiles', 'body', 'ชุด'], ['outfitColour', 'swatches', null, 'สีชุด']]
};
const TABS = [['hair', 'ผม'], ['face', 'หน้าตา'], ['outfit', 'ชุด']];

// root: the element to fill. opts: {title, confirmLabel, appearance, look, name, randomName(),
// onConfirm({appearance, look, name}) -> error text or nothing, onCancel()}.
export function openHeroCreator(root, opts) {
  injectCss();
  const state = {app: opts.appearance === 'b' ? 'b' : 'a', sel: lookChoices(opts.look, opts.appearance), tab: 'hair', pose: 0, dir: 0};
  const group = key => {
    const [k, kind, frame, label] = Object.values(GROUPS).flat().find(g => g[0] === key);
    const items = LOOK[k].map((v, i) => kind === 'tiles' ?
      `<button class="hc-tile" data-key="${k}" data-i="${i}" aria-label="${esc(v.name)}" title="${esc(v.name)}"><canvas width="144" height="144" data-frame="${frame}"></canvas></button>` :
      `<button class="hc-swatch" data-key="${k}" data-i="${i}" aria-label="${label} ${i + 1}" style="--c:${v}"></button>`).join('');
    return `<h3>${label}<small>${LOOK[k].length} แบบ</small></h3><div class="hc-${kind}">${items}</div>`;
  };
  const panel = id => `<section class="hc-panel" data-panel="${id}">${GROUPS[id].map(g => group(g[0])).join('')}${id === 'outfit' ? '<p class="hc-hint" id="hcHoodHint">ฮู้ดคลุมผมด้านหลังไว้ · เลือกชุดนักผจญภัยเพื่อโชว์ทรงผมเต็มๆ</p>' : ''}</section>`;
  root.innerHTML = `<div class="panel hero-creator">
    <div class="hc-head"><div class="eyebrow">CHARACTER CREATOR</div><h2>${esc(opts.title)}</h2></div>
    <div class="hc-body">
      <nav class="hc-tabs">${TABS.map(([id, name]) => `<button data-tab="${id}">${name}</button>`).join('')}</nav>
      <div class="hc-side">${panel('hair')}${panel('outfit')}</div>
      <section class="hc-stage">
        <div class="hc-scene"><div class="hc-sex"><button data-sex="a">ชาย</button><button data-sex="b">หญิง</button></div>
        <canvas id="hcStage" width="440" height="460" aria-label="ตัวอย่างตัวละคร"></canvas></div>
        <div class="hc-controls"><button id="hcLeft" aria-label="หันซ้าย">◀</button><button id="hcPose"></button><button id="hcRight" aria-label="หันขวา">▶</button></div>
        <div class="hc-name"><input id="hcName" maxlength="12" placeholder="ตั้งชื่อตัวละคร..." aria-label="ชื่อตัวละคร" value="${esc(opts.name)}"><button id="hcRollName" title="สุ่มชื่อ" aria-label="สุ่มชื่อ">🎲</button></div>
        <p id="hcError" role="alert"></p>
        <div class="hc-actions"><button id="hcRandom" class="secondary">🎲 สุ่มหน้าตา</button><button id="hcCancel" class="secondary">กลับ</button><button id="hcConfirm" class="primary">${esc(opts.confirmLabel || 'ยืนยัน')}</button></div>
      </section>
      <div class="hc-side">${panel('face')}</div>
    </div></div>`;
  const $ = s => root.querySelector(s), all = s => root.querySelectorAll(s);
  const code = () => encodeLook(state.sel);

  const paintThumbs = () => {
    all('.hc-tile').forEach(b => {
      const c = b.querySelector('canvas').getContext('2d'), [cy, z] = FRAMES[b.querySelector('canvas').dataset.frame];
      const sel = {...state.sel, [b.dataset.key]: +b.dataset.i};
      // Hair thumbnails leave the hood off so the whole style shows.
      if (b.dataset.key === 'hair') sel.outfit = LOOK.outfit.findIndex(o => o.id === 'tunic');
      c.setTransform(1, 0, 0, 1, 0, 0);c.clearRect(0, 0, 144, 144);
      c.translate(72, 72 - cy * z);c.scale(z, z);
      drawToonHero(c, 0, 0, {job: 'novice', appearance: state.app, look: encodeLook(sel), time: 0, direction: 'se'});
    });
  };
  const sync = () => {
    all('[data-key]').forEach(b => b.setAttribute('aria-pressed', String(state.sel[b.dataset.key] === +b.dataset.i)));
    all('[data-sex]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sex === state.app)));
    all('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    all('[data-panel]').forEach(p => p.classList.toggle('hc-active', p.dataset.panel === state.tab));
    $('#hcPose').textContent = `ท่าทาง · ${POSES[state.pose].name}`;
    $('#hcHoodHint').hidden = LOOK.outfit[state.sel.outfit].id === 'tunic';
    paintThumbs();
  };
  all('[data-key]').forEach(b => b.onclick = () => {state.sel[b.dataset.key] = +b.dataset.i;sync();});
  all('[data-sex]').forEach(b => b.onclick = () => {state.app = b.dataset.sex;sync();});
  all('[data-tab]').forEach(b => b.onclick = () => {state.tab = b.dataset.tab;sync();});
  $('#hcPose').onclick = () => {state.pose = (state.pose + 1) % POSES.length;sync();};
  $('#hcLeft').onclick = () => {state.dir = (state.dir + DIRECTIONS.length - 1) % DIRECTIONS.length;};
  $('#hcRight').onclick = () => {state.dir = (state.dir + 1) % DIRECTIONS.length;};
  $('#hcRandom').onclick = () => {state.sel = lookChoices(randomLook(), state.app);sync();};
  $('#hcRollName').onclick = () => {if (opts.randomName) $('#hcName').value = opts.randomName();};
  $('#hcCancel').onclick = () => opts.onCancel?.();
  $('#hcConfirm').onclick = () => {
    const error = opts.onConfirm?.({appearance: state.app, look: code(), name: $('#hcName').value});
    if (error) {$('#hcError').textContent = error;$('#hcName').focus();}
  };

  // The stage keeps animating while the creator is on screen.
  const stage = $('#hcStage'), sc = stage.getContext('2d'), t0 = performance.now();
  const frame = now => {
    if (!stage.isConnected) return;
    const t = (now - t0) / 1000, pose = POSES[state.pose].id, o = {job: 'novice', appearance: state.app, look: code(), time: t, direction: DIRECTIONS[state.dir]};
    if (pose === 'walk') Object.assign(o, {moving: true, distance: t * 170});
    if (pose === 'attack') o.attacking = true;
    if (pose === 'skill') {const q = (t % 1.4) / 1.4;o.pose = {kind: 'slash', skill: SKILLS[Math.floor(t / 1.4) % SKILLS.length], life: .5 * (1 - Math.min(1, q * 1.2)), max: .5};}
    sc.setTransform(1, 0, 0, 1, 0, 0);sc.clearRect(0, 0, stage.width, stage.height);
    sc.translate(220, 410);sc.scale(2.5, 2.5);
    drawToonHero(sc, 0, 0, o);
    requestAnimationFrame(frame);
  };
  sync();requestAnimationFrame(frame);
  if (!cutoutReady()) whenCutoutReady.then(() => {if (stage.isConnected) paintThumbs();});
  return {get look() {return code();}};
}

function injectCss() {
  if (document.getElementById('heroCreatorCss')) return;
  const s = document.createElement('style');s.id = 'heroCreatorCss';
  s.textContent = `
.hero-creator{width:min(1180px,100%);max-width:1180px;box-sizing:border-box;background:#f6f1e4;color:#3a313c;border:3px solid #5b5148;border-radius:22px;padding:18px;box-shadow:0 6px 0 #423d37;text-align:left}
.hero-creator .hc-head{text-align:center}.hero-creator h2{color:#3a313c;font-size:24px;margin:4px 0 12px;text-shadow:none}
.hc-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,1.05fr) minmax(0,1fr);gap:14px;align-items:start}
.hc-body>*{min-width:0}
.hc-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.hc-panel{background:#fffdf7;border:2px solid #d8ccb2;border-radius:14px;padding:12px 14px}
.hc-panel h3{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;margin:6px 0 8px;color:#4a3f4c}.hc-panel h3 small{font-size:11px;color:#9a8a70;font-weight:normal}
.hc-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.hc-tile{padding:0;aspect-ratio:1;background:#f3ecdc;border:2px solid #e1d6bd;border-radius:10px;cursor:pointer;overflow:hidden}
.hc-tile canvas{display:block;width:100%;height:100%;min-width:0}
.hc-tile[aria-pressed=true]{border-color:#3d7be0;background:#e4efff;box-shadow:0 0 0 2px #3d7be055}
.hc-swatches{display:flex;flex-wrap:wrap;gap:7px}
.hero-creator .hc-swatch,.hero-creator .hc-swatch[aria-pressed=true]{width:30px;height:30px;padding:0;border-radius:8px;background:var(--c);border:2px solid #0002;cursor:pointer}
.hero-creator .hc-swatch[aria-pressed=true]{outline:3px solid #f0b53a;outline-offset:1px;border-color:#fff}
.hc-hint{font-size:11px;color:#8a7a62;margin:10px 0 0}
.hc-stage{display:flex;flex-direction:column;align-items:center;gap:10px}
.hc-scene{position:relative;width:100%;display:flex;justify-content:center;background:radial-gradient(ellipse 42% 9% at 50% 88%,#e98a4a 0 70%,#b45a34 71% 100%,transparent 101%),linear-gradient(#1f2f52,#3b4a6a 62%,#7a5a40 62.5%,#5a4030);border:3px solid #5b5148;border-radius:16px;overflow:hidden}
.hc-scene .hc-sex{position:absolute;top:10px;left:0;right:0}
.hc-stage canvas{width:100%;max-width:360px;height:auto;display:block}
.hc-sex,.hc-controls,.hc-actions,.hc-name{display:flex;gap:8px;justify-content:center;width:100%}
.hc-sex button,.hc-controls button,.hc-tabs button{background:#fffdf7;color:#4a3f4c;border:2px solid #c6b99d;border-radius:10px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer}
.hc-sex button[aria-pressed=true],.hc-tabs button[aria-pressed=true]{background:#f2c14e;border-color:#8a6a2a;color:#3b302d}
.hc-name input{flex:1;min-width:0;background:#fffdf7;color:#302d32;border:2px solid #c8bda5;border-radius:10px;padding:10px;font:inherit}
.hc-name button{background:#fffdf7;border:2px solid #c8bda5;border-radius:10px;padding:0 12px;cursor:pointer}
.hc-actions{flex-wrap:wrap}.hero-creator .hc-actions button{flex:1 1 0;min-width:0;margin:0;font-size:13px;padding:10px 8px;white-space:nowrap}.hero-creator .hc-actions .primary{flex-basis:100%;order:-1;font-size:15px}
.hero-creator .primary{background:#e9b95e;color:#3b302d;border-color:#684d34}.hero-creator .secondary{background:#fffdf7;color:#75654e;border-color:#c6b99d}
#hcError{color:#a5433e;min-height:1em;margin:0;font-size:12px}
.hc-tabs{display:none}
@media(max-width:860px){
 .hero-creator{padding:12px}.hero-creator .eyebrow{display:none}.hero-creator h2{font-size:19px;margin:0 0 8px}
 .hc-body{grid-template-columns:minmax(0,1fr);gap:10px}.hc-stage{order:-2;gap:6px}.hc-tabs{order:1}.hc-side{order:2}.hc-stage canvas{max-width:230px}
 .hc-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:8px}.hc-tabs button{flex:1}
 .hc-panel{display:none}.hc-panel.hc-active{display:block}.hc-side{gap:0}
 .hc-tiles{grid-template-columns:repeat(4,1fr)}
}`;
  document.head.append(s);
}
