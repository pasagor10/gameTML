import { heroPortraitStyle } from "/hero-appearance.js?v=2";
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
import { CLASSES, combatPower } from "/shared/config.js";
import { ACTIONS } from "/shared/motion.js";
import { skillIcon } from "/skill-icons.js?v=3";
const statNames = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  mp: "MP",
  speed: "ความเร็ว",
  range: "ระยะ",
};
export const statText = (stats) =>
  Object.entries(stats)
    .map(([k, v]) => `${statNames[k]} +${v}`)
    .join(" · ") || "อุปกรณ์เริ่มต้น";
let selected = null;
let bagFilter = "all";
const rarity = (item) => `rarity-${item.rarity}`;
export function rpgPanel(p, area, tab = "inventory") {
  const stats = p.stats,
    cls = CLASSES[p.class],
    owned = (p.ownedEquipment || []).filter((id) => GEAR[id]);
  const spec = SPECIALIZATIONS[p.class].find((s) => s.id === p.specialization);
  const base = `<div class="rpg-summary"><span class="class-crest">${cls.icon}</span><div><small>ผู้กล้า · LEVEL ${p.level}</small><h3>${cls.name} <span>${spec?.name || "ยังไม่เลือกสายพัฒนา"}</span></h3></div><strong>${supplyArt("gold")} ${p.gold.toLocaleString()} <small>ทอง</small></strong></div><div class="rpg-tabs"><button data-rpg-tab="inventory" class="${tab === "inventory" ? "active" : ""}">อุปกรณ์ & กระเป๋า <kbd>I</kbd></button><button data-rpg-tab="class" class="${tab === "class" ? "active" : ""}">คลาส & สกิล <kbd>C</kbd></button></div>`;
  if (tab === "class") return base + classPage(p, area, spec, cls);
  return base + inventoryPage(p, area, stats, owned, spec, cls);
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
};
const inventoryFilters = [
  ["all", "ทั้งหมด"],
  ["weapon", "อาวุธ"],
  ["armor", "เกราะ"],
  ["charm", "เครื่องราง"],
  ["boots", "รองเท้า"],
  ["supply", "วัตถุดิบ"],
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
  hp: { name: "ยา HP", text: "ฟื้นฟู 90 HP ทันที", rarity: "common" },
  mp: { name: "ยา MP", text: "ฟื้นฟู 80 MP ทันที", rarity: "common" },
  ore: {
    name: "แร่จันทรา",
    text: "วัตถุดิบตีบวกอาวุธ ใช้ที่โรงตีของลุงเหล็ก",
    rarity: "rare",
  },
};

