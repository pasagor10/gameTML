import { screenShakeEnabled, shakeCamera } from "/screen-shake.js?v=1";
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
  // A real arrow, pointing right: steel head, slim shaft, split fletching.
  canvasTexture(scene, "cfx-arrow", 72, 16, (c, w, h) => {
    const m = h / 2;
    c.fillStyle = "#fff";
    c.fillRect(12, m - 1.2, w - 26, 2.4);
    c.beginPath();
    c.moveTo(w, m);
    c.lineTo(w - 15, m - 5.5);
    c.lineTo(w - 12, m);
    c.lineTo(w - 15, m + 5.5);
    c.closePath();
    c.fill();
    for (const k of [-1, 1]) {
      c.beginPath();
      c.moveTo(2, m + k * 6.5);
      c.lineTo(16, m + k * 1.2);
      c.lineTo(21, m + k * 1.2);
      c.lineTo(9, m + k * 6.5);
      c.closePath();
      c.fill();
    }
  });
  // Magic circle: two rings, a hexagram and rune ticks, drawn in white.
  canvasTexture(scene, "cfx-rune", 128, 128, (c, w, h) => {
    const m = w / 2;
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(m, m, 60, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(m, m, 48, 0, Math.PI * 2);
    c.stroke();
    for (const turn of [0, Math.PI]) {
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = turn + (k * Math.PI * 2) / 3 - Math.PI / 2;
        c[k ? "lineTo" : "moveTo"](m + Math.cos(a) * 46, m + Math.sin(a) * 46);
      }
      c.closePath();
      c.stroke();
    }
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      c.save();
      c.translate(m + Math.cos(a) * 54, m + Math.sin(a) * 54);
      c.rotate(a);
      c.fillStyle = "#fff";
      c.fillRect(-1.5, -4, 3, 8);
      c.restore();
    }
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
    // Combat bursts are feedback, so even the Low preset keeps a third.
    scaleCount = (n) =>
      Math.max(
        1,
        Math.round(
          n *
            (reduced ? 0.4 : lowPower ? 0.6 : 1) *
            Math.max(0.35, scene.quality?.particles ?? 1),
        ),
      ),
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
    if (!reduced) shakeCamera(cam, ms, intensity);
  };

  // Brief zoom "punch" that settles back to whatever zoom resize() chose.
  const punch = (amount = 0.035, ms = 90) => {
    if (reduced || !screenShakeEnabled() || scene.zoomPunch) return;
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
    { scale = 1, angle = 0, flipY = false, ms = 230, core = 0.8, alpha = 0.95 } = {},
  ) => {
    for (const [s, t, a] of [
      [scale, tint, alpha],
      [scale * 0.82, 0xffffff, core],
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

  // Archer basic shot, built for rapid fire. `chain` counts shots fired back
  // to back: the arrows fly faster, glow hotter and leave afterimages as it
  // climbs; lightning draw (AGI crit haste) turns them into gold bolts.
  const LIGHTNING_TINT = 0xffe066;
  function rapidShot(e, dir, color, accent) {
    const chain = e.chain || 0,
      heat = Math.min(1, chain / 6),
      tint = e.lightning ? LIGHTNING_TINT : heat > 0.5 ? mix(color, accent, heat) : color,
      bx = e.x + dir * 36,
      by = e.y - 6,
      distance = Math.min(e.range || 410, 560),
      ms = 250 - heat * 90,
      // Rapid shots wobble a little in height so a stream reads as a volley.
      y = by + (chain ? ((chain * 37) % 9) - 4 : 0);
    // Bowstring snap: a thin vertical flash and a small ring at the bow.
    const snap = sprite("cfx-spark2", bx - dir * 6, by, 0xffffff, 38)
      .setAngle(90)
      .setScale(0.5, 0.35 + heat * 0.25)
      .setAlpha(0.9);
    scene.tweens.add({ targets: snap, alpha: 0, scaleX: 0.2, duration: 110, onComplete: () => snap.destroy() });
    ring(bx, by, tint, 0.45 + heat * 0.35, 200, 1);
    flare(bx, by, tint, 0.35 + heat * 0.35, 150);
    // A feather or two drifting down from the quiver hand.
    blast(embers, bx - dir * 26, by, 2 + Math.round(heat * 3), tint, {
      speed: [40, 120],
      angle: dir > 0 ? { min: 150, max: 210 } : { min: -30, max: 30 },
    });
    // The arrow itself, a glow riding on it and a streak behind it.
    const arrow = scene.add
      .image(bx, y, "cfx-arrow")
      .setTint(e.lightning ? 0xfff6c8 : mix(0xffffff, tint, 0.25))
      .setScale(0.95 + heat * 0.3, 1)
      .setFlipX(dir < 0)
      .setDepth(37);
    const glow = sprite("cfx-spark2", bx, y, tint, 36)
      .setScale(1.5 + heat * 1.4, 0.9 + heat * 0.5)
      .setFlipX(dir < 0)
      .setAlpha(0.55 + heat * 0.4);
    const trail = scene.add
      .particles(0, 0, "cfx-glow", {
        blendMode: ADD,
        lifespan: 120 + heat * 140,
        frequency: 12,
        speed: { min: 0, max: 20 },
        scale: { start: 0.16 + heat * 0.18, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint,
        follow: arrow,
      })
      .setDepth(35);
    // Hot streams leave afterimages chasing the arrow.
    const ghosts =
      heat >= 0.5
        ? [0.55, 0.3].map((alpha) =>
            sprite("cfx-arrow", bx, y, tint, 36).setAlpha(alpha).setFlipX(dir < 0),
          )
        : [];
    ghosts.forEach((g, n) =>
      scene.tweens.add({
        targets: g,
        x: bx + dir * distance,
        delay: 22 * (n + 1),
        duration: ms,
        ease: "Linear",
        onComplete: () => g.destroy(),
      }),
    );
    scene.tweens.add({
      targets: [arrow, glow],
      x: bx + dir * distance,
      duration: ms,
      ease: "Linear",
      onUpdate: () => {
        // Lightning arrows crackle along the way.
        if (e.lightning && Math.random() < 0.35)
          blast(sparks, arrow.x, arrow.y, 1, LIGHTNING_TINT, { speed: [120, 260] });
      },
      onComplete: () => {
        trail.stop();
        blast(sparks, arrow.x, arrow.y, 6 + Math.round(heat * 6), tint, { speed: [160, 460] });
        flare(arrow.x, arrow.y, tint, 0.6 + heat * 0.5, 180);
        if (e.lightning) pillar(arrow.x, arrow.y + 56, LIGHTNING_TINT, 0.55, 0.35);
        arrow.destroy();
        glow.destroy();
        scene.time.delayedCall(320, () => trail.destroy());
      },
    });
    // The stream's counter: "ยิงรัว ×N" from the third shot on.
    if (chain >= 2 && !e.echo && scene.children.length < 240) {
      const label = scene.add
        .text(e.x, e.y - 96, `ยิงรัว ×${chain + 1}`, {
          fontFamily: "Noto Sans Thai",
          fontSize: `${Math.min(20, 13 + chain)}px`,
          fontStyle: "bold",
          color: e.lightning ? "#ffe066" : "#bff5d0",
          stroke: "#0b0f1a",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(43);
      scene.tweens.add({
        targets: label,
        y: label.y - 22,
        alpha: 0,
        duration: 420,
        ease: "Cubic.out",
        onComplete: () => label.destroy(),
      });
    }
  }

  // Mage basic attack: a three-step spell combo (the server's combo 0/1/2).
  //   0  arcane orb with motes orbiting it
  //   1  twin orbs braiding around each other
  //   2  star finisher that bursts into a rune circle and shards
  // Every cast opens a spinning magic circle at the staff.
  function arcaneCast(e, dir, color, base, tier) {
    // Base tier has no accent of its own: borrow the staff gem's cyan.
    const accent = base === color ? mix(color, 0x7fe8ff, 0.55) : base,
      combo = e.combo || 0,
      sx = e.x + dir * 34,
      sy = e.y - 12,
      distance = Math.min(e.range || 350, 420),
      hot = mix(color, 0xffffff, 0.45);
    // Magic circle facing the target, squashed so it reads as standing upright.
    const circle = sprite("cfx-rune", sx + dir * 8, sy, combo === 2 ? accent : color, 36)
      .setScale(0.12, 0.3)
      .setAlpha(0.95);
    scene.tweens.add({
      targets: circle,
      scaleX: combo === 2 ? 0.32 : 0.24,
      scaleY: combo === 2 ? 0.95 : 0.7,
      angle: dir * 120,
      alpha: 0,
      duration: 360,
      ease: "Cubic.out",
      onComplete: () => circle.destroy(),
    });
    flare(sx, sy, hot, 0.55 + combo * 0.15, 200);
    blast(motes, sx, sy, 4 + combo * 2, hot, { speed: [0, 0] });

    // One orb along a path; `wave` bends it into a braid. Lands with a burst.
    const orb = (size, tint, wave, delay, land) => {
      const head = sprite("cfx-glow", sx, sy, hot, 37).setScale(0.3 * size),
        halo = sprite("cfx-glow", sx, sy, tint, 36).setScale(0.9 * size).setAlpha(0.75),
        orbit = [0, 1, 2].map(() => sprite("cfx-glow", sx, sy, hot, 37).setScale(0.12 * size)),
        trail = scene.add
          .particles(0, 0, "cfx-glow", {
            blendMode: ADD,
            lifespan: 170,
            frequency: 22,
            speed: { min: 0, max: 30 },
            scale: { start: 0.2 * size, end: 0 },
            alpha: { start: 0.55, end: 0 },
            tint,
            follow: head,
          })
          .setDepth(35);
      const parts = [head, halo, ...orbit];
      parts.forEach((o) => o.setVisible(!delay));
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        delay,
        duration: 380 + combo * 30,
        ease: "Sine.in",
        onStart: () => parts.forEach((o) => o.setVisible(true)),
        onUpdate: (tw) => {
          const v = tw.getValue(),
            x = sx + dir * distance * v,
            y = sy + wave(v);
          head.setPosition(x, y);
          halo.setPosition(x, y).setScale((0.9 + Math.sin(v * 20) * 0.12) * size);
          orbit.forEach((o, n) => {
            const a = v * 18 + (n * Math.PI * 2) / 3;
            o.setPosition(x + Math.cos(a) * 16 * size, y + Math.sin(a) * 9 * size);
          });
        },
        onComplete: () => {
          trail.stop();
          land(head.x, head.y);
          parts.forEach((o) => o.destroy());
          scene.time.delayedCall(400, () => trail.destroy());
        },
      });
    };
    const pop = (x, y, tint, size = 1) => {
      ring(x, y, tint, 1.4 * size, 300);
      flare(x, y, 0xffffff, 0.8 * size, 200);
      blast(sparks, x, y, Math.round(8 * size), tint, { speed: [160, 420] });
    };

    if (combo === 0) {
      orb(1, color, () => 0, 0, (x, y) => pop(x, y, color));
    } else if (combo === 1) {
      for (const side of [1, -1])
        orb(0.75, side > 0 ? color : accent, (v) => side * Math.sin(v * Math.PI * 3) * 16 * (1 - v * 0.5), 0, (x, y) =>
          pop(x, y, side > 0 ? color : accent, 0.8),
        );
    } else {
      orb(1.5 + (tier - 1) * 0.2, accent, () => 0, 60, (x, y) => {
        // Finisher: the star bursts into a rune circle, a ring and shards.
        const rune = sprite("cfx-rune", x, y, accent, 36).setScale(0.2).setAlpha(1);
        scene.tweens.add({
          targets: rune,
          scale: 1.05,
          angle: 90,
          alpha: 0,
          duration: 480,
          ease: "Cubic.out",
          onComplete: () => rune.destroy(),
        });
        ring(x, y, color, 2.4, 420);
        ring(x, y + 40, accent, 2, 420, 0.3);
        flare(x, y, 0xffffff, 1.6, 260);
        blast(sparks, x, y, 18, accent, { speed: [220, 560] });
        blast(embers, x, y, 10, hot, { speed: [80, 260], angle: { min: 200, max: 340 } });
        shake(90, 0.003);
      });
    }
  }

  // Swordsman basic attack: a three-step blade combo (the server's combo 0/1/2).
  //   0  diagonal down-cut with a trailing afterimage and a spark shower
  //   1  rising up-cut that throws sparks skyward
  //   2  cross finisher: an X of cuts, a sword wave flying forward,
  //      a ground shockwave, shake and a zoom punch
  // Every swing glints on the blade and rings the ground at the feet; a long
  // chain of swings heats the steel toward the accent colour.
  function bladeCombo(e, dir, color, accent, tier, range) {
    const combo = e.combo || 0,
      heat = Math.min(1, (e.chain || 0) / 6),
      steel = heat > 0.3 ? mix(color, accent === color ? 0xffd27a : accent, heat) : color,
      hot = mix(steel, 0xffffff, 0.5),
      grow = 1 + (tier - 1) * 0.12,
      hx = e.x + dir * range * 0.36,
      hy = e.y + 6,
      feet = e.y + 48;
    // Blade glint at the hand and a step ring where the lead foot lands.
    flare(e.x + dir * 22, e.y - 8, steel, 0.3 + combo * 0.08, 150);
    ring(e.x - dir * 4, feet, steel, 0.9 + combo * 0.25, 260, 0.22);
    // Speed lines streaking forward along the swing.
    const lines = combo === 2 ? 5 : 3;
    for (let n = 0; n < lines; n++) {
      const y = e.y - 24 + (n / Math.max(1, lines - 1)) * 48,
        line = sprite("cfx-spark2", e.x - dir * 10, y, n % 2 ? hot : steel, 35)
          .setFlipX(dir < 0)
          .setScale(0.8, 0.4)
          .setAlpha(0.9);
      scene.tweens.add({
        targets: line,
        x: line.x + dir * (90 + n * 12),
        scaleX: 1.3,
        alpha: 0,
        duration: 170,
        delay: n * 12,
        ease: "Quad.out",
        onComplete: () => line.destroy(),
      });
    }
    // A cut plus its ghost, a beat behind and a little wider.
    // Only the lead cut keeps a bright white core, so stacked cuts stay coloured.
    // Cuts blend additively: only the lead cut is fully opaque with a white
    // core, ghosts and crossing cuts stay faint so the stack keeps its colour.
    const cut = (angle, flipY, scale, delay = 0, alpha = 0.4, core = 0.12) =>
      scene.time.delayedCall(delay, () =>
        slash(hx, hy, dir, steel, { scale: scale * grow, angle, flipY, ms: 240, core, alpha }),
      );
    const sparkShower = (x, y, tint, n, angle) =>
      blast(sparks, x, y, n, tint, { speed: [220, 560], angle });

    if (combo === 0) {
      cut(-42, false, 1.1, 0, 0.9, 0.35);
      cut(-32, false, 1.22, 45);
      sparkShower(hx + dir * 20, hy + 10, hot, 10,
        dir > 0 ? { min: 10, max: 70 } : { min: 110, max: 170 });
      flare(hx + dir * 24, hy, hot, 0.7, 180);
    } else if (combo === 1) {
      cut(44, true, 1.1, 0, 0.9, 0.35);
      cut(54, true, 1.22, 45);
      sparkShower(hx + dir * 16, hy - 10, hot, 12, { min: 235, max: 305 });
      blast(embers, hx, hy, 6, steel, { speed: [160, 360], angle: { min: 240, max: 300 } });
      ring(hx + dir * 20, hy - 6, steel, 1.3, 260, 0.55);
    } else {
      // The cross: two crossing cuts, then the big horizontal sweep.
      cut(-48, false, 1.05, 0, 0.6, 0.1);
      cut(48, true, 1.05, 40, 0.6, 0.1);
      cut(0, false, 1.35, 90, 0.85, 0.25);
      scene.time.delayedCall(90, () => {
        flare(hx + dir * 30, hy, steel, 0.6, 180);
        ring(hx + dir * 20, hy, steel, 1.8, 340);
        ring(hx + dir * 10, feet, accent, 2.6, 420, 0.25);
        sparkShower(hx + dir * 20, hy, hot, 18, undefined);
        blast(embers, hx, feet - 6, 10, steel, { speed: [120, 300], angle: { min: 220, max: 320 } });
        shake(100, 0.004);
        punch(0.03, 80);
        // Sword wave: a crescent of force that keeps flying past the target.
        const wave = sprite("cfx-slash2", hx, hy, steel, 36)
          .setFlipX(dir < 0)
          .setScale(0.7 * grow, 0.9 * grow)
          .setAlpha(0.6);
        const core = sprite("cfx-slash2", hx, hy, hot, 37)
          .setFlipX(dir < 0)
          .setScale(0.55 * grow, 0.7 * grow)
          .setAlpha(0.25);
        scene.tweens.add({
          targets: [wave, core],
          x: hx + dir * (150 + (tier - 1) * 40),
          alpha: 0,
          scaleY: 1.2 * grow,
          duration: 300,
          ease: "Quad.out",
          onComplete: () => {
            wave.destroy();
            core.destroy();
          },
        });
        if (tier >= 3) pillar(hx + dir * 30, feet + 2, accent, 0.8, 0.6);
      });
    }
  }

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
    if (e.class === "archer" && !e.skill) {
      rapidShot(e, dir, color, accent);
    } else if (e.class === "archer") {
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
    } else if (e.class === "mage" && !e.skill) {
      arcaneCast(e, dir, color, accent, tier);
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
    } else if (e.class === "swordsman" && !e.skill) {
      bladeCombo(e, dir, color, accent, tier, range);
    } else if (!e.skill) {
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
    hit: ["#fff5c5", "#ffd36b", "#ed7c29", "#153a43"],
    crit: ["#ffffff", "#fff1a6", "#ffb33e", "#197381"],
    hurt: ["#f6eaff", "#c08bff", "#7a3cf0", "#1f0748"],
    burn: ["#fff1d6", "#ffab4a", "#ff5a1f", "#3d1200"],
    poison: ["#f4ffe0", "#a8f05a", "#3fae2a", "#0f2e08"],
    bleed: ["#ffe6ea", "#ff6b82", "#b0102e", "#33000c"],
  };
  const stacks = new Map();
  // Damage numbers reuse Text objects: each one owns a canvas and a GPU
  // texture, and a single crit used to create and drop up to five.
  const TEXT_DEFAULTS = {
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 0,
      padding: { x: 0, y: 0 },
      shadow: { offsetX: 0, offsetY: 0, color: "#000", blur: 0, stroke: false, fill: false },
    },
    textPool = [];
  function pooledText(x, y, text, style) {
    const full = { ...TEXT_DEFAULTS, ...style };
    const t = textPool.pop();
    if (!t) return scene.add.text(x, y, text, full);
    t.setStyle(full);
    return t
      .setText(text)
      .setPosition(x, y)
      .setScale(1)
      .setAlpha(1)
      .setAngle(0)
      .setActive(true)
      .setVisible(true);
  }
  // Destroy for sprites; texts go back to the pool (up to 40 kept).
  function recycle(o) {
    if (o.type !== "Text" || textPool.length >= 40 || !o.scene) return o.destroy();
    scene.tweens.killTweensOf(o);
    o.setVisible(false).setActive(false);
    textPool.push(o);
  }
  function paint(label, style) {
    const [a, b, c, stroke] = NUMBER_STYLES[style] || NUMBER_STYLES.hit;
    const g = label.context.createLinearGradient(0, 0, 0, label.height);
    g.addColorStop(0, a);
    g.addColorStop(0.45, b);
    g.addColorStop(1, c);
    label.setFill(g).setStroke(stroke, label.style.strokeThickness);
  }
  function digits(x, y, text, style, size, crit) {
    const label = pooledText(x, y, text, {
        fontFamily: "Arial Black, Tahoma, sans-serif",
        fontStyle: "bold",
        fontSize: size + "px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: crit ? 5 : 4,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(42);
    label.setShadow(0, 2, "#000000", 0, false, true);
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
      raw = opts.lines?.length ? opts.lines : [{ amount: Math.abs(amount), crit }],
      // Many hits at once (multi-hit skills): one total, not a tall column
      // that covers the hero and the ground.
      lines = raw.length > 3
        ? [{ amount: raw.reduce((s, l) => s + Math.abs(l.amount), 0), crit: raw.some((l) => l.crit), hits: raw.length }]
        : raw;
    // Start above a stack that is still on screen for this target.
    const prev = stacks.get(targetId),
      step = tick ? 0 : 42,
      ceiling = scene.cameras.main.worldView.y + 80,
      base = Math.max(ceiling + (lines.length - 1) * step,
        prev && now < prev.until ? prev.top - 10 : y),
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
        size = tick ? 22 : line.crit ? 48 : hurt ? 30 : 40,
        lx = x + jitter + (tick ? 38 : 0) + (line.crit ? 6 : 0),
        ly = base - n * step;
      if (line.crit) crits++;
      scene.time.delayedCall(n * 80, () => {
        const text = String(Math.abs(line.amount)) + (line.hits ? ` ×${line.hits}` : ""),
          main = digits(lx, ly, text, style, size, line.crit),
          outline = !hurt && !tick ? pooledText(lx, ly, text, {
            fontFamily: "Arial Black, Tahoma, sans-serif", fontStyle: "bold",
            fontSize: size + "px", color: "#070f1c", stroke: "#070f1c",
            strokeThickness: line.crit ? 9 : 8, padding: { x: 6, y: 6 },
          }).setOrigin(.5).setDepth(41) : null,
          parts = outline ? [outline, main] : [main];
        if (line.crit) {
          // Burst behind, a white flash copy on top, a star badge, and a kick.
          const burst = sprite("cfx-glow", lx, ly, 0xffc66a, 41).setDisplaySize(main.width * 1.5, 70);
          const flash = pooledText(lx, ly, text, {
              fontFamily: "Arial Black, Tahoma, sans-serif",
              fontStyle: "bold",
              fontSize: size + "px",
              color: "#ffffff",
              padding: { x: 4, y: 4 },
            })
            .setOrigin(0.5)
            .setDepth(43);
          scene.tweens.add({ targets: flash, alpha: 0, duration: 160, onComplete: () => recycle(flash) });
          scene.tweens.add({
            targets: burst,
            alpha: 0,
            scaleX: burst.scaleX * 1.4,
            scaleY: burst.scaleY * 1.4,
            duration: 360,
            onComplete: () => burst.destroy(),
          });
          const badge = sprite("cfx-glow", lx - main.width / 2 - 14, ly, 0x78e5dc, 43).setDisplaySize(34, 34);
          const star = pooledText(badge.x, ly, "❖", {
              fontFamily: "Noto Sans Thai",
              fontSize: "24px",
              color: "#c6fff3",
              stroke: "#123c48",
              strokeThickness: 2,
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
          const icon = pooledText(lx - main.width / 2 - 6, ly, opts.icon || "", {
              fontFamily: "Noto Sans Thai",
              fontSize: "18px",
            })
            .setOrigin(1, 0.5)
            .setDepth(42);
          parts.push(icon);
        }
        const from = tick ? 0.6 : line.crit ? 1.45 : 1.25;
        for (const p of parts) p.setScale(from).setAlpha(0);
        main.setAngle(0);
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
          onComplete: () => parts.forEach(recycle),
        });
      });
    });
    // One shout over a stack with crits in it.
    if (!hurt && !tick && lines.some((l) => l.crit)) {
      const tag = pooledText(x + jitter, top - 6, "◆ CRITICAL", {
          fontFamily: "Tahoma, Noto Sans Thai, sans-serif",
          fontSize: "20px",
          color: "#ffffff",
          stroke: "#123c48",
          strokeThickness: 2,
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
            onComplete: () => recycle(tag),
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
        const c = hurt ? 0xff4d4d : line.crit ? 0x92efdf : 0xffbe59;
        flare(e.x + (Math.random() - 0.5) * 20, y - n * 6, c, line.crit ? 2 : 1.3, line.crit ? 280 : 200);
        blast(sparks, e.x, y, line.crit ? 18 : 10, c, {
          speed: [240, line.crit ? 700 : 520],
          angle: dir > 0 ? { min: -55, max: 55 } : { min: 125, max: 235 },
        });
      }),
    );
    if (e.crit) ring(e.x, y, 0x92efdf, 2, 300);
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
