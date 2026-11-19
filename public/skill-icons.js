// Shared high resolution vector artwork for combat controls and class skill lists.
const V = 2;
const artwork = (name) =>
  `<svg class="px-icon" viewBox="0 0 64 64" aria-hidden="true"><image href="/assets/ui/modern/${name}.svg?v=${V}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/></svg>`;
const CLASSES = ["swordsman", "archer", "mage", "priest"];
export function skillIcon(cls, index) {
  return artwork(`${CLASSES.includes(cls) ? cls : "swordsman"}-${Math.max(0, Math.min(4, index | 0))}`);
}
export const potionIcon = artwork("potion-hp");
export const manaPotionIcon = artwork("potion-mp");
export const autoIcon = artwork("auto");
