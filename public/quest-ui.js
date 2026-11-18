// Quest window: daily quests, the monster book and the main journey, plus the
// compact daily tracker on the HUD.
import {
  MONSTERS,
  BESTIARY_TIERS,
  bestiaryStars,
  bestiaryBonuses,
  questReward,
  questText,
  DAILY_BONUS,
} from "/shared/quests.js";
import { FLOORS } from "/shared/config.js";

const STAT_NAMES = { atk: "ATK", def: "DEF", hp: "HP", mp: "MP", speed: "ความเร็ว" };
// First idle frame of each monster sheet: [url, cell w, cell h, columns, rows].
const PORTRAITS = {
  slime: ["/assets/animations/slime.png", 256, 256, 4, 6],
  bat: ["monsters/bat", 168, 177],
  golem: ["monsters/golem", 362, 195],
  boar: ["monsters/boar", 253, 136],
  serpent: ["monsters/serpent", 256, 270],
  mushroom: ["monsters/mushroom", 145, 153],
  goblin: ["monsters/goblin", 159, 167],
  wolf: ["monsters/wolf", 274, 131],
  batking: ["monsters/batking", 256, 270],
};
const QUEST_ICONS = {
  kill: "⚔",
  killAny: "☠",
  elite: "♛",
  boss: "♜",
  rune: "ᛟ",
  enhance: "⚒",
};
let tab = "daily";
export const questTab = () => tab;
export function setQuestTab(next) {
  if (["daily", "book", "journey"].includes(next)) tab = next;
}
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function portrait(type, seen = true) {
  const [src, w, h, cols = 4, rows = 1] = PORTRAITS[type] || [];
  if (!src) return "";
  const url = src.startsWith("/")
    ? src
    : `/assets/sprites/${src}/idle/idle-atlas-00.webp`;
  return `<i class="mon-portrait ${seen ? "" : "unseen"}" style="aspect-ratio:${w}/${h};${w >= h ? "width:100%" : "height:100%"};background-image:url(${url});background-size:${cols * 100}% ${rows * 100}%"></i>`;
}
// Claimable rewards, for the HUD badge and the menu button.
export function claimable(daily) {
  if (!daily) return 0;
  const ready = daily.quests.filter((q) => !q.claimed && q.progress >= q.goal).length;
  const bonus = !daily.bonusClaimed && daily.quests.every((q) => q.claimed);
  return ready + (bonus ? 1 : 0);
}
const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds)),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
};
const chips = (r) =>
  [
    r.gold && `<b class="chip chip-gold">◈ ${r.gold}</b>`,
    r.exp && `<b class="chip chip-exp">EXP ${r.exp}</b>`,
    (r.ore || r.energy) && `<b class="chip chip-ore">◆ แร่ ×${(r.ore || 0) + (r.energy || 0) * 2}</b>`,

  ]
    .filter(Boolean)
    .join("");

export function questPanelHtml(p, time) {
  const ready = claimable(p.daily);
  const tabs = `<div class="quest-tabs" role="tablist">${[
    ["daily", `ภารกิจประจำวัน${ready ? ` <em>${ready}</em>` : ""}`],
    ["book", "สมุดล่ามอน"],
    ["journey", "เส้นทางถ้ำหลวง"],
  ]
    .map(
      ([id, label]) =>
        `<button role="tab" data-quest-tab="${id}" aria-selected="${tab === id}" class="${tab === id ? "active" : ""}">${label}</button>`,
    )
    .join("")}</div>`;
  const body =
    tab === "book" ? bookPage(p) : tab === "journey" ? journeyPage(p) : dailyPage(p, time);
  return `<div class="quest-window">${tabs}${body}</div>`;
}

function dailyPage(p, time) {
  const d = p.daily;
  if (!d) return "<p>กำลังโหลดภารกิจ…</p>";
  const done = d.quests.filter((q) => q.claimed).length;
  const cards = d.quests
    .map((q, index) => {
      const complete = q.progress >= q.goal,
        pct = Math.round((q.progress / q.goal) * 100),
        reward = questReward(q, p.level),
        art = q.kind === "kill" ? portrait(q.target) : `<span>${QUEST_ICONS[q.kind]}</span>`;
      const action = q.claimed
        ? `<button disabled class="claimed">รับแล้ว ✓</button>`
        : complete
          ? `<button data-claim="${index}" class="claim">รับรางวัล</button>`
          : `<button disabled>${q.progress} / ${q.goal}</button>`;
      return `<article class="daily-card ${q.claimed ? "is-claimed" : complete ? "is-ready" : ""}"><div class="daily-art">${art}</div><div class="daily-main"><strong>${esc(questText(q))}</strong><div class="daily-bar"><i style="width:${pct}%"></i></div><div class="daily-reward">${chips(reward)}</div></div>${action}</article>`;
    })
    .join("");
  const bonusReady = !d.bonusClaimed && done === d.quests.length;
  const bonus = `<article class="daily-chest ${d.bonusClaimed ? "is-claimed" : bonusReady ? "is-ready" : ""}"><div class="chest-art" aria-hidden="true"></div><div class="daily-main"><strong>หีบรางวัลประจำวัน</strong><small>รับรางวัลครบ ${d.quests.length} ภารกิจ · ${done} / ${d.quests.length}</small><div class="daily-reward">${chips({ gold: DAILY_BONUS.goldPerLevel * p.level, ore: DAILY_BONUS.ore + DAILY_BONUS.energy * 2 })}</div></div>${
    d.bonusClaimed
      ? `<button disabled class="claimed">เปิดแล้ว ✓</button>`
      : `<button data-claim="bonus" class="claim" ${bonusReady ? "" : "disabled"}>เปิดหีบ</button>`
  }</article>`;
  return `<p class="quest-intro">“งานประจำวันของผู้กล้า ทำให้ครบแล้วกลับมาหาข้า” <span class="reset">รีเซ็ตใน ${clock(d.resetAt - time)}</span></p>${cards}${bonus}<p class="hint">ภารกิจนับจากดันเจียนจริงเท่านั้น สนามฝึกไม่นับ · รับรางวัลได้ทุกที่</p>`;
}

