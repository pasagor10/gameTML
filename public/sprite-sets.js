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
const GROUPS = ["sets", "monsters", "npcs"];
const MONSTER_STATES = ["idle", "move", "attack", "hit", "death", "spawn"];
const NPC_STATES = ["idle", "talk"];
// On-screen size per group, on top of index.json's height: heroes and
// townsfolk read smaller against the painted town so the scene has depth.
const GROUP_SCALE = { sets: 0.86, npcs: 0.84, monsters: 1 };
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
    const [, group, name, folder] = key.split(":"),
      set = scene.spriteSetIndex[group][name];
    for (const page of data?.fallback?.pages || [])
      scene.load.image(
        `${key}:${page.file}`,
        `${ROOT}${set.dir}/${folder}/${page.file}${stamp(scene)}`,
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
  };
}

// On-demand registry. heroes: Map("class-gender" → set); monsters: Map(type → set).
// want(group, name) starts loading a set; it appears in the map when ready,
// and callers fall back to static art + procedural motion until then.
export function createSpriteRegistry(scene) {
  const maps = { sets: new Map(), monsters: new Map(), npcs: new Map() },
    requested = new Set(),
    index = () => scene.spriteSetIndex || scene.cache.json.get("sprite-index");
  const tryBuild = () => {
    for (const id of requested) {
      const [group, name] = id.split("|");
      if (maps[group].has(name)) continue;
      const set = buildSet(scene, group, name, index()?.[group]?.[name]);
      if (set) maps[group].set(name, set);
    }
  };
  scene.load.on("complete", tryBuild);
  return {
    heroes: maps.sets,
    monsters: maps.monsters,
    npcs: maps.npcs,
    want(group, name) {
      const id = `${group}|${name}`,
        set = index()?.[group]?.[name];
      if (requested.has(id) || !set) return;
      requested.add(id);
      for (const folder of new Set(Object.values(set.actions || {}))) {
        const key = `sprite:${group}:${name}:${folder}`;
        if (!scene.cache.json.exists(key))
          scene.load.json(
            key,
            `${ROOT}${set.dir}/${folder}/animation.json${stamp(scene)}`,
          );
      }
      if (!scene.load.isLoading()) scene.load.start();
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
      const key = `sprite:${group}:${name}:${folder}`,
        clip = clipFrom(scene, key, scene.cache.json.get(key));
      if (clip) clips[state] = clip;
    }
    if (!clips.idle) return null;
    return {
      name,
      height: Math.round((set.height || 118) * GROUP_SCALE[group]),
      facing: set.facing || 1,
      // A single painted still: keep the procedural bob/tilt/lunge on it.
      still: !!set.still,
      flyer: !!set.flyer,
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

// Show the right frame for this pose. Returns the scale to keep this frame at
// the set's on-screen height (creature-fx multiplies its squash on top).
export function playSpriteSet(image, set, p, pose, time) {
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
    state === "jump"
      ? Math.min(
          clip.frames.length - 1,
          Math.floor(((pose.frame ?? 0) / 4) * clip.frames.length),
        )
      : frameAt(clip, ms);
  const f = clip.frames[index];
  if (image.texture.key !== f.key || image.frame.name !== f.frame)
    image.setTexture(f.key, f.frame);
  image.setOrigin(clip.origin[0], clip.origin[1]);
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
