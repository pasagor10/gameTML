// Costumes: whole-body looks worn over the class look, with no effect on
// stats. Each is drawn once for one gender and fits every hero of that
// gender, whatever the class: the sprite set `<gender>-costume-<id>` in
// public/assets/sprites/index.json (tools/sprite-rig/import_pixel_sheet.py),
// holding the hero's own weapon.
//
// A costume is also a bag item, `costume_<id>` in p.inventory: it drops from
// dungeon bosses (rollCostumeDrop), sells in player shops and trades like a
// stack, by anyone. A hero wears one of her gender she has (p.skin = its id,
// null for the class look); selling or trading away the last copy takes it off.
// Ids are unique across genders (male ones start with "m").
const female = (id, name, rarity) => ({ id, name, rarity, gender: "female" }),
  male = (id, name, rarity) => ({ id, name, rarity, gender: "male" });
export const COSTUMES = [
  female("crimson", "ชุดนักดาบชาด", "rare"),
  female("1", "ชุดเที่ยวทะเล", "rare"),
  female("4", "ชุดพรานไพร", "rare"),
  female("hunter", "ชุดพรานผ้าคาดหัว", "rare"),
  female("2", "ชุดไทยสไบ", "epic"),
  female("3", "ชุดไทยดอกบัว", "epic"),
  female("5", "ชุดแม่มดฟักทอง", "epic"),
  female("6", "ชุดซากุระ", "epic"),
  female("7", "ชุดนางรำทองคำ", "legendary"),
  male("mcrimson", "ชุดนักดาบชาด", "rare"),
  male("mbeach", "ชุดเที่ยวทะเล", "rare"),
  male("mmohom", "ชุดม่อฮ่อมผ้าขาวม้า", "rare"),
  male("mhunter", "ชุดพรานผ้าคาดหัว", "rare"),
  male("mstreet", "ชุดสตรีทรัตติกาล", "epic"),
  male("mwinter", "ชุดกันหนาวขนเฟอร์", "epic"),
  male("mtang", "ชุดตรุษจีนทองคำ", "epic"),
  male("mnoble", "ชุดขุนนางปีกอีกา", "legendary"),
];
export const GENDER_NAMES = { female: "หญิง", male: "ชาย" };
// Suggested shop price by rarity (players set their own).
const PRICE = { rare: 600, epic: 1500, legendary: 4000 };

export const costumeItem = (id) => `costume_${id}`;
export const COSTUME_ITEMS = Object.fromEntries(
  COSTUMES.map((c) => [
    costumeItem(c.id),
    {
      name: c.name,
      costume: c.id,
      gender: c.gender,
      set: `${c.gender}-costume-${c.id}`,
      rarity: c.rarity,
      price: PRICE[c.rarity],
      icon: "👗",
    },
  ]),
);
export const isCostumeItem = (item) => Object.hasOwn(COSTUME_ITEMS, item);

export const costumesOf = (p) => COSTUMES.filter((c) => c.gender === p?.gender);
export const canWearCostumes = (p) => costumesOf(p).length > 0;
// "สวมได้กับตัวละครหญิงทุกอาชีพ" for a costume item.
export const costumeFits = (item) =>
  `สวมได้กับตัวละคร${GENDER_NAMES[COSTUME_ITEMS[item]?.gender] || ""}ทุกอาชีพ`;
export const costumeOf = (p, id = p?.skin) =>
  id ? costumesOf(p).find((c) => c.id === id) || null : null;
export const ownsCostume = (p, id) => (p?.inventory?.[costumeItem(id)] || 0) > 0;
// Sprite set of the costume this hero wears, or null.
export const costumeSet = (p) => {
  const c = costumeOf(p);
  return c ? `${c.gender}-costume-${c.id}` : null;
};

// Boss drop: a few percent per hero per boss, more on deeper floors; rarer
// costumes come up less often, and three in four drops fit the hero's own
// gender (the rest are for selling or trading). Returns an item id or null.
const WEIGHT = { rare: 5, epic: 3, legendary: 1 };
export const costumeDropChance = (floor) =>
  floor > 10 ? 0.1 : floor >= 8 ? 0.08 : floor >= 4 ? 0.06 : 0.04;
export function rollCostumeDrop(floor, random = Math.random, gender = null) {
  if (random() >= costumeDropChance(floor)) return null;
  const own = COSTUMES.filter((c) => c.gender === gender),
    pool = own.length && random() < 0.75 ? own : COSTUMES,
    total = pool.reduce((s, c) => s + WEIGHT[c.rarity], 0);
  let pick = random() * total;
  for (const c of pool) if ((pick -= WEIGHT[c.rarity]) < 0) return costumeItem(c.id);
  return costumeItem(pool[0].id);
}
