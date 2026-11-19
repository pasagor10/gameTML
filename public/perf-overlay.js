// Developer performance overlay and crash breadcrumbs.
//
// The overlay (Settings → "แสดงตัววัดประสิทธิภาพ", or tapping the lobby build
// number) shows FPS, frame time, JS heap, texture memory, display objects,
// draw calls, particles, timers and the graphics preset.
//
// Breadcrumbs: every 10 s a small memory sample, plus errors, WebGL context
// loss and quality changes, go to localStorage. When Chrome on a low-memory
// tablet kills the tab, the next visit can still read what led up to it.

const LOG_KEY = "tml-perf-log",
  LOG_MAX = 60;

// Page-level timers, counted from here on (earlier ones are not seen).
const liveIntervals = new Set();
if (typeof window !== "undefined") {
  const set = window.setInterval.bind(window),
    clear = window.clearInterval.bind(window);
  window.setInterval = (...args) => {
    const id = set(...args);
    liveIntervals.add(id);
    return id;
  };
  window.clearInterval = (id) => {
    liveIntervals.delete(id);
    return clear(id);
  };
}

export function readLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}
export function logEvent(kind, data = {}) {
  try {
    const log = readLog();
    log.push({ at: Date.now(), kind, ...data });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_MAX)));
  } catch {}
}

// Textures the engine holds, with an RGBA estimate of their GPU size.
// Each source image counts once even when several textures share it.
export function textureStats(game) {
  const seen = new Set();
  let count = 0,
    bytes = 0;
  for (const [key, tex] of Object.entries(game?.textures?.list || {})) {
    if (key.startsWith("__")) continue;
    count++;
    for (const src of tex.source || []) {
      const id = src.image || src;
      if (seen.has(id)) continue;
      seen.add(id);
      bytes += (src.width || 0) * (src.height || 0) * 4;
    }
  }
  return { count, mb: bytes / 1048576 };
}

function displayStats(scene) {
  let objects = 0,
    visible = 0,
    particles = 0;
  const walk = (list) => {
    for (const o of list) {
      objects++;
      if (o.visible) visible++;
      if (o.type === "ParticleEmitter") particles += o.getAliveParticleCount?.() || 0;
      if (o.list) walk(o.list);
    }
  };
  walk(scene?.children?.list || []);
  return { objects, visible, particles };
}

export function createPerfOverlay({ el, game, scene, quality, socket, build }) {
  let on = false,
    ping = null,
    draws = 0,
    frames = 0,
    hooked = null;
  // Count draw calls on the engine's own WebGL context while shown.
  const hook = () => {
    const gl = game()?.renderer?.gl;
    if (!gl || hooked === gl) return;
    hooked = gl;
    for (const name of ["drawElements", "drawArrays"]) {
      const orig = gl[name].bind(gl);
      gl[name] = (...a) => {
        draws++;
        return orig(...a);
      };
    }
    game().events.on("postrender", () => frames++);
  };
  const sample = () => {
    const g = game(),
      s = scene(),
      tex = textureStats(g),
      d = displayStats(s),
      heap = performance.memory?.usedJSHeapSize;
    return {
      fps: Math.round(g?.loop?.actualFps || 0),
      ms: +(g?.loop?.delta || 0).toFixed(1),
      heapMb: heap ? Math.round(heap / 1048576) : null,
      texMb: Math.round(tex.mb),
      textures: tex.count,
      ...d,
      tweens: s?.tweens?.getTweens?.().length ?? 0,
      clocks: s?.time?._active?.length ?? 0,
      intervals: liveIntervals.size,
      quality: quality(),
    };
  };
  setInterval(() => {
    if (!on || !el) return;
    hook();
    const io = socket();
    if (io?.connected) {
      const sent = performance.now();
      io.timeout(3000).emit("net:ping", {}, (err) => {
        ping = err ? null : Math.round(performance.now() - sent);
      });
    }
    const m = sample(),
      perFrame = frames ? Math.round(draws / frames) : "–";
    draws = frames = 0;
    el.textContent = [
      `FPS ${m.fps} · ${m.ms} ms · ping ${ping ?? "–"}ms · ${m.quality}`,
      `heap ${m.heapMb ?? "–"} MB · tex ${m.texMb} MB (${m.textures})`,
      `objects ${m.visible}/${m.objects} · draws ${perFrame} · particles ${m.particles}`,
      `tweens ${m.tweens} · timers ${m.clocks} · intervals ${m.intervals}`,
      build,
    ].join("\n");
  }, 1000);
  // Breadcrumbs for crashes, whether or not the overlay is shown.
  setInterval(() => {
    if (game()) logEvent("sample", sample());
  }, 10000);
  addEventListener("error", (e) => logEvent("error", { message: String(e.message).slice(0, 200), src: `${e.filename}:${e.lineno}` }));
  addEventListener("unhandledrejection", (e) => logEvent("rejection", { message: String(e.reason?.message || e.reason).slice(0, 200) }));
  return {
    set(value) {
      on = value;
      if (el) el.hidden = !on;
    },
    get on() {
      return on;
    },
    sample,
  };
}
