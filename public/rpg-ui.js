import { heroPortraitStyle, heroPortraitUrl } from "/hero-appearance.js?v=4";
import { costumesOf, ownsCostume, COSTUME_ITEMS, costumeItem, costumeFits, costumeOf } from "/shared/costumes.js";
import { itemArt, supplyArt } from "/item-art.js";
import {
  GEAR,
  SLOTS,
  RARITIES,
  SPECIALIZATIONS,
  CLASS_SKILLS,
  ADVANCE_LEVEL,
  ENHANCEMENT_BONUSES,
  enhancementLevel,
} from "/shared/rpg.js";
import { CLASSES, combatPower, combatStats, POTIONS, ITEMS } from "/shared/config.js";
import {
  STAT_KEYS,
  STAT_INFO,
  STAT_MAX,
  PRIMARY,
  ATTACK_STATS,
  LIGHTNING_AGI,
  baseStats,
  bonusStats,
  raiseCost,
  spentOn,
  pointsAt,
  buildOf,
  resetCost,
} from "/shared/stats.js";
import { ACTIONS } from "/shared/motion.js";
import { skillIcon } from "/skill-icons.js?v=5";
const statNames = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  mp: "MP",
  speed: "ความเร็ว",
  range: "ระยะ",
};
// Gear and path bonuses as text; base-stat bonuses (attrs) use their RO names.
export const statText = (stats, attrs = {}) =>
  [
    ...Object.entries(stats).map(([k, v]) => `${statNames[k]} +${v}`),
    ...Object.entries(attrs).map(([k, v]) => `${k.toUpperCase()} +${v}`),
  ].join(" · ") || "อุปกรณ์เริ่มต้น";
let selected = null;
let bagFilter = "all";
const rarity = (item) => `rarity-${item.rarity}`;
export function rpgPanel(p, area, tab = "inventory") {
  const stats = p.stats,
    cls = CLASSES[p.class],
    owned = (p.ownedEquipment || []).filter((id) => GEAR[id]);
  const spec = SPECIALIZATIONS[p.class].find((s) => s.id === p.specialization);
  const base = `<div class="rpg-summary"><span class="class-crest">${cls.icon}</span><div><small>ผู้กล้า · LEVEL ${p.level}</small><h3>${cls.name} <span>${spec?.name || "ยังไม่เลือกสายพัฒนา"}</span></h3></div><strong>${supplyArt("gold")} ${p.gold.toLocaleString()} <small>ทอง</small></strong></div><div class="rpg-tabs"><button data-rpg-tab="inventory" class="${tab === "inventory" ? "active" : ""}">อุปกรณ์ & กระเป๋า <kbd>I</kbd></button><button data-rpg-tab="class" class="${tab === "class" ? "active" : ""}">คลาส & สกิล <kbd>C</kbd></button><button data-rpg-tab="status" class="${tab === "status" ? "active" : ""}">สเตตัส${p.statPoints > 0 ? ` <b class="stat-badge">${p.statPoints}</b>` : ""} <kbd>K</kbd></button>${costumesOf(p).length ? `<button data-rpg-tab="wardrobe" class="${tab === "wardrobe" ? "active" : ""}">ตู้ชุด</button>` : ""}</div>`;
  if (tab === "wardrobe") return base + wardrobePage(p);
  if (tab === "class") return base + classPage(p, area, spec, cls);
  if (tab === "status") return base + statusPage(p, area);
  return base + inventoryPage(p, area, stats, owned, spec, cls);
}

// ---------------------------------------------------------------------------
// Wardrobe: costumes worn over the class look (shared/costumes.js). Looks
// only; stats stay with the equipment.
function wardrobePage(p) {
  const card = (id, name, rarityName) => {
    const url = heroPortraitUrl({ ...p, skin: id }),
      worn = (p.skin || null) === id,
      owned = id === null || ownsCostume(p, id),
      count = id === null ? 0 : p.inventory?.[costumeItem(id)] || 0;
    return `<button class="wardrobe-card ${worn ? "worn" : ""} ${owned ? "" : "locked"} ${rarityName ? `rarity-${rarityName}` : ""}" data-wear="${id ?? ""}" ${worn || !owned ? "disabled" : ""}><i style="${id === null ? heroPortraitStyle({ ...p, skin: null }) : url ? `background-image:url('${url}')` : ""}"></i><b>${name}</b><small>${worn ? "สวมอยู่" : owned ? `สวมชุดนี้${count > 1 ? ` · มี ×${count}` : ""}` : "ยังไม่มี · ดรอปจากบอส"}</small></button>`;
  };
  const list = costumesOf(p),
    have = list.filter((c) => ownsCostume(p, c.id)).length;
  return `<div class="wardrobe"><p class="wardrobe-note">สะสมแล้ว ${have} / ${list.length} ชุด · เก็บชุดได้จากบอสในดันเจียน ยิ่งลึกยิ่งดรอปบ่อย · ชุดซ้ำวางขายในตลาดหรือแลกกับผู้เล่นอื่นได้ · ไม่มีผลกับสเตตัส</p><div class="wardrobe-grid">${card(null, "ชุดตามอาชีพ")}${[...list]
    .sort((a, b) => ownsCostume(p, b.id) - ownsCostume(p, a.id))
    .map((c) => card(c.id, c.name, c.rarity))
    .join("")}</div></div>`;
}

