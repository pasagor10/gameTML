import { heroPortraitStyle } from "/hero-appearance.js?v=2";
import { skillIcon, potionIcon, autoIcon } from "/skill-icons.js?v=1";
import { dungeonPlatforms } from "/shared/dungeons.js";
import { supplyArt, itemArtPath } from "/item-art.js";
import {
  sfx,
  music,
  setSound,
  soundOn,
  setMusic,
  musicOn,
} from "/sound.js?v=20261118-combat2";
import { TOWN_ANIMS, TOWN_LAYOUT, TOWN_PROPS } from "/shared/town-layout.js";
import { createWorldDetails } from "/world-details.js?v=3";
import {
  rpgPanel,
  bindRpgPanel,
  gearShop,
} from "/rpg-ui.js?v=3";
import {
  GEAR,
  RARITIES,
  FLOOR_LOOT,
  CLASS_SKILLS,
  SPECIALIZATIONS,
  heroSkins,
} from "/shared/rpg.js";
import { createTownNpcs, footGlow, outline } from "/town-npcs.js?v=5";
import { marketHtml, shopManagerHtml, marketState } from "/market-ui.js?v=2";
import { sampleMotion } from "/shared/smoothing.js";
import { ACTIONS } from "/shared/motion.js";
import {
  registerMotionAtlas,
  animateHero,
  animateSlime,
  monsterDeath,
} from "/combat-visuals.js?v=0.3.1";
import { createSelectionPreview } from "/selection-scene.js?v=0.7.0-archer1";
import {
  CLASSES,
  ITEMS,
  FLOORS,
  WORLD,
  areaWidth,
  combatStats,
} from "/shared/config.js";
import { createParallax } from "/parallax.js?v=0.7.0";
import { updateHudFx, enterHud } from "/hud-fx.js?v=0.6.1";
import { createCombatFx } from "/combat-fx.js?v=0.5.1";
import {
  animateHeroBody,
  animateMonsterBody,
  createMonsterExtras,
  destroyMonsterExtras,
} from "/creature-fx.js?v=0.11.0";
import {
  queueSpriteSets,
  createSpriteRegistry,
  playSpriteSet,
  playMonsterSet,
  playMonsterDeath,
} from "/sprite-sets.js?v=0.16.1";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let lobbyCharacterId = null;
let lobbyMode = "loading";
let lastRpgPanelHash = "";
let job = "swordsman",
  gender = "female",
  account = null,
  characters = [],
  selectedId = null,
  socket = null,
  state = null,
  scene = null,
  phaser = null,
  activePanel = null,
  toastTimer,
  storyIndex = 0,
  chatChannel = "world",
  muted = !soundOn(),
  wasCleared = false,
  wasAlive = true,
  audio,
  seq = 0,
  keys = new Set(),
  touchDirection = 0,
  jumpQueued = false,
  seen = new Set(),
  lastTrade = "",
  snapshotAt = 0,
  serverOffset = null,
  touchAttack = false;
const JOBS = ["swordsman", "archer", "mage"],
  eng = ["SWORDSMAN", "WIND RANGER", "ARCANE MAGE"];
