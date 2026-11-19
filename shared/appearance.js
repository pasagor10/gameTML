// Which gear looks a layered hero wears (see public/sprite-sets.js playLayers).
// Armour sets the outfit and the headwear, the weapon sets the weapon look;
// a costume in p.costume[slot] overrides the look without touching stats.
import { GEAR } from "./rpg.js";

const RANK = { common: 1, rare: 2, epic: 3, legendary: 4, divine: 4 };
// Look tier 1-4: floor gear by depth, shop and starter gear by rarity.
export function lookTier(item) {
  if (!item) return 1;
  if (item.floor) return item.floor <= 3 ? 2 : item.floor <= 7 ? 3 : 4;
  return RANK[item.rarity] || 1;
}
const HEADS = ["hair", "circlet", "hood", "mitre"];

export function heroLooks(p, available = {}) {
  const armor = lookTier(GEAR[p.equipment?.armor]),
    weapon = lookTier(GEAR[p.equipment?.weapon]),
    looks = {
      outfit: `robe-${armor}`,
      head: HEADS[armor - 1],
      weapon: `staff-${weapon}`,
    };
  // A priest's vocation defines its silhouette independently of armour rarity.
  // Keep the weapon appearance tied to the equipped item, including on advance.
  if (p.class === "priest" && ["bishop", "templar"].includes(p.specialization)) {
    const look = `${p.specialization}-${p.advanced ? 3 : 2}`;
    for (const slot of ["outfit", "head"])
      if (available[slot]?.includes(look)) looks[slot] = look;
  }
  for (const [slot, look] of Object.entries(p.costume || {}))
    if (look && (!available[slot] || available[slot].includes(look))) looks[slot] = look;
  return looks;
}
