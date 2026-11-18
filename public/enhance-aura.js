// A +10 weapon (the enhancement cap) earns a golden aura under the hero's
// feet: a pulsing pool of light, a ring rippling outward and gold sparks
// rising from the ground. Uses combat-fx's cfx-glow / cfx-ring textures.

export const AURA_LEVEL = 10;
const GOLD = 0xffcf5a,
  ADD = Phaser.BlendModes.ADD;

function createAura(scene, reduced) {
  // A normal-blend gold pool first: additive light alone washes out to white
  // on the pale street.
  const base = scene.add
      .image(0, 0, "cfx-glow")
      .setTint(0xe89a1c)
      .setDepth(5),
    glow = scene.add
      .image(0, 0, "cfx-glow")
      .setTint(GOLD)
      .setBlendMode(ADD)
      .setDepth(5),
    core = scene.add
      .image(0, 0, "cfx-ring")
      .setTint(0xffc23d)
      .setBlendMode(ADD)
      .setDepth(5),
    ripple = scene.add
      .image(0, 0, "cfx-ring")
      .setTint(GOLD)
      .setBlendMode(ADD)
      .setDepth(5),
    sparks = reduced
      ? null
      : scene.add
          .particles(0, 0, "cfx-glow", {
            x: { min: -42, max: 42 },
            y: { min: -4, max: 4 },
            lifespan: { min: 700, max: 1200 },
            speedY: { min: -95, max: -40 },
            speedX: { min: -8, max: 8 },
            scale: { start: 0.24, end: 0 },
            alpha: { start: 0.95, end: 0 },
            tint: [0xffe7a6, GOLD, 0xffffff],
            frequency: 55,
            blendMode: ADD,
          })
          .setDepth(11);
  const parts = [base, glow, core, ripple, sparks].filter(Boolean);
  return {
    parts,
    visible: true,
    set(show, x, y, time) {
      if (show !== this.visible) {
        this.visible = show;
        parts.forEach((o) => o.setVisible(show));
        if (sparks) show ? sparks.start() : sparks.stop();
      }
      if (!show) return;
      const t = reduced ? 0 : time / 1000,
        pulse = 0.5 + Math.sin(t * 3) * 0.5,
        wave = (t * 0.8) % 1;
      base
        .setPosition(x, y + 2)
        .setDisplaySize(170, 40)
        .setAlpha(0.55 + pulse * 0.15);
      glow
        .setPosition(x, y)
        .setDisplaySize(150 + pulse * 24, 34 + pulse * 8)
        .setAlpha(0.5 + pulse * 0.3);
      core.setPosition(x, y).setScale(1, 0.24).setAlpha(0.8 + pulse * 0.2);
      ripple
        .setPosition(x, y)
        .setScale(0.8 + wave * 1.1, (0.8 + wave * 1.1) * 0.25)
        .setAlpha(reduced ? 0 : 1 - wave);
      sparks?.setPosition(x, y - 4);
    },
    destroy() {
      parts.forEach((o) => o.destroy());
    },
  };
}

// Call every frame for each hero. Creates the aura the first time it is
// needed and hides it (without rebuilding) when it no longer applies.
export function updateEnhanceAura(scene, holder, show, x, y, time) {
  if (!holder.enhanceAura) {
    if (!show || !scene.textures.exists("cfx-ring")) return;
    holder.enhanceAura = createAura(scene, !!scene.reducedMotion);
  }
  holder.enhanceAura.set(show, x, y, time);
}
