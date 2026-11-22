export const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
export const FRAME_SIZE = 256;
export const FOOT_ANCHOR = { x: 128, y: 224 };
// Extra angle (radians) the input must pass beyond a sector edge before the sheet row changes.
// Without it a finger dragging near a 22.5° edge flips between two different-looking rows every frame.
export const DIRECTION_HYSTERESIS = .2;
export function directionFor(x, y, previous = 'se') {
  if (Math.hypot(x, y) < 0.05) return previous;
  const angle = Math.atan2(y, x);
  const index = (Math.round(angle / (Math.PI / 4)) + 2 + 8) % 8;
  const held = DIRECTIONS.indexOf(previous);
  if (held >= 0 && index !== held) {
    const heldAngle = (held - 2) * Math.PI / 4;
    const offset = Math.abs(Math.atan2(Math.sin(angle - heldAngle), Math.cos(angle - heldAngle)));
    if (offset < Math.PI / 8 + DIRECTION_HYSTERESIS) return previous;
  }
  return DIRECTIONS[index];
}
// One full 8-frame cycle per RUN_STRIDE world units: ~12 frames/s at the 145 u/s run speed.
export const RUN_STRIDE = 96;
export const HERO_SCALE = .78;
// timing: optional per-frame hold weights (summing to `frames`) measured from the artwork, so
// the visible pose advances evenly even when neighbouring painted frames differ unevenly.
export function animationFrame(time, moving, frames = moving ? 8 : 4, distance, timing) {
  const phase = moving && Number.isFinite(distance)
    ? Math.max(0, distance) / RUN_STRIDE * frames
    : Math.max(0, time) * (moving ? 12 : 4);
  if (!timing || timing.length !== frames) return Math.floor(phase + 1e-8) % frames;
  let local = (phase + 1e-8) % frames;
  for (let i = 0; i < frames; i++) {
    if (local < timing[i]) return i;
    local -= timing[i];
  }
  return frames - 1;
}
export function cameraZoom(width, height) {
  return Math.max(.60, Math.min(.88, width / 800, height / 850));
}

export function sourceRect(direction, frame, columns) {
  const row = DIRECTIONS.indexOf(direction);
  return { x: frame * FRAME_SIZE, y: Math.max(0, row) * FRAME_SIZE, width: FRAME_SIZE, height: FRAME_SIZE };
}
