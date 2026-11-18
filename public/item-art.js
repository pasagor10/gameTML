// Artwork indices follow the supplied sheets, left to right, top to bottom.
const artwork = {
  starter_swordsman: ["sword", 0],
  starter_archer: ["bow", 0],
  starter_mage: ["staff", 0],
  guardian_weapon: ["armor", 11],
  traveler_armor: ["armor", 1],
  moon_blade: ["sword", 2],
  forest_bow: ["bow", 2],
  star_staff: ["staff", 2],
  crystal_charm: ["charm", 3],
  wind_boots: ["boots", 3],
  cavern_charm: ["charm", 4],
  moonheart_talisman: ["charm", 2],
};
const floorIndices = {
  sword: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  bow: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  staff: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  armor: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  charm: [0, 4, 1, 5, 6, 7, 8, 9, 10, 11],
  boots: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10],
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function itemArtPath(id, item) {
  let art = artwork[id];
  if (!art && item?.floor) {
    const group =
      item.slot === "weapon"
        ? { swordsman: "sword", archer: "bow", mage: "staff" }[item.class]
        : item.slot;
    const index = floorIndices[group]?.[item.floor - 1];
    if (index !== undefined) art = [group, index];
  }
  return art ? `/assets/items/${art[0]}-${art[1]}.webp` : null;
}
function image([group, index], name) {
  return `<img class="item-art" src="/assets/items/${group}-${index}.webp" alt="${escape(name)}" width="80" height="80" loading="lazy" decoding="async">`;
}
export function supplyArt(id) {
  const art = {
    hp: ["supply", 0],
    mp: ["supply", 1],
    gold: ["supply", 2],
    ore: ["supply", 3],
    weapon: ["armor", 11],
    armor: ["armor", 1],
  }[id];
  return art
    ? image(
        art,
        {
          hp: "ยา HP",
          mp: "ยา MP",
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
