// Player market: browse every listing across town shops, and run your own shop.
import { itemArt, supplyArt } from "/item-art.js";
import { GEAR, SLOTS, RARITIES } from "/shared/rpg.js";
import { ITEMS, CLASSES, STACK_SUPPLIES } from "/shared/config.js";
import { COSTUME_ITEMS, costumeFits } from "/shared/costumes.js";
import { statText } from "/rpg-ui.js?v=20";

// Stacks sell by count: supplies, and costumes (shared/costumes.js).
const STACKS = [...STACK_SUPPLIES, ...Object.keys(COSTUME_ITEMS)];
const isCostume = (id) => !!COSTUME_ITEMS[id];
const FILTERS = [
  ["all", "ทั้งหมด"],
  ["supply", "ยา & วัตถุดิบ"],
  ["costume", "ชุดแต่งกาย"],
  ["weapon", "อาวุธ"],
  ["armor", "เกราะ"],
  ["accessory", "เครื่องราง & รองเท้า"],
];
const RARITY_PRICE = { common: 60, rare: 250, epic: 800, legendary: 2500, divine: 6000 };
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// UI state survives the live re-renders while the panel stays open.
export const marketState = {
  filter: "all",
  shop: null, // set when a stall was clicked in town: show only that stall
  buyQty: {},
  pick: null,
  qty: 1,
  price: null,
  name: "",
};

const isStack = (id) => STACKS.includes(id);
const info = (id) => (isStack(id) ? ITEMS[id] || COSTUME_ITEMS[id] : GEAR[id]);
const art = (id) => (isStack(id) ? supplyArt(id) : itemArt(id, GEAR[id]));
const group = (id) =>
  isCostume(id)
    ? "costume"
    : isStack(id)
    ? "supply"
    : GEAR[id]?.slot === "weapon" || GEAR[id]?.slot === "armor"
      ? GEAR[id].slot
      : "accessory";
function detail(id) {
  if (isCostume(id))
    return `ชุดแต่งกาย · ${RARITIES[COSTUME_ITEMS[id].rarity]} · ${costumeFits(id)}`;
  if (isStack(id)) return "ของใช้ · ซื้อเป็นกองได้";
  const g = GEAR[id];
  const cls = g.class ? " · " + (CLASSES[g.class]?.name || g.class) : "";
  return `${RARITIES[g.rarity]} · ${SLOTS[g.slot]} · Lv.${g.level}${cls} · ${statText(g.stats, g.attrs)}`;
}
export function suggestPrice(id) {
  if (isStack(id)) return info(id).price;
  const g = GEAR[id];
  return g.price
    ? Math.round(g.price * 0.8)
    : Math.round((RARITY_PRICE[g.rarity] || 100) * (1 + (g.floor || 0) * 0.25));
}

// What this hero could put on sale right now, and what is blocked.
export function stockOf(p) {
  const equipped = new Set(Object.values(p.equipment || {}));
  const stacks = STACKS.filter((id) => (p.inventory[id] || 0) > 0).map(
    (id) => ({ id, have: p.inventory[id] }),
  );
  const gear = (p.ownedEquipment || [])
    .filter((id) => GEAR[id] && !id.startsWith("starter_"))
    .map((id) => ({ id, have: 1, locked: equipped.has(id) }));
  return [...stacks, ...gear];
}

export function marketHtml(state) {
  const p = state.self,
    m = marketState;
  const stall = m.shop && state.shops.find((s) => s.id === m.shop);
  if (m.shop && !stall) m.shop = null;
  const listings = (stall ? [stall] : state.shops).flatMap((s) =>
    (s.listings || []).map((l) => ({ ...l, shop: s })),
  );
  const shown = listings.filter(
    (l) => info(l.item) && (m.filter === "all" || group(l.item) === m.filter),
  );
  const mine = state.shops.find((s) => s.owner === p.id);
  const cards = shown
    .map((l) => {
      const it = info(l.item),
        own = l.shop.owner === p.id,
        owned = !isStack(l.item) && p.ownedEquipment.includes(l.item),
        qty = Math.min(l.qty, Math.max(1, m.buyQty[l.id] || 1)),
        total = qty * l.price,
        poor = p.gold < total,
        rarity = isStack(l.item) && !isCostume(l.item) ? "" : `rarity-${it.rarity}`;
      const stepper = isStack(l.item)
        ? `<div class="qty-step"><button data-buy-step="${l.id}" data-d="-1" ${qty <= 1 ? "disabled" : ""}>−</button><b>${qty}</b><button data-buy-step="${l.id}" data-d="1" ${qty >= l.qty ? "disabled" : ""}>+</button><button data-buy-max="${l.id}" class="qty-max">สูงสุด</button></div>`
        : "";
      const label = own
        ? "ร้านของคุณ"
        : owned
          ? "มีอยู่แล้ว"
          : poor
            ? "ทองไม่พอ"
            : `ซื้อ ${total.toLocaleString()} ◈`;
      return `<article class="market-card ${rarity}"><div class="market-art">${art(l.item)}</div><div class="market-info"><h4>${esc(it.name)}</h4><small>${esc(detail(l.item))}</small><p>🏪 ${esc(l.shop.name)} · ${esc(l.shop.ownerName)}</p></div><div class="market-buy"><span class="market-price">${l.price.toLocaleString()} ◈<small>/ชิ้น · เหลือ ${l.qty}</small></span>${stepper}<button class="primary-button" data-listing-buy="${l.id}" ${own || owned || poor ? "disabled" : ""}>${label}</button></div></article>`;
    })
    .join("");
  const scope = stall
    ? `<div class="market-stall"><span>🏪 ${esc(stall.name)} · ${esc(stall.ownerName)}</span><button id="market-all" class="text-button">ดูทุกร้าน →</button></div>`
    : "";
  return `${scope}<div class="market-head"><div><small>${stall ? `ร้านนี้ · ขายไปแล้ว ${stall.sold || 0} ชิ้น` : `ร้านค้าจากผู้เล่นจริง · ${state.shops.length} ร้าน`} · ${listings.length} รายการ</small><strong>${supplyArt("gold")} ${p.gold.toLocaleString()} ทอง</strong></div><button id="open-own-shop" class="secondary-button">${mine ? "🏪 จัดการร้านของฉัน" : "＋ ตั้งร้านของฉัน"}</button></div><div class="market-filters">${FILTERS.map(([id, name]) => `<button data-market-filter="${id}" class="${m.filter === id ? "active" : ""}">${name}</button>`).join("")}</div><div class="market-grid">${cards || `<p class="market-empty">${listings.length ? "ไม่มีสินค้าในหมวดนี้" : stall ? "ร้านนี้ขายหมดแล้ว" : "ยังไม่มีใครวางขาย · ตั้งร้านแรกของเมืองได้เลย"}</p>`}</div>`;
}

