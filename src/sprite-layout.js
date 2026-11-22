export const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
export const FRAME_SIZE = 256;
export const FOOT_ANCHOR = { x: 128, y: 224 };
export function directionFor(x, y, previous = 'se') {
  if (Math.hypot(x, y) < 0.05) return previous;
  const index = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 2 + 8) % 8;
  return DIRECTIONS[index];
}
export const RUN_STRIDE = 112;
export const HERO_SCALE = .78;
export function animationFrame(time, moving, frames = moving ? 8 : 4, distance) {
  const phase = moving && Number.isFinite(distance)
    ? Math.max(0, distance) / RUN_STRIDE * frames
    : Math.max(0, time) * (moving ? 12 : 4);
  return Math.floor(phase + 1e-8) % frames;
}
export function cameraZoom(width, height) {
  return Math.max(.60, Math.min(.88, width / 800, height / 850));
}

export function sourceRect(direction, frame, columns) {
  const row = DIRECTIONS.indexOf(direction);
  return { x: frame * FRAME_SIZE, y: Math.max(0, row) * FRAME_SIZE, width: FRAME_SIZE, height: FRAME_SIZE };
}
