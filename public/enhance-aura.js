// A +10 weapon earns a golden aura under the hero's
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

// Weapon +11 to +15: comets of light spiral around the hero's body, passing
// behind and in front of the sprite (depth 10), while bubbles drift up.
// Each level has its own colour; higher levels add comets and a body halo.
const SET_STYLE = {
  11: { comets: 2, deep: 0x18c060, tint: [0x7dffb0, 0xd8ffe8], halo: 0, bubbles: 160 },
  12: { comets: 2, deep: 0x1688e0, tint: [0x8ff3ff, 0xe0fbff], halo: 0, bubbles: 140 },
  13: { comets: 3, deep: 0x8a3cf0, tint: [0xc59bff, 0xf0e0ff], halo: 0, bubbles: 120 },
  14: { comets: 3, deep: 0xe02828, tint: [0xff6a5a, 0xffc59a], halo: 0xff5a40, bubbles: 95 },
  15: { comets: 3, deep: 0xf0a000, tint: [0xffe27a, 0xff9de2, 0x9ff7ff], halo: 0xffd76a, bubbles: 70 },
};

function createSetGlow(scene, tier, reduced) {
  const style = SET_STYLE[tier],
    halo = style.halo
      ? scene.add.image(0, 0, "cfx-glow").setTint(style.halo).setBlendMode(ADD).setDepth(9)
      : null,
    comets = Array.from({ length: style.comets }, (_, i) => {
      const tint = style.tint[i % style.tint.length],
        // A normal-blend coloured body keeps the level colour readable on
        // pale backgrounds, where additive light alone turns white.
        body = scene.add.image(0, 0, "cfx-glow").setTint(style.deep),
        head = scene.add.image(0, 0, "cfx-glow").setTint(tint).setBlendMode(ADD),
        trail = reduced
          ? null
          : scene.add.particles(0, 0, "cfx-glow", {
              lifespan: 380,
              scale: { start: 0.26, end: 0 },
              alpha: { start: 0.8, end: 0 },
              tint: [tint, 0xffffff],
              frequency: 22,
              blendMode: ADD,
            });
      return { body, head, trail, phase: (i / style.comets) * Math.PI * 2 };
    }),
    bubbles = reduced
      ? null
      : scene.add
          .particles(0, 0, "cfx-ring", {
            x: { min: -30, max: 30 },
            y: { min: -10, max: 0 },
            lifespan: { min: 1400, max: 2200 },
            speedY: { min: -60, max: -28 },
            speedX: { min: -10, max: 10 },
            scale: { start: 0.09, end: 0.22 },
            alpha: { start: 0.85, end: 0 },
            tint: [style.deep, ...style.tint],
            frequency: style.bubbles,
          })
          .setDepth(11);
  const parts = [halo, bubbles, ...comets.flatMap((c) => [c.body, c.head, c.trail])].filter(Boolean);
  return {
    tier,
    parts,
    visible: true,
    set(show, x, feet, height, time) {
      if (show !== this.visible) {
        this.visible = show;
        parts.forEach((o) => o.setVisible(show));
        for (const e of [bubbles, ...comets.map((c) => c.trail)])
          if (e) show ? e.start() : e.stop();
      }
      if (!show) return;
      const t = reduced ? 0 : time / 1000,
        body = Math.max(60, height - 30),
        mid = feet - body / 2;
      halo
        ?.setPosition(x, mid)
        .setDisplaySize(110, body + 40)
        .setAlpha(0.22 + Math.sin(t * 2.4) * 0.08);
      for (const c of comets) {
        const a = t * 3.2 + c.phase,
          // Spiral: round the body while climbing from feet to head and back.
          climb = 0.5 + Math.sin(t * 1.3 + c.phase) * 0.5,
          cx = x + Math.cos(a) * 40,
          cy = feet - 6 - climb * (body - 8) + Math.sin(a) * 9,
          front = Math.sin(a) > 0;
        c.body
          .setPosition(cx, cy)
          .setDepth(front ? 11 : 9)
          .setScale(front ? 0.6 : 0.45)
          .setAlpha(front ? 0.85 : 0.5);
        c.head
          .setPosition(cx, cy)
          .setDepth(front ? 11 : 9)
          .setScale(front ? 0.3 : 0.22)
          .setAlpha(front ? 1 : 0.6);
        c.trail?.setPosition(cx, cy).setDepth(front ? 11 : 9);
      }
      bubbles?.setPosition(x, feet - 8);
    },
    destroy() {
      parts.forEach((o) => o.destroy());
    },
  };
}

// tier: 0 (none) or the weapon level 11–15, from the server's per-hero `glow`.
export function updateSetGlow(scene, holder, tier, x, feet, height, time) {
  if (holder.setGlow && holder.setGlow.tier !== tier && tier) {
    holder.setGlow.destroy();
    holder.setGlow = null;
  }
  if (!holder.setGlow) {
    if (!SET_STYLE[tier] || !scene.textures.exists("cfx-ring")) return;
    holder.setGlow = createSetGlow(scene, tier, !!scene.reducedMotion);
  }
  holder.setGlow.set(!!tier, x, feet, height, time);
}
