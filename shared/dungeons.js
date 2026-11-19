import { DEEP_DUNGEONS } from "./deep-dungeons.js";
// Shared geometry keeps server collisions, enemy spawns and the minimap aligned.
const ledges = [
  [
    [470, 490, 210],
    [960, 395, 250],
    [1580, 480, 240],
    [1970, 365, 230],
  ],
  [
    [430, 505, 270],
    [820, 410, 250],
    [1250, 315, 300],
    [1790, 465, 340],
  ],
  [
    [550, 470, 280],
    [1110, 505, 240],
    [1510, 390, 230],
    [1920, 475, 280],
  ],
  [
    [410, 490, 230],
    [780, 380, 260],
    [1210, 470, 270],
    [1610, 350, 260],
    [2020, 455, 220],
  ],
  [
    [510, 475, 210],
    [950, 370, 220],
    [1390, 475, 240],
    [1880, 365, 300],
  ],
  [
    [440, 505, 300],
    [880, 405, 330],
    [1360, 305, 280],
    [1830, 420, 350],
  ],
  [
    [390, 480, 200],
    [750, 365, 230],
    [1150, 455, 210],
    [1510, 340, 230],
    [1930, 450, 260],
  ],
  [
    [430, 440, 260],
    [910, 345, 230],
    [1310, 495, 280],
    [1770, 390, 310],
  ],
  [
    [500, 500, 310],
    [990, 400, 260],
    [1440, 300, 260],
    [1880, 455, 330],
  ],
  [
    [410, 480, 260],
    [850, 370, 260],
    [1260, 470, 250],
    [1660, 350, 260],
    [2050, 465, 220],
  ],
];
// Rosters list the sprite type of each monster slot; floors 11-40 add a
// named variant with a trait per slot so every deep floor fights differently.
export const DUNGEON_ROSTERS = [
  ["bat", "slime", "bat"],
  ["golem", "boar", "slime"],
  ["serpent", "slime", "boar"],
  ["mushroom", "goblin", "mushroom"],
  ["golem", "goblin", "boar"],
  ["wolf", "golem", "bat"],
  ["bat", "wolf", "bat"],
  ["goblin", "bat", "slime"],
  ["serpent", "wolf", "goblin"],
  ["serpent", "golem", "bat"],
  ["slime", "serpent", "bat"],
  ["mushroom", "goblin", "boar"],
  ["golem", "goblin", "wolf"],
  ["wolf", "bat", "mushroom"],
  ["golem", "serpent", "boar"],
  ...DEEP_DUNGEONS.map((floor) => floor.roster),
];
// Trait multipliers: hp, move speed, attack cooldown, damage dealt, damage
// taken; regen is max-HP share healed per second while not hit; drain is the
// share of damage dealt the monster heals; frenzy kicks in below half health.
export const TRAITS = {
  swift: { name: "ว่องไว", icon: "💨", text: "เดินและโจมตีเร็ว", speed: 1.45, cooldown: 0.72 },
  armored: { name: "เกราะหนา", icon: "🛡", text: "รับดาเมจลดลง 40%", taken: 0.6, speed: 0.9 },
  drain: { name: "ดูดเลือด", icon: "🩸", text: "ฟื้น HP เมื่อโจมตีโดน", drain: 0.6 },
  giant: { name: "ยักษ์", icon: "⛰", text: "HP และพลังโจมตีสูง ตัวใหญ่ช้า", hp: 1.7, damage: 1.3, speed: 0.8, scale: 1.3 },
  frenzy: { name: "คลั่ง", icon: "🔥", text: "เลือดต่ำกว่าครึ่งจะโหดขึ้น", frenzy: true },
  regen: { name: "ฟื้นตัว", icon: "✚", text: "ฟื้น HP หากไม่ถูกตี 3 วินาที", regen: 0.04 },
};
export const FLOOR_VARIANTS = {
  11: [
    { name: "สไลม์บึงมืด", trait: "regen" },
    { name: "อสรพิษเงาน้ำ", trait: "swift" },
    { name: "ค้างคาวดูดเลือด", trait: "drain" },
  ],
  12: [
    { name: "เห็ดยักษ์ต้องสาป", trait: "giant" },
    { name: "ก็อบลินคลั่ง", trait: "frenzy" },
    { name: "หมูป่าเกราะหิน", trait: "armored" },
  ],
  13: [
    { name: "โกเลมลาวา", trait: "armored" },
    { name: "ก็อบลินจุดระเบิด", trait: "swift" },
    { name: "หมาป่าเพลิง", trait: "frenzy" },
  ],
  14: [
    { name: "หมาป่าวิญญาณ", trait: "swift" },
    { name: "ค้างคาวผี", trait: "regen" },
    { name: "เห็ดสูบวิญญาณ", trait: "drain" },
  ],
  15: [
    { name: "ทวารบาลจันทรา", trait: "giant" },
    { name: "อสรพิษจันทรา", trait: "drain" },
    { name: "หมูป่าคลั่งจันทรา", trait: "frenzy" },
  ],
};
const monsterNames = { slime: "สไลม์", bat: "ค้างคาว", boar: "หมูป่า", mushroom: "เห็ด",
  goblin: "ก็อบลิน", wolf: "หมาป่า", golem: "โกเลม", serpent: "อสรพิษ" };
