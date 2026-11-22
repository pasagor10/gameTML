// Town shop: class gear, potions and buffs, and enhancement stones, bought with gold.
// Gear stock is rolled per refresh (free every 10 minutes of play, or paid); consumables are always in stock.
import {REQ_LEVEL} from './weapons.js';

export const SUPPLIES = {
  potion: {icon: '🧪', name: 'ยาฟื้นพลัง', desc: 'ฟื้น HP 50% · ดื่มเองเมื่อ HP ต่ำกว่า 35%', price: 40},
  luck: {icon: '🔷', name: 'หินนำโชค', desc: 'โอกาสตีบวกสำเร็จ +25% (ใช้ครั้งละ 1 ก้อน)', price: 150},
  guard: {icon: '🔶', name: 'หินคุ้มครอง', desc: 'ตีบวกพลาดแล้วไม่ลดขั้น (ใช้ครั้งละ 1 ก้อน)', price: 250}
};
export const BUFFS = {
  xp: {icon: '📜', name: 'คัมภีร์ EXP x2', desc: 'EXP ที่เก็บได้ ×2 นาน 5 นาที', price: 300, seconds: 300},
  gold: {icon: '🍀', name: 'เครื่องรางทอง x2', desc: 'เงินที่เก็บได้ ×2 นาน 5 นาที', price: 300, seconds: 300}
};
// Gear prices by tier; Mythic is never sold, only dropped.
export const GEAR_PRICE = [60, 240, 900, 3000, 9000];
export const SHOP_SIZE = 6, SHOP_REFRESH = 600;
// Consumables cost more in later stages, where gold drops are larger too.
export function priceScale(stage) {return 1.3 ** (Math.max(1, stage) - 1);}
export function supplyPrice(id, stage) {const item = SUPPLIES[id] || BUFFS[id];return Math.round(item.price * priceScale(stage) / 5) * 5;}
export function refreshPrice(stage) {return Math.round(50 * priceScale(stage) / 5) * 5;}
// Chance that enhancing from +n to +n+1 succeeds (index = current plus).
export const ENHANCE_RATE = [1, 1, 1, .9, .8, .7, .6, .5, .4, .3];
// From +6 a failed attempt also drops the piece one level, unless a guard stone is used.
export const DROP_FROM = 6;

// The best tier the hero can wear now, capped below Mythic.
export function shopTier(level) {let t = 0;for (let i = 0; i < GEAR_PRICE.length; i++) if (level >= REQ_LEVEL[i]) t = i;return t;}
export function rollStock(level, job, rng) {
  const top = shopTier(level), kinds = job === 'novice' ? ['armor', 'helmet', 'ring'] : ['weapon', 'weapon', 'armor', 'helmet', 'ring'];
  return Array.from({length: SHOP_SIZE}, (_, i) => {
    const kind = i < kinds.length ? kinds[i] : kinds[Math.floor(rng() * kinds.length)];
    const tier = Math.max(0, top - (rng() < .45 ? 1 : 0));
    return {kind, tier, job: kind === 'weapon' ? job : null, price: GEAR_PRICE[tier], sold: false};
  });
}
