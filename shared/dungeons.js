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
];
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
  const source = ledges[Math.max(0, Math.min(9, floor - 1))];
  return withStairs(
    source.map(([x, y, w]) => ({
      x: stage === 2 ? 2400 - x - w : x,
      y: stage === 3 ? Math.max(430, y) : y,
      w,
    })),
  );
}
// Where to walk (and whether to hop) to get up toward a higher target:
// head for the reachable surface above that leads closest to the target.
export function climbStep(actor, target, platforms) {
  if (target.y >= actor.y - 65) return { x: target.x, jump: false };
  let best = null,
    score = Infinity;
  for (const p of platforms) {
    const rise = actor.y - p.y;
    if (rise < 20 || rise > STEP_RISE + 25) continue;
    const toward = Math.abs(
        Math.max(p.x, Math.min(p.x + p.w, target.x)) - target.x,
      ),
      cost = toward + Math.abs(p.x + p.w / 2 - actor.x) * 0.5;
    if (cost < score) [best, score] = [p, cost];
  }
  if (!best) return { x: target.x, jump: false };
  const inside = actor.x >= best.x + 8 && actor.x <= best.x + best.w - 8;
  // Under the step: hop and drift to its middle so the landing is safe.
  return {
    x: inside
      ? best.x + best.w / 2
      : Math.max(best.x + 20, Math.min(best.x + best.w - 20, actor.x)),
    jump: inside,
  };
}
// Monsters per stage: deep floors fill the whole cave, the boss brings guards.
export function dungeonEnemyCount(floor, stage) {
  if (stage === 3) return 1 + 2 + Math.floor(floor / 2);
  return 8 + floor * 2 + (stage === 2 ? 2 : 0);
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