DEEP_DUNGEONS.forEach((floor, index) => {
  FLOOR_VARIANTS[index + 16] = floor.roster.map((type, slot) => ({
    name: `${monsterNames[type]}${floor.prefix}`, trait: floor.traits[slot],
  }));
});
// The monster in roster slot `index` of a floor: sprite type plus variant.
export function rosterEntry(floor, index) {
  const roster = DUNGEON_ROSTERS[floor - 1] || DUNGEON_ROSTERS[0],
    variant = FLOOR_VARIANTS[floor]?.[index % roster.length] || null;
  return { type: roster[index % roster.length], variant };
}
export const traitOf = (e) => TRAITS[e?.trait] || {};
// Dungeon jumps stay short; tall ledges get stairs instead of super jumps.
export const DUNGEON_JUMP = 620; // ≈167 px apex under 1150 gravity
export const STEP_RISE = 110;
const GROUND = 600,
  STEP_W = 80,
  STEP_SHIFT = 60;
// Add a staircase of overlapping steps beside every ledge too tall to jump to.
function withStairs(list) {
  const out = [...list];
  for (const l of list) {
    const rise = GROUND - l.y;
    if (rise <= 140) continue; // one comfortable jump already reaches it
    const steps = Math.ceil(rise / STEP_RISE) - 1;
    // Climb from the side with room; stage 2 mirrors ledges toward the wall.
    // Each step tucks 20 px under the one above it, like a real staircase.
    const left = l.x - steps * STEP_SHIFT > 60;
    for (let i = 1; i <= steps; i++)
      out.push({
        x: left ? l.x - i * STEP_SHIFT : l.x + l.w + i * STEP_SHIFT - STEP_W,
        y: Math.round(l.y + (i * rise) / (steps + 1)),
        w: STEP_W,
        step: true,
      });
  }
  return out.sort((a, b) => a.x - b.x || b.y - a.y);
}
export function dungeonPlatforms(floor = 1, stage = 1, training = false) {
  if (training)
    return withStairs([
      { x: 570, y: 460, w: 230 },
      { x: 1100, y: 440, w: 260 },
      { x: 1620, y: 470, w: 210 },
    ]);
  // Deep floors reuse the cave layouts in order.
  const source = ledges[Math.max(0, floor - 1) % ledges.length];
  return withStairs(
    source.map(([x, y, w]) => ({
      x: stage === 2 ? 2400 - x - w : x,
      y: stage === 3 ? Math.max(430, y) : y,
      w,
    })),
  );
}
// Route through connected surfaces rather than choosing a locally close step.
// The ground connects each staircase; upper steps must overlap so a short
// vertical jump can land without relying on a running jump.
export function climbStep(actor, target, platforms) {
  if (target.y >= actor.y - 65) {
    const support = platforms.find(p => Math.abs(actor.y - p.y) < 8 && actor.x >= p.x && actor.x <= p.x + p.w);
    if (support && target.y > actor.y + 52 && target.x >= support.x && target.x <= support.x + support.w)
      return { x: actor.x < support.x + support.w / 2 ? support.x - 28 : support.x + support.w + 28, jump: false };
    return { x: target.x, jump: false };
  }
  const ground = { x: 45, y: GROUND, w: 2310 };
  const nodes = [ground, ...platforms];
  const start = nodes.find(p => Math.abs(actor.y - p.y) < 8 && actor.x >= p.x && actor.x <= p.x + p.w) || ground;
  const goal = platforms.find(p => Math.abs(target.y - p.y) < 8 && target.x >= p.x && target.x <= p.x + p.w);
  if (!goal) return { x: target.x, jump: false };
  function route(from) {
    const costs = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
    while (open.size) {
      const a = [...open].reduce((a, b) => costs.get(a) <= costs.get(b) ? a : b);
      open.delete(a);
      if (a === goal) {
        let next = a;
        while (prev.get(next) && prev.get(next) !== from) next = prev.get(next);
        return next;
      }
      for (const b of platforms) {
        const rise = a.y - b.y;
        const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (rise < 15 || rise > 145 || overlap < 16) continue;
        const cost = costs.get(a) + 60 + Math.abs(b.x + b.w / 2 - (a === from ? actor.x : a.x + a.w / 2));
        if (cost >= (costs.get(b) ?? Infinity)) continue;
        costs.set(b, cost); prev.set(b, a); open.add(b);
      }
    }
    return null;
  }
  const next = route(start);
  if (!next) {
    // On the wrong ledge: step off toward the correct staircase, then route
    // again from the ground instead of jumping forever on an unrelated step.
    const entry = route(ground);
    if (!entry || start === ground) return { x: target.x, jump: false };
    const center = entry.x + entry.w / 2;
    return { x: center < start.x + start.w / 2 ? start.x - 28 : start.x + start.w + 28, jump: false };
  }
  const left = Math.max(start.x, next.x) + 2,
    right = Math.min(start.x + start.w, next.x + next.w) - 2;
  const inside = actor.x >= left && actor.x <= right;
  return {
    x: inside ? next.x + next.w / 2 : (left + right) / 2,
    jump: inside,
  };
}
export function dungeonSigns(floor, stage) {
  if (stage === 1)
    return [{ id: "supplies", x: 1320, y: GROUND }];
  if (stage !== 2) return [];
  const ledges = dungeonPlatforms(floor, stage).filter((p) => !p.step);
  return [
    { id: "rune-1", x: 685, y: GROUND },
    ...[1, ledges.length - 1].map((index, n) => {
      const { x, y, w } = ledges[index];
      return { id: `rune-${n + 2}`, x: x + w / 2, y };
    }),
  ];
}

