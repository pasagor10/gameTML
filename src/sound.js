// Ported from the old game (../gm/public/sound.js) for TILMO; to be remade later.
// Game audio: local CC0 music and recorded CC0 combat sounds, layered with
// synthesised WebAudio for punch. Sources and licenses: /assets/music/CREDITS.md
//
//   import { sfx, music, setSound, soundOn, unlockAudio } from "./sound.js";
//   sfx("swing")            // one-shot effects, see SFX below
//   music("town"|"dungeon"|"boss"|null)
//
// Browsers only start audio after a user gesture: call unlockAudio() from one
// (the module also listens for the first pointer/key press itself).

let ctx = null,
  master,
  sfxBus,
  musicBus,
  reverb,
  noiseBuf,
  enabled = readPref("tilmo-sound", true),
  musicEnabled = readPref("tilmo-music", true),
  mood = null,
  wantMood = null,
  activeTrack = null;
const lastPlayed = new Map();
let effectLevel = 1;
const MASTER_LEVEL = 0.25;

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writePref(key, on) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {}
}

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = enabled ? MASTER_LEVEL : 0;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.85;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicEnabled ? 0.32 : 0;
  musicBus.connect(master);
  // Short synthetic room: decaying stereo noise impulse.
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.6),
    ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  reverb.connect(wet).connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  loadSamples();
  return true;
}

// ---------- recorded samples ----------
// Each group holds a few takes; one is picked at random per play, with a
// slight pitch wobble so repeats never sound copy-pasted.
const SAMPLES = {
  swing: ["sw-swing1", "sw-swing2", "sw-swing3"],
  slash: ["sw-slash1", "sw-slash2", "sw-slash3"],
  blade: ["hit-blade1", "hit-blade2", "hit-blade3"],
  clang: ["clang1", "clang2", "clang3"],
  thud: ["hit-thud1", "hit-thud2", "hit-thud3"],
  cast: ["cast1", "cast2", "cast3"],
  fire: ["fire1", "fire2", "fire3", "fire4"],
  die: ["die1", "die2", "die3"],
  roar: ["roar1", "roar2", "roar3"],
  coin: ["coin1", "coin2"],
};
const buffers = new Map();
function loadSamples() {
  for (const [group, names] of Object.entries(SAMPLES))
    for (const name of names)
      fetch(`/assets/sfx/${name}.mp3?v=1`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          if (!buffers.has(group)) buffers.set(group, []);
          buffers.get(group).push(buf);
        })
        .catch(() => {}); // synth fallbacks cover a missing take
}
// Plays one take from a group; false when none is loaded yet.
function sample(dest, group, { at = 0, vol = 1, rate = 1, wobble = 0.06 } = {}) {
  const list = buffers.get(group);
  if (!list?.length) return false;
  const src = ctx.createBufferSource(),
    g = ctx.createGain();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * wobble);
  g.gain.value = vol;
  src.connect(g).connect(dest);
  src.start(now() + at);
  return true;
}

export function unlockAudio() {
  if (!init()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (wantMood !== mood) startMusic(wantMood);
  else if (activeTrack?.audio.paused) playTrack(activeTrack);
}
for (const ev of ["pointerdown", "keydown", "touchstart"])
  window.addEventListener(ev, unlockAudio, { passive: true });

export const soundOn = () => enabled;
export const musicOn = () => musicEnabled;
export function setSound(on) {
  enabled = on;
  writePref("tilmo-sound", on);
  if (ctx) master.gain.setTargetAtTime(on ? MASTER_LEVEL : 0, ctx.currentTime, 0.05);
}
export function setMusic(on) {
  musicEnabled = on;
  writePref("tilmo-music", on);
  if (ctx) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3);
}

// ---------- building blocks ----------
const now = () => ctx.currentTime;

function out(bus = sfxBus, wet = 0) {
  const g = ctx.createGain();
  g.gain.value = effectLevel;
  g.connect(bus);
  if (wet) {
    const s = ctx.createGain();
    s.gain.value = wet;
    g.connect(s).connect(reverb);
  }
  return g;
}

