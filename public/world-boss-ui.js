// World boss HUD: the call-to-arms banner in town (with a join button) and
// the live damage ranking inside the arena. Driven by state.worldBoss.
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const clock = (s) =>
  Math.floor(s / 60) + ":" + String(Math.max(0, s % 60)).padStart(2, "0");
const short = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k" : String(n));

let bound = false,
  lastBanner = "",
  lastRank = "";
export function updateWorldBossHud(state, onJoin) {
  const wb = state.worldBoss,
    banner = $("#world-boss"),
    rank = $("#world-rank");
  if (!banner || !rank || !wb) return;
  if (!bound) {
    bound = true;
    banner.addEventListener("click", (e) => {
      if (e.target.closest("[data-wb-join]")) onJoin();
    });
  }
  const inArena = !!state.dungeon?.world,
    showBanner = wb.open && state.area === "town";
  banner.classList.toggle("hidden", !showBanner);
  if (showBanner) {
    const pct = wb.maxHp ? Math.round((wb.hp / wb.maxHp) * 100) : 100,
      html = `<span class="wb-crown" aria-hidden="true">👑</span><div class="wb-body"><small>บอสโลกปรากฏ! · หนีในอีก ${clock(wb.left)}</small><b>${esc(wb.name)}</b><div class="wb-hp"><i style="width:${pct}%"></i><span>${pct}%</span></div><em>ผู้กล้าร่วมรบ ${wb.heroes} คน · ทุกคนที่ตีได้รับรางวัลตามความเสียหาย</em></div><button data-wb-join class="primary-button">${wb.joined ? "กลับเข้าสนาม" : "เข้าร่วม"} ➜</button>`;
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
    const html = `<header><span>อันดับความเสียหาย</span><small>${wb.done === "killed" ? "พ่ายแพ้แล้ว!" : "⏳ " + clock(wb.left)}</small></header><ol>${rows || '<li class="empty">ยังไม่มีใครโจมตี — ลุยเลย!</li>'}${mine}</ol><footer>ผู้กล้า ${wb.heroes} คน · อยู่ในสนาม ${wb.fighting} · อันดับ 1: ตำนาน 3 ชิ้น / 2–3: 2 ชิ้น / อื่น ๆ: 1 ชิ้น</footer>`;
    if (html !== lastRank) rank.innerHTML = lastRank = html;
  }
}

// Line for the minimap zone while waiting for the next one.
export const worldBossCountdown = (wb) =>
  !wb ? "" : wb.open ? "👑 บอสโลกอยู่!" : `👑 เจ้าแม่นางนอน · ทุกวัน 20:00 น.`;
