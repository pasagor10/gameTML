import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { GEAR } from "../shared/rpg.js";
import { itemArtPath, heldArtPath } from "../public/item-art.js";

test("every gear item has inventory art (and weapons a held picture) on disk", () => {
  for (const [id, item] of Object.entries(GEAR)) {
    const art = itemArtPath(id, item);
    assert.ok(art && existsSync(`public${art}`), `${id} has no item art`);
    if (item.slot === "weapon" && item.class) {
      const held = heldArtPath(id, item, item.class);
      assert.ok(held && existsSync(`public${held}`), `${id} has no held art`);
    }
  }
});

test("every potion size has its own supply picture", async () => {
  const { POTIONS } = await import("../shared/config.js");
  const { supplyArt } = await import("../public/item-art.js");
  const srcs = Object.keys(POTIONS).map((id) => supplyArt(id).match(/src="([^"]+)"/)?.[1]);
  assert.equal(new Set(srcs).size, srcs.length);
  for (const src of srcs) assert.ok(src && existsSync(`public${src}`), src);
});