// ---------------------------------------------------------------------------
// Inventory page: hero card (gear slots around the hero, power, stats), the
// bag grid (gear + supplies, filter tabs, sort), and an item detail card.
const icon = (body) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const statIcons = {
  atk: icon('<path d="M4 20 15 9m-2-2 4-4 4 4-4 4M20 20 9 9m2-2L7 3 3 7l4 4"/>'),
  def: icon('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>'),
  hp: icon('<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z"/>'),
  mp: icon('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/>'),
  speed: icon('<path d="M3 15c6 0 9-3 13-9 1 4 0 7-2 9h7c-4 4-9 5-18 3Z"/>'),
  range: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'),
};
const filterIcons = {
  all: icon('<path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/>'),
  weapon: icon('<path d="m5 19 10-10m-2-2 5-4 2 2-4 5M5 19l-2 2m4-6 2 2"/>'),
  armor: icon('<path d="M8 3 4 6v5l2 1v8h12v-8l2-1V6l-4-3-2 2h-4Z"/>'),
  charm: icon('<path d="M12 3c-3 4-3 6 0 8 3-2 3-4 0-8Zm0 8v3m-4 0h8l-4 7Z"/>'),
  boots: icon('<path d="M7 3h6v9l7 4v4H5V12Z"/>'),
  supply: icon('<path d="M12 3 6 11l6 10 6-10Z"/><path d="M6 11h12"/>'),
  costume: icon('<path d="M9 3h6l4 4-3 2v12H8V9L5 7Z"/>'),
};
const inventoryFilters = [
  ["all", "ทั้งหมด"],
  ["weapon", "อาวุธ"],
  ["armor", "เกราะ"],
  ["charm", "เครื่องราง"],
  ["boots", "รองเท้า"],
  ["supply", "วัตถุดิบ"],
  ["costume", "ชุด"],
];
const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
const SLOT_RANK = { weapon: 0, armor: 1, charm: 2, boots: 3 };
let bagSort = "rarity";
const bagSorts = [
  ["rarity", "ความหายาก (สูง → ต่ำ)"],
  ["level", "เลเวล (สูง → ต่ำ)"],
  ["slot", "ประเภทอุปกรณ์"],
];
const SUPPLIES = {
  ...Object.fromEntries(
    Object.entries(POTIONS).map(([id, { kind, restore }]) => [
      id,
      { name: ITEMS[id].name, text: `ฟื้นฟู ${restore} ${kind.toUpperCase()} ทันที · ปุ่มลัดเลือกขนาดที่พอดีให้อัตโนมัติ`, rarity: id.endsWith("_l") ? "rare" : "common" },
    ]),
  ),
  ore: {
    name: "แร่จันทรา",
    text: "วัตถุดิบตีบวกอาวุธ ใช้ที่โรงตีของลุงเหล็ก",
    rarity: "rare",
  },
};

// Supplies and costume items share the stack cells and detail card.
const supplyInfo = (id) =>
  SUPPLIES[id] ||
  (COSTUME_ITEMS[id] && {
    name: COSTUME_ITEMS[id].name,
    text: `ชุดแต่งกาย ${costumeFits(id)} ไม่มีผลกับสเตตัส · ขายในตลาดหรือแลกเปลี่ยนได้`,
    rarity: COSTUME_ITEMS[id].rarity,
    costume: COSTUME_ITEMS[id].costume,
  });
const stackFilter = (id) => (COSTUME_ITEMS[id] ? "costume" : "supply");

