const labels = { level: "เลเวล", dungeon: "ชั้นที่พิชิต", gold: "ทอง" };
const jobs = { swordsman: "นักดาบ", archer: "นักธนู", mage: "จอมเวท", priest: "พระ" };
export function communityPanel(panel, { modal, escape, self, open }) {
  if (panel === "poster") {
    modal("TML ONLINE · รวมพลผู้กล้า", `<div class="game-poster"><img src="/assets/poster-tml.webp?v=1" alt="โปสเตอร์ TML ONLINE นักธนูใต้แสงจันทร์"><button class="primary-button" id="poster-ranking">🏆 ดูอันดับผู้กล้า</button></div>`, "poster");
    document.querySelector("#poster-ranking").onclick = () => open("ranking");
    return true;
  }
  if (panel !== "ranking") return false;
  let request = 0;
  const render = async (metric = "level") => {
    const ticket = ++request;
    modal("ทำเนียบผู้กล้า · Ranking", `<div class="ranking-tabs">${Object.entries(labels).map(([key,label]) => `<button data-rank="${key}" class="${key===metric?"active":""}" aria-pressed="${key===metric}">${label}</button>`).join("")}</div><p class="hint">รวมผู้เล่นออนไลน์และออฟไลน์ · ชั้นที่พิชิต = ชั้นสูงสุดที่ปลดล็อก − 1</p><div id="ranking-results" aria-live="polite">กำลังโหลดอันดับ…</div>`, "ranking");
    document.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => render(b.dataset.rank));
    try {
      const response = await fetch(`/api/ranking?metric=${metric}`, { cache: "no-store" });
      if (!response.ok) throw Error("โหลดอันดับไม่สำเร็จ กรุณาเปิดใหม่อีกครั้ง");
      const data = await response.json();
      if (ticket !== request || document.querySelector("#modal").dataset.panel !== "ranking") return;
      const row = p => `<tr class="${p.id===self.id?"ranking-self":""}"><td>${p.place<=3?["🥇","🥈","🥉"][p.place-1]:p.place}</td><td><strong>${escape(p.name)}</strong><small>${escape(jobs[p.class] || p.class)} · Lv.${p.level}${p.id===self.id?" · คุณ":""}</small></td><td>${p[metric].toLocaleString()}</td></tr>`;
      document.querySelector("#ranking-results").innerHTML = `<p class="ranking-summary">ผู้กล้าทั้งหมด ${data.total.toLocaleString()} คน · 100 อันดับแรก</p>${data.self && data.self.place>100?`<p class="ranking-summary">อันดับของคุณ #${data.self.place} · ${labels[metric]} ${data.self[metric].toLocaleString()}</p>`:""}<table class="ranking-table"><thead><tr><th>อันดับ</th><th>ผู้กล้า</th><th>${labels[metric]}</th></tr></thead><tbody>${data.entries.map(row).join("") || '<tr><td colspan="3">ยังไม่มีผู้เล่น</td></tr>'}</tbody></table>`;
    } catch(error) {
      if (ticket===request && document.querySelector("#modal").dataset.panel==="ranking") document.querySelector("#ranking-results").textContent=error.message;
    }
  };
  render();
  return true;
}
