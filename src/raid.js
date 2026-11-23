// World boss raid: opens every 10 minutes of real time for 3 minutes. A raid is a 60-second
// damage race against a boss that cannot fall; other raiders fill the board so it is never empty.
export const RAID_EVERY = 600000, RAID_OPEN = 180000, RAID_TIME = 60, RAID_EGGS = 10, RAID_STONES = {luck: 3, guard: 2};
export const RAID_BOSS_NAME = 'จอมมารแห่งรอยแยก';
export const raidWindow = now => Math.floor(now / RAID_EVERY);
export const raidOpen = now => now % RAID_EVERY < RAID_OPEN;
export const raidOpensIn = now => RAID_EVERY - now % RAID_EVERY;
export const raidClosesIn = now => Math.max(0, RAID_OPEN - now % RAID_EVERY);
// Player handles for the board.
const HANDLES = ['KaiZer99', 'ploy.th', 'นนท์จัง', 'xRyuX', 'MooDeng', 'ต้นกล้า', 'Nuchy', 'FrostByte', 'ไอซ์ซี่', 'BamBam_', 'TeeKung', 'มะปราง',
  'ShadowFox', 'จอมยุทธ์', 'Pinky22', 'NightOwl', 'โอ๊ตโอ๊ต', 'SirLancelot', 'บอสใหญ่', 'Mint.', 'GodSlayer', 'เจ๊หมวย', 'Kanomkrok', 'ZeroTwo',
  'ปลาทูน่า', 'TH_Warrior', 'Benz007', 'น้องหมี', 'Arthas', 'Toey', 'ฟ้าใส', 'Ronin', 'หมูกระทะ', 'Yuki', 'SakuraX', 'ลุงเปี๊ยก'];
const JOBS = ['knight', 'mage', 'gunner'];
// 10-15 raiders around the hero's level; `rate` is their damage relative to an average hero.
export function makeRaiders(rng, level) {
  const n = 10 + Math.floor(rng() * 6), pool = [...HANDLES], out = [];
  for (let i = 0; i < n; i++) {
    const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const lv = Math.max(10, Math.round(level + (rng() - .45) * 14));
    out.push({name, job: JOBS[Math.floor(rng() * 3)], appearance: rng() < .5 ? 'a' : 'b', lv, tier: Math.min(5, Math.max(0, Math.floor(lv / 12) + (rng() < .2 ? 1 : 0))), rate: .3 + rng() ** 1.3 * 1.6, dmg: 0});
  }
  return out;
}
// Top-5 prizes: one gear piece; the Mythic (rainbow) chance falls with rank, otherwise Legendary/Unique.
export const RANK_MYTHIC = [.3, .2, .15, .1, .07];
export function rollRankGear(rng, rank, job) {
  const kinds = ['weapon', 'armor', 'helmet', 'ring'], kind = kinds[Math.floor(rng() * kinds.length)];
  const tier = rng() < RANK_MYTHIC[rank - 1] ? 5 : rng() < .5 ? 4 : 3;
  return {kind, tier, job: kind === 'weapon' ? job : null};
}
