// Pets: a companion that runs out to crystals, coins and (from Unique) item drops and sends them
// to the hero. The cheapest pet is sold in the shop; better ones hatch from eggs.
import {priceScale} from './shop.js';

export const PETS = [
  {id: 'chick', tier: 0, name: 'ลูกเจี๊ยบ', speed: 70, reach: 26, range: 260},
  {id: 'cat', tier: 1, name: 'แมวส้ม', speed: 110, reach: 34, range: 330},
  {id: 'fox', tier: 2, name: 'จิ้งจอกไฟ', speed: 150, reach: 42, range: 400},
  {id: 'owl', tier: 3, name: 'นกฮูกดวงดาว', speed: 200, reach: 52, range: 470, loot: true},
  {id: 'dragon', tier: 4, name: 'มังกรน้อย', speed: 260, reach: 62, range: 560, loot: true, bonus: .1},
  {id: 'qilin', tier: 5, name: 'กิเลนทอง', speed: 340, reach: 78, range: 680, loot: true, bonus: .2}
];
export const petDef = id => PETS.find(p => p.id === id) || null;
// Pets also fight: each hit deals this share of the hero's base hit, growing 15% per pet level.
export const PET_ATK = [.25, .35, .5, .7, .95, 1.3], MAX_PET_LV = 10, PET_HIT_CD = .8;
export function petStats(p, lv = 1) {
  const k = lv - 1;
  return {...p, lv, speed: Math.round(p.speed * (1 + .03 * k)), range: Math.round(p.range * (1 + .02 * k)), reach: p.reach, atk: PET_ATK[p.tier] * (1 + .15 * k)};
}
export function petUpgradeCost(p, lv, stage) {return Math.round(150 * (p.tier + 1) * 1.55 ** (lv - 1) * priceScale(stage) / 10) * 10;}
export function petPerks(p) {return [`โจมตี ${Math.round(p.atk * 100)}%`, `เร็ว ${p.speed}`, `ระยะ ${p.range}`, p.loot ? 'เก็บไอเทมด้วย' : '', p.bonus ? `เงิน +${p.bonus * 100}%` : ''].filter(Boolean).join(' · ');}
// The chick is always for sale; everything else comes from eggs.
export const PET_PRICE = 600;
// Hatch odds by tier (Common → Mythic). Every PITY eggs without Legendary or better guarantees one.
export const EGG_RATES = [.46, .3, .155, .065, .017, .003];
export const PITY = 60;
export function eggPrice(stage) {return Math.round(800 * priceScale(stage) / 10) * 10;}
// A duplicate turns into gold: a share of the egg price that grows with the tier.
export function dupeRefund(tier, stage) {return Math.round(eggPrice(stage) * .2 * (tier + 1) / 10) * 10;}
export function rollEgg(rng, pity) {
  let tier;
  if (pity >= PITY - 1) tier = rng() < .12 ? 5 : 4;
  else {let r = rng();tier = 0;for (let i = 0; i < EGG_RATES.length; i++) {if ((r -= EGG_RATES[i]) < 0) {tier = i;break;}}}
  return PETS.find(p => p.tier === tier);
}
