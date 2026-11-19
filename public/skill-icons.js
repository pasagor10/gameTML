// Pixel-art icons for the action bar, skill lists and potions
// (tools/ui/skill_icons.py: public/assets/ui/skills). Wrapped in an SVG so
// every place that sizes the old vector emblems sizes these the same way;
// sampled nearest so each art pixel stays square.
const V = 1;
const pixel = (name) =>
  `<svg class="px-icon" viewBox="0 0 64 64" aria-hidden="true"><image href="/assets/ui/skills/${name}.webp?v=${V}" width="64" height="64" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/></svg>`;
const CLASSES = ["swordsman", "archer", "mage", "priest"];
export function skillIcon(cls, index) {
  return pixel(`${CLASSES.includes(cls) ? cls : "swordsman"}-${Math.max(0, Math.min(4, index | 0))}`);
}
export const potionIcon = pixel("potion-hp");
export const manaPotionIcon = pixel("potion-mp");
export const autoIcon = pixel("auto");
