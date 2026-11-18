// Combat visuals for the Adventure scene: slashes, projectiles, impacts,
// damage numbers, skill blasts, charge-up and death bursts. Purely cosmetic:
// every effect is triggered by authoritative server events.

const ADD = "ADD";

function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
}

function makeTextures(scene) {
  canvasTexture(scene, "cfx-glow", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  canvasTexture(scene, "cfx-spark2", 96, 18, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, h / 2);
    c.lineTo(w - 4, 1);
    c.lineTo(w, h / 2);
    c.lineTo(w - 4, h - 1);
    c.closePath();
    c.fill();
  });
  // Crescent blade trail, opening to the right.
  canvasTexture(scene, "cfx-slash2", 256, 256, (c, w, h) => {
    const cx = 70,
      cy = h / 2,
      r = 150;
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, -1.15, 1.15);
    c.arc(cx - 70, cy, r - 2, 1.0, -1.0, true);
    c.closePath();
    c.clip();
    const g = c.createLinearGradient(cx + r * 0.3, 0, cx + r, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.75, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  });
  canvasTexture(scene, "cfx-ring", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 40, 64, 64, 62);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.75, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  canvasTexture(scene, "cfx-flare", 128, 128, (c) => {
    const core = c.createRadialGradient(64, 64, 0, 64, 64, 30);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = core;
    c.fillRect(0, 0, 128, 128);
    for (const [w, h] of [
      [64, 4],
      [4, 64],
    ]) {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(64, 64, w, h, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  canvasTexture(scene, "cfx-beam", 64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "destination-in";
    const v = c.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.35, "rgba(0,0,0,1)");
    v.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  });
}

// Blend two 0xRRGGBB colours (t = 0 → a, 1 → b).
function mix(a, b, t) {
  const ch = (c, s) => (c >> s) & 255,
    lerp = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

export function createCombatFx(scene) {
  makeTextures(scene);
  const reduced = scene.reducedMotion,
    lowPower = scene.scale.width < 700,
    scaleCount = (n) =>
      Math.max(1, Math.round(n * (reduced ? 0.4 : lowPower ? 0.6 : 1))),
    cam = scene.cameras.main;

  // Angle/speed ranges are read through callbacks so each burst can aim
  // its particles (setEmitterAngle doesn't re-parse ranges at runtime).
  const emitter = (texture, config, depth = 36) => {
    const aim = {
        angle: [0, 360],
        speed: [config.speed.min, config.speed.max],
      },
      rand = (r) => r[0] + Math.random() * (r[1] - r[0]);
    const em = scene.add
      .particles(0, 0, texture, {
        emitting: false,
        blendMode: ADD,
        ...config,
        angle: { onEmit: () => rand(aim.angle) },
        speed: { onEmit: () => rand(aim.speed) },
      })
      .setDepth(depth);
    em.aim = aim;
    em.defaultSpeed = [...aim.speed];
    return em;
  };

  const sparks = emitter("cfx-spark2", {
    lifespan: { min: 180, max: 380 },
    speed: { min: 260, max: 620 },
    scaleX: { start: 0.85, end: 0.1 },
    scaleY: { start: 0.75, end: 0.3 },
    alpha: { start: 1, end: 0 },
    // Point each streak along its travel direction.
    rotate: {
      onUpdate: (p) =>
        Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)),
    },
  });
  const embers = emitter("cfx-glow", {
    lifespan: { min: 380, max: 820 },
    speed: { min: 80, max: 320 },
    gravityY: 520,
    scale: { start: 0.28, end: 0 },
    alpha: { start: 1, end: 0 },
  });
  const puffs = emitter(
    "cfx-glow",
    {
      lifespan: { min: 500, max: 900 },
      speed: { min: 30, max: 140 },
      gravityY: -90,
      scale: { start: 0.7, end: 1.8 },
      alpha: { start: 0.45, end: 0 },
    },
    34,
  );
  const motes = emitter("cfx-glow", {
    lifespan: 420,
    speed: { min: 0, max: 0 },
    scale: { start: 0.08, end: 0.22 },
    alpha: { start: 0, end: 0.9 },
  });

  const blast = (em, x, y, count, tint, opts = {}) => {
    if (scene.children.length > 260) return;
    em.setParticleTint(tint);
    em.aim.speed = opts.speed || em.defaultSpeed;
    const a = opts.angle || { min: 0, max: 360 };
    em.aim.angle = [a.min, a.max];
    em.explode(scaleCount(count), x, y);
  };

  const sprite = (key, x, y, tint, depth = 37) =>
    scene.add.image(x, y, key).setTint(tint).setBlendMode(ADD).setDepth(depth);

  const flare = (x, y, tint, size = 1, duration = 220) => {
    const f = sprite("cfx-flare", x, y, tint, 38)
      .setScale(size * 0.4)
      .setAlpha(0.85)
      .setAngle(Math.random() * 90);
    scene.tweens.add({
      targets: f,
      scale: size * 1.25,
      alpha: 0,
      angle: f.angle + 25,
      duration,
      ease: "Cubic.out",
      onComplete: () => f.destroy(),
    });
  };

  const ring = (x, y, tint, to = 2, duration = 380, squash = 1) => {
    const r = sprite("cfx-ring", x, y, tint, 33).setScale(0.2, 0.2 * squash);
    scene.tweens.add({
      targets: r,
      scaleX: to,
      scaleY: to * squash,
      alpha: 0,
      duration,
      ease: "Cubic.out",
      onComplete: () => r.destroy(),
    });
  };

  const shake = (ms, intensity) => {
    if (!reduced) cam.shake(ms, intensity);
  };

  // Brief zoom "punch" that settles back to whatever zoom resize() chose.
  const punch = (amount = 0.035, ms = 90) => {
    if (reduced || scene.zoomPunch) return;
    const base = cam.zoom;
    scene.zoomPunch = scene.tweens.add({
      targets: cam,
      zoom: base * (1 + amount),
      duration: ms,
      yoyo: true,
      ease: "Quad.out",
      onComplete: () => {
        cam.setZoom(base);
        scene.zoomPunch = null;
      },
    });
  };

  const slash = (
    x,
    y,
    dir,
    tint,
    { scale = 1, angle = 0, flipY = false, ms = 230 } = {},
  ) => {
    for (const [s, t, a] of [
      [scale, tint, 0.95],
      [scale * 0.82, 0xffffff, 0.8],
    ]) {
      const img = sprite("cfx-slash2", x, y, t)
        .setFlipX(dir < 0)
        .setFlipY(flipY)
        .setAlpha(a)
        .setScale(s * 0.7)
        .setAngle(dir * angle);
      scene.tweens.add({
        targets: img,
        scale: s * 1.12,
        angle: img.angle + dir * (flipY ? -18 : 18),
        x: x + dir * 18 * scale,
        alpha: 0,
        duration: ms,
        ease: "Cubic.out",
        onComplete: () => img.destroy(),
      });
    }
  };

  const projectile = (
    x,
    y,
    dir,
    distance,
    tint,
    { size = 1, ms = 360, arrow = false } = {},
  ) => {
    const head = arrow
      ? sprite("cfx-spark2", x, y, 0xffffff, 37)
          .setScale(1.6 * size, 1.1 * size)
          .setFlipX(dir < 0)
      : sprite("cfx-glow", x, y, 0xffffff, 37).setScale(0.55 * size);
    const halo = sprite("cfx-glow", x, y, tint, 36).setScale(
      (arrow ? 0.9 : 1.4) * size,
    );
    const trail = scene.add
      .particles(0, 0, "cfx-glow", {
        blendMode: ADD,
        lifespan: arrow ? 160 : 300,
        frequency: 16,
        speed: { min: 0, max: 30 },
        scale: { start: (arrow ? 0.22 : 0.42) * size, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint,
        follow: head,
      })
      .setDepth(35);
    scene.tweens.add({
      targets: [head, halo],
      x: x + dir * distance,
      duration: ms,
      ease: arrow ? "Linear" : "Sine.in",
      onComplete: () => {
        trail.stop();
        blast(sparks, head.x, head.y, 8 * size, tint, { speed: [160, 420] });
        flare(head.x, head.y, tint, 0.8 * size);
        head.destroy();
        halo.destroy();
        scene.time.delayedCall(400, () => trail.destroy());
      },
    });
  };

  // Class tier (1 base, 2 specialization, 3 advanced) grows every skill:
  // bigger shapes, extra projectiles/slashes, an accent colour, and at
  // tier 3 rune circles, pillars of light and a second shockwave.
  const TIER_SCALE = [1, 1.3, 1.65];
  const tierAccent = (tier, color) =>
    tier >= 3 ? 0xffe27a : tier === 2 ? mix(color, 0xffffff, 0.55) : color;

  // Caster aura for tier 2+ skills: a ground ring and rising motes; tier 3
  // adds a spinning rune circle and a bright core flare.
  function tierAura(x, feet, tier, color, accent) {
    ring(x, feet, accent, 2.2 + tier * 0.5, 460, 0.24);
    blast(embers, x, feet - 10, 6 * tier, accent, {
      speed: [160, 360],
      angle: { min: 245, max: 295 },
    });
    if (tier < 3) return;
    flare(x, feet - 60, 0xffffff, 1.6, 300);
    for (const [size, tint, spin] of [
      [1.9, accent, 140],
      [1.3, color, -200],
    ]) {
      const rune = sprite("cfx-ring", x, feet, tint, 32)
        .setScale(0.4, 0.1)
        .setAlpha(0.95);
      scene.tweens.add({
        targets: rune,
        scaleX: size,
        scaleY: size * 0.26,
        angle: spin,
        alpha: 0,
        duration: 620,
        ease: "Cubic.out",
        onComplete: () => rune.destroy(),
      });
    }
  }

  // A column of light, for tier 3 impacts.
  function pillar(x, ground, tint, height = 1.1, width = 1) {
    const beam = sprite("cfx-beam", x, ground, tint, 32)
      .setOrigin(0.5, 1)
      .setScale(width, 0.1);
    scene.tweens.add({
      targets: beam,
      scaleY: height,
      duration: 130,
      yoyo: true,
      hold: 140,
      ease: "Quad.out",
      onComplete: () => beam.destroy(),
    });
  }

  function attack(e) {
    const dir = e.direction || 1,
      range = e.range || 130,
      color = e.color,
      tier = Math.min(3, Math.max(1, e.tier || 1)),
      k = TIER_SCALE[tier - 1],
      accent = tierAccent(tier, color);
    if (e.skill === 4) {
      // Party buff: a rising column and a ring at the feet.
      pillar(e.x, e.y + 50, color, 1, 1.1);
      ring(e.x, e.y + 40, color, 3, 520, 0.3);
      ring(e.x, e.y - 10, 0xffffff, 1.6, 360);
      blast(embers, e.x, e.y + 40, 18, color, {
        speed: [120, 320],
        angle: { min: 240, max: 300 },
      });
      return;
    }
    if (e.skill && tier >= 2) tierAura(e.x, e.y + 50, tier, color, accent);
    if (e.class === "archer") {
      // Volley: 3 / 4 / 5 arrows by tier; other skills gain a ghost arrow.
      const count =
        e.skill === 2 ? 2 + tier : e.skill && tier >= 2 ? 2 : 1;
      for (let n = 0; n < count; n++)
        scene.time.delayedCall(n * 70, () =>
          projectile(
            e.x + dir * 40,
            e.y - 4 + (n - (count - 1) / 2) * 16,
            dir,
            e.skill ? 600 + (tier - 1) * 60 : 410,
            n % 2 && tier >= 2 ? accent : color,
            {
              arrow: true,
              size: (e.skill === 3 ? 2 : e.skill ? 1.3 : 1) * (e.skill ? k : 1),
              ms: e.skill === 3 ? 300 : 340,
            },
          ),
        );
      flare(e.x + dir * 40, e.y - 4, color, 0.6 * (e.skill ? k : 1));
      if (e.skill && tier >= 3)
        scene.time.delayedCall(260, () => {
          const hx = e.x + dir * 520;
          pillar(hx, e.y + 50, accent, 1, 0.8);
          ring(hx, e.y, accent, 2.6, 380);
          blast(sparks, hx, e.y, 16, accent, { speed: [220, 560] });
        });
    } else if (e.class === "priest") {
      const reach = e.skill === 3 ? 0 : Math.min(range, 260) * 0.8,
        hx = e.x + dir * reach,
        size = [1, 1.3, 1.1, 2.2][e.skill || 0] * (e.skill ? k : 1);
      flare(e.x + dir * 26, e.y - 30, 0xfff4c8, 0.7 * size, 220);
      if (e.skill === 3) {
        // Wheel of light around the priest.
        ring(e.x, e.y + 40, color, 3.2 * k, 520, 0.3);
        ring(e.x, e.y + 10, 0xffffff, 2.2 * k, 380);
        for (const off of [-90, 90]) pillar(e.x + off, e.y + 50, color, 0.9, 0.7);
      } else {
        scene.time.delayedCall(90, () => {
          pillar(hx, e.y + 50, 0xffffff, 1.1 * size, 0.55 * size);
          pillar(hx, e.y + 50, color, 1, 0.9 * size);
          ring(hx, e.y + 40, color, 1.6 * size, 340, 0.3);
          blast(embers, hx, e.y + 30, 8 + 4 * (e.skill || 0), color, {
            speed: [80, 240],
            angle: { min: 240, max: 300 },
          });
        });
      }
      if (e.skill === 2) {
        // Healing: a soft green-gold bloom on the caster.
        ring(e.x, e.y + 40, 0x9dffb0, 2.6, 520, 0.3);
        blast(embers, e.x, e.y + 40, 14, 0x9dffb0, { speed: [60, 200], angle: { min: 250, max: 290 } });
      }
    } else if (e.class === "mage") {
      const size = [1, 1.4, 1.8, 2.4][e.skill || 0] * (e.skill ? k : 1);
      projectile(e.x + dir * 30, e.y, dir, 350, color, { size, ms: 420 });
      ring(e.x + dir * 30, e.y, color, 0.9 * size, 260);
      // Tier 2+: twin satellite orbs; tier 3: lightning pillar where it lands.
      if (e.skill && tier >= 2)
        for (const off of [-26, 26])
          scene.time.delayedCall(70, () =>
            projectile(e.x + dir * 20, e.y + off, dir, 330, accent, {
              size: size * 0.45,
              ms: 430,
            }),
          );
      if (e.skill && tier >= 3)
        scene.time.delayedCall(420, () => {
          const hx = e.x + dir * 380;
          pillar(hx, e.y + 50, 0xffffff, 1.2, 0.6);
          pillar(hx, e.y + 50, accent, 1, 1.2);
          ring(hx, e.y + 40, accent, 3.4, 480, 0.3);
          flare(hx, e.y, 0xffffff, 2, 260);
          shake(120, 0.004);
        });
    } else if (!e.skill) {
      // Three-hit combo: down-cut, up-cut, then a wide horizontal finisher.
      const combo = e.combo || 0;
      slash(e.x + dir * range * 0.32, e.y + 6, dir, color, {
        scale: (combo === 2 ? 1.35 : 1.1) * (1 + (tier - 1) * 0.12),
        angle: [-22, 26, 0][combo],
        flipY: combo === 1,
      });
    }

    if (e.class === "swordsman" && e.skill === 1) {
      // Dash cuts: 3 / 4 / 5 afterimages by tier, in the accent colour.
      const cuts = 2 + tier;
      for (let n = 0; n < cuts; n++)
        scene.time.delayedCall(n * 55, () => {
          const img = sprite(
            "cfx-slash2",
            e.x + dir * 50,
            e.y + 4,
            n === 1 ? 0xffffff : n >= 3 ? accent : color,
          )
            .setFlipX(dir < 0)
            .setFlipY(n % 2 === 1 && tier >= 2)
            .setScale((0.75 - Math.min(n, 3) * 0.08) * k)
            .setAlpha(0.9);
          scene.tweens.add({
            targets: img,
            x: e.x + dir * range,
            scaleY: img.scaleY * 1.3,
            alpha: 0,
            duration: 320,
            ease: "Quad.out",
            onComplete: () => img.destroy(),
          });
        });
      blast(sparks, e.x + dir * 60, e.y, 10, color, {
        angle: dir > 0 ? { min: -25, max: 25 } : { min: 155, max: 205 },
      });
    }
    if (e.class === "swordsman" && e.skill === 2) {
      const cx = e.x + dir * range * 0.45,
        cy = e.y + 20;
      flare(cx, cy, 0xffe5a0, 2.2 * k, 320);
      ring(cx, cy + 25, 0xffb34a, 3 * k, 420, 0.32);
      ring(cx, cy, 0xffe5a0, 2 * k, 320);
      if (tier >= 2) ring(cx, cy + 25, accent, 4.2 * k, 560, 0.28);
      if (tier >= 3)
        for (const off of [-90, 0, 90])
          pillar(cx + off, cy + 30, off ? accent : 0xffffff, off ? 0.8 : 1.15);
      blast(embers, cx, cy, 26 + (tier - 1) * 14, 0xffb34a, {
        speed: [180, 480],
        angle: { min: 200, max: 340 },
      });
      blast(puffs, cx, cy + 20, 10, 0xff7b3a);
      shake(140, 0.004);
      punch(0.03);
    }
    if (e.skill === 3) {
      const cx = e.class === "swordsman" ? e.x : e.x + dir * 160,
        ground = e.y + 50;
      if (!reduced) cam.flash(140 + tier * 40, 255, 245, 210, true);
      ring(cx, ground, color, 5 * k, 600, 0.22);
      ring(cx, ground, 0xffffff, 3.5 * k, 450, 0.22);
      // Ultimate: 7 / 9 / 11 pillars by tier; tier 3 lands a second wave.
      const span = 2 + tier;
      if (tier >= 3)
        scene.time.delayedCall(380, () => {
          ring(cx, ground, accent, 7, 700, 0.22);
          flare(cx, ground - 80, 0xffffff, 3.2, 420);
          blast(sparks, cx, ground - 40, 30, accent, { speed: [300, 800] });
          shake(260, 0.008);
        });
      for (let n = -span; n <= span; n++)
        scene.time.delayedCall(Math.abs(n) * 45, () => {
          const beam = sprite(
            "cfx-beam",
            cx + n * 70,
            ground + 10,
            n % 2 ? (tier >= 2 ? accent : 0xfff4c4) : color,
            32,
          )
            .setOrigin(0.5, 1)
            .setScale((n % 2 ? 0.7 : 1.1) * (1 + (tier - 1) * 0.15), 0.1);
          scene.tweens.add({
            targets: beam,
            scaleY: (1.2 - Math.abs(n) * 0.07) * (1 + (tier - 1) * 0.2),
            duration: 140,
            yoyo: true,
            hold: 120,
            ease: "Quad.out",
            onComplete: () => beam.destroy(),
          });
          blast(embers, cx + n * 70, ground, 5, color, {
            speed: [200, 420],
            angle: { min: 250, max: 290 },
          });
        });
      shake(320, 0.007);
      punch(0.06, 140);
    } else if (e.skill && e.class !== "swordsman") {
      shake(90 + tier * 30, 0.002 * tier);
    }
  }

  // Damage numbers, arcade style: every strike of a skill is its own line,
  // popping in one after another and stacking upward, then the whole stack
  // floats off together. Orange for hits, red-pink for crits (with a burst
  // badge), violet when a hero is hurt, status colours for damage over time.
  const NUMBER_STYLES = {
    hit: ["#fffbe0", "#ffc23d", "#ff7a00", "#3d1500"],
    crit: ["#fff0f6", "#ff5a8c", "#d1103a", "#3d0014"],
    hurt: ["#f6eaff", "#c08bff", "#7a3cf0", "#1f0748"],
    burn: ["#fff1d6", "#ffab4a", "#ff5a1f", "#3d1200"],
    poison: ["#f4ffe0", "#a8f05a", "#3fae2a", "#0f2e08"],
    bleed: ["#ffe6ea", "#ff6b82", "#b0102e", "#33000c"],
  };
  const stacks = new Map();
  function paint(label, style) {
    const [a, b, c, stroke] = NUMBER_STYLES[style] || NUMBER_STYLES.hit;
    const g = label.context.createLinearGradient(0, 0, 0, label.height);
    g.addColorStop(0, a);
    g.addColorStop(0.45, b);
    g.addColorStop(1, c);
    label.setFill(g).setStroke(stroke, label.style.strokeThickness);
  }
  function digits(x, y, text, style, size, crit) {
    const label = scene.add
      .text(x, y, text, {
        fontFamily: "Chonburi, Noto Sans Thai",
        fontSize: size + "px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: crit ? 10 : 8,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(42);
    label.setShadow(0, 4, "#000000", 4, true, true);
    paint(label, style);
    return label;
  }
  // lines: [{ amount, crit }]; hurt numbers are negative amounts.
  // Each line slams in big and settles; crit lines are huge, flash white,
  // burst behind and shake the screen.
  function number(x, y, amount, crit, targetId, opts = {}) {
    const now = scene.time.now,
      hurt = amount < 0,
      tick = !!opts.tick,
      lines = opts.lines?.length ? opts.lines : [{ amount: Math.abs(amount), crit }];
    // Start above a stack that is still on screen for this target.
    const prev = stacks.get(targetId),
      base = prev && now < prev.until ? prev.top - 10 : y;
    const step = tick ? 0 : 40,
      top = base - (lines.length - 1) * step - 48;
    // Another target's stack still showing right here? Step aside so two
    // stacks never interleave into one unreadable column.
    const near = [...stacks.entries()].filter(
        ([id, st]) => id !== targetId && now < st.until && Math.abs(st.x - x) < 80,
      ).length,
      shift = near ? (near % 2 ? 1 : -1) * 90 * Math.ceil(near / 2) : 0;
    stacks.set(targetId, { until: now + 480 + lines.length * 80, top, x: x + shift });
    if (stacks.size > 60) stacks.clear();
    const jitter = (Math.random() - 0.5) * 18 + shift,
      drift = (Math.random() - 0.5) * 30;
    let crits = 0;
    lines.forEach((line, n) => {
      const style = opts.status
          ? opts.status
          : hurt
            ? "hurt"
            : line.crit
              ? "crit"
              : "hit",
        size = tick ? 24 : line.crit ? 54 : hurt ? 34 : 40,
        lx = x + jitter + (tick ? 38 : 0) + (line.crit ? 6 : 0),
        ly = base - n * step;
      if (line.crit) crits++;
      scene.time.delayedCall(n * 80, () => {
        const text = String(Math.abs(line.amount)),
          main = digits(lx, ly, text, style, size, line.crit),
          parts = [main];
        if (line.crit) {
          // Burst behind, a white flash copy on top, a star badge, and a kick.
          const burst = sprite("cfx-glow", lx, ly, 0xff3d6e, 41).setDisplaySize(main.width * 1.6, 90);
          const flash = scene.add
            .text(lx, ly, text, {
              fontFamily: "Chonburi, Noto Sans Thai",
              fontSize: size + "px",
              color: "#ffffff",
              padding: { x: 4, y: 4 },
            })
            .setOrigin(0.5)
            .setDepth(43);
          scene.tweens.add({ targets: flash, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
          scene.tweens.add({
            targets: burst,
            alpha: 0,
            scaleX: burst.scaleX * 1.4,
            scaleY: burst.scaleY * 1.4,
            duration: 360,
            onComplete: () => burst.destroy(),
          });
          const badge = sprite("cfx-glow", lx - main.width / 2 - 14, ly, 0xff4f8a, 43).setDisplaySize(44, 44);
          const star = scene.add
            .text(badge.x, ly, "✸", {
              fontFamily: "Noto Sans Thai",
              fontSize: "32px",
              color: "#ffe0ec",
              stroke: "#5a0020",
              strokeThickness: 6,
            })
            .setOrigin(0.5)
            .setDepth(43);
          parts.push(badge, star);
          if (!hurt) {
            shake(150, 0.007 + Math.min(3, crits) * 0.002);
            punch(0.03, 70);
          }
        }
        if (opts.status && n === 0) {
          const icon = scene.add
            .text(lx - main.width / 2 - 6, ly, opts.icon || "", {
              fontFamily: "Noto Sans Thai",
              fontSize: "18px",
            })
            .setOrigin(1, 0.5)
            .setDepth(42);
          parts.push(icon);
        }
        const from = tick ? 0.6 : line.crit ? 2.6 : 2;
        for (const p of parts) p.setScale(from).setAlpha(0);
        main.setAngle(line.crit ? (Math.random() - 0.5) * 10 : 0);
        scene.tweens.add({
          targets: parts,
          scale: 1,
          alpha: 1,
          angle: 0,
          duration: line.crit ? 170 : 130,
          ease: "Back.out",
        });
        // A little bounce once it lands.
        if (!tick)
          scene.tweens.add({
            targets: main,
            scaleX: 1.12,
            scaleY: 0.9,
            delay: line.crit ? 170 : 130,
            duration: 70,
            yoyo: true,
          });
        // The stack holds, then rises and fades as one.
        const hold = Math.max(0, (lines.length - 1 - n) * 80) + (tick ? 280 : line.crit ? 620 : 480);
        scene.tweens.add({
          targets: parts,
          y: `-=${tick ? 34 : 54}`,
          x: `+=${drift}`,
          alpha: 0,
          delay: 170 + hold,
          duration: 480,
          ease: "Quad.in",
          onComplete: () => parts.forEach((p) => p.destroy()),
        });
      });
    });
    // One shout over a stack with crits in it.
    if (!hurt && !tick && lines.some((l) => l.crit)) {
      const tag = scene.add
        .text(x + jitter, top - 6, "CRITICAL!", {
          fontFamily: "Chonburi, Noto Sans Thai",
          fontSize: "20px",
          color: "#ffffff",
          stroke: "#5a0020",
          strokeThickness: 6,
          padding: { x: 4, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(44)
        .setScale(0.4)
        .setAlpha(0);
      paint(tag, "crit");
      scene.tweens.add({
        targets: tag,
        scale: 1,
        alpha: 1,
        duration: 160,
        ease: "Back.out",
        onComplete: () =>
          scene.tweens.add({
            targets: tag,
            y: tag.y - 20,
            alpha: 0,
            delay: 520,
            duration: 380,
            onComplete: () => tag.destroy(),
          }),
      });
    }
  }

  // `from` is the attacker's x, used to throw sparks away from them.
  function hit(e, from, target, isSelf = false) {
    const hurt = e.amount < 0,
      dir = from === undefined ? 1 : Math.sign(e.x - from) || 1,
      color = hurt ? 0xff4d4d : e.crit ? 0xffc23d : 0xff9a3c,
      y = e.y + 30;
    if (e.tick) {
      number(e.x, e.y, e.amount, false, e.targetId, { tick: true, status: e.status, icon: e.icon });
      return;
    }
    // One spark burst per strike, in step with the stacked numbers.
    (e.lines?.length ? e.lines : [{ crit: e.crit }]).forEach((line, n) =>
      scene.time.delayedCall(n * 70, () => {
        const c = hurt ? 0xff4d4d : line.crit ? 0xff4f8a : 0xff9a3c;
        flare(e.x + (Math.random() - 0.5) * 20, y - n * 6, c, line.crit ? 2 : 1.3, line.crit ? 280 : 200);
        blast(sparks, e.x, y, line.crit ? 18 : 10, c, {
          speed: [240, line.crit ? 700 : 520],
          angle: dir > 0 ? { min: -55, max: 55 } : { min: 125, max: 235 },
        });
      }),
    );
    if (e.crit) ring(e.x, y, 0xff4f8a, 2, 300);
    if (hurt && isSelf) shake(120, 0.005);
    if (target)
      target.kick = { at: scene.time.now, dir, power: e.crit ? 14 : 8 };
    number(e.x, e.y, e.amount, e.crit, e.targetId, { lines: e.lines });
  }

  // Applies the knockback wobble set by hit() on top of interpolated position.
  function applyKick(holder, image) {
    const k = holder.kick;
    if (!k) return;
    const t = (scene.time.now - k.at) / 180;
    if (t >= 1) {
      holder.kick = null;
      return;
    }
    image.x += k.dir * k.power * Math.sin(t * Math.PI) * (1 - t);
  }

  function death(x, y, boss) {
    const color = boss ? 0xffd34d : 0xc3a6ff;
    flare(x, y - 40, 0xffffff, boss ? 3 : 1.6, boss ? 500 : 300);
    ring(x, y - 40, color, boss ? 4 : 2.2, boss ? 700 : 420);
    ring(x, y, color, boss ? 5 : 2.6, 500, 0.25);
    blast(puffs, x, y - 30, boss ? 20 : 10, color);
    blast(embers, x, y - 40, boss ? 30 : 14, 0xffe066, {
      speed: [140, 380],
      angle: { min: 220, max: 320 },
    });
    if (boss) {
      if (!reduced) cam.flash(260, 255, 236, 180, true);
      shake(500, 0.01);
      punch(0.08, 200);
    }
  }

  let chargeAt = 0;
  // Particles drawn inward to the hero during a skill wind-up.
  function charge(x, y, color, progress) {
    if (reduced || scene.time.now - chargeAt < 45) return;
    chargeAt = scene.time.now;
    const a = Math.random() * Math.PI * 2,
      r = 70 - progress * 30;
    motes.setParticleTint(color);
    const p = motes.emitParticleAt(
      x + Math.cos(a) * r,
      y + Math.sin(a) * r * 0.7,
    );
    if (p) {
      p.velocityX = -Math.cos(a) * r * 2.4;
      p.velocityY = -Math.sin(a) * r * 1.7;
    }
  }

  return { attack, hit, death, charge, applyKick, number, ring, flare };
}