// Pitched voice with attack/decay envelope and optional pitch slide.
function osc(
  dest,
  {
    type = "sine",
    f = 440,
    to = null,
    at = 0,
    dur = 0.2,
    vol = 0.2,
    attack = 0.004,
    detune = 0,
  },
) {
  const t = now() + at,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Filtered noise burst; filter frequency can sweep (whooshes, impacts).
function noise(
  dest,
  {
    at = 0,
    dur = 0.2,
    vol = 0.3,
    type = "bandpass",
    f = 1200,
    to = null,
    q = 1,
    attack = 0.005,
  },
) {
  const t = now() + at,
    src = ctx.createBufferSource(),
    filt = ctx.createBiquadFilter(),
    g = ctx.createGain();
  src.buffer = noiseBuf;
  src.loop = true;
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, t);
  if (to) filt.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(dest);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

// Struck metal: inharmonic partials (anvil, sword ring, ching cymbal).
function metal(dest, { f = 900, at = 0, dur = 0.5, vol = 0.12 }) {
  for (const [ratio, v] of [
    [1, 1],
    [2.76, 0.6],
    [5.4, 0.35],
    [8.93, 0.2],
  ])
    osc(dest, { f: f * ratio, at, dur: dur / ratio ** 0.3, vol: vol * v });
}

// Wooden bar (ranat) / plucked string (khim) voice used by music and UI.
function bar(dest, { f, at = 0, dur = 0.6, vol = 0.18 }) {
  osc(dest, { f, at, dur, vol, type: "sine", attack: 0.002 });
  osc(dest, { f: f * 3.9, at, dur: dur * 0.25, vol: vol * 0.25 });
  osc(dest, {
    f: f * 2,
    at,
    dur: dur * 0.5,
    vol: vol * 0.18,
    type: "triangle",
  });
}

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- effects ----------
const SFX = {
  // Hero attacks: recorded swings and casts with a synth layer for weight.
  swing() {
    const d = out(sfxBus, 0.08), pitch = rnd(0.9, 1.12);
    if (sample(d, "swing", { vol: 0.9, rate: pitch })) {
      osc(d, { type: "triangle", f: 240 * pitch, to: 80, dur: 0.12, vol: 0.07 });
      return;
    }
    noise(d, { dur: 0.18, vol: 0.36, f: 650 * pitch, to: 4200 * pitch, q: 0.7, attack: 0.035 });
    osc(d, { type: "triangle", f: 260 * pitch, to: 95, dur: 0.14, vol: 0.09 });
  },
  slash() {
    const d = out(sfxBus, 0.18), pitch = rnd(0.94, 1.06);
    const ok = sample(d, "slash", { vol: 0.95, rate: pitch });
    sample(d, "swing", { vol: 0.7, rate: 0.75, at: 0.03 });
    osc(d, { f: 150 * pitch, to: 40, at: 0.04, dur: 0.32, vol: 0.32 });
    if (!ok) noise(d, { dur: 0.27, vol: 0.48, f: 380 * pitch, to: 4800, q: 0.8, attack: 0.045 });
  },
  arrow(at = 0) {
    if (typeof at !== "number") at = 0;
    const d = out(sfxBus, 0.07), pitch = rnd(0.94, 1.08);
    // Bowstring twang: a plucked low note that bends down, then the swish.
    osc(d, { type: "triangle", f: 330 * pitch, to: 140, at, dur: 0.16, vol: 0.2, attack: 0.002 });
    osc(d, { type: "sine", f: 660 * pitch, to: 300, at, dur: 0.08, vol: 0.08, attack: 0.002 });
    if (!sample(d, "swing", { at: at + 0.02, vol: 0.75, rate: 1.7 * pitch }))
      noise(d, { at: at + 0.025, dur: 0.2, vol: 0.22, f: 1800 * pitch, to: 6500, q: 1.1, attack: 0.025 });
  },
  volley() {
    // Audio-clock offsets keep all three shots tight even on a busy frame.
    for (let i = 0; i < 3; i++) SFX.arrow(i * 0.065);
    osc(out(sfxBus, 0.14), { f: 125, to: 60, dur: 0.25, vol: 0.16 });
  },
  cast() {
    const d = out(sfxBus, 0.25), pitch = rnd(0.97, 1.05);
    if (sample(d, "cast", { vol: 0.75, rate: pitch })) return;
    noise(d, { dur: 0.19, vol: 0.18, f: 1000, to: 5500, q: 1.2, attack: 0.03 });
    osc(d, { f: 340 * pitch, to: 1000 * pitch, dur: 0.18, vol: 0.1, attack: 0.02 });
  },
  spell() {
    const d = out(sfxBus, 0.3);
    const ok = sample(d, "fire", { vol: 0.95 });
    sample(d, "cast", { vol: 0.5, rate: 0.8 });
    osc(d, { f: 200, to: 45, at: 0.05, dur: 0.45, vol: 0.34 });
    if (!ok) noise(d, { dur: 0.38, vol: 0.28, f: 450, to: 4500, q: 0.7, attack: 0.06 });
  },
  // Priest: a bright bell over the cast swell.
  holy() {
    const d = out(sfxBus, 0.35), pitch = rnd(0.98, 1.04);
    sample(d, "cast", { vol: 0.55, rate: 1.35 * pitch });
    [1046, 1568].forEach((f, i) => osc(d, { f: f * pitch, at: i * 0.05, dur: 0.5, vol: 0.06, attack: 0.005 }));
  },
  smite() {
    const d = out(sfxBus, 0.45);
    sample(d, "cast", { vol: 0.7, rate: 1.1 });
    osc(d, { f: 180, to: 50, at: 0.06, dur: 0.4, vol: 0.3 });
    [784, 1175, 1568, 2093].forEach((f, i) => osc(d, { f, at: i * 0.045, dur: 0.6, vol: 0.05, attack: 0.005 }));
  },
  // Contact: a recorded hit per weapon over a short synth punch.
  hit(arg = {}) {
    const d = out(sfxBus, 0.06), pitch = rnd(0.88, 1.12);
    osc(d, { f: 170 * pitch, to: 50, dur: 0.12, vol: 0.3 });
    noise(d, { dur: 0.035, vol: 0.3, f: 2600 * pitch, to: 700, q: 0.7 });
    const cls = arg?.class;
    if (cls === "priest") {
      osc(d, { f: 1318 * pitch, dur: 0.25, vol: 0.05, attack: 0.003 });
      if (!sample(d, "thud", { vol: 0.6, rate: 1.2 * pitch })) noise(d, { dur: 0.1, vol: 0.08, f: 3800, type: "highpass" });
    } else if (cls === "mage") {
      if (!sample(d, "fire", { vol: 0.45, rate: 1.5 * pitch })) noise(d, { dur: 0.13, vol: 0.1, f: 4200, type: "highpass" });
    } else if (cls === "archer") {
      if (!sample(d, "thud", { vol: 0.9, rate: pitch })) osc(d, { type: "triangle", f: 650 * pitch, to: 170, dur: 0.065, vol: 0.08 });
    } else if (!sample(d, "blade", { vol: 0.9, rate: pitch })) metal(d, { f: 1050 * pitch, dur: 0.12, vol: 0.018 });
  },
  // Crits ring out: the hit, a metal clang, a deep boom and a bright sparkle.
  crit(arg) {
    SFX.hit(arg);
    const d = out(sfxBus, 0.22);
    sample(d, "clang", { vol: 0.75, rate: rnd(1.05, 1.25) });
    sample(d, "thud", { vol: 0.8, rate: 0.6 });
    osc(d, { f: 95, to: 32, dur: 0.32, vol: 0.42 });
    noise(d, { dur: 0.09, vol: 0.28, f: 3800, to: 900 });
    [1319, 1760].forEach((f, i) => osc(d, { f, at: 0.03 + i * 0.04, dur: 0.22, vol: 0.05 }));
  },
  hurt() {
    const d = out(sfxBus, 0.05);
    osc(d, { f: 95, to: 50, dur: 0.22, vol: 0.5 });
    osc(d, { type: "sawtooth", f: 260, to: 170, dur: 0.15, vol: 0.05 });
    noise(d, { dur: 0.15, vol: 0.4, f: 900, to: 300, type: "lowpass" });
  },
  kill() {
    const d = out(sfxBus, 0.25);
    if (sample(d, "die", { vol: 0.8, rate: rnd(0.95, 1.3) })) {
      osc(d, { f: 1046, at: 0.12, dur: 0.25, vol: 0.05 }); // little reward ping
      return;
    }
    osc(d, { type: "square", f: 520, to: 90, dur: 0.28, vol: 0.05 });
    noise(d, { at: 0.04, dur: 0.35, vol: 0.4, f: 3000, to: 400, q: 0.6 });
    osc(d, { f: 1046, at: 0.12, dur: 0.25, vol: 0.05 }); // little reward ping
  },
  bossDown() {
    const d = out(sfxBus, 0.6);
    sample(d, "roar", { vol: 1, rate: 0.55, wobble: 0 });
    osc(d, { f: 80, to: 30, dur: 1.4, vol: 0.6 });
    noise(d, { dur: 1.3, vol: 0.5, f: 1200, to: 120, type: "lowpass" });
    [523, 659, 784, 1047].forEach((f, i) =>
      bar(d, { f, at: 0.5 + i * 0.12, dur: 1, vol: 0.14 }),
    );
  },
  slam() {
    const d = out(sfxBus, 0.4);
    osc(d, { f: 70, to: 28, dur: 0.7, vol: 0.7 });
    noise(d, { dur: 0.6, vol: 0.55, f: 600, to: 80, type: "lowpass" });
  },
  roar() {
    const d = out(sfxBus, 0.5);
    if (sample(d, "roar", { vol: 1, rate: 0.72 })) {
      osc(d, { f: 60, to: 35, dur: 0.9, vol: 0.3, attack: 0.1 });
      return;
    }
    osc(d, {
      type: "sawtooth",
      f: 90,
      to: 60,
      dur: 0.9,
      vol: 0.12,
      attack: 0.15,
    });
    osc(d, {
      type: "sawtooth",
      f: 93,
      to: 58,
      dur: 0.9,
      vol: 0.1,
      attack: 0.15,
    });
    noise(d, { dur: 0.9, vol: 0.3, f: 400, to: 200, q: 2, attack: 0.2 });
  },
  // Movement.
  step() {
    const d = out(sfxBus);
    noise(d, { dur: 0.06, vol: 0.12, f: rnd(700, 1100), q: 2.5 });
    osc(d, { f: rnd(90, 110), to: 60, dur: 0.05, vol: 0.08 });
  },
  jump() {
    const d = out(sfxBus);
    noise(d, { dur: 0.14, vol: 0.16, f: 600, to: 2400, q: 1.5, attack: 0.02 });
  },
  land() {
    const d = out(sfxBus);
    osc(d, { f: 120, to: 55, dur: 0.1, vol: 0.25 });
    noise(d, { dur: 0.08, vol: 0.18, f: 700, type: "lowpass" });
  },
  // Rewards and UI.
  coin() {
    const d = out(sfxBus, 0.2);
    if (sample(d, "coin", { vol: 0.6, rate: rnd(1, 1.15) })) return;
    osc(d, { f: 1568, dur: 0.12, vol: 0.08 });
    osc(d, { f: 2093, at: 0.07, dur: 0.3, vol: 0.08 });
  },
  levelUp() {
    const d = out(sfxBus, 0.5);
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      bar(d, { f, at: i * 0.08, dur: 0.9, vol: 0.16 }),
    );
    noise(d, { at: 0.3, dur: 0.8, vol: 0.12, f: 6000, type: "highpass" });
  },
  click() {
    bar(out(sfxBus, 0.05), { f: rnd(780, 820), dur: 0.12, vol: 0.09 });
  },
  open() {
    const d = out(sfxBus, 0.15);
    bar(d, { f: 587, dur: 0.25, vol: 0.1 });
    bar(d, { f: 880, at: 0.06, dur: 0.3, vol: 0.08 });
  },
  close() {
    const d = out(sfxBus, 0.1);
    bar(d, { f: 784, dur: 0.2, vol: 0.08 });
    bar(d, { f: 523, at: 0.05, dur: 0.25, vol: 0.08 });
  },
  talk() {
    const d = out(sfxBus, 0.1);
    for (let i = 0; i < 3; i++)
      bar(d, { f: rnd(500, 700), at: i * 0.07, dur: 0.1, vol: 0.06 });
  },
  portal() {
    const d = out(sfxBus, 0.7);
    noise(d, { dur: 1.2, vol: 0.35, f: 300, to: 3000, q: 0.8, attack: 0.4 });
    for (let i = 0; i < 6; i++)
      osc(d, { f: 392 * 1.335 ** (i % 4), at: i * 0.1, dur: 0.8, vol: 0.05 });
  },
  clear() {
    const d = out(sfxBus, 0.4);
    [392, 523, 659, 784].forEach((f, i) =>
      bar(d, { f, at: i * 0.11, dur: 0.7, vol: 0.15 }),
    );
    metal(d, { f: 2400, at: 0.45, dur: 0.8, vol: 0.04 });
  },
  death() {
    const d = out(sfxBus, 0.5);
    [392, 349, 311, 262].forEach((f, i) =>
      bar(d, { f, at: i * 0.22, dur: 0.9, vol: 0.13 }),
    );
    osc(d, { f: 98, to: 49, at: 0.2, dur: 1.4, vol: 0.25 });
  },
  potion() {
    const d = out(sfxBus, 0.2);
    for (let i = 0; i < 4; i++)
      osc(d, {
        f: rnd(500, 900),
        to: rnd(900, 1400),
        at: i * 0.05,
        dur: 0.08,
        vol: 0.06,
      });
    bar(d, { f: 1047, at: 0.25, dur: 0.5, vol: 0.08 });
  },
  // Loot by rarity; equip and forge.
  loot(rarity = "common") {
    const d = out(sfxBus, 0.5),
      notes = {
        common: [659, 784],
        rare: [587, 784, 988],
        epic: [523, 659, 784, 1047],
        legendary: [523, 659, 784, 1047, 1319, 1568],
        divine: [659, 988, 1319, 1568, 1976, 2637],
      }[rarity] || [659, 784];
    notes.forEach((f, i) => bar(d, { f, at: i * 0.09, dur: 0.8, vol: 0.13 }));
    if (rarity === "epic" || rarity === "legendary")
      noise(d, { at: 0.2, dur: 1.2, vol: 0.14, f: 7000, type: "highpass" });
    if (rarity === "legendary")
      osc(d, { f: 131, dur: 1.6, vol: 0.2, attack: 0.3 });
  },
  equip() {
    const d = out(sfxBus, 0.15);
    noise(d, { dur: 0.08, vol: 0.25, f: 2500, q: 2 });
    metal(d, { f: 1100, at: 0.03, dur: 0.3, vol: 0.05 });
  },
  buy() {
    SFX.coin();
    bar(out(sfxBus, 0.1), { f: 1319, at: 0.12, dur: 0.3, vol: 0.07 });
  },
  forgeOk() {
    const d = out(sfxBus, 0.4);
    metal(d, { f: 620, dur: 0.6, vol: 0.12 });
    metal(d, { f: 620, at: 0.22, dur: 0.6, vol: 0.12 });
    [784, 988, 1175, 1568].forEach((f, i) =>
      bar(d, { f, at: 0.45 + i * 0.07, dur: 0.7, vol: 0.12 }),
    );
  },
  forgeFail() {
    const d = out(sfxBus, 0.3);
    metal(d, { f: 620, dur: 0.6, vol: 0.12 });
    noise(d, {
      at: 0.2,
      dur: 0.4,
      vol: 0.4,
      f: 2000,
      to: 300,
      type: "lowpass",
    });
    osc(d, { type: "sawtooth", f: 160, to: 90, at: 0.2, dur: 0.4, vol: 0.06 });
  },
  material() {
    const d = out(sfxBus, 0.3);
    metal(d, { f: 1800, dur: 0.5, vol: 0.05 });
    bar(d, { f: 988, at: 0.08, dur: 0.5, vol: 0.1 });
  },
  // TILMO gunner: short punchy shot (no recorded gun take in the CC0 pack).
  shot(arg = {}) {
    const d = out(sfxBus, 0.04), pitch = rnd(0.92, 1.1) * (arg.heavy ? 0.7 : 1);
    noise(d, { dur: 0.09, vol: 0.42, f: 2600 * pitch, to: 600, q: 0.9, attack: 0.002 });
    osc(d, { type: "square", f: 190 * pitch, to: 55, dur: 0.09, vol: 0.08 });
    if (arg.heavy) osc(d, { f: 90, to: 35, dur: 0.22, vol: 0.22 });
  },
  hazard() {
    const d = out(sfxBus, 0.3);
    osc(d, { type: "square", f: 880, dur: 0.08, vol: 0.03 });
    osc(d, { type: "square", f: 880, at: 0.14, dur: 0.08, vol: 0.03 });
  },
};

