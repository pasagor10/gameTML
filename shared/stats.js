// Ragnarok-style base stats: STR AGI VIT INT DEX LUK.
//
// Every stat starts at 1 and is raised with status points earned on level up.
// A raise costs more the higher the stat already is, so a hero pushes one or
// two stats and spreads the rest. Each class has its own attack stat (STR for
// the swordsman, DEX for the archer, INT for mage and priest): the other
// attack stats only count for a quarter, so a build has to suit its class.
// The server validates every raise; the client uses the same rules to preview.

export const STAT_KEYS = ["str", "agi", "vit", "int", "dex", "luk"];
export const STAT_MAX = 99;
export const STAT_INFO = {
  str: { name: "STR", label: "พลัง", icon: "💪", color: "#ff8a5c", text: "ATK ของนักดาบ" },
  agi: { name: "AGI", label: "ว่องไว", icon: "💨", color: "#7fe0a8", text: "ความเร็วโจมตี (ASPD) · หลบหลีก (FLEE)" },
  vit: { name: "VIT", label: "อึด", icon: "❤", color: "#ff6b7d", text: "HP สูงสุด · DEF · ฟื้น HP" },
  int: { name: "INT", label: "ปัญญา", icon: "✦", color: "#b89bff", text: "MATK ของจอมเวท/พระ · MP · พลังฮีล" },
  dex: { name: "DEX", label: "แม่นยำ", icon: "◎", color: "#ffd166", text: "ATK ของนักธนู · ร่ายเร็ว · ATK เล็กน้อยทุกคลาส" },
  luk: { name: "LUK", label: "โชค", icon: "☘", color: "#6fd3ff", text: "คริติคอล · ดาเมจคริ · หลบสมบูรณ์ · ทองที่ได้" },
};
// The stat each class attacks with.
export const PRIMARY = { swordsman: "str", archer: "dex", mage: "int", priest: "int" };
export const ATTACK_STATS = ["str", "dex", "int"];
export const OFF_CLASS = 0.25;

// Status points granted on reaching `level` (none at Lv.1).
export const pointsForLevel = (level) => (level > 1 ? 3 + Math.floor(level / 5) : 0);
export function pointsAt(level) {
  let n = 0;
  for (let l = 2; l <= level; l++) n += pointsForLevel(l);
  return n;
}
// Points to raise a stat from `value` to value + 1.
export const raiseCost = (value) => Math.floor((value - 1) / 10) + 2;
// Points spent to bring a stat from 1 up to `value`.
export function spentOn(value) {
  let n = 0;
  for (let v = 1; v < value; v++) n += raiseCost(v);
  return n;
}

const clampStat = (v) =>
  Math.max(1, Math.min(STAT_MAX, Number.isSafeInteger(v) ? v : 1));
// The hero's allocated stats, each 1..99 (missing ones count as 1).
export function baseStats(p) {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, clampStat(p?.attrs?.[k])]));
}
export function freePoints(p) {
  const base = baseStats(p);
  return pointsAt(p?.level || 1) - STAT_KEYS.reduce((n, k) => n + spentOn(base[k]), 0);
}

// Job bonus: free stats from the specialization (Lv.3), doubled by the
// advancement (Lv.20). A base-class novice has none, like RO.
export const JOB_BONUS = {
  swordsman: { guardian: { vit: 3, str: 2 }, duelist: { str: 3, agi: 2 } },
  archer: { ranger: { dex: 3, luk: 2 }, scout: { agi: 3, dex: 2 } },
  mage: { arcanist: { int: 3, dex: 2 }, oracle: { int: 2, vit: 3 } },
  priest: { bishop: { int: 3, vit: 2 }, templar: { vit: 3, int: 2 } },
};
export function jobBonus(p) {
  const table = JOB_BONUS[p?.class] || {},
    out = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
    spec = p?.specialization && table[p.specialization];
  for (const [k, v] of Object.entries(spec || {})) out[k] += v * (p.advanced ? 2 : 1);
  return out;
}
// Allocated + job bonus: what every formula reads.
export function totalStats(p) {
  const base = baseStats(p),
    job = jobBonus(p);
  return Object.fromEntries(STAT_KEYS.map((k) => [k, base[k] + job[k]]));
}

// Attack from one attack stat: linear, plus a bonus every 10 points like RO.
const attackFrom = (v) => (v - 1) * 1.2 + Math.floor((v - 1) / 10) ** 2;
export const ASPD_CAP = 1.8;
export const FLEE_CAP = 0.35;
export const DODGE_CAP = 0.4;
export const CAST_CAP = 0.4;
// Archer rapid fire: chance a basic shot looses a second arrow, and the
// "lightning draw" haste after a crit once AGI reaches LIGHTNING_AGI.
export const DOUBLE_PER_AGI = 0.005;
export const DOUBLE_CAP = 0.45;
export const LIGHTNING_AGI = 40;
export const LIGHTNING = { duration: 3, aspd: 0.2 };

