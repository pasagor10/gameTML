// Body motion and extras for heroes and monsters: squash & stretch, gait
// bob, attack lean/lunge, hit flash, shadows, spawn rise, wind-up alert and
// boss aura. Cosmetic only — positions still come from server snapshots.

const ease = (t) => 1 - (1 - t) ** 3;

// How each monster moves. bob: px, speed: rad/s, tilt: deg, fly: hovers.
const GAITS = {
  "frost-scarab": { bob: 2, speed: 14, tilt: 3, heavy: true },
  "lava-salamander": { bob: 2, speed: 10, tilt: 5, sway: true },
  "thorn-mantis": { bob: 3, speed: 12, tilt: 4 },
  "storm-harpy": { bob: 8, speed: 7, tilt: 4, fly: true },
  "moon-reaper": { bob: 5, speed: 4, tilt: 3, fly: true },
  mimic: { bob: 4, speed: 10, tilt: 8, squash: 0.06 },
  "frost-revenant": { bob: 2, speed: 6, tilt: 2, heavy: true },
  "ember-colossus": { bob: 3, speed: 5, tilt: 2, heavy: true },
  "thorn-queen": { bob: 2, speed: 5, tilt: 2, sway: true },
  "storm-roc": { bob: 5, speed: 9, tilt: 3, squash: 0.03 },
  "moon-emperor": { bob: 2, speed: 5, tilt: 2, heavy: true },
  slime: { bob: 0, speed: 0, tilt: 0, squash: 0.06 },
  bat: { bob: 9, speed: 7, tilt: 6, fly: true, flap: 0.12 },
  boar: { bob: 4, speed: 16, tilt: 4, squash: 0.04 },
  mushroom: { bob: 3, speed: 10, tilt: 9, squash: 0.08 },
  wolf: { bob: 5, speed: 15, tilt: 5, squash: 0.03 },
  goblin: { bob: 4, speed: 12, tilt: 8, squash: 0.04 },
  batking: { bob: 14, speed: 4, tilt: 4, fly: true, flap: 0.08 },
  golem: { bob: 3, speed: 6, tilt: 2, squash: 0.05, heavy: true },
  serpent: { bob: 2, speed: 5, tilt: 7, squash: 0.06, sway: true },
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function flash(image, hitAge) {
  if (hitAge >= 0 && hitAge < 0.06) image.setTintFill(0xffffff);
  else if (hitAge >= 0.06 && hitAge < 0.16) image.setTint(0xff8a8a);
}

// Call after animateHero() and the interpolated setPosition().
export function animateHeroBody(a, p, pose, serverTime, now) {
  const img = a.image,
    spriteSet = img.texture.key.startsWith("sprite:"),
    size = img.texture.key === "knight-motion" ? 154 : 125,
    atlas =
      (spriteSet && !img._spriteStill) || img.texture.key === "knight-motion";
  // Reset to the base size each frame, then layer squash on top.
  if (spriteSet) img.setScale(img._spriteScale);
  else img.setDisplaySize(size, size);
  let sx = 1,
    sy = 1,
    dx = 0,
    dy = 0;
  if (!reduced && p.hp > 0) {
    if (pose.state === "idle") {
      const b = Math.sin(now * 0.0032);
      sy += b * 0.018;
      sx -= b * 0.012;
    } else if (pose.state === "walk" || pose.state === "run") {
      const rate = p.running ? 0.022 : 0.016,
        step = Math.abs(Math.sin(now * rate));
      if (!atlas) {
        dy -= step * (p.running ? 7 : 4);
        sy += step * 0.03;
        sx -= step * 0.02;
      }
    } else if (pose.state === "jump") {
      const v = Phaser.Math.Clamp((p.vy || 0) / 650, -1, 1);
      sy += v < 0 ? -v * 0.1 : -v * 0.05;
      sx -= v < 0 ? -v * 0.07 : -v * 0.03;
    } else if (
      (pose.state === "attack" || pose.state === "skill") &&
      p.action
    ) {
      const ac = p.action,
        dir = ac.direction || p.direction || 1;
      if (serverTime < ac.impactAt) {
        // Wind-up: crouch and lean back.
        const t =
          (serverTime - ac.startedAt) /
          Math.max(0.01, ac.impactAt - ac.startedAt);
        sy -= t * 0.06;
        sx += t * 0.05;
        if (!atlas) dx -= dir * t * 6;
      } else {
        // Release: lunge forward then settle.
        const t =
          (serverTime - ac.impactAt) / Math.max(0.01, ac.endsAt - ac.impactAt);
        const k = Math.sin(Math.min(1, t) * Math.PI) * (1 - t * 0.5);
        sy += k * 0.05;
        sx -= k * 0.03;
        if (!atlas) dx += dir * k * (ac.skill ? 16 : 10);
      }
    }
    // Landing squash.
    const land = (now - (a.landAt || -1e9)) / 170;
    if (land >= 0 && land < 1) {
      const k = (1 - ease(land)) * 0.16;
      sy -= k;
      sx += k * 0.8;
    }
  }
  img.setScale(img.scaleX * sx, img.scaleY * sy);
  img.x += dx;
  img.y += dy;
  flash(img, serverTime - (p.hitAt || -1e9));
}

export function createMonsterExtras(scene, m, e, spawning) {
  const gait = e.world ? GAITS.golem : GAITS[e.type] || GAITS.goblin;
  m.gait = gait;
  m.shadow = scene.add
    .ellipse(e.x, e.y - 2, m.size * 0.62, m.size * 0.13, 0x0b1a2a, 0.38)
    .setDepth(6);
  m.alert = scene.add
    .text(e.x, e.y - m.size - 40, "!", {
      fontFamily: "Chonburi, Noto Sans Thai",
      fontSize: e.boss ? "40px" : "30px",
      color: "#ffe066",
      stroke: "#7a1010",
      strokeThickness: 6,
    })
    .setOrigin(0.5, 1)
    .setDepth(16)
    .setVisible(false);
  m.seed = Math.random() * 1000;
  m.spawnAt = spawning && !reduced ? scene.time.now : -1e9;
  if (e.boss) {
    if (scene.renderer.type === Phaser.WEBGL && !scene.lite)
      m.glow = m.image.preFX?.addGlow(0xff5fd2, 3, 0, false, 0.1, 12);
    m.aura = scene.add
      .particles(0, 0, "cfx-glow", {
        follow: m.image,
        followOffset: { x: 0, y: -m.size * 0.45 },
        emitZone: {
          type: "random",
          source: new Phaser.Geom.Ellipse(0, 0, m.size * 0.9, m.size * 0.8),
        },
        lifespan: 1400,
        frequency: reduced ? -1 : 90,
        speedY: { min: -40, max: -15 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.55, end: 0 },
        tint: [0xff5fd2, 0x9b5cff, 0xffd34d],
        blendMode: "ADD",
      })
      .setDepth(7);
  }
}

export function destroyMonsterExtras(m) {
  m.shadow?.destroy();
  m.alert?.destroy();
  m.aura?.destroy();
  m.effects?.destroy();
}

// Call after animateSlime() and the interpolated setPosition().
export function animateMonsterBody(m, e, serverTime, now, atlas) {
  const img = m.image,
    g = m.gait,
    groundY = img.y,
    // Painted frame sets animate gait/attack themselves; only add hover,
    // hit squash and spawn pop on top of them.
    framed = img.texture.key.startsWith("sprite:"),
    usesAtlas = (atlas && e.type === "slime") || framed;
  if (framed) img.setScale(img._spriteScale);
  else img.setDisplaySize(m.size, m.size);
  let sx = 1,
    sy = 1,
    dy = 0,
    angle = 0;
  const t = now * 0.001 + m.seed,
    dir = e.direction || 1;
  if (!reduced && e.hp > 0) {
    if (g.fly && framed) {
      dy -= 26 + Math.sin(t * g.speed * 0.5) * g.bob;
    } else if (framed) {
      // frames carry the gait
    } else if (g.fly) {
      dy -= 26 + Math.sin(t * g.speed * 0.5) * g.bob;
      const flap = Math.sin(t * 22);
      sy += flap * g.flap;
      sx -= flap * g.flap * 0.4;
      angle = (e.moving ? dir * g.tilt : 0) + Math.sin(t * 2) * 3;
    } else if (e.moving) {
      const step = Math.abs(Math.sin(t * g.speed));
      dy -= step * g.bob;
      sy += (step - 0.5) * (g.squash || 0) * 2;
      sx -= (step - 0.5) * (g.squash || 0) * 1.4;
      angle = Math.sin(t * g.speed) * g.tilt * (g.heavy ? 0.5 : 1);
    } else {
      const b = Math.sin(t * (g.heavy ? 1.6 : 2.6));
      sy += b * (g.squash || 0.03) * 0.6;
      sx -= b * (g.squash || 0.03) * 0.4;
      if (g.sway) angle = Math.sin(t * 1.8) * g.tilt;
    }
    const ac = e.action;
    if (!framed && ac && serverTime < ac.endsAt) {
      if (serverTime < ac.impactAt) {
        const k =
          (serverTime - ac.startedAt) /
          Math.max(0.01, ac.impactAt - ac.startedAt);
        sy -= k * 0.12;
        sx += k * 0.1;
        angle -= ac.direction * k * 10;
        img.x += Math.sin(serverTime * 90) * k * 2.5; // tremble
      } else {
        const k = Math.sin(
          Math.min(
            1,
            (serverTime - ac.impactAt) /
              Math.max(0.01, ac.endsAt - ac.impactAt),
          ) * Math.PI,
        );
        sy += k * 0.08;
        sx -= k * 0.05;
        angle += ac.direction * k * 12;
        img.x += ac.direction * k * (e.boss ? 18 : 14);
      }
    }
    const hitAge = serverTime - (e.hitAt || -1e9);
    if (hitAge >= 0 && hitAge < 0.2) {
      const k = (1 - hitAge / 0.2) * (framed ? 0.5 : 1);
      sy -= k * 0.14;
      sx += k * 0.12;
    }
    const spawn = (now - m.spawnAt) / 520,
      spawnClip = framed && e.spawnAt && serverTime - e.spawnAt < 0.6;
    if (spawn >= 0 && spawn < 1 && !spawnClip) {
      const k = Phaser.Math.Easing.Back.Out(spawn);
      sx *= k;
      sy *= k;
      img.alpha = Math.min(1, spawn * 2.5);
    } else img.alpha = 1;
  }
  if (usesAtlas) angle = 0;
  img.setScale(img.scaleX * sx, img.scaleY * sy);
  img.y += dy;
  img.setAngle(angle);
  flash(img, serverTime - (e.hitAt || -1e9));

  const air = groundY - img.y;
  m.shadow
    .setPosition(img.x, groundY - 2)
    .setScale(Math.max(0.45, 1 - air / 160), Math.max(0.45, 1 - air / 160))
    .setAlpha(e.hp > 0 ? 0.38 : 0);

  const ac = e.action,
    windup = ac && serverTime < ac.impactAt;
  m.alert.setVisible(!!windup);
  if (windup) {
    const k =
      (serverTime - ac.startedAt) / Math.max(0.01, ac.impactAt - ac.startedAt);
    m.alert
      .setPosition(img.x, img.y - m.size - 20 - k * 6)
      .setScale(0.6 + Math.min(1, k * 3) * 0.5)
      .setAngle(Math.sin(now * 0.05) * 8);
  }
  if (m.glow) m.glow.outerStrength = 2.5 + Math.sin(now * 0.004) * 1.2;
}
