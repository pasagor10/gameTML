// What a layered (paper-doll) hero wears, resolved from its equipment:
//   looks   outfit / head / weapon shape tier (shared/appearance.js)
//   tints   the armour picture's main / trim / gem colours for the cloth
//   weapon  the weapon's own item picture, held in the hand (unless the set
//           draws its own staff: layers.weaponArt "rig")
//   weaponGlow  the weapon picture's accent colour, for the held glow
// public/sprite-sets.js playLayers() draws it.
import { GEAR } from "/shared/rpg.js";
import { heroLooks } from "/shared/appearance.js";
import { itemArtPath, heldArtPath } from "/item-art.js";

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
const PIXEL_HOLD = 0.4;
const toTint = (hex) => (hex ? parseInt(hex.slice(1), 16) : null);
const tintsOf = (colours) => ({
  main: toTint(colours.main),
  trim: toTint(colours.trim),
  gem: toTint(colours.gem),
});
// Blend a colour halfway to white, so a multiply tint recolours painted art
// without darkening it.
const soften = (c, keep = 0.5) =>
  c == null
    ? null
    : [16, 8, 0].reduce(
        (out, s) =>
          out | (Math.round(((c >> s) & 255) * keep + 255 * (1 - keep)) << s),
        0,
      );
const artKey = (url) => url?.match(/\/items\/([^/]+)\.webp/)?.[1];

export function gearDress(p, set) {
  const layers = set?.layers || {},
    looks = heroLooks(p, layers.looks),
    armorId = p.equipment?.armor,
    armorColours = palette[artKey(itemArtPath(armorId, GEAR[armorId]))],
    // Painted layers already carry their own shading and gold, so they only
    // take a softened wash of the armour colour on the whole outfit.
    tints = layers.painted
      ? { main: soften(toTint(armorColours?.main)) }
      : tintsOf(armorColours || layers.tints || {}),
    weaponId = p.equipment?.weapon,
    url = itemArtPath(weaponId, GEAR[weaponId]),
    kind = artKey(url)?.split("-")[0],
    // Pixel heroes hold a small upright pixel sword, drawn at true pixel size.
    held = layers.heldArt === "pixel" ? heldArtPath(weaponId) || (kind === "sword" ? heldArtPath("starter_swordsman") : null) : null;
  return {
    looks,
    // Painted heads hold the face and hair: leave them their own colours.
    tints: { outfit: tints, head: layers.painted ? {} : tints },
    // Sets with weaponArt "rig" hold their own drawn staff (looks.weapon),
    // which suits the character better than the ornate item picture.
    weapon: held
      ? { url: held, upright: true, grip: 0.88 }
      : url && HOLD[kind] && layers.weaponArt !== "rig"
        ? // HOLD lengths are in painted-body pixels; a pixel body (48px,
          // e.g. a mage in a costume) holds her item picture at that scale
          // until staffs and bows get pixel art of their own.
          { url, ...HOLD[kind], length: HOLD[kind].length * (layers.pixel ? PIXEL_HOLD : 1) }
        : null,
    // Either way the held weapon glows in its item picture's accent colour.
    weaponGlow: toTint(palette[artKey(url)]?.gem),
  };
}
