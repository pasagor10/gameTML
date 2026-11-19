// World boss HUD: the call-to-arms banner in town (with a join button) and
// the live damage ranking inside the arena. Driven by state.worldBoss.
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const clock = (s) =>
  Math.floor(s / 60) + ":" + String(Math.max(0, s % 60)).padStart(2, "0");
const short = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k" : String(n));

import { GRAND_BOSS } from "/shared/world-boss.js";
let bound = false,
  lastBanner = "",
  lastRank = "";
export function updateWorldBossHud(state, onJoin, onNews) {
  const wb = state.worldBoss,
    banner = $("#world-boss"),
    rank = $("#world-rank");
  if (!banner || !rank || !wb) return;
  if (!bound) {
    bound = true;
    banner.addEventListener("click", (e) => {
      if (e.target.closest("[data-wb-join]")) onJoin();
      if (e.target.closest("[data-wb-news]")) onNews?.();
    });
  }
  const inArena = !!state.dungeon?.world,
    soon = !wb.open && wb.grandIn > 0 && wb.grandIn <= 3600,
    showBanner = (wb.open || soon) && state.area === "town";
  banner.classList.toggle("hidden", !showBanner);
  banner.classList.toggle("grand", showBanner && (soon || !!wb.grand));
  if (showBanner && soon) {
    const html = `<span class="wb-crown" aria-hidden="true">🌟</span><div class="wb-body"><small>มหาบอส 2 ทุ่ม · เริ่มในอีก ${clock(wb.grandIn)}</small><b>${esc(GRAND_BOSS.name)}</b><em>ปราบสำเร็จ ผู้เข้าร่วมทุกคนรับหินตีบวก 100%</em></div><button data-wb-news class="primary-button">รายละเอียด</button>`;
    if (html !== lastBanner) banner.innerHTML = lastBanner = html;
  } else if (showBanner) {
    const pct = wb.maxHp ? Math.round((wb.hp / wb.maxHp) * 100) : 100,
      html = `<span class="wb-crown" aria-hidden="true">${wb.grand ? "🌟" : "👑"}</span><div class="wb-body"><small>${wb.grand ? "มหาบอส 2 ทุ่มปรากฏ!" : "บอสโลกปรากฏ!"} · หนีในอีก ${clock(wb.left)}</small><b>${esc(wb.name)}</b><div class="wb-hp"><i style="width:${pct}%"></i><span>${pct}%</span></div><em>ผู้กล้าร่วมรบ ${wb.heroes} คน · ${wb.grand ? "ปราบได้ ทุกคนที่เข้าร่วมรับหินตีบวก 100%" : "ทุกคนที่ตีได้รับรางวัลตามความเสียหาย"}</em></div><button data-wb-join class="primary-button">${wb.joined ? "กลับเข้าสนาม" : "เข้าร่วม"} ➜</button>`;
    if (html !== lastBanner) banner.innerHTML = lastBanner = html;
  }
  rank.classList.toggle("hidden", !inArena);
  if (inArena) {
    const rows = wb.ranking
      .map(
        (r) =>
          `<li class="${r.id === state.self.id ? "me" : ""} p${r.place}"><b>${r.place}</b><span>${esc(r.name)}</span><em>${short(r.damage)}</em><small>${Math.round(r.share * 100)}%</small></li>`,
      )
      .join("");
    const mine =
      wb.mine && wb.mine.place > 5
        ? `<li class="me"><b>${wb.mine.place}</b><span>คุณ</span><em>${short(wb.mine.damage)}</em><small>${Math.round(wb.mine.share * 100)}%</small></li>`
        : "";
    const html = `<header><span>อันดับความเสียหาย</span><small>${wb.done === "killed" ? "พ่ายแพ้แล้ว!" : "⏳ " + clock(wb.left)}</small></header><ol>${rows || '<li class="empty">ยังไม่มีใครโจมตี — ลุยเลย!</li>'}${mine}</ol><footer>ผู้กล้า ${wb.heroes} คน · อยู่ในสนาม ${wb.fighting} · 💠 หินตีบวกขั้นสูง · อันดับ 1: 3 ก้อน / 2–3: 2 ก้อน / อื่น ๆ: 1 ก้อน</footer>`;
    if (html !== lastRank) rank.innerHTML = lastRank = html;
  }
}

// Line for the minimap zone while waiting for the next one.
export const worldBossCountdown = (wb) =>
  !wb
    ? ""
    : wb.open
      ? wb.grand ? "🌟 มหาบอส 2 ทุ่มอยู่!" : "👑 บอสโลกอยู่!"
      : wb.grandIn > 0 && wb.grandIn <= 3600
        ? `🌟 มหาบอส 2 ทุ่ม · อีก ${clock(wb.grandIn)}`
        : `👑 บอสโลก · ทุก 30 นาที · มหาบอส 20:00`;
