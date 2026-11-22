import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeGear, GEAR } from "../shared/rpg.js";
import { combatStats } from "../shared/config.js";

const url = path => new URL(path, import.meta.url).href;
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

test("inventory pages expose every item and keep equip actions before optional details", async () => {
  const index = JSON.parse(readFileSync(new URL("../public/assets/sprites/index.json", import.meta.url)));
  const portraitSource = readFileSync(new URL("../public/hero-appearance.js", import.meta.url), "utf8")
    .replace('"/shared/rpg.js"', JSON.stringify(url("../shared/rpg.js")));
  let source = "const innerWidth=1280,innerHeight=720;\n" + readFileSync(new URL("../public/rpg-ui.js", import.meta.url), "utf8")
    .replace(/"\/hero-appearance\.js(\?v=[^"]*)?"/, JSON.stringify(asModule(portraitSource)));
  for (const [from, to] of [["/item-art.js?v=2", "../public/item-art.js"],
    ["/shared/rpg.js", "../shared/rpg.js"], ["/shared/config.js", "../shared/config.js"],
    ["/shared/motion.js", "../shared/motion.js"], ["/shared/costumes.js", "../shared/costumes.js"], ["/shared/stats.js", "../shared/stats.js"], ["/skill-icons.js?v=5", "../public/skill-icons.js"]])
    source = source.replace(JSON.stringify(from), JSON.stringify(url(to)));
  const savedFetch = globalThis.fetch;
  let ui;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => index });
    ui = await import(asModule(source));
  } finally { globalThis.fetch = savedFetch; }

  const owned=Object.keys(GEAR).filter(id=>GEAR[id].class==='swordsman'||!GEAR[id].class).slice(0,35);
  const p=initializeGear({id:'bag-pages',class:'swordsman',gender:'female',level:60,gold:500,inventory:{},ownedEquipment:owned});
  p.stats=combatStats(p);
  let html=ui.rpgPanel(p,'town'),seen=new Set();
  for(let page=0;page<10;page++) {
    const grid=html.match(/<div class="inv-grid">([\s\S]*?)<nav class="inv-pages"/)[1];
    for(const match of grid.matchAll(/data-inspect="([^"]+)"/g)) {
      assert.ok(!seen.has(match[1]),'no duplicate items across pages');seen.add(match[1]);
    }
    assert.ok(html.indexOf('data-equip=')<html.indexOf('class="inv-sections"'),'equip action precedes details');
    const next=html.match(/<button data-bag-page="(\d+)" (disabled)?>(?:ถัดไป)/);
    if(next[2]) break;
    const button={dataset:{bagPage:next[1]}};
    ui.bindRpgPanel({querySelectorAll:selector=>selector==='[data-bag-page]'?[button]:[]},p,{open:()=>{html=ui.rpgPanel(p,'town');}});
    button.onclick();
  }
  const worn=new Set(Object.values(p.equipment));
  for(const id of owned) if(!worn.has(id)) assert.ok(seen.has(id),'all bag items reachable');
});