function frame(c, g) {
  return JOBS.indexOf(c) + (g === "female" ? 3 : 0);
}
function heroStyle(c, g, hero) {
  return heroPortraitStyle(hero || { class: c, gender: g });
}
function escape(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function toast(text, error = false) {
  $("#toast").textContent = text;
  $("#toast").classList.toggle("error", error);
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
// Legacy UI cue (lobby, story pages): a soft wooden click from sound.js.
function tone() {
  sfx("click");
}
const CUES = {
  equip: "equip",
  loot: "loot",
  "enhance-success": "forgeOk",
  "enhance-fail": "forgeFail",
  material: "material",
  buy: "buy",
};
function soundCue(name, rarity = "common") {
  sfx(CUES[name] || "click", rarity, 0);
}
function syncSoundButton() {
  muted = !soundOn();
  $("#sound").textContent = muted ? "♫ เปิดเสียง" : "♫ ปิดเสียง";
}
syncSoundButton();
music("town");
$("#sound").onclick = () => {
  setSound(!soundOn());
  syncSoundButton();
  sfx("click");
};
async function api(url, body) {
  const r = await fetch("/api/" + url, {
    credentials: "same-origin",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "เชื่อมต่อไม่สำเร็จ");
  return data;
}
async function refreshAccount() {
  const data = await api("me");
  account = data.user;
  characters = data.characters;
  $("#account-status").textContent = account
    ? `เชื่อมต่อแล้ว · ${account.name.startsWith("guest-") ? "นักเดินทาง" : account.name} · บันทึกบนเซิร์ฟเวอร์`
    : "เล่นได้ทันทีแบบผู้มาเยือน · บันทึกบนเซิร์ฟเวอร์";
  $("#character-count").textContent = `${characters.length} / 3`;
  $("#saved-characters").innerHTML = characters.length
    ? characters
        .map(
          (c) =>
            `<button data-resume="${c.id}" class="saved-hero"><span class="saved-portrait hero-art" style="${lobbyHeroStyle(c.class, c.gender, c)}"></span><span><strong>${escape(c.name)}</strong><small>${CLASSES[c.class].name}</small></span><b>Lv.${c.level}</b></button>`,
        )
        .join("")
    : '<p class="empty-roster">ยังไม่มีผู้กล้าในบัญชีนี้<br><span>เลือกคลาสแล้วสร้างตำนานแรกของคุณ</span></p>';
  $("#new-hero").disabled = characters.length >= 3;
  $("#new-hero").title =
    characters.length >= 3
      ? "มีผู้กล้าครบ 3 ตัวแล้ว · เลือกตัวละครเดิมเพื่อเข้าเกม"
      : "สร้างตัวละครใหม่";
  $$("[data-resume]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = characters.find((c) => c.id === b.dataset.resume);
        lobbyMode = "roster";
        lobbyCharacterId = c.id;
        selectedId = c.id;
        job = c.class;
        gender = c.gender;
        $("#character-name").value = c.name;
        $("#character-name").readOnly = true;
        renderCards();
      }),
  );
  if (characters.length) {
    if (lobbyMode !== "create" || !lobbyCharacterId) {
      const button =
        $(`[data-resume="${lobbyCharacterId}"]`) || $("[data-resume]");
      button?.click();
    } else renderCards();
  } else {
    lobbyMode = "create";
    lobbyCharacterId = null;
    renderCards();
  }
}
let selectionPreview;
const heroDescriptions = {
  swordsman: {
    title: "THE DAWNBLADE",
    role: "แนวหน้า · ระยะประชิด",
    lore: "คมดาบแห่งรุ่งอรุณ ผู้ยืนหยัดปกป้องแสงสุดท้าย",
    skill: "⚔ คลื่นดาบ · ฟันทะลวง · พลังจันทรา",
  },
  archer: {
    title: "THE WINDWALKER",
    role: "ว่องไว · โจมตีระยะไกล",
    lore: "ลูกศรแห่งพงไพร ที่สายลมไม่อาจหยุดยั้ง",
    skill: "➶ ศรสายลม · ยิงต่อเนื่อง · ฝนลูกศร",
  },
  mage: {
    title: "THE STARWEAVER",
    role: "พลังเวท · โจมตีเป็นพื้นที่",
    lore: "ผู้ถักทอแสงดารา ปลุกเวทโบราณใต้ขุนเขา",
    skill: "✦ ลูกพลัง · เวทระเบิด · พายุดารา",
  },
};
function renderCards() {
  const saved = characters.find((c) => c.id === lobbyCharacterId);
  const c = saved ? { ...CLASSES[job], ...combatStats(saved) } : CLASSES[job],
    detail = heroDescriptions[job];
  $("#landing").dataset.heroClass = job;
  $("#landing").dataset.lobbyMode = lobbyMode;
  $("#roster-subtitle").textContent =
    lobbyMode === "create" ? "CREATE A NEW HERO" : "YOUR CHARACTERS";
  $("#roster-title").textContent =
    lobbyMode === "create" ? "สร้างผู้กล้า" : "ผู้กล้าของคุณ";
  $("#creation-back").hidden = lobbyMode !== "create" || !characters.length;
  $("#entry-title").textContent = saved
    ? `${saved.name} · Lv.${saved.level}`
    : "เริ่มต้นตำนานใหม่";
  $("#lobby-switch-label").textContent =
    lobbyMode === "create" ? "เปลี่ยนคลาส" : "เลือกตัวละคร";
  $$("[data-cycle]").forEach((b) =>
    b.setAttribute(
      "aria-label",
      lobbyMode === "create" ? "เปลี่ยนคลาส" : "เปลี่ยนตัวละคร",
    ),
  );
  $("#lobby-level").textContent = String(saved?.level || 1).padStart(2, "0");
  $("#identity-label").innerHTML = saved
    ? "ผู้กล้าที่เลือก <small>พร้อมเดินทางต่อ</small>"
    : "ชื่อผู้กล้าใหม่ <small>2–20 ตัวอักษร</small>";
  $("#start-label").textContent = saved ? "เข้าสู่โลก" : "สร้างผู้กล้า";
  $("#start").disabled = !saved && characters.length >= 3;
  $$("[data-resume]").forEach((b) => {
    b.classList.toggle("active", b.dataset.resume === lobbyCharacterId);
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.resume === lobbyCharacterId),
    );
  });
  $(".hero-showcase").style.setProperty(
    "--hero-accent",
    "#" + c.color.toString(16).padStart(6, "0"),
  );
  $("#selected-class").textContent = saved?.name || c.name;
  $("#selected-epithet").textContent = detail.title;
  $("#selected-lore").textContent = detail.lore;
  $(".hero-fallback").style.cssText = lobbyHeroStyle(job, gender, saved);
  $("#hero-stats").innerHTML =
    `<div class="class-identity"><span>${c.icon}</span><div><h3>${c.name}</h3><p class="class-role">${detail.role}</p></div></div><div class="stats-heading"><span>${saved ? "ค่าสถานะปัจจุบัน" : "ค่าสถานะเริ่มต้น"}</span><small>ATTRIBUTES</small></div>${[
      ["HP", "พลังชีวิต", c.hp, saved ? c.hp : 180],
      ["MP", "พลังเวท", c.mp, saved ? c.mp : 150],
      ["ATK", "พลังโจมตี", c.atk, saved ? Math.max(35, c.atk) : 35],
      ["DEF", "พลังป้องกัน", c.def, saved ? Math.max(12, c.def) : 12],
    ]
      .map(
        ([key, label, value, max]) =>
          `<div class="attribute"><div><span><b>${key}</b> <small>${label}</small></span><strong>${value}</strong></div><div class="attribute-track"><i style="width:${Math.min(100, (value / max) * 100)}%"></i></div></div>`,
      )
      .join("")}
  <div class="stats-heading skill-heading"><span>สกิลประจำคลาส</span><small>SKILL PREVIEW</small></div><div class="lobby-skills">${CLASS_SKILLS[job].map((skill, i) => `<button data-lobby-skill="${i}" title="${skill.detail}"><span>${skill.icon}</span><div><strong>${skill.name}</strong><small>${ACTIONS[i + 1].mp} MP · ${ACTIONS[i + 1].cooldown} วินาที</small></div><b>${["Q", "W", "E"][i]}</b></button>`).join("")}</div>`;
  $$("[data-lobby-skill]").forEach(
    (b) =>
      (b.onclick = () => {
        selectionPreview?.preview("skill");
        b.classList.add("skill-previewing");
        setTimeout(() => b.classList.remove("skill-previewing"), 800);
      }),
  );
  $("#class-cards").innerHTML = JOBS.map(
    (name, i) =>
      `<button class="hero-card ${name === job ? "active" : ""}" data-class="${name}" aria-pressed="${name === job}" aria-label="เลือก${CLASSES[name].name}"><span class="hero-art" style="${lobbyHeroStyle(name, gender)}" aria-hidden="true"></span><span class="class-card-copy"><small>${eng[i]}</small><strong>${CLASSES[name].name}</strong><em>${heroDescriptions[name].role}</em></span><span class="class-order">0${i + 1}</span><span class="selected-mark" aria-hidden="true">◆</span></button>`,
  ).join("");
  $$("[data-gender]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.gender === gender));
    b.classList.toggle("active", b.dataset.gender === gender);
  });
  selectionPreview?.setHero(
    job,
    gender,
    saved ? heroSkins(saved) : [`${job}-${gender}`],
  );
  $$("[data-class]").forEach(
    (b) =>
      (b.onclick = () => {
        if (lobbyCharacterId) resetLobbyCreation();
        job = b.dataset.class;
        renderCards();
        tone(550, 0.1);
      }),
  );
}
$$("[data-gender]").forEach(
  (b) =>
    (b.onclick = () => {
      if (lobbyCharacterId) resetLobbyCreation();
      gender = b.dataset.gender;
      $$("[data-gender]").forEach((x) => x.classList.toggle("active", x === b));
      renderCards();
    }),
);
renderCards();
try {
  selectionPreview = createSelectionPreview();
} catch {
  /* The full-body static art remains available if WebGL is unavailable. */
}
$$("[data-preview]").forEach(
  (b) => (b.onclick = () => selectionPreview?.preview(b.dataset.preview)),
);
refreshAccount().catch(() => toast("เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองใหม่", true));
$("#start").onclick = async () => {
  const b = $("#start");
  b.disabled = true;
  try {
    if (lobbyCharacterId) {
      selectedId = lobbyCharacterId;
      enterGame();
      return;
    }
    const name = $("#character-name").value.trim();
    if (name.length < 2) throw Error("กรุณาตั้งชื่อตัวละครอย่างน้อย 2 ตัวอักษร");
    if (!account) {
      await api("auth/guest", {});
      await refreshAccount();
    }
    const c = await api("characters", { name, class: job, gender });
    selectedId = c.id;
    showPrologue();
  } catch (e) {
    toast(e.message, true);
  } finally {
    b.disabled = false;
  }
};
function modal(title, html, panel) {
  if ($("#modal").classList.contains("hidden")) sfx("open");
  activePanel = panel || "modal";
  $("#modal").dataset.panel = activePanel;
  keys.clear();
  touchDirection = 0;
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").classList.remove("hidden");
  $("#modal").classList.toggle(
    "rpg-modal",
    ["inventory", "class", "weapon"].includes(panel),
  );
  $("#modal").classList.toggle(
    "market-modal",
    ["market", "shop"].includes(panel),
  );
  if (socket?.connected)
    socket.emit("player:input", { direction: 0, seq: ++seq, jump: false });
}
function closeModal() {
  if (activePanel !== null || !$("#modal").classList.contains("hidden"))
    sfx("close");
  activePanel = null;
  marketState.shop = null;
  $("#modal").classList.add("hidden");
  keys.clear();
}
$("#modal-close").onclick = closeModal;
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});
$("#account-open").onclick = () => {
  modal(
    "บัญชีนักเดินทาง",
    `<p>สมัครบัญชีเพื่อกลับมาเล่นข้ามเครื่องได้ บัญชีผู้มาเยือนใช้ได้เฉพาะเบราว์เซอร์นี้</p><label>ชื่อบัญชี<input id="login-name" autocomplete="username" maxlength="30"></label><label>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)<input id="login-password" type="password" autocomplete="current-password" maxlength="128"></label><button id="login" class="primary-button">เข้าสู่ระบบ</button><button id="register" class="text-button">สมัครบัญชีใหม่</button><p id="auth-note" class="hint"></p>`,
  );
  for (const action of ["login", "register"])
    $("#" + action).onclick = async () => {
      try {
        $("#" + action).disabled = true;
        await api("auth/" + action, {
          name: $("#login-name").value.trim(),
          password: $("#login-password").value,
        });
        await refreshAccount();
        closeModal();
        toast("เข้าสู่ระบบแล้ว");
      } catch (e) {
        $("#auth-note").textContent = e.message;
        $("#auth-note").classList.add("error");
      } finally {
        const b = $("#" + action);
        if (b) b.disabled = false;
      }
    };
};
const stories = [
  [
    "เมื่อขุนเขาเริ่มกระซิบ",
    "ใต้เงาดอยนางนอน มีประตูสู่โลกวิญญาณ\nผู้พิทักษ์โบราณผนึกความมืดไว้ในถ้ำลึกหนึ่งร้อยชั้น\nจนกระทั่งแสงสีฟ้าปรากฏขึ้นอีกครั้ง…",
  ],
  [
    "คำสัญญาของผู้กล้าทั้งสาม",
    "สัตว์ป่ากลายเป็นปีศาจ หมู่บ้านกำลังตกอยู่ในอันตราย\nคมดาบ ลูกศร และเวทมนตร์\nคือประกายสุดท้ายที่จะนำรุ่งอรุณกลับมา",
  ],
  [
    "ก้าวแรกสู่ตำนาน",
    "ผู้ใหญ่คำกำลังรอเจ้าที่เมืองหน้าถ้ำหลวง\nเตรียมอาวุธ รวบรวมสหาย แล้วก้าวผ่านประตูจันทรา\nการเดินทางของเจ้า… เริ่มต้นแล้ว",
  ],
];
function showPrologue() {
  storyIndex = 0;
  $("#prologue").classList.remove("hidden");
  renderStory();
}
function renderStory() {
  const s = stories[storyIndex];
  $("#story-title").textContent = s[0];
  $("#story-text").textContent = s[1];
  $("#story-dots").innerHTML = stories
    .map((_, i) => `<span class="${i === storyIndex ? "active" : ""}"></span>`)
    .join("");
  $("#story-next").textContent =
    storyIndex === 2 ? "เข้าสู่เมืองหน้าถ้ำหลวง ➜" : "อ่านต่อ ➜";
  tone(196 + storyIndex * 80, 0.7);
}
$("#story-next").onclick = () => {
  if (++storyIndex < 3) renderStory();
  else enterGame();
};
$("#story-skip").onclick = enterGame;
// Travel between town, floors and stages behind a short loading screen so the
// jump never feels instant: fade in, swap the scene, hold, then fade out.
const TRAVEL = new Set([
  "dungeon:enter",
  "dungeon:next",
  "dungeon:leave",
  "training:enter",
]);
const TIPS = [
  "SPACE กระโดดหลบวงเตือนบนพื้นและบอสทุบพื้น",
  "★ หัวหน้าฝูงเลือดหนา แต่ให้ทองและแร่มากกว่า",
  "มอนเฝ้าที่ของมัน ค่อยๆ ดึงทีละกลุ่มจะปลอดภัยกว่า",
  "เคลียร์เร็วและเสียเลือดน้อย = แรงก์ SSS",
  "กด R ดื่มยา HP ได้ทันทีระหว่างสู้",
  "ฆ่าต่อเนื่องภายใน 5 วินาทีได้โบนัสทองเพิ่ม",
];
const loader = { shownAt: 0, arrived: false, timers: [] };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function showLoading() {
  const el = $("#area-loading");
  loader.timers.forEach(clearTimeout);
  loader.timers = [];
  if (el.classList.contains("hidden") || el.classList.contains("leaving")) {
    loader.shownAt = performance.now();
    loader.arrived = false;
    $("#area-loading .loading-kicker").textContent = "";
    $("#area-loading .loading-title").textContent = "กำลังเดินทาง…";
    $("#area-loading .loading-sub").textContent = "";
    $("#area-loading .loading-dots").innerHTML = "";
    $("#area-loading .loading-tip").textContent =
      "เคล็ดลับ · " + TIPS[Math.floor(Math.random() * TIPS.length)];
    // Restart the bar so every trip fills from empty.
    const bar = $("#area-loading .loading-bar");
    bar.classList.remove("run");
    void bar.offsetWidth;
    bar.classList.add("run");
  }
  el.classList.remove("hidden", "leaving");
}
function hideLoading(delay = 0) {
  loader.timers.push(
    setTimeout(() => {
      const el = $("#area-loading");
      el.classList.add("leaving");
      loader.timers.push(setTimeout(() => el.classList.add("hidden"), 450));
    }, delay),
  );
}
// Called by the scene when the area really changed: name it, then reveal.
function loadingArrived(s) {
  showLoading();
  loader.arrived = true;
  const d = s.dungeon,
    set = (sel, text) => ($("#area-loading " + sel).textContent = text);
  if (s.area === "town") {
    set(".loading-kicker", "กลับสู่ความปลอดภัย");
    set(".loading-title", "เมืองหน้าถ้ำหลวง");
    set(".loading-sub", "พักฟื้น ซื้อของ และเตรียมตัวลงถ้ำอีกครั้ง");
  } else if (d?.training) {
    set(".loading-kicker", "ลานฝึกซ้อม");
    set(".loading-title", "สนามฝึก");
    set(".loading-sub", "ซ้อมท่าได้ไม่จำกัด ไม่เสียความคืบหน้า");
  } else if (d) {
    const floor = FLOORS[d.floor - 1];
    set(".loading-kicker", "ชั้น " + d.floor + " / " + FLOORS.length);
    set(".loading-title", floor.name);
    set(
      ".loading-sub",
      d.stage === 3 ? "ด่านบอส · " + floor.boss : "ด่าน " + d.stage + " / 3",
    );
    $("#area-loading .loading-dots").innerHTML = [1, 2, 3]
      .map(
        (n) =>
          `<i class="${n < d.stage ? "done" : n === d.stage ? "now" : ""}${n === 3 ? " boss" : ""}"></i>`,
      )
      .join("");
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  hideLoading(
    Math.max(reduced ? 300 : 900, 1500 - (performance.now() - loader.shownAt)),
  );
}
async function emit(event, data = {}) {
  if (!TRAVEL.has(event)) return send(event, data);
  showLoading();
  await wait(380);
  const result = await send(event, data);
  // A failed trip, or one that stays in the same area, must not leave it up.
  if (!result) hideLoading();
  else
    loader.timers.push(
      setTimeout(() => !loader.arrived && hideLoading(), 2500),
    );
  return result;
}
function send(event, data = {}) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      toast("กำลังเชื่อมต่อเซิร์ฟเวอร์", true);
      resolve(null);
      return;
    }
    socket.timeout(5000).emit(event, data, (err, result) => {
      if (err) {
        toast("เซิร์ฟเวอร์ตอบช้า ลองใหม่อีกครั้ง", true);
        resolve(null);
      } else if (!result?.ok) {
        toast(result?.error || "ทำรายการไม่สำเร็จ", true);
        resolve(null);
      } else {
        if (result.message) toast(result.message);
        resolve(result);
      }
    });
  });
}
async function transaction(event, data = {}) {
  const result = await emit(event, { ...data, key: crypto.randomUUID() });
  if (!result) return result;
  if (event === "equipment:enhance")
    soundCue(result.success ? "enhance-success" : "enhance-fail");
  else if (["equipment:buy", "npc:buy", "shop:buy"].includes(event))
    soundCue("buy", result.rarity);
  return result;
}
// Minimap marker layers: rewrite the SVG only when the markers moved.
function setMapLayer(selector, markup) {
  const layer = $(selector);
  if (layer.dataset.markup === markup) return;
  layer.dataset.markup = markup;
  layer.innerHTML = markup;
}
function enterGame() {
  $("#prologue").classList.add("hidden");
  $("#landing").classList.add("hidden");
  $("#game-screen").classList.remove("hidden");
  enterHud();
  $("#connection-state").classList.remove("hidden");
  closeModal();
  if (!phaser)
    phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-canvas",
      transparent: false,
      backgroundColor: "#122e47",
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: innerWidth,
        height: innerHeight,
      },
      scene: Adventure,
      render: { antialias: true, pixelArt: false },
      audio: { noAudio: true },
    });
  phaser.loop.wake();
  socket?.disconnect();
  socket = io({ transports: ["websocket", "polling"], reconnection: true });
  socket.on("connect", () => {
    socket.emit("player:join", { id: selectedId }, (result) => {
      if (!result.ok) {
        toast(result.error, true);
        $("#connection-state").textContent = result.error;
        return;
      }
      $("#connection-state").classList.add("hidden");
      toast(result.message);
    });
  });
  socket.on("connect_error", (e) => {
    toast("เชื่อมต่อไม่ได้: " + e.message, true);
  });
  socket.on("disconnect", () => {
    $("#connection-state").textContent = "การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่…";
    $("#connection-state").classList.remove("hidden");
  });
  socket.on("world:snapshot", (packet) => {
    state = packet;
    snapshotAt = performance.now();
    const nextOffset = packet.time - snapshotAt / 1000;
    serverOffset =
      serverOffset === null
        ? nextOffset
        : serverOffset + (nextOffset - serverOffset) * 0.08;
    updateHUD();
    if (scene?.ready) scene.applySnapshot(packet);
  });
  socket.on("chat:message", (packet) => addChat(packet));
  addChat({
    name: "ระบบ",
    message:
      "ยินดีต้อนรับ! A/D เดิน · SPACE กระโดด · F คุยกับ NPC · ชวนเพื่อนเข้าเว็บนี้เพื่อพบกันในเมือง",
    channel: "world",
  });
}
function updateHUD() {
  const p = state.self,
    d = state.dungeon;
  $("#player-name").textContent = p.name;
  $("#player-level").textContent = "Lv." + p.level;
  $("#player-class").textContent =
    SPECIALIZATIONS[p.class].find((s) => s.id === p.specialization)?.name ||
    CLASSES[p.class].name;
  $("#exp-label").textContent = `${p.exp} / ${p.level * 80} EXP`;
  if (["inventory", "class"].includes(activePanel)) {
    const hash = JSON.stringify([
      p.equipment,
      p.ownedEquipment,
      p.inventory,
      p.specialization,
      p.level,
      p.gold,
      state.area,
    ]);
    if (hash !== lastRpgPanelHash) showPanel(activePanel);
  } else if (activePanel === "weapon") {
    const hash = JSON.stringify([p.ownedEquipment, p.gold]);
    if (hash !== lastRpgPanelHash) showPanel("weapon");
  } else if (activePanel === "market" || activePanel === "shop") {
    // Live stock and gold, but never yank an input out from under the typist.
    if (
      marketHash() !== lastMarketHash &&
      !$("#modal-body").contains(document.activeElement)
    )
      showPanel(activePanel);
  }
  CLASS_SKILLS[p.class].forEach((skill, i) => {
    const button = $(`[data-action="skill${i + 1}"]`);
    if (button.dataset.iconClass !== p.class) {
      button.querySelector("b").innerHTML = skillIcon(p.class, i + 1);
      button.dataset.iconClass = p.class;
    }
    button.querySelector("small").textContent = skill.name;
    button.dataset.tip = `${skill.name} · ${skill.detail} · ${ACTIONS[i + 1].mp} MP · ${ACTIONS[i + 1].cooldown}s`;
    button.setAttribute("aria-label", button.dataset.tip);
    button.querySelector(".skill-cost").textContent = ACTIONS[i + 1].mp + " MP";
  });
  const basicAttack = $('[data-action="attack"]');
  if (basicAttack.dataset.iconClass !== p.class) {
    basicAttack.querySelector("b").innerHTML = skillIcon(p.class, 0);
    basicAttack.dataset.iconClass = p.class;
  }
  if (!$("#auto-button").dataset.iconReady) {
    $('[data-action="hp"] b').innerHTML = potionIcon;
    $("#auto-button b").innerHTML = autoIcon;
    $("#auto-button").dataset.iconReady = "1";
  }
  $("#avatar").style.cssText = heroStyle(p.class, p.gender, p);
  $("#hp-fill").style.width = (p.hp / p.maxHp) * 100 + "%";
  $("#mp-fill").style.width = (p.mp / p.maxMp) * 100 + "%";
  $("#hp-label").textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
  $("#mp-label").textContent = `MP ${Math.floor(p.mp)} / ${p.maxMp}`;
  $("#exp-fill").style.width = (p.exp / (p.level * 80)) * 100 + "%";
  $("#hp-potions").textContent = d?.training
    ? "ยา HP ∞"
    : "ยา HP ×" + p.inventory.hp;
  const potionButton = $('[data-action="hp"]');
  potionButton.dataset.count = d?.training ? "∞" : String(p.inventory.hp);
  potionButton.disabled =
    p.hp <= 0 || p.hp >= p.maxHp || (!d?.training && p.inventory.hp <= 0);
  potionButton.title =
    p.inventory.hp <= 0 && !d?.training
      ? "ยาหมด · ซื้อเพิ่มได้ที่ร้านยา"
      : "ยา HP · ฟื้นฟู 90 HP (R)";
  $("#training-open").disabled = state.area !== "town";
  $$(
    [
      "[data-action=attack]",
      "[data-action=skill1]",
      "[data-action=skill2]",
      "[data-action=skill3]",
    ].join(","),
  ).forEach((b) =>
    b.classList.toggle(
      "is-casting",
      !!p.action && state.time < p.action.endsAt,
    ),
  );
  $("#location-name").textContent = d?.training
    ? "ลานฝึกผู้พิทักษ์"
    : d
      ? FLOORS[d.floor - 1].name
      : "เมืองหน้าถ้ำหลวง";
  $("#stage-label").textContent = d?.training
    ? "สนามฝึก · ไม่มีรางวัล · สไลม์เกิดใหม่อัตโนมัติ"
    : d
      ? `ชั้น ${d.floor} / ${FLOORS.length} · ด่าน ${d.stage} / 3 · ${d.stage === 3 ? "BOSS STAGE" : d.stage === 2 ? "ELITE STAGE" : "MONSTER STAGE"}`
      : "เมืองกลาง · CH.1 · เขตปลอดภัย";
  $("#map-title").textContent = d?.training
    ? "สนามฝึกผู้พิทักษ์"
    : d
      ? "ถ้ำหลวง · ชั้น " + d.floor
      : "เมืองหน้าถ้ำหลวง";
  $("#online-count").textContent = "● " + state.online + " ออนไลน์";
  const mapW = areaWidth(state.area),
    mapX = (x) => 8 + (x / mapW) * 200,
    mapY = (y) => 52 - ((WORLD.ground - y) / 450) * 43,
    town = state.area === "town";
  $("#map-zone").textContent = d?.training
    ? "TRAINING · ไม่มีรางวัล"
    : d
      ? `ชั้น ${d.floor} · ด่าน ${d.stage} / 3`
      : "CH.1 · เขตปลอดภัย";
  $("#minimap").classList.toggle("in-dungeon", !town);
  const dotAt = `translate(${mapX(p.x).toFixed(1)} ${mapY(p.y).toFixed(1)})`;
  $("#map-dot").setAttribute("transform", dotAt);
  $("#map-ping").setAttribute("transform", dotAt);
  $("#map-gate").setAttribute(
    "transform",
    `translate(${town ? mapX(WORLD.portal).toFixed(1) : 205} ${town ? mapY(WORLD.portalY + 245) : 52})`,
  );
  const npcDots = town
    ? WORLD.npcs
        .map(
          (n) =>
            `<circle cx="${mapX(n.x).toFixed(1)}" cy="${mapY(n.y ?? WORLD.ground) - 3}" r="2.6"/>`,
        )
        .join("")
    : "";
  setMapLayer("#map-npcs", npcDots);
  const allyDots = state.players
    .map(
      (m) =>
        `<circle cx="${mapX(m.x).toFixed(0)}" cy="${(mapY(m.y) - 3).toFixed(0)}" r="3"/>`,
    )
    .join("");
  setMapLayer("#map-allies", allyDots);
  $("#map-platforms").setAttribute(
    "d",
    "M8 52H211" +
      (state.area === "town"
        ? WORLD.platforms
        : dungeonPlatforms(
            state?.dungeon?.floor,
            state?.dungeon?.stage,
            state?.dungeon?.training,
          )
      )
        .map(
          (q) =>
            `M${8 + (q.x / mapW) * 200} ${52 - ((WORLD.ground - q.y) / 450) * 43}h${(q.w / mapW) * 200}`,
        )
        .join(""),
  );
  $("#auto-button").classList.toggle("on", p.auto);
  $("#auto-button").setAttribute("aria-pressed", String(!!p.auto));
  $("#auto-button small").textContent = p.auto ? "เปิด" : "ปิด";
  $("#quest-description").textContent = d?.training
    ? "ฝึกเดิน กระโดด ฟัน และ Q/W/E · หลบเมื่อสไลม์ขึ้นวงเตือน"
    : d
      ? d.clear
        ? "เส้นทางเปิดแล้ว! เดินหน้าสู่ด่านต่อไป"
        : `กำจัด${d.stage === 3 ? FLOORS[d.floor - 1].boss : "มอนสเตอร์ทั้งหมด"} · เหลือ ${d.enemies.length} ตัว`
      : p.quest >= FLOORS.length
        ? "ตำนานบทแรกสำเร็จ! กลับไปท้าทายดันเจียนได้อีกครั้ง"
        : "คุยกับผู้ใหญ่คำ แล้วเข้าสู่ประตูถ้ำหลวง";
  const streak =
    d && d.streakUntil > state.time && d.streak > 1
      ? ` · ต่อเนื่อง ×${d.streak}`
      : "";
  $("#quest-counter").textContent =
    d && !d.training
      ? `กำจัด ${d.defeated} / ${d.totalEnemies}${streak} · SPACE หลบพื้นเตือน`
      : `ดันเจียนที่พิชิต ${p.quest} / ${FLOORS.length}`;
  $("#quest-fill").style.width =
    (d && !d.training
      ? (d.defeated / Math.max(1, d.totalEnemies)) * 100
      : (p.quest / FLOORS.length) * 100) + "%";
  const result = d?.completed ? d.result : null;
  $("#stage-clear").classList.toggle(
    "hidden",
    !d?.clear || d?.training || p.hp <= 0 || p.auto || !!result,
  );
  showFloorResult(result);
  $("#next-stage").textContent =
    d?.stage === 3 ? "รับชัยชนะ · กลับเมือง ➜" : "เข้าสู่ด่านต่อไป ➜";
  $("#death").classList.toggle("hidden", p.hp > 0);
  // Stage clear and defeat stingers, once per change.
  const cleared = !!(d?.clear && !d.training);
  if (cleared && !wasCleared) sfx("clear", null, 0);
  if (p.hp <= 0 && wasAlive) sfx("death", null, 0);
  wasCleared = cleared;
  wasAlive = p.hp > 0;
  for (let i = 1; i <= 3; i++) {
    const button = $(`[data-action="skill${i}"] i`),
      remaining = ACTIONS[i].cooldown - (state.time - (p.cooldowns[i] || 0));
    const skillButton = button.parentElement;
    skillButton.disabled =
      p.hp <= 0 ||
      state.area !== "dungeon" ||
      p.mp < ACTIONS[i].mp ||
      remaining > 0;
    skillButton.title =
      p.mp < ACTIONS[i].mp ? "MP ไม่พอ" : skillButton.dataset.tip;
    button.style.display = remaining > 0 ? "grid" : "none";
    button.textContent = remaining > 0 ? Math.ceil(remaining) : "";
  }
  updateHudFx(state);
  const hash = state.trade ? JSON.stringify(state.trade) : "";
  if (hash !== lastTrade) {
    if (state.trade) {
      if (activePanel === "trade" || !activePanel) showTrade();
    } else if (activePanel === "trade") {
      closeModal();
      toast("การแลกเปลี่ยนจบลงแล้ว");
    }
    lastTrade = hash;
  }
  const nearest = nearby();
  $("#context-hint").classList.toggle(
    "hidden",
    !nearest || activePanel !== null || p.hp <= 0,
  );
  if (nearest) $("#context-hint span").textContent = nearest.label;
  // Touch: the hint becomes a tappable button only while there is a target.
  $("#mobile-interact").classList.toggle(
    "hidden",
    !nearest || activePanel !== null || p.hp <= 0,
  );
  if (nearest && $("#mobile-interact span").textContent !== nearest.label)
    $("#mobile-interact span").textContent = nearest.label;
}
function nearby() {
  if (!state) return null;
  const p = state.self;
  if (state.area === "dungeon")
    return state.dungeon.clear && !state.dungeon.completed
      ? { id: "next", label: "เข้าสู่ด่านต่อไป" }
      : null;
  const npc = WORLD.npcs.find(
    (n) =>
      Math.abs(n.x - p.x) < 105 && Math.abs((n.y ?? WORLD.ground) - p.y) < 90,
  );
  if (npc) return { ...npc, label: npc.name + " · " + npc.role };
  if (Math.abs(p.x - WORLD.portal) < 140)
    return { id: "portal", label: "เข้าสู่ดันเจียนถ้ำหลวง" };
  const shop = state.shops.find((s) => Math.abs(s.x - p.x) < 65);
  if (shop) return { id: "shop:" + shop.id, label: "ร้าน " + shop.name };
  return null;
}
function interact() {
  const n = nearby();
  if (!n) return toast("คลิกที่ NPC ร้าน หรือประตูถ้ำได้เลย");
  if (n.id === "next") emit("dungeon:next");
  else openTown(n.id);
}
// One way in for keyboard, mouse and touch: NPC id, "portal" or "shop:<id>".
function openTown(id) {
  if (!state || state.area !== "town") return;
  if (id === "portal") return showPanel("dungeon");
  if (id === "market") return showPanel("market");
  if (id.startsWith("shop:")) {
    const shop = state.shops.find((s) => s.id === id.slice(5));
    if (!shop) return;
    sfx("talk");
    if (shop.owner === state.self.id) return showPanel("shop");
    marketState.shop = shop.id;
    return showPanel("market");
  }
  sfx("talk");
  showPanel(id);
}
function action(name) {
  if (!state || activePanel) return;
  if (name === "attack") emit("player:attack", { skill: 0 });
  else if (name.startsWith("skill"))
    emit("player:attack", { skill: Number(name.slice(-1)) });
  else if (name === "hp")
    emit("player:potion", { type: "hp" }).then((r) => r && sfx("potion"));
  else if (name === "auto") emit("player:auto", { enabled: !state.self.auto });
}
$$("[data-action]").forEach(
  (b) => (b.onclick = () => action(b.dataset.action)),
);
$$("[data-panel]").forEach(
  (b) => (b.onclick = () => showPanel(b.dataset.panel)),
);
$("#dungeon-open").onclick = () => showPanel("dungeon");
$("#training-open").onclick = async () => {
  const r = await emit("training:enter");
  if (r) closeModal();
};
$("#next-stage").onclick = () => emit("dungeon:next");
$("#result-next").onclick = () => emit("dungeon:next");
$("#result-leave").onclick = () => emit("dungeon:leave");
// End-of-floor summary: time, score, loot and an SSS–C rank, built once per clear.
let shownResult = "";
function showFloorResult(r) {
  const panel = $("#floor-result"),
    key = r ? state.dungeon.instanceId + ":" + r.floor : "";
  panel.classList.toggle("hidden", !r);
  if (key === shownResult) return;
  shownResult = key;
  if (!r) return;
  const clock = (s) =>
      Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"),
    row = (label, value, extra = "") =>
      `<div><dt>${label}</dt><dd>${value}${extra ? `<small>${extra}</small>` : ""}</dd></div>`;
  $("#result-title").textContent =
    "ชั้น " + r.floor + " · " + FLOORS[r.floor - 1].name;
  const rank = $("#floor-result .result-rank");
  rank.dataset.rank = r.rank;
  rank.querySelector("b").textContent = r.rank;
  $("#floor-result .result-stats").innerHTML = [
    row("เวลา", clock(r.seconds), "เป้า " + clock(r.par)),
    row("กำจัด", r.defeated + " ตัว"),
    row("เสียเลือด", r.damage, "รอด " + r.survival + "%"),
    row("คะแนน", r.score.toLocaleString()),
  ].join("");
  const loot = [
    `<span class="loot-chip">🪙 ${r.gold.toLocaleString()} ทอง</span>`,
    `<span class="loot-chip">✦ ${r.exp} EXP</span>`,
    r.ore ? `<span class="loot-chip">⛏ แร่ ×${r.ore}</span>` : "",
    ...r.items.map(
      (id) =>
        `<span class="loot-chip rare" data-rarity="${escape(GEAR[id]?.rarity || "")}">🎁 ${escape(GEAR[id]?.name || id)}</span>`,
    ),
  ];
  $("#floor-result .result-loot").innerHTML = loot.join("");
  $("#result-next").hidden = !r.hasNext;
  $("#result-leave").textContent = r.hasNext
    ? "ออกกลับเมือง"
    : "รับชัยชนะ · กลับเมือง";
  if (["SSS", "SS", "S"].includes(r.rank)) sfx("levelUp", null, 0);
}
$("#revive").onclick = () => emit("dungeon:leave");
$("#town-return").onclick = () => {
  if (state?.area === "town") {
    emit("player:heal");
  } else {
    modal(
      "กลับเมืองหน้าถ้ำหลวง",
      '<p>ออกจากดันเจียนรอบนี้? ทองและไอเทมที่ได้รับยังอยู่ แต่ต้องเริ่มด่านใหม่เมื่อกลับเข้าไป</p><button id="confirm-town" class="primary-button">กลับเมือง</button>',
    );
    $("#confirm-town").onclick = async () => {
      await emit("dungeon:leave");
      closeModal();
    };
  }
};
let lastMarketHash = "";
const marketHash = () =>
  JSON.stringify([
    state.shops,
    state.self.gold,
    state.self.inventory,
    state.self.ownedEquipment,
    state.self.equipment,
  ]);