// Play an effect. Rapid repeats of the same effect are thinned so crowds of
// hits don't clip; gap is the minimum spacing in seconds.
export function sfx(name, arg, gap = 0.03) {
  if (!enabled || !SFX[name] || !init()) return;
  if (ctx.state === "suspended") return;
  const t = ctx.currentTime;
  if (t - (lastPlayed.get(name) || -1) < gap) return;
  lastPlayed.set(name, t);
  try {
    effectLevel = Math.max(0, Math.min(1, arg?.volume ?? 1));
    SFX[name](arg);
  } catch {} finally {
    effectLevel = 1;
  }
}

// ---------- music ----------
// Local recordings avoid third-party streaming dependencies during play.
const TRACKS = {
  town: { src: "/assets/music/town.mp3", gain: 0.8 },
  field: { src: "/assets/music/battle.mp3", gain: 0.7 },
  boss: { src: "/assets/music/boss-epic.ogg", gain: 0.75 },
};
const FADE = 1.2;
const preparedTracks = new Map();
let preparingMusic;
// Keep the town recording in memory so entering the game starts it at once.
// Dungeon and boss tracks (~5 MB) stream on first use from the HTTP cache, so
// low-memory tablets don't hold every recording as a blob.
export function prepareMusic() {
  if (!musicEnabled) return Promise.resolve();
  return preparingMusic ||= (async () => {
    for (const { src } of [TRACKS.town]) {
      try {
        const response = await fetch(src);
        if (response.ok) preparedTracks.set(src, URL.createObjectURL(await response.blob()));
      } catch { /* Music is optional; a failed recording must not block entry. */ }
    }
  })();
}

