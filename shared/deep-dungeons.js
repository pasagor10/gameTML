// Floors 16–40: authored encounters using the existing monster sprite families.
// The same records drive the floor picker and the server's named trait rosters.
const regions = [
  { color: 0x58a7c4, tint: 0xbce8f5, icon: "❄", floors: [
    ["รอยแยกเหมันต์", "นาคาน้ำแข็ง", "เกล็ดน้ำแข็ง", "serpent", ["wolf", "slime", "bat"], ["swift", "armored", "drain"]],
    ["เหมืองผลึกคราม", "โกเลมผลึกพันปี", "ผลึกคราม", "golem", ["golem", "goblin", "slime"], ["armored", "swift", "regen"]],
    ["ธารน้ำแข็งนิรันดร์", "พญาค้างคาวเหมันต์", "ธารเยือกแข็ง", "batking", ["bat", "serpent", "wolf"], ["drain", "armored", "frenzy"]],
    ["สุสานหิมะ", "ยักษ์ผู้เฝ้าสุสาน", "สุสานหิมะ", "golem", ["mushroom", "wolf", "goblin"], ["regen", "swift", "giant"]],
    ["วังราชินีเหมันต์", "ราชินีนาคาเหมันต์", "มงกุฎเหมันต์", "serpent", ["serpent", "golem", "bat"], ["drain", "giant", "swift"]],
  ] },
  { color: 0xe98145, tint: 0xffc39a, icon: "🔥", floors: [
    ["ทางแยกเถ้าถ่าน", "ยักษ์เถ้าภูผา", "เถ้าถ่าน", "golem", ["boar", "goblin", "bat"], ["frenzy", "swift", "drain"]],
    ["คุกเพลิงใต้พิภพ", "นาคาผู้คุมเพลิง", "โซ่เพลิง", "serpent", ["goblin", "golem", "serpent"], ["swift", "armored", "frenzy"]],
    ["สะพานลาวา", "พญาค้างคาวเถ้าทมิฬ", "ลาวาเดือด", "batking", ["bat", "boar", "golem"], ["swift", "giant", "armored"]],
    ["เตาหลอมอสูร", "มหาโกเลมเหล็กหลอม", "เหล็กหลอม", "golem", ["golem", "mushroom", "goblin"], ["giant", "regen", "frenzy"]],
    ["บัลลังก์สุริยะดับ", "จักรพรรดินาคาสุริยะ", "สุริยะดับ", "serpent", ["serpent", "wolf", "boar"], ["drain", "frenzy", "armored"]],
  ] },
  { color: 0x80b96a, tint: 0xd0efad, icon: "🌿", floors: [
    ["บึงพิษไร้จันทร์", "นาคาจ้าวบึงพิษ", "บึงพิษ", "serpent", ["slime", "mushroom", "serpent"], ["regen", "drain", "swift"]],
    ["ป่ารากกลืนวิญญาณ", "ยักษ์รากพันธนาการ", "รากกลืนวิญญาณ", "golem", ["mushroom", "golem", "wolf"], ["drain", "armored", "swift"]],
    ["รังแมลงเงามรณะ", "ราชาค้างคาวมรณะ", "เงามรณะ", "batking", ["bat", "slime", "goblin"], ["drain", "regen", "frenzy"]],
    ["วิหารพฤกษาต้องสาป", "ทวารบาลพฤกษา", "พฤกษาสาป", "golem", ["golem", "mushroom", "boar"], ["giant", "regen", "armored"]],
    ["หัวใจป่าอสูร", "พญานาคาพฤกษาทมิฬ", "หัวใจอสูร", "serpent", ["wolf", "serpent", "mushroom"], ["frenzy", "drain", "giant"]],
  ] },
  { color: 0xb09be8, tint: 0xe1d4ff, icon: "⚡", floors: [
    ["บันไดเมฆาแตก", "วิหคเมฆาอัสนี", "เมฆาแตก", "batking", ["bat", "goblin", "wolf"], ["swift", "armored", "frenzy"]],
    ["หอคอยสายฟ้า", "โกเลมแกนอัสนี", "แกนอัสนี", "golem", ["golem", "bat", "slime"], ["armored", "swift", "regen"]],
    ["ลานพายุคลั่ง", "นาคาพายุฟ้าคะนอง", "พายุคลั่ง", "serpent", ["serpent", "boar", "wolf"], ["swift", "giant", "frenzy"]],
    ["ประตูดาราร้าว", "ทวารบาลดาราร้าว", "ดาราร้าว", "golem", ["goblin", "golem", "mushroom"], ["drain", "giant", "regen"]],
    ["ยอดปราสาทอัสนี", "ราชันวิหคสายฟ้า", "ราชันอัสนี", "batking", ["bat", "serpent", "golem"], ["swift", "drain", "armored"]],
  ] },
  { color: 0x9463cb, tint: 0xdac0ff, icon: "🌑", floors: [
    ["ห้วงฝันจันทรา", "พญานาคาเงาฝัน", "เงาฝัน", "serpent", ["slime", "bat", "wolf"], ["regen", "drain", "swift"]],
    ["สุสานราชันลืมเลือน", "ราชันหินไร้นาม", "ราชันลืมเลือน", "golem", ["golem", "goblin", "boar"], ["armored", "frenzy", "giant"]],
    ["วิหารรัตติกาลนิรันดร์", "วิหครัตติกาลนิรันดร์", "รัตติกาลนิรันดร์", "batking", ["bat", "mushroom", "serpent"], ["drain", "regen", "frenzy"]],
    ["ประตูสูญสิ้น", "นาคาผู้กลืนแสง", "สูญสิ้น", "serpent", ["wolf", "golem", "goblin"], ["swift", "giant", "armored"]],
    ["บัลลังก์จักรพรรดิถ้ำหลวง", "จักรพรรดิจันทราสิ้นกาล", "จันทราสิ้นกาล", "golem", ["golem", "serpent", "bat"], ["giant", "drain", "frenzy"]],
  ] },
];
export const DEEP_DUNGEONS = regions.flatMap(({ color, tint, icon, floors }) =>
  floors.map(([name, boss, prefix, bossType, roster, traits]) => ({
    name, boss, prefix, bossType, roster, traits, color, tint, icon,
  })),
);
