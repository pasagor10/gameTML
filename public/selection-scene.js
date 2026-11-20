import {
  queueSpriteSets,
  createSpriteRegistry,
  playSpriteSet,
  playLayers,
} from "/sprite-sets.js?v=0.23.0";
import { gearDress } from "/hero-gear.js?v=6";

// The hero-select stage: the same sprite sets, costume layers and held
// weapons that the world draws, lined up as a carousel. The chosen hero
// stands in front on a rune circle; the others wait on either side facing
// it, smaller and in shadow. Tapping a waiting hero picks it.
//
// The canvas is backed by real device pixels (no CSS stretch) and the front
// hero is drawn at about BOOST times its in-town size, snapped so each art
// pixel covers a whole number of screen pixels: pixel art stays crisp and
// even instead of breaking into 5- and 6-pixel stripes. The whole lineup
// scales with it.
export function createSelectionPreview({ onPick } = {}) {
  const host = document.querySelector("#hero-preview");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const RES = 2,
    W = 720,
    H = 600,
    FEET = 490,
    // Display height per set height unit, by distance from the front.
    SIZE = [2.45, 1.4, 1.05],
    SPREAD = [0, 170, 290],
    LIFT = [0, 26, 44],
    // Front hero on the select stage: about this many times its in-town size.
    BOOST = 2.2;
  const ratio = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  let lineup = [],
    selected = 0,
    ready = false,
    scene = null;

  class SelectionScene extends Phaser.Scene {
    preload() {
      // Pixel heroes get a 4x finer EPX copy here: the stage shows them far
      // larger than town does, where plain enlarged pixels look blocky.
      this.pixelDetail = 4;
      queueSpriteSets(this);
    }
    create() {
      scene = this;
      this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
      this.sprites = createSpriteRegistry(this);
      this.slots = new Map();
      // Rune circle under the chosen hero.
      this.glow = this.add.ellipse(W / 2, FEET, 300, 58, 0xffc75a, 0.16).setDepth(1);
      this.ring = this.add.graphics().setDepth(2);
      this.motes = Array.from({ length: 22 }, (_, i) => ({
        dot: this.add
          .circle(0, 0, i % 4 ? 1.2 : 2, i % 3 ? 0xffe2a0 : 0xbfe8ff, 0.5)
          .setDepth(30),
        phase: i * 2.4,
        x: W / 2 - 170 + ((i * 83) % 340),
        y: FEET - 40 - ((i * 47) % 300),
      }));
      ready = true;
      host.parentElement.classList.add("preview-ready");
      this.sync();
    }
    // Match the stage to the lineup: new heroes fade in, removed ones go.
    sync() {
      const ids = new Set(lineup.map((e) => e.id));
      for (const [id, slot] of this.slots)
        if (!ids.has(id)) {
          slot.holder.layers?.destroy();
          slot.image.destroy();
          slot.shadow.destroy();
          this.slots.delete(id);
        }
      lineup.forEach((entry, i) => {
        for (const skin of entry.skins) this.sprites.want("sets", skin);
        let slot = this.slots.get(entry.id);
        if (!slot) {
          const image = this.add
            .image(W / 2, FEET, "__DEFAULT")
            .setOrigin(0.5, 1)
            .setAlpha(0)
            // Hit only the drawn pixels: the art frames carry wide clear
            // margins that would cover the heroes beside the front one.
            .setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 8 });
          image.on("pointerup", () => onPick?.(slot.index));
          slot = {
            image,
            shadow: this.add.ellipse(W / 2, FEET + 3, 120, 18, 0x05080f, 0.45).setDepth(3),
            holder: {},
            x: W / 2 + (i - selected) * 200,
            size: SIZE[2],
            lift: LIFT[2],
            fade: 0,
          };
          this.slots.set(entry.id, slot);
        }
        slot.entry = entry;
        slot.index = i;
      });
      this.previewMode = "idle";
      this.previewAt = this.time.now;
    }
    // Camera zoom (device pixels per world unit) that makes the front hero
    // BOOST times as large as in town (same zoom rule as the game camera),
    // rounded so one art pixel spans whole device pixels. Feet stay on the
    // rune circle.
    frame() {
      const w = innerWidth,
        h = innerHeight,
        r = ratio(),
        cw = this.scale.width,
        ch = this.scale.height,
        town = h > w && w < 700
          ? Phaser.Math.Clamp(w / 600, 0.5, 1.1)
          : Math.max(w < 700 ? 0.45 : 0.55, h / 1150),
        front = [...this.slots.values()].find((s) => s.index === selected),
        set = front?.entry.skins.map((s) => this.sprites.heroes.get(s)).find(Boolean),
        body = set?.clips.idle && set.clips.idle.bodyPx / (set.clips.idle.detail || 1),
        // Largest zoom: the front hero fills at most 72% of the stage height
        // and the middle 440 world units fit across (neighbours may crop).
        most = Math.min(cw / 440, (ch * 0.72) / ((set?.height || 83) * SIZE[0]));
      // At least BOOST times the in-town size, and at least 55% of the stage
      // height so it reads as the centrepiece on large screens too.
      let z = Math.min(
        most,
        Math.max((town * BOOST * r) / SIZE[0], (ch * 0.55) / ((set?.height || 83) * SIZE[0])),
      );
      if (body) {
        const worldPerArt = (set.height * SIZE[0]) / body,
          px = z * worldPerArt;
        if (px >= 1.5)
          // Round up to the next whole pixel size when it still fits.
          z = Math.max(1, Math.min(Math.ceil(px - 0.15), Math.floor(most * worldPerArt))) / worldPerArt;
      }
      const key = `${z.toFixed(5)}:${cw}:${ch}`;
      if (key === this.frameKey) return;
      this.frameKey = key;
      this.z = z;
      this.r = r;
      const feet = Math.round((ch * FEET) / H);
      this.cameras.main.setZoom(z).centerOn(W / 2, FEET - (feet - ch / 2) / z);
    }
    update(time, delta) {
      this.frame();
      const n = lineup.length,
        k = Math.min(1, (delta / 1000) * (reducedMotion.matches ? 60 : 9)),
        t = reducedMotion.matches ? 0 : time / 1000;
      if (time - (this.previewAt || 0) > 1800) this.previewMode = "idle";
      for (const slot of this.slots.values()) {
        let o = slot.index - selected;
        if (n > 2) {
          if (o > n / 2) o -= n;
          if (o < -Math.floor((n - 1) / 2)) o += n;
        }
        const d = Math.min(2, Math.abs(o)),
          front = d === 0;
        slot.x += (W / 2 + Math.sign(o) * SPREAD[d] - slot.x) * k;
        slot.size += (SIZE[d] - slot.size) * k;
        // Land exactly on the stop size so the front hero's pixels stay whole.
        if (Math.abs(SIZE[d] - slot.size) < 0.003) slot.size = SIZE[d];
        slot.lift += (LIFT[d] - slot.lift) * k;
        slot.fade += ((front ? 1 : d === 1 ? 0.5 : 0.3) - slot.fade) * k;
        const set = slot.entry.skins.map((s) => this.sprites.heroes.get(s)).find(Boolean);
        const { image, shadow } = slot;
        if (!set) {
          image.setVisible(false);
          shadow.setVisible(false);
          slot.holder.layers?.destroy();
          continue;
        }
        const mode = front ? this.previewMode : "idle",
          startedAt = (this.previewAt || 0) / 1000;
        image.setVisible(true);
        playSpriteSet(
          image,
          { ...set, height: set.height * slot.size },
          {
            direction: 1,
            action: front && ["attack", "skill"].includes(mode)
              ? { startedAt, impactAt: startedAt + 0.55, endsAt: startedAt + 1.8 }
              : null,
          },
          { state: mode, frame: 0 },
          t + slot.index * 0.37,
        );
        // Waiting heroes turn toward the one in front.
        const faceLeft = o > 0;
        image
          .setFlipX(faceLeft ? set.facing > 0 : set.facing < 0)
          .setPosition(slot.x, FEET - slot.lift)
          .setAlpha(slot.fade)
          .setDepth(front ? 20 : 10 - d);
        if (front) image.clearTint();
        else image.setTint(d === 1 ? 0x86a89b : 0x57796d);
        shadow
          .setVisible(true)
          .setPosition(slot.x, FEET - slot.lift + 2)
          .setSize(36 * slot.size, 7 * slot.size)
          .setAlpha(0.5 * slot.fade)
          .setDepth(image.depth - 0.5);
        if (set.layers)
          playLayers(this, slot.holder, image, set, gearDress(slot.entry.hero || { class: slot.entry.job }, set), this.sprites);
        else slot.holder.layers?.destroy();
      }
      // The rune circle: two counter-turning dashed rings over a soft glow.
      const spin = reducedMotion.matches ? 0 : time * 0.0004;
      this.ring.clear();
      for (const [rx, ry, a, dir, dash] of [
        [150, 30, 0.75, 1, 24],
        [118, 23, 0.45, -1.4, 14],
      ]) {
        this.ring.lineStyle((2 * (this.r || 1)) / (this.z || 1), 0xffd77a, a);
        for (let j = 0; j < dash; j++) {
          const a0 = spin * dir + (j / dash) * Math.PI * 2,
            a1 = a0 + (Math.PI * 2) / dash / 2;
          this.ring.lineBetween(
            W / 2 + Math.cos(a0) * rx, FEET + Math.sin(a0) * ry,
            W / 2 + Math.cos(a1) * rx, FEET + Math.sin(a1) * ry,
          );
        }
      }
      const pulse = reducedMotion.matches ? 0.5 : 0.5 + Math.sin(time * 0.002) * 0.5;
      this.glow.setAlpha(0.2 + pulse * 0.1);
      if (reducedMotion.matches) return;
      for (const m of this.motes) {
        m.dot.x = m.x + Math.sin(time * 0.0004 + m.phase) * 14;
        m.dot.y = m.y - ((time * 0.012 + m.phase * 40) % 300) + 150;
        m.dot.alpha = Math.max(0, 0.15 + Math.sin(time * 0.001 + m.phase) * 0.35);
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    transparent: true,
    width: W * RES,
    height: H * RES,
    // The canvas is sized to the stage box in device pixels (see refit), so
    // nothing resamples it after Phaser draws. CSS owns the stage rectangle.
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / ratio() },
    scene: SelectionScene,
    audio: { noAudio: true },
    // Pixel sets carry nearest sampling on their own textures; rounding
    // positions keeps their pixels on the device grid.
    render: { antialias: true, pixelArt: false, roundPixels: true },
    fps: { target: 30, forceSetTimeOut: true },
    banner: false,
  });
  const visibility = () => {
    const hidden =
      document.hidden ||
      document.querySelector("#landing").classList.contains("hidden") ||
      !document.querySelector("#prologue").classList.contains("hidden");
    if (hidden) game.loop.sleep();
    else game.loop.wake();
  };
  // Refit whenever the stage box changes (rotation, panel growing, resize).
  const refit = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!(width > 0 && height > 0)) return;
    const r = ratio();
    game.scale.resize(Math.round(width * r), Math.round(height * r));
    game.scale.setZoom(1 / r);
  });
  refit.observe(host);
  const observer = new MutationObserver(visibility);
  for (const id of ["landing", "prologue"])
    observer.observe(document.getElementById(id), {
      attributes: true,
      attributeFilter: ["class"],
    });
  document.addEventListener("visibilitychange", visibility);
  return {
    // entries: [{ id, job, skins, hero }]; index: the one in front.
    setLineup(entries, index) {
      const changed =
        JSON.stringify(entries.map((e) => [e.id, e.skins])) !==
        JSON.stringify(lineup.map((e) => [e.id, e.skins]));
      lineup = entries;
      if (index !== selected) {
        selected = index;
        if (scene) {
          scene.previewMode = "idle";
          scene.previewAt = scene.time.now;
        }
      }
      if (ready && changed) scene.sync();
      else if (ready) for (const [i, e] of lineup.entries()) {
        const slot = scene.slots.get(e.id);
        if (slot) Object.assign(slot, { entry: e, index: i });
      }
    },
    preview(mode) {
      if (!ready || !["idle", "run", "attack", "skill"].includes(mode)) return;
      scene.previewMode = mode;
      scene.previewAt = scene.time.now;
    },
    destroy() {
      observer.disconnect();
      refit.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      // Phaser tears a game down on its next frame, so a sleeping loop would
      // keep everything alive: wake it. Phaser 3 never releases the WebGL
      // context itself; losing it frees its GPU memory now instead of at GC.
      const gl = game.renderer?.gl;
      game.events.once("destroy", () => gl?.getExtension("WEBGL_lose_context")?.loseContext());
      game.loop.wake();
      game.destroy(true);
    },
  };
}
