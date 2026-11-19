import { playNpcSet } from "/sprite-sets.js?v=0.22.1";

// Role-specific townsfolk. Painted idle/talk sets (assets/sprites/npcs) are
// used once loaded; until then, and if a set is missing, the procedural rig
// below draws the NPC with limbs and tools articulated around local pivots.
// Soft additive light under a character's feet (cfx-glow is combat-fx's
// radial texture). Returns null before that texture exists.
export function footGlow(scene, x, y, alpha = 0.32) {
  if (!scene.textures.exists("cfx-glow")) return null;
  return scene.add
    .image(x, y, "cfx-glow")
    .setDisplaySize(96, 24)
    .setTint(0xffe2a0)
    .setAlpha(alpha)
    .setBlendMode(Phaser.BlendModes.ADD);
}

// Thin dark rim so characters and stalls read against the painted town:
// four solid-dark copies of the sprite nudged 1-2 px each way, drawn behind
// it. They batch with the sprite itself; a preFX glow per hero ran a shader
// pass over the full-size animation frame every frame and got slow with
// several players. `parent` is a container to add into (or null).
const RIM_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
export function createRim(scene, parent, depth, px = 1.6) {
  const parts = RIM_OFFSETS.map(() => {
    const r = scene.add.image(0, 0, "__WHITE").setTintFill(0x0d1a22);
    if (depth !== undefined) r.setDepth(depth);
    return r;
  });
  if (parent) parent.add(parts);
  return {
    parts,
    // Copy the sprite's current frame and transform onto the rim copies.
    sync(img) {
      for (let k = 0; k < 4; k++) {
        const r = parts[k];
        if (r.texture !== img.texture || r.frame.name !== img.frame.name)
          r.setTexture(img.texture.key, img.frame.name);
        r.setOrigin(img.originX, img.originY)
          .setScale(img.scaleX, img.scaleY)
          .setFlip(img.flipX, img.flipY)
          .setAngle(img.angle)
          .setPosition(
            img.x + RIM_OFFSETS[k][0] * px,
            img.y + RIM_OFFSETS[k][1] * px,
          )
          .setAlpha(img.alpha * 0.55)
          // The Low graphics preset draws characters without the outline.
          .setVisible(img.visible && scene.quality?.rim !== false);
      }
      return this;
    },
    setVisible(v) {
      parts.forEach((r) => r.setVisible(v));
      return this;
    },
    destroy() {
      parts.forEach((r) => r.destroy());
    },
  };
}

