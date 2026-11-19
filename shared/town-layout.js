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

// Width and height are the keyed piece sizes (public/assets/town-kit/kit.json).
export const TOWN_PIECES = {
  tree: { w: 644, h: 572, ledges: [] },
  stall: { w: 580, h: 480, ledges: [] },
  stairs: {
    w: 504,
    h: 372,
    ledges: [
      [200, 504, 125],
      [326, 500, 236],
    ],
  },
  shop: {
    w: 610,
    h: 375,
    ledges: [
      [86, 326, 154],
      [30, 560, 222],
    ],
  },
  smithy: {
    w: 666,
    h: 489,
    ledges: [
      [0, 666, 220],
      [0, 666, 333],
    ],
  },
  tower: {
    w: 340,
    h: 556,
    ledges: [
      [50, 290, 130],
      [40, 300, 210],
      [30, 310, 348],
    ],
  },
  cavegate: { w: 680, h: 420, ledges: [] }, // the portal stands in the arch
};

// Left to right; x is where each piece's left edge stands.
export const TOWN_LAYOUT = [
  { piece: "tree", x: -40 },
  { piece: "stall", x: 560 },
  { piece: "stairs", x: 1180 },
  { piece: "shop", x: 1720 },
  { piece: "smithy", x: 2360 },
  { piece: "tower", x: 3060 },
  { piece: "cavegate", x: 3420 },
];

export const TOWN_WIDTH = TOWN_LAYOUT.reduce(
  (w, p) => Math.max(w, p.x + TOWN_PIECES[p.piece].w),
  0,
);

// Props: key is the texture (prop-<sheet>-<n> or anim-<name>), x the centre.
// Ground props stand on y (default the street); hanging props hang from y.
// front: drawn in front of the heroes. step: [w, h] climbable top.
export const TOWN_PROPS = [
  { key: "prop-px-20", x: 40 },
  { key: "prop-px-8", x: 150 },
  { key: "prop-px-2", x: 470 },
  { key: "prop-px-10", x: 540, front: true },
  { key: "prop-px-16", x: 1110 },
  { key: "prop-px-4", x: 1150, step: [77, 84] },
  { key: "prop-px-12", x: 1440 },
  { key: "prop-px-3", x: 1700 },
  { key: "prop-px-17", x: 2350 },
  { key: "prop-px-7", x: 2340 },
  { key: "anim-brazier", x: 2330 },
  { key: "prop-px-11", x: 2600, front: true },
  { key: "prop-px-6", x: 3040, step: [74, 68] },
  { key: "anim-lantern", x: 3230, y: 410, hang: true },
  { key: "prop-px-22", x: 3440 },
  { key: "prop-px-9", x: 3450, front: true },
  { key: "prop-px-21", x: 4090 },
  { key: "prop-px-13", x: 4060, front: true },
];

// Animated props: 4-frame loops, frame size in px (kit.json).
export const TOWN_ANIMS = {
  banner: [94, 99],
  lantern: [82, 111],
  brazier: [91, 103],
};

// NPC spots and the portal (world coordinates).
export const TOWN_SPOTS = {
  elder: 300, // under the great tree
  potion: 850, // at the stall counter
  weapon: 2050, // in front of the shop
  forge: 2678, // at the anvil
  portal: { x: 3760, y: TOWN_BASE - 100 }, // inside the cave arch
  forgeFire: { x: 2805, y: TOWN_BASE - 52 },
  chimney: { x: 2840, y: TOWN_BASE - 410 },
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
