import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeGear } from "../shared/rpg.js";
import { combatStats } from "../shared/config.js";

const url = path => new URL(path, import.meta.url).href;
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

test("picking a class previews its character; confirmation and character changes reset the preview", async () => {
  const index = JSON.parse(readFileSync(new URL("../public/assets/sprites/index.json", import.meta.url)));
  const portraitSource = readFileSync(new URL("../public/hero-appearance.js", import.meta.url), "utf8")
    .replace('"/shared/rpg.js"', JSON.stringify(url("../shared/rpg.js")));
  let source = readFileSync(new URL("../public/rpg-ui.js", import.meta.url), "utf8")
    .replace('"/hero-appearance.js?v=3"', JSON.stringify(asModule(portraitSource)));
  for (const [from, to] of [["/item-art.js", "../public/item-art.js"],
    ["/shared/rpg.js", "../shared/rpg.js"], ["/shared/config.js", "../shared/config.js"],
    ["/shared/motion.js", "../shared/motion.js"], ["/shared/costumes.js", "../shared/costumes.js"], ["/shared/stats.js", "../shared/stats.js"], ["/skill-icons.js?v=4", "../public/skill-icons.js"]])
    source = source.replace(JSON.stringify(from), JSON.stringify(url(to)));
  const savedFetch = globalThis.fetch;
  let ui;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => index });
    ui = await import(asModule(source));
  } finally { globalThis.fetch = savedFetch; }
  const p = initializeGear({ id: "preview-owner", class: "priest", gender: "female", level: 20,
    gold: 120, inventory: {}, specialization: null, advanced: false });
  p.stats = combatStats(p);
  let html = ui.rpgPanel(p, "town", "class");
  assert.match(html, /priest-female\/portrait\.webp/);
  const pick = id => {
    const button = { dataset: { pickSpec: id } };
    ui.bindRpgPanel({ querySelectorAll: selector => selector === "[data-pick-spec]" ? [button] : [] }, p,
      { open: tab => { html = ui.rpgPanel(p, "town", tab); }, action: () => assert.fail("preview must not apply a class") });
    button.onclick();
  };
  pick("bishop");
  assert.match(html, /priest-female-bishop-2\/portrait\.webp/);
  assert.match(html, /data-spec="bishop"/);
  assert.match(html, /ภาพตัวอย่าง/);
  assert.equal(p.specialization, null);
  p.specialization = "bishop";
  html = ui.rpgPanel(p, "town", "class");
  assert.doesNotMatch(html, /cls-preview-note/);
  p.advanced = true;
  html = ui.rpgPanel(p, "town", "class");
  assert.match(html, /priest-female-bishop-3\/portrait\.webp/);
  pick("templar");
  assert.match(html, /priest-female-templar-3\/portrait\.webp/);
  const other = { ...p, id: "another-hero", specialization: null, advanced: false };
  html = ui.rpgPanel(other, "town", "class");
  assert.match(html, /priest-female\/portrait\.webp/);
  assert.doesNotMatch(html, /cls-preview-note/);
});