function bookPage(p) {
  const book = p.bestiary || {},
    types = Object.keys(MONSTERS),
    stars = types.reduce((n, t) => n + bestiaryStars(book[t]), 0),
    max = types.length * BESTIARY_TIERS.length,
    total = Object.entries(bestiaryBonuses(book))
      .map(([k, v]) => `<b class="chip">${STAT_NAMES[k]} +${v}</b>`)
      .join("");
  const cards = types
    .map((type) => {
      const m = MONSTERS[type],
        kills = book[type] || 0,
        s = bestiaryStars(kills),
        next = BESTIARY_TIERS[s],
        prev = BESTIARY_TIERS[s - 1] || 0,
        pct = next ? ((kills - prev) / (next - prev)) * 100 : 100;
      return `<article class="mon-card stars-${s} ${kills ? "" : "is-unseen"}"><div class="mon-frame">${portrait(type, kills > 0)}</div><strong>${kills ? esc(m.name) : "???"}</strong><span class="mon-stars" aria-label="${s} ดาว">${"★".repeat(s)}${"☆".repeat(BESTIARY_TIERS.length - s)}</span><div class="daily-bar"><i style="width:${pct}%"></i></div><small>${next ? `${kills.toLocaleString()} / ${next.toLocaleString()} ตัว` : `${kills.toLocaleString()} ตัว · สมบูรณ์`}</small><small class="mon-bonus">${STAT_NAMES[m.stat]} +${m.per} ต่อดาว${s ? ` · ได้แล้ว +${m.per * s}` : ""}</small>${kills ? `<p>${esc(m.lore)}</p>` : ""}</article>`;
    })
    .join("");
  return `<div class="book-summary"><div><small>ดาวสะสม</small><strong>${stars} <span>/ ${max}</span></strong></div><div class="book-total"><small>โบนัสถาวรตอนนี้</small><div>${total || '<b class="chip chip-muted">ยังไม่มี · ล่าให้ครบ 50 ตัวเพื่อรับดาวแรก</b>'}</div></div></div><div class="mon-grid">${cards}</div><p class="hint">ดาว 1 / 2 / 3 ที่ ${BESTIARY_TIERS.join(" / ")} ตัว · บอสไม่นับ · โบนัสใช้ได้ทันทีกับทุกอาชีพของตัวละครนี้</p>`;
}

function journeyPage(p) {
  return `<p>“เจ้าได้ยินเสียงนั้นไหม… แสงจากหัวใจถ้ำกำลังปลุกผู้พิทักษ์ทั้งสิบ จงตามเสียงนั้นลงไปให้ถึงชั้นสุดท้าย”</p>${FLOORS.map(
    (f, i) =>
      `<div class="item-row"><span>${f.icon}</span><div><strong>ชั้น ${i + 1} · ${esc(f.name)}</strong><small>${esc(f.boss)} · 3 ด่าน · ${p.quest > i ? "พิชิตแล้ว ✓" : "ยังไม่พิชิต"}${f.deep ? " · ห้วงลึก" : ""}</small></div></div>`,
  ).join("")}<button id="elder-heal" class="primary-button">พักฟื้น HP / MP เต็ม</button><p class="hint">พิชิตครบ 10 ชั้นเพื่อเปิดของตำนานทั้งหมด</p>`;
}

// Compact HUD lines under the main quest card.
export function trackerHtml(daily) {
  if (!daily) return "";
  return daily.quests
    .map((q) => {
      const done = q.progress >= q.goal;
      return `<li class="${q.claimed ? "claimed" : done ? "ready" : ""}"><i>${q.claimed ? "✓" : done ? "!" : "◇"}</i><span>${esc(questText(q))}</span><b>${q.claimed ? "" : `${q.progress}/${q.goal}`}</b></li>`;
    })
    .join("");
}