function bindMarket(panel) {
  const m = marketState,
    again = () => showPanel(panel);
  if (panel === "market") {
    $$("[data-market-filter]").forEach(
      (b) => (b.onclick = () => ((m.filter = b.dataset.marketFilter), again())),
    );
    const listing = (id) =>
      state.shops.flatMap((s) => s.listings || []).find((l) => l.id === id);
    $$("[data-buy-step]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.buyStep,
            l = listing(id);
          m.buyQty[id] = Math.max(
            1,
            Math.min(l?.qty || 1, (m.buyQty[id] || 1) + Number(b.dataset.d)),
          );
          again();
        }),
    );
    $$("[data-buy-max]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.buyMax,
            l = listing(id);
          if (!l) return;
          m.buyQty[id] = Math.max(
            1,
            Math.min(l.qty, Math.floor(state.self.gold / l.price)),
          );
          again();
        }),
    );
    $$("[data-listing-buy]").forEach(
      (b) =>
        (b.onclick = async () => {
          const id = b.dataset.listingBuy;
          b.disabled = true;
          const r = await transaction("shop:buy", {
            id,
            qty: m.buyQty[id] || 1,
          });
          if (r) m.buyQty[id] = 1;
          setTimeout(again, 120);
        }),
    );
    $("#open-own-shop").onclick = () => showPanel("shop");
    if ($("#market-all"))
      $("#market-all").onclick = () => ((m.shop = null), again());
    return;
  }
  $$("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        if (m.pick !== b.dataset.pick) {
          m.pick = b.dataset.pick;
          m.qty = 1;
          m.price = null;
        }
        again();
      }),
  );
  const total = () => {
    const btn = $("#sell-confirm");
    if (btn)
      btn.textContent =
        btn.textContent.replace(/ · รวม .*$/, "") +
        ` · รวม ${(m.qty * m.price).toLocaleString()} ◈`;
  };
  if ($("#sell-qty"))
    $("#sell-qty").oninput = (e) => {
      m.qty = Math.max(1, Math.floor(Number(e.target.value) || 1));
      total();
    };
  if ($("#sell-price"))
    $("#sell-price").oninput = (e) => {
      m.price = Math.max(1, Math.floor(Number(e.target.value) || 1));
      total();
    };
  if ($("#sell-shop-name"))
    $("#sell-shop-name").oninput = (e) => (m.name = e.target.value);
  if ($("#sell-confirm"))
    $("#sell-confirm").onclick = async () => {
      const mine = state.shops.some((s) => s.owner === state.self.id),
        listing = { item: m.pick, qty: m.qty, price: m.price };
      $("#sell-confirm").disabled = true;
      const r = mine
        ? await transaction("shop:list", listing)
        : await transaction("shop:create", {
            name: m.name.trim() || "ร้านของ " + state.self.name,
            listings: [listing],
          });
      if (r) {
        m.pick = null;
        m.qty = 1;
        m.price = null;
      }
      setTimeout(again, 120);
    };
  $$("[data-unlist]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        await transaction("shop:unlist", { id: b.dataset.unlist });
        setTimeout(again, 120);
      }),
  );
  $("#back-market").onclick = () => showPanel("market");
  if ($("#close-shop"))
    $("#close-shop").onclick = async () => {
      const r = await transaction("shop:close");
      if (r) setTimeout(again, 120);
    };
}
function showPanel(panel) {
  if (!state) return;
  const p = state.self;
  const row = (icon, name, desc, button) =>
    `<div class="item-row"><span>${icon}</span><div><strong>${escape(name)}</strong><small>${escape(desc)}</small></div>${button || ""}</div>`;
  const btn = (data, label) => `<button ${data}>${label}</button>`;
  if (panel === "inventory" || panel === "class") {
    modal(
      panel === "class" ? "เส้นทางผู้กล้า" : "อุปกรณ์ของผู้กล้า",
      rpgPanel(p, state.area, panel),
      panel,
    );
    lastRpgPanelHash = JSON.stringify([
      p.equipment,
      p.ownedEquipment,
      p.inventory,
      p.specialization,
      p.level,
      p.gold,
      state.area,
    ]);
    bindRpgPanel($("#modal-body"), p, {
      open: showPanel,
      action: async (event, data) => {
        const result = await emit(event, data);
        if (result && event === "equipment:equip")
          soundCue("equip", result.rarity);
        else if (
          result &&
          ["class:specialize", "class:advance"].includes(event)
        )
          soundCue("equip");
      },
    });
  } else if (panel === "weapon") {
    modal("อริน · คลังอาวุธผู้พิทักษ์", gearShop(p), "weapon");
    lastRpgPanelHash = JSON.stringify([p.ownedEquipment, p.gold]);
    $$("[data-buy-gear]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const r = await transaction("equipment:buy", {
            id: b.dataset.buyGear,
          });
          if (!r) b.disabled = false;
        }),
    );
  } else if (panel === "potion" || panel === "weapon") {
    const items =
      panel === "potion" ? ["hp", "mp"] : ["weapon", "armor", "ore"];
    modal(
      panel === "potion" ? "มีรา · ร้านปรุงยา" : "อริน · อาวุธและอุปกรณ์",
      `<p>ยินดีต้อนรับผู้กล้า · ทองของเจ้า ${p.gold}</p>${items.map((id) => row(supplyArt(id) || ITEMS[id].icon, ITEMS[id].name, id === "weapon" ? "เพิ่ม ATK 10 · สวมให้อัตโนมัติ" : id === "armor" ? "เพิ่ม HP 30 · ป้องกันเพิ่ม" : id === "ore" ? "วัตถุดิบตีบวก" : "ใช้ฟื้นฟูระหว่างต่อสู้", btn(`data-buy="${id}"`, ITEMS[id].price + " ◈"))).join("")}`,
    );
    $$("[data-buy]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          await transaction("npc:buy", { item: b.dataset.buy });
          b.disabled = false;
        }),
    );
  } else if (panel === "forge") {
    const chance =
      p.upgrade < 3 ? 100 : p.upgrade < 6 ? 70 : p.upgrade < 9 ? 40 : 15;
    modal(
      "ลุงเหล็ก · โรงตีอาวุธ",
      `<div style="text-align:center;font-size:60px;color:#ffe1a1">⚒</div><h3 style="text-align:center">อาวุธ +${p.upgrade} → +${Math.min(10, p.upgrade + 1)}</h3><p>โอกาสสำเร็จ ${chance}% · เพิ่มพลังโจมตี 8 ต่อระดับ · สูงสุด +10<br>ใช้ ${(p.upgrade + 1) * 30} ทอง + แร่จันทรา 1 ชิ้น<br>ไม่สำเร็จจะเสียทรัพยากร แต่ระดับเดิมคงอยู่</p><p>มี ${p.gold} ทอง · แร่จันทรา ${p.inventory.ore} ชิ้น</p><button id="enhance" class="primary-button">เสริมพลังอาวุธ</button>`,
    );
    $("#enhance").onclick = async () => {
      const r = await transaction("equipment:enhance");
      if (r) {
        closeModal();
      }
    };
  } else if (panel === "elder" || panel === "quest") {
    modal(
      "ผู้ใหญ่คำ · เสียงเรียกจากขุนเขา",
      `<p>“เจ้าได้ยินเสียงนั้นไหม… แสงจากหัวใจถ้ำกำลังปลุกผู้พิทักษ์ทั้งสิบ จงตามเสียงนั้นลงไปให้ถึงชั้นสุดท้าย”</p>${FLOORS.map((f, i) => row(["🦇", "🪨", "🐍", "🌿", "🔥", "❄", "⚡", "☽", "🐉", "✺"][i], "ชั้น " + (i + 1) + " · " + f.name, `${f.boss} · 3 ด่าน · ${p.quest > i ? "พิชิตแล้ว ✓" : "ยังไม่พิชิต"}`)).join("")}<button id="elder-heal" class="primary-button">พักฟื้น HP / MP เต็ม</button><p class="hint">พิชิตครบ 10 ชั้นเพื่อเปิดของตำนานทั้งหมด</p>`,
    );
    $("#elder-heal").onclick = () => emit("player:heal");
  } else if (panel === "dungeon") {
    modal(
      "ประตูถ้ำหลวง · เลือกดันเจียน",
      `<p>แต่ละชั้นมี 3 ด่าน: มอนสเตอร์ → อีลิท → บอส<br>ปาร์ตี้สูงสุด 3 คน สมาชิกต้องกดพร้อมก่อนหัวหน้าเริ่ม</p><p class="hint">SPACE กระโดดหลบคริสตัลและบอสทุบพื้น · รอบแรกได้อาวุธประจำอาชีพแน่นอน · รอบต่อไปล่าชิ้นที่ยังไม่มี</p>${FLOORS.map(
        (f, i) => {
          const table = FLOOR_LOOT[i + 1];
          const featured = [table?.weapons[p.class], ...(table?.pool || [])]
            .filter(Boolean)
            .slice(0, 4)
            .map((id) => `${GEAR[id].icon} ${GEAR[id].name}`)
            .join(" · ");
          return `<div class="dungeon-card"><h3>${String(i + 1).padStart(2, "0")} / ${f.name}</h3><p>บอส: ${f.boss} · 3 ด่าน · ${i === 0 ? "เริ่มต้นการผจญภัย" : "ผ่านชั้น " + i + " ก่อน"}</p><small>ของเด่น: ${featured}</small><button data-floor="${i + 1}" ${p.unlocked < i + 1 ? "disabled" : ""}>${p.unlocked < i + 1 ? "🔒 ยังไม่ปลดล็อก" : "เข้าสู่ดันเจียน ➜"}</button></div>`;
        },
      ).join("")}`,
    );
    $$("[data-floor]").forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await emit("dungeon:enter", {
            floor: Number(b.dataset.floor),
          });
          if (r) closeModal();
        }),
    );
  } else if (panel === "market" || panel === "shop") {
    lastMarketHash = marketHash();
    const scroll = $("#modal-body")?.scrollTop || 0,
      same = activePanel === panel;
    modal(
      panel === "market" ? "ตลาดนักเดินทาง" : "ร้านค้าของฉัน",
      panel === "market" ? marketHtml(state) : shopManagerHtml(state),
      panel,
    );
    if (same) $("#modal-body").scrollTop = scroll;
    bindMarket(panel);
  } else if (panel === "party") {
    const party = state.party;
    modal(
      "ปาร์ตี้ผู้กล้า",
      party
        ? `<p>สมาชิก ${party.members.length} / 3 · หัวหน้า ${escape(party.members.find((m) => m.leader)?.name)}</p>${party.members.map((m) => row(m.leader ? "♛" : "♧", m.name, `${party.ready.includes(m.id) ? "✓ พร้อมแล้ว" : "กำลังเตรียมตัว"}${m.id === p.id ? " · คุณ" : ""}`)).join("")}<button id="party-ready" class="primary-button">${party.ready.includes(p.id) ? "ยกเลิกพร้อม" : "พร้อมลงดันเจียน"}</button><button id="party-leave" class="text-button">ออกจากปาร์ตี้</button><p class="hint">หัวหน้าเลือกดันเจียนได้ที่ประตูถ้ำ สมาชิกที่กดพร้อมจะเข้าห้องเดียวกัน</p>`
        : `<p>ร่วมทีมกับเพื่อนสูงสุด 3 คน แบ่งรับรางวัลส่วนตัวจากมอนสเตอร์</p><button id="party-create" class="primary-button">สร้างปาร์ตี้</button>${state.parties.map((g) => row("♧", g.name, `${g.count} / 3 คน`, btn(`data-party-join="${g.id}"`, "เข้าร่วม"))).join("")}`,
    );
    if (party) {
      $("#party-ready").onclick = async () => {
        await emit("party:action", { action: "ready" });
        closeModal();
      };
      $("#party-leave").onclick = async () => {
        await emit("party:action", { action: "leave" });
        closeModal();
      };
    } else {
      $("#party-create").onclick = async () => {
        await emit("party:action", { action: "create" });
        closeModal();
      };
      $$("[data-party-join]").forEach(
        (b) =>
          (b.onclick = async () => {
            await emit("party:action", {
              action: "join",
              target: b.dataset.partyJoin,
            });
            closeModal();
          }),
      );
    }
  } else if (panel === "players") {
    modal(
      "ผู้เล่นในแผนที่",
      `<p>ออนไลน์ทั้งหมด ${state.online} คน · ผู้เล่นแผนที่นี้ ${state.players.length + 1} คน</p>${state.players.map((m) => row(CLASSES[m.class].icon, m.name, `${CLASSES[m.class].name} · Lv.${m.level}`, btn(`data-trade-target="${m.id}"`, "แลกเปลี่ยน"))).join("") || "<p>ชวนเพื่อนเปิดเว็บเกมนี้เพื่อพบกันในเมือง</p>"}${state.trade ? '<button id="trade-reopen" class="primary-button">เปิดการแลกเปลี่ยนที่ค้างอยู่</button>' : ""}`,
    );
    $$("[data-trade-target]").forEach(
      (b) =>
        (b.onclick = async () => {
          const r = await emit("trade:action", {
            action: "request",
            target: b.dataset.tradeTarget,
          });
          if (r) closeModal();
        }),
    );
    if ($("#trade-reopen")) $("#trade-reopen").onclick = showTrade;
  } else if (panel === "settings") {
    modal(
      "บันทึกการเดินทาง",
      `<p>เกมบันทึกตัวละคร เงิน อุปกรณ์ และดันเจียนบนเซิร์ฟเวอร์อัตโนมัติ<br>บัญชีผู้มาเยือนผูกกับคุกกี้ในเบราว์เซอร์นี้</p><button id="toggle-sound" class="primary-button">${muted ? "เปิดเสียงทั้งหมด" : "ปิดเสียงทั้งหมด"}</button><button id="toggle-music" class="primary-button">${musicOn() ? "ปิดเพลงประกอบ" : "เปิดเพลงประกอบ"}</button><button id="back-selection" class="text-button">กลับหน้าเลือกตัวละคร</button><p class="hint">Demo v0.3 · นักดาบหญิงและสไลม์มีเฟรมแอนิเมชันชุดแรก · ตัวอื่นยังใช้ภาพ idle · เป้าหมาย 20–30 คนต่อห้องยังไม่ได้ยืนยันด้วย load test</p>`,
    );
    $("#toggle-sound").onclick = () => {
      setSound(!soundOn());
      syncSoundButton();
      sfx("click");
      closeModal();
    };
    $("#toggle-music").onclick = () => {
      setMusic(!musicOn());
      sfx("click");
      closeModal();
    };
    $("#back-selection").onclick = () => {
      socket.disconnect();
      state = null;
      phaser?.loop.sleep();
      $("#game-screen").classList.add("hidden");
      $("#landing").classList.remove("hidden");
      music("town");
      closeModal();
      refreshAccount();
    };
  }
}
function showTrade() {
  const t = state?.trade;
  if (!t) return;
  const p = state.self,
    me = t.offers[p.id],
    other = t.members.find((id) => id !== p.id);
  if (!t.accepted && t.members[1] === p.id) {
    modal(
      "คำขอแลกเปลี่ยน",
      `<p>${escape(t.names[other])} ขอแลกเปลี่ยนไอเทมกับคุณ</p><button id="trade-accept" class="primary-button">ตอบรับ</button><button id="trade-cancel" class="text-button">ปฏิเสธ</button>`,
      "trade",
    );
    $("#trade-accept").onclick = () =>
      emit("trade:action", { action: "accept", id: t.id });
  } else if (!t.accepted) {
    modal(
      "รอการตอบรับ",
      `<p>รอ ${escape(t.names[other])} ตอบรับคำขอ</p><button id="trade-cancel" class="text-button">ยกเลิก</button>`,
      "trade",
    );
  } else {
    modal(
      "แลกเปลี่ยน · ตรวจสอบรายการ",
      `<p>รายการรุ่น ${t.revision} · การแก้ไขจะยกเลิกการยืนยันทั้งสองฝ่าย</p>${t.members
        .map((id) => {
          const o = t.offers[id];
          return `<div class="trade-offer"><b>${escape(t.names[id])}${id === p.id ? " (คุณ)" : ""}</b><p>${o.gold} ทอง + ${ITEMS[o.item].name} ×${o.qty}</p><small>${t.confirmed.includes(id) ? "✓ ยืนยันรอบแรกแล้ว" : "ยังไม่ยืนยัน"} ${t.final.includes(id) ? "· ✓ ยืนยันสุดท้ายแล้ว" : ""}</small></div>`;
        })
        .join(
          "",
        )}<label>ทองที่เสนอ<input id="trade-gold" type="number" min="0" value="${me.gold}"></label><label>ไอเทม<select id="trade-item">${["ore", "hp", "mp"].map((i) => `<option value="${i}" ${me.item === i ? "selected" : ""}>${ITEMS[i].name} · มี ${p.inventory[i]}</option>`).join("")}</select></label><label>จำนวน<input id="trade-qty" type="number" min="0" value="${me.qty}"></label><div class="trade-actions"><button id="trade-offer" class="secondary-button">อัปเดตข้อเสนอ</button><button id="trade-confirm" class="primary-button">${t.confirmed.length === 2 ? "ยืนยันรอบสุดท้าย" : "ยืนยันรายการรอบแรก"}</button></div><button id="trade-cancel" class="text-button">ยกเลิกการแลกเปลี่ยน</button>`,
      "trade",
    );
    $("#trade-offer").onclick = () =>
      emit("trade:action", {
        action: "offer",
        id: t.id,
        gold: Number($("#trade-gold").value),
        item: $("#trade-item").value,
        qty: Number($("#trade-qty").value),
      });
    $("#trade-confirm").onclick = () =>
      emit("trade:action", {
        action: t.confirmed.length === 2 ? "final" : "confirm",
        id: t.id,
        revision: t.revision,
      });
  }
  $("#trade-cancel").onclick = async () => {
    await emit("trade:action", { action: "cancel", id: t.id });
    closeModal();
  };
}
function addChat(p) {
  if (p.channel !== chatChannel && p.name !== "ระบบ") return;
  const line = document.createElement("div"),
    name = document.createElement("b");
  name.textContent = "[" + p.name + "] ";
  line.append(name, document.createTextNode(p.message));
  $("#chat-log").append(line);
  while ($("#chat-log").children.length > 60)
    $("#chat-log").firstChild.remove();
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  if (!$("#chat").classList.contains("open") && p.name !== "ระบบ")
    $("#chat-toggle").classList.add("unread");
}
// Phone portrait: chat and quest details fold away (see mobile.css).
$("#chat-toggle").onclick = () => {
  const open = $("#chat").classList.toggle("open");
  $("#chat-toggle").classList.remove("unread");
  $("#chat-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
};
$("#quests").onclick = () => $("#quests").classList.toggle("open");
// Block pinch and double-tap zoom (iOS ignores user-scalable=no).
for (const type of ["gesturestart", "gesturechange", "gestureend"])
  document.addEventListener(type, (e) => e.preventDefault(), {
    passive: false,
  });
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && !e.target.closest("input,textarea,select"))
      e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);
