// Shared high resolution vector artwork for combat controls and class skill lists.
const V = 2;
const artwork = (name) =>
  `<svg class="px-icon" viewBox="0 0 64 64" aria-hidden="true"><image href="/assets/ui/modern/${name}.svg?v=${V}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/></svg>`;
const CLASSES = ["swordsman", "archer", "mage", "priest"];
export function skillIcon(cls, index) {
  if (index === 5) return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 39 24 58 32 39 40 32 58 25 40 6 32 25 24Z" fill="#eac879" stroke="#fff1c9" stroke-width="2"/><path d="m32 20 4 12-4 12-4-12Z" fill="#fff6d9"/></svg>`;
  return artwork(`${CLASSES.includes(cls) ? cls : "swordsman"}-${Math.max(0, Math.min(4, index | 0))}`);
}
export const potionIcon = artwork("potion-hp");
export const manaPotionIcon = artwork("potion-mp");
export const autoIcon = artwork("auto");
