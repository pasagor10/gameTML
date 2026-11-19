// What a layered (paper-doll) hero wears, resolved from its equipment:
//   looks   outfit / head / weapon shape tier (shared/appearance.js)
//   tints   the armour picture's main / trim / gem colours for the cloth
//   weapon  the weapon's small upright pixel picture, held in the hand
//           (unless the set draws its own staff: layers.weaponArt "rig")
//   weaponGlow  the weapon picture's accent colour
// public/sprite-sets.js playLayers() draws it.
import { GEAR } from "/shared/rpg.js";
import { heroLooks } from "/shared/appearance.js";
import { itemArtPath, heldArtPath } from "/item-art.js";

const palette = await fetch("/assets/items/palette.json?v=2")
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}));

// Held weapons are small upright pixel pictures (tip up). grip: share of the
// way down from the top where the fist closes; gripX: across, for a bow held
// by the handle on its belly; tilt: how much of the hand's swing the weapon
// follows (a bow stays near upright). length: its height in painted-body
// pixels when a painted (non-pixel) body holds it.
// maxWidth: pixel bodies shrink a wider picture (e.g. a winged head) to this
// many pixels across so it does not cover the hero's face.
const HOLD = {
  sword: { grip: 0.88, length: 84 },
  staff: { grip: 0.62, tilt: 0.6, length: 104, maxWidth: 20 },
  mace: { grip: 0.78, tilt: 0.8, length: 90, maxWidth: 20 },
  bow: { grip: 0.5, gripX: 0.8, tilt: 0.35, length: 84 },
};
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
const artKey = (url) => url?.match(/\/([^/]+)\.webp/)?.[1];

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
    starter = `starter_${p.class}`,
    held =
      heldArtPath(weaponId, GEAR[weaponId], p.class) ||
      heldArtPath(starter, GEAR[starter], p.class),
    kind = artKey(held)?.split("-")[0],
    url = itemArtPath(weaponId, GEAR[weaponId]);
  return {
    looks,
    // Painted heads hold the face and hair: leave them their own colours.
    tints: { outfit: tints, head: layers.painted ? {} : tints },
    // Sets with weaponArt "rig" hold their own drawn staff (looks.weapon),
    // which suits the character better than the ornate item picture.
    weapon:
      // Pixel sets hold one only with heldArt "pixel" (monks keep empty hands).
      held && HOLD[kind] && layers.weaponArt !== "rig" && (!layers.pixel || layers.heldArt === "pixel")
        ? {
            url: held,
            upright: true,
            ...HOLD[kind],
            // Pixel bodies hold it at their own pixel scale.
            length: layers.pixel ? null : HOLD[kind].length,
          }
        : null,
    // Either way the held weapon glows in its item picture's accent colour.
    weaponGlow: toTint(palette[artKey(url)]?.gem),
  };
}