export const withinDungeonSign = (player, sign) =>
  Math.abs(player.x - sign.x) <= 82 && Math.abs(player.y - sign.y) <= 52;

// Monsters per stage: deep floors fill the whole cave, the boss brings guards.
export function dungeonEnemyCount(floor, stage) {
  // Deep floors stay at floor-12 crowd size; their variants make them harder.
  const crowd = Math.min(floor, 12);
  // Fewer but tougher monsters (see MONSTER_HP in server/world.js).
  if (stage === 3) return 1 + 2 + Math.floor(crowd / 3);
  return 6 + crowd + (stage === 2 ? 1 : 0);
}
// Every few monsters is an elite pack leader with more health and bite.
export const isElite = (floor, stage, n) =>
  stage !== 3 &&
  n > 0 &&
  (n + floor) % Math.max(3, 6 - Math.floor(floor / 3)) === 0;
export function dungeonSpawn(floor, stage, n, boss = false, count) {
  if (boss) return { x: 1810, y: 600 };
  const platforms = dungeonPlatforms(floor, stage).filter((p) => !p.step);
  // Boss guards hold the approach; normal stages spread over the whole arena.
  const guards = stage === 3,
    total = Math.max(
      1,
      (count ?? dungeonEnemyCount(floor, stage)) - (guards ? 1 : 0),
    ),
    from = 720,
    to = guards ? 1560 : 2280,
    slot = (to - from) / total,
    jitter = ((n * 79 + floor * 31 + stage * 17) % 100) / 100 - 0.5,
    x = Math.round(from + slot * (n + 0.5 + jitter * 0.6));
  // Two in three monsters take a ledge when one covers their slot.
  if ((n + floor + stage) % 3 !== 0) {
    const ledge =
      platforms.find((p) => x >= p.x + 20 && x <= p.x + p.w - 20) ||
      (n % 2 === 0 &&
        platforms.reduce((a, b) =>
          Math.abs(b.x + b.w / 2 - x) < Math.abs(a.x + a.w / 2 - x) ? b : a,
        ));
    if (ledge)
      return {
        x: Math.max(ledge.x + 25, Math.min(ledge.x + ledge.w - 25, x)),
        y: ledge.y,
      };
  }
  return { x, y: 600 };
}
export function enemyStep(e, target, platforms, dt, t) {
  const flying = e.type === "bat" || e.type === "batking";
  if (flying) {
    const hover =
      target.y - (e.boss ? 25 : 45) + Math.sin(t * 2.2 + e.spawnAt) * 22;
    e.y += Math.max(-110 * dt, Math.min(110 * dt, hover - e.y));
    return;
  }
  const previous = e.y;
  e.vy = (e.vy || 0) + 1150 * dt;
  // Climb the stairs toward elevated targets; gravity lets them drop off ledges.
  // Plan only from solid footing; mid-air the old plan carries the landing.
  const climb = e.grounded
    ? climbStep(e, target, platforms)
    : { x: e.goalX ?? target.x, jump: false };
  e.goalX = climb.x;
  if (
    e.grounded &&
    climb.jump &&
    Math.abs(target.x - e.x) < 700 &&
    t > (e.jumpAt || 0)
  ) {
    e.vy = -DUNGEON_JUMP;
    e.jumpAt = t + 0.9;
    e.grounded = false;
  }
  e.y += e.vy * dt;
  let ground = 600;
  if (e.vy >= 0)
    for (const p of platforms)
      if (e.x >= p.x && e.x <= p.x + p.w && previous <= p.y + 2 && e.y >= p.y)
        ground = Math.min(ground, p.y);
  e.grounded = e.y >= ground && e.vy >= 0;
  if (e.grounded) {
    e.y = ground;
    e.vy = 0;
  }
}
