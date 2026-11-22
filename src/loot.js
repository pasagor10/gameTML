// Gear that drops from monsters: class weapons and armour, six rarity tiers each.
// Drops land on the ground; picking one up puts it in the bag, and the best piece the hero's
// level allows is equipped automatically.
import {TIERS,REQ_LEVEL,weaponName} from './weapons.js';

export const ARMOR = [
  {name:'ชุดผ้านักเดินทาง', hp:0, guard:0},
  {name:'ชุดหนังนักล่า', hp:20, guard:.05},
  {name:'เกราะเหล็กกล้า', hp:45, guard:.1},
  {name:'เกราะคริสตัล', hp:80, guard:.15},
  {name:'เกราะเกล็ดมังกร', hp:130, guard:.2},
  {name:'เกราะเทพนิยาย', hp:200, guard:.25}
];
// Normal monsters rarely drop; elites always drop one piece and guardians a better one.
export const DROP_CHANCE = {slime:.012, runner:.015, archer:.02, elite:1, boss:1};
const BASE_TIER = {elite:1, boss:2};

export function rollTier(type, stage, rng) {
  const base = (BASE_TIER[type] || 0) + (stage - 1);
  const swing = rng() < .2 ? 1 : rng() < .3 ? -1 : 0;
  return Math.max(0, Math.min(TIERS.length - 1, base + swing));
}
// Before awakening only armour drops: there is no class weapon to find yet.
export function rollDrop(type, stage, job, rng) {
  if (rng() >= (DROP_CHANCE[type] ?? 0)) return null;
  const tier = rollTier(type, stage, rng);
  const kind = job === 'novice' || rng() < .45 ? 'armor' : 'weapon';
  return {kind, tier, job: kind === 'weapon' ? job : null};
}
export function itemName(item) {return item.kind === 'armor' ? ARMOR[item.tier].name : weaponName(item.job, item.tier);}
export function canEquip(item, level, job) {return level >= REQ_LEVEL[item.tier] && (item.kind === 'armor' || item.job === job);}
