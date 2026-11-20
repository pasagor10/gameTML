// Fictional mutation theme. Reuses existing textures; no extra downloads or emitters.
const zones = [
  ["อุโมงค์ตะกอน", "ตะกอนสารหนู", 0x91bd72, ["slime", "mushroom", "serpent"], "serpent"],
  ["สายแร่ร้าว", "ผลึกปนเปื้อน", 0xc8a1df, ["golem", "goblin", "mimic"], "frost-revenant"],
  ["ธารเหมืองร้าง", "ธารพิษ", 0x85cbb1, ["wolf", "boar", "bat"], "thorn-queen"],
  ["เตาสกัดแร่", "สนิมแดง", 0xe4a77e, ["lava-salamander", "golem", "goblin"], "ember-colossus"],
  ["โพรงรากกลายพันธุ์", "รากปนเปื้อน", 0xb9d47b, ["thorn-mantis", "mushroom", "serpent"], "thorn-queen"],
  ["หอผลึกหนัก", "ผลึกวิปลาส", 0x9fc4df, ["frost-scarab", "storm-harpy", "golem"], "storm-roc"],
  ["บ่อแร่ไร้แสง", "เงาตะกอน", 0xc5a3d9, ["moon-reaper", "mimic", "bat"], "moon-emperor"],
  ["หัวใจเหมืองต้องสาป", "แกนแร่กลายพันธุ์", 0xa0d494, ["serpent", "golem", "thorn-mantis"], "moon-emperor"],
];
export const MINE_DUNGEONS = zones.flatMap(([zone, prefix, tint, roster, bossType], z) =>
  Array.from({ length: 5 }, (_, n) => ({
    name: `${zone} · เขต ${n + 1}`, boss: `ผู้พิทักษ์${prefix} ${n + 1}`,
    prefix: `${prefix} ${z * 5 + n + 1}`, tint, color: tint, roster, bossType,
    traits: ["armored", "drain", n % 2 ? "frenzy" : "regen"],
    icon: "⛏", mine: true, deep: true,
  })),
);
