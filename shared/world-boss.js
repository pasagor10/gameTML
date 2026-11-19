// World boss: one giant everyone online fights together in a shared arena.
// It rises every thirty minutes and stays for twenty minutes. HP grows with each hero
// who joins; rewards follow each hero's share of the damage.
export const WORLD_BOSS = {
  every: 1800, // at :00 and :30 each hour
  window: 1200, // how long it stays before it escapes
  // Tanky rather than brutal: lots of HP to chew through, soft hits.
  hp: 2000000,
  hpPerHero: 400000, // added when a new hero joins this appearance
  damage: 0.9, // on top of a floor-10 boss hit
  scale: 3.2,
  floor: 10,
  // Summons guards as its health passes these marks.
  summonAt: [0.75, 0.5, 0.25],
  summonCount: 4,
};
// The two world bosses take turns, one per half-hour appearance.
export const WORLD_BOSSES = [
  { type: "yaksha", name: "ยักษ์ทองเฝ้าถ้ำ", tint: 0xffffff },
  { type: "naga", name: "พญานาคเจ้าแม่นางนอน", tint: 0xffffff },
];
export const worldBossOf = (cycle = 0) =>
  WORLD_BOSSES[((cycle % WORLD_BOSSES.length) + WORLD_BOSSES.length) % WORLD_BOSSES.length];
// Grand boss: the 20:00 Bangkok appearance (13:00 UTC) every day. Bigger,
// much tankier, and everyone who joined gets a blessed enhance stone.
export const GRAND_BOSS = {
  hourUtc: 13,
  name: "มหาเทพีนางนอน",
  type: "naga",
  tint: 0xffffff,
  hpMul: 3,
  scale: 1.35, // on top of WORLD_BOSS.scale
  stones: 1,
};
export const isGrandAt = (startsAt) =>
  (((startsAt % 86400) + 86400) % 86400) === GRAND_BOSS.hourUtc * 3600;
// Seconds until the next grand boss starts (0 while it is up).
export function nextGrandIn(t) {
  const day = 86400,
    start = Math.floor(t / day) * day + GRAND_BOSS.hourUtc * 3600;
  if (t >= start && t < start + WORLD_BOSS.window) return 0;
  return (t < start ? start : start + day) - t;
}
// Half-hour boundaries also align with Bangkok local time.
export function worldBossAt(t) {
  const startHourUtc = 0;
  let cycle = Math.floor((t - startHourUtc) / WORLD_BOSS.every);
  const startsAt = cycle * WORLD_BOSS.every + startHourUtc;
  const endsAt = startsAt + WORLD_BOSS.window;
  const grand = isGrandAt(startsAt),
    boss = grand
      ? { type: GRAND_BOSS.type, name: GRAND_BOSS.name, tint: GRAND_BOSS.tint }
      : worldBossOf(cycle);
  return { cycle, open: t >= startsAt && t < endsAt, startsAt, endsAt,
    nextAt: startsAt + WORLD_BOSS.every, grand, nextGrand: isGrandAt(startsAt + WORLD_BOSS.every), ...boss };
}

// Damage ranking, best first: [{ id, name, damage, share, place }].
export function worldRanking(damage, names, maxHp) {
  return [...damage.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n], k) => ({
      id,
      name: names.get(id) || "?",
      damage: n,
      share: Math.min(1, n / Math.max(1, maxHp)),
      place: k + 1,
    }));
}

// Everyone who dealt damage gets paid on victory; share and rank raise rewards.
export function worldReward(place, share) {
  const top = place <= 3;
  return {
    gold: 1000 + Math.round(10000 * share) + (place === 1 ? 500 : top ? 250 : 0),
    ore: 10 + Math.round(40 * share) + (place === 1 ? 15 : top ? 8 : 0),
    exp: 1500 + Math.round(5000 * share),
    // Guaranteed high enhance stones (+11 and up, 100%); rank sets how many.
    stones: place === 1 ? 3 : top ? 2 : 1,
  };
}

export const worldInfo = (world) => ({
  name: "ลานบอสโลก",
  boss: world.name,
  color: 0x7a2a2a,
  tint: world.tint,
  prefix: "สมุน",
  bossType: world.type,
});
