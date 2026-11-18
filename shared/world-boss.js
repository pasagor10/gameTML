// World boss: one giant everyone online fights together in a shared arena.
// It rises every half hour and stays for ten minutes. HP grows with each hero
// who joins; rewards follow each hero's share of the damage.
export const WORLD_BOSS = {
  every: 1800, // seconds between appearances (on the half hour)
  window: 600, // how long it stays before it escapes
  hp: 200000,
  hpPerHero: 80000, // added when a new hero joins this appearance
  damage: 1.5, // on top of a floor-10 boss hit
  scale: 2.2,
  floor: 10,
  // Summons guards as its health passes these marks.
  summonAt: [0.75, 0.5, 0.25],
  summonCount: 4,
};
export const WORLD_BOSSES = [
  { type: "golem", name: "เทพศิลาดอยนางนอน", tint: 0xffc27a },
  { type: "serpent", name: "พญานาคมหาวารี", tint: 0x8ff0ff },
  { type: "batking", name: "จอมราชันค้างคาวโลกันตร์", tint: 0xff8ab8 },
];
export const worldBossOf = (cycle) => WORLD_BOSSES[cycle % WORLD_BOSSES.length];

// Where the schedule stands at time t (seconds).
export function worldBossAt(t) {
  const cycle = Math.floor(t / WORLD_BOSS.every),
    startsAt = cycle * WORLD_BOSS.every,
    endsAt = startsAt + WORLD_BOSS.window;
  return {
    cycle,
    open: t < endsAt,
    startsAt,
    endsAt,
    nextAt: startsAt + WORLD_BOSS.every,
    ...worldBossOf(cycle),
  };
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

// Everyone who hit it gets paid; more for a bigger share and a top-3 place.
export function worldReward(place, share) {
  const top = place <= 3;
  return {
    gold: 250 + Math.round(1500 * share) + (place === 1 ? 500 : top ? 250 : 0),
    ore: 3 + (place === 1 ? 4 : top ? 2 : 0),
    exp: 600 + Math.round(1200 * share),
    // Chance at a floor-10 boss item the hero does not own yet.
    itemChance: place === 1 ? 1 : top ? 0.6 : 0.25,
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
