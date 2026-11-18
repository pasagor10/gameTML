import {
  queueSpriteSets,
  createSpriteRegistry,
  playSpriteSet,
} from "/sprite-sets.js?v=0.16.2";

// The chosen hero rises from rest. Account and creation actions remain in game.js.
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
  const jobs = ["swordsman", "archer", "mage"];
  const frame = () =>
    jobs.indexOf(selected.job) + (selected.gender === "female" ? 3 : 0);
  class SelectionScene extends Phaser.Scene {
    preload() {
      queueSpriteSets(this);
      this.load.spritesheet("selection-heroes", "/assets/heroes.png", {
        frameWidth: 512,
        frameHeight: 512,
      });
      this.load.spritesheet(
        "selection-resting",
        "/assets/selection/resting-heroes.png?v=1",
        { frameWidth: 512, frameHeight: 512 },
      );
    }
    create() {
      this.sprites = createSpriteRegistry(this);
      this.shadow = this.add.ellipse(300, 530, 190, 25, 0x092725, 0.28);
      this.resting = this.add
        .image(300, 525, "selection-resting", frame())
        .setOrigin(0.5, 1)
        .setDisplaySize(360, 360);
      this.hero = this.add
        .image(300, 525, "selection-heroes", frame())
        .setOrigin(0.5, 1)
        .setDisplaySize(430, 430);
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
      this.resting.setFrame(frame()).setAlpha(reducedMotion.matches ? 0 : 1);
      this.hero
        .setTexture("selection-heroes", frame())
        .setDisplaySize(430, 430)
        .setAlpha(0);
    }
    update(time) {
      const set = selected.skins
        .map((k) => this.sprites.heroes.get(k))
        .find(Boolean);
      if (!set && time - this.selectionAt < 900) return;
      this.standStarted ??= time;
      const t = reducedMotion.matches
        ? 1
        : Phaser.Math.Clamp((time - this.standStarted - 80) / 430, 0, 1);
      const rise = 1 - (1 - t) ** 3;
      let mode = this.previewMode;
      if (time - this.previewAt > 1800) mode = this.previewMode = "idle";
      if (set) {
        const startedAt = this.previewAt / 1000;
        playSpriteSet(
          this.hero,
          { ...set, height: 415 },
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
      this.hero
        .setAlpha(rise)
        .setPosition(300, 525 + (1 - rise) * 30)
        .setAngle(0);
      this.resting.setAlpha(Math.max(0, 1 - rise * 1.6)).setY(525 - rise * 10);
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
    width: 600,
    height: 650,
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
    ) {
      const next = { job, gender, skins, identity };
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
