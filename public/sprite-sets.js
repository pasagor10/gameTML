// Loads animated sprite sets exported by Agent Sprite Forge (animation.json
// 2.0/3.0 with a PNG atlas fallback) and plays them on hero images.
//
// public/assets/sprites/index.json lists the sets:
//   { "sets": { "archer-male": {
//       "dir": "archer-male",          // folder under /assets/sprites/
//       "height": 118,                 // on-screen body height in world px
//       "facing": 1,                   // 1 = art faces right, -1 = left
//       "actions": { "idle": "idle", "walk": "walk", "run": "run",
//                    "jump": "jump", "attack": "attack", "skill": "attack",
//                    "hit": "hurt", "death": "hurt" } } } }
// Each action folder holds the exporter's animation.json and atlas pages.
// Missing game states fall back to idle.
//
// "npcs" lists town NPC sets by id (elder, potion, …): idle and talk.
// "monsters" lists enemy sets by type ("bat", "golem", …) with the slime row
// states: idle, move, attack, hit, death, spawn.

const ROOT = "/assets/sprites/";
const clipKey = (set, folder) => `sprite:${set.dir}:${folder}`;
const GROUPS = ["sets", "monsters", "npcs"];
const MONSTER_STATES = ["idle", "move", "attack", "hit", "death", "spawn"];
const NPC_STATES = ["idle", "talk"];
// On-screen size per group, on top of index.json's height: heroes and
// townsfolk read smaller against the painted town. NPC sheets are authored a
// little smaller than heroes, so they scale less to stand eye to eye.
const GROUP_SCALE = { sets: 0.86, npcs: 0.9, monsters: 1, layers: 0.86 };
const STATES = [
  "idle",
  "walk",
  "run",
  "jump",
  "attack",
  "skill",
  "hit",
  "death",
];

// Preload only the index. Sets are fetched on demand (createSpriteRegistry's
// want()), so startup doesn't wait for every hero and monster atlas.
export function queueSpriteSets(scene) {
  scene.spriteSetIndex = null;
  scene.load.on("filecomplete-json-sprite-index", (key, type, data) => {
    scene.spriteSetIndex = data;
  });
  // A set's animation.json queues its atlas pages on the same loader run.
  scene.load.on("filecomplete", (key, type, data) => {
    if (type !== "json" || !key.startsWith("sprite:")) return;
    const [, dir, folder] = key.split(":");
    for (const page of data?.fallback?.pages || [])
      scene.load.image(
        `${key}:${page.file}`,
        `${ROOT}${dir}/${folder}/${page.file}${stamp(scene)}`,
      );
  });
  // The index is tiny; always fetch it fresh. Its "version" busts the cache
  // of every animation.json and atlas, whose file names don't change.
  scene.load.json("sprite-index", `${ROOT}index.json?t=${Date.now()}`);
}

function stamp(scene) {
  const v = (scene.spriteSetIndex || scene.cache.json.get("sprite-index"))
    ?.version;
  return v ? `?v=${v}` : "";
}

function clipFrom(scene, key, manifest) {
  const fb = manifest?.fallback;
  if (!fb?.pages?.length) return null;
  const [cw, ch] = fb.cellSize,
    frames = [];
  for (const page of [...fb.pages].sort(
    (a, b) => a.firstFrame - b.firstFrame,
  )) {
    const texKey = `${key}:${page.file}`;
    if (!scene.textures.exists(texKey)) return null;
    const tex = scene.textures.get(texKey);
    // Pixel-art sets keep hard pixel edges when scaled up.
    if (manifest.sampling === "nearest") tex.setFilter(1);
    for (let k = 0; k < page.frameCount; k++) {
      const name = `f${page.firstFrame + k}`,
        col = k % page.columns,
        row = Math.floor(k / page.columns);
      if (!tex.has(name)) tex.add(name, 0, col * cw, row * ch, cw, ch);
      frames.push({ key: texKey, frame: name });
    }
  }
  const n = frames.length,
    durations =
      manifest.durationsMs?.length === n
        ? manifest.durationsMs
        : Array(n).fill(
            Math.round((manifest.durationSeconds * 1000) / n) || 83,
          ),
    total = durations.reduce((a, b) => a + b, 0),
    // Atlas cells hold encoded frames; map the root into cell pixels.
    [sw, sh] = manifest.sourceSize || [cw, ch],
    anchor =
      manifest.encodedAnchor ||
      (manifest.sourceAnchor
        ? [
            (manifest.sourceAnchor[0] * cw) / sw,
            (manifest.sourceAnchor[1] * ch) / sh,
          ]
        : [cw / 2, ch]),
    bodyPx = manifest.bodyHeightPx
      ? (manifest.bodyHeightPx * ch) / sh
      : ch * 0.85,
    hit = (manifest.events || manifest.hitEvents || []).find(
      (e) => e.name === "hit" || e.name === "impact",
    );
  return {
    frames,
    durations,
    total,
    loop: manifest.loop !== false,
    origin: [anchor[0] / cw, anchor[1] / ch],
    bodyPx,
    hitMs: hit?.atMs ?? manifest.impactMs ?? null,
    // Per-frame attachment points, e.g. hand: [[x, y, degrees], …] in cell px.
    sockets: manifest.sockets || null,
  };
}