function inventoryPage(p, area, stats, owned, spec, cls) {
  // Gear stacks by id; supplies are their own cells.
  const counts = new Map();
  for (const id of owned) counts.set(id, (counts.get(id) || 0) + 1);
  // Worn pieces leave the bag until they are taken off.
  for (const id of Object.values(p.equipment || {}))
    if (counts.has(id)) {
      const left = counts.get(id) - 1;
      if (left > 0) counts.set(id, left);
      else counts.delete(id);
    }
  const gearIds = [...counts.keys()].sort((a, b) => {
    const A = GEAR[a],
      B = GEAR[b];
    if (bagSort === "level") return B.level - A.level;
    if (bagSort === "slot")
      return SLOT_RANK[A.slot] - SLOT_RANK[B.slot] || B.level - A.level;
    return (
      RARITY_RANK[B.rarity] - RARITY_RANK[A.rarity] || B.level - A.level
    );
  });
  const supplyIds = [...Object.keys(SUPPLIES), ...Object.keys(COSTUME_ITEMS)].filter((k) => p.inventory[k] > 0);
  const cells = [
    ...(bagFilter === "supply" || bagFilter === "costume"
      ? []
      : gearIds.filter((id) => bagFilter === "all" || GEAR[id].slot === bagFilter)),
    ...supplyIds
      .filter((k) => bagFilter === "all" || stackFilter(k) === bagFilter)
      .map((k) => "supply:" + k),
  ];
  const worn = Object.values(p.equipment || {}).filter(Boolean);
  if (!cells.includes(selected) && !worn.includes(selected)) selected = cells[0] ?? null;

  const cell = (key) => {
    const supply = key.startsWith("supply:") ? key.slice(7) : null,
      g = supply ? supplyInfo(supply) : GEAR[key],
      count = supply ? p.inventory[supply] : counts.get(key);
    // Same picture, different tier: the level tag tells them apart.
    return `<button data-inspect="${key}" aria-pressed="${selected === key}" title="${g.name}${supply ? "" : ` · Lv.${g.level}`}" class="inv-cell ${rarity(g)} ${selected === key ? "selected" : ""}">${supply ? "" : `<em class="inv-lv">Lv.${g.level}</em>`}<b>${supply ? supplyArt(supply) : itemArt(key, g)}</b><small class="inv-count">×${count}</small></button>`;
  };
  // Fill to whole rows of six, at least four rows.
  const empty = Math.max(24, Math.ceil(cells.length / 6) * 6) - cells.length;

  const slot = (name) => {
    const id = p.equipment[name],
      g = GEAR[id];
    const level = enhancementLevel(p, name);
    return `<button data-inspect="${id || ""}" ${g ? "" : "disabled"} class="inv-slot ${g ? rarity(g) : "empty"} ${g && selected === id ? "selected" : ""}" title="${g?.name || SLOTS[name]}"><b>${g ? itemArt(id, g) : filterIcons[name]}</b>${level && g ? `<small>+${level}</small>` : ""}</button>`;
  };
  const power = p.power ?? combatPower(stats);

  return `<div class="inv2">
  <aside class="inv-hero">
    <header><span class="inv-crest">${cls.icon}</span><div><small>ผู้กล้า · LEVEL ${p.level}</small><h3>${cls.name} <em>${spec?.name || ""}</em></h3></div></header>
    <div class="inv-stage">
      <div class="inv-slots left">${slot("weapon")}${slot("armor")}</div>
      <div class="inv-figure"><div class="inv-hero-art" style="${heroPortraitStyle(p)}"></div><i class="inv-pedestal"></i></div>
      <div class="inv-slots right">${slot("charm")}${slot("boots")}</div>
    </div>
    <div class="inv-nameplate">${spec?.name || cls.name} · Lv.${p.level}</div>
    <div class="inv-power"><span>${icon('<path d="M12 2 4 12l8 10 8-10Z"/>')}</span><small>พลังรวม</small><strong>${power.toLocaleString()}</strong></div>
    <div class="inv-stats">${Object.keys(statNames)
      .filter((k) => k in stats)
      .map(
        (k) =>
          `<div><i>${statIcons[k] || ""}</i><span>${statNames[k]}</span><b>${stats[k]}</b></div>`,
      )
      .concat(
        stats.aspd
          ? [
              `<div><i>💨</i><span>ASPD</span><b>${stats.aspd.toFixed(2)}×</b></div>`,
              `<div><i>✷</i><span>CRIT</span><b>${Math.round(stats.crit * 100)}%</b></div>`,
              `<div><i>✹</i><span>ดาเมจคริ</span><b>×${stats.critDamage.toFixed(2)}</b></div>`,
              `<div><i>◌</i><span>FLEE</span><b>${Math.round((stats.flee + stats.perfect) * 100)}%</b></div>`,
            ]
          : [],
      )
      .join("")}</div>
  </aside>
  <section class="inv-bag">
    <header><h3>◈ INVENTORY ◈</h3><strong>${supplyArt("gold")} ${p.gold.toLocaleString()} <small>ทอง</small></strong></header>
    <div class="inv-tabs">${inventoryFilters
      .map(
        ([id, label]) =>
          `<button data-bag-filter="${id}" class="${bagFilter === id ? "active" : ""}" aria-pressed="${bagFilter === id}">${filterIcons[id]}<span>${label}</span></button>`,
      )
      .join("")}</div>
    <div class="inv-grid">${cells.map(cell).join("")}${'<div class="inv-cell blank" aria-hidden="true"></div>'.repeat(empty)}</div>
    <footer><label>${icon('<path d="M4 6h16M4 12h10M4 18h6"/>')}<span>เรียง:</span><select data-bag-sort>${bagSorts
      .map(
        ([id, label]) =>
          `<option value="${id}" ${bagSort === id ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label><span>${cells.length} ช่อง · ${owned.length} อุปกรณ์</span></footer>
  </section>
  ${detailCard(p, area, stats, selected, counts)}
</div>`;
}

// "This piece vs the one you wear": gear stats and base-stat bonuses, with
// the difference marked up or down.
function compareRows(item, worn, wornId) {
  const rows = [];
  const add = (label, a = 0, b = 0) => {
    if (!a && !b) return;
    const d = a - b;
    rows.push(`<tr class="${d > 0 ? "up" : d < 0 ? "down" : ""}"><th>${label}</th><td>${b}</td><td>${a}</td><td>${d > 0 ? "▲" + d : d < 0 ? "▼" + -d : "="}</td></tr>`);
  };
  for (const k of Object.keys(statNames)) add(statNames[k], item.stats?.[k], worn.stats?.[k]);
  for (const k of STAT_KEYS) add(STAT_INFO[k].name, item.attrs?.[k], worn.attrs?.[k]);
  return `<h4>เทียบกับที่สวมอยู่</h4>
    <div class="inv-versus"><div class="inv-versus-head"><span class="${rarity(worn)}">${itemArt(wornId, worn)}</span><small>${worn.name} · Lv.${worn.level}</small></div>
    <table><thead><tr><th></th><th>ใส่อยู่</th><th>ชิ้นนี้</th><th></th></tr></thead><tbody>${rows.join("") || '<tr><td colspan="4">ไม่มีค่าสถานะ</td></tr>'}</tbody></table></div>`;
}
function costumeAction(p, id) {
  if (!costumeOf(p, id)) return `<button class="inv-action" disabled>${costumeFits(costumeItem(id))}</button>`;
  if (p.skin === id) return `<button class="inv-action" data-wear="">ถอดชุด</button>`;
  return `<button class="inv-action" data-wear="${id}">สวมชุดนี้</button>`;
}
function discardButton(id, allowed) {
  return `<button class="inv-discard" data-discard="${id}" ${allowed ? "" : "disabled"}>ทิ้ง 1 ชิ้น</button>`;
}
function detailCard(p, area, stats, key, counts) {
  if (!key)
    return `<aside class="inv-detail empty"><p>ไม่มีของในหมวดนี้<br>เก็บของจากดันเจียนเพื่อเติมกระเป๋า</p></aside>`;
  if (key.startsWith("supply:")) {
    const id = key.slice(7),
      s = supplyInfo(id),
      usable =
        !s.costume &&
        id !== "ore" &&
        p.hp > 0 &&
        (POTIONS[id]?.kind === "hp" ? p.hp < stats.hp : p.mp < stats.mp);
    return `<aside class="inv-detail ${rarity(s)}"><div class="inv-detail-art">${supplyArt(id)}</div><h3>${s.name}</h3><div class="inv-pills"><span>${s.costume ? "ชุดแต่งกาย" : "วัตถุดิบ"}</span><span class="rarity">${RARITIES[s.rarity]}</span></div><p class="inv-lore">${s.text}</p><div class="inv-detail-stats"><div><span>จำนวนในกระเป๋า</span><b>×${p.inventory[id]}</b></div></div><div class="inv-detail-actions">${s.costume ? costumeAction(p, s.costume) : id === "ore" ? "" : `<button class="inv-action" data-use="${id}" ${usable ? "" : "disabled"}>${usable ? "ใช้" : "พลังเต็มอยู่แล้ว"}</button>`}${discardButton(id, area === "town")}</div></aside>`;
  }
  const item = GEAR[key],
    equipped = p.equipment[item.slot] === key,
    previous = GEAR[p.equipment[item.slot]],
    level = enhancementLevel(p, item.slot),
    compared = { ...stats };
  for (const k of new Set([
    ...Object.keys(item.stats),
    ...Object.keys(previous?.stats || {}),
  ]))
    compared[k] =
      (stats[k] || 0) +
      (equipped
        ? -(item.stats[k] || 0)
        : (item.stats[k] || 0) - (previous?.stats[k] || 0));
  const enhancementChange = equipped ? -level : previous ? 0 : level;
  for (const [stat, points] of Object.entries(ENHANCEMENT_BONUSES[item.slot]))
    compared[stat] += points * enhancementChange;
  const now = p.power ?? combatPower(stats),
    next = combatPower(compared),
    diff = next - now;
  const classOk = !item.class || item.class === p.class,
    levelOk = p.level >= item.level,
    canEquip = classOk && levelOk && area === "town";
  const label = equipped
    ? "ถอดออก"
    : area !== "town"
      ? "สวมใส่ในเมือง"
      : !levelOk
        ? `ต้องการ Lv.${item.level}`
        : !classOk
          ? "ไม่ตรงคลาส"
          : "สวมใส่";
  const check = (ok) => `<em class="${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</em>`;
  const attrLines = (g) =>
    Object.entries(g?.attrs || {}).map(
      ([k, v]) => `<div class="attr" style="--stat:${STAT_INFO[k].color}"><i>${STAT_INFO[k].icon}</i><span>${STAT_INFO[k].name}</span><b>+${v}</b></div>`,
    );
  // Side by side with what is worn in that slot: every stat of either piece.
  const versus = !equipped && previous ? compareRows(item, previous, p.equipment[item.slot]) : "";
  return `<aside class="inv-detail ${rarity(item)}">
    <div class="inv-detail-art">${itemArt(key, item)}</div>
    <h3>${item.name}${equipped && level ? ` +${level}` : ""}</h3>
    <div class="inv-pills"><span class="lv">Lv.${item.level}</span>${equipped ? '<span class="worn">◆ สวมใส่อยู่</span>' : ""}<span>${SLOTS[item.slot]}${counts.get(key) > 1 ? ` ×${counts.get(key)}` : ""}</span><span class="rarity">ระดับ${RARITIES[item.rarity]}</span></div>
    ${item.lore ? `<p class="inv-lore">${item.lore}</p>` : ""}
    <h4>ค่าสถานะ</h4>
    <div class="inv-detail-stats">${
      Object.entries(item.stats)
        .map(
          ([k, v]) =>
            `<div><i>${statIcons[k] || ""}</i><span>${statNames[k]}</span><b>+${v}</b></div>`,
        )
        .concat(attrLines(item))
        .join("") || "<div><span>อุปกรณ์เริ่มต้น</span></div>"
    }</div>
    ${versus}
    <h4>เงื่อนไขสวมใส่</h4>
    <div class="inv-reqs">${item.class ? `<div>${check(classOk)}<span>อาชีพ: ${CLASSES[item.class].name}</span></div>` : ""}<div>${check(levelOk)}<span>เลเวลขั้นต่ำ: ${item.level}</span></div>${item.floor ? `<div><em class="ok">◆</em><span>ดรอปจากบอสชั้น ${item.floor}</span></div>` : ""}</div>
    <div class="inv-compare ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${equipped ? "ถ้าถอด" : "ถ้าสวม"} พลัง ${now.toLocaleString()} → ${next.toLocaleString()} <b>${diff >= 0 ? "+" : ""}${diff}</b></div>
    <div class="inv-detail-actions"><button class="inv-action" data-equip="${key}" data-slot="${item.slot}" ${canEquip ? "" : "disabled"}>${filterIcons.armor}<span>${label}</span></button>${discardButton(key, area === "town" && !equipped && !key.startsWith("starter_"))}</div>
  </aside>`;
}
// ---------------------------------------------------------------------------
// Class & skills: hero on a pedestal, the path tree (class → two lines at
// Lv.3 → advanced form at ADVANCE_LEVEL), and the class skill list. Picking a
// node previews it; "ยืนยันเส้นทาง" applies the pick or the advancement.
let pickedSpec = null;
let pickedFor = null;
const lock = icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
function classPage(p, area, spec, cls) {
  const specs = SPECIALIZATIONS[p.class];
  const identity = JSON.stringify([p.id, p.class, p.gender, p.specialization, !!p.advanced]);
  if (identity !== pickedFor) {
    pickedFor = identity;
    pickedSpec = p.specialization;
  }
  if (!specs.some((s) => s.id === pickedSpec)) pickedSpec = p.specialization;
  const picked = specs.find((s) => s.id === pickedSpec),
    shownSpec = picked || spec,
    previewing = !!picked && picked.id !== p.specialization,
    previewHero = previewing ? { ...p, specialization: picked.id } : p,
    town = area === "town",
    tier = p.specialization ? (p.advanced ? 3 : 2) : 1;

  const node = (s) => {
    const current = s.id === p.specialization,
      locked = p.level < 3;
    return `<button data-pick-spec="${s.id}" class="path-node spec ${current ? "current" : ""} ${s.id === pickedSpec ? "picked" : ""} ${locked ? "locked" : ""}"><span class="path-emblem">${s.icon}</span><strong>${s.name}</strong><small>${current ? "ปัจจุบัน" : locked ? "Lv.3" : s.role}</small>${locked ? `<i class="path-lock">${lock}</i>` : ""}</button>`;
  };
  const advNode = (s) => {
    const done = p.advanced && s.id === p.specialization,
      open = p.level >= ADVANCE_LEVEL;
    return `<div class="path-node adv ${done ? "current" : ""} ${open ? "" : "locked"}"><span class="path-emblem">✦</span><strong>${s.name}ขั้นสูง</strong><small>${done ? "เลื่อนขั้นแล้ว" : `Lv.${ADVANCE_LEVEL}`}</small>${open || done ? "" : `<i class="path-lock">${lock}</i>`}</div>`;
  };

  // What the confirm button does right now.
  let action = "",
    label = "ยืนยันเส้นทาง",
    hint = "";
  if (!town) hint = "เปลี่ยนเส้นทางได้เฉพาะในเมือง";
  else if (p.level < 3) hint = `ปลดล็อกสายพัฒนาเมื่อ Lv.3 (อีก ${3 - p.level} เลเวล)`;
  else if (pickedSpec && pickedSpec !== p.specialization) {
    action = `data-spec="${pickedSpec}"`;
    hint = p.specialization ? "เปลี่ยนสายได้ฟรีในเมือง" : "";
  } else if (p.specialization && !p.advanced && p.level >= ADVANCE_LEVEL) {
    action = "data-advance";
    label = "เลื่อนขั้นอาชีพ";
    hint = "พลังสายพัฒนา ×2 และชุดขั้นสูง";
  } else if (!pickedSpec) hint = "เลือกสายพัฒนาจากแผนผัง";
  else if (!p.advanced) hint = `เลื่อนขั้นได้เมื่อ Lv.${ADVANCE_LEVEL}`;
  else hint = "เส้นทางนี้สมบูรณ์แล้ว";

  const skills = [
    { name: "โจมตีปกติ", detail: "คอมโบ 3 จังหวะ · ไม่ใช้ MP" },
    ...CLASS_SKILLS[p.class],
  ];
  return `<div class="cls2">
  <aside class="cls-hero">
    <div class="cls-figure"><div class="cls-hero-art" data-preview-class="${previewHero.specialization || p.class}" style="${heroPortraitStyle(previewHero)}"></div><i class="inv-pedestal"></i></div>
    <div class="inv-nameplate">${shownSpec?.name || cls.name} · Lv.${p.level}</div>
    ${previewing ? '<small class="cls-preview-note">ภาพตัวอย่าง · ยืนยันเส้นทางเพื่อเปลี่ยนคลาส</small>' : ""}
    <div class="cls-role"><span>${shownSpec?.icon || cls.icon}</span><div><strong>${shownSpec?.role || cls.name}</strong><small>${shownSpec?.description || "เลือกสายพัฒนาเมื่อ Lv.3 เพื่อปลดล็อกพลังเฉพาะทาง"}</small></div></div>
  </aside>
  <section class="cls-path">
    <header><span>${icon('<path d="M4 20 15 9m-2-2 4-4 4 4-4 4M20 20 9 9m2-2L7 3 3 7l4 4"/>')}</span><div><h3>เส้นทางของผู้กล้า</h3><small>3 ขั้น: อาชีพเริ่มต้น → สายพัฒนา (Lv.3) → ขั้นสูง (Lv.${ADVANCE_LEVEL})</small></div><b class="cls-tier">ขั้นที่ ${tier}</b></header>
    <div class="path-tree">
      <div class="path-node root current"><span class="path-emblem">${cls.icon}</span><strong>${cls.name}</strong><small>${p.specialization ? "ขั้นที่ 1" : "ปัจจุบัน"}</small></div>
      <svg class="path-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50H4.5V24H9M4.5 50V76H9M56 24H65M56 76H65"/></svg>
      <div class="path-col">${specs.map(node).join("")}</div>
      <div class="path-col">${specs.map(advNode).join("")}</div>
    </div>
    ${picked ? `<div class="path-info"><span>${picked.icon}</span><div><strong>${picked.name} <em>${picked.role}</em></strong><small>${picked.description}</small></div><b>${statText(picked.stats)}${p.advanced && picked.id === p.specialization ? " · ×2" : ""}</b></div>` : `<div class="path-info empty">แตะสายพัฒนาในแผนผังเพื่อดูรายละเอียด</div>`}
    <footer><button class="inv-action cls-confirm" ${action || "disabled"}>${icon('<path d="M4 20 15 9m-2-2 4-4 4 4-4 4M20 20 9 9m2-2L7 3 3 7l4 4"/>')}<span>${label}</span></button>${hint ? `<small>${hint}</small>` : ""}</footer>
  </section>
  <section class="cls-skills">
    <header><span>${cls.icon}</span><h3>สกิลของ${spec?.name || cls.name}</h3></header>
    ${skills
      .map(
        (sk, i) =>
          `<article><b class="sk-icon sk-${i}">${skillIcon(p.class, i)}</b><div><h4>${sk.name}</h4><p>${sk.detail}</p><small>${i ? `${ACTIONS[i].mp} MP · คูลดาวน์ ${ACTIONS[i].cooldown} วิ` : "พื้นฐาน"}</small></div><kbd>${["J", "Q", "W", "E", "S"][i]}</kbd></article>`,
      )
      .join("")}
  </section>
</div>`;
}

// ---------------------------------------------------------------------------
// Status page (Ragnarok style): six base stats raised with status points.
// Raises are drafted here first, previewed, then sent in one confirm.
let statDraft = {};
let statDraftOwner = null;
const draftedStats = (p) => {
  const base = baseStats(p.attrs ? { attrs: p.attrs } : p);
  return Object.fromEntries(STAT_KEYS.map((k) => [k, base[k] + (statDraft[k] || 0)]));
};
const draftCost = (p) => {
  const base = baseStats({ attrs: p.attrs }),
    next = draftedStats(p);
  return STAT_KEYS.reduce((n, k) => n + spentOn(next[k]) - spentOn(base[k]), 0);
};
const pct = (v, digits = 1) => `${(v * 100).toFixed(digits).replace(/\.0$/, "")}%`;
function derivedRows(p, now, next) {
  const magic = PRIMARY[p.class] === "int",
    hasDraft = Object.values(statDraft).some(Boolean),
    perSec = (s) => (s.aspd / ACTIONS[0].cooldown).toFixed(2),
    rows = [
      [magic ? "MATK" : "ATK", (s) => s.atk],
      ["DEF", (s) => s.def],
      ["HP", (s) => s.hp],
      ["MP", (s) => s.mp],
      ["ASPD", (s) => `${s.aspd.toFixed(2)}× · ${perSec(s)}/วิ`, (s) => s.aspd],
      ["FLEE", (s) => pct(s.flee), (s) => s.flee],
      ["หลบสมบูรณ์", (s) => pct(s.perfect), (s) => s.perfect],
      ["CRIT", (s) => pct(s.crit), (s) => s.crit],
      ["ดาเมจคริ", (s) => pct(s.critDamage, 0), (s) => s.critDamage],
      ["ร่ายเร็ว", (s) => "−" + pct(s.cast, 0), (s) => s.cast],
      ...(p.class === "priest" ? [["พลังฮีล", (s) => "+" + pct(s.heal, 0), (s) => s.heal]] : []),
      ...(p.class === "archer" ? [["ศรคู่", (s) => pct(s.double, 1), (s) => s.double]] : []),
    ];
  return rows
    .map(([label, show, raw = show]) => {
      const a = raw(now),
        b = raw(next),
        up = hasDraft && b > a;
      return `<li class="${up ? "up" : ""}"><span>${label}</span><b>${show(now)}</b>${up ? `<em>→ ${show(next)}</em>` : ""}</li>`;
    })
    .join("");
}
function statusPage(p, area) {
  if (statDraftOwner !== p.id) {
    statDraft = {};
    statDraftOwner = p.id;
  }
  const base = baseStats({ attrs: p.attrs }),
    job = bonusStats(p),
    next = draftedStats(p),
    total = pointsAt(p.level),
    spent = STAT_KEYS.reduce((n, k) => n + spentOn(base[k]), 0),
    free = total - spent,
    left = free - draftCost(p),
    main = PRIMARY[p.class],
    build = buildOf(p),
    hasDraft = Object.values(statDraft).some(Boolean),
    now = p.stats || combatStats(p),
    preview = combatStats({ ...p, attrs: next }),
    resetGold = resetCost(p);
  const row = (k) => {
    const info = STAT_INFO[k],
      cost = raiseCost(next[k]),
      can = next[k] < STAT_MAX && cost <= left,
      tag =
        k === main
          ? `<i class="stat-tag main">สายหลัก</i>`
          : ATTACK_STATS.includes(k)
            ? `<i class="stat-tag off">ผิดสาย ×¼</i>`
            : build.weights[k]
              ? `<i class="stat-tag rec">แนะนำ</i>`
              : "";
    return `<div class="stat-row ${k === main ? "primary" : ""}" style="--stat:${info.color}">
      <span class="stat-icon">${info.icon}</span>
      <div class="stat-name"><strong>${info.name}</strong><small>${info.label}</small>${tag}</div>
      <div class="stat-value"><b>${next[k]}</b>${job[k] ? `<small>+${job[k]}</small>` : ""}${statDraft[k] ? `<em>+${statDraft[k]}</em>` : ""}</div>
      <small class="stat-cost" title="แต้มที่ใช้อัพขั้นถัดไป">${next[k] < STAT_MAX ? cost : "MAX"}</small>
      <button class="stat-btn" data-stat-sub="${k}" ${statDraft[k] ? "" : "disabled"} aria-label="ลด ${info.name}">−</button>
      <button class="stat-btn plus" data-stat-add="${k}" ${can ? "" : "disabled"} aria-label="เพิ่ม ${info.name}">+</button>
      <p class="stat-help">${info.text}</p>
    </div>`;
  };
  const weights = Object.entries(build.weights)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => STAT_INFO[k].name)
    .join(" > ");
  const lightning =
    p.class === "archer"
      ? `<p class="stat-note ${next.agi + job.agi >= LIGHTNING_AGI ? "on" : ""}">⚡ ศรสายฟ้าแลบ: AGI ${LIGHTNING_AGI}+ · คริแล้วยิงเร็วขึ้น 20% นาน 3 วิ</p>`
      : "";
  return `<div class="stat-win">
  <section class="stat-alloc">
    <header class="stat-points"><div><small>แต้มสเตตัสคงเหลือ</small><strong>${left}</strong><span>/ ${total} แต้ม (Lv.${p.level})</span></div>
      <div class="stat-build"><small>บิลด์แนะนำ · ${build.name}</small><b>${weights}</b></div></header>
    <div class="stat-rows">${STAT_KEYS.map(row).join("")}</div>
    <footer class="stat-actions">
      <button data-stat-auto ${free > 0 && !hasDraft ? "" : "disabled"}>✨ อัพตามสาย</button>
      <button data-stat-cancel ${hasDraft ? "" : "disabled"}>ยกเลิก</button>
      <button class="confirm" data-stat-confirm ${hasDraft ? "" : "disabled"}>ยืนยันอัพ</button>
    </footer>
    <p class="stat-hint">กด + เพื่อจองแต้ม (Shift = +10) แล้วกดยืนยัน · ยิ่งค่าสูงยิ่งใช้แต้มมาก · ตัวเลขสีฟ้าคือโบนัสจากอาชีพและอุปกรณ์</p>
  </section>
  <aside class="stat-derived">
    <h4>ค่าสถานะ</h4>
    <ul>${derivedRows(p, now, preview)}</ul>
    ${lightning}
    <button class="stat-reset" data-stat-reset ${area === "town" && spent > 0 ? "" : "disabled"}>↺ รีเซ็ตสเตตัส · ${resetGold ? `${resetGold.toLocaleString()} ทอง` : "ฟรีครั้งแรก"}</button>
    ${area === "town" ? "" : `<small class="stat-hint">รีเซ็ตได้ในเมือง</small>`}
  </aside>
</div>`;
}
function bindStatusPage(root, p, handlers) {
  if (!root.querySelector) return;
  const reopen = () => handlers.open("status");
  root.querySelectorAll("[data-stat-add]").forEach((b) => {
    b.onclick = (e) => {
      const k = b.dataset.statAdd;
      for (let n = e.shiftKey ? 10 : 1; n > 0; n--) {
        const next = draftedStats(p),
          left = (p.statPoints ?? 0) - draftCost(p);
        if (next[k] >= STAT_MAX || raiseCost(next[k]) > left) break;
        statDraft[k] = (statDraft[k] || 0) + 1;
      }
      reopen();
    };
  });
  root.querySelectorAll("[data-stat-sub]").forEach((b) => {
    b.onclick = (e) => {
      const k = b.dataset.statSub;
      statDraft[k] = Math.max(0, (statDraft[k] || 0) - (e.shiftKey ? 10 : 1));
      reopen();
    };
  });
  const cancel = root.querySelector("[data-stat-cancel]");
  if (cancel)
    cancel.onclick = () => {
      statDraft = {};
      reopen();
    };
  const confirm = root.querySelector("[data-stat-confirm]");
  if (confirm)
    confirm.onclick = async () => {
      confirm.disabled = true;
      const adds = Object.fromEntries(Object.entries(statDraft).filter(([, n]) => n > 0));
      statDraft = {};
      await handlers.action("stats:raise", { adds });
    };
  const auto = root.querySelector("[data-stat-auto]");
  if (auto)
    auto.onclick = async () => {
      auto.disabled = true;
      await handlers.action("stats:auto", {});
    };
  const reset = root.querySelector("[data-stat-reset]");
  if (reset) {
    let armed = false;
    reset.onclick = async () => {
      if (!armed) {
        armed = true;
        reset.textContent = "กดอีกครั้งเพื่อยืนยันรีเซ็ต";
        setTimeout(() => reset.isConnected && reopen(), 4000);
        return;
      }
      reset.disabled = true;
      statDraft = {};
      await handlers.action("stats:reset", {});
    };
  }
}
export function bindRpgPanel(root, p, handlers) {
  bindStatusPage(root, p, handlers);
  root.querySelectorAll("[data-pick-spec]").forEach((b) => {
    b.onclick = () => {
      pickedSpec = b.dataset.pickSpec;
      handlers.open("class");
    };
  });
  root.querySelectorAll("[data-bag-filter]").forEach((b) => {
    b.onclick = () => {
      bagFilter = b.dataset.bagFilter;
      handlers.open("inventory");
    };
  });
  root.querySelectorAll("[data-bag-sort]").forEach((sel) => {
    sel.onchange = () => {
      bagSort = sel.value;
      handlers.open("inventory");
    };
  });
  root
    .querySelectorAll("[data-rpg-tab]")
    .forEach((b) => (b.onclick = () => handlers.open(b.dataset.rpgTab)));
  root.querySelectorAll("[data-inspect]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.inspect;
        const supply = selected.startsWith("supply:");
        if (
          bagFilter !== "all" &&
          (supply ? bagFilter !== stackFilter(selected.slice(7)) : GEAR[selected]?.slot !== bagFilter)
        )
          bagFilter = "all";
        handlers.open("inventory");
      }),
  );
  root.querySelectorAll("[data-discard]").forEach((b) => {
    let confirming = false;
    b.onclick = async () => {
      if (!confirming) {
        confirming = true;
        b.textContent = "ยืนยันทิ้งถาวร 1 ชิ้น";
        setTimeout(() => { if (b.isConnected) { confirming = false; b.textContent = "ทิ้ง 1 ชิ้น"; } }, 5000);
        return;
      }
      b.disabled = true;
      try { await handlers.action("inventory:discard", { id: b.dataset.discard, key: crypto.randomUUID() }); }
      finally { b.disabled = false; confirming = false; b.textContent = "ทิ้ง 1 ชิ้น"; }
    };
  });
  root.querySelectorAll("[data-equip]").forEach(
    (b) =>
      (b.onclick = () =>
        handlers.action("equipment:equip", {
          slot: b.dataset.slot,
          id:
            p.equipment[b.dataset.slot] === b.dataset.equip
              ? null
              : b.dataset.equip,
        })),
  );
  root.querySelectorAll("[data-wear]").forEach(
    (b) =>
      (b.onclick = () =>
        handlers.action("costume:wear", { id: b.dataset.wear || null })),
  );
  root
    .querySelectorAll("[data-advance]")
    .forEach((b) => (b.onclick = () => handlers.action("class:advance", {})));
  root
    .querySelectorAll("[data-spec]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          handlers.action("class:specialize", { id: b.dataset.spec })),
    );
  root
    .querySelectorAll("[data-use]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          handlers.action("player:potion", { type: b.dataset.use })),
    );
}
export function gearShop(p) {
  return `<div class="shop-banner"><b>⚒</b><div><small>THE GUARDIAN'S ARMORY</small><h3>อุปกรณ์สำหรับการเดินทางครั้งต่อไป</h3><p>เลือกซื้อ แล้วสวมใส่ในกระเป๋า · มี ${p.gold} ทอง</p></div></div><div class="shop-gear-grid">${Object.entries(
    GEAR,
  )
    .filter(([, g]) => g.price && (!g.class || g.class === p.class))
    .map(
      ([id, g]) =>
        `<article class="shop-gear ${rarity(g)}"><b>${itemArt(id, g)}</b><div><small>${RARITIES[g.rarity]} · ${SLOTS[g.slot]} · Lv.${g.level}</small><h4>${g.name}</h4><p>${statText(g.stats, g.attrs)}</p></div><button data-buy-gear="${id}" ${p.ownedEquipment.includes(id) || p.gold < g.price ? "disabled" : ""}>${p.ownedEquipment.includes(id) ? "เป็นเจ้าของแล้ว" : `${g.price} ◈`}</button></article>`,
    )
    .join("")}</div>`;
}
