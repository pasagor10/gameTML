import { heroSkins } from "/shared/rpg.js";

// One costume rule for every surface: the world sprite, the select-screen
// preview, saved-hero slots, the inventory paper doll and the HUD avatar all
// resolve through heroSkins() (specialization + tier first, plain class last).
// A costume shows a portrait when its sprites/index.json entry names one, so a
// new class or tier needs no code change, only its art and index entry.
const index = await fetch("/assets/sprites/index.json?t=" + Date.now())
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}));
const sets = index.sets || {};
const stamp = index.version ? `?v=${index.version}` : "";

export function heroPortraitUrl(p) {
  for (const skin of heroSkins(p)) {
    const set = sets[skin];
    if (set?.portrait)
      return `/assets/sprites/${set.dir}/${set.portrait}${stamp}`;
  }
  return null;
}

// Pixel-art sets (pixel / layers.pixel) keep square pixels when scaled.
const isPixel = (p) => {
  const set = heroSkins(p).map((s) => sets[s]).find((s) => s?.portrait);
  return set?.pixel || set?.layers?.pixel;
};

export function heroPortraitStyle(p) {
  const url = heroPortraitUrl(p);
  if (url)
    return `background-image:url('${url}');background-size:contain;background-position:center;background-repeat:no-repeat${isPixel(p) ? ";image-rendering:pixelated" : ""}`;
  // Plain class look: the shared 3x2 portrait sheet.
  return `background-image:url('/assets/heroes.png');background-size:300% 200%;background-position:${["swordsman", "archer", "mage"].indexOf(p.class) * 50}% ${p.gender === "female" ? 100 : 0}%`;
}
