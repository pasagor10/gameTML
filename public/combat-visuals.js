import { heroPose, slimePose, HERO_ROWS, SLIME_ROWS } from "/shared/motion.js";
export function registerMotionAtlas(scene, key, rows) {
  if (!scene.textures.exists(key)) return false;
  const texture = scene.textures.get(key),
    source = texture.getSourceImage();
  if (!source?.width || source.width < 4) return false;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < 4; col++) {
      const x = Math.round((col * source.width) / 4),
        y = Math.round((row * source.height) / rows);
      texture.add(
        row * 4 + col,
        0,
        x,
        y,
        Math.round(((col + 1) * source.width) / 4) - x,
        Math.round(((row + 1) * source.height) / rows) - y,
      );
    }
  return true;
}
export function animateHero(image, p, time, hasAtlas) {
  const pose = heroPose(p, time),
    animated = hasAtlas && p.class === "swordsman" && p.gender === "female";
  if (animated) {
    const nextFrame = HERO_ROWS[pose.state] * 4 + pose.frame;
    if (
      image.texture.key !== "knight-motion" ||
      Number(image.frame.name) !== nextFrame
    ) {
      image.setTexture("knight-motion", nextFrame);
      image.setOrigin(0.5, 0.96).setDisplaySize(154, 154);
    }
    image.setAngle(0);
  } else {
    image.setAngle(
      p.hp <= 0
        ? -80
        : pose.state === "attack"
          ? p.direction * 8
          : pose.state === "skill"
            ? -p.direction * 5
            : p.moving
              ? Math.sin(time * 11) * 2
              : 0,
    );
  }
  const hurt = time - (p.hitAt || 0);
  image.setTint(hurt >= 0 && hurt < 0.08 ? 0xffb9a7 : 0xffffff);
  image
    .setAlpha(p.hp <= 0 ? 0.75 : 1)
    .setFlipX(
      (p.action && time < p.action.endsAt ? p.action.direction : p.direction) <
        0,
    );
  return pose;
}
export function animateSlime(image, e, time, hasAtlas, size) {
  const pose = slimePose(e, time);
  if (hasAtlas && e.type === "slime") {
    const nextFrame = SLIME_ROWS[pose.state] * 4 + pose.frame;
    if (
      image.texture.key !== "slime-motion" ||
      Number(image.frame.name) !== nextFrame
    ) {
      image
        .setTexture("slime-motion", nextFrame)
        .setDisplaySize(size, size)
        .setOrigin(0.5, 0.94);
    }
  }
  image
    .setTint(time - (e.hitAt || 0) < 0.08 ? 0xffc6cf : 0xffffff)
    .setFlipX(
      hasAtlas && e.type === "slime" ? e.direction < 0 : e.direction > 0,
    );
  return pose;
}
export function monsterDeath(scene, m, hasAtlas) {
  const image = m.image;
  if (hasAtlas && m.target.type === "slime") {
    image.setTexture("slime-motion", SLIME_ROWS.death * 4);
    scene.time.addEvent({
      delay: 140,
      repeat: 2,
      callback: () => {
        if (image.active)
          image.setFrame(
            Math.min(SLIME_ROWS.death * 4 + 3, Number(image.frame.name) + 1),
          );
      },
    });
    scene.tweens.add({
      targets: image,
      alpha: 0,
      delay: 430,
      duration: 240,
      onComplete: () => image.destroy(),
    });
  } else
    scene.tweens.add({
      targets: image,
      angle: -75,
      alpha: 0,
      y: image.y + 16,
      duration: 450,
      onComplete: () => image.destroy(),
    });
}
