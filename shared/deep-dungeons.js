import { BIOME_ROSTERS } from "./extra-monsters.js";
// Floors 16–40: five original boss families, with a named encounter per floor.
// Shared records drive the floor picker, server spawns and trait rosters.
const regions = [
  { color: 0x58a7c4, tint: 0xbce8f5, icon: "❄", bossType: "frost-revenant", floors: [
    ["รอยแยกเหมันต์", "อัศวินรอยแยกเหมันต์", "เกล็ดน้ำแข็ง", ["wolf", "slime", "bat"], ["swift", "armored", "drain"]],
    ["เหมืองผลึกคราม", "อัศวินผลึกพันปี", "ผลึกคราม", ["golem", "goblin", "slime"], ["armored", "swift", "regen"]],
    ["ธารน้ำแข็งนิรันดร์", "อัศวินธารน้ำแข็ง", "ธารเยือกแข็ง", ["bat", "serpent", "wolf"], ["drain", "armored", "frenzy"]],
    ["สุสานหิมะ", "ผู้เฝ้าสุสานหิมะ", "สุสานหิมะ", ["mushroom", "wolf", "goblin"], ["regen", "swift", "giant"]],
    ["วังราชินีเหมันต์", "ราชันอัศวินเหมันต์", "มงกุฎเหมันต์", ["serpent", "golem", "bat"], ["drain", "giant", "swift"]],
  ] },
  { color: 0xe98145, tint: 0xffc39a, icon: "🔥", bossType: "ember-colossus", floors: [
    ["ทางแยกเถ้าถ่าน", "อสูรเถ้าภูผา", "เถ้าถ่าน", ["boar", "goblin", "bat"], ["frenzy", "swift", "drain"]],
    ["คุกเพลิงใต้พิภพ", "ผู้คุมเตาหลอม", "โซ่เพลิง", ["goblin", "golem", "serpent"], ["swift", "armored", "frenzy"]],
    ["สะพานลาวา", "อสูรค้อนลาวา", "ลาวาเดือด", ["bat", "boar", "golem"], ["swift", "giant", "armored"]],
    ["เตาหลอมอสูร", "มหาอสูรเหล็กหลอม", "เหล็กหลอม", ["golem", "mushroom", "goblin"], ["giant", "regen", "frenzy"]],
    ["บัลลังก์สุริยะดับ", "จักรพรรดิเตาสุริยะ", "สุริยะดับ", ["serpent", "wolf", "boar"], ["drain", "frenzy", "armored"]],
  ] },
  { color: 0x80b96a, tint: 0xd0efad, icon: "🌿", bossType: "thorn-queen", floors: [
    ["บึงพิษไร้จันทร์", "ราชินีบึงพิษ", "บึงพิษ", ["slime", "mushroom", "serpent"], ["regen", "drain", "swift"]],
    ["ป่ารากกลืนวิญญาณ", "ราชินีรากกลืนวิญญาณ", "รากกลืนวิญญาณ", ["mushroom", "golem", "wolf"], ["drain", "armored", "swift"]],
    ["รังแมลงเงามรณะ", "ราชินีบุปผามรณะ", "เงามรณะ", ["bat", "slime", "goblin"], ["drain", "regen", "frenzy"]],
    ["วิหารพฤกษาต้องสาป", "ราชินีพฤกษาต้องสาป", "พฤกษาสาป", ["golem", "mushroom", "boar"], ["giant", "regen", "armored"]],
    ["หัวใจป่าอสูร", "จักรพรรดินีพฤกษาทมิฬ", "หัวใจอสูร", ["wolf", "serpent", "mushroom"], ["frenzy", "drain", "giant"]],
  ] },
  { color: 0xb09be8, tint: 0xe1d4ff, icon: "⚡", bossType: "storm-roc", floors: [
    ["บันไดเมฆาแตก", "วิหคเมฆาอัสนี", "เมฆาแตก", ["bat", "goblin", "wolf"], ["swift", "armored", "frenzy"]],
    ["หอคอยสายฟ้า", "วิหคแกนสายฟ้า", "แกนอัสนี", ["golem", "bat", "slime"], ["armored", "swift", "regen"]],
    ["ลานพายุคลั่ง", "วิหคพายุคลั่ง", "พายุคลั่ง", ["serpent", "boar", "wolf"], ["swift", "giant", "frenzy"]],
    ["ประตูดาราร้าว", "วิหคดาราร้าว", "ดาราร้าว", ["goblin", "golem", "mushroom"], ["drain", "giant", "regen"]],
    ["ยอดปราสาทอัสนี", "ราชันวิหคสายฟ้า", "ราชันอัสนี", ["bat", "serpent", "golem"], ["swift", "drain", "armored"]],
  ] },
  { color: 0x9463cb, tint: 0xdac0ff, icon: "🌑", bossType: "moon-emperor", floors: [
    ["ห้วงฝันจันทรา", "จ้าวเคียวเงาฝัน", "เงาฝัน", ["slime", "bat", "wolf"], ["regen", "drain", "swift"]],
    ["สุสานราชันลืมเลือน", "ราชันจันทราลืมเลือน", "ราชันลืมเลือน", ["golem", "goblin", "boar"], ["armored", "frenzy", "giant"]],
    ["วิหารรัตติกาลนิรันดร์", "จักรพรรดิรัตติกาล", "รัตติกาลนิรันดร์", ["bat", "mushroom", "serpent"], ["drain", "regen", "frenzy"]],
    ["ประตูสูญสิ้น", "ผู้กลืนแสงจันทรา", "สูญสิ้น", ["wolf", "golem", "goblin"], ["swift", "giant", "armored"]],
    ["บัลลังก์จักรพรรดิถ้ำหลวง", "จักรพรรดิจันทราสิ้นกาล", "จันทราสิ้นกาล", ["golem", "serpent", "bat"], ["giant", "drain", "frenzy"]],
  ] },
];
export const DEEP_DUNGEONS = regions.flatMap(({ color, tint, icon, bossType, floors }) =>
  floors.map(([name, boss, prefix, roster, traits]) => ({
    name, boss, prefix, bossType, roster: BIOME_ROSTERS[bossType] || roster, traits, color, tint, icon,
  })),
);
