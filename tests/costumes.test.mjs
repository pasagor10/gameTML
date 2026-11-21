import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { heroSkins } from "../shared/rpg.js";

const root = new URL("../public/assets/sprites/", import.meta.url);

test("every registered costume is complete, so skins never point at missing art", async () => {
  const index = JSON.parse(await readFile(new URL("index.json", root)));
  for (const [key, set] of Object.entries(index.sets)) {
    assert.ok(set.dir, key);
    assert.ok(set.actions?.idle, `${key}: needs an idle clip`);
    // Layered (paper-doll) sets keep their own clips under body/.
    const dir = set.layers ? `${set.dir}/body` : set.dir;
    for (const folder of new Set(Object.values(set.actions)))
      await access(new URL(`${dir}/${folder}/animation.json`, root));
    if (set.portrait) await access(new URL(`${set.dir}/${set.portrait}`, root));
  }
});

test("costume lookups always end at a plain class look that exists", async () => {
  const index = JSON.parse(await readFile(new URL("index.json", root)));
  for (const cls of ["swordsman", "archer", "mage", "priest"])
    for (const gender of ["male", "female"])
      for (const specialization of [null, "x"])
        for (const advanced of [false, true]) {
          const skins = heroSkins({
            class: cls,
            gender,
            specialization,
            advanced,
          });
          assert.equal(skins.at(-1), `${cls}-${gender}`);
          assert.ok(index.sets[skins.at(-1)], `${cls}-${gender} base set`);
        }
});

test("each browser module is imported under one URL (no duplicate copies)", async () => {
  const { readdir } = await import("node:fs/promises");
  const seen = new Map();
  for (const dir of ["public", "shared"])
    for (const name of await readdir(new URL(`../${dir}/`, import.meta.url))) {
      if (!name.endsWith(".js")) continue;
      const src = await readFile(
        new URL(`../${dir}/${name}`, import.meta.url),
        "utf8",
      );
      for (const [, spec] of src.matchAll(
        /^\s*(?:import|\}) .*?from "(\/[^"]+)"/gm,
      )) {
        const path = spec.split("?")[0];
        if (!seen.has(path)) seen.set(path, new Set());
        seen.get(path).add(spec);
      }
    }
  for (const [path, specs] of seen)
    assert.equal(specs.size, 1, `${path} imported as ${[...specs].join(", ")}`);
});

test("beach costume keeps its idle weapon at the palm instead of jumping to the head", async () => {
  const path = "female-costume-1-maple-v1/body/";
  const clip = JSON.parse(await readFile(new URL(path + "idle/animation.json", root)));
  const palms = clip.sockets.hand;
  assert.equal(palms.length, clip.frameCount);
  for (const [x, y] of palms) {
    assert.ok(x >= 74 && x <= 82, "weapon stays at the forward fist");
    assert.ok(y >= 82 && y <= 91, "weapon cannot attach to the head or ear");
  }
  for (let i = 1; i < palms.length; i++)
    assert.ok(Math.hypot(palms[i][0] - palms[i-1][0], palms[i][1] - palms[i-1][1]) < 6);
});