// On-demand registry. heroes: Map("class-gender" → set); monsters: Map(type → set).
// want(group, name) starts loading a set; it appears in the map when ready,
// and callers fall back to static art + procedural motion until then.
// Layered hero sets ("layers" in index.json) load their bare body as the set
// and each gear look on demand through layer(): see playLayers().
export function createSpriteRegistry(scene) {
  const maps = { sets: new Map(), monsters: new Map(), npcs: new Map(), layers: new Map() },
    requested = new Map(), // id → { group, name, set }
    queuedClips = new Set(),
    finished = new Set(),
    index = () => scene.spriteSetIndex || scene.cache.json.get("sprite-index");
  const tryBuild = () => {
    for (const [id, r] of requested) {
      if (finished.has(id)) continue;
      const built = buildSet(scene, r.group, r.name, r.set);
      if (built) maps[r.group].set(r.name, built);
      finished.add(id);
    }
  };
  // Queue every action's animation.json for a set (or one layer look).
  const request = (group, name, set) => {
    const id = `${group}|${name}`;
    if (requested.has(id) || !set) return;
    requested.set(id, { group, name, set });
    let enqueued = false;
    for (const folder of Object.values(set.actions || {})) {
      const key = clipKey(set, folder);
      if (queuedClips.has(key) || scene.cache.json.exists(key)) continue;
      queuedClips.add(key);
      enqueued = true;
      scene.load.json(key, `${ROOT}${set.dir}/${folder}/animation.json${stamp(scene)}`);
    }
    if (!scene.load.isLoading()) {
      if (enqueued) scene.load.start();
      else tryBuild();
    }
  };
  scene.load.on("complete", tryBuild);
  return {
    heroes: maps.sets,
    monsters: maps.monsters,
    npcs: maps.npcs,
    wantHero(skins) {
      for (const name of skins) {
        if (!index()?.sets?.[name]) continue;
        if (finished.has(`sets|${name}`) && !maps.sets.has(name)) continue;
        this.want("sets", name);
        return;
      }
    },
    want(group, name) {
      const set = index()?.[group]?.[name];
      if (!set) return;
      // A layered set's own clips are its bare body.
      request(group, name, set.layers ? { ...set, dir: `${set.dir}/body` } : set);
    },
    // Clips of one layer folder under a layered set (e.g. "outfit/robe-3/main"
    // or "hand"), or null while it loads.
    layer(setName, path) {
      const set = index()?.sets?.[setName],
        name = `${setName}/${path}`;
      if (!set?.layers) return null;
      request("layers", name, { ...set, dir: `${set.dir}/${path}`, layers: null });
      return maps.layers.get(name)?.clips || null;
    },
    // Texture key for a plain image (a weapon's item picture), or null while it loads.
    image(url) {
      const key = `gear:${url}`;
      if (scene.textures.exists(key)) return key;
      if (!requested.has(key)) {
        requested.set(key, { group: "images" });
        finished.add(key);
        scene.load.image(key, url);
        if (!scene.load.isLoading()) scene.load.start();
      }
      return null;
    },
  };
}

function buildSet(scene, group, name, set) {
  if (!set) return null;
  const states =
    group === "monsters"
      ? MONSTER_STATES
      : group === "npcs"
        ? NPC_STATES
        : STATES;
  {
    const clips = {};
    for (const state of states) {
      const folder = set.actions?.[state];
      if (!folder) continue;
      const key = clipKey(set, folder),
        clip = clipFrom(scene, key, scene.cache.json.get(key));
      if (clip) clips[state] = clip;
    }
    if (!clips.idle) return null;
    return {
      name,
      height: Math.round((set.height || 118) * (GROUP_SCALE[group] || 1)),
      facing: set.facing || 1,
      // A single painted still: keep the procedural bob/tilt/lunge on it.
      still: !!set.still,
      flyer: !!set.flyer,
      // Pixel art (layered pixel heroes, or sets made by pixelate_sprites.py).
      pixel: !!(set.pixel || set.layers?.pixel),
      layers: group === "sets" ? set.layers || null : null,
      clips,
    };
  }
}

