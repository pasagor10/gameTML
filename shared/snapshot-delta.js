// Snapshot deltas. The server sends world:snapshot 20 times a second; most of
// it (inventory, stats, bestiary, shops, other heroes' gear, enemy types…)
// rarely changes. packSnapshot() keeps what this client was last sent and
// drops unchanged fields; mergeSnapshot() rebuilds the full snapshot.
//
// Movement and combat-timing fields are always sent raw, exactly as before,
// so an absent value still reads as undefined. Every other field is sent only
// when its JSON changes (undefined → null so a cleared value still arrives).
// Every FULL_EVERY packs the memo resets and a complete snapshot goes out.

export const HOT_PLAYER = [
  "id", "x", "y", "direction", "moving", "vx", "running", "grounded", "vy",
  "action", "hitAt", "hitDirection", "diedAt", "reviveAt", "hp", "attackAt",
];
// Enemy fields fixed at spawn. Anything not listed is sent every packet.
export const COLD_ENEMY = [
  "homeX", "homeY", "maxHp", "type", "night", "world", "power", "variant",
  "trait", "boss", "elite", "speed", "spawnAt",
];
const HOT_TOP = ["time", "area", "dungeon", "online"];
const FULL_EVERY = 100; // 5 s at 20 Hz

export function createSnapshotMemo() {
  return { self: new Map(), top: new Map(), players: new Map(), enemies: new Map(), packs: 0 };
}

const json = (v) => JSON.stringify(v ?? null);

function diffKeys(src, memo, hot) {
  const out = {};
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (hot.includes(key)) {
      out[key] = v;
      continue;
    }
    const j = json(v);
    if (memo.get(key) === j) continue;
    memo.set(key, j);
    out[key] = v ?? null;
  }
  return out;
}

// Each entity keeps its hot fields; its cold fields ride along as `cold`
// only when they differ from what this client already holds.
function packEntities(list, memo, isCold) {
  const seen = new Set();
  const out = list.map((m) => {
    seen.add(m.id);
    const hot = {}, cold = {};
    for (const key of Object.keys(m))
      if (key !== "id" && isCold(key)) cold[key] = m[key] ?? null;
      else hot[key] = m[key];
    const j = JSON.stringify(cold);
    if (memo.get(m.id) === j) return hot;
    memo.set(m.id, j);
    return { ...hot, cold };
  });
  for (const id of memo.keys()) if (!seen.has(id)) memo.delete(id);
  return out;
}

function mergeEntities(list, cache) {
  const out = list.map(({ cold, ...hot }) => {
    if (cold) cache.set(hot.id, cold);
    return { ...cache.get(hot.id), ...hot };
  });
  const ids = new Set(out.map((m) => m.id));
  for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
  return out;
}

export function packSnapshot(memo, snap) {
  if (memo.packs++ % FULL_EVERY === 0)
    for (const part of [memo.self, memo.top, memo.players, memo.enemies]) part.clear();
  const { self, players, ...top } = snap;
  const out = diffKeys(top, memo.top, HOT_TOP);
  out.self = diffKeys(self, memo.self, HOT_PLAYER);
  out.players = packEntities(players, memo.players, (key) => !HOT_PLAYER.includes(key));
  if (top.dungeon?.enemies)
    out.dungeon = {
      ...top.dungeon,
      enemies: packEntities(top.dungeon.enemies, memo.enemies, (key) => COLD_ENEMY.includes(key)),
    };
  else memo.enemies.clear();
  return out;
}

// prev: the last merged snapshot (or null). caches: an object the caller keeps
// for the life of one connection ({} to start).
export function mergeSnapshot(prev, packet, caches) {
  caches.players ||= new Map();
  caches.enemies ||= new Map();
  const self = { ...prev?.self, ...packet.self };
  // Hot fields come only from this packet, as in an unpacked snapshot.
  for (const key of HOT_PLAYER) if (!(key in packet.self)) delete self[key];
  const out = { ...prev, ...packet, self, players: mergeEntities(packet.players, caches.players) };
  if (packet.dungeon?.enemies)
    out.dungeon = { ...packet.dungeon, enemies: mergeEntities(packet.dungeon.enemies, caches.enemies) };
  else caches.enemies.clear();
  return out;
}