// Everything the stats add, read by shared/config.js combatStats.
export function statEffects(p) {
  const s = totalStats(p),
    main = PRIMARY[p?.class] || "str";
  let atk = 0;
  for (const k of ATTACK_STATS) atk += attackFrom(s[k]) * (k === main ? 1 : OFF_CLASS);
  if (main !== "dex") atk += (s.dex - 1) * 0.3;
  const agi = s.agi - 1,
    luk = s.luk - 1;
  return {
    stats: s,
    atk: Math.floor(atk),
    hpPct: (s.vit - 1) * 0.01,
    hpFlat: (s.vit - 1) * 3,
    mpPct: (s.int - 1) * 0.01,
    mpFlat: (s.int - 1) * 2,
    def: Math.floor((s.vit - 1) * 0.5),
    aspd: Math.min(ASPD_CAP, 1 + agi * 0.012 + (s.dex - 1) * 0.003),
    flee: Math.min(FLEE_CAP, agi * 0.004),
    perfect: luk * 0.001,
    crit: luk * 0.003,
    critDamage: luk * 0.005,
    cast: Math.min(CAST_CAP, (s.dex - 1) * 0.006),
    heal: (s.int - 1) * 0.01,
    range: p?.class === "archer" ? Math.round((s.dex - 1) * 0.6) : 0,
    hpRegen: (s.vit - 1) * 0.05,
    mpRegen: (s.int - 1) * 0.03,
    gold: luk * 0.005,
    double: p?.class === "archer" ? Math.min(DOUBLE_CAP, agi * DOUBLE_PER_AGI) : 0,
    lightning: p?.class === "archer" && s.agi >= LIGHTNING_AGI,
  };
}

// Recommended builds: weights of the stats each line pushes, highest first.
export const BUILDS = {
  swordsman: {
    base: { name: "นักดาบสายบู๊", weights: { str: 5, vit: 3, agi: 2 } },
    guardian: { name: "แทงค์แนวหน้า", weights: { vit: 5, str: 3, dex: 2 } },
    duelist: { name: "ตีเร็ว คริแรง", weights: { str: 5, agi: 3, luk: 2 } },
  },
  archer: {
    base: { name: "พลธนู", weights: { dex: 5, agi: 4, luk: 1 } },
    ranger: { name: "ยิงแรง ยิงไกล", weights: { dex: 5, agi: 3, luk: 2 } },
    scout: { name: "ยิงรัว หลบเก่ง", weights: { agi: 5, dex: 4, luk: 2 } },
  },
  mage: {
    base: { name: "เวทแรง ร่ายไว", weights: { int: 5, dex: 3, vit: 2 } },
    arcanist: { name: "เวทแรง ร่ายไว", weights: { int: 5, dex: 3, vit: 2 } },
    oracle: { name: "เวทสมดุล ทนทาน", weights: { int: 5, vit: 3, dex: 2 } },
  },
  priest: {
    base: { name: "ฮีลแรง ทนทาน", weights: { int: 5, vit: 3, dex: 2 } },
    bishop: { name: "ฮีลแรง ทนทาน", weights: { int: 5, vit: 3, dex: 2 } },
    templar: { name: "แสงสายบู๊", weights: { int: 5, vit: 3, str: 2 } },
  },
};
export const buildOf = (p) =>
  BUILDS[p?.class]?.[p?.specialization] || BUILDS[p?.class]?.base || BUILDS.swordsman.base;

// Spends free points along the hero's build: each step raises the stat that
// is furthest below its weight's share. Returns the raises { str: 3, ... }.
export function autoPlan(p) {
  const weights = buildOf(p).weights,
    stats = baseStats(p),
    adds = {};
  let left = freePoints(p);
  for (;;) {
    let best = null;
    for (const [k, w] of Object.entries(weights)) {
      if (stats[k] >= STAT_MAX || raiseCost(stats[k]) > left) continue;
      const score = stats[k] / w;
      if (!best || score < best.score) best = { k, score };
    }
    if (!best) break;
    left -= raiseCost(stats[best.k]);
    stats[best.k]++;
    adds[best.k] = (adds[best.k] || 0) + 1;
  }
  return adds;
}

// Applies raises { str: 2, agi: 1 } to p.stats after checking them.
// Throws with a Thai message when the raise is not allowed.
export function applyRaise(p, adds) {
  if (!adds || typeof adds !== "object") throw Error("ข้อมูลสเตตัสไม่ถูกต้อง");
  const next = baseStats(p);
  let total = 0;
  for (const [k, n] of Object.entries(adds)) {
    if (!STAT_KEYS.includes(k) || !Number.isSafeInteger(n) || n < 0 || n > STAT_MAX)
      throw Error("ข้อมูลสเตตัสไม่ถูกต้อง");
    if (next[k] + n > STAT_MAX) throw Error(`${STAT_INFO[k].name} สูงสุด ${STAT_MAX}`);
    next[k] += n;
    total += n;
  }
  if (!total) throw Error("ยังไม่ได้เลือกสเตตัส");
  const spent = STAT_KEYS.reduce((n, k) => n + spentOn(next[k]), 0);
  if (spent > pointsAt(p.level || 1)) throw Error("แต้มสเตตัสไม่พอ");
  p.attrs = next;
  return next;
}

// Resetting refunds every point. The first reset is free, then it costs more each time.
export const RESET_BASE = 300;
export const resetCost = (p) => RESET_BASE * (p?.statResets || 0);
