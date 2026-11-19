import { WORLD } from "/shared/config.js";
import { dungeonPlatforms } from "/shared/dungeons.js";
import { TOWN_PROPS, TOWN_SPOTS } from "/shared/town-layout.js";
// Playable edges stay in world space. Decorative motion never moves collision art.
export function createWorldDetails(scene) {
  const edges = scene.add.graphics().setDepth(5);
  // Warm glow around the lamp props (light centre relative to the prop).
  const LIGHT = {
    "prop-px-1": [0, -78], // street lamp
    "prop-px-21": [16, -50], // paper lantern post
  };
  const lamps = TOWN_PROPS.filter((p) => LIGHT[p.key])
    .map((p) => [
      p.x + LIGHT[p.key][0],
      (p.y ?? WORLD.ground) + LIGHT[p.key][1],
    ])
    .map(([x, y], i) => {
      const glow = scene.add
        .image(x, y, "fx-dot")
        .setDisplaySize(65, 75)
        .setTint(0xffbc54)
        .setDepth(-19)
        .setBlendMode(Phaser.BlendModes.ADD);
      return { glow, phase: i * 1.7 };
    });
  const forge = TOWN_SPOTS.forgeFire,
    fire = scene.add
      .image(forge.x, forge.y, "fx-dot")
      .setDisplaySize(110, 100)
      .setTint(0xff813b)
      .setDepth(-19)
      .setBlendMode(Phaser.BlendModes.ADD);
  const streams = []; // the kit town has no painted waterfall in front
  // Distant mist drifts slower than the architecture, without shifting ledges.
  const clouds = [
    [480, -25],
    [1180, 65],
    [1950, -45],
  ].map(([x, y]) =>
    scene.add
      .image(x, y, "fx-fog")
      .setDisplaySize(650, 80)
      .setTint(0xc6edf6)
      .setAlpha(0.12)
      .setScrollFactor(0.55, 1)
      .setDepth(-26),
  );
  const landing = scene.add.graphics().setDepth(6);
  return {
    update(time, state, full, reduced) {
      const town = state.area === "town",
        p = state.self;
      clouds.forEach((cloud, i) => {
        cloud.setVisible(town);
        if (!reduced)
          cloud.x = [480, 1180, 1950][i] + Math.sin(time * 0.00008 + i) * 65;
      });
      for (const { glow, phase } of lamps)
        glow
          .setVisible(town)
          .setAlpha(
            reduced ? 0.26 : 0.24 + Math.sin(time * 0.002 + phase) * 0.07,
          );
      fire
        .setVisible(town)
        .setAlpha(
          reduced
            ? 0.3
            : 0.28 +
                Math.sin(time * 0.012) * 0.09 +
                Math.sin(time * 0.023) * 0.04,
        );
      streams.forEach((stream, i) => {
        stream.setVisible(town);
        if (!reduced) stream.tilePositionY = -time * (0.025 + i * 0.008);
      });
      edges.clear();
      landing.clear();
      // Same ledges the server collides with: each floor/stage has its own.
      const d = state.dungeon,
        platforms = town
          ? WORLD.platforms
          : dungeonPlatforms(d?.floor, d?.stage, d?.training);
      // Ledge lines and the landing ring are a debug aid (walkability toggle) only.
      if (full) for (const q of [
        ...platforms,
        { x: 0, y: WORLD.ground, w: town ? WORLD.townWidth : WORLD.width },
      ]) {
        const near =
          p.x > q.x - 100 && p.x < q.x + q.w + 100 && Math.abs(p.y - q.y) < 190;
        edges.lineStyle(
          full ? 3 : near ? 2 : 1.5,
          near ? 0xa2fff0 : 0xf3d59a,
          full ? 0.9 : near ? 0.65 : 0.3,
        );
        edges.lineBetween(q.x, q.y, q.x + q.w, q.y);
        for (const x of [q.x, q.x + q.w]) {
          edges.lineBetween(x, q.y - 4, x, q.y + 5);
          if (full) {
            edges.fillStyle(0xa2fff0, 0.8);
            edges.fillCircle(x, q.y, 3);
          }
        }
        if (full)
          for (let x = q.x + 12; x < q.x + q.w; x += 28)
            edges.lineBetween(x, q.y + 4, x + 7, q.y + 4);
      }
      // The projected landing ring follows the real one-way collision rules.
      if (full) {
        const surface = platforms
          .filter((q) => p.x >= q.x && p.x <= q.x + q.w && q.y >= p.y - 2)
          .reduce((y, q) => Math.min(y, q.y), WORLD.ground);
        const width = 30 + (reduced ? 0 : Math.sin(time * 0.005) * 3);
        landing.lineStyle(1.5, 0xa3fff2, 0.75);
        landing.strokeEllipse(p.x, surface - 1, width, 9);
        if (!p.grounded) {
          landing.lineStyle(1, 0xa3fff2, 0.18);
          landing.lineBetween(p.x, p.y, p.x, surface);
        }
      }
    },
  };
}
