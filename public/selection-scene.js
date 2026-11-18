import {
  queueSpriteSets,
  createSpriteRegistry,
  playSpriteSet,
  playLayers,
} from "/sprite-sets.js?v=0.21.1";
import { gearDress } from "/hero-gear.js?v=5";

// The chosen hero fades in on the pedestal. Account and creation actions remain in game.js.
//
// The canvas renders at twice its layout size (camera zoom 2) so the hero
// stays crisp on large and high-DPI screens. While idle the hero shows its
// set's "showcase" frame: the full-resolution idle cell, sharpened (built by
// tools/sprite-rig/build_showcase.py), swapped in at the sprite's own size and
// anchor. Motion previews (run, attack, skill) play the normal sprite set.
export function createSelectionPreview() {
  const host = document.querySelector("#hero-preview");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = {
    job: "swordsman",
    gender: "female",
    skins: ["swordsman-female"],
    identity: "create-swordsman-female",
  };
  let ready = false;
  const RES = 2,
    W = 600,
    H = 650,
    FEET = 560,
    HERO_HEIGHT = 380,
    PIXEL_SCALE = 4;
  const holder = {};
  class SelectionScene extends Phaser.Scene {
    preload() {
      queueSpriteSets(this);
    }
    create() {
      this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
      this.sprites = createSpriteRegistry(this);
      this.shadow = this.add.ellipse(W / 2, FEET + 4, 210, 26, 0x05120f, 0.4);
      this.hero = this.add.image(W / 2, FEET, "__DEFAULT").setOrigin(0.5, 1).setAlpha(0);
      this.motes = Array.from({ length: 14 }, (_, i) => ({
        dot: this.add.circle(
          130 + ((i * 73) % 350),
          160 + ((i * 47) % 350),
          i % 3 ? 1 : 1.8,
          0xffe8a4,
          0.5,
        ),
        phase: i * 2.4,
        x: 130 + ((i * 73) % 350),
        y: 160 + ((i * 47) % 350),
      }));
      ready = true;
      host.parentElement.classList.add("preview-ready");
      this.select();
    }
    select() {
      for (const skin of selected.skins) this.sprites.want("sets", skin);
      this.previewMode = "idle";
      this.previewAt = this.time.now;
      this.selectionAt = this.time.now;
      this.standStarted = null;
      this.hero.setAlpha(0);
    }
    // Texture key of the set's sharp idle frame, loading it on first use.
    showcase(set) {
      const spec = this.spriteSetIndex?.sets?.[set.name];
      if (!spec?.showcase) return null;
      const key = `showcase:${spec.dir}`;
      if (this.textures.exists(key)) return key;
      if (!this.wanted?.has(key)) {
        (this.wanted ??= new Set()).add(key);
        const v = this.spriteSetIndex.version;
        this.load.image(key, `/assets/sprites/${spec.dir}/${spec.showcase}${v ? `?v=${v}` : ""}`);
        if (!this.load.isLoading()) this.load.start();
      }
      return null;
    }
    update(time) {
      const set = selected.skins
        .map((k) => this.sprites.heroes.get(k))
        .find(Boolean);
      if (!set) {
        holder.layers?.destroy();
        return;
      }
      this.standStarted ??= time;
      const t = reducedMotion.matches
        ? 1
        : Phaser.Math.Clamp((time - this.standStarted - 80) / 430, 0, 1);
      const rise = 1 - (1 - t) ** 3;
      let mode = this.previewMode;
      if (time - this.previewAt > 1800) mode = this.previewMode = "idle";
      {
        const startedAt = this.previewAt / 1000;
        playSpriteSet(
          this.hero,
          // Pixel sets at a whole 4x so every art pixel stays square.
          { ...set, height: set.pixel ? set.clips.idle.bodyPx * PIXEL_SCALE : HERO_HEIGHT },
          {
            direction: 1,
            action: ["attack", "skill"].includes(mode)
              ? {
                  startedAt,
                  impactAt: startedAt + 0.55,
                  endsAt: startedAt + 1.8,
                }
              : null,
          },
          { state: mode, frame: 0 },
          reducedMotion.matches ? 0 : time / 1000,
        );
        this.hero.setFlipX(set.facing < 0);
      }
      // Idle: the sharp showcase frame at the sprite's size, with a slow breath.
      const sharp = this.hero._clip?.state === "idle" && !set.layers && this.showcase(set);
      if (sharp) {
        const w = this.hero.displayWidth,
          h = this.hero.displayHeight,
          breath = reducedMotion.matches ? 0 : Math.sin(time * 0.0021) * 0.008;
        this.hero.setTexture(sharp).setDisplaySize(w * (1 - breath * 0.5), h * (1 + breath));
      }
      this.hero
        .setAlpha(rise)
        .setPosition(W / 2, FEET + (1 - rise) * 24)
        .setAngle(0);
      if (set.layers) playLayers(this, holder, this.hero, set, gearDress(selected.hero || { class: selected.job }, set), this.sprites);
      else holder.layers?.destroy();
      if (reducedMotion.matches) return;
      for (const m of this.motes) {
        m.dot.x = m.x + Math.sin(time * 0.0004 + m.phase) * 12;
        m.dot.y = m.y - Math.sin(time * 0.00025 + m.phase) * 22;
        m.dot.alpha = 0.2 + Math.sin(time * 0.001 + m.phase) * 0.18;
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    transparent: true,
    width: W * RES,
    height: H * RES,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: SelectionScene,
    audio: { noAudio: true },
    render: { antialias: true },
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
  const observer = new MutationObserver(visibility);
  for (const id of ["landing", "prologue"])
    observer.observe(document.getElementById(id), {
      attributes: true,
      attributeFilter: ["class"],
    });
  document.addEventListener("visibilitychange", visibility);
  return {
    setHero(
      job,
      gender,
      skins = [`${job}-${gender}`],
      identity = `${job}-${gender}`,
      hero = null,
    ) {
      const next = { job, gender, skins, identity, hero };
      if (JSON.stringify(next) === JSON.stringify(selected)) return;
      selected = next;
      if (ready) game.scene.getScenes()[0].select();
    },
    preview(mode) {
      if (!ready || !["idle", "run", "attack", "skill"].includes(mode)) return;
      const scene = game.scene.getScenes()[0];
      scene.previewMode = mode;
      scene.previewAt = scene.time.now;
    },
    destroy() {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      game.destroy(true);
    },
  };
}
