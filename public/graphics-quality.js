// Graphics presets. Gameplay is identical in every preset; only what is
// drawn, how often and at what resolution changes.
//
// fps:         frame cap (0 = display rate)
// renderScale: canvas pixels per CSS pixel; the canvas is stretched to fill
// ambient:     fog, light shafts, vignette, colour grade, drifting haze
// particles:   share of ambient/aura particles kept (0 = none)
// glow:        weapon and boss glow shaders (offscreen passes per sprite)
// cull:        stop animating heroes/monsters outside the camera
// textRes:     cap on world-label texture resolution
// rim:         dark outline copies behind characters (4 extra sprites each)
export const PRESETS = {
  low: { name: "ต่ำ", fps: 30, renderScale: 0.75, ambient: false, particles: 0, glow: false, cull: true, textRes: 1.5, rim: false },
  medium: { name: "กลาง", fps: 0, renderScale: 1, ambient: true, particles: 0.5, glow: false, cull: true, textRes: 2, rim: true },
  high: { name: "สูง", fps: 0, renderScale: 1, ambient: true, particles: 1, glow: true, cull: false, textRes: 3, rim: true },
};
export const LEVELS = ["low", "medium", "high"];
export const CHOICES = ["auto", ...LEVELS];

// Starting preset for "auto" from what the browser reports. deviceMemory is
// Chrome's rounded RAM figure (absent elsewhere); 4 GB tablets start Low.
export function autoLevel({ deviceMemory, cores, coarse } = {}) {
  if (deviceMemory && deviceMemory <= 4) return "low";
  if ((deviceMemory && deviceMemory <= 6) || (cores && cores <= 4) || coarse) return "medium";
  return "high";
}

export function lower(level) {
  return LEVELS[Math.max(0, LEVELS.indexOf(level) - 1)];
}

// "auto" steps down one level after this many consecutive slow seconds.
export const SLOW_FPS = 25,
  SLOW_SECONDS = 5;

// One second's frame rate in; returns the level to switch to, or null.
export function createAutoTuner(start) {
  let level = start,
    slow = 0;
  return {
    get level() {
      return level;
    },
    tick(fps, cap) {
      // A capped preset can't exceed its cap: judge it against that.
      const target = cap ? Math.min(SLOW_FPS, cap - 5) : SLOW_FPS;
      slow = fps > 0 && fps < target ? slow + 1 : 0;
      if (slow < SLOW_SECONDS || level === "low") return null;
      slow = 0;
      level = lower(level);
      return level;
    },
  };
}
