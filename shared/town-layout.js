// The town is built from painted kit pieces standing on a repeating street
// tile, with props scattered in front (tools/town-kit/kit_art.py). Server and
// client both import this file, so walkable ledges, NPC spots and the portal
// always match the art.
//
// Pieces stand on TOWN_BASE (just behind the walking line at y 600). A piece's
// ledges are [left, right, height] in its own pixels: x from its left edge,
// height above its bottom. A prop with `step` is something to climb on (a
// barrel stack): its top becomes a ledge.

export const TOWN_BASE = 592;
export const TOWN_STREET_Y = 571; // the street tile's back edge
export const TOWN_GROUND = 600;
// How far up and down the town camera may look (the sky and the street fill
// reach this far).
export const TOWN_VIEW = { top: -900, bottom: 1150 };

// Width and height are the keyed piece sizes (public/assets/town-kit/kit.json).
export const TOWN_PIECES = {
  tree: { w: 426, h: 374, ledges: [] },
  stall: { w: 402, h: 288, ledges: [] },
  potion: {
    w: 454,
    h: 340,
    ledges: [
      [240, 445, 154], // the green awning
      [200, 420, 284], // the flat roof ridge behind it
    ],
  },
  stairs: {
    w: 354,
    h: 270,
    ledges: [
      [120, 185, 78], // a step half way up
      [225, 350, 140], // the terrace
    ],
  },
  weapon: { w: 458, h: 306, ledges: [[290, 450, 150]] }, // the lean-to roof
  cottage: { w: 364, h: 304, ledges: [] },
  smithy: { w: 476, h: 300, ledges: [[200, 470, 200]] }, // the forge roof
  bridge: { w: 420, h: 183, ledges: [[90, 330, 100]] }, // the deck
  cavegate: { w: 468, h: 264, ledges: [] }, // the portal stands in the arch
  house0: { w: 171, h: 138, ledges: [] },
  house3: { w: 183, h: 144, ledges: [] },
  house4: { w: 180, h: 141, ledges: [] },
};

// Left to right; x is where each piece's left edge stands.
export const TOWN_LAYOUT = [
  { piece: "tree", x: -40 },
  { piece: "house0", x: 400 },
  { piece: "stall", x: 590 },
  { piece: "potion", x: 1020 },
  { piece: "house3", x: 1530 },
  { piece: "stairs", x: 1740 },
  { piece: "weapon", x: 2130 },
  { piece: "cottage", x: 2630 },
  { piece: "house4", x: 3020 },
  { piece: "smithy", x: 3220 },
  { piece: "house0", x: 3720 },
  { piece: "bridge", x: 3910 },
  { piece: "cavegate", x: 4360 },
];

export const TOWN_WIDTH = TOWN_LAYOUT.reduce(
  (w, p) => Math.max(w, p.x + TOWN_PIECES[p.piece].w),
  0,
);

// Props (tools/town-kit/source/cottage/props.webp, numbered row by row):
// key is the texture (prop-px-<n> or anim-<name>), x the centre.
// Ground props stand on y (default the street); hanging props hang from y.
// front: drawn in front of the heroes. step: [w, h] climbable top.
export const TOWN_PROPS = [
  // Closely spaced lanterns keep the full walking route lit after sunset.
  ...[160, 430, 710, 1280, 1510, 1980, 2250, 2510, 2790, 3070,
      3350, 3620, 4170, 4540, 4790].map((x, i) => ({
    key: i % 3 === 0 ? "prop-px-21" : "prop-px-1", x,
  })),
  { key: "prop-px-19", x: 395 },
  { key: "prop-px-20", x: 545 },
  { key: "prop-px-8", x: 600, front: true },
  { key: "prop-px-21", x: 1000 },
  { key: "prop-px-15", x: 1490 },
  { key: "prop-px-9", x: 1520, front: true },
  { key: "prop-px-1", x: 1722 },
  { key: "prop-px-2", x: 2105 },
  { key: "prop-px-14", x: 2600 },
  { key: "prop-px-11", x: 2860, front: true },
  { key: "prop-px-23", x: 3005 },
  { key: "prop-px-16", x: 3150 },
  { key: "prop-px-6", x: 3300 },
  { key: "prop-px-4", x: 3660, step: [75, 69] },
  { key: "prop-px-1", x: 3900 },
  { key: "prop-px-10", x: 4345 },
  { key: "prop-px-17", x: 4400, front: true },
  { key: "prop-px-18", x: 4790 },
];

// Animated props: 4-frame loops, frame size in px (kit.json).
export const TOWN_ANIMS = {
  banner: [94, 99],
  lantern: [82, 111],
  brazier: [91, 103],
};

// NPC spots and the portal (world coordinates).
export const TOWN_SPOTS = {
  trainer: 1880, // class trainer at the stairs
  stones: 2930, // stone merchant beside the cottage
  elder: 300, // under the great tree
  potion: 1360, // at the herb counter
  weapon: 2330, // at the shop door
  forge: 3496, // at the anvil
  portal: { x: 4594, y: TOWN_BASE - 100 }, // inside the cave arch
  forgeFire: { x: 3581, y: TOWN_BASE - 54 },
  chimney: { x: 3624, y: TOWN_BASE - 270 },
};

// Front-facing stairs can't be walked in a side view, so stair pieces only
// expose their landings. Collision ledges with terrace tiers: tier 1 is reachable from the street,
// tier n from an overlapping tier n - 1 (the reachability test checks this).
export function townPlatforms() {
  const raw = [];
  for (const p of TOWN_LAYOUT)
    for (const [a, b, h] of TOWN_PIECES[p.piece].ledges)
      raw.push({ x: p.x + a, w: b - a, y: TOWN_BASE - h });
  for (const prop of TOWN_PROPS)
    if (prop.step) {
      const [w, h] = prop.step;
      raw.push({ x: prop.x - w / 2 + 4, w: w - 8, y: TOWN_GROUND - h + 4 });
    }
  // Tier = 1 + the highest tier among reachable ledges right below it (the
  // street is tier 0); a ledge nothing can reach is left out.
  const tiers = new Map();
  for (const q of [...raw].sort((a, b) => b.y - a.y)) {
    let best = q.y >= TOWN_GROUND - 162 ? 0 : -1; // one jump rises ~168
    for (const [f, t] of tiers)
      if (
        f.y - q.y > 0 &&
        f.y - q.y <= 150 &&
        Math.min(f.x + f.w, q.x + q.w) - Math.max(f.x, q.x) > 40
      )
        best = Math.max(best, t);
    if (best >= 0) tiers.set(q, best + 1);
  }
  return raw
    .filter((q) => tiers.has(q))
    .map((q) => ({ ...q, tier: tiers.get(q) }))
    .sort((a, b) => a.tier - b.tier || b.y - a.y || a.x - b.x);
}
