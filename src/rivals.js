// NPC rivals for the leaderboard. They are always shown with an "NPC" badge next to real players:
// they give new heroes someone to chase while the server is quiet. Everything is deterministic from
// the date, so every player sees the same rivals climbing at the same pace.
export const RIVAL_EPOCH = Date.UTC(2026, 10, 1), RIVAL_CAP = 150;
const NAMES = ['ทานตะวัน', 'ไลลา', 'กิตติ', 'มิโกะ', 'ฟ้าใส', 'เรย์ฟอร์ด', 'โมจิ', 'อัสลาน', 'น้ำหวาน', 'ซากุระ', 'ธันเดอร์', 'ปีโป้',
  'ลูน่า', 'การ์เร็ต', 'ใบเตย', 'คาเอเดะ', 'อีวาน', 'ข้าวปั้น', 'เซเลน', 'บาร์ต', 'พลอยใส', 'ฮาคุ', 'มาร์โก้', 'เมฆา'];
const JOBS = ['knight', 'mage', 'gunner'];
function hash(n) {n = Math.imul(n ^ n >>> 16, 0x45d9f3b);n = Math.imul(n ^ n >>> 16, 0x45d9f3b);return ((n ^ n >>> 16) >>> 0) / 4294967296;}
// Days since the rivals started, in Thailand time.
export function rivalDay(now = Date.now()) {return Math.max(0, (now + 7 * 3600000 - RIVAL_EPOCH) / 86400000);}
// A rival's level grows quickly at first and slows near the cap, like a real hero.
export function rivals(now = Date.now()) {
  const day = rivalDay(now);
  return NAMES.map((name, i) => {
    const start = 3 + Math.floor(hash(i * 7 + 1) * 45), pace = .8 + hash(i * 7 + 2) * 3.4;
    const level = Math.min(RIVAL_CAP, Math.floor(start + (RIVAL_CAP - start) * (1 - Math.exp(-pace * day / 260))));
    const cleared = Math.max(1, Math.min(150, Math.floor(level * (.82 + hash(i * 7 + 3) * .2))));
    const cp = Math.round(130 * 1.11 ** (Math.min(cleared, 60) - 1) * 1.028 ** Math.max(0, cleared - 60) * (1 + hash(i * 7 + 4) * .4));
    return {name, job: JOBS[i % 3], level, cleared, cp, npc: true};
  });
}
// NPC adventurers resting in town this hour (shown separately from real players online).
export function townRivals(now = Date.now()) {
  const hour = Math.floor(now / 3600000), list = rivals(now);
  return list.filter((_, i) => hash(hour * 31 + i) < .3).slice(0, 8);
}
// Merge real players, rivals and the local hero into one leaderboard.
export function leaderboard(real = [], me = null, now = Date.now()) {
  const key = p => `${p.name}|${p.job}`, seen = new Set(), rows = [];
  for (const p of real) if (!seen.has(key(p))) {seen.add(key(p));rows.push({...p, npc: false});}
  if (me && !seen.has(key(me))) rows.push({...me, npc: false});
  for (const p of rivals(now)) if (!seen.has(key(p))) rows.push(p);
  rows.sort((a, b) => b.level - a.level || b.cleared - a.cleared || b.cp - a.cp);
  return rows.map((p, i) => ({...p, rank: i + 1, you: !!me && key(p) === key(me)}));
}
