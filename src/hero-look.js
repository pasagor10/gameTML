// Hero looks: what the character creator lets a player pick (hair, face, skin, outfit and their
// colours). A look is saved as a short code, one base-36 digit per choice in LOOK_KEYS order,
// so it fits in saves and party messages and an unknown or damaged code falls back to defaults.
//
// To add a choice: draw its part pictures in assets/sprites/heroes/cutout-knight/, register them
// in rig.json (slots.hair / slots.eyes / slots.mouth / slots.outfit), then append an entry here.
// Append only: codes store positions, so reordering would change existing heroes.
export const LOOK = {
  hair: [
    {id: 'tousled', name: 'ยุ่งน่ารัก'},
    {id: 'spiky', name: 'ชี้ฟู'},
    {id: 'long', name: 'ยาวสลวย'},
    {id: 'pony', name: 'หางม้า'}
  ],
  hairColour: ['#3a2a4a', '#2c2c36', '#7a4a2a', '#c8893a', '#f2d36e', '#d84a3a', '#ee92b8', '#5a8ae0', '#5ac0a0', '#eceaf4'],
  eyes: [
    {id: 'round', name: 'กลมโต'},
    {id: 'sharp', name: 'คมเข้ม'},
    {id: 'sleepy', name: 'ง่วงงุน'},
    {id: 'sparkle', name: 'ประกาย'}
  ],
  eyeColour: ['#3a6ad0', '#7a4a2a', '#3aa060', '#d0a030', '#c83a4a', '#8a5ad0', '#36b0d0'],
  mouth: [
    {id: 'smile', name: 'ยิ้ม'},
    {id: 'cat', name: 'ปากแมว'},
    {id: 'flat', name: 'เฉยๆ'},
    {id: 'grin', name: 'ยิ้มกว้าง'}
  ],
  skin: ['#ffffff', '#f7e2cf', '#e8c09c', '#bd8a66'],
  // Hats and hoods come later as their own slot; for now every outfit leaves the hair showing.
  // Positions kept from the first release: 0 was the bear hood (same body, now hatless), 2 the cat hood.
  outfit: [
    {id: 'onesie', name: 'ชุดวันพีซ'},
    {id: 'tunic', name: 'ชุดนักผจญภัย'},
    {id: 'vest', name: 'เสื้อกั๊ก'}
  ],
  outfitColour: ['#3f74d0', '#d65b5b', '#4fae6e', '#e0a040', '#8a6ad6', '#f0eee6', '#4a4a5a', '#e87aa8']
};
export const LOOK_KEYS = Object.keys(LOOK);

const DEFAULTS = {
  a: {hair: 0, hairColour: 0, eyes: 0, eyeColour: 0, mouth: 0, skin: 0, outfit: 0, outfitColour: 0},
  b: {hair: 2, hairColour: 0, eyes: 3, eyeColour: 0, mouth: 0, skin: 0, outfit: 0, outfitColour: 0}
};

// Choice indexes from a code; missing or out-of-range digits take the default for the appearance.
export function lookChoices(code, appearance = 'a') {
  const base = DEFAULTS[appearance] || DEFAULTS.a, text = typeof code === 'string' ? code : '';
  const out = {};
  LOOK_KEYS.forEach((k, i) => {
    const n = parseInt(text[i] ?? '', 36);
    out[k] = Number.isInteger(n) && n < LOOK[k].length ? n : base[k];
  });
  return out;
}

export function encodeLook(choices) {
  return LOOK_KEYS.map(k => {
    const n = choices?.[k] | 0;
    return (n >= 0 && n < LOOK[k].length ? n : 0).toString(36);
  }).join('');
}

// A saved or received code made safe: the same length and only digits that name real choices.
export const cleanLook = (code, appearance = 'a') => encodeLook(lookChoices(code, appearance));

export function randomLook(rng = Math.random) {
  const out = {};
  for (const k of LOOK_KEYS) out[k] = Math.floor(rng() * LOOK[k].length);
  return encodeLook(out);
}

// What the cutout rig needs: part ids and colours.
export function resolveLook(code, appearance = 'a') {
  const c = lookChoices(code, appearance), pick = k => LOOK[k][c[k]];
  return {
    hair: pick('hair').id, hairColour: pick('hairColour'),
    eyes: pick('eyes').id, eyeColour: pick('eyeColour'),
    mouth: pick('mouth').id, skin: pick('skin'),
    outfit: pick('outfit').id, outfitColour: pick('outfitColour')
  };
}
