// Town identity stays separate from area: both settlements support the same services.
export const TOWNS = {
  cave: { id: 'cave', name: 'เมืองหน้าถ้ำหลวง', destination: 'riverside' },
  riverside: { id: 'riverside', name: 'ชุมชนริมน้ำสาย', destination: 'cave' },
};
export const townOf = p => TOWNS[p?.townId] || TOWNS.cave;
export const TRAVEL_GATE = { x: 900, y: 600, reach: 140 };
export const MINE_INFO = { name: 'เหมืองแร่แรร์เอิร์ธ', prefix: 'แร่แรร์เอิร์ธ', icon: '⛏', color: 0x63d8bf, tint: 0xd6fff3 };
