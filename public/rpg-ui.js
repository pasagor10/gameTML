import {
  GEAR,
  SLOTS,
  RARITIES,
  SPECIALIZATIONS,
  CLASS_SKILLS,
} from "/shared/rpg.js";
import { CLASSES, combatPower } from "/shared/config.js";
import { ACTIONS } from "/shared/motion.js";
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
const rarity = (item) => `rarity-${item.rarity}`;
export function rpgPanel(p, area, tab = "inventory") {
  const stats = p.stats,
    cls = CLASSES[p.class],
    owned = (p.ownedEquipment || []).filter((id) => GEAR[id]);
  const spec = SPECIALIZATIONS[p.class].find((s) => s.id === p.specialization);
  const base = `<div class="rpg-summary"><span class="class-crest">${cls.icon}</span><div><small>ผู้กล้า · LEVEL ${p.level}</small><h3>${cls.name} <span>${spec?.name || "ยังไม่เลือกสายพัฒนา"}</span></h3></div><strong>◈ ${p.gold.toLocaleString()} <small>ทอง</small></strong></div><div class="rpg-tabs"><button data-rpg-tab="inventory" class="${tab === "inventory" ? "active" : ""}">อุปกรณ์ & กระเป๋า <kbd>I</kbd></button><button data-rpg-tab="class" class="${tab === "class" ? "active" : ""}">คลาส & สกิล <kbd>C</kbd></button></div>`;
  if (tab === "class")
    return (
      base +
      `<div class="class-page"><div class="class-intro"><span>${cls.icon}</span><div><small>เส้นทางของผู้กล้า</small><h3>เลือกสไตล์การต่อสู้ของคุณ</h3><p>เลือกสายพัฒนาได้เมื่อเลเวล 3 · เปลี่ยนสายได้ฟรีในเมือง</p></div><b>${p.level >= 3 ? "ปลดล็อกแล้ว" : `อีก ${3 - p.level} เลเวล`}</b></div><div class="specialization-grid">${SPECIALIZATIONS[p.class].map((s) => `<article class="specialization ${s.id === p.specialization ? "chosen" : ""}"><span>${s.icon}</span><small>${s.role}</small><h3>${s.name}</h3><p>${s.description}</p><div class="stat-bonus">${statText(s.stats)}</div><button data-spec="${s.id}" ${p.level < 3 || area !== "town" || s.id === p.specialization ? "disabled" : ""}>${s.id === p.specialization ? "✓ สายที่เลือกอยู่" : p.level < 3 ? "ปลดล็อกเลเวล 3" : area !== "town" ? "กลับเมืองเพื่อเปลี่ยนสาย" : "เลือกสายนี้"}</button></article>`).join("")}</div><h4 class="rpg-section-title">สกิลประจำคลาส <span>Q / W / E</span></h4><div class="skill-codex">${CLASS_SKILLS[p.class].map((s, i) => `<article><b>${s.icon}</b><div><h4>${s.name} <kbd>${["Q", "W", "E"][i]}</kbd></h4><p>${s.detail}</p><small>${ACTIONS[i + 1].mp} MP · คูลดาวน์ ${ACTIONS[i + 1].cooldown} วินาที</small></div></article>`).join("")}</div></div>`
    );
  if (!owned.includes(selected)) selected = owned[0];
  const item = GEAR[selected];
  const equipped = item && p.equipment[item.slot] === selected;
  const previous = item ? GEAR[p.equipment[item.slot]] : null;
  const comparedStats = { ...stats };
  if (item)
    for (const key of new Set([
      ...Object.keys(item.stats),
      ...Object.keys(previous?.stats || {}),
    ]))
      comparedStats[key] =
        (stats[key] || 0) +
        (equipped
          ? -(item.stats[key] || 0)
          : (item.stats[key] || 0) - (previous?.stats[key] || 0));
  if (item?.slot === "weapon" && p.upgrade) {
    if (equipped) comparedStats.atk -= p.upgrade * 8;
    else if (!previous) comparedStats.atk += p.upgrade * 8;
  }
  const currentPower = p.power ?? combatPower(stats);
  const comparedPower = combatPower(comparedStats);
  const deltas = item
    ? [
        ...new Set([
          ...Object.keys(item.stats),
          ...Object.keys(previous?.stats || {}),
        ]),
      ]
        .map((key) => {
          const delta = (comparedStats[key] || 0) - (stats[key] || 0);
          return `<span class="${delta < 0 ? "negative" : delta > 0 ? "positive" : ""}">${statNames[key]} ${delta > 0 ? "+" : ""}${delta}</span>`;
        })
        .join("")
    : "";
  const canEquip =
    item &&
    (!item.class || item.class === p.class) &&
    p.level >= item.level &&
    area === "town";
  return (
    base +
    `<div class="equipment-layout"><aside class="character-sheet"><div class="paper-hero"><span>${cls.icon}</span><small>${spec?.role || cls.name}</small></div><div class="power-score"><small>พลังรวม</small><strong>${currentPower.toLocaleString()}</strong></div><div class="character-stats">${Object.entries(
      stats,
    )
      .map(([k, v]) => `<div><span>${statNames[k]}</span><b>${v}</b></div>`)
      .join(
        "",
      )}</div><h4 class="rpg-section-title">กำลังสวมใส่</h4><div class="equipped-grid">${Object.entries(
      SLOTS,
    )
      .map(([slot, name]) => {
        const id = p.equipment[slot],
          g = GEAR[id];
        return `<button data-inspect="${id || ""}" ${g ? "" : "disabled"} class="equipped-slot ${g ? rarity(g) : ""}"><small>${name}</small><b>${g?.icon || "+"}</b><span>${g?.name || "ช่องว่าง"}${slot === "weapon" && p.upgrade ? ` +${p.upgrade}` : ""}</span></button>`;
      })
      .join(
        "",
      )}</div></aside><section class="bag-content"><h4 class="rpg-section-title">คลังอุปกรณ์ <span>${owned.length} ชิ้น · เลือกเพื่อดูรายละเอียด</span></h4><div class="gear-grid">${owned
      .map((id) => {
        const g = GEAR[id];
        return `<button data-inspect="${id}" class="gear-card ${rarity(g)} ${selected === id ? "selected" : ""}"><span class="gear-equipped">${p.equipment[g.slot] === id ? "สวมอยู่" : RARITIES[g.rarity]}</span><b>${g.icon}</b><strong>${g.name}</strong><small>Lv.${g.level} · ${g.class ? CLASSES[g.class].name : "ทุกคลาส"}</small></button>`;
      })
      .join(
        "",
      )}</div>${item ? `<div class="item-inspector ${rarity(item)}"><span class="item-large-icon">${item.icon}</span><div><small>${RARITIES[item.rarity]} · ${SLOTS[item.slot]}${item.floor ? ` · บอสชั้น ${item.floor}` : ""}</small><h3>${item.name}</h3><p>${statText(item.stats)}</p>${item.lore ? `<p class="item-lore">${item.lore}</p>` : ""}<div class="item-deltas">${equipped ? "เมื่อถอด" : "เมื่อสวม"} ${deltas || "ไม่มีค่าสถานะเปลี่ยน"}<span class="${comparedPower < currentPower ? "negative" : comparedPower > currentPower ? "positive" : ""}">พลัง ${currentPower.toLocaleString()} → ${comparedPower.toLocaleString()} (${comparedPower - currentPower >= 0 ? "+" : ""}${comparedPower - currentPower})</span></div></div><button data-equip="${selected}" data-slot="${item.slot}" ${!canEquip ? "disabled" : ""}>${equipped ? "ถอดออก" : area !== "town" ? "สวมใส่ในเมือง" : p.level < item.level ? `ต้องการ Lv.${item.level}` : item.class && item.class !== p.class ? "ไม่ตรงคลาส" : "สวมใส่"}</button></div>` : ""}<h4 class="rpg-section-title">เสบียง & วัตถุดิบ</h4><div class="supply-row"><button data-use="hp"><b>✚</b><span>ยา HP <strong>×${p.inventory.hp}</strong><small>ฟื้นฟู 90 HP</small></span></button><button data-use="mp"><b>✦</b><span>ยา MP <strong>×${p.inventory.mp}</strong><small>ฟื้นฟู 80 MP</small></span></button><div><b>◈</b><span>แร่จันทรา <strong>×${p.inventory.ore}</strong><small>ใช้ที่โรงตีอาวุธ</small></span></div></div><p class="hint">บอสแต่ละชั้นมีชุดของเฉพาะ · รอบแรกได้อาวุธประจำอาชีพ · ของซ้ำเมื่อสะสมครบเปลี่ยนเป็นแร่จันทรา</p></section></div>`
  );
}
export function bindRpgPanel(root, p, handlers) {
  root
    .querySelectorAll("[data-rpg-tab]")
    .forEach((b) => (b.onclick = () => handlers.open(b.dataset.rpgTab)));
  root.querySelectorAll("[data-inspect]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.inspect;
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
        `<article class="shop-gear ${rarity(g)}"><b>${g.icon}</b><div><small>${RARITIES[g.rarity]} · ${SLOTS[g.slot]} · Lv.${g.level}</small><h4>${g.name}</h4><p>${statText(g.stats)}</p></div><button data-buy-gear="${id}" ${p.ownedEquipment.includes(id) || p.gold < g.price ? "disabled" : ""}>${p.ownedEquipment.includes(id) ? "เป็นเจ้าของแล้ว" : `${g.price} ◈`}</button></article>`,
    )
    .join("")}</div>`;
}
