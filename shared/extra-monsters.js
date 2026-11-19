// New silhouettes share the same combat scaling as existing regular monsters.
export const EXTRA_MONSTERS = {
  "frost-scarab": { name: "ด้วงผลึกเหมันต์", height: 92, stat: "def", per: 2, lore: "กระดองผลึกน้ำแข็งสะท้อนแสงใต้ถ้ำ" },
  "lava-salamander": { name: "กิ้งก่าลาวา", height: 88, stat: "hp", per: 15, lore: "ผิวหินแตกร้าวซ่อนเปลวไฟจากใต้พิภพ" },
  "thorn-mantis": { name: "ตั๊กแตนเคียวหนาม", height: 106, stat: "atk", per: 2, lore: "นักล่าป่าลึกใช้แขนเคียวพรางตัวท่ามกลางดอกไม้" },
  "storm-harpy": { name: "ฮาร์ปีอัสนี", height: 104, flyer: true, stat: "speed", per: 3, lore: "ปีกสีน้ำเงินพาสายฟ้าบินผ่านยอดวิหาร" },
  "moon-reaper": { name: "ภูตเคียวจันทรา", height: 112, flyer: true, stat: "mp", per: 12, lore: "วิญญาณลอยตัวถือเคียวเสี้ยวจันทร์เฝ้าบัลลังก์" },
  mimic: { name: "หีบเขี้ยวลวงตา", height: 90, stat: "hp", per: 15, lore: "หีบสมบัติที่รอเหยื่อเดินเข้ามาเปิดฝา" },
};
export const BIOME_ROSTERS = {
  "frost-revenant": ["frost-scarab", "wolf", "mimic"],
  "ember-colossus": ["lava-salamander", "goblin", "frost-scarab"],
  "thorn-queen": ["thorn-mantis", "mushroom", "lava-salamander"],
  "storm-roc": ["storm-harpy", "bat", "thorn-mantis"],
  "moon-emperor": ["moon-reaper", "serpent", "storm-harpy"],
};
export const flyingMonster = type => type === "bat" || type === "batking" || !!EXTRA_MONSTERS[type]?.flyer;
