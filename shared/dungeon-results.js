import { dungeonEnemyCount } from "./dungeons.js";

export const RANKS = ["SSS", "SS", "S", "A", "B", "C"];
const CUTS = [0.92, 0.8, 0.65, 0.5, 0.3, 0];

// Par time grows with the floor's monster count, so every floor can reach SSS.
export function floorPar(floor) {
  let monsters = 0;
  for (let stage = 1; stage <= 3; stage++)
    monsters += dungeonEnemyCount(floor, stage);
  return Math.round(30 + monsters * 3.5);
}

// Speed and survival weigh equally; kills add flat score but not rank.
export function dungeonRank(
  seconds,
  defeated,
  damageTaken,
  floor = 1,
  maxHp = 100,
) {
  const par = floorPar(floor),
    speed = Math.max(0, Math.min(1, 1.5 - seconds / par)),
    survival = Math.max(0, Math.min(1, 1 - damageTaken / (maxHp * 3))),
    rating = speed * 0.5 + survival * 0.5,
    rank = RANKS[CUTS.findIndex((c) => rating >= c)];
  return {
    score: defeated * 100 + Math.round(rating * 10000),
    rank,
    par,
    speed: Math.round(speed * 100),
    survival: Math.round(survival * 100),
  };
}
