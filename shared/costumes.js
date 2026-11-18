// Costumes: whole-body looks worn over the class look, with no effect on
// stats. Each is drawn once and fits every female hero, whatever her class:
// the sprite set `female-costume-<id>` in public/assets/sprites/index.json
// (tools/sprite-rig/import_pixel_sheet.py), holding her own weapon.
//
// A costume is also a bag item, `costume_<id>` in p.inventory: it drops from
// dungeon bosses (rollCostumeDrop), sells in player shops and trades like a
// stack. A hero wears one she has (p.skin = its id, null for the class look);
// selling or trading away the last copy takes it off.
export const COSTUMES = [
  { id: "crimson", name: "ชุดนักดาบชาด", rarity: "rare" },
  { id: "1", name: "ชุดเที่ยวทะเล", rarity: "rare" },
  { id: "4", name: "ชุดพรานไพร", rarity: "rare" },
  { id: "2", name: "ชุดไทยสไบ", rarity: "epic" },
  { id: "3", name: "ชุดไทยดอกบัว", rarity: "epic" },
  { id: "5", name: "ชุดแม่มดฟักทอง", rarity: "epic" },
  { id: "6", name: "ชุดซากุระ", rarity: "epic" },
  { id: "7", name: "ชุดนางรำทองคำ", rarity: "legendary" },
];
export const COSTUME_GENDERS = ["female"];
// Suggested shop price by rarity (players set their own).
const PRICE = { rare: 600, epic: 1500, legendary: 4000 };

export const costumeItem = (id) => `costume_${id}`;
export const COSTUME_ITEMS = Object.fromEntries(
  COSTUMES.map((c) => [
    costumeItem(c.id),
    { name: c.name, costume: c.id, rarity: c.rarity, price: PRICE[c.rarity], icon: "👗" },
  ]),
);
export const isCostumeItem = (item) => Object.hasOwn(COSTUME_ITEMS, item);

export const canWearCostumes = (p) => COSTUME_GENDERS.includes(p?.gender);
export const costumesOf = (p) => (canWearCostumes(p) ? COSTUMES : []);
export const costumeOf = (p, id = p?.skin) =>
  id ? costumesOf(p).find((c) => c.id === id) || null : null;
export const ownsCostume = (p, id) => (p?.inventory?.[costumeItem(id)] || 0) > 0;
// Sprite set of the costume this hero wears, or null.
export const costumeSet = (p) => {
  const c = costumeOf(p);
  return c ? `${p.gender}-costume-${c.id}` : null;
};

// Boss drop: a few percent per hero per boss, more on deeper floors; rarer
// costumes come up less often. Returns a costume item id or null.
const WEIGHT = { rare: 5, epic: 3, legendary: 1 };
export const costumeDropChance = (floor) =>
  floor > 10 ? 0.1 : floor >= 8 ? 0.08 : floor >= 4 ? 0.06 : 0.04;
export function rollCostumeDrop(floor, random = Math.random) {
  if (random() >= costumeDropChance(floor)) return null;
  const total = COSTUMES.reduce((s, c) => s + WEIGHT[c.rarity], 0);
  let pick = random() * total;
  for (const c of COSTUMES) if ((pick -= WEIGHT[c.rarity]) < 0) return costumeItem(c.id);
  return costumeItem(COSTUMES[0].id);
}
