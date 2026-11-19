import { COSTUME_ITEMS } from "../shared/costumes.js";
// Item pictures are pixel art cut from tools/sprite-rig/source/pixel/*.webp
// (slice_pixel_items.py): 36 per group, numbered row by row, every sheet
// sharing one theme per index (0 plain, 1 guardian, 6-11 fire / dark,
// 12-17 water / ice, 18-23 nature, 24-29 moon / star / storm, 30-35 gold /
// sun / legendary; charms: rings, necklaces, bracelets, brooches, earrings,
// amulets). Weapons have a held copy at true pixel size, drawn upright in the
// hero's fist: /assets/items/held/<group>-N.webp.
const CLASS_GROUP = { swordsman: "sword", archer: "bow", mage: "staff", priest: "mace" };
const artIndex = {
  guardian_weapon: 1,
  traveler_armor: 1,
  moon_blade: 24,
  forest_bow: 19,
  star_staff: 27,
  dawn_scepter: 31,
  crystal_charm: 2,
  moonheart_talisman: 22,
  cavern_charm: 30,
  wind_boots: 17,
  // World-boss divine weapons: the winged gold design of each class.
  divine_nangnon_blade: 32,
  divine_nangnon_bow: 32,
  divine_nangnon_staff: 32,
  divine_nangnon_scepter: 32,
};
// Rescue shop sets reuse the established item and held-weapon artwork.
for (let tier = 1; tier <= 4; tier++)
  for (const kind of ["swordsman", "archer", "mage", "priest", "armor", "charm", "boots"])
    artIndex[`rescue_${tier}_${kind}`] = [1, 18, 24, 30][tier - 1];
// By floor 1..10 (floor 2 has no charm).
const FLOOR = [8, 7, 15, 18, 6, 12, 28, 29, 22, 26];
const floorIndex = {
  weapon: FLOOR,
  armor: FLOOR,
  boots: [8, 7, 13, 18, 6, 12, 28, 29, 22, 26],
  charm: [24, 3, 9, 33, 31, 20, 34, 10, 35, 5],
};
// [group, index] of an item; a classless weapon takes the holder's class.
function artOf(id, item, heroClass) {
  if (!item) return null;
  const group =
    item.slot === "weapon" ? CLASS_GROUP[item.class || heroClass] || "sword" : item.slot;
  const index = id?.startsWith("starter_")
    ? 0
    : artIndex[id] ?? floorIndex[item.slot]?.[(item.floor - 1) % FLOOR.length];
  return group && index !== undefined ? [group, index] : null;
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function itemArtPath(id, item) {
  if (item?.rarity === 'divine' && ['armor','charm','boots'].includes(item.slot))
    return `/assets/items/divine/${item.slot}.webp`;
  const art = artOf(id, item);
  return art ? `/assets/items/px/${art[0]}-${art[1]}.webp` : null;
}
// The weapon's small upright pixel picture, held in the hero's fist.
export function heldArtPath(id, item, heroClass) {
  const art = item?.slot === "weapon" && artOf(id, item, heroClass);
  return art ? `/assets/items/held/${art[0]}-${art[1]}.webp` : null;
}
function image([group, index], name) {
  return `<img class="item-art" src="/assets/items/${group === "supply" ? "" : "px/"}${group}-${index}.webp" alt="${escape(name)}" width="80" height="80" loading="lazy" decoding="async">`;
}
// A costume item shows the costume's own pixel portrait.
export const costumeArtPath = (id) =>
  COSTUME_ITEMS[id] ? `/assets/sprites/${COSTUME_ITEMS[id].set}/portrait.webp?v=2` : null;
export function supplyArt(id) {
  if (COSTUME_ITEMS[id])
    return `<img class="item-art costume-art" src="${costumeArtPath(id)}" alt="${escape(COSTUME_ITEMS[id].name)}" width="80" height="80" loading="lazy" decoding="async">`;
  const art = {
    hp: ["supply", 0],
    mp: ["supply", 1],
    hp_s: ["supply", 4],
    hp_l: ["supply", 5],
    mp_s: ["supply", 6],
    mp_l: ["supply", 7],
    gold: ["supply", 2],
    ore: ["supply", 3],
    stone_100: ["supply", 8],
    stone_high: ["supply", 8],
    weapon: ["sword", 1],
    armor: ["armor", 1],
  }[id];
  if (id === "stone_high")
    return image(art, "หินตีบวกขั้นสูง 100%").replace('class="item-art"', 'class="item-art art-high-stone"');
  return art
    ? image(
        art,
        {
          hp: "ยา HP กลาง",
          mp: "ยา MP กลาง",
          hp_s: "ยา HP เล็ก",
          hp_l: "ยา HP ใหญ่",
          mp_s: "ยา MP เล็ก",
          mp_l: "ยา MP ใหญ่",
          gold: "ทอง",
          ore: "แร่จันทรา",
          weapon: "อาวุธผู้พิทักษ์",
          armor: "เกราะนักเดินทาง",
        }[id],
      )
    : "";
}

export function itemArt(id, item) {
  const path = itemArtPath(id, item);
  return path
    ? `<img class="item-art" src="${path}" alt="${escape(item.name)}" width="80" height="80" loading="lazy" decoding="async">`
    : escape(item?.icon || "+");
}
