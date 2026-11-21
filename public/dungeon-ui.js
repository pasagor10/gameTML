import { BOSSES } from "/shared/bosses.js";
import { bossMechanics, MECHANICS } from "/shared/boss-mechanics.js";
// Dungeon gate: one card per floor (art, boss, difficulty,
// monsters, featured loot, enter button). Floors 11+ form the deep section.
import {
  FLOORS,
  MAIN_FLOORS,
  floorDifficulty,
  recommendedLevel,
} from "/shared/config.js";
import { rosterEntry, TRAITS } from "/shared/dungeons.js";
import { FLOOR_LOOT, GEAR, GRAND_BOSS_RELICS } from "/shared/rpg.js";
import { MONSTERS } from "/shared/quests.js";
import { itemArt, supplyArt } from "/item-art.js?v=2";
import { portrait } from "/quest-ui.js?v=4";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
function lootIcons(p, floor) {
  const deep = floor > MAIN_FLOORS,
    table = FLOOR_LOOT[floor],
    owned = p.ownedEquipment || [];
  const ids = [table.weapons[p.class], ...table.pool].filter(Boolean);
  const cells = ids.map(
    (id) =>
      `<span class="dg-loot rarity-${GEAR[id].rarity} ${owned.includes(id) ? "owned" : ""}" title="${esc(GEAR[id].name)}${owned.includes(id) ? " · มีแล้ว" : ""} · Lv.${GEAR[id].level}">${itemArt(id, GEAR[id])}</span>`,
  );
  if (deep)
    cells.push(
      `<span class="dg-loot rarity-rare" title="แร่จันทรา ×${2 + floor - MAIN_FLOORS}">${supplyArt("ore")}<em>×${2 + floor - MAIN_FLOORS}</em></span>`,
    );
  if (floor >= 10) cells.push(`<span class="dg-loot rarity-divine" title="Lv.40+ ชนะบอส ลุ้นอุปกรณ์เทพ 5% ต่อรอบ">${itemArt(GRAND_BOSS_RELICS[0], GEAR[GRAND_BOSS_RELICS[0]])}<em>5%</em></span>`);
  return cells.join("");
}

function monsters(floor) {
  return [0, 1, 2]
    .map((n) => {
      const { type, variant } = rosterEntry(floor, n),
        trait = TRAITS[variant?.trait],
        name = variant?.name || `${FLOORS[floor - 1].prefix} · ${MONSTERS[type]?.name || type}`;
      return `<span class="dg-mon" title="${esc(name)}${trait ? ` · ${trait.name}: ${trait.text}` : ""}">${portrait(type)}${trait ? `<b>${trait.icon}</b>` : ""}</span>`;
    })
    .join("");
}

