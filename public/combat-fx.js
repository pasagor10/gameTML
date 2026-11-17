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

  function attack(e) {
    const dir = e.direction || 1,
      range = e.range || 130,
      color = e.color;
    if (e.class === "archer") {
      const count = e.skill === 2 ? 3 : 1;
      for (let n = 0; n < count; n++)
        scene.time.delayedCall(n * 70, () =>
          projectile(
            e.x + dir * 40,
            e.y - 4 + (n - (count - 1) / 2) * 16,
            dir,
            e.skill ? 600 : 410,
            color,
            {
              arrow: true,
              size: e.skill === 3 ? 2 : e.skill ? 1.3 : 1,
              ms: e.skill === 3 ? 300 : 340,
            },
          ),
        );
      flare(e.x + dir * 40, e.y - 4, color, 0.6);
    } else if (e.class === "mage") {
      const size = [1, 1.4, 1.8, 2.4][e.skill || 0];
      projectile(e.x + dir * 30, e.y, dir, 350, color, { size, ms: 420 });
      ring(e.x + dir * 30, e.y, color, 0.9 * size, 260);
    } else if (!e.skill) {
      // Three-hit combo: down-cut, up-cut, then a wide horizontal finisher.
      const combo = e.combo || 0;
      slash(e.x + dir * range * 0.32, e.y + 6, dir, color, {
        scale: combo === 2 ? 1.35 : 1.1,
        angle: [-22, 26, 0][combo],
        flipY: combo === 1,
      });
    }

    if (e.class === "swordsman" && e.skill === 1) {
      for (let n = 0; n < 3; n++)
        scene.time.delayedCall(n * 60, () => {
          const img = sprite(
            "cfx-slash2",
            e.x + dir * 50,
            e.y + 4,
            n === 1 ? 0xffffff : color,
          )
            .setFlipX(dir < 0)
            .setScale(0.75 - n * 0.08)
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
      flare(cx, cy, 0xffe5a0, 2.2, 320);
      ring(cx, cy + 25, 0xffb34a, 3, 420, 0.32);
      ring(cx, cy, 0xffe5a0, 2, 320);
      blast(embers, cx, cy, 26, 0xffb34a, {
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
      if (!reduced) cam.flash(140, 255, 245, 210, true);
      ring(cx, ground, color, 5, 600, 0.22);
      ring(cx, ground, 0xffffff, 3.5, 450, 0.22);
      for (let n = -3; n <= 3; n++)
        scene.time.delayedCall(Math.abs(n) * 45, () => {
          const beam = sprite(
            "cfx-beam",
            cx + n * 70,
            ground + 10,
            n % 2 ? 0xfff4c4 : color,
            32,
          )
            .setOrigin(0.5, 1)
            .setScale(n % 2 ? 0.7 : 1.1, 0.1);
          scene.tweens.add({
            targets: beam,
            scaleY: 1.2 - Math.abs(n) * 0.08,
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
      shake(90, 0.002);
    }
  }

  // Per-target stacking so simultaneous numbers don't overlap.
  const stacks = new Map();
  function number(x, y, amount, crit, targetId) {
    const now = scene.time.now,
      s = stacks.get(targetId);
    const slot = s && now - s.at < 400 ? (s.slot + 1) % 4 : 0;
    stacks.set(targetId, { at: now, slot });
    if (stacks.size > 50) stacks.clear();
    const hurt = amount < 0,
      label = scene.add
        .text(
          x + (Math.random() - 0.5) * 24,
          y - slot * 22,
          String(Math.abs(amount)),
          {
            fontFamily: "Chonburi, Noto Sans Thai",
            fontSize: crit ? "34px" : hurt ? "24px" : "26px",
            color: hurt ? "#ff6b6b" : crit ? "#ffe066" : "#ffffff",
            stroke: hurt ? "#3a0610" : crit ? "#6b2d00" : "#1d2a44",
            strokeThickness: crit ? 7 : 5,
          },
        )
        .setOrigin(0.5)
        .setDepth(42)
        .setScale(0.3);
    label.setShadow(0, 3, "#000000", 4, true, true);
    if (crit) {
      const g = label.context.createLinearGradient(0, 0, 0, label.height);
      g.addColorStop(0, "#fffbe0");
      g.addColorStop(0.5, "#ffd34d");
      g.addColorStop(1, "#ff8a1f");
      label.setFill(g);
    }
    const tag = crit
      ? scene.add
          .text(label.x, label.y - 26, "CRITICAL!", {
            fontFamily: "Chonburi, Noto Sans Thai",
            fontSize: "13px",
            color: "#fff3b0",
            stroke: "#6b2d00",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(42)
          .setAlpha(0)
      : null;
    const drift = (Math.random() - 0.5) * 50;
    scene.tweens.add({
      targets: label,
      scale: crit ? 1.25 : 1,
      duration: 140,
      ease: "Back.out",
      onComplete: () =>
        scene.tweens.add({
          targets: label,
          y: label.y - 55,
          x: label.x + drift,
          scale: crit ? 1 : 0.85,
          alpha: 0,
          delay: crit ? 380 : 240,
          duration: 520,
          ease: "Quad.in",
          onComplete: () => label.destroy(),
        }),
    });
    if (tag)
      scene.tweens.add({
        targets: tag,
        alpha: 1,
        y: tag.y - 8,
        duration: 160,
        yoyo: true,
        hold: 420,
        onComplete: () => tag.destroy(),
      });
  }

  // `from` is the attacker's x, used to throw sparks away from them.
  function hit(e, from, target, isSelf = false) {
    const hurt = e.amount < 0,
      dir = from === undefined ? 1 : Math.sign(e.x - from) || 1,
      color = hurt ? 0xff4d4d : e.crit ? 0xffc23d : 0xff9a3c,
      y = e.y + 30;
    flare(e.x, y, color, e.crit ? 2 : 1.3, e.crit ? 280 : 200);
    blast(sparks, e.x, y, e.crit ? 22 : 12, color, {
      speed: [240, e.crit ? 700 : 520],
      angle: dir > 0 ? { min: -55, max: 55 } : { min: 125, max: 235 },
    });
    if (e.crit) {
      ring(e.x, y, 0xffd34d, 1.6, 260);
      shake(110, 0.004);
      punch(0.025, 70);
    }
    if (hurt && isSelf) shake(120, 0.005);
    if (target)
      target.kick = { at: scene.time.now, dir, power: e.crit ? 14 : 8 };
    number(e.x, e.y, e.amount, e.crit, e.targetId);
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

  return { attack, hit, death, charge, applyKick };
}
