// Day/night cycle shared by server and client, and the night-only cave whose
// big boss can be fought once for rewards each night.

// One in-game day lasts an hour of real time: 34 min day, 4 min dusk,
// 18 min night, 4 min dawn. Everyone sees the same sky.
export const DAY_CYCLE = 3600;
const PHASES = [
  ["day", 0, 2040],
  ["dusk", 2040, 2280],
  ["night", 2280, 3360],
  ["dawn", 3360, 3600],
];
// t: seconds (wall clock plus any server offset). dark: 0 noon … 1 midnight.
export function skyAt(t) {
  const cycle = Math.floor(t / DAY_CYCLE),
    at = t - cycle * DAY_CYCLE,
    [phase, from, to] = PHASES.find(([, a, b]) => at >= a && at < b),
    k = (at - from) / (to - from);
  const dark =
    phase === "day" ? 0 : phase === "night" ? 1 : phase === "dusk" ? k : 1 - k;
  const night = phase === "night";
  // When the cave opens next (or closes, while it is night).
  const nightStart = cycle * DAY_CYCLE + PHASES[2][1],
    nightEnd = cycle * DAY_CYCLE + PHASES[2][2];
  return {
    phase,
    dark: Math.round(dark * 1000) / 1000,
    night,
    cycle,
    changeAt: night ? nightEnd : at < PHASES[2][1] ? nightStart : nightStart + DAY_CYCLE,
  };
}

// The cave mouth appears at night under the great tree, left of the elder.
export const NIGHT_CAVE = { x: 170, reach: 150 };
// A different boss each night, in rotation.
export const NIGHT_BOSSES = [
  { type: "batking", name: "ราชันค้างคาวราตรี", tint: 0xb59cff },
  { type: "golem", name: "ยักษ์ศิลารัตติกาล", tint: 0x8fa3ff },
  { type: "serpent", name: "นาคราชเงาจันทร์", tint: 0x7fe0ff },
];
export const nightBoss = (cycle) => NIGHT_BOSSES[cycle % NIGHT_BOSSES.length];
// Boss multipliers on top of the scaled floor boss.
export const NIGHT_BOSS = { hp: 3.5, damage: 1.25, scale: 1.6 };
// Strength follows the strongest hero in the party (floors they have beaten).
export const nightFloor = (members) =>
  Math.max(1, Math.min(15, Math.max(0, ...members.map((m) => m.quest || 0))));
export const nightReward = (floor) => ({
  gold: 150 + floor * 40,
  ore: 3 + Math.ceil(floor / 2),
  // Chance to also win a boss item the hero does not own yet.
  itemChance: 0.5,
});
// Shown in dungeon UI in place of a floor entry.
export const nightInfo = (night) => ({
  name: "ถ้ำลึกลับ",
  boss: night.name,
  color: 0x4b2f7a,
  tint: night.tint,
  prefix: "ราตรี",
  bossType: night.type,
});
