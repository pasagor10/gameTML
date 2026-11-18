// Game audio: local CC0 music recordings and synthesised WebAudio effects.
// Track sources and license details: /assets/music/CREDITS.md
//
//   import { sfx, music, setSound, soundOn, unlockAudio } from "/sound.js?v=20261118-combat2";
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
  enabled = readPref("tml-sound", true),
  musicEnabled = readPref("tml-music", true),
  mood = null,
  wantMood = null,
  activeTrack = null;
const lastPlayed = new Map();
let effectLevel = 1;

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
  master.gain.value = enabled ? 0.9 : 0;
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
  writePref("tml-sound", on);
  if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
}
export function setMusic(on) {
  musicEnabled = on;
  writePref("tml-music", on);
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
  // Hero attacks: one per class, and heavier skill variants.
  swing() {
    const d = out(sfxBus, 0.08), pitch = rnd(0.9, 1.12);
    noise(d, { dur: 0.18, vol: 0.36, f: 650 * pitch, to: 4200 * pitch, q: 0.7, attack: 0.035 });
    noise(d, { at: 0.035, dur: 0.09, vol: 0.14, f: 6500, to: 1800, q: 0.5 });
    osc(d, { type: "triangle", f: 260 * pitch, to: 95, dur: 0.14, vol: 0.09 });
  },
  slash() {
    const d = out(sfxBus, 0.16), pitch = rnd(0.94, 1.06);
    noise(d, { dur: 0.27, vol: 0.48, f: 380 * pitch, to: 4800, q: 0.8, attack: 0.045 });
    noise(d, { at: 0.09, dur: 0.16, vol: 0.24, f: 3800, to: 700 });
    osc(d, { f: 155 * pitch, to: 42, at: 0.045, dur: 0.3, vol: 0.3 });
    metal(d, { f: 780 * pitch, at: 0.07, dur: 0.22, vol: 0.024 });
  },
  arrow(at = 0) {
    if (typeof at !== "number") at = 0;
    const d = out(sfxBus, 0.07), pitch = rnd(0.94, 1.08);
    osc(d, { type: "triangle", f: 420 * pitch, to: 115, at, dur: 0.12, vol: 0.15 });
    noise(d, { at, dur: 0.045, vol: 0.21, f: 1700, type: "highpass" });
    noise(d, { at: at + 0.025, dur: 0.2, vol: 0.22, f: 1800 * pitch, to: 6500, q: 1.1, attack: 0.025 });
  },
  volley() {
    // Audio-clock offsets keep all three shots tight even on a busy frame.
    for (let i = 0; i < 3; i++) SFX.arrow(i * 0.065);
    osc(out(sfxBus, 0.14), { f: 125, to: 60, dur: 0.25, vol: 0.16 });
  },
  cast() {
    const d = out(sfxBus, 0.22), pitch = rnd(0.97, 1.04);
    noise(d, { dur: 0.19, vol: 0.18, f: 1000, to: 5500, q: 1.2, attack: 0.03 });
    osc(d, { f: 340 * pitch, to: 1000 * pitch, dur: 0.18, vol: 0.1, attack: 0.02 });
    [1, 1.5, 2].forEach((r, i) => osc(d, { f: 620 * pitch * r, at: 0.035 + i * 0.025, dur: 0.23, vol: 0.045 }));
  },
  spell() {
    const d = out(sfxBus, 0.28);
    noise(d, { dur: 0.38, vol: 0.28, f: 450, to: 4500, q: 0.7, attack: 0.06 });
    osc(d, { f: 210, to: 48, at: 0.06, dur: 0.42, vol: 0.32 });
    [523, 784, 1047, 1568].forEach((f, i) => osc(d, { f, at: 0.04 + i * 0.035, dur: 0.38, vol: 0.045 }));
  },
  // A short transient, low body and weapon-specific tail make contact readable.
  hit(arg = {}) {
    const d = out(sfxBus, 0.06), pitch = rnd(0.88, 1.12);
    osc(d, { f: 185 * pitch, to: 55, dur: 0.12, vol: 0.32 });
    noise(d, { dur: 0.045, vol: 0.38, f: 2400 * pitch, to: 650, q: 0.7 });
    noise(d, { at: 0.018, dur: 0.12, vol: 0.17, f: 700, to: 180, type: "lowpass" });
    if (arg?.class === "mage") {
      osc(d, { f: 920 * pitch, to: 310, dur: 0.17, vol: 0.065 });
      noise(d, { dur: 0.13, vol: 0.1, f: 4200, type: "highpass" });
    } else if (arg?.class === "archer") {
      osc(d, { type: "triangle", f: 650 * pitch, to: 170, dur: 0.065, vol: 0.08 });
    } else metal(d, { f: 1050 * pitch, dur: 0.12, vol: 0.018 });
  },
  crit(arg) {
    SFX.hit(arg);
    const d = out(sfxBus, 0.16);
    osc(d, { f: 105, to: 36, dur: 0.25, vol: 0.3 });
    noise(d, { dur: 0.08, vol: 0.25, f: 3500, to: 900 });
    [1175, 1568].forEach((f, i) => osc(d, { f, at: 0.02 + i * 0.035, dur: 0.19, vol: 0.045 }));
  },
  hurt() {
    const d = out(sfxBus, 0.05);
    osc(d, { f: 95, to: 50, dur: 0.22, vol: 0.5 });
    osc(d, { type: "sawtooth", f: 260, to: 170, dur: 0.15, vol: 0.05 });
    noise(d, { dur: 0.15, vol: 0.4, f: 900, to: 300, type: "lowpass" });
  },
  kill() {
    const d = out(sfxBus, 0.25);
    osc(d, { type: "square", f: 520, to: 90, dur: 0.28, vol: 0.05 });
    noise(d, { at: 0.04, dur: 0.35, vol: 0.4, f: 3000, to: 400, q: 0.6 });
    osc(d, { f: 1046, at: 0.12, dur: 0.25, vol: 0.05 }); // little reward ping
  },
  bossDown() {
    const d = out(sfxBus, 0.6);
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
  dungeon: { src: "/assets/music/dungeon.ogg", gain: 0.8 },
  boss: { src: "/assets/music/boss.ogg", gain: 0.72 },
};
const FADE = 1.2;

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
  const audio = new Audio(config.src);
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