export function shopManagerHtml(state) {
  const p = state.self,
    m = marketState,
    shop = state.shops.find((s) => s.owner === p.id),
    stock = stockOf(p);
  if (m.pick && !stock.some((s) => s.id === m.pick && !s.locked)) m.pick = null;
  const picked = stock.find((s) => s.id === m.pick);
  if (picked) {
    m.qty = Math.max(1, Math.min(isStack(picked.id) ? picked.have : 1, m.qty || 1));
    m.price ??= suggestPrice(picked.id);
  }
  const listed = (shop?.listings || [])
    .map(
      (l) =>
        `<div class="item-row"><span class="market-art small">${art(l.item)}</span><div><strong>${esc(info(l.item)?.name || l.item)} ×${l.qty}</strong><small>${l.price.toLocaleString()} ทอง/ชิ้น · รวม ${(l.qty * l.price).toLocaleString()}</small></div><button data-unlist="${l.id}">เก็บคืน</button></div>`,
    )
    .join("");
  const picker = stock.length
    ? stock
        .map((s) => {
          const it = info(s.id);
          return `<button class="stock-pick ${s.id === m.pick ? "active" : ""} ${isStack(s.id) && !isCostume(s.id) ? "" : "rarity-" + it.rarity}" data-pick="${s.id}" ${s.locked ? "disabled" : ""} title="${esc(it.name)}">${art(s.id)}<small>${s.locked ? "สวมอยู่" : "×" + s.have + " · " + esc(it.name)}</small></button>`;
        })
        .join("")
    : `<p class="market-empty">กระเป๋าว่าง · ลงดันเจียนหาของมาขายก่อน</p>`;
  const form = picked
    ? `<div class="sell-form"><div class="sell-item">${art(picked.id)}<div><strong>${esc(info(picked.id).name)}</strong><small>${esc(detail(picked.id))}</small></div></div>${isStack(picked.id) ? `<label>จำนวน (มี ${picked.have})<input id="sell-qty" type="number" min="1" max="${picked.have}" value="${m.qty}"></label>` : ""}<label>ราคาต่อชิ้น (ทอง)<input id="sell-price" type="number" min="1" max="1000000" value="${m.price}"><small>แนะนำ ${suggestPrice(picked.id).toLocaleString()} ทอง</small></label>${shop ? "" : `<label>ชื่อร้าน<input id="sell-shop-name" maxlength="35" placeholder="ร้านของ ${esc(p.name)}" value="${esc(m.name)}"></label>`}<button id="sell-confirm" class="primary-button">${shop ? "วางขาย" : "เปิดร้านและวางขาย"} ×${isStack(picked.id) ? m.qty : 1} ชิ้น · รวม ${(m.qty * m.price).toLocaleString()} ◈</button></div>`
    : `<p class="hint">เลือกของจากกระเป๋าด้านบนเพื่อตั้งราคาและวางขาย</p>`;
  const head = shop
    ? `<div class="shop-stats"><div><small>ร้าน</small><strong>${esc(shop.name)}</strong></div><div><small>ขายไปแล้ว</small><strong>${shop.sold || 0} ชิ้น</strong></div><div><small>รายได้รวม</small><strong>${(shop.earned || 0).toLocaleString()} ◈</strong></div></div><h4 class="rpg-section-title">กำลังวางขาย <span>${shop.listings?.length || 0} / 12</span></h4>${listed || `<p class="market-empty">ขายหมดแล้ว! วางของเพิ่มได้ด้านล่าง</p>`}`
    : `<p>ตั้งได้หนึ่งร้านต่อบัญชี · ร้านเปิดขายต่อแม้ออกจากเกม · ของที่วางขายจะถูกเก็บเข้าร้านจนกว่าจะขายหรือเก็บคืน</p>`;
  return `${head}<h4 class="rpg-section-title">${shop ? "วางขายเพิ่ม" : "เลือกของที่จะขาย"} <span>ยา แร่ ชุดแต่งกาย และอุปกรณ์ที่ไม่ได้สวม</span></h4><div class="stock-grid">${picker}</div>${form}<div class="shop-foot"><button id="back-market" class="text-button">← กลับตลาด</button>${shop ? `<button id="close-shop" class="text-button danger">ปิดร้านและเก็บของทั้งหมดคืน</button>` : ""}</div>`;
}
