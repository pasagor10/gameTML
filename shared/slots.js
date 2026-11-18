// The same published odds drive the server draw and the reward table in town.
export const SLOT_COST = 1000;
export const SLOT_COOLDOWN_MS = 2200;
export const SLOT_MACHINE = { x: 1620, y: 600, reach: 155 };
export const SLOT_REWARDS = [
  { id: "hp", weight: 3000, label: "ยา HP ×15", item: "hp", qty: 15 },
  { id: "mp", weight: 2500, label: "ยา MP ×15", item: "mp", qty: 15 },
  { id: "ore", weight: 2500, label: "แร่จันทรา ×12", item: "ore", qty: 12 },
  {
    id: "rare",
    weight: 1200,
    label: "อุปกรณ์หายาก",
    rarity: "rare",
    duplicateOre: 20,
  },
  {
    id: "epic",
    weight: 700,
    label: "อุปกรณ์มหากาพย์",
    rarity: "epic",
    duplicateOre: 35,
  },
  {
    id: "legendary",
    weight: 100,
    label: "อุปกรณ์ตำนาน",
    rarity: "legendary",
    duplicateOre: 80,
  },
];
export const SLOT_TOTAL_WEIGHT = SLOT_REWARDS.reduce(
  (sum, r) => sum + r.weight,
  0,
);
export function slotRewardAt(roll) {
  if (!Number.isInteger(roll) || roll < 0 || roll >= SLOT_TOTAL_WEIGHT)
    throw Error("ผลสุ่มไม่ถูกต้อง");
  let cumulative = 0;
  return SLOT_REWARDS.find((reward) => (cumulative += reward.weight) > roll);
}
