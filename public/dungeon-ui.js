// Dungeon gate: one card per floor (art, boss, difficulty,
// monsters, featured loot, enter button). Floors 11+ form the deep section.
import {
  FLOORS,
  MAIN_FLOORS,
  floorDifficulty,
  recommendedLevel,
} from "/shared/config.js";
import { rosterEntry, TRAITS } from "/shared/dungeons.js";
import { FLOOR_LOOT, GEAR } from "/shared/rpg.js";
import { MONSTERS } from "/shared/quests.js";
import { itemArt, supplyArt } from "/item-art.js";
import { portrait } from "/quest-ui.js?v=3";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
function lootIcons(p, floor) {
  const deep = floor > MAIN_FLOORS,
    table = FLOOR_LOOT[Math.min(floor, MAIN_FLOORS)],
    owned = p.ownedEquipment || [];
  const ids = deep
    ? table.pool.slice(-2)
    : [table.weapons[p.class], ...table.pool].filter(Boolean).slice(0, 3);
  const cells = ids.map(
    (id) =>
      `<span class="dg-loot rarity-${GEAR[id].rarity} ${owned.includes(id) ? "owned" : ""}" title="${esc(GEAR[id].name)}${owned.includes(id) ? " · มีแล้ว" : ""}">${itemArt(id, GEAR[id])}</span>`,
  );
  if (deep)
    cells.push(
      `<span class="dg-loot rarity-rare" title="แร่จันทรา ×${2 + floor - MAIN_FLOORS}">${supplyArt("ore")}<em>×${2 + floor - MAIN_FLOORS}</em></span>`,
    );
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
  const requirement = floor === 1 ? "เริ่มต้นการผจญภัย" : `ผ่านชั้น ${floor - 1} ก่อน`;
  const button = locked
    ? `<button class="dg-enter" data-floor="${floor}" data-locked disabled>🔒 ${requirement}</button>`
    : `<button class="dg-enter" data-floor="${floor}" >เข้าดันเจียน <span aria-hidden="true">➜</span></button>`;
  return `<article class="dg-card ${locked ? "is-locked" : ""} ${f.deep ? "is-deep" : ""}" data-card="${floor}" style="--floor:${hex(f.color)};--tint:${hex(f.tint)}">
<div class="dg-thumb" aria-hidden="true"><i class="dg-scene" style="background-position:${(index * 37) % 100}% 55%"></i>${portrait(f.bossType)}<span class="dg-num"><b>${String(floor).padStart(2, "0")}</b></span>${cleared ? '<span class="dg-cleared">พิชิตแล้ว ✓</span>' : ""}</div>
<div class="dg-info"><h3>${esc(f.name)}</h3><p>บอส: ${esc(f.boss)} · 3 ด่าน · ${requirement}</p><div class="dg-chips"><span class="dg-chip diff-${diff.id}">⚔ ความยาก: ${diff.label}</span><span class="dg-chip ${p.level < level ? "warn" : ""}">แนะนำ Lv.${level}+</span>${traits.map((t) => `<span class="dg-chip trait" title="${esc(TRAITS[t].text)}">${TRAITS[t].icon} ${TRAITS[t].name}</span>`).join("")}</div><div class="dg-mons"><small>มอนสเตอร์:</small>${monsters(floor)}</div></div>
<div class="dg-loot-col"><small>ของเด่น:</small><div>${lootIcons(p, floor)}</div></div>
${button}</article>`;
}

export function dungeonPanelHtml(p, time) {
  const main = FLOORS.slice(0, MAIN_FLOORS),
    deep = FLOORS.slice(MAIN_FLOORS);
  const deepOpen = p.unlocked > MAIN_FLOORS;
  return `<div class="dg-window">
<header class="dg-head"><div class="dg-rules"><p>เข้าดันเจียนได้ไม่จำกัด · สนามฝึกเล่นฟรี</p><p>แต่ละชั้นมี 3 ด่าน: มอนสเตอร์ → อีลิท → บอส · ปาร์ตี้สูงสุด 3 คน สมาชิกต้องกดพร้อมก่อนหัวหน้าเริ่ม</p></div></header>
<p class="dg-tip"><span>SPACE กระโดดหลบคริสตัลและบอสทุบพื้น · รอบแรกได้อาวุธประจำอาชีพแน่นอน · เล่นซ้ำมีโอกาสได้อุปกรณ์สูงสุด 35%</span></p>
<div class="dg-list">${main.map((f, i) => card(p, f, i)).join("")}
<div class="dg-deep-banner ${deepOpen ? "open" : ""}"><strong>ห้วงลึกถ้ำหลวง · ชั้น 11–${FLOORS.length}</strong><span>${deepOpen ? "มอนสเตอร์กลายพันธุ์ แต่ละชั้นมีความสามารถพิเศษต่างกัน · ดรอปของตำนานชั้น 10 และแร่จำนวนมาก" : "ปลดล็อกเมื่อพิชิตชั้น 10 · มอนสเตอร์กลายพันธุ์ที่โหดกว่าเดิม"}</span></div>
${deep.map((f, i) => card(p, f, i + MAIN_FLOORS)).join("")}</div></div>`;
}
