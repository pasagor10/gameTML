import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { heroLooks } from "../shared/appearance.js";
import { heroSkins } from "../shared/rpg.js";
import { playLayers } from "../public/sprite-sets.js";

const root = new URL("../public/assets/sprites/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", root)));
const digest = (path) => createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex");

test("every priest vocation and advancement has distinct painted art for both genders", () => {
  for (const gender of ["male", "female"]) {
    const set = index.sets[`priest-${gender}`];
    assert.equal(set.layers.painted, true);
    assert.equal(set.layers.weaponBehind, true);
    const hashes = new Set();
    for (const specialization of [null, "bishop", "templar"])
      for (const advanced of specialization ? [false, true] : [false]) {
        const p = { class: "priest", gender, specialization, advanced,
          equipment: { weapon: "starter_priest", armor: "traveler_armor" } };
        const skin = heroSkins(p)[0];
        assert.ok(index.sets[skin], skin);
        const looks = heroLooks(p, set.layers.looks);
        assert.equal(looks.weapon, "staff-1");
        if (specialization) {
          assert.equal(looks.outfit, `${specialization}-${advanced ? 3 : 2}`);
          assert.equal(looks.head, looks.outfit);
        }
        const hash = digest(`${set.dir}/head/${looks.head}/idle/idle-atlas-00.webp`)
          + digest(`${set.dir}/outfit/${looks.outfit}/idle/idle-atlas-00.webp`);
        assert.ok(!hashes.has(hash), `${skin} must not reuse the same look`);
        hashes.add(hash);
        assert.ok(readFileSync(new URL(`${set.dir}/${index.sets[skin].portrait}`, root)).length);
      }
  }
});

test("class and advancement preserve the equipped weapon tier and player costume override", () => {
  const available = index.sets["priest-female"].layers.looks;
  const p = { class: "priest", specialization: "bishop", advanced: true,
    equipment: { weapon: "floor_10_priest_weapon", armor: "traveler_armor" } };
  assert.deepEqual(heroLooks(p, available), { outfit: "bishop-3", head: "bishop-3", weapon: "staff-4" });
  assert.equal(heroLooks({ ...p, costume: { head: "circlet" } }, available).head, "circlet");
});

test("painted priest resolves each equipped item's own art, washes the outfit in the armour colour and glows the weapon in its own", async () => {
  let source = readFileSync(new URL("../public/hero-gear.js", import.meta.url), "utf8");
  for (const [from, to] of [["/shared/rpg.js", "../shared/rpg.js"],
    ["/shared/appearance.js", "../shared/appearance.js"], ["/item-art.js", "../public/item-art.js"]])
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
  const set = index.sets["priest-female"],
    p = { class: "priest", specialization: "templar", advanced: true,
      equipment: { armor: "traveler_armor" } };
  const paths = [];
  for (const weapon of ["starter_priest", "dawn_scepter", "floor_10_priest_weapon"]) {
    const dress = gearDress({ ...p, equipment: { ...p.equipment, weapon } }, set);
    paths.push(dress.weapon.url);
    assert.equal(dress.looks.outfit, "templar-3");
    // traveler_armor is armor-1 (main #8c3633), softened halfway to white.
    assert.deepEqual(dress.tints.outfit, { main: 0xc69b99 });
    assert.deepEqual(dress.tints.head, {});
    assert.equal(typeof dress.weapon.glow, "number");
  }
  assert.deepEqual(paths, ["/assets/items/staff-0.webp", "/assets/items/staff-2.webp", "/assets/items/staff-11.webp"]);
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
  set.layers.weaponBehind = true;
  set.layers.hand = "hand";
  registry.layer = () => { throw Error("far gripping palm must not be placed over the body"); };
  playLayers(scene, holder, image, set, dress("staff-2"), registry);
  assert.ok(weapon.depth < image.depth + 0.005, "staff must remain below robe and near arm in either facing");
  assert.ok(weapon.depth > image.depth, "staff must not fall behind the scene when the base sprite is at depth zero");
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