$("#chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const input = $("#chat-input"),
    message = input.value.trim();
  if (!message) return;
  const r = await emit("chat:send", { message, channel: chatChannel });
  if (r) input.value = "";
};
$$("[data-channel]").forEach(
  (b) =>
    (b.onclick = () => {
      chatChannel = b.dataset.channel;
      $$("[data-channel]").forEach((x) =>
        x.classList.toggle("active", b === x),
      );
      $("#chat-log").replaceChildren();
    }),
);
addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName))
    return;
  if (e.key === "Escape") {
    closeModal();
    return;
  }
  if (state && !e.repeat && ["KeyI", "KeyC"].includes(e.code)) {
    e.preventDefault();
    const panel = e.code === "KeyI" ? "inventory" : "class";
    if (activePanel === panel) closeModal();
    else showPanel(panel);
    return;
  }
  if (!state || activePanel) return;
  if (e.code === "Space" || e.key.startsWith("Arrow")) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  const actions = {
    KeyJ: "attack",
    KeyQ: "skill1",
    KeyW: "skill2",
    KeyE: "skill3",
    KeyR: "hp",
    KeyT: "auto",
  };
  if (actions[e.code]) action(actions[e.code]);
  if (e.code === "Space") jumpQueued = true;
  if (e.code === "KeyF") interact();
  if (e.code === "KeyV") toggleWalkability();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  touchDirection = 0;
  touchAttack = false;
});
// Floating joystick (MOBA style): it appears under the thumb anywhere in the
// zone. Tilt walks, full tilt runs, a flick upward jumps once per flick.
let touchRun = false;
{
  const zone = $("#joystick-zone"),
    base = $("#joystick"),
    knob = base.querySelector("i");
  let stick = null;
  const release = () => {
    stick = null;
    touchDirection = 0;
    touchRun = false;
    knob.style.transform = "";
    base.classList.remove("active");
    base.style.left = base.style.top = "";
  };
  const steer = (e) => {
    const radius = base.offsetWidth / 2,
      dx = e.clientX - stick.x,
      dy = e.clientY - stick.y,
      len = Math.hypot(dx, dy) || 1,
      k = Math.min(1, radius / len),
      nx = (dx * k) / radius,
      ny = (dy * k) / radius;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    touchDirection = Math.abs(nx) > 0.25 ? Math.sign(nx) : 0;
    touchRun = Math.abs(nx) > 0.7;
    if (ny < -0.6 && !stick.flicked) {
      stick.flicked = true;
      jumpQueued = true;
    } else if (ny > -0.3) stick.flicked = false;
  };
  zone.addEventListener("pointerdown", (e) => {
    if (stick) return;
    e.preventDefault();
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {} // capture is a nicety; never let it block the stick
    const r = zone.getBoundingClientRect(),
      half = base.offsetWidth / 2,
      x = Math.max(half, Math.min(r.width - half, e.clientX - r.left)),
      y = Math.max(half, Math.min(r.height - half, e.clientY - r.top));
    base.style.left = x - half + "px";
    base.style.top = y - half + "px";
    base.classList.add("active");
    stick = { id: e.pointerId, x: r.left + x, y: r.top + y, flicked: false };
    steer(e);
  });
  zone.addEventListener("pointermove", (e) => {
    if (stick?.id === e.pointerId) steer(e);
  });
  for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
    zone.addEventListener(n, (e) => stick?.id === e.pointerId && release());
  addEventListener("blur", release);
}
// Touch buttons fire on press (no 300 ms click delay) and swallow the
// click that follows, so a tap never casts or drinks twice.
$$("[data-action]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    b.touchedAt = Date.now();
    if (b.dataset.action !== "attack") action(b.dataset.action);
  });
  b.onclick = () => {
    if (Date.now() - (b.touchedAt || 0) < 700) return;
    action(b.dataset.action);
  };
});
$("#touch-recall").onclick = () => $("#town-return").click();
const attackButton = $('[data-action="attack"]');
attackButton.addEventListener("pointerdown", (e) => {
  attackButton.setPointerCapture(e.pointerId);
  touchAttack = true;
  action("attack");
});
for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
  attackButton.addEventListener(n, () => (touchAttack = false));
