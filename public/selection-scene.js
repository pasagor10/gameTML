// Presentation only. Character creation and authentication stay in game.js.
export function createSelectionPreview() {
  const host = document.querySelector("#hero-preview");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = { job: "swordsman", gender: "female" },
    ready = false;
  const colors = { swordsman: 0xffcf82, archer: 0x9bf1c2, mage: 0xd8b5ff };
  class SelectionScene extends Phaser.Scene {
    preload() {
      this.load.spritesheet("selection-heroes", "/assets/heroes.png", {
        frameWidth: 512,
        frameHeight: 512,
      });
    }
    create() {
      this.runes = this.add.graphics();
      this.aura = this.add
        .ellipse(350, 260, 265, 370, 0x6ddcff, 0.035)
        .setStrokeStyle(1, 0xb5ecff, 0.18);
      this.pedestal = this.add.graphics();
      this.shadow = this.add.ellipse(350, 456, 160, 21, 0x071729, 0.65);
      this.hero = this.add
        .image(350, 455, "selection-heroes", 3)
        .setOrigin(0.5, 1)
        .setDisplaySize(395, 395);
      this.motes = Array.from({ length: 28 }, (_, i) => ({
        dot: this.add.circle(0, 0, i % 4 === 0 ? 2 : 1, 0xc7f8ff, 0.6),
        phase: i * 2.4,
        x: 150 + ((i * 97) % 400),
        y: 70 + ((i * 61) % 390),
      }));
      this.ring = this.add
        .ellipse(350, 447, 200, 45, 0xffffff, 0)
        .setStrokeStyle(2, colors.swordsman, 0.8)
        .setAlpha(0);
      this.ready = true;
      ready = true;
      host.parentElement.classList.add("preview-ready");
      this.select(false);
    }
    select(burst = true) {
      if (!this.ready) return;
      const index =
          ["swordsman", "archer", "mage"].indexOf(selected.job) +
          (selected.gender === "female" ? 3 : 0),
        color = colors[selected.job];
      this.hero.setFrame(index);
      this.runes.clear();
      this.pedestal.clear();
      this.pedestal.fillStyle(0x142b41, 0.85);
      this.pedestal.fillEllipse(350, 469, 290, 62);
      this.pedestal.lineStyle(2, 0xb5bd9b, 0.45);
      this.pedestal.strokeEllipse(350, 464, 290, 62);
      for (const [w, h, alpha] of [
        [260, 53, 0.6],
        [225, 43, 0.2],
        [180, 32, 0.4],
      ]) {
        this.pedestal.lineStyle(1, color, alpha);
        this.pedestal.strokeEllipse(350, 459, w, h);
      }
      this.runes.lineStyle(1, color, 0.25);
      this.runes.strokeCircle(350, 245, 155);
      this.runes.strokeCircle(350, 245, 163);
      for (let n = 0; n < 12; n++) {
        const a = (n * Math.PI) / 6,
          x = 350 + Math.cos(a) * 159,
          y = 245 + Math.sin(a) * 159;
        this.runes.fillStyle(color, 0.6);
        this.runes.fillTriangle(x, y - 4, x + 3, y, x, y + 4);
      }
      this.hero.setAlpha(1);
      this.hero.setScale(395 / 512);
      this.hero.setTint(0xffffff);
      if (burst && !reducedMotion.matches) {
        this.tweens.killTweensOf(this.hero);
        this.hero.setAlpha(0.3).setScale(370 / 512);
        this.tweens.add({
          targets: this.hero,
          alpha: 1,
          scale: 395 / 512,
          duration: 330,
          ease: "Cubic.Out",
        });
        this.ring.setStrokeStyle(2, color, 0.9).setAlpha(0.9).setScale(0.65);
        this.tweens.add({
          targets: this.ring,
          alpha: 0,
          scaleX: 1.9,
          scaleY: 1.9,
          duration: 650,
          ease: "Quad.Out",
        });
        for (let n = 0; n < 16; n++) {
          const a = (n * Math.PI) / 8,
            dot = this.add.circle(350, 350, 2, color, 0.9);
          this.tweens.add({
            targets: dot,
            x: 350 + Math.cos(a) * 155,
            y: 350 + Math.sin(a) * 120,
            alpha: 0,
            duration: 600,
            onComplete: () => dot.destroy(),
          });
        }
      }
    }
    update(time) {
      if (reducedMotion.matches) return;
      this.hero.y = 455 + Math.sin(time * 0.0018) * 4;
      this.hero.angle = Math.sin(time * 0.0012) * 0.55;
      this.aura.alpha = 0.7 + Math.sin(time * 0.001) * 0.3;
      for (const m of this.motes) {
        m.dot.x = m.x + Math.sin(time * 0.0004 + m.phase) * 18;
        m.dot.y = m.y - Math.sin(time * 0.00025 + m.phase) * 30;
        m.dot.alpha = 0.25 + Math.sin(time * 0.001 + m.phase) * 0.2;
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    transparent: true,
    width: 700,
    height: 520,
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
    setHero(job, gender) {
      selected = { job, gender };
      if (ready) game.scene.getScenes()[0].select();
    },
    destroy() {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      game.destroy(true);
    },
  };
}
