// Layered, animated background for the Adventure scene.
// The town is assembled from kit pieces (shared/town-layout.js) on a repeating
// street tile, aligned 1:1 with the collision world. The cave backdrop is one
// painting split at the walkway's back edge; its scenery scrolls slower.
// Procedural layers add
// light shafts, ambient particles, drifting fog and blurred foreground framing.

import {
  TOWN_BASE,
  TOWN_LAYOUT,
  TOWN_PIECES,
  TOWN_PROPS,
  TOWN_SPOTS,
  TOWN_STREET_Y,
  TOWN_WIDTH,
  TOWN_ANIMS,
  TOWN_GROUND,
} from "/shared/town-layout.js";
import { skyColor } from "/night-sky.js?v=2";

const WORLD_W = 2400,
  BACK_Y = -180,
  BACK_H = 1000,
  SCENERY_FACTOR = 0.9,
  // Fraction of each painting's height where the walkable floor begins.
  SPLIT = { town: 0.754, cave: 0.716 };

function canvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h),
    ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function makeTextures(scene) {
  canvasTexture(scene, "fx-dot", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  canvasTexture(scene, "fx-leaf", 32, 20, (c) => {
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(2, 10);
    c.quadraticCurveTo(16, -4, 30, 10);
    c.quadraticCurveTo(16, 24, 2, 10);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.25)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(4, 10);
    c.lineTo(28, 10);
    c.stroke();
  });
  canvasTexture(scene, "fx-petal", 20, 20, (c) => {
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(10, 10, 9, 5, 0.6, 0, Math.PI * 2);
    c.fill();
  });
  canvasTexture(scene, "fx-ray", 128, 512, (c, w, h) => {
    const hg = c.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, "rgba(255,255,255,0)");
    hg.addColorStop(0.5, "rgba(255,255,255,1)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = hg;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "destination-in";
    const vg = c.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, "rgba(0,0,0,1)");
    vg.addColorStop(0.7, "rgba(0,0,0,0.35)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
  });
  canvasTexture(scene, "fx-seam", 8, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(8,20,30,0.55)");
    g.addColorStop(1, "rgba(8,20,30,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  canvasTexture(scene, "fx-fog", 512, 128, (c, w, h) => {
    // Seamless soft fog band: blobs wrapped around the horizontal edges.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w,
        y = h * (0.35 + rnd() * 0.4),
        r = 30 + rnd() * 50;
      for (const ox of [-w, 0, w]) {
        const g = c.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.32)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
  });
  canvasTexture(scene, "fx-vignette", 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(
      w / 2,
      h * 0.45,
      w * 0.28,
      w / 2,
      h / 2,
      w * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(4,12,24,0.62)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  // Foreground framing strips. Shapes are drawn three times (x-w, x, x+w) so
  // the strip tiles seamlessly when scrolled.
  const strip = (key, w, h, draw) =>
    canvasTexture(scene, key, w, h, (c) => {
      let seed = key.length * 977;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      draw(c, w, h, rnd);
    });
  strip("fg-town-bottom", 1024, 220, (c, w, h, rnd) => {
    const leaf = (x, y, len, ang, col) => {
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(len * 0.5, -len * 0.22, len, 0);
      c.quadraticCurveTo(len * 0.5, len * 0.22, 0, 0);
      c.fill();
      c.restore();
    };
    for (let layer = 0; layer < 3; layer++) {
      const col = ["#1d4a2a", "#163c22", "#0f2c19"][layer];
      for (let i = 0; i < 26; i++) {
        const x = rnd() * w,
          base = h + 10,
          n = 5 + Math.floor(rnd() * 5),
          len = 70 + rnd() * 90 - layer * 10;
        for (const ox of [-w, 0, w])
          for (let k = 0; k < n; k++)
            leaf(
              x + ox,
              base,
              len,
              -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.1 + (rnd() - 0.5) * 0.2,
              col,
            );
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w,
        y = h - 40 - rnd() * 70;
      for (const ox of [-w, 0, w]) {
        c.fillStyle = "rgba(255,244,214,0.75)";
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          c.beginPath();
          c.ellipse(
            x + ox + Math.cos(a) * 5,
            y + Math.sin(a) * 5,
            4,
            2.5,
            a,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
        c.fillStyle = "#f2c85a";
        c.beginPath();
        c.arc(x + ox, y, 2.5, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  strip("fg-town-top", 1024, 200, (c, w, h, rnd) => {
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * w,
        drop = 60 + rnd() * 120;
      for (const ox of [-w, 0, w]) {
        // Branch with a cluster of leaves hanging down.
        c.strokeStyle = "#2a2116";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(cx + ox - 60, -4);
        c.quadraticCurveTo(cx + ox, drop * 0.4, cx + ox + 40, drop * 0.6);
        c.stroke();
        for (let k = 0; k < 22; k++) {
          const x = cx + ox - 60 + rnd() * 120,
            y = rnd() * drop,
            r = 10 + rnd() * 16;
          c.fillStyle = ["#1b4426", "#225530", "#143520"][k % 3];
          c.beginPath();
          c.ellipse(x, y, r, r * 0.55, rnd() * Math.PI, 0, Math.PI * 2);
          c.fill();
        }
        c.strokeStyle = "#1e4a28";
        c.lineWidth = 2;
        for (let v = 0; v < 3; v++) {
          const vx = cx + ox - 40 + rnd() * 80;
          c.beginPath();
          c.moveTo(vx, drop * 0.5);
          c.quadraticCurveTo(vx + 8, drop + 20, vx - 4, drop + 40 + rnd() * 30);
          c.stroke();
        }
      }
    }
  });
  strip("fg-cave-bottom", 1024, 220, (c, w, h, rnd) => {
    for (let i = 0; i < 12; i++) {
      const x = rnd() * w,
        rw = 90 + rnd() * 140,
        rh = 60 + rnd() * 90;
      for (const ox of [-w, 0, w]) {
        c.fillStyle = "#151a33";
        c.beginPath();
        c.moveTo(x + ox - rw / 2, h + 2);
        c.quadraticCurveTo(x + ox - rw * 0.4, h - rh, x + ox, h - rh * 1.05);
        c.quadraticCurveTo(
          x + ox + rw * 0.45,
          h - rh * 0.9,
          x + ox + rw / 2,
          h + 2,
        );
        c.fill();
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = rnd() * w,
        n = 2 + Math.floor(rnd() * 3),
        cyan = rnd() > 0.45;
      for (const ox of [-w, 0, w])
        for (let k = 0; k < n; k++) {
          const ch = 50 + rnd() * 90,
            cw = 14 + rnd() * 14,
            tilt = (k - (n - 1) / 2) * 0.35,
            bx = x + ox + k * 14;
          c.save();
          c.translate(bx, h + 4);
          c.rotate(tilt);
          const g = c.createLinearGradient(0, -ch, 0, 0);
          g.addColorStop(0, cyan ? "#bff6ff" : "#e6c6ff");
          g.addColorStop(1, cyan ? "#2c6b9a" : "#5a3a8f");
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(-cw / 2, 0);
          c.lineTo(-cw / 2, -ch * 0.75);
          c.lineTo(0, -ch);
          c.lineTo(cw / 2, -ch * 0.75);
          c.lineTo(cw / 2, 0);
          c.fill();
          c.restore();
        }
    }
  });
  strip("fg-cave-top", 1024, 220, (c, w, h, rnd) => {
    c.fillStyle = "#121730";
    c.fillRect(0, 0, w, 18);
    for (let i = 0; i < 28; i++) {
      const x = rnd() * w,
        sw = 18 + rnd() * 40,
        sh = 40 + rnd() * 160;
      for (const ox of [-w, 0, w]) {
        c.fillStyle = i % 3 ? "#121730" : "#1a2142";
        c.beginPath();
        c.moveTo(x + ox - sw / 2, 0);
        c.quadraticCurveTo(x + ox - sw * 0.15, sh * 0.6, x + ox, sh);
        c.quadraticCurveTo(x + ox + sw * 0.15, sh * 0.6, x + ox + sw / 2, 0);
        c.fill();
        if (i % 4 === 0) {
          c.fillStyle = "rgba(140,230,255,0.55)";
          c.beginPath();
          c.arc(x + ox, sh - 4, 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  });
}

const THEMES = {
  town: {
    rays: {
      color: 0xfff1c4,
      alpha: 0.16,
      xs: [180, 420, 700, 980],
      angle: -0.38,
    },
    fogColor: 0xeaf7ff,
    fogAlpha: 0.22,
    grade: 0xffe2a8,
    gradeAlpha: 0.05,
  },
  cave: {
    rays: { color: 0x8fe7ff, alpha: 0.2, xs: [520, 640, 760], angle: 0.08 },
    fogColor: 0x9fd8ff,
    fogAlpha: 0.38,
    grade: 0x4a3fae,
    gradeAlpha: 0.1,
  },
};

export function createParallax(scene) {
  makeTextures(scene);
  const reduced = scene.reducedMotion,
    lowPower = scene.scale.width < 700,
    cam = () => scene.cameras.main;

  const scenery = scene.add
      .image(0, BACK_Y, "cave")
      .setOrigin(0)
      .setDisplaySize(WORLD_W, BACK_H)
      .setScrollFactor(SCENERY_FACTOR, 1)
      .setDepth(-30),
    floor = scene.add
      .image(0, BACK_Y, "cave")
      .setOrigin(0)
      .setDisplaySize(WORLD_W, BACK_H)
      .setDepth(-24),
    seam = scene.add
      .tileSprite(0, 0, WORLD_W, 34, "fx-seam")
      .setOrigin(0)
      .setDepth(-23),
    grade = scene.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(-22)
      .setBlendMode(Phaser.BlendModes.MULTIPLY),
    rays = [],
    fog = scene.add
      .tileSprite(0, 600, 10, 128, "fx-fog")
      .setOrigin(0.5, 0.62)
      .setScrollFactor(0, 1)
      .setDepth(16),
    fogBack = scene.add
      .tileSprite(0, 520, 10, 128, "fx-fog")
      .setOrigin(0.5, 0.62)
      .setScrollFactor(0, 1)
      .setDepth(-21)
      .setFlipX(true),
    fgBottom = scene.add
      .tileSprite(0, 0, 10, 220, "fg-town-bottom")
      .setOrigin(0.5, 1)
      .setScrollFactor(0, 0)
      .setDepth(44),
    fgTop = scene.add
      .tileSprite(0, 0, 10, 200, "fg-town-top")
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 0)
      .setDepth(44),
    vignette = scene.add
      .image(0, 0, "fx-vignette")
      .setScrollFactor(0)
      .setDepth(48);

  // Town far layers, back to front: painted strips that repeat sideways and
  // scroll slower the further away they are (tools/town-kit/far_layers.py).
  // top: world y of the strip's top at the camera's resting height.
  const FAR = [
    { key: "sky", top: -1248, fx: 0.05, fy: 0.15, depth: -38, drift: 0.006 },
    // Each strip carries its bottom colour on down, hidden by the next one.
    { key: "mountains", top: 0, fx: 0.22, fy: 0.5, depth: -37 },
    { key: "hills", top: 150, fx: 0.42, fy: 0.7, depth: -36 },
    { key: "treeline", top: 255, fx: 0.62, fy: 0.85, depth: -35 },
    { key: "village", top: 345, fx: 0.8, fy: 0.92, depth: -34 },
  ];
  const far = FAR.map((l) => {
    const src = scene.textures.get(`town-far-${l.key}`).getSourceImage(),
      h = l.h || src.height,
      layer = scene.add
        .tileSprite(0, 0, 10, h, `town-far-${l.key}`)
        .setOrigin(0.5, 0)
        .setScrollFactor(0, l.fy)
        .setDepth(l.depth);
    if (l.h) layer.setTileScale(h / src.height, h / src.height);
    return { ...l, layer };
  });
  // Kit pieces on the street tile, then props: behind the heroes, or in
  // front of them for a little foreground depth.
  const animated = [];
  const props = TOWN_PROPS.map((p, i) => {
    const anim = p.key.startsWith("anim-"),
      img = scene.add
        .image(
          p.x,
          p.y ?? TOWN_GROUND + 2,
          `town-${p.key}`,
          anim ? 0 : undefined,
        )
        .setOrigin(0.5, p.hang ? 0 : 1)
        .setFlipX(!!p.flip)
        .setDepth(p.front ? 18 : -29);
    if (p.front) img.setAlpha(0.95);
    if (anim) animated.push({ img, phase: i * 137 });
    return img;
  });
  const kit = [
    ...far.map((l) => l.layer),
    scene.add
      .tileSprite(-200, TOWN_STREET_Y, TOWN_WIDTH + 400, 600, "town-street")
      .setOrigin(0)
      .setDepth(-31),
    ...TOWN_LAYOUT.map((p) =>
      scene.add
        .image(p.x, TOWN_BASE, `town-piece-${p.piece}`)
        .setOrigin(0, 1)
        .setFlipX(!!p.flip)
        .setDepth(-30),
    ),
    ...props,
  ];

  if (!lowPower && scene.renderer.type === Phaser.WEBGL) {
    fgBottom.preFX?.addBlur(0, 2, 2, 1.1);
    fgTop.preFX?.addBlur(0, 2, 2, 1.1);
  }

  for (let i = 0; i < 4; i++)
    rays.push(
      scene.add
        .image(0, -160, "fx-ray")
        .setOrigin(0.5, 0)
        .setScrollFactor(0.45, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(-22),
    );

  const fade = (peak) => ({
    onEmit: () => 0,
    onUpdate: (p, k, t) => Math.sin(t * Math.PI) * peak,
  });
  const emitters = [];
  const addEmitter = (texture, config, scroll, depth) => {
    const e = scene.add
      .particles(0, 0, texture, { ...config, emitting: !reduced })
      .setScrollFactor(scroll, 1)
      .setDepth(depth);
    emitters.push(e);
    return e;
  };
  const motes = (density) =>
    Math.max(1, Math.round(density * (lowPower ? 0.5 : 1)));

  // Town ambience.
  const town = [
    addEmitter(
      "fx-dot",
      {
        x: { min: 0, max: TOWN_WIDTH },
        y: { min: -60, max: 560 },
        lifespan: { min: 6000, max: 10000 },
        speedX: { min: -10, max: 12 },
        speedY: { min: -14, max: -3 },
        scale: { min: 0.05, max: 0.13 },
        tint: [0xfff6c8, 0xe9ffb8, 0xffffff],
        alpha: fade(0.75),
        blendMode: "ADD",
        frequency: 260,
        quantity: 1,
        maxAliveParticles: motes(40),
      },
      0.85,
      -20,
    ),
    addEmitter(
      "fx-petal",
      {
        x: { min: -300, max: TOWN_WIDTH },
        y: -140,
        lifespan: 16000,
        speedX: { min: 25, max: 70 },
        speedY: { min: 28, max: 60 },
        accelerationX: { min: -6, max: 6 },
        rotate: { start: 0, end: 720 },
        scale: { min: 0.5, max: 0.9 },
        tint: [0xffd3e6, 0xffffff, 0xffe9a8],
        alpha: fade(0.9),
        frequency: 650,
        maxAliveParticles: motes(22),
      },
      1.0,
      13,
    ),
    addEmitter(
      "fx-leaf",
      {
        x: { min: -400, max: TOWN_WIDTH },
        y: -180,
        lifespan: 13000,
        speedX: { min: 50, max: 110 },
        speedY: { min: 55, max: 95 },
        rotate: { start: 0, end: 900 },
        scale: { min: 0.9, max: 1.5 },
        tint: [0x3f8a3a, 0x6fae3e, 0x2d6b34],
        alpha: fade(0.85),
        frequency: 1500,
        maxAliveParticles: motes(8),
      },
      1.35,
      42,
    ),
    // Smoke from the forge chimney painted in the backdrop.
    addEmitter(
      "fx-dot",
      {
        x: {
          min: TOWN_SPOTS.chimney.x - 12,
          max: TOWN_SPOTS.chimney.x + 12,
        },
        y: TOWN_SPOTS.chimney.y,
        lifespan: 4200,
        speedX: { min: 6, max: 22 },
        speedY: { min: -38, max: -24 },
        scale: { start: 0.35, end: 1.6 },
        tint: 0xdfe4ea,
        alpha: fade(0.38),
        frequency: 280,
        maxAliveParticles: motes(18),
      },
      SCENERY_FACTOR,
      -29,
    ),
  ];

  // Cave ambience.
  const cave = [
    addEmitter(
      "fx-dot",
      {
        x: { min: 0, max: WORLD_W },
        y: { min: 300, max: 620 },
        lifespan: { min: 5000, max: 9000 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -26, max: -10 },
        scale: { min: 0.06, max: 0.16 },
        tint: [0x8ff3ff, 0xc9a6ff, 0x9dffde],
        alpha: fade(0.9),
        blendMode: "ADD",
        frequency: 180,
        maxAliveParticles: motes(50),
      },
      0.9,
      -20,
    ),
    addEmitter(
      "fx-dot",
      {
        x: { min: 0, max: WORLD_W },
        y: { min: -120, max: 500 },
        lifespan: { min: 7000, max: 11000 },
        speedX: { min: -4, max: 4 },
        speedY: { min: 4, max: 14 },
        scale: { min: 0.03, max: 0.07 },
        tint: 0xd8e6ff,
        alpha: fade(0.55),
        frequency: 220,
        maxAliveParticles: motes(36),
      },
      0.7,
      -21,
    ),
    // Mist where the painted waterfall meets the lake.
    addEmitter(
      "fx-dot",
      {
        x: { min: TOWN_SPOTS.portal.x - 110, max: TOWN_SPOTS.portal.x + 110 },
        y: TOWN_SPOTS.portal.y + 90,
        lifespan: 3600,
        speedX: { min: -18, max: 18 },
        speedY: { min: -22, max: -8 },
        scale: { start: 0.5, end: 1.8 },
        tint: 0xcdf6ff,
        alpha: fade(0.3),
        frequency: 160,
        maxAliveParticles: motes(26),
      },
      SCENERY_FACTOR,
      -29,
    ),
    addEmitter(
      "fx-dot",
      {
        x: { min: -200, max: WORLD_W + 200 },
        y: { min: 380, max: 900 },
        lifespan: { min: 4000, max: 7000 },
        speedX: { min: -14, max: 14 },
        speedY: { min: -30, max: -12 },
        scale: { min: 0.18, max: 0.32 },
        tint: [0x7ff0ff, 0xb895ff],
        alpha: fade(0.6),
        blendMode: "ADD",
        frequency: 900,
        maxAliveParticles: motes(8),
      },
      1.3,
      42,
    ),
  ];

  let kind = "town",
    split = SPLIT.town,
    rayTweens = [];

  function placeRays(theme) {
    rayTweens.forEach((t) => t.stop());
    rayTweens = [];
    rays.forEach((r, i) => {
      const x = theme.rays.xs[i];
      r.setVisible(x !== undefined);
      if (x === undefined) return;
      r.setPosition(x, -170)
        .setTint(theme.rays.color)
        .setRotation(theme.rays.angle + (i - 1.5) * 0.05)
        .setDisplaySize(110 + (i % 2) * 70, 900)
        .setAlpha(theme.rays.alpha * 0.6);
      if (!reduced)
        rayTweens.push(
          scene.tweens.add({
            targets: r,
            alpha: theme.rays.alpha,
            rotation: r.rotation + 0.04,
            duration: 3200 + i * 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
          }),
        );
    });
  }

  function setArea(area, tint) {
    kind = area === "town" ? "town" : "cave";
    const theme = THEMES[kind],
      tex = scene.textures.get("cave").getSourceImage(),
      th = tex.height,
      tw = tex.width;
    split = SPLIT[kind];
    const cut = Math.round(th * split),
      isTown = kind === "town";
    kit.forEach((o) => o.setVisible(isTown));
    scenery.setVisible(!isTown);
    floor.setVisible(!isTown);
    // Cave path is painted at pixel y=733. Its top must meet world ground=600,
    // rather than leaving feet ~64px below the stone walkway.
    const backY = kind === "cave" ? -116 : BACK_Y;
    for (const img of [scenery, floor]) {
      img.setTexture("cave").setY(backY).setDisplaySize(WORLD_W, BACK_H);
      img.clearTint();
      if (tint) img.setTint(tint);
    }
    // Painted balconies must share the collision world's scroll factor.
    scenery.setScrollFactor(kind === "town" ? 1 : SCENERY_FACTOR, 1);
    scenery.setCrop(0, 0, tw, cut);
    floor.setCrop(0, cut, tw, th - cut);
    seam.setY(isTown ? TOWN_STREET_Y - 1 : backY + split * BACK_H - 1);
    fgBottom.setTexture(`fg-${kind}-bottom`);
    fgTop.setTexture(`fg-${kind}-top`);
    fog.setTint(theme.fogColor).setAlpha(theme.fogAlpha);
    fogBack.setTint(theme.fogColor).setAlpha(theme.fogAlpha * 0.8);
    grade.setFillStyle(theme.grade, 1);
    grade.setBlendMode(
      kind === "town" ? Phaser.BlendModes.SCREEN : Phaser.BlendModes.MULTIPLY,
    );
    grade.setAlpha(theme.gradeAlpha);
    town.forEach((e) => e.setVisible(kind === "town").stop());
    cave.forEach((e) => e.setVisible(kind === "cave").stop());
    if (!reduced) (kind === "town" ? town : cave).forEach((e) => e.start());
    placeRays(theme);
    resize();
  }

  function resize() {
    const c = cam(),
      w = scene.scale.width,
      h = scene.scale.height,
      z = c.zoom,
      vw = w / z,
      vh = h / z;
    // Align the slower scenery with the floor when the camera is mid-world.
    scenery.x =
      kind === "town"
        ? 0
        : (-(1 - SCENERY_FACTOR) * Math.max(0, WORLD_W - vw)) / 2;
    const top = h / 2 - vh / 2,
      bottom = h / 2 + vh / 2,
      // Keep foreground framing below the walkway the heroes stand on
      // (feet sit ~260 world units under the camera's resting centre).
      room = Phaser.Math.Clamp(
        vh / 2 - (600 - (scene.camY ?? 340)) - 24,
        50,
        220,
      );
    fgBottom.setPosition(w / 2, bottom + 6).setSize(vw + 40, room);
    fgBottom.tilePositionY = 220 - room;
    fgTop.setPosition(w / 2, top - 4).setSize(vw + 40, 200);
    fgTop.setScale(1, lowPower ? 0.6 : 0.85);
    // Keep each far strip where its `top` says while the camera rests at camY;
    // a scroll factor below 1 then moves it less as the camera climbs.
    const restY = (scene.camY ?? 340) - h / 2;
    for (const l of far)
      l.layer
        .setX(w / 2)
        .setSize(vw + 40, l.layer.height)
        .setY(l.top - restY * (1 - l.fy));
    fog.setX(w / 2).setSize(vw + 40, 128);
    fogBack.setX(w / 2).setSize(vw + 40, 128);
    vignette.setPosition(w / 2, h / 2).setDisplaySize(vw + 4, vh + 4);
    grade.setPosition(w / 2, h / 2).setSize(vw + 4, vh + 4);
    grade.setOrigin(0.5);
  }

  function update(time) {
    const c = cam(),
      sx = c.scrollX,
      drift = reduced ? 0 : time * 0.012;
    if (kind === "town" && !reduced)
      for (const a of animated)
        a.img.setFrame(Math.floor((time + a.phase) / 160) % 4);
    fgBottom.tilePositionX = sx * 1.45;
    fgTop.tilePositionX = sx * 1.3 + 300;
    for (const l of far)
      l.layer.tilePositionX =
        (sx * l.fx + (l.drift ? drift * l.drift * 80 : 0)) / l.layer.tileScaleX;
    fog.tilePositionX = sx * 1.12 + drift;
    fogBack.tilePositionX = sx * 0.8 - drift * 0.6;
    if (!reduced) {
      const sway = Math.sin(time / 1700);
      fgTop.y =
        scene.scale.height / 2 - scene.scale.height / c.zoom / 2 - 4 + sway * 3;
      fog.alpha = THEMES[kind].fogAlpha * (0.85 + 0.15 * Math.sin(time / 2300));
    }
  }

  // Night: foreground layers in front of the night shade darken with it.
  let lastDark = -1;
  function setDark(k) {
    if (Math.abs(k - lastDark) < 0.01) return;
    lastDark = k;
    const c = skyColor(k);
    fgBottom.setTint(c);
    fgTop.setTint(c);
    props.forEach((img, i) => TOWN_PROPS[i].front && img.setTint(c));
  }
  return { setArea, resize, update, setDark };
}
