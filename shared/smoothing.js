// Interpolate server positions instead of chasing a stationary 10 Hz target.
export function sampleMotion(history, time) {
  if (!history.length) return { x: 0, y: 0 };
  for (let n = 1; n < history.length; n++) {
    const a = history[n - 1],
      b = history[n];
    if (time <= b.time) {
      const mix = Math.max(
        0,
        Math.min(1, (time - a.time) / Math.max(0.001, b.time - a.time)),
      );
      return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix };
    }
  }
  const last = history.at(-1),
    dt = Math.max(0, Math.min(0.08, time - last.time));
  return { x: last.x + (last.vx || 0) * dt, y: last.y };
}
