import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { heroLooks } from "../shared/appearance.js";
import { heroSkins } from "../shared/rpg.js";
import { playLayers } from "../public/sprite-sets.js";

const root = new URL("../public/assets/sprites/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", root)));
const painted = JSON.parse(readFileSync(new URL("../tests/fixtures/painted-priest.json", import.meta.url)));
const digest = (path) => createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex");

test("monks have empty base sprites with item weapons, one look per vocation and advancement", () => {
  for (const gender of ["male", "female"]) {
  const dirs = new Set();
  for (const specialization of [null, "bishop", "templar"])
    for (const advanced of specialization ? [false, true] : [false]) {
      const set = index.sets[heroSkins({ class: "priest", gender, specialization, advanced })[0]];
      assert.equal(set.layers.pixel, true);
      assert.equal(set.layers.heldArt, "pixel", "the equipped item supplies the weapon");
      readFileSync(new URL(`${set.dir}/body/idle/idle-atlas-00.webp`, root));
      dirs.add(set.dir);
    }
  assert.equal(dirs.size, 5);
  }
});

test("class and advancement preserve the equipped weapon tier and player costume override", () => {
  const available = painted.layers.looks;
  const p = { class: "priest", specialization: "bishop", advanced: true,
    equipment: { weapon: "floor_10_priest_weapon", armor: "traveler_armor" } };
  assert.deepEqual(heroLooks(p, available), { outfit: "bishop-3", head: "bishop-3", weapon: "staff-4" });
  assert.equal(heroLooks({ ...p, costume: { head: "circlet" } }, available).head, "circlet");
});

test("painted priest holds its own drawn staff glowing in the item's colour and washes the outfit in the armour colour", async () => {
  let source = readFileSync(new URL("../public/hero-gear.js", import.meta.url), "utf8");
  for (const [from, to] of [["/shared/rpg.js", "../shared/rpg.js"],
    ["/shared/appearance.js", "../shared/appearance.js"], ["/item-art.js?v=2", "../public/item-art.js"]])
    source = source.replace(`"${from}"`, JSON.stringify(new URL(to, import.meta.url).href));
  const originalFetch = globalThis.fetch;
  let gearDress;
  try {
    globalThis.fetch = async () => ({ ok: true,
      json: async () => JSON.parse(readFileSync(new URL("../public/assets/items/palette.json", import.meta.url))) });
    ({ gearDress } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`));
  } finally {
    globalThis.fetch = originalFetch;
  }
  const set = painted,
    p = { class: "priest", specialization: "templar", advanced: true,
      equipment: { armor: "traveler_armor" } };
  const glows = [];
  for (const weapon of ["starter_priest", "dawn_scepter", "floor_10_priest_weapon"]) {
    const dress = gearDress({ ...p, equipment: { ...p.equipment, weapon } }, set);
    assert.equal(dress.looks.outfit, "templar-3");
    // traveler_armor is armor-1 (main #8c4841), softened halfway to white.
    assert.deepEqual(dress.tints.outfit, { main: 0xc6a4a0 });
    assert.deepEqual(dress.tints.head, {});
    // The priest holds its own drawn staff, not the ornate item picture...
    assert.equal(dress.weapon, null);
    assert.ok(set.layers.looks.weapon.includes(dress.looks.weapon));
    glows.push(dress.weaponGlow);
  }
  // ...glowing in each item picture's own accent colour.
  assert.deepEqual(glows, [0xe1bb90, 0xeeb550, 0xedc380]);
  const other = gearDress({ class: "priest", equipment: { weapon: "dawn_scepter" } },
    { layers: { looks: set.layers.looks } });
  assert.equal(other.weapon.url, "/assets/items/held/mace-31.webp", "sets without weaponArt hold the pixel mace");
  assert.equal(other.weapon.upright, true);
  assert.equal(other.weapon.length, 90, "a painted body holds it at painted size");
  assert.equal(gearDress({ class: "priest", equipment: { weapon: "dawn_scepter" } }, { layers: { pixel: true } }).weapon,
    null, "a pixel set without heldArt (a monk) holds nothing");
  const pixel = gearDress({ class: "archer", equipment: {} }, { layers: { pixel: true, heldArt: "pixel" } });
  assert.equal(pixel.weapon.url, "/assets/items/held/bow-0.webp", "no weapon: the class starter");
  assert.equal(pixel.weapon.length, null, "a pixel body holds it at its own pixel size");
});

test("a replaced weapon image follows the animated hand in both facing directions", () => {
  const makeImage = (key) => ({ texture: { key }, frame: {},
    setTexture(key) { this.texture.key = key; return this; },
    setOrigin(x, y) { this.origin = [x, y]; return this; },
    setPosition(x, y) { this.position = [x, y]; return this; },
    setScale(v) { this.scale = v; return this; },
    setFlip(x, y) { this.flip = [x, y]; return this; },
    setAngle(v) { this.angle = v; return this; },
    setAlpha() { return this; }, setBlendMode() { return this; },
    setVisible() { return this; }, setDepth(v) { this.depth = v; return this; },
    destroy() { this.destroyed = true; },
  });
  const scene = { add: { image: (_x, _y, key) => makeImage(key) },
    textures: { get: () => ({ getSourceImage: () => ({ width: 80 }) }) } };
  const holder = {};
  const image = { x: 200, y: 300, originX: .5, originY: 222 / 240,
    scaleX: 1, scaleY: 1, flipX: false, flipY: false, rotation: 0, angle: 0,
    alpha: 1, visible: true, depth: 10, frame: { width: 300, height: 240 },
    _clip: { state: "attack", index: 0, clip: { sockets: { hand: [[170, 180, -35], [190, 145, -10]] } } } };
  const set = { name: "priest-female", layers: { looks: {} } };
  const registry = { image: (url) => url };
  const dress = (url) => ({ weapon: { url, grip: .3, length: 104 } });
  playLayers(scene, holder, image, set, dress("staff-0"), registry);
  const weapon = holder.layers.images["weapon-icon"];
  assert.deepEqual(weapon.position, [220, 258]);
  image._clip.index = 1;
  image.flipX = true;
  playLayers(scene, holder, image, set, dress("staff-2"), registry);
  assert.equal(holder.layers.images["weapon-icon"], weapon);
  assert.equal(weapon.texture.key, "staff-2");
  assert.deepEqual(weapon.position, [160, 223]);
  assert.deepEqual(weapon.flip, [true, false]);
  assert.equal(weapon.angle, -35);
  set.layers.weaponFront = true;
  set.layers.hand = "hand";
  registry.layer = () => { throw Error("a palm overlay must not cover the staff held in front of it"); };
  playLayers(scene, holder, image, set, dress("staff-2"), registry);
  assert.ok(weapon.depth > image.depth + 0.0005, "staff is drawn over the body and the gripping hand");
});

test("the hand overlay follows the selected outfit instead of keeping the novice palm", () => {
  const requested = [];
  const registry = { layer: (_name, path) => { requested.push(path); return null; } };
  const set = { name: "priest-female", layers: { looks: {}, hand: "hand",
    hands: { "robe-1": "hand/robe-1", "bishop-2": "hand/bishop-2", "templar-3": "hand/templar-3" } } };
  for (const outfit of ["robe-1", "bishop-2", "templar-3"])
    playLayers({}, {}, { _clip: { state: "walk", index: 2 } }, set, { looks: { outfit } }, registry);
  assert.deepEqual(requested, ["hand/robe-1", "hand/bishop-2", "hand/templar-3"]);
});
