const labels = { level: "เลเวล", dungeon: "ชั้นที่พิชิต", gold: "ทอง" };
const jobs = { swordsman: "นักดาบ", archer: "นักธนู", mage: "จอมเวท", priest: "พระ" };
// Patch news: the Lv.60 update and the 20:00 grand boss, as two banners.
export const NEWS_ID = "patch-celestial-relics-1";
const hms = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
};
let newsTimer = 0;
function newsPanel({ modal, worldBoss, join }) {
  const live = !!(worldBoss?.open && worldBoss.grand),
    target = Date.now() + (worldBoss?.grandIn || 0) * 1000,
    when = () => (live ? "🔥 สนามเปิดอยู่ตอนนี้! เข้าร่วมก่อนบอสหนี" : `เริ่มในอีก ${hms((target - Date.now()) / 1000)}`);
  modal("ข่าวอัปเดต · TML ONLINE", `<div class="news">
<article class="news-banner patch">
  <span class="nb-tag">CELESTIAL RELICS</span>
  <img src="/assets/items/divine/armor.webp" alt="เกราะเทพพิทักษ์ดารา" width="96" height="96">
  <h3>สมบัติเทพแห่งดารา</h3>
  <p>เกราะ · เครื่องราง · รองเท้าระดับเทพ พร้อมรัศมีเมื่อสวมใส่</p>
  <p>Lv.40 ขึ้นไป ชนะบอสชั้น 10+ หรือมหาบอส 20:00 น. ลุ้น 5% ต่อรอบ สุ่มชิ้นที่ยังไม่มี ไม่ขายในร้านและไม่อยู่ในตู้สุ่ม</p>
  <p class="nb-note">20 รอบมีโอกาสได้อย่างน้อยหนึ่งชิ้นประมาณ 64% ไม่การันตี · หีบเสบียงและรูนถ้ำมีภาพและเอฟเฟกต์ใหม่</p>
</article>
<article class="news-banner patch">
  <span class="nb-tag">PATCH UPDATE</span>
  <div class="nb-big" aria-label="เลเวลสูงสุด 60">Lv.<b>60</b></div>
  <h3>ขยายเลเวลสูงสุดเป็น Lv.60</h3>
  <ul>
    <li>เลเวล 41–60 · HP MP ATK และแต้มสเตตัสเพิ่มทุกเลเวล</li>
    <li>บอสทุกชั้นมีกลไกใหม่ 🪨 หินถล่ม · 🌊 น้ำท่วม · ⛰ หนามปะทุ · ⚡ อัสนีตามตัว</li>
    <li>สกิลบอสแรงขึ้นมาก ดูวงเตือนแล้วหลบให้ทัน · น้ำท่วมต้องขึ้นไปยืนบนชั้น</li>
  </ul>
</article>
<article class="news-banner grand">
  <img src="/assets/items/supply-8.webp" alt="หินตีบวก 100%" width="96" height="96">
  <span class="nb-tag">ทุกวัน 20:00 น.</span>
  <h3>มหาบอส 2 ทุ่ม<small>มหาเทพีนางนอน</small></h3>
  <p>บอสใหญ่ที่สุดของถ้ำหลวง ถึกกว่าบอสโลกปกติ 3 เท่า · ใช้กลไกครบทุกแบบ</p>
  <p class="nb-reward">ปราบสำเร็จ ผู้เข้าร่วม<b>ทุกคน</b>รับ 🌟 หินตีบวก 100%</p>
  <p class="nb-note">ตีบวกสำเร็จแน่นอน 1 ครั้ง ไม่เสียทองและแร่ · ใช้ที่โรงตีลุงเหล็ก</p>
  <div class="nb-when" aria-live="polite">${when()}</div>
  ${live ? '<button id="news-join" class="primary-button">เข้าร่วมมหาบอส ➜</button>' : ""}
</article>
<button id="news-close" class="primary-button">เข้าใจแล้ว ลุยเลย!</button>
</div>`, "news");
  document.querySelector("#news-close").onclick = () => document.querySelector("#modal-close").click();
  const btn = document.querySelector("#news-join");
  if (btn) btn.onclick = () => join();
  clearInterval(newsTimer);
  newsTimer = setInterval(() => {
    const el = document.querySelector('#modal[data-panel="news"] .nb-when');
    if (!el) return clearInterval(newsTimer);
    el.textContent = when();
  }, 1000);
}
export function communityPanel(panel, { modal, escape, self, open, worldBoss, join }) {
  if (panel === "news") {
    newsPanel({ modal, worldBoss, join });
    return true;
  }
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
