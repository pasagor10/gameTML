// Town day/night: a multiply shade over the world (heroes included, names
// stay readable above it), warm lamp and torch glows that bloom after dark,
// and the mysterious cave mouth that rises under the great tree at night.
import { WORLD } from "/shared/config.js";
import { TOWN_PROPS, TOWN_SPOTS, TOWN_BASE, TOWN_LAYOUT } from "/shared/town-layout.js";
import { SLOT_MACHINE } from "/shared/slots.js";
import { NIGHT_CAVE } from "/shared/night.js";

const DUSK = [0xe3, 0x9a, 0x7a],
  NIGHT = [0x83, 0x93, 0xbd];
const lerp = (a, b, k) => Math.round(a + (b - a) * k);
// White at noon, warm at dusk, readable moonlit blue at midnight.
export function skyColor(dark) {
  const [from, to, k] =
    dark < 0.5 ? [[255, 255, 255], DUSK, dark * 2] : [DUSK, NIGHT, (dark - 0.5) * 2];
  return (lerp(from[0], to[0], k) << 16) | (lerp(from[1], to[1], k) << 8) | lerp(from[2], to[2], k);
}

export function createNightSky(scene, openCave) {
  const ADD = Phaser.BlendModes.ADD;
  const shade = scene.add
    .rectangle(0, 0, 8000, 8000, 0xffffff, 1)
    .setScrollFactor(0)
    .setDepth(13)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setVisible(false);
  const glow = (x, y, w, h, tint) =>
    scene.add
      .image(x, y, "fx-dot")
      .setDisplaySize(w, h)
      .setTint(tint)
      .setDepth(13.5)
      .setBlendMode(ADD)
      .setAlpha(0);
  // Lamps, brazier, forge and the slot cabinet light the street at night.
  const LIT = {
    "prop-px-1": [0, -78], // street lamp
    "prop-px-21": [16, -50], // paper lantern post
  };
  const lights = [
    ...TOWN_PROPS.filter((p) => LIT[p.key]).map((p) =>
      glow(p.x + LIT[p.key][0], (p.y ?? WORLD.ground) + LIT[p.key][1], 380, 340, 0xffc477),
    ),
    // Broad, low pools overlap along the pavement without washing out the sky.
    ...TOWN_PROPS.filter((p) => LIT[p.key]).map((p) =>
      glow(p.x, WORLD.ground + 12, 400, 115, 0xffc477).setData("strength", 0.18),
    ),
    // Warm light from inhabited buildings makes the street feel welcoming.
    ...TOWN_LAYOUT.filter((p) => /house|potion|weapon|cottage|smithy|stall/.test(p.piece)).map((p) =>
      glow(p.x + ({ house0: 80, house3: 160, house4: 90, stall: 170,
        potion: 180, weapon: 170, cottage: 150, smithy: 180 }[p.piece] || 100),
        TOWN_BASE - 85, 260, 230, 0xffcf85).setData("strength", 0.22),
    ),
    glow(TOWN_SPOTS.forgeFire.x, TOWN_SPOTS.forgeFire.y, 340, 280, 0xff7a36),
    glow(SLOT_MACHINE.x, WORLD.ground - 90, 260, 260, 0xffd27a),
    glow(WORLD.portal, WORLD.portalY + 120, 420, 360, 0x8fdcff),
  ].map((img, i) => ({ img, phase: i * 1.3 }));
  const torch = glow(0, 0, 520, 420, 0xffe5bb);

  // The cave: the town gate art, smaller and drenched in violet.
  const cx = NIGHT_CAVE.x;
  const cave = scene.textures.exists("town-piece-cavegate")
    ? scene.add
        .image(cx, TOWN_BASE + 6, "town-piece-cavegate")
        .setOrigin(0.5, 1)
        .setScale(0.46)
        .setTint(0x7656e0)
        .setDepth(-27)
        .setAlpha(0)
    : null;
  // A glowing copy above the night shade so the arch reads in the dark,
  // additive so heroes in front still show through.
  const rim = cave
    ? scene.add
        .image(cx, TOWN_BASE + 6, "town-piece-cavegate")
        .setOrigin(0.5, 1)
        .setScale(0.46)
        .setTint(0x7a52ff)
        .setDepth(13.55)
        .setBlendMode(ADD)
        .setAlpha(0)
    : null;
  const mouth = scene.add
    .image(cx, TOWN_BASE - 70, "fx-dot")
    .setDisplaySize(170, 150)
    .setTint(0x9b6bff)
    .setDepth(13.6)
    .setBlendMode(ADD)
    .setAlpha(0);
  const motes = Array.from({ length: 10 }, (_, i) => ({
    img: scene.add
      .image(cx, TOWN_BASE - 60, "fx-dot")
      .setDisplaySize(14, 14)
      .setTint(i % 2 ? 0xc6a8ff : 0x7fe0ff)
      .setDepth(13.7)
      .setBlendMode(ADD)
      .setAlpha(0),
    phase: i * 0.63,
  }));
  const label = scene.add
    .text(cx, TOWN_BASE - 300, "", {
      fontFamily: "Noto Sans Thai",
      fontSize: "15px",
      fontStyle: "bold",
      align: "center",
      color: "#e6d6ff",
      stroke: "#1a0f33",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(14)
    .setAlpha(0);
  const zone = scene.hotspot(cx, WORLD.ground, 190, 260, openCave);
  scene.hotspots.push(zone);

  let lastNight = null;
  return {
    update(state, time, onNightfall) {
      const town = state?.area === "town",
        sky = state?.sky;
      const dark = town && sky ? sky.dark : 0;
      shade.setVisible(dark > 0.01);
      if (dark > 0.01) shade.setFillStyle(skyColor(dark), 1);
      const flicker = (p) => 0.88 + Math.sin(time * 0.004 + p) * 0.08 + Math.sin(time * 0.011 + p) * 0.04;
      for (const l of lights) l.img.setAlpha(dark * (l.img.getData("strength") ?? 0.46) * flicker(l.phase));
      const me = state?.self;
      const hero = me && scene.actors?.get(me.id)?.image;
      if (town && (hero || me)) torch.setPosition(hero?.x ?? me.x, (hero?.y ?? me.y) - 70);
      torch.setAlpha(dark * 0.3);

      // The cave rises with dusk and is open only at night.
      const open = town && sky?.night,
        show = town && sky ? (open ? 1 : Math.max(0, dark - 0.4) * 0.6) : 0;
      cave?.setAlpha(show);
      rim?.setAlpha(show * (0.42 + Math.sin(time * 0.002) * 0.08));
      mouth.setAlpha(show * (0.55 + Math.sin(time * 0.003) * 0.2));
      motes.forEach((m, i) => {
        const a = time * 0.0012 + m.phase;
        m.img
          .setPosition(cx + Math.cos(a) * (40 + i * 4), TOWN_BASE - 80 + Math.sin(a * 1.7) * 45 - ((time * 0.02 + i * 30) % 120))
          .setAlpha(show * 0.8);
      });
      label.setAlpha(open ? 1 : 0);
      if (open) {
        const left = Math.max(0, Math.ceil((sky.changeAt - state.time) / 60));
        label.setText(`ถ้ำลึกลับ\nปิดเมื่อรุ่งสางใน ${left} นาที`);
      }
      zone.input.enabled = !!open;

      if (town && sky && lastNight === false && sky.night) onNightfall?.();
      if (sky) lastNight = sky.night;
    },
  };
}
