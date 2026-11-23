// World boss raid: opens every 10 minutes of real time for 3 minutes. A raid is a 60-second
// damage race against a boss that cannot fall. Only real players share the board (relayed by the party server).
export const RAID_EVERY = 600000, RAID_OPEN = 180000, RAID_TIME = 60, RAID_EGGS = 10, RAID_STONES = {luck: 3, guard: 2};
export const RAID_BOSS_NAME = 'จอมมารแห่งรอยแยก';
export const raidWindow = now => Math.floor(now / RAID_EVERY);
export const raidOpen = now => now % RAID_EVERY < RAID_OPEN;
export const raidOpensIn = now => RAID_EVERY - now % RAID_EVERY;
export const raidClosesIn = now => Math.max(0, RAID_OPEN - now % RAID_EVERY);
// Gear is only certain in a full raid: with fewer real players the top-5 prize is a chance of players/RAID_FULL,
// and a hero must deal at least RAID_MIN_SHARE of a recommended hero's 60-second damage (no join-and-idle).
export const RAID_FULL = 5, RAID_MIN_SHARE = .2;
export const raidGearChance = players => Math.min(1, Math.max(1, players) / RAID_FULL);
// Top-5 prizes: one gear piece; the Mythic (rainbow) chance falls with rank, otherwise Legendary/Unique.
export const RANK_MYTHIC = [.3, .2, .15, .1, .07];
export function rollRankGear(rng, rank, job) {
  const kinds = ['weapon', 'armor', 'helmet', 'ring'], kind = kinds[Math.floor(rng() * kinds.length)];
  const tier = rng() < RANK_MYTHIC[rank - 1] ? 5 : rng() < .5 ? 4 : 3;
  return {kind, tier, job: kind === 'weapon' ? job : null};
}