function frameAt(clip, ms) {
  let t = clip.loop
    ? ((ms % clip.total) + clip.total) % clip.total
    : Math.min(ms, clip.total - 1);
  for (let i = 0; i < clip.frames.length; i++) {
    if (t < clip.durations[i]) return i;
    t -= clip.durations[i];
  }
  return clip.frames.length - 1;
}

// Clip time for a gameplay action: warp so the authored hit lands on impactAt.
function actionMs(clip, a, time) {
  const elapsed = (time - a.startedAt) * 1000,
    impact = (a.impactAt - a.startedAt) * 1000,
    end = (a.endsAt - a.startedAt) * 1000;
  if (clip.hitMs == null || impact <= 0)
    return (elapsed / Math.max(1, end)) * clip.total;
  if (elapsed <= impact) return (elapsed / impact) * clip.hitMs;
  return (
    clip.hitMs +
    ((elapsed - impact) / Math.max(1, end - impact)) * (clip.total - clip.hitMs)
  );
}

// Archer rapid fire: chained basic shots skip the reach-for-an-arrow frames
// and cycle full draw -> release, and between shots the archer holds the aim
// instead of dropping back to idle. Returns a frame index or null.
export const AIM_HOLD = 0.45;
export function rapidFireFrame(clip, p, pose, time) {
  const a = p?.action;
  if (p?.class !== "archer" || !a || a.skill || !clip || clip.hitMs == null) return null;
  const release = frameAt(clip, clip.hitMs),
    aim = Math.max(0, release - 1);
  if (pose.state === "attack" && a.chain > 0 && time < a.endsAt)
    return time < a.impactAt
      ? aim
      : time - a.impactAt < (a.endsAt - a.impactAt) * 0.6
        ? release
        : aim;
  if (pose.state === "idle" && time >= a.endsAt && time - a.endsAt < AIM_HOLD) return aim;
  return null;
}

// Show the right frame for this pose. Returns the scale to keep this frame at
// the set's on-screen height (creature-fx multiplies its squash on top).
export function playSpriteSet(image, set, p, pose, time) {
  const rapid = rapidFireFrame(set.clips.attack, p, pose, time);
  if (rapid != null) pose = { ...pose, state: "attack" };
  const state = set.clips[pose.state]
      ? pose.state
      : pose.state === "run" && set.clips.walk
        ? "walk"
        : "idle",
    clip = set.clips[state];
  let ms;
  if ((state === "attack" || state === "skill") && p.action)
    ms = actionMs(clip, p.action, time);
  else if (state === "hit") ms = (time - (p.hitAt || time)) * 1000;
  else if (state === "death") ms = (time - (p.diedAt || time)) * 1000;
  else ms = time * 1000 * (state === "run" && !set.clips.run ? 1.4 : 1);
  // Airborne poses follow vertical speed (heroPose's 0..3 rise→fall), not a timer.
  const index =
    rapid != null
      ? rapid
      : state === "jump"
      ? Math.min(
          clip.frames.length - 1,
          Math.floor(((pose.frame ?? 0) / 4) * clip.frames.length),
        )
      : frameAt(clip, ms);
  const f = clip.frames[index];
  if (image.texture.key !== f.key || image.frame.name !== f.frame)
    image.setTexture(f.key, f.frame);
  image.setOrigin(clip.origin[0], clip.origin[1]);
  image._clip = { state, index, clip };
  const scale = set.height / clip.bodyPx;
  image._spriteScale = scale;
  // No authored frames for this state (e.g. walk on an idle+attack sheet):
  // show idle and let creature-fx add bob/tilt/lunge procedurally.
  image._spriteStill =
    set.still ||
    (state !== pose.state && !(pose.state === "run" && state === "walk"));
  image.setScale(scale);
  return scale;
}

// Monsters: pose comes from slimePose (idle/move/attack/hit/death/spawn).
export function playMonsterSet(image, set, e, pose, time) {
  const state = set.clips[pose.state] ? pose.state : "idle",
    clip = set.clips[state];
  let ms;
  if (state === "attack" && e.action) ms = actionMs(clip, e.action, time);
  else if (state === "hit") ms = (time - (e.hitAt || time)) * 1000;
  else if (state === "spawn") ms = (time - (e.spawnAt || time)) * 1000;
  else ms = time * 1000;
  const f = clip.frames[frameAt(clip, ms)];
  if (image.texture.key !== f.key || image.frame.name !== f.frame)
    image.setTexture(f.key, f.frame);
  image.setOrigin(clip.origin[0], clip.origin[1]);
  image._spriteScale = set.height / clip.bodyPx;
  image._spriteStill = false;
  image.setScale(image._spriteScale);
  image.setFlipX((e.direction || 1) * set.facing < 0);
}

