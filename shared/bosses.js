// Original deep-floor bosses. One profile drives combat, card hints and FX.
export const BOSSES = {
  "frost-revenant": {
    name: "อัศวินเหมันต์", height: 195, fallback: "golem", color: 0x75ddff,
    skill: "คมง้าวเยือกแข็ง", detail: "ฟาดพื้นเป็นวงน้ำแข็ง ทำให้เคลื่อนที่ช้าลง",
    radius: 170, windup: 1, cooldown: 1.5,
    status: { type: "slow", chance: 1, duration: 2.5 },
  },
  "ember-colossus": {
    name: "อสูรเตาหลอม", height: 210, fallback: "golem", color: 0xff984f,
    skill: "ค้อนเตาหลอม", detail: "ทุบพื้นเป็นวงกว้างและทำให้ติดไฟ",
    radius: 205, windup: 1.15, cooldown: 1.7,
    status: { type: "burn", chance: 1, duration: 4 },
  },
  "thorn-queen": {
    name: "ราชินีพฤกษา", height: 200, fallback: "golem", color: 0xcbe879,
    skill: "หนามพิษพฤกษา", detail: "ปล่อยหนามใต้เท้าและทำให้ติดพิษ",
    radius: 185, windup: 1.05, cooldown: 1.55,
    status: { type: "poison", chance: 1, duration: 5 },
  },
  "storm-roc": {
    name: "วิหคสายฟ้า", height: 185, fallback: "batking", color: 0xffdc65,
    skill: "กรงเล็บอัสนี", detail: "โจมตีเร็ว เรียกสายฟ้าทำให้ชะงักชั่วครู่",
    radius: 145, windup: 0.85, cooldown: 1.2,
    status: { type: "stun", chance: 1, duration: 0.55 },
  },
  "moon-emperor": {
    name: "จักรพรรดิจันทรา", height: 215, fallback: "golem", color: 0xc68aff,
    skill: "เคียวจันทราสิ้นกาล", detail: "ฟาดเคียววงกว้างและทำให้เลือดไหล",
    radius: 220, windup: 1.1, cooldown: 1.45,
    status: { type: "bleed", chance: 1, duration: 4 },
  },
};
