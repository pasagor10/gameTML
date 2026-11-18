// What a layered (paper-doll) hero wears, resolved from its equipment:
//   looks   outfit / head / weapon shape tier (shared/appearance.js)
//   tints   the armour picture's main / trim / gem colours for the cloth
//   weapon  the weapon's own item picture, held in the hand
// public/sprite-sets.js playLayers() draws it.
import { GEAR } from "/shared/rpg.js";
import { heroLooks } from "/shared/appearance.js";
import { itemArtPath } from "/item-art.js";

const palette = await fetch("/assets/items/palette.json?v=1")
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}));

// Where the hand grips each kind of picture (share of the way from the
// bottom-left butt to the top-right tip) and its length in body pixels.
const HOLD = {
  staff: { grip: 0.3, length: 104 },
  sword: { grip: 0.17, length: 84 },
  bow: { grip: 0.5, length: 84 },
};
const toTint = (hex) => (hex ? parseInt(hex.slice(1), 16) : null);
const tintsOf = (colours) => ({
  main: toTint(colours.main),
  trim: toTint(colours.trim),
  gem: toTint(colours.gem),
});
const artKey = (url) => url?.match(/\/items\/([^/]+)\.webp/)?.[1];

export function gearDress(p, set) {
  const layers = set?.layers || {},
    looks = heroLooks(p, layers.looks),
    armorId = p.equipment?.armor,
    armorColours = palette[artKey(itemArtPath(armorId, GEAR[armorId]))],
    tints = tintsOf(armorColours || layers.tints || {}),
    weaponId = p.equipment?.weapon,
    url = itemArtPath(weaponId, GEAR[weaponId]),
    kind = artKey(url)?.split("-")[0];
  return {
    looks,
    tints: { outfit: tints, head: tints },
    weapon: url && HOLD[kind] ? { url, ...HOLD[kind] } : null,
  };
}