// Town NPCs: loop idle, or the talk row while a player stands close.
export function playNpcSet(image, set, talking, time) {
  const clip = set.clips[talking && set.clips.talk ? "talk" : "idle"],
    f = clip.frames[frameAt(clip, time * 1000)];
  if (image.texture.key !== f.key || image.frame.name !== f.frame)
    image.setTexture(f.key, f.frame);
  image.setOrigin(clip.origin[0], clip.origin[1]);
  image.setScale(set.height / clip.bodyPx);
}

// Play the death clip once, then fade. Returns false if the set has none.
export function playMonsterDeath(scene, image, set) {
  const clip = set?.clips.death;
  if (!clip) return false;
  let i = 0;
  const show = () => {
    if (!image.active) return;
    const f = clip.frames[i];
    image.setTexture(f.key, f.frame).setOrigin(clip.origin[0], clip.origin[1]);
    image
      .setScale(set.height / clip.bodyPx)
      .setAngle(0)
      .clearTint();
    if (++i < clip.frames.length)
      scene.time.delayedCall(clip.durations[i - 1], show);
    else
      scene.tweens.add({
        targets: image,
        alpha: 0,
        delay: clip.durations[i - 1],
        duration: 260,
        onComplete: () => image.destroy(),
      });
  };
  show();
  return true;
}

