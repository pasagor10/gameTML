// Boss arena mechanics. Each floor boss cycles through its own set; the
// server schedules and resolves them, the client draws the warnings, and
// auto play reads the same data to get out of the way.
//
//   rocks     – rocks fall from the ceiling onto marked spots (any height).
//   flood     – water fills the arena floor; only heroes up on a ledge live.
//   spikes    – alternating stripes of the floor erupt; stand in the gaps.
//   lightning – a bolt marks each hero and strikes a moment later, twice.
export const GROUND = 600;
// Water surface while flooded: the floor and anything near it is under.
export const WATER_Y = GROUND - 65; // every boss-stage step and ledge (y <= 528) stays dry
export const MECHANICS = {
  rocks: { name: "หินถล่ม", icon: "🪨", hint: "ดูเงาบนพื้นแล้วเดินหลบ" },
  flood: { name: "น้ำท่วม", icon: "🌊", hint: "ขึ้นไปยืนบนชั้น ยืนพื้นจะจมน้ำตาย" },
  spikes: { name: "หนามปะทุ", icon: "⛰", hint: "ยืนในช่องว่างระหว่างแถบหนาม" },
  lightning: { name: "อัสนีตามตัว", icon: "⚡", hint: "ขยับออกจากวงก่อนฟ้าผ่า" },
};
// Floors 1–15 each get their own mix, easiest first; the deep floors reuse
// the two-or-more mixes with harder tuning (more rocks, shorter gaps).
const COMBOS = [
  ["rocks"],
  ["spikes"],
  ["flood"],
  ["lightning"],
  ["rocks", "spikes"],
  ["flood", "rocks"],
  ["lightning", "spikes"],
  ["rocks", "lightning"],
  ["flood", "spikes"],
  ["rocks", "flood", "lightning"],
  ["flood", "lightning"],
  ["spikes", "lightning", "rocks"],
  ["flood", "spikes", "lightning"],
  ["rocks", "flood", "spikes"],
  ["rocks", "flood", "spikes", "lightning"],
];
// The first floors add one mechanic at a time, ground ones first: nothing on
// floor 1, then spikes, lightning, falling rocks, and the flood from floor 5.
const EARLY = [[], ["spikes"], ["lightning"], ["rocks"], ["flood"]];
export function bossMechanics(floor = 1) {
  const f = Math.max(1, Math.floor(floor) || 1);
  if (f <= EARLY.length) return EARLY[f - 1];
  return f <= COMBOS.length ? COMBOS[f - 1] : COMBOS[4 + ((f - 16) % (COMBOS.length - 4))];
}
// The world boss is tanky rather than brutal: only the dodgeable ones, softer.
export const WORLD_MECHANICS = ["rocks", "lightning", "spikes"];
export const NIGHT_MECHANICS = ["rocks", "lightning"];
// The 20:00 grand boss throws everything, flood included.
export const GRAND_MECHANICS = ["rocks", "flood", "spikes", "lightning"];

// Share of max HP one hit takes. The flood hits every half second while a
// hero is in the water, so standing in it is lethal in about 1.5 s.
// World bosses hit at this share of a floor boss (tanky, not brutal).
export const WORLD_HIT_SCALE = 0.6;
export const mechanicDamage = (kind, floor, world = false) => {
  const base = { rocks: 0.35, spikes: 0.38, lightning: 0.3, flood: 0.4 }[kind] || 0.35;
  const scaled = kind === "flood" ? base : base + Math.min(40, floor) * 0.004;
  return world ? scaled * WORLD_HIT_SCALE : scaled;
};
// Boss slams and swings never drop below this share of the hero's max HP,
// so an over-levelled hero still has to respect them.
export const BOSS_SLAM_PCT = 0.3;
export const BOSS_HIT_PCT = 0.1;
// Seconds between two mechanics (shorter deeper down and when the boss is hurt).
export const mechanicGap = (floor, enraged) =>
  Math.max(6, 10 - Math.min(40, floor) * 0.1) * (enraged ? 0.8 : 1);
export const FLOOD_WARN = 3.5;
export const FLOOD_LAST = 4.5;
export const ROCK_RADIUS = 58;
export const BOLT_RADIUS = 72;
export const SPIKE_BAND = 180;
export const rockCount = (floor, world = false) =>
  world ? 7 : Math.min(8, 3 + Math.floor(floor / 8));

// Pending strikes a hero standing at x (and y) is inside right now.
export function strikesAt(mech, x, y, t) {
  if (!mech) return [];
  if (mech.kind === "rocks" || mech.kind === "lightning")
    return mech.strikes.filter((s) => !s.done && t < s.impactAt && Math.abs(x - s.x) < s.radius + 20);
  if (mech.kind === "spikes")
    return Math.abs(y - GROUND) < 65 && !mech.done && t < mech.impactAt && inSpikeBand(mech, x)
      ? [{ x: spikeGapCenter(mech, x), impactAt: mech.impactAt }]
      : [];
  return [];
}
export const inSpikeBand = (mech, x) =>
  Math.floor((x - mech.phase) / SPIKE_BAND) % 2 === 0;
// Middle of the nearest safe gap to x.
export function spikeGapCenter(mech, x) {
  const band = Math.floor((x - mech.phase) / SPIKE_BAND);
  if (!inSpikeBand(mech, x)) return mech.phase + band * SPIKE_BAND + SPIKE_BAND / 2;
  const left = mech.phase + (band - 1) * SPIKE_BAND + SPIKE_BAND / 2,
    right = mech.phase + (band + 1) * SPIKE_BAND + SPIKE_BAND / 2;
  return Math.abs(left - x) <= Math.abs(right - x) ? left : right;
}
// The flood is coming or the water is up.
export const flooding = (mech, t) => mech?.kind === "flood" && t < mech.endsAt;
export const underwater = (y) => y > WATER_Y;