function inventoryPage(p, area, stats, owned, spec, cls) {
  // Gear stacks by id; supplies are their own cells.
  const counts = new Map();
  for (const id of owned) counts.set(id, (counts.get(id) || 0) + 1);
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
  const supplyIds = Object.keys(SUPPLIES).filter((k) => p.inventory[k] > 0);
  const cells = [
    ...(bagFilter === "supply"
      ? []
      : gearIds.filter((id) => bagFilter === "all" || GEAR[id].slot === bagFilter)),
    ...(bagFilter === "all" || bagFilter === "supply"
      ? supplyIds.map((k) => "supply:" + k)
      : []),
  ];
  if (!cells.includes(selected)) selected = cells[0] ?? null;

  const cell = (key) => {
    const supply = key.startsWith("supply:") ? key.slice(7) : null,
      g = supply ? SUPPLIES[supply] : GEAR[key],
      count = supply ? p.inventory[supply] : counts.get(key),
      worn = !supply && p.equipment[g.slot] === key;
    return `<button data-inspect="${key}" aria-pressed="${selected === key}" title="${g.name}" class="inv-cell ${rarity(g)} ${selected === key ? "selected" : ""}">${worn ? '<i class="inv-worn" aria-label="สวมใส่อยู่">◆</i>' : ""}<b>${supply ? supplyArt(supply) : itemArt(key, g)}</b><small>${count}</small></button>`;
  };
  // Fill to whole rows of six, at least four rows.
  const empty = Math.max(24, Math.ceil(cells.length / 6) * 6) - cells.length;

  const slot = (name) => {
    const id = p.equipment[name],
      g = GEAR[id];
    const level = enhancementLevel(p, name);
    return `<button data-inspect="${id || ""}" ${g ? "" : "disabled"} class="inv-slot ${g ? rarity(g) : "empty"}" title="${g?.name || SLOTS[name]}"><b>${g ? itemArt(id, g) : filterIcons[name]}</b>${level && g ? `<small>+${level}</small>` : ""}</button>`;
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
    <div class="inv-stats">${Object.entries(stats)
      .map(
        ([k, v]) =>
          `<div><i>${statIcons[k] || ""}</i><span>${statNames[k]}</span><b>${v}</b></div>`,
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

function detailCard(p, area, stats, key, counts) {
  if (!key)
    return `<aside class="inv-detail empty"><p>ไม่มีของในหมวดนี้<br>เก็บของจากดันเจียนเพื่อเติมกระเป๋า</p></aside>`;
  if (key.startsWith("supply:")) {
    const id = key.slice(7),
      s = SUPPLIES[id],
      usable =
        id !== "ore" &&
        p.hp > 0 &&
        (id === "hp" ? p.hp < stats.hp : p.mp < stats.mp);
    return `<aside class="inv-detail ${rarity(s)}"><div class="inv-detail-art">${supplyArt(id)}</div><h3>${s.name}</h3><div class="inv-pills"><span>วัตถุดิบ</span><span class="rarity">${RARITIES[s.rarity]}</span></div><p class="inv-lore">${s.text}</p><div class="inv-detail-stats"><div><span>จำนวนในกระเป๋า</span><b>×${p.inventory[id]}</b></div></div>${id === "ore" ? "" : `<button class="inv-action" data-use="${id}" ${usable ? "" : "disabled"}>${usable ? "ใช้" : "พลังเต็มอยู่แล้ว"}</button>`}</aside>`;
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
  return `<aside class="inv-detail ${rarity(item)}">
    <div class="inv-detail-art">${itemArt(key, item)}</div>
    <h3>${item.name}${equipped && level ? ` +${level}` : ""}</h3>
    <div class="inv-pills"><span>${SLOTS[item.slot]}${counts.get(key) > 1 ? ` ×${counts.get(key)}` : ""}</span><span class="rarity">ระดับ${RARITIES[item.rarity]}</span></div>
    ${item.lore ? `<p class="inv-lore">${item.lore}</p>` : ""}
    <h4>ค่าสถานะ</h4>
    <div class="inv-detail-stats">${
      Object.entries(item.stats)
        .map(
          ([k, v]) =>
            `<div><i>${statIcons[k] || ""}</i><span>${statNames[k]}</span><b>+${v}</b></div>`,
        )
        .join("") || "<div><span>อุปกรณ์เริ่มต้น</span></div>"
    }</div>
    <h4>เงื่อนไขสวมใส่</h4>
    <div class="inv-reqs">${item.class ? `<div>${check(classOk)}<span>อาชีพ: ${CLASSES[item.class].name}</span></div>` : ""}<div>${check(levelOk)}<span>เลเวลขั้นต่ำ: ${item.level}</span></div>${item.floor ? `<div><em class="ok">◆</em><span>ดรอปจากบอสชั้น ${item.floor}</span></div>` : ""}</div>
    <div class="inv-compare ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${equipped ? "ถ้าถอด" : "ถ้าสวม"} พลัง ${now.toLocaleString()} → ${next.toLocaleString()} <b>${diff >= 0 ? "+" : ""}${diff}</b></div>
    <button class="inv-action" data-equip="${key}" data-slot="${item.slot}" ${canEquip ? "" : "disabled"}>${filterIcons.armor}<span>${label}</span></button>
  </aside>`;
}
// ---------------------------------------------------------------------------
// Class & skills: hero on a pedestal, the path tree (class → two lines at
// Lv.3 → advanced form at ADVANCE_LEVEL), and the class skill list. Picking a
// node previews it; "ยืนยันเส้นทาง" applies the pick or the advancement.
let pickedSpec = null;
const lock = icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
function classPage(p, area, spec, cls) {
  const specs = SPECIALIZATIONS[p.class];
  if (!specs.some((s) => s.id === pickedSpec)) pickedSpec = p.specialization;
  const picked = specs.find((s) => s.id === pickedSpec),
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
    <div class="cls-figure"><div class="cls-hero-art" style="${heroPortraitStyle(p)}"></div><i class="inv-pedestal"></i></div>
    <div class="inv-nameplate">${spec?.name || cls.name} · Lv.${p.level}</div>
    <div class="cls-role"><span>${spec?.icon || cls.icon}</span><div><strong>${spec?.role || cls.name}</strong><small>${spec?.description || "เลือกสายพัฒนาเมื่อ Lv.3 เพื่อปลดล็อกพลังเฉพาะทาง"}</small></div></div>
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

export function bindRpgPanel(root, p, handlers) {
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
          (supply ? bagFilter !== "supply" : GEAR[selected]?.slot !== bagFilter)
        )
          bagFilter = "all";
        handlers.open("inventory");
      }),
  );
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
        `<article class="shop-gear ${rarity(g)}"><b>${itemArt(id, g)}</b><div><small>${RARITIES[g.rarity]} · ${SLOTS[g.slot]} · Lv.${g.level}</small><h4>${g.name}</h4><p>${statText(g.stats)}</p></div><button data-buy-gear="${id}" ${p.ownedEquipment.includes(id) || p.gold < g.price ? "disabled" : ""}>${p.ownedEquipment.includes(id) ? "เป็นเจ้าของแล้ว" : `${g.price} ◈`}</button></article>`,
    )
    .join("")}</div>`;
}