function playTrack(track) {
  // Autoplay may be blocked until a gesture; unlockAudio retries the active track.
  const pending = track.audio.play();
  if (pending?.catch) pending.catch(() => {});
}

function startMusic(name) {
  const previous = activeTrack;
  activeTrack = null;
  mood = name;
  if (previous) {
    previous.gain.gain.cancelScheduledValues(now());
    previous.gain.gain.setValueAtTime(previous.gain.gain.value, now());
    previous.gain.gain.linearRampToValueAtTime(0, now() + FADE);
    setTimeout(() => {
      previous.audio.pause();
      previous.audio.removeAttribute("src");
      previous.audio.load();
      previous.source.disconnect();
      previous.gain.disconnect();
    }, (FADE + 0.1) * 1000);
  }
  const config = TRACKS[name];
  if (!config || !ctx) return;
  const audio = new Audio(preparedTracks.get(config.src) || config.src);
  audio.loop = true;
  audio.preload = "auto";
  const source = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now());
  gain.gain.linearRampToValueAtTime(config.gain, now() + FADE);
  source.connect(gain).connect(musicBus);
  activeTrack = { audio, source, gain };
  playTrack(activeTrack);
}

// Switch area music; repeated snapshots leave the current recording playing.
export function music(name) {
  wantMood = Object.hasOwn(TRACKS, name) ? name : null;
  if (ctx && ctx.state !== "suspended" && wantMood !== mood)
    startMusic(wantMood);
}
