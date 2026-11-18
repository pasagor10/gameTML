// Skill kits and status effects, shared by the server (rules) and the client
// (skill bar, tooltips, status icons). Each attack skill strikes several
// times per target, so damage shows as a stack of numbers, and may leave a
// status on the monster. Skill 4 is a party buff.

// dot: share of the hit that lands again every second while it lasts.
// Bosses resist control effects: they last a third as long on them.
export const STATUSES = {
  burn: { name: "ติดไฟ", icon: "🔥", color: "#ff9a3c", tint: 0xffa070, dot: 0.22 },
  poison: { name: "พิษ", icon: "☠", color: "#a6ec5a", tint: 0xb6ff8a, dot: 0.12, stacks: 3 },
  bleed: { name: "เลือดออก", icon: "🩸", color: "#ff5470", tint: 0xff9aa8, dot: 0.18 },
  freeze: { name: "แช่แข็ง", icon: "❄", color: "#9be8ff", tint: 0x8fdcff, control: true },
  stun: { name: "มึนงง", icon: "💫", color: "#ffe066", control: true },
  slow: { name: "เชื่องช้า", icon: "🐌", color: "#8fb8ff", tint: 0xb4cbff, speed: 0.5 },
  weaken: { name: "เกราะแตก", icon: "⛨", color: "#d99bff", taken: 1.25 },
};
export const BOSS_CONTROL = 0.35;

export const BUFFS = {
  rage: { name: "ปลุกพลังนักรบ", icon: "♛", color: "#ff8a3c", damage: 0.3 },
  focus: { name: "สมาธินักล่า", icon: "◎", color: "#7fe0a8", crit: 0.3 },
  barrier: { name: "บาเรียมนตรา", icon: "⬡", color: "#b89bff", guard: 0.4 },
};

const atk = (name, icon, hits, power, status, detail) => ({ name, icon, hits, power, status, detail });
export const SKILL_KITS = {
  swordsman: [
    atk("ฟันดาบ", "⚔", 1, 1, null, "โจมตีปกติ"),
    atk("คลื่นดาบ", "〆", 2, 0.8, { type: "bleed", chance: 0.5, duration: 4 }, "ฟัน 2 ครั้ง · 50% เลือดออก"),
    atk("ฟันทะลวง", "⚡", 3, 0.67, { type: "stun", chance: 0.4, duration: 1.6 }, "ฟันหนัก 3 ครั้ง · 40% มึนงง"),
    atk("พลังจันทรา", "☽", 4, 0.63, { type: "weaken", chance: 1, duration: 6 }, "กวาดรอบตัว 4 ครั้ง · เกราะแตก รับดาเมจ +25%"),
    { name: "ปลุกพลังนักรบ", icon: "♛", buff: "rage", duration: 12, detail: "ปาร์ตี้ตีแรงขึ้น 30% · 12 วิ" },
  ],
  archer: [
    atk("ยิงธนู", "➶", 1, 1, null, "โจมตีปกติ"),
    atk("ศรสายลม", "➶", 3, 0.55, { type: "slow", chance: 0.6, duration: 3 }, "ยิงรัว 3 ดอก · 60% เชื่องช้า"),
    atk("ศรอสรพิษ", "⋙", 2, 1, { type: "poison", chance: 0.75, duration: 6 }, "ศรเจาะแนว 2 ครั้ง · ติดพิษซ้อนได้ 3 ชั้น"),
    atk("ฝนลูกศร", "⤓", 5, 0.5, { type: "bleed", chance: 0.5, duration: 4 }, "ฝนศรรอบตัว 5 ครั้ง · 50% เลือดออก"),
    { name: "สมาธินักล่า", icon: "◎", buff: "focus", duration: 12, detail: "ปาร์ตี้คริติคอล +30% · 12 วิ" },
  ],
  mage: [
    atk("ลูกเวท", "✧", 1, 1, null, "โจมตีปกติ"),
    atk("ลูกไฟ", "✧", 2, 0.8, { type: "burn", chance: 0.6, duration: 4 }, "ไฟ 2 ครั้ง · 60% ติดไฟ"),
    atk("เวทระเบิด", "❖", 3, 0.67, { type: "burn", chance: 1, duration: 5 }, "ระเบิด 3 ครั้ง · ติดไฟแน่นอน"),
    atk("พายุน้ำแข็ง", "❄", 4, 0.63, { type: "freeze", chance: 0.45, duration: 2.2 }, "พายุรอบตัว 4 ครั้ง · 45% แช่แข็ง"),
    { name: "บาเรียมนตรา", icon: "⬡", buff: "barrier", duration: 12, detail: "ปาร์ตี้รับดาเมจลด 40% · 12 วิ" },
  ],
};
export const skillOf = (cls, skill) => SKILL_KITS[cls]?.[skill] || SKILL_KITS.swordsman[0];
export const BASE_CRIT = 0.12;

// Active buff by type, or null.
export const buffActive = (p, type, t) =>
  p?.buffs?.[type] && t < p.buffs[type].until ? p.buffs[type] : null;
export const statusActive = (e, type, t) =>
  e?.status?.[type] && t < e.status[type].until ? e.status[type] : null;
// Frozen or stunned monsters can't move or act.
export const controlled = (e, t) =>
  !!(statusActive(e, "freeze", t) || statusActive(e, "stun", t));

// Applies (or refreshes) a status from a hit of `amount`. Returns true if it took.
export function applyStatus(e, s, amount, t, roll = Math.random()) {
  if (!s || roll >= s.chance) return false;
  const def = STATUSES[s.type];
  e.status ??= {};
  const prev = statusActive(e, s.type, t),
    duration = s.duration * (def.control && e.boss ? BOSS_CONTROL : 1);
  e.status[s.type] = {
    until: Math.max(prev?.until || 0, t + duration),
    stacks: def.stacks ? Math.min(def.stacks, (prev?.stacks || 0) + 1) : 1,
    // Damage over time follows the strongest hit that applied it.
    dps: def.dot ? Math.max(prev?.dps || 0, Math.max(1, Math.round(amount * def.dot))) : 0,
    tickAt: prev?.tickAt ?? t + 1,
  };
  return true;
}
