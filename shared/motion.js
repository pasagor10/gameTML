// Timings are shared for rendering; only the server decides impacts and damage.
export const ACTIONS = [
  { windup: 0.16, recovery: 0.28, cooldown: 0.48, rangeBonus: 0, mp: 0 },
  { windup: 0.22, recovery: 0.34, cooldown: 2, rangeBonus: 140, mp: 8 },
  { windup: 0.3, recovery: 0.4, cooldown: 4, rangeBonus: 80, mp: 16 },
  { windup: 0.42, recovery: 0.48, cooldown: 7, rangeBonus: 220, mp: 24 },
  // Party buff.
  { windup: 0.3, recovery: 0.36, cooldown: 24, rangeBonus: 0, mp: 30 },
];
export const HERO_ROWS = {
  idle: 0,
  walk: 1,
  run: 2,
  jump: 3,
  attack: 4,
  skill: 5,
  hit: 6,
  death: 7,
  revive: 7,
};
export const SLIME_ROWS = {
  idle: 0,
  move: 1,
  attack: 2,
  hit: 3,
  death: 4,
  spawn: 5,
};
export function heroPose(p, time) {
  if (p.hp <= 0)
    return {
      state: "death",
      frame: Math.min(3, Math.floor((time - (p.diedAt || time)) / 0.15)),
    };
  if (p.reviveAt && time - p.reviveAt < 0.48)
    return {
      state: "revive",
      frame: Math.max(0, 3 - Math.floor((time - p.reviveAt) / 0.12)),
    };
  if (p.hitAt && time - p.hitAt < 0.22)
    return {
      state: "hit",
      frame: Math.min(3, Math.floor((time - p.hitAt) / 0.055)),
    };
  const a = p.action;
  if (a && time < a.endsAt) {
    const frame =
      time < a.impactAt
        ? Math.min(
            1,
            Math.floor(
              ((time - a.startedAt) /
                Math.max(0.01, a.impactAt - a.startedAt)) *
                2,
            ),
          )
        : 2 +
          Math.min(
            1,
            Math.floor(
              ((time - a.impactAt) / Math.max(0.01, a.endsAt - a.impactAt)) * 2,
            ),
          );
    return { state: a.skill ? "skill" : "attack", frame: Math.max(0, frame) };
  }
  if (p.grounded === false)
    return {
      state: "jump",
      frame: p.vy < -300 ? 0 : p.vy < 0 ? 1 : p.vy < 400 ? 2 : 3,
    };
  if (p.moving)
    return {
      state: p.running ? "run" : "walk",
      frame: Math.floor(time * (p.running ? 11 : 8)) % 4,
    };
  return { state: "idle", frame: Math.floor(time * 3) % 4 };
}
export function slimePose(e, time) {
  if (e.hp <= 0)
    return {
      state: "death",
      frame: Math.min(3, Math.floor((time - (e.diedAt || time)) / 0.15)),
    };
  if (e.spawnAt && time - e.spawnAt < 0.48)
    return {
      state: "spawn",
      frame: Math.max(0, Math.min(3, Math.floor((time - e.spawnAt) / 0.12))),
    };
  if (e.hitAt && time - e.hitAt < 0.22)
    return {
      state: "hit",
      frame: Math.min(3, Math.floor((time - e.hitAt) / 0.055)),
    };
  if (e.action && time < e.action.endsAt) {
    const a = e.action;
    return {
      state: "attack",
      frame:
        time < a.impactAt
          ? Math.min(1, Math.floor((time - a.startedAt) / 0.2))
          : Math.min(3, 2 + Math.floor((time - a.impactAt) / 0.15)),
    };
  }
  return {
    state: e.moving ? "move" : "idle",
    frame: Math.floor(time * (e.moving ? 8 : 3)) % 4,
  };
}
