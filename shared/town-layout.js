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
  tree: { w: 512, h: 750, ledges: [] },
  stall: { w: 369, h: 550, ledges: [] },
  shop: {
    w: 521,
    h: 523,
    ledges: [
      [0, 521, 60],
      [0, 521, 206],
    ],
  },
  stairs: {
    w: 430,
    h: 633,
    ledges: [
      [0, 430, 153],
      [0, 430, 298],
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
    w: 430,
    h: 637,
    ledges: [
      [0, 430, 92],
      [27, 403, 190],
      [85, 345, 345],
    ],
  },
  cavegate: { w: 456, h: 605, ledges: [[130, 340, 152]] }, // portal landing
};

// Left to right; x is where each piece's left edge stands.
export const TOWN_LAYOUT = [
  { piece: "tree", x: 0 },
  { piece: "stall", x: 512 },
  { piece: "shop", x: 881 },
  { piece: "stairs", x: 1402 },
  { piece: "smithy", x: 1832 },
  { piece: "tower", x: 2498 },
  { piece: "cavegate", x: 2928 },
];

export const TOWN_WIDTH = TOWN_LAYOUT.reduce(
  (w, p) => Math.max(w, p.x + TOWN_PIECES[p.piece].w),
  0,
);

// Props: key is the texture (prop-<sheet>-<n> or anim-<name>), x the centre.
// Ground props stand on y (default the street); hanging props hang from y.
// front: drawn in front of the heroes. step: [w, h] climbable top.
export const TOWN_PROPS = [
  { key: "prop-foliage-0", x: 36 },
  { key: "prop-ground-1", x: 140 },
  { key: "prop-foliage-4", x: 250, front: true },
  { key: "prop-ground-8", x: 455 },
  { key: "prop-ground-4", x: 900 },
  { key: "prop-hanging-2", x: 880, y: 300, hang: true },
  { key: "prop-ground-7", x: 1010 },
  { key: "anim-banner", x: 1020, y: 405, hang: true },
  { key: "prop-ground-3", x: 1335 },
  { key: "prop-ground-9", x: 1400 },
  { key: "prop-foliage-1", x: 1790 },
  { key: "prop-ground-6", x: 1825 },
  { key: "prop-ground-11", x: 2405 },
  { key: "prop-ground-1", x: 2462, step: [57, 100] },
  { key: "anim-brazier", x: 2350 },
  { key: "prop-foliage-5", x: 2560, front: true },
  { key: "anim-lantern", x: 2713, y: 400, hang: true },
  { key: "prop-foliage-3", x: 2935 },
  { key: "prop-foliage-2", x: 3345 },
  { key: "prop-foliage-7", x: 3300, front: true },
];

// Animated props: 4-frame loops, frame size in px (kit.json).
export const TOWN_ANIMS = {
  banner: [94, 99],
  lantern: [82, 111],
  brazier: [91, 103],
};

// NPC spots and the portal (world coordinates).
export const TOWN_SPOTS = {
  elder: 385, // under the great tree
  potion: 680, // at the stall counter
  weapon: 2000, // beside the weapon rack
  forge: 2150, // at the anvil
  portal: { x: 3168, y: TOWN_BASE - 245 },
  forgeFire: { x: 2277, y: TOWN_BASE - 52 },
  chimney: { x: 2312, y: TOWN_BASE - 410 },
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