$("#mobile-jump").onpointerdown = (e) => {
  e.preventDefault();
  jumpQueued = true;
};
$("#mobile-interact").onclick = interact;
setInterval(() => {
  if (!state || !socket?.connected) return;
  const focused = ["INPUT", "TEXTAREA", "SELECT"].includes(
    document.activeElement?.tagName,
  );
  const direction =
    activePanel || focused
      ? 0
      : touchDirection ||
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
          (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  socket.emit("player:input", {
    direction,
    seq: ++seq,
    jump: jumpQueued && !activePanel,
    running: touchDirection
      ? touchRun
      : keys.has("ShiftLeft") || keys.has("ShiftRight"),
  });
  jumpQueued = false;
  if ((keys.has("KeyJ") || touchAttack) && !activePanel && !focused)
    socket.emit("player:attack", { skill: 0 });
}, 80);
class Adventure extends Phaser.Scene {
  constructor() {
    super("adventure");
    this.actors = new Map();
    this.monsters = new Map();
    this.shopObjects = [];
    this.lastArea = null;
  }
  preload() {
    queueSpriteSets(this);
    // Town kit: pieces, props, animated props and far layers (tools/town-kit).
    const kit = (key) => `/assets/town-kit/${key}.webp?v=7`;
    for (const piece of new Set(TOWN_LAYOUT.map((p) => p.piece)))
      this.load.image(`town-piece-${piece}`, kit(`piece-${piece}`));
    for (const key of new Set(TOWN_PROPS.map((p) => p.key)))
      if (key.startsWith("anim-")) {
        const [frameWidth, frameHeight] = TOWN_ANIMS[key.slice(5)];
        this.load.spritesheet(`town-${key}`, kit(key), {
          frameWidth,
          frameHeight,
        });
      } else this.load.image(`town-${key}`, kit(key));
    for (const key of [
      "street",
      "far-sky",
      "far-clouds",
      "far-mountains",
      "far-hills",
      "far-treeline",
    ])
      this.load.image(`town-${key}`, kit(key));
    for (const [id, item] of Object.entries(GEAR)) {
      const path = itemArtPath(id, item);
      if (path) this.load.image(`item-${id}`, path);
    }
    for (const id of ["gold", "ore"])
      this.load.image(
        `drop-${id}`,
        `/assets/items/supply-${id === "gold" ? 2 : 3}.webp`,
      );
    this.load.image(
      "player-market-stall",
      // 2x its display size: a 9x downscale shimmered and looked oversharp.
      "/assets/town-kit/player-market-stall.webp?v=2",
    );
    this.load.image("cave", "/assets/cave.png");
    this.load.image("knight-motion", "/assets/animations/knight-female.png");
    this.load.image("slime-motion", "/assets/animations/slime.png");
    this.load.spritesheet("heroes", "/assets/heroes.png", {
      frameWidth: 512,
      frameHeight: 512,
    });
    this.load.spritesheet("monsters", "/assets/monsters.png", {
      frameWidth: 418,
      frameHeight: 418,
    });
  }
  create() {
    scene = this;
    this.ready = true;
    // World text is drawn into a texture, then scaled by the camera zoom and
    // the screen's pixel ratio; at resolution 1 small Thai names go soft.
    // Render every world label at a higher resolution so it stays crisp.
    const addText = this.add.text.bind(this.add),
      textRes = Math.min(4, Math.ceil((devicePixelRatio || 1) * 2));
    this.add.text = (...args) => addText(...args).setResolution(textRes);
    this.knightAtlas = registerMotionAtlas(this, "knight-motion", 8);
    this.sprites = createSpriteRegistry(this);
    this.spriteSets = this.sprites.heroes;
    this.monsterSets = this.sprites.monsters;
    this.slimeAtlas = registerMotionAtlas(this, "slime-motion", 6);
    this.telegraphs = this.add.graphics().setDepth(6);
    this.dangerHint = this.add
      .text(0, 0, "", {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        color: "#ffe8a8",
        stroke: "#322847",
        strokeThickness: 5,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(18);
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.cameras.main.setBackgroundColor("#234b68");
    this.parallax = createParallax(this);
    this.fx = createCombatFx(this);
    this.parallax.setArea("town");
    this.worldDetails = createWorldDetails(this);
    this.showWalkability =
      $("#walkability-toggle").getAttribute("aria-pressed") === "true";
    this.decor = this.add.graphics().setDepth(-5);
    this.effectLayer = this.add.graphics().setDepth(30);
    this.npcs = [];
    this.townNpcs = createTownNpcs(this, WORLD.npcs, this.sprites);
    this.npcs = this.townNpcs.objects;
    this.portal = this.add
      .ellipse(WORLD.portal, WORLD.portalY, 94, 150, 0x63eaff, 0.25)
      .setStrokeStyle(3, 0xb5faff, 0.8)
      .setDepth(3);
    this.portalGlow = this.add
      .ellipse(WORLD.portal, WORLD.portalY, 65, 125, 0x99f7ff, 0.2)
      .setDepth(3);
    this.tweens.add({
      targets: [this.portal, this.portalGlow],
      alpha: 0.45,
      scaleX: 1.12,
      scaleY: 1.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });
    this.portalLabel = this.add
      .text(WORLD.portal, WORLD.portalY - 175, "ถ้ำหลวง\nประตูสู่ดอยนางนอน", {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        align: "center",
        color: "#d4fbff",
        stroke: "#173756",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(12);
    // Click or tap NPCs, the cave gate and stalls to open them directly.
    this.hoverRing = this.add
      .ellipse(0, WORLD.ground + 4, 120, 26, 0xffe6a5, 0.28)
      .setStrokeStyle(2, 0xffe6a5, 0.9)
      .setDepth(2)
      .setVisible(false);
    this.hotspots = [
      ...WORLD.npcs.map((n) =>
        this.hotspot(n.x, n.y ?? WORLD.ground, 110, 175, () => openTown(n.id)),
      ),
      this.hotspot(WORLD.portal, WORLD.portalY + 85, 150, 240, () =>
        openTown("portal"),
      ),
    ];
    this.makePlatforms();
    this.cameras.main.centerOn(380, this.camY ?? 340);
    this.scale.on("resize", () => this.resize());
    this.resize();
    if (state) this.applySnapshot(state);
  }
  resize() {
    const w = this.scale.width,
      h = this.scale.height,
      portrait = h > w && w < 700,
      // Portrait phones: frame by width so heroes stay readable, and put the
      // ground near 2/3 of the screen so thumb controls sit below the action.
      zoom = portrait
        ? Phaser.Math.Clamp(w / 420, 0.75, 1.2)
        : w < 700
          ? Math.max(0.6, h / 900)
          : Math.max(0.7, h / 800),
      viewH = h / zoom;
    this.portrait = portrait;
    // Ground at ~2/3 on portrait phones, ~3/4 on short landscape screens
    // (phones sideways); tall desktop windows keep the original framing.
    this.camY = portrait
      ? Math.min(850 - viewH / 2, WORLD.ground - 0.17 * viewH)
      : h < 520
        ? Math.min(850 - viewH / 2, WORLD.ground - 0.26 * viewH)
        : 340;
    this.cameras.main.setZoom(zoom);
    // The town is as long as its kit layout; dungeons keep WORLD.width.
    this.cameras.main.setBounds(0, -100, areaWidth(state?.area), 950);
    this.parallax?.resize();
  }
  hotspot(x, bottom, w, h, open) {
    const zone = this.add
      .zone(x, bottom, w, h)
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => {
      if (state?.area !== "town") return;
      this.hoverRing.setPosition(x, Math.min(bottom, WORLD.ground) + 4);
      this.hoverRing.setVisible(true);
    });
    zone.on("pointerout", () => this.hoverRing.setVisible(false));
    zone.on("pointerdown", () => {
      if (state?.area !== "town" || activePanel || state.self.hp <= 0) return;
      this.hoverRing.setVisible(false);
      open();
    });
    return zone;
  }
  makePlatforms() {
    this.decor.clear();
    const cave = state?.area === "dungeon";
    for (const p of cave
      ? dungeonPlatforms(
          state?.dungeon?.floor,
          state?.dungeon?.stage,
          state?.dungeon?.training,
        )
      : WORLD.platforms) {
      // Town ledges are painted into the architecture; collisions use WORLD.
      if (!cave) continue;
      this.decor.fillStyle(0x152e40, 0.28);
      this.decor.fillEllipse(p.x + p.w / 2, p.y + 42, p.w - 15, 15);
      this.decor.fillStyle(cave ? 0x334461 : 0x71664d);
      this.decor.fillRoundedRect(p.x, p.y + 3, p.w, 29, 7);
      for (let x = p.x + 3, n = 0; x < p.x + p.w - 5; x += 38, n++) {
        this.decor.fillStyle(
          cave ? (n % 2 ? 0x64738e : 0x485f7b) : n % 2 ? 0x9a8d6c : 0x81775a,
        );
        this.decor.fillRoundedRect(x, p.y + 8, 34, 19, 4);
        this.decor.lineStyle(1, cave ? 0x93b9da : 0xc8bd91, 0.55);
        this.decor.lineBetween(x + 4, p.y + 10, x + 27, p.y + 10);
      }
      this.decor.fillStyle(
        cave ? FLOORS[(state?.dungeon?.floor || 1) - 1].color : 0x83b952,
      );
      this.decor.fillRoundedRect(p.x - 3, p.y, p.w + 6, 9, 4);
      for (let x = p.x + 6; x < p.x + p.w; x += 13) {
        this.decor.fillStyle(cave ? 0xb6d8f1 : 0xb3d96d, 0.9);
        this.decor.fillTriangle(x, p.y + 3, x + 4, p.y - 5, x + 8, p.y + 3);
      }
      this.decor.lineStyle(3, cave ? 0x7399c6 : 0x668f4a, 0.8);
      for (let x = p.x + 25; x < p.x + p.w - 10; x += 85) {
        this.decor.beginPath();
        this.decor.moveTo(x, p.y + 27);
        this.decor.lineTo(x - 5, p.y + 40);
        this.decor.lineTo(x + 1, p.y + 47);
        this.decor.strokePath();
      }
    }
  }
  actor(p, stamp, reset = false) {
    let a = this.actors.get(p.id);
    for (const skin of heroSkins(p)) this.sprites.want("sets", skin);
    if (!a) {
      const shadow = this.add
          .ellipse(p.x, p.y - 3, 65, 15, 0x102b3c, 0.35)
          .setDepth(6),
        image = this.add
          .image(p.x, p.y, "heroes", frame(p.class, p.gender))
          .setOrigin(0.5, 1)
          .setDisplaySize(108, 108)
          .setDepth(10),
        footLight = footGlow(this, p.x, p.y, 0.34)?.setDepth(6),
        label = this.add
          .text(p.x, p.y - 142, p.name, {
            fontFamily: "Noto Sans Thai",
            fontSize: "14px",
            fontStyle: "bold",
            color: p.id === state.self.id ? "#fff0b5" : "#e4fff6",
            stroke: "#193c51",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(14),
        gearBadge = this.add
          .text(p.x + 48, p.y - 116, "", {
            fontFamily: "Noto Sans Thai",
            fontSize: "12px",
            fontStyle: "bold",
            color: "#d9e3df",
            stroke: "#07131e",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(14);
      const marker =
        p.id === state.self.id
          ? this.add
              .text(p.x, p.y - 175, "▼", {
                fontFamily: "Noto Sans Thai",
                fontSize: "16px",
                color: "#ffd86b",
                stroke: "#5a3a0a",
                strokeThickness: 4,
              })
              .setOrigin(0.5)
              .setDepth(14)
          : null;
      outline(image);
      a = {
        image,
        label,
        gearBadge,
        shadow,
        footLight,
        marker,
        target: p,
        wasGrounded: p.grounded,
        footstepAt: 0,
      };
      this.actors.set(p.id, a);
    }
    a.target = p;
    if (reset || !a.history) a.history = [];
    a.history.push({ time: stamp, x: p.x, y: p.y, vx: p.vx || 0 });
    if (a.history.length > 8) a.history.shift();
    return a;
  }
  applySnapshot(s) {
    const area =
      s.area === "town"
        ? "town"
        : "dungeon" +
          s.dungeon.instanceId +
          ":" +
          s.dungeon.floor +
          ":" +
          s.dungeon.stage;
    const areaChanged = area !== this.lastArea;
    if (areaChanged) {
      loadingArrived(s);
      const fromTown = this.lastArea === "town";
      this.lastArea = area;
      const town = s.area === "town";
      const bossStage = !town && s.dungeon?.stage === 3 && !s.dungeon?.training;
      music(town ? "town" : bossStage ? "boss" : "dungeon");
      if (fromTown && !town) sfx("portal");
      if (bossStage) setTimeout(() => sfx("roar"), 600);
      this.cameras.main.setBounds(0, -100, areaWidth(s.area), 950);
      this.parallax.setArea(
        town ? "town" : "cave",
        town ? null : FLOORS[s.dungeon.floor - 1].color,
      );
      this.lookX = 0;
      this.npcs.forEach((n) => n.setVisible(town));
      this.hotspots.forEach((z) => (z.input.enabled = town));
      this.hoverRing.setVisible(false);
      this.portalLabel.setVisible(town);
      this.portal.setVisible(town);
      this.portalGlow.setVisible(town);
      this.makePlatforms();
      this.cameras.main.centerOn(s.self.x, this.camY);
      this.actors.forEach((a) => {
        a.image.x = s.self.x;
        a.image.y = s.self.y;
      });
    }
    const all = [s.self, ...s.players],
      ids = new Set(all.map((p) => p.id));
    for (const p of all) this.actor(p, s.time, areaChanged);
    for (const [id, a] of this.actors)
      if (!ids.has(id)) {
        Object.values(a).forEach((o) => o?.destroy?.());
        this.actors.delete(id);
      }
    const enemies = s.dungeon?.enemies || [],
      eids = new Set(enemies.map((e) => e.id)),
      types = [
        "slime",
        "bat",
        "boar",
        "mushroom",
        "wolf",
        "goblin",
        "batking",
        "golem",
        "serpent",
      ];
    for (const e of enemies) {
      let m = this.monsters.get(e.id);
      if (!m) {
        this.sprites.want("monsters", e.type);
        const mset = this.monsterSets.get(e.type),
          size =
            (mset ? mset.height + 12 : e.boss ? 210 : 95) *
            (e.elite ? 1.25 : 1);
        const image = this.add
          .image(e.x, e.y, "monsters", types.indexOf(e.type))
          .setDisplaySize(size, size)
          .setOrigin(0.5, 1)
          .setDepth(8);
        const label = this.add
          .text(
            e.x,
            e.y - size - 15,
            e.boss
              ? FLOORS[s.dungeon.floor - 1].boss
              : `${e.elite ? "★ หัวหน้า " : ""}${["ค้างคาวถ้ำ", "ศิลาผา", "วารี", "รากไพร", "เพลิง", "เหมันต์", "อัสนี", "เงา", "มังกร", "จันทรา"][s.dungeon.floor - 1]} · ${{ slime: "สไลม์", bat: "ค้างคาว", boar: "หมูป่า", mushroom: "เห็ดพิษ", wolf: "หมาป่า", goblin: "ก็อบลิน", golem: "โกเลม", serpent: "อสรพิษ" }[e.type] || e.type}`,
            {
              fontFamily: "Noto Sans Thai",
              fontSize: "14px",
              color: "#ffe1b5",
              stroke: "#152b4b",
              strokeThickness: 4,
            },
          )
          .setOrigin(0.5)
          .setDepth(15);
        const bar = this.add.graphics().setDepth(14);
        m = { image, label, bar, target: e, size };
        createMonsterExtras(this, m, e, true);
        this.monsters.set(e.id, m);
      }
      m.target = e;
      if (areaChanged || !m.history) m.history = [];
      m.history.push({
        time: s.time,
        x: e.x,
        y: e.y,
        vx: e.moving
          ? e.direction * (e.boss ? 75 : e.aggro === false ? 30 : e.speed || 90)
          : 0,
      });
      if (m.history.length > 8) m.history.shift();
    }
    for (const [id, m] of this.monsters)
      if (!eids.has(id)) {
        if (!areaChanged) {
          this.fx.death(m.image.x, m.image.y, m.target.boss);
          sfx(m.target.boss ? "bossDown" : "kill", null, 0.06);
        }
        if (areaChanged) m.image.destroy();
        else if (
          !playMonsterDeath(this, m.image, this.monsterSets.get(m.target.type))
        )
          monsterDeath(this, m, this.slimeAtlas);
        m.label.destroy();
        m.bar.destroy();
        destroyMonsterExtras(m);
        this.monsters.delete(id);
      }
    for (const e of s.dungeon?.events || []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (seen.size > 500) seen = new Set([...seen].slice(-200));
      this.effect(e);
    }
    const sh = JSON.stringify(s.shops.map((v) => [v.id, v.x, v.name, v.qty]));
    if (sh !== this.lastShops) {
      this.shopObjects.forEach((o) => o.destroy());
      this.shopObjects = [];
      for (const shop of s.shops) {
        const shadow = this.add
          .ellipse(shop.x, WORLD.ground - 3, 132, 18, 0x172d22, 0.28)
          .setDepth(3);
        const stall = this.add
          .image(shop.x, WORLD.ground + 1, "player-market-stall")
          .setOrigin(0.5, 1)
          .setDisplaySize(152, 127)
          .setDepth(4);
        outline(stall, 6, 2);
        const light = footGlow(this, shop.x, WORLD.ground - 2, 0.26)
          ?.setDisplaySize(170, 30)
          .setDepth(3);
        const label = this.add
          .text(shop.x, WORLD.ground - 141, shop.name, {
            fontFamily: "Noto Sans Thai",
            fontSize: "12px",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 138 },
            backgroundColor: "#243a32dd",
            padding: { x: 7, y: 4 },
            color: "#fff2cd",
            stroke: "#193851",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(14);
        this.shopObjects.push(
          shadow,
          ...(light ? [light] : []),
          stall,
          label,
          this.hotspot(shop.x, WORLD.ground, 152, 127, () =>
            openTown("shop:" + shop.id),
          ),
        );
      }
      this.lastShops = sh;
    }
    this.shopObjects.forEach((o) => {
      o.setVisible(s.area === "town");
      if (o.input) o.input.enabled = s.area === "town";
    });
  }
  // Size says how much a drop matters: gold and ore are small pops that fade
  // fast; gear grows and lingers with its rarity.
  showDrop(e, key, color = "#ffd578", size = 34) {
    if (!this.textures.exists(key)) return;
    const big = size >= 60;
    const glow = this.add.circle(
      0,
      0,
      size * 0.4,
      Phaser.Display.Color.HexStringToColor(color).color,
      big ? 0.22 : 0.12,
    );
    const icon = this.add.image(0, 0, key).setDisplaySize(size, size);
    const drop = this.add.container(e.x, e.y, [glow, icon]).setDepth(44);
    this.tweens.add({
      targets: drop,
      y: e.y - (big ? 40 : 22),
      duration: big ? 450 : 320,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: glow,
      alpha: big ? 0.45 : 0.25,
      scale: big ? 1.4 : 1.2,
      duration: 650,
      yoyo: true,
      repeat: big ? 3 : 0,
    });
    this.tweens.add({
      targets: drop,
      alpha: 0,
      delay: big ? 2400 : 700,
      duration: big ? 600 : 350,
      onComplete: () => drop.destroy(),
    });
  }
  effect(e) {
    if (e.kind === "loot") {
      if (e.actorId === state.self.id) {
        const item = GEAR[e.item];
        toast(
          `ได้รับ ${item.icon} ${item.name} [${RARITIES[item.rarity]}] · เปิดกระเป๋า I เพื่อสวมใส่`,
        );
        soundCue("loot", item.rarity);
        const color = {
          common: "#d5ded9",
          rare: "#79d9f2",
          epic: "#d0a7ff",
          legendary: "#ffc35d",
        }[item.rarity];
        this.showDrop(
          e,
          `item-${e.item}`,
          color,
          { common: 64, rare: 76, epic: 88, legendary: 104 }[item.rarity] ?? 64,
        );
        const text = this.add
          .text(e.x, e.y - 60, `${item.name}\n${RARITIES[item.rarity]}`, {
            align: "center",
            fontFamily: "Noto Sans Thai",
            fontSize: item.rarity === "legendary" ? "20px" : "16px",
            color,
            stroke: "#07131e",
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(45);
        this.tweens.add({
          targets: text,
          y: e.y - 70,
          alpha: 0,
          duration: 2200,
          ease: "Cubic.Out",
          onComplete: () => text.destroy(),
        });
      }
      return;
    }
    if (e.kind === "drop") {
      if (e.actorId === state.self.id) this.showDrop(e, `drop-${e.item}`);
      return;
    }
    if (e.kind === "material") {
      if (e.actorId === state.self.id) {
        toast(`สะสมชุดชั้นนี้ครบแล้ว · ได้แร่จันทรา ×${e.amount}`);
        soundCue("material");
        this.showDrop(e, "drop-ore", "#9fe6ff", 48);
      }
      return;
    }
    if (e.kind === "streak") {
      const text = this.add
        .text(e.x, e.y, `ต่อเนื่อง ×${e.streak} · +${e.bonus} ทอง · +4 MP`, {
          fontFamily: "Noto Sans Thai",
          fontSize: "18px",
          color: "#ffe29a",
          stroke: "#44301f",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(35);
      this.tweens.add({
        targets: text,
        y: e.y - 55,
        alpha: 0,
        duration: 1400,
        onComplete: () => text.destroy(),
      });
      return;
    }
    if (e.kind === "eruption") {
      this.fx.death(e.x, e.y, false);
      return;
    }
    const source =
      this.actors.get(e.actorId)?.image || this.monsters.get(e.actorId)?.image;
    if (e.kind === "damage") {
      // Your own hits and hurts are loud; other players' are thinned out.
      const mine =
        e.actorId === state?.self.id || e.targetId === state?.self.id;
      if (e.amount < 0) {
        if (e.targetId === state?.self.id) sfx("hurt", null, 0.08);
        else sfx("hit", null, 0.12);
      } else
        sfx(
          e.crit ? "crit" : "hit",
          {
            class: e.class || this.actors.get(e.actorId)?.target.class,
            volume: mine ? 1 : 0.35,
          },
          mine ? 0.04 : 0.12,
        );
      const monster = this.monsters.get(e.targetId),
        actor = this.actors.get(e.targetId);
      this.fx.hit(
        e,
        source?.x,
        monster || actor,
        e.targetId === state?.self.id,
      );
    } else {
      const cls = e.class || this.actors.get(e.actorId)?.target.class,
        kind = {
          swordsman: ["swing", "slash"],
          archer: ["arrow", "volley"],
          mage: ["cast", "spell"],
        }[cls] || ["swing", "slash"];
      sfx(
        kind[e.skill ? 1 : 0],
        { volume: e.actorId === state?.self.id ? 1 : 0.35 },
        e.actorId === state?.self.id ? 0.02 : 0.1,
      );
      this.fx.attack(e);
    }
  }
  drawDungeonHazards(time) {
    const g = this.telegraphs,
      d = state.dungeon;
    this.dangerHint.setVisible(false);
    if (!d || d.clear) return;
    const threats = [
      ...(d.hazards || []).map((h) => ({ ...h, crystal: true })),
      ...d.enemies
        .filter((e) => e.action?.kind === "slam")
        .map((e) => e.action),
    ];
    let hint = null;
    for (const h of threats) {
      const charging = time < h.impactAt;
      if (!h.crystal) {
        if (charging && Math.abs(h.x - state.self.x) < h.radius + 180) hint = h;
        continue;
      }
      const progress = Phaser.Math.Clamp(
        (time - h.startedAt) / (h.impactAt - h.startedAt),
        0,
        1,
      );
      const color = charging ? 0xffca6b : 0xb7f7ff;
      g.fillStyle(color, charging ? 0.12 + progress * 0.22 : 0.4);
      g.fillEllipse(h.x, WORLD.ground - 3, h.radius * 2, 26);
      g.lineStyle(charging ? 2 : 3, color, 0.9);
      g.strokeEllipse(h.x, WORLD.ground - 3, h.radius * 2, 26);
      for (let x = h.x - h.radius + 12; x < h.x + h.radius; x += 28) {
        const height = charging ? 8 + progress * 10 : 45 + Math.sin(x) * 15;
        g.fillStyle(charging ? 0xf4d08f : 0x9defff, charging ? 0.45 : 0.9);
        g.fillTriangle(
          x - 7,
          WORLD.ground,
          x,
          WORLD.ground - height,
          x + 7,
          WORLD.ground,
        );
      }
      if (charging && Math.abs(h.x - state.self.x) < h.radius + 180) hint = h;
    }
    if (hint)
      this.dangerHint
        .setVisible(true)
        .setPosition(hint.x, WORLD.ground - 105)
        .setText(
          `${hint.crystal ? "คริสตัลปะทุ" : "บอสทุบพื้น"} · ${Math.max(0, hint.impactAt - time).toFixed(1)}s\nSPACE กระโดด หรือเดินหลบวง`,
        );
  }
  dust(x, y, count = 7) {
    if (this.reducedMotion || this.children.length > 180) return;
    for (let n = 0; n < count; n++) {
      const dot = this.add
        .ellipse(x, y - 3, 3 + Math.random() * 4, 2, 0xc2d6c4, 0.45)
        .setDepth(9);
      this.tweens.add({
        targets: dot,
        x: x + (Math.random() - 0.5) * 40,
        y: y - 10 - Math.random() * 10,
        alpha: 0,
        duration: 250,
        onComplete: () => dot.destroy(),
      });
    }
  }
  update(time, dt) {
    if (!state) return;
    const serverTime =
      performance.now() / 1000 +
      (serverOffset ?? state.time - performance.now() / 1000);
    this.telegraphs.clear();
    this.drawDungeonHazards(serverTime);
    this.townNpcs.update(
      time,
      state.area === "town",
      this.reducedMotion,
      state.self,
    );
    for (const [id, a] of this.actors) {
      const p = a.target,
        pose = animateHero(a.image, p, serverTime, this.knightAtlas),
        // Specialization costume when its art exists, else the class look.
        spriteSet = heroSkins(p)
          .map((k) => this.spriteSets.get(k))
          .find(Boolean);
      if (spriteSet) {
        playSpriteSet(a.image, spriteSet, p, pose, serverTime);
        if (!a.image._spriteStill) a.image.setAngle(0);
        if (spriteSet.facing < 0) a.image.toggleFlipX();
      }
      const point = sampleMotion(
        a.history,
        serverTime - (id === state.self.id ? 0.05 : 0.08),
      );
      a.image.setPosition(point.x, point.y);
      animateHeroBody(a, p, pose, serverTime, time);
      this.fx.applyKick(a, a.image);
      // Name sits just above the head: painted sets know their height.
      const headroom = spriteSet ? spriteSet.height + 24 : 158;
      a.label.setPosition(a.image.x, a.image.y - (p.hp <= 0 ? 60 : headroom));
      const visibleGear = Object.values(p.equipment || {})
        .map((itemId) => GEAR[itemId])
        .filter(Boolean);
      const weapon = visibleGear.find((item) => item.slot === "weapon"),
        rarityRank = { common: 0, rare: 1, epic: 2, legendary: 3 },
        best = visibleGear.reduce(
          (top, item) =>
            !top || rarityRank[item.rarity] > rarityRank[top.rarity]
              ? item
              : top,
          null,
        ),
        gearColor = {
          common: "#d5ded9",
          rare: "#79d9f2",
          epic: "#d0a7ff",
          legendary: "#ffc35d",
        }[best?.rarity || "common"];
      // Just the enhancement level, in the best item's rarity colour, beside
      // the name: text glyphs for weapon/armour read as clutter in the field.
      a.gearBadge
        .setText(p.upgrade && weapon ? `+${p.upgrade}` : "")
        .setColor(gearColor)
        .setPosition(
          a.image.x + a.label.width / 2 + 14,
          a.image.y - (p.hp <= 0 ? 60 : headroom),
        )
        .setVisible(p.hp > 0 && !!weapon && p.upgrade > 0);
      a.marker
        ?.setPosition(
          a.image.x,
          a.image.y - headroom - 20 + Math.sin(time * 0.006) * 4,
        )
        .setVisible(p.hp > 0);
      a.shadow
        .setPosition(a.image.x, p.grounded ? p.y : 600)
        .setAlpha(p.grounded ? 0.35 : 0.16)
        .setScale(p.grounded ? 1 : 0.65);
      a.footLight
        ?.setPosition(a.image.x, p.grounded ? p.y - 2 : 598)
        .setAlpha(p.hp <= 0 ? 0 : p.grounded ? 0.34 : 0.14);
      if (p.grounded && !a.wasGrounded && p.hp > 0) {
        this.dust(a.image.x, p.y);
        a.landAt = time;
        if (id === state.self.id) sfx("land");
      }
      if (
        id === state.self.id &&
        p.moving &&
        p.grounded &&
        serverTime - a.footstepAt > (p.running ? 0.19 : 0.29)
      ) {
        a.footstepAt = serverTime;
        this.dust(a.image.x - p.direction * 12, p.y, 3);
        sfx("step", null, 0.1);
      }
      if (id === state.self.id && a.wasGrounded && !p.grounded && p.vy < -200)
        sfx("jump");
      a.wasGrounded = p.grounded;
      if (p.action && serverTime < p.action.impactAt) {
        const progress =
          (serverTime - p.action.startedAt) /
          (p.action.impactAt - p.action.startedAt);
        this.telegraphs.lineStyle(
          1,
          p.action.skill ? 0xc4a3ff : 0xffd78d,
          0.3 + progress * 0.5,
        );
        this.telegraphs.strokeEllipse(
          a.image.x,
          p.y - 8,
          65 + progress * 20,
          14,
        );
        if (p.action.skill)
          this.fx.charge(
            a.image.x,
            a.image.y - 60,
            CLASSES[p.class].color,
            progress,
          );
      }
    }
    for (const m of this.monsters.values()) {
      const e = m.target;
      const mpose = animateSlime(
          m.image,
          e,
          serverTime,
          this.slimeAtlas,
          m.size,
        ),
        mset = this.monsterSets.get(e.type);
      if (mset) {
        // A set that finished loading after spawn: adopt its size.
        if (!m.setSized) {
          m.setSized = true;
          m.size = (mset.height + 12) * (e.elite ? 1.25 : 1);
        }
        playMonsterSet(m.image, mset, e, mpose, serverTime);
      }
      const point = sampleMotion(m.history, serverTime - 0.08);
      m.image.setPosition(point.x, point.y);
      animateMonsterBody(m, e, serverTime, time, this.slimeAtlas);
      if (serverTime - (e.hitAt || 0) > 0.18 && !state.dungeon?.training) {
        m.image.setTint(
          [
            0xe5d5ff, 0xddd0b8, 0xafffe0, 0xc8efa9, 0xffb18a, 0xbdeaff,
            0xffe7a3, 0xcab1ef, 0xffc0a3, 0xd4d4ff,
          ][state.dungeon.floor - 1],
        );
      }
      this.fx.applyKick(m, m.image);
      if (e.boss)
        m.label.setText(
          FLOORS[state.dungeon.floor - 1].boss +
            (e.hp <= e.maxHp * 0.5 ? " · คลั่ง!" : ""),
        );
      m.label.setPosition(m.image.x, m.image.y - m.size - 14);
      m.bar.setPosition(m.image.x, m.image.y);
      m.lagHp ??= e.hp;
      if (m.lagHp < e.hp) m.lagHp = e.hp;
      else if (m.lagHp > e.hp && time - (m.lagHoldAt ?? 0) > 0)
        m.lagHp = Math.max(e.hp, m.lagHp - e.maxHp * dt * 0.0007);
      if (m.barHp !== e.hp) m.lagHoldAt = time + 300;
      if (m.barHp !== e.hp || m.barLag !== m.lagHp) {
        m.barHp = e.hp;
        m.barLag = m.lagHp;
        const w = e.boss ? 120 : e.elite ? 90 : 70,
          top = -m.size + 4,
          pct = (v) => Math.max(0, v / e.maxHp);
        m.bar.clear();
        m.bar.fillStyle(0x05101f, 0.92);
        m.bar.fillRoundedRect(-w / 2 - 2, top - 2, w + 4, 9, 4);
        m.bar.fillStyle(0xfff1c4, 0.95);
        m.bar.fillRoundedRect(-w / 2, top, w * pct(m.lagHp), 5, 2);
        m.bar.fillStyle(e.boss ? 0xdd5fb8 : e.elite ? 0xffc340 : 0xff6b4a);
        m.bar.fillRoundedRect(-w / 2, top, w * pct(e.hp), 5, 2);
        m.bar.fillStyle(0xffffff, 0.35);
        m.bar.fillRect(-w / 2 + 1, top + 1, Math.max(0, w * pct(e.hp) - 2), 1);
      }
      if (e.action && serverTime < e.action.impactAt) {
        const progress = Math.max(
          0,
          (serverTime - e.action.startedAt) /
            (e.action.impactAt - e.action.startedAt),
        );
        this.telegraphs.fillStyle(0xff725b, 0.08 + progress * 0.25);
        this.telegraphs.fillEllipse(
          e.action.kind === "slam" ? e.action.x : e.x + e.action.direction * 42,
          e.y - 3,
          e.action.kind === "slam" ? e.action.radius * 2 : e.boss ? 240 : 160,
          30,
        );
        this.telegraphs.lineStyle(2, 0xff9474, 0.8);
        this.telegraphs.strokeEllipse(
          e.action.kind === "slam" ? e.action.x : e.x + e.action.direction * 42,
          e.y - 3,
          e.action.kind === "slam" ? e.action.radius * 2 : e.boss ? 240 : 160,
          30,
        );
      }
    }
    const me = this.actors.get(state.self.id);
    if (me) {
      const c = this.cameras.main,
        lead = Phaser.Math.Clamp((me.target.vx || 0) * 0.35, -110, 110);
      // Look ahead in the walking direction and lift the camera on jumps.
      this.lookX = Phaser.Math.Linear(this.lookX || 0, lead, 0.04);
      const targetX = Phaser.Math.Clamp(
          me.image.x + this.lookX,
          c.width / c.zoom / 2,
          areaWidth(state.area) - c.width / c.zoom / 2,
        ),
        // Portrait follows climbs fully (terraces rise far above the ground).
        targetY =
          this.camY +
          (this.portrait
            ? Math.min(0, me.image.y - WORLD.ground)
            : Phaser.Math.Clamp((me.image.y - WORLD.ground) * 0.3, -50, 0));
      c.centerOn(
        Phaser.Math.Linear(c.midPoint.x, targetX, 0.08),
        Phaser.Math.Linear(c.midPoint.y, targetY, 0.06),
      );
    }
    this.worldDetails.update(
      time,
      state,
      this.showWalkability,
      this.reducedMotion,
    );
    this.parallax.update(time);
  }
}

function toggleWalkability() {
  const button = $("#walkability-toggle");
  const enabled = button.getAttribute("aria-pressed") !== "true";
  button.setAttribute("aria-pressed", String(enabled));
  if (scene) scene.showWalkability = enabled;
}
$("#walkability-toggle").onclick = toggleWalkability;

function resetLobbyCreation() {
  lobbyMode = "create";
  lobbyCharacterId = null;
  $("#character-name").readOnly = false;
  $("#character-name").value = "";
}
$("#new-hero").onclick = () => {
  resetLobbyCreation();
  renderCards();
  $("#character-name").focus();
};
function cycleLobbyClass(direction) {
  if (lobbyMode === "roster" && characters.length) {
    const index = characters.findIndex((c) => c.id === lobbyCharacterId);
    const next =
      characters[(index + direction + characters.length) % characters.length];
    $(`[data-resume="${next.id}"]`)?.click();
    return;
  }
  if (lobbyMode !== "create") return;
  if (lobbyCharacterId) resetLobbyCreation();
  job = JOBS[(JOBS.indexOf(job) + direction + JOBS.length) % JOBS.length];
  renderCards();
  tone(550, 0.08);
}
$$("[data-cycle]").forEach(
  (b) => (b.onclick = () => cycleLobbyClass(Number(b.dataset.cycle))),
);
$("#character-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("#start").disabled) {
    e.preventDefault();
    $("#start").click();
  }
});
addEventListener("keydown", (e) => {
  if (
    $("#landing").classList.contains("hidden") ||
    activePanel ||
    e.repeat ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
  )
    return;
  if (["ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
    cycleLobbyClass(e.code === "ArrowLeft" ? -1 : 1);
  } else if (e.code === "Enter" && !$("#start").disabled) {
    e.preventDefault();
    $("#start").click();
  }
});

$("#creation-back").onclick = () => {
  if (characters.length) $("[data-resume]")?.click();
};
function lobbyHeroStyle(c, g, hero) {
  return heroStyle(c, g, hero);
}
