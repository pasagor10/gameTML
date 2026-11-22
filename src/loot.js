// Gear that drops from monsters: class weapons, armour, helmets and rings in six rarity tiers.
// Drops land on the ground; picked-up pieces go in the bag, where they can be worn, swapped,
// sold for gold or enhanced (+1..+10) with gold.
import {TIERS,REQ_LEVEL,weaponName} from './weapons.js';

export const SLOTS = ['weapon', 'armor', 'helmet', 'ring'];
export const SLOT_NAMES = {weapon: 'อาวุธ', armor: 'ชุด', helmet: 'หมวก', ring: 'แหวน'};
export const SLOT_ICONS = {weapon: '⚔', armor: '⛨', helmet: '⛑', ring: '◍'};
export const ARMOR = [
  {name:'ชุดผ้านักเดินทาง', hp:10, guard:.02},
  {name:'ชุดหนังนักล่า', hp:20, guard:.05},
  {name:'เกราะเหล็กกล้า', hp:45, guard:.1},
  {name:'เกราะคริสตัล', hp:80, guard:.15},
  {name:'เกราะเกล็ดมังกร', hp:130, guard:.2},
  {name:'เกราะเทพนิยาย', hp:200, guard:.25}
];
export const HELMET = [
  {name:'ผ้าคาดหัว', hp:5}, {name:'หมวกหนัง', hp:15}, {name:'หมวกเหล็ก', hp:30},
  {name:'มงกุฎคริสตัล', hp:50}, {name:'หมวกเกล็ดมังกร', hp:75}, {name:'มงกุฎเทพ', hp:110}
];
export const RING = [
  {name:'แหวนทองแดง', dmg:.02}, {name:'แหวนเงิน', dmg:.05}, {name:'แหวนไพลิน', dmg:.09},
  {name:'แหวนทองคำ', dmg:.14}, {name:'แหวนทับทิม', dmg:.2}, {name:'แหวนสายรุ้ง', dmg:.28}
];
export const BAG_MAX = 60, MAX_PLUS = 10;
// Normal monsters rarely drop; elites always drop one piece and guardians a better one.
export const DROP_CHANCE = {slime:.012, runner:.015, archer:.02, elite:1, boss:1};
export const GOLD_DROP = {slime:1, runner:1, archer:2, elite:25, boss:120};
const BASE_TIER = {elite:1, boss:2};
const SELL = [8, 30, 100, 260, 650, 1400];

export function rollTier(type, stage, rng) {
  const base = (BASE_TIER[type] || 0) + Math.floor((stage - 1) / 2);
  const swing = rng() < .2 ? 1 : rng() < .3 ? -1 : 0;
  return Math.max(0, Math.min(TIERS.length - 1, base + swing));
}
// Before awakening no weapons drop: there is no class weapon to find yet.
export function rollDrop(type, stage, job, rng) {
  if (rng() >= (DROP_CHANCE[type] ?? 0)) return null;
  const tier = rollTier(type, stage, rng), v = rng();
  const kind = job !== 'novice' && v < .35 ? 'weapon' : v < .6 ? 'armor' : v < .8 ? 'helmet' : 'ring';
  return {kind, tier, job: kind === 'weapon' ? job : null};
}
export function itemName(item) {
  const base = item.kind === 'weapon' ? weaponName(item.job, item.tier) : (item.kind === 'armor' ? ARMOR : item.kind === 'helmet' ? HELMET : RING)[item.tier].name;
  return item.plus ? `${base} +${item.plus}` : base;
}
export function canEquip(item, level, job) {return level >= REQ_LEVEL[item.tier] && (item.kind !== 'weapon' || item.job === job);}
export function sellPrice(item) {return Math.round(SELL[item.tier] * (1 + .5 * (item.plus || 0)));}
export function enhanceCost(item) {return Math.round(25 * (item.tier + 1) ** 2 * 1.55 ** (item.plus || 0));}
// What a piece gives, in the units the model applies.
export function itemStats(item) {
  const plus = item.plus || 0;
  if (item.kind === 'weapon') return {power: TIERS[item.tier].power * (1 + .08 * plus)};
  if (item.kind === 'armor') return {hp: ARMOR[item.tier].hp + 10 * plus, guard: ARMOR[item.tier].guard};
  if (item.kind === 'helmet') return {hp: HELMET[item.tier].hp + 6 * plus};
  return {dmg: RING[item.tier].dmg + .015 * plus};
}
export function statText(item) {
  const s = itemStats(item);
  if (item.kind === 'weapon') return `พลังโจมตี ×${s.power.toFixed(2)}`;
  if (item.kind === 'armor') return `HP +${s.hp} · ลดดาเมจ ${Math.round(s.guard * 100)}%`;
  if (item.kind === 'helmet') return `HP +${s.hp}`;
  return `ดาเมจ +${Math.round(s.dmg * 100)}%`;
}
