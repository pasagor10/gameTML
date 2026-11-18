// Daily quests and the monster book (bestiary): the long-term goals that give
// a reason to come back each day and to keep farming floors already cleared.
import { DUNGEON_ROSTERS } from "./dungeons.js";

// --- Monster book -----------------------------------------------------------
// Every regular monster type earns up to three stars from lifetime kills; each
// star grants a small permanent stat bonus to the character.
export const BESTIARY_TIERS = [50, 200, 1000];
export const MONSTERS = {
  slime: { name: "สไลม์ถ้ำ", stat: "hp", per: 15, lore: "เมือกเรืองแสงที่ดูดซับพลังจันทรา" },
  bat: { name: "ค้างคาวรัตติกาล", stat: "speed", per: 4, lore: "บินเป็นฝูงตามแสงจากปากถ้ำ" },
  golem: { name: "โกเลมหินผลึก", stat: "def", per: 2, lore: "หินที่ตื่นขึ้นเพราะผลึกในอก" },
  boar: { name: "หมูป่าเขี้ยวเหล็ก", stat: "hp", per: 20, lore: "พุ่งชนไม่หยุดจนกว่าจะชนผนัง" },
  serpent: { name: "อสรพิษโพรงน้ำ", stat: "atk", per: 2, lore: "เกล็ดคมซ่อนตัวใต้น้ำใต้ดิน" },
  mushroom: { name: "เห็ดพิษเดินได้", stat: "mp", per: 12, lore: "สปอร์ของมันทำให้หลับฝันร้าย" },
  goblin: { name: "ก็อบลินขุดแร่", stat: "atk", per: 2, lore: "ขโมยแร่จันทราไปซ่อนในโพรง" },
  wolf: { name: "หมาป่าเงา", stat: "speed", per: 4, lore: "ล่าเป็นคู่ในความมืดของชั้นลึก" },
};
export const bestiaryStars = (kills = 0) =>
  BESTIARY_TIERS.filter((n) => kills >= n).length;
export function bestiaryBonuses(book = {}) {
  const stats = {};
  for (const [type, m] of Object.entries(MONSTERS)) {
    const stars = bestiaryStars(book[type]);
    if (stars) stats[m.stat] = (stats[m.stat] || 0) + m.per * stars;
  }
  return stats;
}
// Adds one kill; returns the new star count when a tier was just reached.
export function recordKill(p, type) {
  if (!MONSTERS[type]) return 0;
  p.bestiary ||= {};
  const before = bestiaryStars(p.bestiary[type]);
  p.bestiary[type] = (p.bestiary[type] || 0) + 1;
  const after = bestiaryStars(p.bestiary[type]);
  return after > before ? after : 0;
}

// --- Daily quests -----------------------------------------------------------
// Days roll over at midnight Thailand time (UTC+7).
const DAY_OFFSET = 7 * 3600;
export const questDay = (t) => Math.floor((t + DAY_OFFSET) / 86400);
export const questResetAt = (t) => (questDay(t) + 1) * 86400 - DAY_OFFSET;
export const DAILY_COUNT = 3;
// Small deterministic RNG so one character always gets the same set per day.
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
export function rollDailyQuests(id, day, unlocked = 1) {
  const random = rng(`${id}:${day}`),
    pick = (list) => list[Math.floor(random() * list.length)],
    open = Math.max(1, Math.min(DUNGEON_ROSTERS.length, unlocked)),
    types = [...new Set(DUNGEON_ROSTERS.slice(0, open).flat())],
    hunt = pick(types);
  // One hunt of a specific monster, then two different other goals.
  const others = [
    { kind: "killAny", goal: 40 + open * 4 },
    { kind: "elite", goal: 4 + Math.floor(open / 3) },
    { kind: "boss", goal: 1 },
    { kind: "rune", goal: 1 },
    { kind: "enhance", goal: 1 },
  ];
  const chosen = [{ kind: "kill", target: hunt, goal: 25 + open * 3 }];
  while (chosen.length < DAILY_COUNT) {
    const q = others.splice(Math.floor(random() * others.length), 1)[0];
    chosen.push(q);
  }
  return chosen.map((q) => ({ ...q, progress: 0, claimed: false }));
}
// Rewards scale with level so they stay worth claiming.
export function questReward(q, level = 1) {
  const gold = 60 + level * 12,
    exp = 50 + level * 15;
  return {
    kill: { gold, exp, ore: 1 },
    killAny: { gold, exp, ore: 1 },
    elite: { gold: gold + 30, exp, ore: 2 },
    boss: { gold: gold + 40, exp: exp + 40, ore: 2 },
    rune: { gold, exp, ore: 1 },
    enhance: { gold: gold + 20, exp: 30, ore: 2 },
  }[q.kind];
}
// Clearing every daily quest opens one bonus chest with a dungeon energy.
export const DAILY_BONUS = { ore: 3, energy: 1, goldPerLevel: 20 };
export function questText(q) {
  const name = MONSTERS[q.target]?.name;
  return {
    kill: `ล่า${name} ${q.goal} ตัว`,
    killAny: `ปราบมอนสเตอร์ในดันเจียน ${q.goal} ตัว`,
    elite: `ปราบอีลิท ${q.goal} ตัว`,
    boss: "พิชิตบอสชั้นใดก็ได้ 1 ครั้ง",
    rune: "ไขผนึกรูนให้ครบในด่านใดก็ได้",
    enhance: "ตีบวกอุปกรณ์ที่โรงตี 1 ครั้ง",
  }[q.kind];
}
// Fresh quests whenever the stored day is not today.
export function ensureDaily(p, t) {
  const day = questDay(t);
  if (p.daily?.day !== day)
    p.daily = {
      day,
      quests: rollDailyQuests(p.id, day, p.unlocked),
      bonusClaimed: false,
    };
  return p.daily;
}
// Advances matching quests; returns the ones that just became complete.
export function advanceQuests(p, t, kind, target, amount = 1) {
  const done = [];
  for (const q of ensureDaily(p, t).quests) {
    if (q.kind !== kind || (q.target && q.target !== target)) continue;
    if (q.progress >= q.goal) continue;
    q.progress = Math.min(q.goal, q.progress + amount);
    if (q.progress >= q.goal) done.push(q);
  }
  return done;
}
