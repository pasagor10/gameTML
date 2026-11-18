import { randomInt } from "node:crypto";
import { atomic, loadCharacter, persist } from "./database.js";
import { GEAR } from "../shared/rpg.js";
import {
  SLOT_COST,
  SLOT_COOLDOWN_MS,
  SLOT_MACHINE,
  SLOT_TOTAL_WEIGHT,
  slotRewardAt,
} from "../shared/slots.js";

export function spinSlotMachine(p, key, rng = randomInt, at = Date.now()) {
  if (p.area !== "town" || p.hp <= 0)
    throw Error("ใช้ตู้สล็อตได้ในเมืองขณะมีชีวิตเท่านั้น");
  if (
    Math.abs(p.x - SLOT_MACHINE.x) > SLOT_MACHINE.reach ||
    Math.abs(p.y - SLOT_MACHINE.y) > 90
  )
    throw Error("เดินเข้าใกล้ตู้สล็อตกลางเมืองก่อน");
  const result = atomic(p.id, "slots:spin", key, () => {
    if (at - (p.slotSpunAt ?? -Infinity) < SLOT_COOLDOWN_MS)
      throw Error("รอให้การหมุนก่อนหน้าจบก่อน");
    const c = loadCharacter(p.id);
    if (!c || c.gold < SLOT_COST) throw Error("ต้องมีทองอย่างน้อย 1,000 ทอง");
    const reward = slotRewardAt(rng(SLOT_TOTAL_WEIGHT));
    let item = reward.item,
      qty = reward.qty,
      converted = false;
    if (reward.rarity) {
      const pool = Object.entries(GEAR).filter(
        ([id, g]) =>
          !id.startsWith("starter_") &&
          g.rarity === reward.rarity &&
          (!g.class || g.class === c.class) &&
          g.level <= c.level &&
          (!g.floor || g.floor <= c.unlocked),
      );
      const pick = pool.length ? pool[rng(pool.length)] : null;
      if (!pick || c.ownedEquipment.includes(pick[0])) {
        item = "ore";
        qty = reward.duplicateOre;
        converted = true;
      } else {
        item = pick[0];
        qty = 1;
        c.ownedEquipment.push(item);
      }
    }
    if (!GEAR[item]) c.inventory[item] = (c.inventory[item] || 0) + qty;
    c.gold -= SLOT_COST;
    persist(c);
    return {
      reward: reward.id,
      item,
      qty,
      rarity: reward.rarity || "common",
      converted,
      cost: SLOT_COST,
      gold: c.gold,
    };
  });
  // Duplicate request ids return the recorded result without another charge.
  const saved = loadCharacter(p.id);
  p.gold = saved.gold;
  p.inventory = saved.inventory;
  p.ownedEquipment = saved.ownedEquipment;
  p.slotSpunAt = at;
  return result;
}
