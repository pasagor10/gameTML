// Cosmetic townsfolk only: never enter the server's player/combat roster.
const ROSTERS = {
  cave: ["ขุนกล้า", "มะลิ", "สายลม", "บัวแก้ว", "อินทร์"],
  riverside: ["คำปัน", "ดาวเหนือ", "ไผ่", "น้ำใส", "เมฆา"],
};
const OUTFITS = {
  cave: ["mnoble", "6", "mhunter", "7", "mtang"],
  riverside: ["mmohom", "2", "mbeach", "5", "mwinter"],
};
const JOBS = ["swordsman", "mage", "archer", "priest", "swordsman"];
export function townWanderers(townId, ground = 600) {
  const town = ROSTERS[townId] ? townId : "cave";
  return ROSTERS[town].map((name, index) => ({
    id: `npc-wanderer:${town}:${index}`,
    name,
    ambient: true,
    class: JOBS[index],
    gender: index % 2 ? "female" : "male",
    skin: OUTFITS[town][index],
    x: 260 + index * 430,
    y: ground,
    homeX: 260 + index * 430,
    phase: index * 3.7 + (town === "riverside" ? 2 : 0),
    hp: 1, maxHp: 1, level: 1, equipment: {},
    grounded: true, direction: 1, moving: false,
  }));
}
export function wandererPose(npc, time) {
  // Each stroll lasts about eight seconds, followed by a short rest.
  const speed = 36 + npc.phase % 9;
  const travel = 320 / speed;
  const cycle = travel + 2.5;
  const elapsed = Math.max(0, time + npc.phase);
  const leg = Math.floor(elapsed / cycle);
  const progress = Math.min(travel, elapsed % cycle);
  const direction = leg % 2 ? -1 : 1;
  const moving = elapsed % cycle < travel;
  return {
    x: npc.homeX - 160 + (direction > 0 ? progress * speed : 320 - progress * speed),
    y: npc.y, direction, moving, vx: moving ? direction * speed : 0,
  };
}