function card(p, f, index) {
  const floor = index + 1,
    locked = p.unlocked < floor,
    cleared = p.quest >= floor,
    diff = floorDifficulty(floor),
    level = recommendedLevel(floor),
    traits = [
      ...new Set(
        [0, 1, 2]
          .map((n) => rosterEntry(floor, n).variant?.trait)
          .filter(Boolean),
      ),
    ];
  const table = FLOOR_LOOT[floor];
  const drops = [table.weapons[p.class], ...table.pool];
  const collected = drops.filter(id => p.ownedEquipment?.includes(id)).length;
  const lootHint = floor > MAIN_FLOORS
    ? `<small>ชุดประจำชั้น ${collected}/4 · ${collected === 4 ? "ครบแล้ว รับแร่แทน" : "ชนะบอสรับชิ้นใหม่แน่นอน"}</small>` : "";
  const requirement = floor === 1 ? "เริ่มต้นการผจญภัย" : `ผ่านชั้น ${floor - 1} ก่อน`;
  const button = locked
    ? `<button class="dg-enter" data-floor="${floor}" data-locked disabled>🔒 ${requirement}</button>`
    : `<button class="dg-enter" data-floor="${floor}" >เข้าดันเจียน <span aria-hidden="true">➜</span></button>`;
  const start = floor === 1 && !(p.quest > 0);
  return `<article class="dg-card ${locked ? "is-locked" : ""} ${f.deep ? "is-deep" : ""} ${start ? "is-start" : ""}" data-card="${floor}" style="--floor:${hex(f.color)};--tint:${hex(f.tint)}">
<div class="dg-thumb" aria-hidden="true"><i class="dg-scene" style="background-position:${(index * 37) % 100}% 55%"></i>${portrait(f.bossType)}<span class="dg-num"><b>${String(floor).padStart(2, "0")}</b></span>${cleared ? '<span class="dg-cleared">พิชิตแล้ว ✓</span>' : ""}${start ? '<span class="dg-start">เริ่มที่นี่ ★</span>' : ""}</div>
<div class="dg-info"><h3>${esc(f.name)}</h3><p>บอส: ${esc(f.boss)} · 3 ด่าน · ${requirement}</p>${BOSSES[f.bossType] ? `<p class="dg-boss-skill" title="${esc(BOSSES[f.bossType].detail)}">✦ ${esc(BOSSES[f.bossType].skill)} · กระโดดหลบวงเตือน</p>` : ""}<p class="dg-boss-skill" title="${esc(bossMechanics(floor).map((k) => MECHANICS[k].name + ": " + MECHANICS[k].hint).join(" · "))}">กลไกบอส: ${bossMechanics(floor).map((k) => `${MECHANICS[k].icon} ${esc(MECHANICS[k].name)}`).join(" · ")}</p><div class="dg-chips"><span class="dg-chip diff-${diff.id}">⚔ ความยาก: ${diff.label}</span><span class="dg-chip ${p.level < level ? "warn" : ""}">แนะนำ Lv.${level}+</span>${traits.map((t) => `<span class="dg-chip trait" title="${esc(TRAITS[t].text)}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join("")}</div><div class="dg-mons"><small>มอนสเตอร์:</small>${monsters(floor)}</div></div>
<div class="dg-loot-col"><small>ของเด่น:</small><div>${lootIcons(p, floor)}</div>${lootHint}</div>
${button}</article>`;
}

export function dungeonPanelHtml(p, time, mine = false) {
  if (mine) return `<div class="dg-window"><p class="dg-tip">เหมืองแร่แรร์เอิร์ธ · ชั้น 41–80 · ทางขึ้น 6 ระดับ · มอนกลายพันธุ์ (เรื่องแต่งในเกม) · ใช้ภาพเดิมแต่งสี</p><div class="dg-list">${FLOORS.slice(40).map((f, i) => card(p, f, i + 40)).join("")}</div></div>`;
  const main = FLOORS.slice(0, MAIN_FLOORS),
    deep = FLOORS.slice(MAIN_FLOORS, 40);
  const deepOpen = p.unlocked > MAIN_FLOORS;
  return `<div class="dg-window">
<header class="dg-head"><div class="dg-rules"><p>เข้าดันเจียนได้ไม่จำกัด · สนามฝึกเล่นฟรี</p><p>แต่ละชั้นมี 3 ด่าน: มอนสเตอร์ → อีลิท → บอส · ปาร์ตี้สูงสุด 3 คน สมาชิกต้องกดพร้อมก่อนหัวหน้าเริ่ม</p></div></header>
<p class="dg-tip"><span>SPACE กระโดดหลบคริสตัลและบอสทุบพื้น · รอบแรกได้อาวุธประจำอาชีพแน่นอน · ชั้น 1–10 เล่นซ้ำลุ้นอุปกรณ์สูงสุด 35% · ชั้น 11–40 รับชิ้นที่ยังไม่มีแน่นอนจนกว่าจะครบชุด</span></p>
<p class="dg-warning">✦ ชุดเทพแห่งดารา 3 ชิ้น (รางวัลพิเศษแยก): Lv.40+ ชนะบอสชั้น 10 ขึ้นไป ลุ้น 5% ต่อรอบ · สุ่มชิ้นที่ยังไม่มี · 20 รอบมีโอกาสได้อย่างน้อยหนึ่งชิ้นประมาณ 64% ไม่การันตี</p>
<div class="dg-list">${main.map((f, i) => card(p, f, i)).join("")}
<div class="dg-deep-banner ${deepOpen ? "open" : ""}"><strong>ห้วงลึกถ้ำหลวง · ชั้น 11–40</strong><span>${deepOpen ? "มอนสเตอร์กลายพันธุ์ แต่ละชั้นมีความสามารถพิเศษต่างกัน · อุปกรณ์เฉพาะชั้น Lv.21–60 · ชั้น 26+ ระดับเทพ · ครบชุดแล้วรับแร่แทน" : "ปลดล็อกเมื่อพิชิตชั้น 10 · มอนสเตอร์กลายพันธุ์ที่โหดกว่าเดิม"}</span></div>
${deep.map((f, i) => card(p, f, i + MAIN_FLOORS)).join("")}</div></div>`;
}