// Paper-doll gear: stack each worn look over a layered set's bare body.
// Every layer shares the body's cell size, anchor and frame timing, so it
// takes the body's current frame index and copies its whole transform
// (position, scale, flip, angle, alpha). Outfit and head looks come in tint
// parts (fixed / main / trim / gem) coloured from the armour picture; the
// weapon is the item's own picture placed on the body's hand socket, with the
// front hand drawn over its grip. Call after all procedural motion has been
// applied to the body image. `holder` keeps the images; `dress` comes from
// public/hero-gear.js gearDress().
export function playLayers(scene, holder, image, set, dress, registry) {
  holder.layers ??= {
    images: {},
    destroy() {
      Object.values(this.images).forEach((im) => im.destroy());
      this.images = {};
    },
  };
  const layers = set?.layers,
    images = holder.layers.images,
    used = new Set(),
    state = image._clip?.state,
    index = image._clip?.index || 0;
  let depth = 0;
  // One stacked image per key, following the body frame by frame.
  const place = (key, clips, tint) => {
    const clip = clips?.[state] || clips?.idle;
    if (!clip) return;
    used.add(key);
    let im = images[key];
    im ??= images[key] = scene.add.image(0, 0, clip.frames[0].key, clip.frames[0].frame);
    const f = clip.frames[Math.min(index, clip.frames.length - 1)];
    if (im.texture.key !== f.key || im.frame.name !== f.frame) im.setTexture(f.key, f.frame);
    im.setOrigin(image.originX, image.originY)
      .setPosition(image.x, image.y)
      .setScale(image.scaleX, image.scaleY)
      .setFlip(image.flipX, image.flipY)
      .setAngle(image.angle);
    finish(im, tint);
  };
  const finish = (im, tint) => {
    im.setAlpha(image.alpha)
      .setBlendMode(image.blendMode)
      .setVisible(image.visible)
      .setDepth(image.depth + ++depth * 0.005);
    // A hit flash on the body wins over the gear colours.
    if (image.isTinted) {
      im.setTint(image.tintTopLeft);
      im.tintFill = image.tintFill;
    } else if (tint != null) {
      im.tintFill = false;
      im.setTint(tint);
    } else if (im.isTinted) im.clearTint();
  };
  // weaponBehind: under the whole body (above the base sprite only).
  // weaponFront: over the outfit and its gripping hand, under the head.
  const layerWeapon = (im) => {
    if (layers.weaponBehind) im.setDepth(image.depth + 0.002);
    else if (layers.weaponFront)
      im.setDepth((images.outfit?.depth ?? image.depth) + 0.0025);
  };
  if (layers) {
    for (const slot of ["outfit", "head"]) {
      const look = dress?.looks?.[slot],
        parts = layers.parts?.[slot]?.[look];
      if (!look || !layers.looks?.[slot]?.includes(look)) continue;
      // A one-piece (painted) look takes one wash of the armour colour.
      if (!parts) place(slot, registry.layer(set.name, `${slot}/${look}`), dress.tints?.[slot]?.main);
      // Cloth first, the fixed part (outlines, hair) on top of it.
      else
        for (const part of ["main", "trim", "gem", "fixed"])
          if (parts.includes(part))
            place(`${slot}:${part}`, registry.layer(set.name, `${slot}/${look}/${part}`), dress.tints?.[slot]?.[part]);
    }
    const sock = image._clip?.clip?.sockets?.hand?.[index],
      icon = dress?.weapon && sock ? registry.image(dress.weapon.url) : null;
    if (icon) {
      // The weapon's item picture: butt bottom-left, tip top-right, so it
      // points at -45° unrotated. Upright pixel pictures (tip up) point at
      // -90° and show at the body's own pixel scale. Flipping mirrors around
      // the frame middle.
      used.add("weapon-icon");
      const w = dress.weapon,
        flip = image.flipX,
        cw = image.frame.width,
        ch = image.frame.height,
        lx = ((flip ? cw - sock[0] : sock[0]) - image.originX * cw) * image.scaleX,
        ly = (sock[1] - image.originY * ch) * image.scaleY,
        r = image.rotation,
        texture = scene.textures.get(icon),
        tex = texture.getSourceImage(),
        gx = w.upright ? (w.gripX ?? 0.5) : 0.1 + 0.8 * w.grip,
        gy = w.upright ? w.grip : 0.9 - 0.8 * w.grip,
        deg = w.upright ? (sock[2] + 90) * (w.tilt ?? 1) : sock[2] + 45;
      if (w.upright && texture._pixel !== true) {
        texture.setFilter(1);
        texture._pixel = true;
      }
      let im = images["weapon-icon"];
      im ??= images["weapon-icon"] = scene.add.image(0, 0, icon);
      if (im.texture.key !== icon) im.setTexture(icon);
      im.setOrigin(flip ? 1 - gx : gx, gy)
        .setPosition(image.x + lx * Math.cos(r) - ly * Math.sin(r), image.y + lx * Math.sin(r) + ly * Math.cos(r))
        .setScale(
          w.upright
            ? (w.length ? w.length / tex.height : 1) * Math.abs(image.scaleY)
            : (w.length * Math.abs(image.scaleY)) / (tex.width * 0.8 * Math.SQRT2),
        )
        .setFlip(flip, false)
        .setAngle((flip ? -deg : deg) + image.angle);
      finish(im, null);
      layerWeapon(im);
      // The glow pass resamples the picture smoothly: pixel art goes without.
      if (!w.upright) glowWeapon(scene, im, dress.weaponGlow, image);
      else if (im._glow) {
        im.preFX?.clear();
        im._glow = null;
      }
    } else if (!(dress?.weapon && layers.painted)) {
      // The set's own drawn weapon look. Painted sets showing an item
      // picture don't download this atlas just to fill the moment it loads.
      const look = dress?.looks?.weapon;
      if (look && layers.looks?.weapon?.includes(look)) {
        // Per-outfit weapon folders (layers.weapons) carry a painted fist
        // fitted to that outfit's sleeve.
        const dir = layers.weapons?.[dress?.looks?.outfit] || "weapon";
        place("weapon", registry.layer(set.name, `${dir}/${look}`));
        if (used.has("weapon")) {
          layerWeapon(images.weapon);
          glowWeapon(scene, images.weapon, dress.weaponGlow, image);
        }
      }
    }
    // Optional near-hand grip overlay for sets that need one.
    const hand = layers.hands?.[dress?.looks?.outfit] || layers.hand;
    // Painted sets paint the gripping palm in the outfit itself: an overlay
    // would either repeat the far hand over the near arm (weaponBehind) or
    // cover the staff held in front of the palm (weaponFront).
    if (hand && !layers.weaponBehind && !layers.weaponFront) place("hand", registry.layer(set.name, hand));
  }
  for (const key of Object.keys(images))
    if (!used.has(key)) {
      images[key].destroy();
      delete images[key];
    }
}

// The held weapon shimmers in its own item picture's accent colour: a soft
// pulsing outline glow (WebGL only; canvas renderers skip it).
function glowWeapon(scene, im, colour, body) {
  if (colour == null || !im.preFX) return;
  if (!im._glow || im._glowColour !== colour) {
    im.preFX.clear();
    im.preFX.padding = 8;
    im._glow = im.preFX.addGlow(colour, 4, 0, false, 0.1, 12);
    im._glowColour = colour;
  }
  const t = scene.time.now / 1000;
  im._glow.outerStrength = (4 + Math.sin(t * 3.2) * 1.6) * (body.visible ? 1 : 0);
}