export function createTownNpcs(scene, definitions, sprites) {
  const objects = [],
    rigs = [];
  const palettes = {
    elder: [0x345f68, 0xa8c2b2, 0xe3d3b0],
    potion: [0x477867, 0xc1d6ac, 0x563c34],
    weapon: [0x334c65, 0xb9c6ce, 0x30323c],
    forge: [0x76482f, 0xc39259, 0x49352d],
  };
  for (const n of definitions) {
    const root = scene.add.container(n.x, n.y ?? 600).setDepth(7);
    const g = scene.add.graphics(),
      image = scene.add.image(0, 0, "__WHITE").setVisible(false),
      // Warm pool of light at the feet, and a dark rim so the painted NPC
      // stands off the equally painted shop fronts behind it.
      footLight = footGlow(scene, 0, 0, 0.3);
    if (footLight) root.add(footLight);
    root.add(g);
    const rim = createRim(scene, root);
    root.add(image);
    sprites?.want("npcs", n.id);
    const label = scene.add
      .text(n.x, (n.y ?? 600) - 146, `${n.name}\n${n.role}`, {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffe6ac",
        align: "center",
        lineSpacing: -2,
        stroke: "#10202a",
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true, stroke: true },
      })
      .setOrigin(0.5, 0)
      .setDepth(15);
    objects.push(root, label);
    rigs.push({ n, g, image, rim });
  }
  function draw({ n, g }, time) {
    const t = time / 1000,
      forge = n.id === "forge",
      elder = n.id === "elder";
    const [cloth, trim, hair] = palettes[n.id];
    const cycle = (t * 0.72) % 1;
    const strike = cycle > 0.42 && cycle < 0.53;
    const breath = Math.sin(t * 2.1 + n.x) * 1.2;
    g.clear();
    const ellipse = (x, y, w, h, c, a = 1) => {
      g.fillStyle(c, a);
      g.fillEllipse(x, y, w, h);
      if (a === 1 && w > 6) {
        g.lineStyle(1, 0x352d2b, 0.45);
        g.strokeEllipse(x, y, w, h);
      }
    };
    const rect = (x, y, w, h, c, r = 3) => {
      g.fillStyle(c);
      g.fillRoundedRect(x, y, w, h, r);
      g.lineStyle(1, 0x352d2b, 0.45);
      g.strokeRoundedRect(x, y, w, h, r);
    };
    const line = (x, y, xx, yy, color, width = 3) => {
      g.lineStyle(width, color, 1);
      g.lineBetween(x, y, xx, yy);
    };
    const poly = (points, color) => {
      g.fillStyle(color);
      const vertices = points.map(([x, y]) => ({ x, y }));
      g.fillPoints(vertices, true);
      g.lineStyle(1.5, 0x352d2b, 0.65);
      g.strokePoints(vertices, true);
    };
    ellipse(0, -1, 78, 12, 0x142c30, 0.3);
    // Boots, layered robe, hems and a contrasting sash.
    rect(-20, -16, 17, 16, 0x342d29);
    rect(6, -16, 18, 16, 0x342d29);
    poly(
      [
        [-21, -65],
        [19, -65],
        [27, -15],
        [3, -10],
        [-28, -16],
      ],
      cloth,
    );
    poly(
      [
        [-19, -60],
        [-6, -57],
        [-9, -17],
        [-23, -21],
      ],
      trim,
    );
    line(4, -53, 12, -17, 0x263b3b, 2);
    rect(-20, -67, 42, 8, 0xc8a45c);
    rect(-5, -68, 9, 11, 0xebcd82);
    ellipse(0, -87 + breath, 48, 49, hair);
    ellipse(0, -83 + breath, 36, 36, 0xe9bc8b);
    ellipse(-17, -83 + breath, 7, 10, 0xdca477);
    ellipse(17, -83 + breath, 7, 10, 0xdca477);
    poly(
      [
        [-23, -95 + breath],
        [-15, -109 + breath],
        [12, -110 + breath],
        [24, -94 + breath],
        [8, -99 + breath],
        [-3, -92 + breath],
        [-8, -99 + breath],
      ],
      hair,
    );
    // Blink briefly, with a stable readable face between cycles.
    const blink = (t + n.x / 50) % 4.6 > 4.44;
    line(-11, -86 + breath, -5, -87 + breath, 0x493a30, 2);
    line(5, -87 + breath, 11, -86 + breath, 0x493a30, 2);
    ellipse(-8, -82 + breath, 4, blink ? 1 : 5, 0x28343a);
    ellipse(8, -82 + breath, 4, blink ? 1 : 5, 0x28343a);
    line(-3, -73 + breath, 4, -73 + breath, 0xa66c51, 1.5);
    if (elder) {
      // Silver beard, scholar's cap, scroll and walking staff.
      poly(
        [
          [-13, -75],
          [0, -77],
          [14, -75],
          [7, -54],
          [0, -47],
          [-8, -57],
        ],
        0xe4dfc7,
      );
      rect(-22, -111 + breath, 44, 13, 0x284e57);
      rect(-16, -119 + breath, 32, 12, 0x345f68);
      rect(-3, -112 + breath, 6, 10, 0xd7b36c);
      line(23, -65, 34, -51 + Math.sin(t) * 2, cloth, 13);
      line(36, -83, 36, -3, 0x805e39, 5);
      ellipse(36, -85, 10, 10, 0xdfbc6b);
      line(-22, -65, -33, -45, cloth, 13);
      ellipse(-33, -43, 12, 12, 0xe9bc8b);
      rect(-43, -55, 22, 28, 0xe4cf94);
      line(-38, -48, -27, -48, 0x8e7853, 1);
      line(-38, -42, -29, -42, 0x8e7853, 1);
    } else if (forge) {
      // Leather apron, exposed forearms, hammer striking the hot blade.
      poly(
        [
          [-14, -70],
          [13, -70],
          [22, -22],
          [-20, -22],
        ],
        0x553c2c,
      );
      line(-12, -65, 12, -65, 0xb18b58, 2);
      rect(-9, -51, 19, 15, 0x77543a);
      poly(
        [
          [-12, -74],
          [-2, -69],
          [13, -74],
          [10, -63],
          [-7, -62],
        ],
        hair,
      );
      rect(-19, -106 + breath, 38, 8, 0x9e553c); // smith's headband
      line(-22, -65, -29, -42, 0xd7a477, 13);
      line(-29, -42, 11, -38, 0xe9bc8b, 9);
      line(-7, -36, 49, -36, 0x8c9396, 4); // tongs
      // Hammer arm swings from shoulder rather than moving the entire NPC.
      const lift =
        cycle < 0.42
          ? cycle / 0.42
          : cycle < 0.55
            ? 1 - (cycle - 0.42) / 0.13
            : 0;
      const hx = 39 - lift * 23,
        hy = -55 - lift * 55;
      line(21, -65, 29, -77 - lift * 15, 0xd7a477, 14);
      line(29, -77 - lift * 15, hx, hy, 0xe9bc8b, 10);
      line(hx, hy, hx + 9, hy + 24, 0x7e532f, 6);
      rect(hx - 6, hy + 17, 30, 14, 0x35414b);
      rect(hx - 5, hy + 18, 8, 11, 0xa7b5b8);
      // Heavy anvil and its timber block, offset to leave the face visible.
      rect(29, -23, 52, 23, 0x593e2e);
      line(39, -21, 36, -2, 0x956b43, 2);
      poly(
        [
          [18, -43],
          [83, -43],
          [92, -48],
          [86, -34],
          [67, -30],
          [65, -22],
          [43, -22],
          [46, -32],
          [24, -34],
        ],
        0x455966,
      );
      line(20, -44, 82, -44, 0xb8c7c8, 3);
      line(37, -48, 74, -48, strike ? 0xffee9d : 0xff9550, 5);
      if (strike) {
        ellipse(53, -49, 43, 25, 0xffc05d, 0.22);
        for (let k = 0; k < 7; k++) {
          const angle = -Math.PI * 0.95 + k * 0.45,
            distance = 12 + (cycle - 0.42) * 210;
          const x = 54 + Math.cos(angle) * distance,
            y = -49 + Math.sin(angle) * distance;
          line(
            x,
            y,
            x + Math.cos(angle) * 6,
            y + Math.sin(angle) * 6,
            0xffda78,
            2,
          );
        }
      }
    } else if (n.id === "potion") {
      // Herbalist with tied hair, a mortar and a moving pestle.
      ellipse(-23, -94 + breath, 19, 25, hair);
      ellipse(24, -94 + breath, 19, 25, hair);
      line(-20, -98 + breath, -24, -98 + breath, 0xe9ca6e, 4);
      poly(
        [
          [-12, -67],
          [12, -67],
          [17, -23],
          [-17, -23],
        ],
        0xddd5ae,
      );
      const hand = Math.sin(t * 3.5) * 4;
      line(-22, -65, -28, -42, cloth, 13);
      line(-28, -42, -4, -39, 0xe9bc8b, 9);
      line(22, -65, 30, -53 + hand, cloth, 12);
      line(30, -53 + hand, 9, -47 + hand, 0xe9bc8b, 9);
      line(14, -58 + hand, 4, -32 + hand, 0x9c8d65, 6);
      ellipse(0, -33, 31, 21, 0x657977);
      ellipse(0, -39, 32, 10, 0x9ead9c);
      ellipse(0, -39, 23, 5, 0x719254);
      rect(33, -21, 32, 21, 0x705035);
      rect(39, -37, 12, 16, 0x629da1);
      rect(42, -42, 6, 7, 0xdbb56c);
      ellipse(45, -30, 8, 9, 0x8ce3bd);
      for (let k = 0; k < 3; k++)
        ellipse(
          3 + Math.sin(t + k) * 6,
          -50 - ((t * 10 + k * 9) % 25),
          3,
          5,
          0xc7edbb,
          0.35,
        );
    } else {
      // Armorer in a blue coat, polishing a sword at a weapon rack.
      rect(-21, -71, 42, 12, 0x758a94);
      line(-14, -64, 13, -25, 0xbea775, 5);
      const polish = Math.sin(t * 3) * 8;
      line(-22, -63, -28, -42, cloth, 14);
      line(-28, -42, 7, -40, 0xe9bc8b, 9);
      line(21, -65, 29, -48, cloth, 13);
      line(29, -48, 9 + polish, -49, 0xe9bc8b, 9);
      poly(
        [
          [1, -30],
          [7, -29],
          [16, -85],
          [11, -94],
          [7, -84],
        ],
        0xc5d8db,
      );
      line(10, -83, 4, -38, 0xf1f6df, 2);
      line(-4, -33, 15, -30, 0xdaba71, 4);
      rect(8 + polish, -52, 12, 8, 0xe4c994);
      line(45, -75, 45, -2, 0x765234, 5);
      line(69, -75, 69, -2, 0x765234, 5);
      line(42, -62, 73, -62, 0xb38952, 5);
      for (const x of [49, 61]) {
        line(x, -70, x, -17, 0xb8c9ce, 4);
        line(x - 5, -55, x + 5, -55, 0xd4b56d, 3);
      }
    }
  }
  return {
    objects,
    // self: the local player; an NPC talks (and turns) while they're close.
    update(time, visible, reducedMotion, self) {
      if (!visible) return;
      for (const rig of rigs) {
        const set = sprites?.npcs.get(rig.n.id);
        if (!set) {
          // A painted set is on its way: show only the shadow meanwhile, so
          // the procedural rig doesn't flash in and swap out.
          if (scene.spriteSetIndex?.npcs?.[rig.n.id])
            rig.g.clear().fillStyle(0x142c30, 0.3).fillEllipse(0, -1, 70, 12);
          else draw(rig, reducedMotion ? 0 : time);
          continue;
        }
        const { n, g, image } = rig,
          near =
            self &&
            Math.abs(n.x - self.x) < 105 &&
            Math.abs((n.y ?? 600) - self.y) < 90;
        if (!image.visible) {
          g.clear().fillStyle(0x142c30, 0.3).fillEllipse(0, -1, 70, 12);
          image.setVisible(true);
        }
        playNpcSet(image, set, near, reducedMotion ? 0 : time / 1000);
        image.setFlipX(
          near ? self.x < n.x - 12 === set.facing > 0 : set.facing < 0,
        );
        rig.rim.sync(image);
      }
    },
  };
}
