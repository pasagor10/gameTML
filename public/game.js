import { createWorldLabels } from "/world-labels.js";
import { townWanderers, wandererPose } from "/shared/town-wanderers.js";
import { preloadRiverside } from "/riverside-map.js";
import { RIVER_DOCKS } from "/shared/riverside-layout.js";
import { TOWNS, townOf, TRAVEL_GATE, MINE_INFO } from "/shared/towns.js";
import { EXTRA_MONSTERS } from "/shared/extra-monsters.js";
import { createDungeonProps } from "/dungeon-props.js?v=1";
import { updateDivineAura } from "/divine-fx.js?v=1";
import { prepareUltimate, showUltimateCutin, showUltimateImpact } from "/ultimate-ui.js?v=2";
import { ULTIMATES } from "/shared/ultimates.js";
import { communityPanel, NEWS_ID } from "/community-ui.js?v=3";
import { screenShakeEnabled, setScreenShakeEnabled, shakeCamera } from "/screen-shake.js?v=1";
import { BOSSES } from "/shared/bosses.js";
import { MECHANICS, WATER_Y, SPIKE_BAND } from "/shared/boss-mechanics.js";
import { bindAnnouncements, receiveAnnouncement, announcementHistory } from "/announcements.js";
import { updatePartyUi, bindPartyUi } from "/party-ui.js?v=2";
import { showWorldHeroPreview } from "/hero-preview.js";
import { observeHudLayout } from "/hud-layout.js?v=2";
import { isWorldPointer } from "/world-input.js";
import { SLOT_MACHINE } from "/shared/slots.js";
import { slotPanelHtml, bindSlotPanel } from "/slots-ui.js?v=3";
import { heroPortraitStyle } from "/hero-appearance.js?v=4";
import { skillIcon, potionIcon, manaPotionIcon, autoIcon } from "/skill-icons.js?v=5";
import { dungeonPlatforms, withinDungeonSign } from "/shared/dungeons.js";
import { supplyArt, itemArtPath, costumeArtPath } from "/item-art.js?v=2";
import { COSTUME_ITEMS } from "/shared/costumes.js";
import {
  sfx,
  music,
  setSound,
  soundOn,
  setMusic,
  musicOn,
  prepareMusic,
} from "/sound.js?v=20261119-perf";
import { TOWN_ANIMS, TOWN_LAYOUT, TOWN_PROPS, TOWN_VIEW } from "/shared/town-layout.js";
import { createWorldDetails } from "/world-details.js?v=5";
import {
  rpgPanel,
  bindRpgPanel,
  gearShop,
} from "/rpg-ui.js?v=21";
import {
  GEAR,
  RARITIES,
  FLOOR_LOOT,
  CLASS_SKILLS,
  SPECIALIZATIONS,
  heroSkins,
  SLOTS,
  ENHANCEMENT_BONUSES,
  enhancementLevel,
  enhancementCost,
  enhancementChance,
  MAX_ENHANCE,
  ENHANCE_BREAK_LEVEL,
  ADVANCE_LEVEL,
} from "/shared/rpg.js";
import { openNpcTalk, closeNpcTalk } from "/npc-dialogue.js?v=1";
import { createTownNpcs, footGlow, createRim } from "/town-npcs.js?v=14";
import { updateEnhanceAura, updateSetGlow, AURA_LEVEL } from "/enhance-aura.js?v=7";
import { marketHtml, shopManagerHtml, marketState } from "/market-ui.js?v=12";
import { sampleMotion } from "/shared/smoothing.js";
import { mergeSnapshot, SNAPSHOT_PROTOCOL } from "/shared/snapshot-delta.js?v=1";
import {
  questPanelHtml,
  setQuestTab,
  portrait,
  trackerHtml,
  claimable,
} from "/quest-ui.js?v=4";
import { dungeonPanelHtml } from "/dungeon-ui.js?v=45";
import { createNightSky } from "/night-sky.js?v=3";
import {
  nightInfo,
  nightBoss,
  nightFloor,
  nightReward,
  NIGHT_CAVE,
  NIGHT_BOSS,
} from "/shared/night.js";
import { traitOf, TRAITS } from "/shared/dungeons.js";
import { MONSTERS } from "/shared/quests.js";
import { ACTIONS } from "/shared/motion.js";
import {
  registerMotionAtlas,
  animateHero,
  animateSlime,
  monsterDeath,
} from "/combat-visuals.js?v=0.3.1";
import { createSelectionPreview } from "/selection-scene.js?v=0.24.0";
import {
  CLASSES,
  ITEMS,
  POTIONS,
  BLESS_STONE,
  HIGH_STONE,
  HIGH_STONE_FROM,
  MAX_LEVEL,
  expToLevel,
  POTION_SIZES,
  STACK_SUPPLIES,
  MAX_BUY,
  potionCount,
  FLOORS,
  MAIN_FLOORS,
  WORLD,
  areaWidth,
  combatStats,
} from "/shared/config.js";
import { createParallax } from "/parallax.js?v=0.12.1";
import { PRESETS, CHOICES, autoLevel, createAutoTuner } from "/graphics-quality.js";
import { createPerfOverlay, logEvent, readLog, textureStats } from "/perf-overlay.js";
import { updateHudFx, enterHud } from "/hud-fx.js?v=0.6.7";
import { createCombatFx } from "/combat-fx.js?v=0.15.2";
import { activeEffects, effectTint, effectRow, hudEffects } from "/status-ui.js?v=1";
import { STATUSES, BUFFS } from "/shared/skills.js";
import { worldInfo } from "/shared/world-boss.js";
import { updateWorldBossHud, worldBossCountdown, clock as wbClock } from "/world-boss-ui.js?v=3";
import {
  animateHeroBody,
  animateMonsterBody,
  createMonsterExtras,
  destroyMonsterExtras,
} from "/creature-fx.js?v=0.12.1";
import {
  queueSpriteSets,
  createSpriteRegistry,
  playSpriteSet,
  playMonsterSet,
  playMonsterDeath,
  playLayers,
} from "/sprite-sets.js?v=0.25.0";
import { gearDress } from "/hero-gear.js?v=7";
import { tutorialUpdate, tutorialAction, tutorialRoom } from "/tutorial-hints.js?v=2";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
observeHudLayout($("#game-screen"));
bindPartyUi((data) => emit("party:action", data));
bindAnnouncements(() => showPanel("announcements"));
let onlinePlayers = null;
let lobbyCharacterId = null;
let lobbyMode = "loading";
let lastRpgPanelHash = "";
let lastQuestHash = "",
  lastTrackerHash = "";
// The dungeon run that already got its automatic AUTO switch-on.
let autoInstance = null;
// First-adventure guide: heroes who have not cleared floor 1 are led there.
const firstRunShown = new Set();
let townSince = 0;
// Floor data for the current dungeon; the night cave stands in for a floor.
const floorInfo = (d) =>
  d?.world
    ? worldInfo(d.world)
    : d?.night
      ? nightInfo(d.night)
      : FLOORS[(d?.floor || 1) - 1];
const questHash = (p) =>
  JSON.stringify([p.daily, p.bestiary, p.level, p.quest, state.area]);
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
const JOBS = ["swordsman", "archer", "mage", "priest"],
  eng = ["SWORDSMAN", "WIND RANGER", "ARCANE MAGE", "HOLY PRIEST"];
// Stand-in frame from the 3x2 class sheet until a hero's sprite set loads.
function frame(c, g) {
  return Math.min(2, JOBS.indexOf(c)) + (g === "female" ? 3 : 0);
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
  $("#sound").classList.toggle("muted", muted);
  $("#sound").setAttribute("aria-label", muted ? "เปิดเสียง" : "ปิดเสียง");
  $("#sound").title = muted ? "เปิดเสียง" : "ปิดเสียง";
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
    ? `เชื่อมต่อแล้ว · ${!account.registered ? "นักเดินทาง" : account.name} · บันทึกบนเซิร์ฟเวอร์`
    : "เล่นได้ทันทีแบบผู้มาเยือน · บันทึกบนเซิร์ฟเวอร์";
  $("#character-count").textContent = `${characters.length} / 3`;
  $("#saved-characters").innerHTML = characters.length
    ? characters
        .map(
          (c) =>
            `<button data-resume="${c.id}" class="hl-slot" type="button"><span class="hl-slot-icon" aria-hidden="true">${skillIcon(c.class, 1)}</span><span class="hl-slot-face" aria-hidden="true" style="${heroStyle(c.class, c.gender, c)}"></span><span class="hl-slot-text"><strong>${escape(c.name)}</strong><small>Lv.${c.level} · ${CLASSES[c.class]?.name || ""}</small></span><b>Lv.${c.level}</b></button>`,
        )
        .join("") +
      (characters.length < 3
        ? `<button class="hl-slot hl-slot-new" type="button" data-new-slot><span class="hl-slot-icon" aria-hidden="true">＋</span><span class="hl-slot-text"><strong>สร้างผู้กล้าใหม่</strong><small>ว่าง ${3 - characters.length} ช่อง</small></span></button>`
        : "")
    : "";
  $$("[data-new-slot]").forEach((b) => (b.onclick = () => $("#new-hero").click()));
  const named = account?.registered;
  $("#account-short").textContent = named ? account.name : "ผู้มาเยือน";
  $("#account-open").classList.toggle("signed-in", !!named);
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
    resetLobbyCreation();
    selectedId = null;
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
  priest: {
    title: "THE LIGHTBEARER",
    role: "ฟื้นฟูทีม · แสงศักดิ์สิทธิ์",
    lore: "ผู้ถือแสงแห่งศรัทธา รักษาสหายและขับไล่ความมืดในถ้ำ",
    skill: "✚ แสงชำระ · ธรรมรักษา · วงล้อแสง",
  },
};
function renderCards() {
  const saved = characters.find((c) => c.id === lobbyCharacterId);
  $("#delete-hero").hidden = lobbyMode !== "roster" || !saved;
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
  $("#lobby-level").textContent = String(saved?.level || 1);
  $("#selected-role").textContent = `${c.icon} ${c.name} · ${detail.role}`;
  $("#identity-label").innerHTML = saved
    ? "ผู้กล้าที่เลือก <small>พร้อมเดินทางต่อ</small>"
    : "ชื่อผู้กล้าใหม่ <small>2–20 ตัวอักษร</small>";
  $("#start-label").textContent = saved ? "เข้าเกม" : "สร้างผู้กล้า";
  // New players can skip choosing: a random class, look and name.
  $("#quick-start").hidden = lobbyMode !== "create" || characters.length >= 3;
  $("#start").disabled = !saved && characters.length >= 3;
  $$("[data-resume]").forEach((b) => {
    b.classList.toggle("active", b.dataset.resume === lobbyCharacterId);
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.resume === lobbyCharacterId),
    );
  });
  $(".hl-stage").style.setProperty(
    "--hero-accent",
    "#" + c.color.toString(16).padStart(6, "0"),
  );
  $("#selected-class").textContent = saved?.name || c.name;
  $("#selected-epithet").textContent = detail.title;
  $("#selected-lore").textContent = detail.lore;
  $("#hero-stats").innerHTML =
    `<div class="class-identity"><span>${c.icon}</span><div><h3>${saved ? `${escape(saved.name)} · ${c.name} Lv.${saved.level}` : c.name}</h3><small class="class-eng">${eng[JOBS.indexOf(job)] || ""}</small><p class="class-role">${detail.role}</p></div><i class="class-face" aria-hidden="true" style="${heroStyle(job, gender, saved)}"></i></div><p class="class-lore">${detail.lore}</p><div class="stats-heading"><span>${saved ? "ค่าสถานะปัจจุบัน" : "ค่าสถานะเริ่มต้น"}</span><small>ATTRIBUTES</small></div><div class="lobby-attributes">${[
      ["HP", "พลังชีวิต", c.hp],
      ["MP", "พลังเวท", c.mp],
      ["ATK", "พลังโจมตี", c.atk],
      ["DEF", "พลังป้องกัน", c.def],
    ]
      .map(
        ([key, label, value]) =>
          `<div class="attribute" data-stat="${key}"><div><span><b>${key}</b> <small>${label}</small></span><strong>${value}</strong></div></div>`,
      )
      .join("")}
  </div><div class="stats-heading skill-heading"><span>สกิลประจำคลาส</span><small>SKILL PREVIEW</small></div><div class="lobby-skills">${CLASS_SKILLS[job].map((skill, i) => `<button data-lobby-skill="${i}" title="${skill.name} · ${skill.detail} · ${ACTIONS[i + 1].mp} MP"><span>${skillIcon(job, i + 1)}</span><div><strong>${skill.name}</strong><small>${ACTIONS[i + 1].mp} MP · ${ACTIONS[i + 1].cooldown} วินาที</small></div><b>${["Q", "W", "E", "S"][i]}</b></button>`).join("")}</div>`;
  $$("[data-lobby-skill]").forEach(
    (b) =>
      (b.onclick = () => {
        selectionPreview?.preview("skill");
        b.classList.add("skill-previewing");
        setTimeout(() => b.classList.remove("skill-previewing"), 800);
      }),
  );
  // A class this browser's cached rules don't know yet stays hidden.
  $("#class-cards").innerHTML = JOBS.filter((name) => CLASSES[name]).map(
    (name, i) =>
      `<button class="hl-class ${name === job ? "active" : ""}" type="button" data-class="${name}" aria-pressed="${name === job}" aria-label="เลือก${CLASSES[name].name}"><span class="hl-class-icon" aria-hidden="true">${skillIcon(name, 1)}</span><strong>${CLASSES[name].name}</strong><small>${eng[i]}</small></button>`,
  ).join("");
  $$("[data-gender]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.gender === gender));
    b.classList.toggle("active", b.dataset.gender === gender);
  });
  // The stage lines up every saved hero, or every class to create.
  const lineup = lobbyLineup();
  selectionPreview?.setLineup(lineup.entries, lineup.index);
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
function lobbyLineup() {
  if (lobbyMode === "roster" && characters.length)
    return {
      entries: characters.map((c) => ({ id: c.id, job: c.class, skins: heroSkins(c), hero: c })),
      index: Math.max(0, characters.findIndex((c) => c.id === lobbyCharacterId)),
    };
  const jobs = JOBS.filter((name) => CLASSES[name]);
  return {
    entries: jobs.map((name) => ({
      id: `create-${name}-${gender}`,
      job: name,
      skins: [`${name}-${gender}`],
      hero: { class: name, gender, equipment: { weapon: `starter_${name}` } },
    })),
    index: Math.max(0, jobs.indexOf(job)),
  };
}
// The lobby's hero stage is a second WebGL game with its own textures; it
// exists only while the lobby shows (enterGame destroys it, the way back
// mounts it again), so a small tablet never holds both scenes at once.
function mountSelection() {
  if (selectionPreview) return;
try {
  selectionPreview = createSelectionPreview({
    onPick(i) {
      if (lobbyMode === "roster" && characters.length) {
        $(`[data-resume="${characters[i]?.id}"]`)?.click();
        return;
      }
      const name = JOBS.filter((n) => CLASSES[n])[i];
      if (!name || name === job) return;
      if (lobbyCharacterId) resetLobbyCreation();
      job = name;
      renderCards();
      tone(550, 0.08);
    },
  });
} catch {
  /* The full-body static art remains available if WebGL is unavailable. */
}
}
mountSelection();
renderCards();
// Name field: live length and a random fantasy name.
{
  const name = $("#character-name"),
    count = () => ($("#name-count").textContent = `${[...name.value].length}/20`),
    first = ["อรุณ", "ดารา", "พายุ", "เพลิง", "จันทรา", "ไพร", "เงา", "ฟ้า", "คีรี", "นาคา", "วายุ", "อัคนี", "ธารา", "ภูผา", "รัตติ", "ประกาย", "มณี", "สายฟ้า", "หิมะ", "ตะวัน"],
    last = ["ไกร", "เดช", "กานต์", "ภพ", "ธร", "ชัย", "นภา", "พร", "ฤทธิ์", "ศักดิ์", "ลดา", "สิริ", "รัตน์", "เวท", "ศร", "ดาบ"];
  name.addEventListener("input", count);
  $("#random-name").onclick = () => {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    let next;
    do next = pick(first) + pick(last);
    while (next === name.value);
    name.value = next;
    count();
    tone(660, 0.06);
  };
  count();
}
$$("[data-preview]").forEach(
  (b) => (b.onclick = () => selectionPreview?.preview(b.dataset.preview)),
);
// Arriving from the front page (/play?auto=1): a player who already has a
// hero goes straight into the game with the one played last; a new player
// stays on hero creation. The select screen is still in the in-game menu.
function autoResume() {
  if (!new URLSearchParams(location.search).has("auto")) return;
  history.replaceState(null, "", "/play");
  if (!characters.length) return;
  let last = null;
  try { last = localStorage.getItem("tml-last-hero"); } catch {}
  const id = characters.some((c) => c.id === last) ? last : characters[0].id;
  $(`[data-resume="${id}"]`)?.click();
  if (lobbyCharacterId === id) $("#start").click();
}
refreshAccount()
  .then(autoResume)
  .catch(() => toast("เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองใหม่", true));
// Quick start: pick class, gender and (unless typed) name at random, then
// create the hero exactly as the main button would.
$("#quick-start").onclick = () => {
  if ($("#start").disabled || $("#quick-start").disabled) return;
  const jobs = JOBS.filter((name) => CLASSES[name]);
  job = jobs[Math.floor(Math.random() * jobs.length)];
  gender = Math.random() < 0.5 ? "male" : "female";
  $$("[data-gender]").forEach((x) => x.classList.toggle("active", x.dataset.gender === gender));
  if ([...$("#character-name").value.trim()].length < 2) $("#random-name").click();
  renderCards();
  $("#quick-start").disabled = true;
  $("#start").click();
  setTimeout(() => ($("#quick-start").disabled = false), 1500);
};
$("#start").onclick = async () => {
  const b = $("#start");
  b.disabled = true;
  try {
    if (!account) { location.href = "/#account"; return; }
    if (lobbyCharacterId) {
      selectedId = lobbyCharacterId;
      enterGame();
      return;
    }
    const name = $("#character-name").value.trim();
    if (name.length < 2) throw Error("กรุณาตั้งชื่อตัวละครอย่างน้อย 2 ตัวอักษร");
    if (!account) {
      location.href = "/?account=register#account";
      return;
    }
    const c = await api("characters", { name, class: job, gender });
    selectedId = c.id;
    characters.push(c);
    showPrologue();
  } catch (e) {
    toast(e.message, true);
  } finally {
    b.disabled = false;
  }
};
function modal(title, html, panel) {
  closeNpcTalk();
  if ($("#modal").classList.contains("hidden")) sfx("open");
  activePanel = panel || "modal";
  $("#modal").dataset.panel = activePanel;
  keys.clear();
  touchDirection = 0;
  touchAttack = false;
  touchRun = false;
  jumpQueued = false;
  document.dispatchEvent(new Event("game:reset-controls"));
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").classList.remove("hidden");
  $("#modal-body").scrollTop = 0;
  $("#modal .modal-box").scrollTop = 0;
  $("#modal").classList.toggle(
    "rpg-modal",
    ["inventory", "class", "status", "wardrobe", "weapon"].includes(panel),
  );
  $("#modal").classList.toggle("quest-modal", panel === "quest");
  $("#modal").classList.toggle("dungeon-modal", panel === "dungeon" || panel === "mine");
  $("#modal").classList.toggle(
    "market-modal",
    ["market", "shop"].includes(panel),
  );
  if (socket?.connected)
    socket.emit("player:input", { direction: 0, seq: ++seq, jump: false });
}
function closeModal() {
  if (activePanel === "talk") closeNpcTalk();
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
  if (account?.registered) {
    modal("บัญชีผู้เล่น", `<p>เข้าสู่ระบบด้วยบัญชีเดิมบนเครื่องอื่น เพื่อเล่นตัวละครนี้ต่อได้</p><button id="account-home" class="primary-button">หน้าหลัก / จัดการบัญชี</button>`);
    $("#account-home").onclick = () => { location.href = "/#account"; };
    return;
  }
  modal("ผูกตัวละครกับบัญชี", `<p>ตั้งชื่อบัญชีและรหัสผ่านเพื่อเก็บตัวละคร เลเวล และของทั้งหมดไว้ เล่นต่อบนเครื่องอื่นได้ด้วยบัญชีนี้</p><form id="bind-account-form"><label>ชื่อบัญชี (3–30 ตัวอักษร)<input id="bind-name" autocomplete="username" minlength="3" maxlength="30" required></label><label>รหัสผ่าน (8–128 ตัวอักษร)<input id="bind-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>ยืนยันรหัสผ่าน<input id="bind-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><p id="bind-error" role="alert" class="error"></p><button type="submit" id="bind-submit" class="primary-button">สมัครสมาชิกและเก็บตัวละครเดิม</button></form>`);
  $("#bind-account-form").onsubmit = async (event) => {
    event.preventDefault();
    if ($("#bind-password").value !== $("#bind-confirm").value) {
      $("#bind-error").textContent = "รหัสผ่านทั้งสองช่องไม่ตรงกัน"; return;
    }
    $("#bind-submit").disabled = true;
    try {
      await api("auth/register", { name: $("#bind-name").value.trim(), password: $("#bind-password").value });
      await refreshAccount();
      closeModal();
      toast("ผูกบัญชีแล้ว ตัวละครและของเดิมอยู่ครบ ใช้บัญชีนี้เล่นต่อได้ทุกเครื่อง");
    } catch (error) {
      if ($("#bind-error")) $("#bind-error").textContent = error.message;
    } finally {
      if ($("#bind-submit")) $("#bind-submit").disabled = false;
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
  "dungeon:replay",
  "dungeon:leave",
  "training:enter",
  "town:travel",
  "mine:enter",
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
    set(".loading-title", townOf(s.self).name);
    set(".loading-sub", "พักฟื้น ซื้อของ และเตรียมตัวลงถ้ำอีกครั้ง");
  } else if (d?.training) {
    set(".loading-kicker", "ลานฝึกซ้อม");
    set(".loading-title", "สนามฝึก");
    set(".loading-sub", "ซ้อมท่าได้ไม่จำกัด ไม่เสียความคืบหน้า");
  } else if (d) {
    const floor = floorInfo(d);
    set(
      ".loading-kicker",
      d.mine ? "เหมืองแร่แรร์เอิร์ธ" : d.world
        ? "บอสโลก · ทุกคนร่วมกันตี"
        : d.night
          ? "ยามราตรี · ถ้ำลึกลับ"
          : "ชั้น " + d.floor + " / " + FLOORS.length,
    );
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
// The server's release changes on every deploy. A tab left open across one
// (common on tablets and the installed app) still runs the old code and
// shows old data, so reload it once onto the new files.
const PAGE_RELEASE = new URL(import.meta.url).searchParams.get("r");
// Show which build this device runs (lobby footer), e.g. "v0.49.0 · Ab3xYz".
// The stamp matches the server's when the device is up to date.
const BUILD_LABEL = [
  "v" + (new URL(import.meta.url).searchParams.get("v") || "?"),
  (PAGE_RELEASE || "dev").slice(0, 6),
].join(" · ");
if ($("#build-version")) $("#build-version").textContent = BUILD_LABEL;
console.info("TML build", BUILD_LABEL);
// Graphics presets (graphics-quality.js). tml-quality: "auto" (default),
// "low", "medium" or "high". Auto starts from what the device reports
// (4 GB tablets start Low) and steps down while the frame rate stays low.
let qualityChoice = "auto";
try {
  qualityChoice = localStorage.getItem("tml-quality") || "auto";
  // The earlier on/off lite switch.
  if (localStorage.getItem("tml-lite") === "1" && !localStorage.getItem("tml-quality")) qualityChoice = "low";
} catch {}
if (!CHOICES.includes(qualityChoice)) qualityChoice = "auto";
const tuner = createAutoTuner(
  autoLevel({
    deviceMemory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
    coarse: matchMedia("(pointer: coarse)").matches,
  }),
);
const qualityLevel = () => (qualityChoice === "auto" ? tuner.level : qualityChoice);
const preset = () => PRESETS[qualityLevel()];
const qualityLabel = () =>
  qualityChoice === "auto" ? `อัตโนมัติ (${preset().name})` : preset().name;
// Frame cap, changed on a running game loop.
function setFpsCap(game, fps) {
  const loop = game.loop;
  if ((loop.fpsLimit || 0) === fps) return;
  loop.fpsLimit = fps;
  loop.hasFpsLimit = fps > 0;
  loop._limitRate = fps > 0 ? 1000 / fps : 0;
  if (loop.running) {
    loop.sleep();
    loop.wake();
  }
}
// Render below CSS resolution: the canvas host shrinks and the canvas is
// stretched back over the screen. Phaser maps pointers through the canvas's
// on-screen box, so input lines up; Adventure.resize() keeps the framing.
function setRenderScale(r) {
  const host = $("#game-canvas");
  if (!host || host.dataset.scale === String(r)) return;
  host.dataset.scale = String(r);
  host.style.width = host.style.height = r === 1 ? "" : `${r * 100}%`;
  host.style.setProperty("--render-up", String(1 / r));
  host.classList.toggle("scaled", r !== 1);
  phaser?.scale.refresh();
}
function applyQuality() {
  const p = preset();
  if (phaser) {
    setFpsCap(phaser, p.fps);
    setRenderScale(p.renderScale);
  }
  scene?.applyQuality?.(p);
}
function setQuality(choice) {
  qualityChoice = choice;
  try {
    localStorage.setItem("tml-quality", choice);
  } catch {}
  applyQuality();
  logEvent("quality", { choice, level: qualityLevel() });
}
setInterval(() => {
  // Loading frames are slow on every device: judge only after 10 s in game.
  if (qualityChoice !== "auto" || !state || !phaser?.loop.running || document.hidden || Date.now() - enteredAt < 10000) return;
  const next = tuner.tick(phaser.loop.actualFps, preset().fps);
  if (!next) return;
  applyQuality();
  logEvent("quality", { choice: "auto", level: next, fps: Math.round(phaser.loop.actualFps) });
  toast(`ภาพกระตุก · ปรับกราฟิกเป็น "${PRESETS[next].name}" อัตโนมัติ (เปลี่ยนได้ในตั้งค่า)`);
}, 1000);

// Developer overlay (perf-overlay.js): Settings, or tap the lobby build number.
// The previous visit ending without a pagehide usually means the tab was
// killed (out of memory on small tablets): its last sample is kept to show.
const previousVisit = (() => {
  const log = readLog(),
    last = log[log.length - 1];
  return last && last.kind !== "pagehide" ? last : null;
})();
logEvent("start", { build: BUILD_LABEL, memory: navigator.deviceMemory, dpr: devicePixelRatio, level: qualityLevel() });
addEventListener("pagehide", () => logEvent("pagehide"));
const perfOverlay = createPerfOverlay({
  el: $("#perf-readout"),
  game: () => phaser,
  scene: () => scene,
  quality: qualityLabel,
  socket: () => socket,
  build:
    BUILD_LABEL +
    (previousVisit
      ? `\nครั้งก่อนปิดไม่ปกติ: tex ${previousVisit.texMb ?? "?"} MB · heap ${previousVisit.heapMb ?? "?"} MB · ${previousVisit.kind}`
      : ""),
});
let perfOn = false;
try {
  perfOn = localStorage.getItem("tml-perf") === "1";
} catch {}
perfOverlay.set(perfOn);
function togglePerf() {
  perfOn = !perfOn;
  try {
    localStorage.setItem("tml-perf", perfOn ? "1" : "0");
  } catch {}
  perfOverlay.set(perfOn);
  toast(perfOn ? "เปิดตัววัดประสิทธิภาพแล้ว" : "ปิดตัววัดประสิทธิภาพแล้ว");
}
$("#build-version")?.addEventListener("click", togglePerf);
// WebGL context loss: Android drops the GPU context under memory pressure.
// Phaser restores textures and pipelines on webglcontextrestored; until then
// the player sees why the world froze. Both are logged for diagnosis.
function watchContext(canvas) {
  let lostAt = 0;
  canvas.addEventListener("webglcontextlost", () => {
    lostAt = Date.now();
    logEvent("contextlost", perfOverlay.sample());
    const note = $("#connection-state");
    note.textContent = "หน่วยความจำกราฟิกเต็ม · กำลังกู้คืนภาพ…";
    note.classList.remove("hidden");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    logEvent("contextrestored", { after: Date.now() - lostAt });
    $("#connection-state").classList.add("hidden");
    // Fewer textures make another loss less likely.
    if (qualityChoice === "auto" && qualityLevel() !== "low") setQuality("low");
    sweepTextures(true);
  });
}
// Texture budget (MB, RGBA estimate) per preset. Sprite sets no display
// object has used for a minute are released; over budget, anything unused
// right now goes (sprite-sets.js sweep()).
const TEXTURE_BUDGET = { low: 96, medium: 192, high: 320 };
function sweepTextures(force = false) {
  const g = phaser,
    s = scene;
  if (!g || !s?.sprites?.sweep) return;
  const used = new Set();
  const walk = (list) => {
    for (const o of list) {
      if (o.texture?.key) used.add(o.texture.key);
      if (o.list) walk(o.list);
    }
  };
  walk(s.children.list);
  const over = textureStats(g).mb > TEXTURE_BUDGET[qualityLevel()];
  const freed = s.sprites.sweep(used, force || over ? 0 : 60000);
  if (freed.length) logEvent("sweep", { freed: freed.length, over, mb: Math.round(textureStats(g).mb) });
}
setInterval(sweepTextures, 15000);
function reloadForRelease(release) {
  if (!release || !PAGE_RELEASE || release === PAGE_RELEASE) return false;
  try {
    // Once per release: a stale CDN copy must not cause a reload loop.
    if (sessionStorage.getItem("tml-reloaded-for") === release) return false;
    sessionStorage.setItem("tml-reloaded-for", release);
  } catch {
    return false;
  }
  $("#connection-state").textContent = "มีเวอร์ชันใหม่ กำลังโหลดเกมใหม่…";
  $("#connection-state").classList.remove("hidden");
  socket?.disconnect();
  setTimeout(() => location.reload(), 600);
  return true;
}
let enteringGame = false;
let enteredAt = 0;
// Debug handle for the console and the performance report.
window.__tml = { game: () => phaser, scene: () => scene, preset };
let adventureLoaded;
let resolveAdventureLoaded;
async function enterGame() {
  if (enteringGame) return;
  enteringGame = true;
  showLoading();
  $("#area-loading .loading-title").textContent = "กำลังเตรียมโลกของผู้กล้า…";
  enteredAt = Date.now();
  try { if (selectedId) localStorage.setItem("tml-last-hero", selectedId); } catch {}
  $("#prologue").classList.add("hidden");
  $("#landing").classList.add("hidden");
  $("#game-screen").classList.remove("hidden");
  selectionPreview?.destroy();
  selectionPreview = null;
  enterHud();
  $("#connection-state").classList.add("hidden");
  closeModal();
  if (!phaser) {
    adventureLoaded = new Promise((resolve) => { resolveAdventureLoaded = resolve; });
    setRenderScale(preset().renderScale);
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
    setFpsCap(phaser, preset().fps);
    watchContext(phaser.canvas);
  }
  phaser.loop.wake();
  $("#connection-state").textContent = "กำลังโหลดภาพและตัวละครก่อนเข้าเกม…";
  await Promise.all([adventureLoaded, prepareMusic()]);
  enteringGame = false;
  socket?.disconnect();
  onlinePlayers = null;
  // snapshot: this client merges delta snapshots. Tabs opened before the
  // delta release don't send it and keep getting full snapshots.
  socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
    query: { snapshot: SNAPSHOT_PROTOCOL },
  });
  socket.on("announcement", receiveAnnouncement);
  socket.on("online:roster", (players) => {
    onlinePlayers = players;
    if (activePanel === "players" && state) showPanel("players");
  });
  socket.on("connect", () => {
    socket.emit("player:join", { id: selectedId }, (result) => {
      if (!result.ok) {
        hideLoading();
        toast(result.error, true);
        $("#connection-state").classList.remove("hidden");
        $("#connection-state").textContent = result.error;
        return;
      }
      if (reloadForRelease(result.release)) return;
      onlinePlayers = result.onlinePlayers || onlinePlayers;
      for (const notice of result.announcements || []) receiveAnnouncement(notice, false);
      $("#connection-state").classList.add("hidden");
      toast(result.message);
    });
  });
  socket.on("connect_error", (e) => {
    hideLoading();
    toast("เชื่อมต่อไม่ได้: " + e.message, true);
  });
  socket.on("disconnect", () => {
    $("#connection-state").textContent = "การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่…";
    $("#connection-state").classList.remove("hidden");
  });
  // Each socket's first packet is complete; later ones carry only changes.
  let merged = null;
  const snapshotCaches = {};
  socket.on("world:snapshot", (delta) => {
    const packet = (merged = mergeSnapshot(merged, delta, snapshotCaches));
    state = packet;
    snapshotAt = performance.now();
    const nextOffset = packet.time - snapshotAt / 1000;
    serverOffset =
      serverOffset === null
        ? nextOffset
        : serverOffset + (nextOffset - serverOffset) * 0.08;
    scheduleHUD();
    if (!posterShown && state.area === "town" && !activePanel) {
      posterShown = true;
      // New patch news first (once per patch on this device), else the poster.
      let seen = false;
      try {
        seen = localStorage.getItem("tml-news") === NEWS_ID;
        localStorage.setItem("tml-news", NEWS_ID);
      } catch {}
      // A new player gets one clear goal (the first floor), not patch news.
      if (isNewcomer(state.self)) showFirstRun();
      else showPanel(seen ? "poster" : "news");
    }
    if (scene?.ready) scene.applySnapshot(packet);
  });
  socket.on("chat:message", (packet) => addChat(packet));
  socket.on("toast", (packet) => packet?.message && toast(packet.message));
  addChat({
    name: "ระบบ",
    message:
      "ยินดีต้อนรับ! A/D เดิน · SPACE กระโดด · F คุยกับ NPC · ชวนเพื่อนเข้าเว็บนี้เพื่อพบกันในเมือง",
    channel: "world",
  });
}
const forgeHash = (p) =>
  JSON.stringify([p.equipment, p.upgrade, p.enhancements, p.gold, p.inventory.ore, p.inventory[BLESS_STONE], p.inventory[HIGH_STONE]]);
let posterShown = false;
let potionQty = 1;
const potionHash = (p) => JSON.stringify([p.gold, p.inventory]);
let worldBossWasOpen = false;
async function joinWorldBoss() {
  if (activePanel) closeModal();
  await emit("worldboss:join");
}
function skyText(sky, time) {
  if (!sky) return "";
  const left = Math.max(1, Math.ceil((sky.changeAt - time) / 60));
  return sky.night ? `🌙 ถ้ำลึกลับเปิด ${left} น.` : `☀ มืดใน ${left} น.`;
}

// How long a hero or monster waits, hidden, for its painted sprite set
// before the old placeholder art is shown instead.
const ART_WAIT_MS = 4000;
// The HUD is DOM: redrawing it for all 20 snapshots a second kept tablets
// busy restyling. 10 redraws a second look the same; the latest always lands.
const HUD_INTERVAL = 100;
let hudAt = 0,
  hudTimer = 0;
function scheduleHUD() {
  const wait = hudAt + HUD_INTERVAL - performance.now();
  if (wait <= 0) {
    hudAt = performance.now();
    updateHUD();
  } else
    hudTimer ||= setTimeout(() => {
      hudTimer = 0;
      hudAt = performance.now();
      if (state) updateHUD();
    }, wait);
}
// Skip DOM writes whose value has not changed (each one restyles the page).
const setText = (el, value) => {
  value = String(value);
  if (el && el.textContent !== value) el.textContent = value;
};
function updateHUD() {
  const p = state.self,
    d = state.dungeon;
  tutorialUpdate(state, !!activePanel);
  setText($("#player-name"), p.name);
  setText($("#player-level"), "Lv." + p.level);
  $("#player-class").textContent =
    SPECIALIZATIONS[p.class].find((s) => s.id === p.specialization)?.name ||
    CLASSES[p.class].name;
  setText($("#exp-label"), p.level >= MAX_LEVEL ? `Lv.${MAX_LEVEL} สูงสุด` : `${p.exp} / ${expToLevel(p.level)} EXP`);
  // Red badges: unspent status points, and a class change waiting in town.
  const classReady = d ? 0 : (!p.specialization && p.level >= 3) || (p.specialization && !p.advanced && p.level >= ADVANCE_LEVEL) ? "!" : 0;
  const badges = { status: p.statPoints > 0 ? p.statPoints : 0, class: classReady };
  for (const el of document.querySelectorAll("[data-badge]")) {
    const value = badges[el.dataset.badge];
    let badge = el.querySelector(":scope > .menu-badge");
    if (value) {
      badge ??= el.appendChild(document.createElement("i"));
      badge.className = "menu-badge";
      setText(badge, String(value));
    } else badge?.remove();
  }
  if (["inventory", "class", "status", "wardrobe"].includes(activePanel)) {
    const hash = JSON.stringify([
      p.attrs,
      p.statPoints,
      p.equipment,
      p.ownedEquipment,
      p.upgrade,
      p.enhancements,
      p.inventory,
      p.specialization,
      p.advanced,
      p.skin,
      p.level,
      p.gold,
      state.area,
    ]);
    if (hash !== lastRpgPanelHash) showPanel(activePanel);
  } else if (activePanel === "weapon") {
    const hash = JSON.stringify([p.ownedEquipment, p.gold]);
    if (hash !== lastRpgPanelHash) showPanel("weapon");
  } else if (activePanel === "potion") {
    // Gold and stock arrive with the next snapshot after a purchase; keep the
    // quantity box alone while it has focus.
    if (potionHash(p) !== lastRpgPanelHash && document.activeElement?.id !== "buy-qty-input")
      showPanel("potion");
  } else if (activePanel === "forge") {
    if (forgeHash(p) !== lastRpgPanelHash) showPanel("forge");
  } else if (activePanel === "quest") {
    if (questHash(p) !== lastQuestHash) showPanel("quest");
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
    const tip = `${skill.name} · ${skill.detail} · ${ACTIONS[i + 1].mp} MP · ${ACTIONS[i + 1].cooldown}s`;
    if (button.dataset.tip === tip) return;
    button.querySelector("small").textContent = skill.name;
    button.dataset.tip = tip;
    button.setAttribute("aria-label", tip);
    button.querySelector(".skill-cost").textContent = ACTIONS[i + 1].mp + " MP";
  });
  const ultimateButton = $('[data-action="skill5"]');
  const ultimate = ULTIMATES[p.class];
  ultimateButton.dataset.tip = `${ultimate.name} · ศัตรูทั้งแผนที่ · 50 MP · 45 วินาที`;
  ultimateButton.setAttribute('aria-label', ultimateButton.dataset.tip);
  ultimateButton.querySelector('.skill-cost').textContent = '50 MP';
  prepareUltimate(p.gender);
  const basicAttack = $('[data-action="attack"]');
  if (basicAttack.dataset.iconClass !== p.class) {
    basicAttack.querySelector("b").innerHTML = skillIcon(p.class, 0);
    basicAttack.dataset.iconClass = p.class;
  }
  if (!$("#auto-button").dataset.iconReady) {
    $('[data-action="hp"] b').innerHTML = potionIcon;
    $('[data-action="mp"] b').innerHTML = manaPotionIcon;
    $("#auto-button b").innerHTML = autoIcon;
    $("#auto-button").dataset.iconReady = "1";
  }
  const avatarStyle = heroStyle(p.class, p.gender, p),
    avatar = $("#avatar");
  if (avatar.dataset.style !== avatarStyle) {
    avatar.dataset.style = avatarStyle;
    avatar.style.cssText = avatarStyle;
  }
  $("#hp-fill").style.width = (p.hp / p.maxHp) * 100 + "%";
  $("#mp-fill").style.width = (p.mp / p.maxMp) * 100 + "%";
  setText($("#hp-label"), `HP ${Math.ceil(p.hp)} / ${p.maxHp}`);
  setText($("#mp-label"), `MP ${Math.floor(p.mp)} / ${p.maxMp}`);
  $("#exp-fill").style.width = (p.level >= MAX_LEVEL ? 100 : Math.min(100, (p.exp / expToLevel(p.level)) * 100)) + "%";
  // HP (R) and MP (G) potions, each with its own cooldown ring.
  for (const type of ["hp", "mp"]) {
    const button = $(`[data-action="${type}"]`),
      count = potionCount(p.inventory, type),
      { cooldown } = POTIONS[type],
      left = cooldown - (state.time - (p.potionCd?.[type] || 0)),
      full = type === "hp" ? p.hp >= p.maxHp : p.mp >= p.maxMp,
      ring = button.querySelector("i"),
      name = type.toUpperCase();
    setText($(`#${type}-potions`), d?.training ? `ยา ${name} ∞` : `ยา ${name} ×${count}`);
    button.dataset.count = d?.training ? "∞" : String(count);
    button.disabled = p.hp <= 0 || full || left > 0 || (!d?.training && count <= 0);
    button.title =
      count <= 0 && !d?.training
        ? "ยาหมด · ซื้อเพิ่มได้ที่ร้านยา"
        : `ยา ${name} ${POTION_SIZES[type].map((id) => `${ITEMS[id].name.split(" ").pop()} ×${p.inventory[id] || 0}`).join(" · ")} · เลือกขนาดที่พอดีให้อัตโนมัติ · คูลดาวน์ ${cooldown} วิ (${type === "hp" ? "R" : "G"})`;
    button.style.setProperty("--cd", Math.max(0, Math.min(1, left / cooldown)).toFixed(3));
    ring.style.display = left > 0 ? "grid" : "none";
    const ringHtml = left > 0 ? `${Math.ceil(left)}<small>วิ</small>` : "";
    if (ring.dataset.html !== ringHtml) {
      ring.dataset.html = ringHtml;
      ring.innerHTML = ringHtml;
    }
  }
  $("#training-open").disabled = state.area !== "town";
  $$(
    [
      "[data-action=attack]",
      "[data-action=skill1]",
      "[data-action=skill2]",
      "[data-action=skill3]",
      "[data-action=skill4]",
    ].join(","),
  ).forEach((b) =>
    b.classList.toggle(
      "is-casting",
      !!p.action && state.time < p.action.endsAt,
    ),
  );
  setText($("#location-name"), d?.training
    ? "ลานฝึกผู้พิทักษ์"
    : d
      ? floorInfo(d).name
      : townOf(p).name);
  setText($("#stage-label"), d?.training
    ? "สนามฝึก · ไม่มีรางวัล · สไลม์เกิดใหม่อัตโนมัติ"
    : d?.mine
      ? `เหมือง · ด่าน ${d.stage} / 3`
    : d?.world
      ? `บอสโลก · ${d.world.name} · ร่วมกันตีกับผู้กล้าทุกคน`
      : d?.night
      ? `ยามราตรี · บอสใหญ่ ${d.night.name} · พลังเทียบชั้น ${d.floor}`
      : d
      ? `ชั้น ${d.floor} / ${FLOORS.length} · ด่าน ${d.stage} / 3 · ${d.stage === 3 ? "BOSS STAGE" : d.stage === 2 ? "ELITE STAGE" : "MONSTER STAGE"}`
      : "เมืองกลาง · CH.1 · เขตปลอดภัย");
  setText($("#map-title"), d?.training
    ? "สนามฝึกผู้พิทักษ์"
    : d?.world
      ? "ลานบอสโลก"
      : d?.night
      ? "ถ้ำลึกลับ"
      : d
      ? (d.mine ? MINE_INFO.name : "ถ้ำหลวง · ชั้น " + d.floor)
      : townOf(p).name);
  setText($("#online-count"), "● " + state.online + " ออนไลน์");
  const mapW = areaWidth(state.area),
    mapX = (x) => 8 + (x / mapW) * 200,
    mapY = (y) => 52 - ((WORLD.ground - y) / 450) * 43,
    town = state.area === "town";
  setText($("#map-zone"), d?.training
    ? "TRAINING · ไม่มีรางวัล"
    : d
      ? d.mine ? `เหมืองแร่ · ด่าน ${d.stage} / 3` : d.world
        ? `บอสโลก · ⏳ ${wbClock(state.worldBoss?.left || 0)}`
        : d.night
        ? "ถ้ำลึกลับ · ยามราตรี"
        : `ชั้น ${d.floor} · ด่าน ${d.stage} / 3`
      : `${skyText(state.sky, state.time)} · ${worldBossCountdown(state.worldBoss)}`);
  updatePartyUi(state);
  $("#minimap").classList.toggle("in-dungeon", !town);
  const dotAt = `translate(${mapX(p.x).toFixed(1)} ${mapY(p.y).toFixed(1)})`;
  $("#map-dot").setAttribute("transform", dotAt);
  $("#map-ping").setAttribute("transform", dotAt);
  $("#map-gate").setAttribute(
    "transform",
    `translate(${town ? mapX(WORLD.portal).toFixed(1) : 205} ${town ? mapY(WORLD.ground) : 52})`,
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
  const signs = d?.signs || [];
  setMapLayer(
    "#map-explore",
    signs
      .filter((sign) => !sign.collected)
      .map((sign) => {
        const x = mapX(sign.x).toFixed(1),
          y = (mapY(sign.y) - 5).toFixed(1);
        return `<path transform="translate(${x} ${y})" d="M0 -4L4 0L0 4L-4 0Z"/>`;
      })
      .join(""),
  );
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
        ? (townOf(p).id === "riverside" ? RIVER_DOCKS : WORLD.platforms)
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
  setText($("#auto-button small"), p.auto ? "เปิด" : "ปิด");
  // Two HUD modes: town (no combat buttons) and dungeon. Each new dungeon
  // starts on AUTO; steering the joystick hands control back (see below).
  const area = !d ? "town" : d.training ? "training" : "dungeon";
  $("#game-screen").dataset.area = area;
  if (area !== "town" && activePanel === "first-run") closeModal();
  $("#game-screen").classList.toggle("auto-on", !!p.auto);
  if (area === "dungeon" && d.instanceId !== autoInstance) {
    autoInstance = d.instanceId;
    if (!p.auto && p.hp > 0 && !tutorialRoom(d)) emit("player:auto", { enabled: true });
  }
  if (area === "town") autoInstance = null;
  const newcomer = isNewcomer(p);
  $("#dock-adventure").classList.toggle("first-run", newcomer);
  setText($("#dock-label"), townOf(p).id === "riverside" ? "สำรวจเหมือง" : p.quest > 0
    ? `เล่นต่อ ชั้น ${Math.min(p.unlocked || 1, 40)}`
    : "เริ่ม ชั้น 1");
  const loadingUp = !$("#area-loading").classList.contains("hidden");
  townSince = area === "town" && !loadingUp ? townSince || performance.now() : 0;
  if (newcomer && area === "town" && !activePanel && !firstRunShown.has(p.id) && performance.now() - townSince > 1500) {
    firstRunShown.add(p.id);
    showFirstRun();
  }
  setText($("#floor-chip"), d?.mine ? `เหมือง ชั้น ${d.floor} · ${d.stage}/3` : d?.world ? "บอสโลก" : d?.night ? "ถ้ำลึกลับ" : d ? `ชั้น ${d.floor} · ${d.stage}/3${d.replay?.total > 1 ? ` · รอบ ${d.replay.run}/${d.replay.total}` : ""}` : "");
  setText($("#quest-description"), d?.training
    ? "ฝึกเดิน กระโดด ฟัน และ Q/W/E · หลบเมื่อสไลม์ขึ้นวงเตือน"
    : d
      ? d.clear
        ? "เส้นทางเปิดแล้ว! เดินหน้าสู่ด่านต่อไป"
        : `กำจัด${d.stage === 3 ? floorInfo(d).boss : "มอนสเตอร์"} ${d.defeated || 0}/${d.totalEnemies || d.enemies.length}`
      : p.quest >= FLOORS.length
        ? "พิชิตห้วงลึกครบทุกชั้น! ท้าทายซ้ำเพื่อของตำนาน"
        : p.quest >= 40
          ? "พิชิตถ้ำหลวงแล้ว! เหมืองชั้น 41–80 เปิดที่ชุมชนริมน้ำสาย"
        : p.quest >= MAIN_FLOORS
          ? "ตำนานบทแรกสำเร็จ! ห้วงลึกถ้ำหลวงเปิดแล้ว"
        : "คุยกับผู้ใหญ่คำ แล้วเข้าสู่ประตูถ้ำหลวง");
  const streak =
    d && d.streakUntil > state.time && d.streak > 1
      ? ` · ต่อเนื่อง ×${d.streak}`
      : "";
  $("#quest-counter").textContent =
    d && !d.training
      ? `กำจัด ${d.defeated} / ${d.totalEnemies}${streak} · SPACE หลบพื้นเตือน`
      : `ดันเจียนที่พิชิต ${p.quest} / ${FLOORS.length}`;
  const trackerHash = JSON.stringify(p.daily);
  if (trackerHash !== lastTrackerHash) {
    lastTrackerHash = trackerHash;
    $("#daily-tracker").innerHTML = trackerHtml(p.daily);
    const ready = claimable(p.daily);
    $("#quests").classList.toggle("has-reward", ready > 0);
    setText($(".quest-badge"), ready ? String(ready) : "!");
    $$('#top-menu [data-panel="quest"], #town-dock [data-panel="quest"]').forEach((b) =>
      b.classList.toggle("has-reward", ready > 0),
    );
  }
  const explored = signs.filter((sign) => sign.collected).length;
  const explore = $("#dungeon-explore");
  explore.hidden = !d || d.training;
  if (d?.stage === 1)
    explore.textContent = explored
      ? "เปิดเสบียงแล้ว"
      : "สำรวจเสริม · เปิดเสบียงฟื้น HP / MP";
  if (d?.stage === 2)
    explore.textContent = explored === signs.length
      ? "ไขผนึกรูนแล้ว"
      : `สำรวจเสริม · รูน ${explored} / ${signs.length} · รับทองและแร่`;
  if (d?.stage === 3)
    explore.textContent = "หลบท่าทุบให้พลาดทั้งทีม แล้วตีสวนแรงขึ้น 50%";
  $("#quest-fill").style.width =
    (d && !d.training
      ? (d.defeated / Math.max(1, d.totalEnemies)) * 100
      : (p.quest / FLOORS.length) * 100) + "%";
  const result = d?.completed ? d.result : null;
  $("#stage-clear").classList.toggle(
    "hidden",
    !d?.clear || d?.training || p.hp <= 0 || !!result,
  );
  showFloorResult(result);
  showReplayStatus(d);
  $("#next-stage").textContent =
    d?.stage === 3 ? "รับชัยชนะ · กลับเมือง ➜" : "เข้าสู่ด่านต่อไป ➜";
  if (d?.nextIn != null && p.hp > 0) {
    const label = `ไป${d.stage === 3 ? "ชั้น" : "ด่าน"}ถัดไปใน ${d.nextIn} วิ ➜`;
    setText($("#next-stage"), label);
    if (result) setText($("#result-next"), result.hasNext ? label : `กลับเมืองใน ${d.nextIn} วิ`);
  }
  $("#death").classList.toggle("hidden", p.hp > 0);
  // Stage clear and defeat stingers, once per change.
  const cleared = !!(d?.clear && !d.training);
  if (cleared && !wasCleared) sfx("clear", null, 0);
  if (p.hp <= 0 && wasAlive) sfx("death", null, 0);
  wasCleared = cleared;
  wasAlive = p.hp > 0;
  for (let i = 1; i <= 5; i++) {
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
    button.innerHTML = remaining > 0 ? `${Math.ceil(remaining)}<small>วิ</small>` : "";
  }
  updateHudFx(state);
  updateWorldBossHud(state, joinWorldBoss, () => showPanel("news"));
  // Call to arms when the world boss rises.
  const wbOpen = !!state.worldBoss?.open;
  if (wbOpen && !worldBossWasOpen && state.area === "town") {
    toast(`👑 บอสโลก ${state.worldBoss.name} ปรากฏแล้ว! กดเข้าร่วมด้านบนเพื่อร่วมกันตี`);
    sfx("roar", null, 0);
  }
  worldBossWasOpen = wbOpen;
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
  if (nearest) setText($("#context-hint span"), nearest.label);
  // Touch: the hint becomes a tappable button only while there is a target.
  $("#mobile-interact").classList.toggle(
    "hidden",
    !nearest || activePanel !== null || p.hp <= 0,
  );
  if (nearest && $("#mobile-interact span").textContent !== nearest.label)
    setText($("#mobile-interact span"), nearest.label);
}
function nearby() {
  if (!state) return null;
  const p = state.self;
  if (state.area === "dungeon") {
    const sign = state.dungeon.signs?.find(
      (entry) => !entry.collected && withinDungeonSign(p, entry),
    );
    if (sign)
      return {
        id: "explore",
        sign,
        label: sign.id === "supplies" ? "เปิดกล่องเสบียง" : "เก็บรูนถ้ำ",
      };
    return state.dungeon.clear && !state.dungeon.completed
      ? { id: "next", label: "เข้าสู่ด่านต่อไป" }
      : null;
  }
  if (Math.abs(p.x - TRAVEL_GATE.x) < TRAVEL_GATE.reach && Math.abs(p.y - TRAVEL_GATE.y) < 90)
    return { id: "travel", label: "วาร์ปไป " + TOWNS[townOf(p).destination].name };
  if (Math.abs(p.x - SLOT_MACHINE.x) <= SLOT_MACHINE.reach && Math.abs(p.y - SLOT_MACHINE.y) < 90)
    return { id: "slots", label: "ตู้สมบัติจันทรา · หมุน 1,000 ทอง" };
  // Everything left of the cave mouth is the cave (it is the town's edge).
  if (townOf(p).id === "cave" && state.sky?.night && p.x < NIGHT_CAVE.x + 110)
    return { id: "nightcave", label: "ถ้ำลึกลับ · บอสยามราตรี" };
  const npc = WORLD.npcs.find(
    (n) =>
      Math.abs(n.x - p.x) < 105 && Math.abs((n.y ?? WORLD.ground) - p.y) < 90,
  );
  if (npc) return { ...npc, label: npc.name + " · " + npc.role };
  if (Math.abs(p.x - WORLD.portal) < 140)
    return { id: "portal", label: townOf(p).id === "riverside" ? "เข้าสู่เหมืองแร่แรร์เอิร์ธ" : "เข้าสู่ดันเจียนถ้ำหลวง" };
  const shop = state.shops.find((s) => Math.abs(s.x - p.x) < 65);
  if (shop) return { id: "shop:" + shop.id, label: "ร้าน " + shop.name };
  return null;
}
// World boss sets are drawn at their index.json height times this.
const WORLD_BOSS_SCALE = 1.15;
function interact() {
  if (!state || activePanel || state.self.hp <= 0) return;
  const n = nearby();
  if (!n) return toast(state.dungeon
    ? "เดินเข้าใกล้จุดสำรวจที่มีเครื่องหมายบนแผนที่"
    : "คลิกที่ NPC ร้าน หรือประตูถ้ำได้เลย");
  if (n.id === "next") emit("dungeon:next");
  else if (n.id === "explore") {
    const { instanceId, floor, stage } = state.dungeon;
    emit("dungeon:explore", { id: n.sign.id, instanceId, floor, stage })
      .then((result) => result && soundCue("material"));
  } else openTown(n.id);
}
// One way in for keyboard, mouse and touch: NPC id, "portal" or "shop:<id>".
function openTown(id) {
  if (!state || state.area !== "town") return;
  if (id === "slots") {
    if (Math.abs(state.self.x - SLOT_MACHINE.x) > SLOT_MACHINE.reach || Math.abs(state.self.y - SLOT_MACHINE.y) > 90)
      return toast("เดินเข้าใกล้ตู้สล็อตกลางเมืองก่อน", true);
    return showPanel("slots");
  }
  if (id === "travel") return showPanel("travel");
  if (id === "portal") return showPanel(townOf(state.self).id === "riverside" ? "mine" : "dungeon");
  if (id === "nightcave") return showPanel("nightcave");
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
  talkTo(id);
}
// Town NPCs open a conversation first; each choice leads to the old panel.
const NPC_TALK = {
  elder: {
    title: "ผู้ใหญ่บ้าน",
    line: (p) => p.hp < p.maxHp * 0.5 || p.mp < p.maxMp * 0.5
      ? "สภาพแบบนี้ยังจะลงถ้ำอีกรึ ผู้กล้า นั่งพักฟื้นตรงนี้ก่อนเถอะ แล้วค่อยมารับภารกิจ"
      : "มาแล้วรึ ผู้กล้า หมู่บ้านเรายังมีงานรอให้เจ้าช่วยอีกมาก ดูภารกิจก่อนไหม",
    choices: [["ภารกิจผู้กล้า", "quest"], ["พักฟื้น HP / MP", elderHeal]],
    chat: [
      "ถ้ำหลวงลึกกว่าที่ใครคิด ยิ่งลงลึก ของที่ได้ก็ยิ่งดี แต่ก็ยิ่งอันตราย",
      "สมัยข้ายังหนุ่ม แร่จันทราหาง่ายกว่านี้เยอะ เดี๋ยวนี้ต้องลงไปถึงชั้นล่าง ๆ",
      "เพื่อนร่วมทางสำคัญนัก ชวนกันลงถ้ำเป็นปาร์ตี้ จะรอดกลับมามากกว่า",
    ],
  },
  potion: {
    title: "นักปรุงยา",
    line: (p) => p.hp < p.maxHp * 0.5
      ? "แผลแบบนี้ยังเดินมาเองได้ แปลว่ายังไม่หนักเท่าไหร่ ดีแล้ว รับยาสักขวดไหม"
      : "ยินดีต้อนรับสู่ร้านปรุงยา ยาแดงยาฟ้าเพิ่งปรุงเสร็จเมื่อเช้านี้เอง",
    choices: [["ขอซื้อยา", "potion"]],
    chat: [
      "ยาขวดใหญ่คุ้มกว่าถ้าจะลงถ้ำนาน ๆ อย่าลืมพกไปเผื่อด้วยล่ะ",
      "สมุนไพรริมน้ำสายช่วงนี้งามมาก ยารอบนี้เลยแรงกว่าปกติ",
      "ปุ่ม R กับ G ใช้ยาได้ทันที เลือกขนาดที่เหมาะให้เองด้วยนะ",
    ],
  },
  weapon: {
    title: "ช่างอาวุธ",
    line: () => "อาวุธดีคือเพื่อนที่ไว้ใจได้ที่สุดในถ้ำ มาเลือกดูของในคลังกันเถอะ",
    choices: [["ดูคลังอาวุธ", "weapon"]],
    chat: [
      "ของแต่ละชิ้นเหมาะกับแต่ละอาชีพ เลือกให้ตรงกับเส้นทางของเจ้า",
      "อาวุธใหม่แล้วอย่าลืมไปให้ลุงเหล็กตีบวกต่อ จะคมขึ้นอีกเยอะ",
    ],
  },
  forge: {
    title: "ช่างตีเหล็ก",
    line: () => "เตาร้อนพอดีเลย เอาอุปกรณ์มา เดี๋ยวลุงตีบวกให้ แค่เตรียมทองกับแร่มาให้พอ",
    choices: [["ตีบวกอุปกรณ์", "forge"]],
    chat: [
      `ตั้งแต่ +${ENHANCE_BREAK_LEVEL} ขึ้นไปถ้าพลาด ของจะกลับเป็น +0 ใช้หินตีบวกจะปลอดภัยกว่า`,
      "แร่จันทราหาได้จากถ้ำหลวง ยิ่งชั้นลึก ยิ่งได้เยอะ",
      "อาวุธ +11 ขึ้นไปจะมีแสงวิ่งรอบตัว สวยจนคนหันมามองทั้งเมือง",
    ],
  },
  trainer: {
    title: "อาจารย์ฝึกอาชีพ",
    line: () => "พลังของเจ้ายังไปได้อีกไกล พร้อมจะก้าวสู่เส้นทางใหม่แล้วหรือยัง",
    choices: [["เส้นทางอาชีพ", "class"]],
    chat: [
      "แต่ละสายอาชีพมีจุดแข็งต่างกัน ลองอ่านให้ดีก่อนตัดสินใจ",
      "เลเวลสูงขึ้นเมื่อไหร่ จะเปิดขั้นอาชีพถัดไปให้ได้",
    ],
  },
  stones: {
    title: "ร้านหินตีบวก",
    line: () => "หินตีบวกร้อยเปอร์เซ็นต์ของที่นี่ ไม่มีวันทำให้อุปกรณ์ของเจ้าแตก",
    choices: [["ซื้อหินตีบวก", "stones"]],
    chat: [
      `หินตีบวกขั้นสูงใช้ได้ตั้งแต่ +${HIGH_STONE_FROM} เก็บไว้ใช้ตอนเสี่ยงที่สุดดีกว่า`,
      "แร่ก็มีขายนะ ถ้าขาดอีกนิดเดียวก็แวะมาได้",
    ],
  },
};
// The elder's rest: free, in town only. Coming back to town already refills
// HP / MP, so say so plainly when there is nothing to restore.
async function elderHeal(talk) {
  const p = state?.self;
  if (!p) return;
  if (p.hp >= p.maxHp && p.mp >= p.maxMp) {
    if (talk) talk.say("ร่างกายเจ้ายังแข็งแรงดี HP กับ MP เต็มอยู่แล้ว ไม่ต้องพักหรอก");
    else toast("HP / MP เต็มอยู่แล้ว");
    return;
  }
  const r = await emit("player:heal");
  if (!r) return;
  sfx("potion");
  talk?.say("นั่งพักใต้ต้นไม้ใหญ่สักครู่… เอาล่ะ หายเหนื่อยแล้ว HP กับ MP เต็มเหมือนเดิม");
}
let npcChatTurn = 0;
function talkTo(id) {
  const npc = WORLD.npcs.find((n) => n.id === id),
    script = NPC_TALK[id];
  if (!npc || !script) return showPanel(id);
  activePanel = "talk";
  keys.clear();
  touchDirection = 0;
  touchAttack = false;
  touchRun = false;
  jumpQueued = false;
  document.dispatchEvent(new Event("game:reset-controls"));
  if (socket?.connected)
    socket.emit("player:input", { direction: 0, seq: ++seq, jump: false });
  const open = (panel) => (talk) => {
    talk.close(true);
    activePanel = null;
    showPanel(panel);
  };
  const choices = [
    ...script.choices.map(([label, panel]) => ({
      label,
      run: typeof panel === "function" ? panel : open(panel),
    })),
    {
      label: "คุยเล่น",
      run: (talk) => talk.say(script.chat[npcChatTurn++ % script.chat.length]),
    },
    { label: "ลาก่อน", run: (talk) => talk.close() },
  ];
  openNpcTalk(
    { id, name: npc.name, title: script.title },
    { line: script.line(state.self), choices },
    () => {
      if (activePanel === "talk") activePanel = null;
      sfx("close");
    },
  );
}
function action(name) {
  if (!state || activePanel) return;
  tutorialAction(name);
  if (name === "attack") emit("player:attack", { skill: 0 });
  else if (name.startsWith("skill"))
    emit("player:attack", { skill: Number(name.slice(-1)) });
  else if (name === "hp" || name === "mp")
    emit("player:potion", { type: name, auto: true }).then((r) => r && sfx("potion"));
  else if (name === "auto") {
    if (state.self.hp <= 0) return toast("ใช้ AUTO ไม่ได้ขณะตัวละครล้ม", true);
    emit("player:auto", { enabled: !state.self.auto });
  }
}
$$("[data-action]").forEach(
  (b) => (b.onclick = () => action(b.dataset.action)),
);
$$("[data-panel]").forEach(
  (b) => (b.onclick = () => showPanel(b.dataset.panel)),
);
$("#dungeon-open").onclick = () => showPanel("dungeon");
$("#dock-adventure").onclick = () =>
  state && isNewcomer(state.self) && state.area === "town" ? enterFirstFloor() : openTown("portal");
function isNewcomer(p) {
  return !!p && !(p.quest > 0) && townOf(p).id !== "riverside";
}
async function enterFirstFloor() {
  const r = await emit("dungeon:enter", { floor: 1 });
  if (r) closeModal();
}
function showFirstRun() {
  modal(
    "การผจญภัยครั้งแรก",
    `<div class="first-run"><p class="first-run-lead">ถ้ำหลวงชั้น 1 รออยู่! ปราบมอนสเตอร์ 3 ด่านแล้วล้มบอส</p><ul><li>⚔ รอบแรกได้<b>อาวุธประจำอาชีพแน่นอน</b></li><li>🎯 ห้องแรกฝึกกดโจมตีและสกิลกับมอนตัวเดียวก่อน แล้วค่อยเจอฝูง · มีโหมด <b>AUTO</b> ให้ตีอัตโนมัติ</li><li>⤴ เห็นวงเตือนบนพื้นให้กระโดดหรือเดินหลบ</li></ul><button id="first-run-go" class="primary-button">ลงถ้ำชั้น 1 เลย ➜</button><button id="first-run-later" class="text-button">เดินดูเมืองก่อน</button><p class="hint">กลับมาเริ่มได้ทุกเมื่อที่ปุ่ม “เริ่ม ชั้น 1” มุมล่าง</p></div>`,
    "first-run",
  );
  $("#first-run-go").onclick = enterFirstFloor;
  $("#first-run-later").onclick = closeModal;
}
$("#avatar").onclick = () => showPanel("status");
// Pause menu: leaving the dungeon lives here so it is never hit mid-fight.
{
  const pause = $("#pause-menu"),
    setPause = (open) => pause.classList.toggle("hidden", !open);
  $("#dungeon-pause").onclick = () => setPause(true);
  $("#pause-resume").onclick = () => setPause(false);
  $("#pause-leave").onclick = () => {
    setPause(false);
    $("#town-return").click();
  };
  pause.addEventListener("click", (e) => {
    if (e.target === pause || e.target.closest("[data-panel]")) setPause(false);
  });
}
$("#training-open").onclick = async () => {
  const r = await emit("training:enter");
  if (r) closeModal();
};
$("#next-stage").onclick = () => emit("dungeon:next");
$("#result-next").onclick = () => emit("dungeon:next");
$("#result-leave").onclick = () => emit("dungeon:leave");
// Replay the cleared floor N times; the server restarts each run on its own.
let replayRuns = 1;
function setReplayRuns(n) {
  replayRuns = Math.max(1, Math.min(99, Math.floor(Number(n)) || 1));
  $("#replay-runs").value = replayRuns;
  $$("[data-replay-runs]").forEach((b) => b.classList.toggle("active", Number(b.dataset.replayRuns) === replayRuns));
  $("#result-replay").textContent = `↻ เล่นชั้นนี้ซ้ำ ×${replayRuns}`;
}
$$("[data-replay-runs]").forEach((b) => (b.onclick = () => setReplayRuns(b.dataset.replayRuns)));
$("#replay-runs").onchange = (e) => setReplayRuns(e.target.value);
setReplayRuns(1);
$("#result-replay").onclick = () => emit("dungeon:replay", { runs: replayRuns });
$("#replay-stop").onclick = () => emit("dungeon:replay-stop");
// Live part of the result card: queued replays count down to the next run.
function showReplayStatus(d) {
  const r = d?.result,
    q = d?.replay,
    queued = !!(r && q && q.left > 0);
  $("#floor-result .result-replay").hidden = !r?.canReplay;
  $("#floor-result .replay-pick").hidden = queued;
  $("#result-replay").hidden = queued;
  $("#replay-stop").hidden = !queued;
  $("#floor-result .replay-status").hidden = !queued;
  if (queued)
    setText($("#floor-result .replay-status"), `เล่นซ้ำ รอบ ${q.run} / ${q.total} จบแล้ว · เริ่มรอบถัดไปใน ${q.in} วิ`);
}
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
    r.mine ? MINE_INFO.name : r.world
      ? "บอสโลก · " + r.world.name
      : r.night
        ? "ถ้ำลึกลับ · " + r.night
        : "ชั้น " + r.floor + " · " + FLOORS[r.floor - 1].name;
  const rank = $("#floor-result .result-rank");
  rank.dataset.rank = r.rank;
  rank.querySelector("b").textContent = r.rank;
  $("#floor-result .result-stats").innerHTML = [
    row("เวลา", clock(r.seconds), "เป้า " + clock(r.par)),
    row("กำจัด", r.defeated + " ตัว"),
    row("เสียเลือด", r.damage, "รอด " + r.survival + "%"),
    row("คะแนน", r.score.toLocaleString()),
    r.world
      ? row(
          "อันดับความเสียหาย",
          r.world.place ? `#${r.world.place} / ${r.world.heroes}` : "—",
          Math.round((r.world.share || 0) * 100) + "% ของ HP บอส",
        )
      : "",
  ].join("");
  const loot = [
    `<span class="loot-chip">🪙 ${r.gold.toLocaleString()} ทอง</span>`,
    `<span class="loot-chip">✦ ${r.exp} EXP</span>`,
    r.ore ? `<span class="loot-chip">⛏ แร่ ×${r.ore}</span>` : "",
    r.stones ? `<span class="loot-chip rare" data-rarity="legendary">💠 หินตีบวกขั้นสูง 100% ×${r.stones}</span>` : "",
    ...r.items.map(
      (id) =>
        `<span class="loot-chip rare" data-rarity="${escape((GEAR[id] || COSTUME_ITEMS[id])?.rarity || "")}">${COSTUME_ITEMS[id] ? "👗" : "🎁"} ${escape((GEAR[id] || COSTUME_ITEMS[id])?.name || id)}</span>`,
    ),
  ];
  $("#floor-result .result-loot").innerHTML = loot.join("");
  $("#result-next").hidden = !r.hasNext;
  $("#result-next").textContent = "ชั้นถัดไป ➜";
  $("#result-leave").textContent = r.hasNext
    ? "ออกกลับเมือง"
    : "รับชัยชนะ · กลับเมือง";
  if (["SSS", "SS", "S"].includes(r.rank)) sfx("levelUp", null, 0);
}
let forgeDestination = null;
async function prepareAfterDeath(panel) {
  if (!await emit("dungeon:leave")) return;
  if (panel === "inventory") showPanel("inventory");
  else {
    closeModal();
    forgeDestination = WORLD.npcs.find((n) => n.id === "forge");
    toast("กำลังวิ่งไปหาช่างตีบวก");
  }
}
$("#death-equip").onclick = () => prepareAfterDeath("inventory");
$("#death-forge").onclick = () => prepareAfterDeath("forge");
$("#revive").onclick = () => emit("dungeon:leave");
$("#town-return").onclick = () => {
  if (state?.area === "town") {
    emit("player:heal");
  } else {
    modal(
      "กลับสู่ " + townOf(state.self).name,
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
        btn.textContent.replace(/ ×\d+ ชิ้น · รวม .*$/, "") +
        ` ×${m.qty} ชิ้น` +
        ` · รวม ${(m.qty * m.price).toLocaleString()} ◈`;
  };
  if ($("#sell-qty"))
    $("#sell-qty").oninput = (e) => {
      m.qty = Math.min(Number(e.target.max) || 999, Math.max(1, Math.floor(Number(e.target.value) || 1)));
      e.target.value = m.qty;
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
  if (communityPanel(panel, { modal, escape, self: p, open: showPanel, worldBoss: state.worldBoss, join: joinWorldBoss })) return;
  const row = (icon, name, desc, button) =>
    `<div class="item-row"><span>${icon}</span><div><strong>${escape(name)}</strong><small>${escape(desc)}</small></div>${button || ""}</div>`;
  const btn = (data, label) => `<button ${data}>${label}</button>`;
  if (panel === "slots") {
    if (state.area !== "town") return toast("ใช้ตู้สล็อตได้ในเมืองเท่านั้น", true);
    modal("ตู้สมบัติจันทรา", slotPanelHtml(p), "slots");
    bindSlotPanel($("#modal-body .slot-panel"), p, {
      request: key => send("slots:spin", { key }),
      sound: name => sfx(name),
      currentPlayer: () => state?.self,
      onSettled: () => { if (activePanel === "slots") showPanel("slots"); },
    });
  } else if (panel === "travel") {
    const target = TOWNS[townOf(p).destination];
    modal("ประตูวาร์ปข้ามเมือง", `<p>ปลายทาง: <strong>${target.name}</strong></p><p>กดเดินทางได้จากทุกจุดในเมือง · ใช้ได้ฟรี</p><button id="travel-go" class="primary-button">เดินทางไป ${target.name} ➜</button>`, "travel");
    $("#travel-go").onclick = async () => {
      if (await emit("town:travel", { destination: target.id })) { closeModal(); sfx("portal"); }
    };
  } else if (panel === "mine") {
    modal(MINE_INFO.name, dungeonPanelHtml(p, state.time, true), "mine");
    $(`[data-card="${Math.max(41, Math.min(p.unlocked, 80))}"]`)?.scrollIntoView({ block: "center" });
    $$("[data-floor]").forEach(b => b.onclick = async () => {
      if (await emit("mine:enter", { floor: Number(b.dataset.floor) })) closeModal();
    });
  } else if (panel === "trainer") {
    showPanel("class");
  } else if (["inventory", "class", "status", "wardrobe"].includes(panel)) {
    modal(
      { class: "เส้นทางผู้กล้า", status: "สเตตัสผู้กล้า", wardrobe: "ตู้ชุดผู้กล้า" }[panel] || "อุปกรณ์และกระเป๋า",
      rpgPanel(p, state.area, panel),
      panel,
    );
    lastRpgPanelHash = JSON.stringify([
      p.attrs,
      p.statPoints,
      p.equipment,
      p.ownedEquipment,
      p.upgrade,
      p.enhancements,
      p.inventory,
      p.specialization,
      p.advanced,
      p.skin,
      p.level,
      p.gold,
      state.area,
    ]);
    const heroHost = $("#modal-body .inv-hero-art");
    if (panel === "inventory" && heroHost) {
      const refreshHero = () => requestAnimationFrame(() => showWorldHeroPreview(scene, scene?.actors.get(p.id), heroHost));
      refreshHero();
      if (scene?.load.isLoading()) scene.load.once("complete", refreshHero);
    }
    bindRpgPanel($("#modal-body"), p, {
      open: showPanel,
      action: async (event, data) => {
        const result = await emit(event, data);
        if (result && event.startsWith("stats:")) soundCue("equip");
        else if (result && event === "equipment:equip")
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
  } else if (panel === "potion") {
    // Potion shop: every size, buy any amount at once (1-999).
    lastRpgPanelHash = potionHash(p);
    const qty = (potionQty = Math.max(1, Math.min(MAX_BUY, potionQty || 1)));
    const rows = Object.keys(POTIONS).map((id) => {
      const { kind, restore } = POTIONS[id],
        total = ITEMS[id].price * qty;
      return row(
        supplyArt(id) || ITEMS[id].icon,
        ITEMS[id].name,
        `ฟื้นฟู ${restore} ${kind.toUpperCase()} · ${ITEMS[id].price} ทอง/ขวด · มี ${p.inventory[id] || 0}`,
        btn(`data-buy="${id}" ${p.gold < total ? "disabled" : ""}`, `×${qty} · ${total.toLocaleString()} ◈`),
      );
    }).join("");
    modal(
      "มีรา · ร้านปรุงยา",
      `<p>ยินดีต้อนรับผู้กล้า · ทองของเจ้า ${p.gold.toLocaleString()}</p><div class="buy-qty"><span>ซื้อครั้งละ</span>${[1, 10, 50, 100].map((n) => `<button data-buy-qty="${n}" class="${n === qty ? "active" : ""}">×${n}</button>`).join("")}<input id="buy-qty-input" type="number" inputmode="numeric" min="1" max="${MAX_BUY}" value="${qty}" aria-label="จำนวนที่ซื้อ"></div>${rows}<p class="hint">ปุ่มยา R / G เลือกขวดเล็กสุดที่เติมพอดีให้อัตโนมัติ ถ้าไม่มีขนาดที่พอจะใช้ขวดใหญ่สุดที่มี</p>`,
      "potion",
    );
    const setQty = (n) => {
      potionQty = n;
      showPanel("potion");
    };
    $$("[data-buy-qty]").forEach((b) => (b.onclick = () => setQty(Number(b.dataset.buyQty))));
    $("#buy-qty-input").onchange = (e) => {
      const n = Math.floor(Number(e.target.value));
      setQty(Number.isFinite(n) ? n : 1);
    };
    $$("[data-buy]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          if (!(await transaction("npc:buy", { item: b.dataset.buy, qty })))
            b.disabled = false;
        }),
    );
  } else if (panel === "stones") {
    const items = [BLESS_STONE, HIGH_STONE, "ore"];
    modal("มณี · ร้านหินตีบวก", `<p>ทอง ${p.gold.toLocaleString()} · หิน 100% ใช้ได้ทุกระดับจนถึง +15 โดยไม่เสียทองหรือแร่เพิ่ม</p>${items.map(id => row(supplyArt(id) || ITEMS[id].icon, ITEMS[id].name, `มี ${p.inventory[id] || 0} ชิ้น${id === HIGH_STONE ? " · ใช้ตั้งแต่ +10 ขึ้นไป" : ""}`, btn(`data-buy="${id}" ${p.gold < ITEMS[id].price ? "disabled" : ""}`, `${ITEMS[id].price.toLocaleString()} ◈`))).join("")}`, "stones");
    $$("[data-buy]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      await transaction("npc:buy", { item: b.dataset.buy });
      if (activePanel === "stones") showPanel("stones");
    });
  } else if (panel === "forge") {
    if (state.area !== "town") return;
    lastRpgPanelHash = forgeHash(p);
    const slots = Object.entries(SLOTS).map(([slot, label]) => {
      const item = GEAR[p.equipment[slot]],
        level = enhancementLevel(p, slot),
        { gold, ore } = enhancementCost(level);
      const bonus = Object.entries(ENHANCEMENT_BONUSES[slot])
        .map(([stat, value]) => `${stat.toUpperCase()} +${value}`).join(" · ");
      const description = !item
        ? "สวมอุปกรณ์ช่องนี้ก่อน"
        : level >= MAX_ENHANCE
          ? `${item.name} · ถึงระดับสูงสุด`
          : `${item.name} · ${bonus} ต่อขั้น · สำเร็จ ${Math.round(enhancementChance(level) * 100)}% · ${gold} ทอง + แร่ ×${ore}${level >= ENHANCE_BREAK_LEVEL ? " · ⚠ ล้มเหลวกลับเป็น +0" : ""}`;
      const disabled = !item || level >= MAX_ENHANCE || p.gold < gold || p.inventory.ore < ore;
      const stones = p.inventory[BLESS_STONE] || 0,
        blessed = item && level < MAX_ENHANCE && stones > 0
          ? btn(`data-enhance="${slot}" data-blessed="1" class="bless-button"`, `🌟 100% +${level + 1}`)
          : "";
      const highStones = p.inventory[HIGH_STONE] || 0,
        high = item && level >= HIGH_STONE_FROM && level < MAX_ENHANCE && highStones > 0
          ? btn(`data-enhance="${slot}" data-stone="high" class="bless-button high-stone-button"`, `💠 100% +${level + 1}`)
          : "";
      return row(item?.icon || "⚒", `${label} +${level}`, description,
        high + blessed + btn(`data-enhance="${slot}" ${disabled ? "disabled" : ""}`, level >= MAX_ENHANCE ? "เต็มแล้ว" : `ตี +${level + 1}`));
    }).join("");
    modal(
      "ลุงเหล็ก · โรงตีอุปกรณ์",
      `<p>มี ${p.gold.toLocaleString()} ทอง · แร่จันทรา ${p.inventory.ore} ชิ้น${p.inventory[BLESS_STONE] ? ` · 🌟 หินตีบวก 100% ×${p.inventory[BLESS_STONE]}` : ""}${p.inventory[HIGH_STONE] ? ` · 💠 หินตีบวกขั้นสูง 100% ×${p.inventory[HIGH_STONE]} (ใช้ได้ตั้งแต่ +${HIGH_STONE_FROM})` : ""}</p>${slots}<p class="hint">ระดับตีบวกติดกับช่องอุปกรณ์ เปลี่ยนของในช่องเดิมแล้วใช้โบนัสต่อได้ ตีบวกได้ถึง +${MAX_ENHANCE} · ต่ำกว่า +${ENHANCE_BREAK_LEVEL} ตีไม่สำเร็จจะเสียทองและแร่แต่ระดับเท่าเดิม · ตั้งแต่ +${ENHANCE_BREAK_LEVEL} ขึ้นไปถ้าล้มเหลวอุปกรณ์จะกลับเป็น +0 · อาวุธ +11 ขึ้นไปมีแสงวิ่งรอบตัวพร้อมฟอง สีเปลี่ยนตามระดับ +11 ถึง +15</p>`,
      "forge",
    );
    $$("[data-enhance]").forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        await transaction("equipment:enhance", {
          slot: button.dataset.enhance,
          blessed: button.dataset.blessed === "1",
          ...(button.dataset.stone === "high" ? { stone: "high" } : {}),
        });
        button.disabled = false;
      };
    });
  } else if (panel === "elder" || panel === "quest") {
    const scroll = $("#modal-body")?.scrollTop || 0,
      same = activePanel === "quest";
    lastQuestHash = questHash(p);
    modal("ผู้ใหญ่คำ · ภารกิจผู้กล้า", questPanelHtml(p, state.time), "quest");
    if (same) $("#modal-body").scrollTop = scroll;
    $$("[data-quest-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          setQuestTab(b.dataset.questTab);
          showPanel("quest");
          $("#modal-body").scrollTop = 0;
        }),
    );
    $$("[data-claim]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const index = b.dataset.claim;
          const r = await emit("quest:claim", {
            index: index === "bonus" ? index : Number(index),
          });
          if (r) soundCue(index === "bonus" ? "loot" : "material", "epic");
          else b.disabled = false;
        }),
    );
    if ($("#elder-heal")) $("#elder-heal").onclick = () => elderHeal();
  } else if (panel === "nightcave") {
    const sky = state.sky;
    if (!sky?.night) {
      closeModal();
      return toast("ถ้ำลึกลับหายไปกับแสงรุ่งอรุณ กลับมาใหม่ตอนกลางคืน", true);
    }
    const boss = nightBoss(sky.cycle),
      party = state.party,
      floor = nightFloor([p]),
      reward = nightReward(floor),
      done = state.nightCleared === sky.cycle,
      left = Math.max(1, Math.ceil((sky.changeAt - state.time) / 60));
    modal(
      "ถ้ำลึกลับ · ยามราตรี",
      `<div class="night-cave"><div class="night-boss">${portrait(boss.type)}</div><div class="night-info"><small>บอสใหญ่ประจำคืนนี้</small><h3>${escape(boss.name)}</h3><p>ถ้ำโบราณที่โผล่ขึ้นใต้ต้นไม้ใหญ่เฉพาะยามค่ำคืน ภายในมีบอสร่างยักษ์ที่แข็งแกร่งกว่าบอสชั้นปกติหลายเท่า พร้อมลูกสมุน</p><div class="night-tags"><span>HP ×${NIGHT_BOSS.hp}</span><span>ตีแรงขึ้น ${Math.round((NIGHT_BOSS.damage - 1) * 100)}%</span><span>พลังเทียบชั้น ${floor}${party ? " (ตามสมาชิกที่เก่งสุด)" : ""}</span></div><div class="night-reward ${done ? "done" : ""}"><strong>${done ? "รับรางวัลใหญ่คืนนี้แล้ว · ชนะอีกครั้งได้ทองเล็กน้อย" : "รางวัลชนะครั้งแรกของคืนนี้"}</strong><div><b class="chip chip-gold">◈ ${reward.gold}</b><b class="chip chip-ore">◆ แร่ ×${reward.ore}</b><b class="chip chip-exp">EXP ${300 + floor * 30}</b><b class="chip chip-energy">${Math.round(reward.itemChance * 100)}% อุปกรณ์บอสที่ยังไม่มี</b></div></div><p class="night-left">🌙 ถ้ำจะปิดเมื่อรุ่งสางในอีก ${left} นาที</p></div></div><button id="night-enter" class="primary-button">${party && party.leader !== p.id ? "รอหัวหน้าปาร์ตี้พาเข้า" : "ก้าวเข้าถ้ำ ➜"}</button>`,
      "nightcave",
    );
    $("#night-enter").disabled = !!party && party.leader !== p.id;
    $("#night-enter").onclick = async () => {
      $("#night-enter").disabled = true;
      const r = await emit("night:enter");
      if (r) closeModal();
      else $("#night-enter").disabled = false;
    };
  } else if (panel === "dungeon") {
    modal("ประตูถ้ำหลวง · เลือกดันเจียน", dungeonPanelHtml(p, state.time), "dungeon");
    // Open on the newest floor the hero can enter.
    $(`[data-card="${Math.min(p.unlocked, 40)}"]`)?.scrollIntoView({ block: "center" });
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
        : `<p>ร่วมทีมกับเพื่อนสูงสุด 3 คน แบ่งรับรางวัลส่วนตัวจากมอนสเตอร์</p><button id="party-create" class="primary-button">สร้างปาร์ตี้</button>${state.players.map((g) => row("♧", g.name, "ผู้เล่นในแผนที่", btn(`data-party-join="${g.id}"`, "ชวนปาร์ตี้"))).join("")}`,
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
              action: "invite",
              target: b.dataset.partyJoin,
            });
            closeModal();
          }),
      );
    }
  } else if (panel === "players") {
    const roster = onlinePlayers || [];
    const canInvite = state.area === "town" && (!state.party || (state.party.leader === p.id && state.party.members.length < 3));
    modal(
      "คนออนไลน์ · " + (onlinePlayers ? roster.length : state.online) + " คน",
      `<p>${onlinePlayers ? "รายชื่อผู้เล่นที่อยู่ในเกมทุกแผนที่" : "กำลังรอรายชื่อจากเซิร์ฟเวอร์…"}</p>${roster.map((m) => {
        const self = m.id === p.id, town = m.area === "town";
        return row(CLASSES[m.class]?.icon || "♧", m.name + (self ? " · คุณ" : ""), `${CLASSES[m.class]?.name || ""} · Lv.${m.level} · ${town ? "อยู่เมือง" : "อยู่ดันเจียน"}${m.inParty ? " · มีปาร์ตี้แล้ว" : ""}`, self ? "" : `<span class="online-actions">${state.players.some(player => player.id === m.id) ? `<button data-trade-target="${m.id}">แลกเปลี่ยน</button>` : ""}<button data-online-invite="${m.id}" ${canInvite && town && !m.inParty ? "" : "disabled"}>ชวนปาร์ตี้</button></span>`);
      }).join("")}${state.trade ? '<button id="trade-reopen" class="primary-button">เปิดการแลกเปลี่ยนที่ค้างอยู่</button>' : ""}`,
      "players",
    );
    if ($("#trade-reopen")) $("#trade-reopen").onclick = showTrade;
    $$("[data-trade-target]").forEach(b => b.onclick = async () => {
      const result = await emit("trade:action", { action: "request", target: b.dataset.tradeTarget });
      if (result) closeModal();
    });
    $$("[data-online-invite]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      const result = await emit("party:action", { action: "invite", target: b.dataset.onlineInvite });
      if (result) { b.textContent = "ส่งคำเชิญแล้ว"; }
      else b.disabled = false;
    });
  } else if (panel === "announcements") {
    modal("ประกาศจากระบบ", `<p>บอสโลก · ยักษ์ทองเฝ้าถ้ำ และพญานาคเจ้าแม่นางนอน สลับกันออกทุก 30 นาที (:00 และ :30) · เปิดรอบละ 20 นาที · รางวัลคือ 💠 หินตีบวกขั้นสูง 100% (ใช้ตี +11 ถึง +15) อันดับ 1 ได้ 3 ก้อน อันดับ 2–3 ได้ 2 ก้อน คนอื่นที่ทำดาเมจได้ 1 ก้อน</p><p>ทุกคนได้ทอง แร่ และ EXP ตามสัดส่วนดาเมจด้วย · มหาบอส 2 ทุ่มแจกหินตีบวก 100% เพิ่มให้ทุกคนที่เข้าร่วม</p>${announcementHistory().map(a => `<article class="system-notice"><small>${new Date(a.at * 1000).toLocaleString("th-TH", {timeZone:"Asia/Bangkok"})}</small><p>${escape(a.message)}</p></article>`).join("") || "<p>ยังไม่มีประกาศใหม่</p>"}`, "announcements");
  } else if (panel === "settings") {
    modal(
      "บันทึกการเดินทาง",
      `<p>เกมบันทึกตัวละคร เงิน อุปกรณ์ และดันเจียนบนเซิร์ฟเวอร์อัตโนมัติ<br>บัญชีผู้มาเยือนผูกกับคุกกี้ในเบราว์เซอร์นี้</p><button id="open-account-link" class="primary-button">${account?.registered ? "บัญชีผู้เล่น" : "ผูกบัญชี · เก็บตัวละครและเล่นต่อเครื่องอื่น"}</button><button id="open-announcements" class="primary-button">📣 ประกาศจากระบบ · บอสโลกทุก 30 นาที</button><button id="open-news" class="primary-button">📰 ข่าวอัปเดต · Lv.60 และมหาบอส 2 ทุ่ม</button><button id="open-poster" class="primary-button">🏹 โปสเตอร์ TML ONLINE</button><button id="toggle-sound" class="primary-button">${muted ? "เปิดเสียงทั้งหมด" : "ปิดเสียงทั้งหมด"}</button><button id="toggle-music" class="primary-button">${musicOn() ? "ปิดเพลงประกอบ" : "เปิดเพลงประกอบ"}</button><button id="toggle-screen-shake" class="primary-button" role="switch" aria-checked="${screenShakeEnabled()}">จอสั่น: ${screenShakeEnabled() ? "เปิด" : "ปิด"}</button><p class="hint">ปิดจอสั่นและซูมกระแทกเพื่อลดอาการเวียนหัว · บันทึกการตั้งค่าในเครื่องนี้</p><div class="auto-settings"><small>ออโต้ · ดื่มยาอัตโนมัติเมื่อต่ำกว่า</small>${["hp","mp"].map((k) => `<label><span>${k.toUpperCase()}</span><input type="range" min="0" max="95" step="5" data-auto-cfg="${k}" value="${state?.self.autoCfg?.[k] ?? (k === "hp" ? 65 : 45)}"><b>${state?.self.autoCfg?.[k] ?? (k === "hp" ? 65 : 45)}%</b></label>`).join("")}<p class="hint">0% = ไม่ใช้ยา · ออโต้จะเปิดกล่องเสบียงและเก็บรูนให้เองหลังเคลียร์มอนสเตอร์</p></div><div class="quality-picker"><small>คุณภาพกราฟิก · ตอนนี้ ${qualityLabel()}</small><div>${CHOICES.map((c) => `<button data-quality="${c}" class="${c === qualityChoice ? "active" : ""}">${c === "auto" ? "อัตโนมัติ" : PRESETS[c].name}</button>`).join("")}</div></div><button id="toggle-perf" class="primary-button">${perfOn ? "ซ่อนตัววัดประสิทธิภาพ" : "แสดงตัววัดประสิทธิภาพ"}</button><button id="back-selection" class="text-button">กลับหน้าเลือกตัวละคร</button><p class="hint">Demo v0.3 · นักดาบหญิงและสไลม์มีเฟรมแอนิเมชันชุดแรก · ตัวอื่นยังใช้ภาพ idle · เป้าหมาย 20–30 คนต่อห้องยังไม่ได้ยืนยันด้วย load test</p>`,
    );
    $("#open-account-link").onclick = () => $("#account-open").click();
    $("#open-announcements").onclick = () => showPanel("announcements");
    $("#open-poster").onclick = () => showPanel("poster");
    $("#open-news").onclick = () => showPanel("news");
    $("#toggle-sound").onclick = () => {
      setSound(!soundOn());
      syncSoundButton();
      sfx("click");
      closeModal();
    };
    for (const input of $$("[data-auto-cfg]")) {
      input.oninput = () => (input.nextElementSibling.textContent = input.value + "%");
      input.onchange = () => emit("player:autoCfg", { [input.dataset.autoCfg]: Number(input.value) });
    }
    $("#toggle-screen-shake").onclick = () => {
      const enabled = setScreenShakeEnabled(!screenShakeEnabled());
      const button = $("#toggle-screen-shake");
      button.textContent = `จอสั่น: ${enabled ? "เปิด" : "ปิด"}`;
      button.setAttribute("aria-checked", String(enabled));
    };
    $("#toggle-music").onclick = () => {
      setMusic(!musicOn());
      sfx("click");
      closeModal();
    };
    for (const b of $$("[data-quality]"))
      b.onclick = () => {
        setQuality(b.dataset.quality);
        toast(`คุณภาพกราฟิก: ${qualityLabel()}`);
        sfx("click");
        closeModal();
      };
    $("#toggle-perf").onclick = () => {
      togglePerf();
      sfx("click");
      closeModal();
    };
    $("#back-selection").onclick = () => {
      socket.disconnect();
      state = null;
      phaser?.loop.sleep();
      $("#game-screen").classList.add("hidden");
      $("#landing").classList.remove("hidden");
      mountSelection();
      renderCards();
      music("town");
      closeModal();
      refreshAccount();
    };
  }
}
window.addEventListener("tml:screen-shake-change", (event) => {
  if (event.detail) return;
  scene?.cameras.main.shakeEffect.reset();
  if (scene?.zoomPunch) {
    scene.zoomPunch.stop();
    scene.zoomPunch = null;
    scene.resize();
  }
});
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
          return `<div class="trade-offer"><b>${escape(t.names[id])}${id === p.id ? " (คุณ)" : ""}</b><p>${o.gold} ทอง + ${(ITEMS[o.item] || COSTUME_ITEMS[o.item])?.name || o.item} ×${o.qty}</p><small>${t.confirmed.includes(id) ? "✓ ยืนยันรอบแรกแล้ว" : "ยังไม่ยืนยัน"} ${t.final.includes(id) ? "· ✓ ยืนยันสุดท้ายแล้ว" : ""}</small></div>`;
        })
        .join(
          "",
        )}<label>ทองที่เสนอ<input id="trade-gold" type="number" min="0" value="${me.gold}"></label><label>ไอเทม<select id="trade-item">${[...STACK_SUPPLIES, ...Object.keys(COSTUME_ITEMS).filter((i) => p.inventory[i] > 0 || me.item === i)].map((i) => `<option value="${i}" ${me.item === i ? "selected" : ""}>${(ITEMS[i] || COSTUME_ITEMS[i]).name} · มี ${p.inventory[i] || 0}</option>`).join("")}</select></label><label>จำนวน<input id="trade-qty" type="number" min="0" value="${me.qty}"></label><div class="trade-actions"><button id="trade-offer" class="secondary-button">อัปเดตข้อเสนอ</button><button id="trade-confirm" class="primary-button">${t.confirmed.length === 2 ? "ยืนยันรอบสุดท้าย" : "ยืนยันรายการรอบแรก"}</button></div><button id="trade-cancel" class="text-button">ยกเลิกการแลกเปลี่ยน</button>`,
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
// "More" opens the secondary menu icons; any menu choice or a tap elsewhere closes it.
{
  const menu = $("#top-menu"), more = $("#menu-more");
  const setMore = (open) => {
    menu.classList.toggle("open", open);
    more.setAttribute("aria-expanded", String(open));
  };
  more.onclick = (e) => {
    e.stopPropagation();
    setMore(!menu.classList.contains("open"));
  };
  document.addEventListener("pointerdown", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !e.target.closest("#chat-toggle, #training-open"))
      setMore(false);
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest("[data-panel]")) setMore(false);
  });
  for (const id of ["#chat-toggle", "#training-open"])
    $(id).addEventListener("click", () => setMore(false));
}
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
  if (state && !e.repeat && ["KeyI", "KeyC", "KeyK", "KeyL"].includes(e.code)) {
    e.preventDefault();
    const panel = { KeyI: "inventory", KeyC: "class", KeyK: "status", KeyL: "quest" }[e.code];
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
    KeyS: "skill4",
    KeyX: "skill5",
    KeyR: "hp",
    KeyG: "mp",
    KeyT: "auto",
  };
  if (actions[e.code]) action(actions[e.code]);
  if (e.code === "Space") jumpQueued = true;
  sendInput();
  if (e.code === "KeyF") interact();
  if (e.code === "KeyV") toggleWalkability();
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  sendInput();
});
addEventListener("blur", () => {
  keys.clear();
  touchDirection = 0;
  touchAttack = false;
});
// Floating joystick (MOBA style): it appears under the thumb anywhere in the
// zone. Tilt walks, full tilt runs, a flick upward jumps once per flick.
let touchRun = false;
for (const root of [$("#mobile-controls"), $(".skillbar")])
  for (const type of ["pointerdown", "pointerup", "pointermove", "pointercancel", "click", "touchstart", "touchmove", "touchend"])
    root.addEventListener(type, (event) => event.stopPropagation());
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
    sendInput();
  };
  const steer = (e) => {
    const radius = stick.radius,
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
    sendInput();
  };
  zone.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (stick || activePanel || !state) return;
    e.preventDefault();
    // Steering takes over from AUTO at once.
    if (state.self?.auto) emit("player:auto", { enabled: false });
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
    // Radius read once per touch: reading layout on every move is costly.
    stick = { id: e.pointerId, x: r.left + x, y: r.top + y, flicked: false, radius: half };
    steer(e);
  });
  zone.addEventListener("pointermove", (e) => {
    e.stopPropagation();
    if (stick?.id === e.pointerId) steer(e);
  });
  for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
    zone.addEventListener(n, (e) => {
      e.stopPropagation();
      if (stick?.id === e.pointerId) release();
    });
  addEventListener("blur", release);
  document.addEventListener("game:reset-controls", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { release(); touchAttack = false; }
  });
  addEventListener("resize", release);
  zone.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
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
  if (activePanel || !state) return;
  attackButton.setPointerCapture(e.pointerId);
  touchAttack = true;
  action("attack");
});
for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
  attackButton.addEventListener(n, () => (touchAttack = false));
$("#mobile-jump").onpointerdown = (e) => {
  e.preventDefault();
  if (activePanel || !state) return;
  jumpQueued = true;
  sendInput();
};
$("#mobile-interact").onclick = interact;
// Movement input. A change (stick tilt, key, jump) goes out at once instead
// of waiting for the next tick; the 80 ms tick keeps sending as a heartbeat.
let lastInput = "";
const typing = () =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
function sendInput(heartbeat = false) {
  if (!state || !socket?.connected) return;
  if (forgeDestination && state.area === "town") {
    const dx = forgeDestination.x - state.self.x;
    if (Math.abs(dx) < 65) {
      forgeDestination = null;
      showPanel("forge");
    } else if (!activePanel && !typing() && !touchDirection && !keys.size) {
      socket.emit("player:input", { direction: Math.sign(dx), seq: ++seq, jump: false, running: true });
      return;
    } else forgeDestination = null;
  }
  const direction =
      activePanel || typing()
        ? 0
        : touchDirection ||
          (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    jump = jumpQueued && !activePanel,
    running = touchDirection
      ? touchRun
      : keys.has("ShiftLeft") || keys.has("ShiftRight"),
    now = `${direction}|${running}`;
  if (!heartbeat && !jump && now === lastInput) return;
  lastInput = now;
  socket.emit("player:input", { direction, seq: ++seq, jump, running });
  jumpQueued = false;
}
setInterval(() => {
  sendInput(true);
  if (state && socket?.connected && (keys.has("KeyJ") || touchAttack) && !activePanel && !typing())
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
    // Fewer concurrent decodes on Low keeps memory spikes down while loading.
    this.load.maxParallelDownloads = preset().renderScale < 1 ? 3 : 6;
    queueSpriteSets(this);
    preloadRiverside(this);
    this.load.image("rare-earth-mine", "/assets/regions/rare-earth-mine.webp?v=1");
    // Town kit: pieces, props, animated props and far layers (tools/town-kit).
    const kit = (key) => `/assets/town-kit/${key}.webp?v=11`;
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
    // far-sky/-mountains/-hills/-treeline are no longer drawn (the far
    // layers are parallax.js's generated strips): ~21 MB of GPU memory.
    for (const key of ["street", "far-village"])
      this.load.image(`town-${key}`, kit(key));
    // Gear art (400 pictures, ~16 MB decoded) loads when a piece drops:
    // see loadArt() in effect().
    for (const id of ["gold", "ore"])
      this.load.image(
        `drop-${id}`,
        `/assets/items/supply-${id === "gold" ? 2 : 3}.webp`,
      );
    this.load.image(
      "player-market-stall",
      // 2x its display size: a 9x downscale shimmered and looked oversharp.
      "/assets/town-kit/player-market-stall.webp?v=3",
    );
    this.load.image("slot-machine", "/assets/town-kit/slot-machine-v2.png?v=2");
    this.load.image("world-titan", "/assets/bosses/world-titan.webp?v=1");
    this.load.image("explore-chest", "/assets/exploration/chest.webp?v=1");
    this.load.image("explore-rune", "/assets/exploration/rune.webp?v=1");
    this.load.image("cave", "/assets/cave.webp?v=2");
    this.load.image("knight-motion", "/assets/animations/knight-female.png");
    this.load.image("slime-motion", "/assets/animations/slime.png?v=3");
    for (const id of Object.keys(BOSSES))
      this.load.image(`boss-preview:${id}`, `/assets/sprites/monsters/${id}/portrait.webp?v=1`);
    this.load.spritesheet("heroes", "/assets/heroes.webp", {
      frameWidth: 512,
      frameHeight: 512,
    });
    this.load.spritesheet("monsters", "/assets/monsters.png?v=2", {
      frameWidth: 418,
      frameHeight: 418,
    });
  }
  create() {
    scene = this;
    this.ready = true;
    // Pixel art (tools/sprite-rig/pixelate_images.py): sample it nearest so
    // the blocks stay square instead of blurring.
    for (const key of this.textures.getTextureKeys())
      if (/^(town-|item-|cave$|slot-machine$|player-market-stall$|slime-motion$|monsters$)/.test(key))
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // World text is drawn into a texture, then scaled by the camera zoom and
    // the screen's pixel ratio; at resolution 1 small Thai names go soft.
    // Render every world label at a higher resolution so it stays crisp.
    // Each label is its own texture; at 3x it holds 9x the pixels, so the
    // graphics preset caps it (Low 1.5x, Medium 2x, High 3x).
    this.worldLabel = createWorldLabels(this, $("#game-screen"));
    const addText = this.add.text.bind(this.add);
    this.add.text = (...args) => {
      const label = addText(...args).setResolution(
        Math.max(3, Math.min(4, Math.ceil((devicePixelRatio || 1) * 2))),
      );
      // Text needs smooth sampling even when character art uses nearest pixels.
      label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (args[3]?.worldLabel) this.worldLabel(label);
      return label;
    };
    this.knightAtlas = registerMotionAtlas(this, "knight-motion", 8);
    this.sprites = createSpriteRegistry(this);
    // Warm the chosen hero and enemies before joining the live world.
    const index = this.spriteSetIndex || {},
      hero = characters.find((c) => c.id === selectedId),
      skin = hero && heroSkins(hero).find((name) => index.sets?.[name]);
    // Townsfolk are needed on arrival. Monster animations (6 actions for
    // every enemy and boss, hundreds of files) load per type when one first
    // appears (applySnapshot), so a tablet only fetches what it meets.
    for (const name of Object.keys(index.npcs || {})) this.sprites.want("npcs", name);
    if (skin) {
      this.sprites.want("sets", skin);
      const set = { ...index.sets[skin], name: skin },
        dress = gearDress(hero, set), layers = set.layers;
      if (layers) {
        for (const slot of ["outfit", "head", "weapon"]) {
          const look = dress.looks?.[slot];
          if (!layers.looks?.[slot]?.includes(look)) continue;
          const parts = layers.parts?.[slot]?.[look];
          const dir = slot === "weapon" ? layers.weapons?.[dress.looks?.outfit] || slot : slot;
          for (const path of parts ? parts.map((p) => `${slot}/${look}/${p}`) : [`${dir}/${look}`])
            this.sprites.layer(skin, path);
        }
        const hand = layers.hands?.[dress.looks?.outfit] || layers.hand;
        if (hand && !layers.weaponBehind && !layers.weaponFront) this.sprites.layer(skin, hand);
        if (dress.weapon) this.sprites.image(dress.weapon.url);
      }
    }
    // Requests above can append atlas pages to the same loader run.
    if (this.load.isLoading()) this.load.once("complete", () => resolveAdventureLoaded?.());
    else resolveAdventureLoaded?.();
    this.spriteSets = this.sprites.heroes;
    this.monsterSets = this.sprites.monsters;
    this.slimeAtlas = registerMotionAtlas(this, "slime-motion", 6);
    this.telegraphs = this.add.graphics().setDepth(6);
    // Falling rocks, bolts and flood water draw over the heroes.
    this.mechTop = this.add.graphics().setDepth(12);
    this.dangerHint = this.add
      .text(0, 0, "", {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        color: "#ffe8a8",
        stroke: "#322847",
        strokeThickness: 2,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(18);
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.cameras.main.setBackgroundColor("#234b68");
    this.quality = preset();
    this.lite = !this.quality.glow;
    this.parallax = createParallax(this);
    this.fx = createCombatFx(this);
    this.parallax.setArea("town");
    this.parallax.setQuality(this.quality);
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
        worldLabel: true,
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        align: "center",
        color: "#d4fbff",
        stroke: "#173756",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.travelGlow = this.add.ellipse(TRAVEL_GATE.x, WORLD.ground - 60, 76, 132, 0x53dbc0, 0.32).setDepth(4).setStrokeStyle(3, 0xf2d497, 0.9);
    this.travelLabel = this.add.text(TRAVEL_GATE.x, WORLD.ground - 155, "ประตูวาร์ป\nชุมชนริมน้ำสาย", { worldLabel: true, fontFamily: "Noto Sans Thai", fontSize: "15px", align: "center", color: "#ecfff7", stroke: "#112d35", strokeThickness: 4 }).setOrigin(0.5).setDepth(12);
    this.npcs.push(this.travelGlow, this.travelLabel);
    this.tweens.add({ targets: this.travelGlow, alpha: 0.65, duration: 1300, yoyo: true, repeat: -1 });
    // Click or tap NPCs, the cave gate and stalls to open them directly.
    this.hoverRing = this.add
      .ellipse(0, WORLD.ground + 4, 120, 26, 0xffe6a5, 0.28)
      .setStrokeStyle(2, 0xffe6a5, 0.9)
      .setDepth(2)
      .setVisible(false);
    this.hotspots = [
      this.hotspot(TRAVEL_GATE.x, WORLD.ground, 120, 180, () => openTown("travel")),
      ...WORLD.npcs.map((n) =>
        this.hotspot(n.x, n.y ?? WORLD.ground, 110, 175, () => openTown(n.id)),
      ),
      this.hotspot(WORLD.portal, WORLD.portalY + 85, 150, 240, () =>
        openTown("portal"),
      ),
    ];
    const slotGlow = this.add.ellipse(SLOT_MACHINE.x, WORLD.ground - 2, 118, 20, 0xf2ce78, 0.2).setDepth(3);
    // Never render Phaser's missing-texture placeholder as the cabinet.
    const hasSlotArt = this.textures.exists("slot-machine");
    const slotImage = this.add.image(SLOT_MACHINE.x, WORLD.ground, hasSlotArt ? "slot-machine" : "__WHITE").setOrigin(0.5, 1).setDepth(7).setAlpha(hasSlotArt ? 1 : 0);
    if (hasSlotArt) slotImage.setScale(178 / slotImage.height);
    else {
      const retryKey = "slot-machine-retry";
      this.load.once(`filecomplete-image-${retryKey}`, () => {
        slotImage.setTexture(retryKey).setScale(178 / this.textures.get(retryKey).getSourceImage().height).setAlpha(1);
      });
      this.load.image(retryKey, `/assets/town-kit/slot-machine.webp?retry=${Date.now()}`);
      if (!this.load.isLoading()) this.load.start();
    }
    const slotLabel = this.add.text(SLOT_MACHINE.x, WORLD.ground - 195, "ตู้สมบัติจันทรา\n1,000 ทอง / ครั้ง", {
      worldLabel: true,
      fontFamily: "Noto Sans Thai", fontSize: "12px", fontStyle: "bold", align: "center", color: "#fff2ce", stroke: "#10202a", strokeThickness: 1,
    }).setOrigin(0.5).setDepth(14);
    this.npcs.push(slotGlow, slotImage, slotLabel);
    this.hotspots.push(this.hotspot(SLOT_MACHINE.x, WORLD.ground, 150, 185, () => openTown("slots")));
    this.tweens.add({targets:slotGlow,alpha:0.4,duration:1300,yoyo:true,repeat:-1});
    this.nightSky = createNightSky(this, () => openTown("nightcave"));
    this.makePlatforms();
    this.cameras.main.centerOn(380, this.camY ?? 340);
    this.scale.on("resize", () => this.resize());
    this.resize();
    if (state) this.applySnapshot(state);
  }
  resize() {
    // Frame by CSS size; a reduced render scale only shrinks the pixels.
    const r = this.renderScale(),
      w = this.scale.width / r,
      h = this.scale.height / r,
      portrait = h > w && w < 700,
      town = (state?.area ?? "town") === "town";
    this.portrait = portrait;
    if (town) {
      // The town is pixel art with tall scenery: pull the camera back for a
      // wide view (portrait phones see ~600 world px across), with the street
      // at ~64% of the screen so thumb controls sit below the action.
      const zoom = portrait
          ? Phaser.Math.Clamp(w / 600, 0.5, 1.1)
          : w < 700
            ? Math.max(0.45, h / 1150)
            : Math.max(0.55, h / 1150),
        viewH = h / zoom;
      this.camY = Math.min(
        TOWN_VIEW.bottom - viewH / 2,
        portrait ? WORLD.ground - 0.18 * viewH : h < 520 ? WORLD.ground - 0.24 * viewH : 340,
      );
      this.cameras.main.setZoom(zoom * r);
      this.cameras.main.setBounds(0, TOWN_VIEW.top, areaWidth("town"), TOWN_VIEW.bottom - TOWN_VIEW.top);
    } else {
      // Portrait phones: frame by width so heroes stay readable, and put the
      // ground near 2/3 of the screen so thumb controls sit below the action.
      const zoom = portrait
          ? Phaser.Math.Clamp(w / 760, 0.42, 0.95)
          : w < 700
            ? Math.max(0.5, h / 1050)
            : Math.max(0.6, h / 950),
        viewH = h / zoom;
      // Ground at ~2/3 on portrait phones, ~3/4 on short landscape screens
      // (phones sideways); tall desktop windows keep the original framing.
      // Portrait: ground just above the skill buttons (~60%), so the
      // fight uses the lower screen instead of leaving it empty; the camera may look past the painting's bottom there
      // (the controls and the foreground strip cover it).
      const bottom = portrait ? Math.max(1000, WORLD.ground + 0.36 * viewH) : 850;
      this.camY = portrait
        ? Math.min(bottom - viewH / 2, WORLD.ground - 0.15 * viewH)
        : h < 520
          ? Math.min(bottom - viewH / 2, WORLD.ground - 0.26 * viewH)
          : 340;
      this.cameras.main.setZoom(zoom * r);
      // Tall phones see more world than -100..bottom+100: bounds shorter
      // than the view make Phaser centre it, which lifted the ground to
      // mid-screen and left the bottom empty. Reach up far enough to frame
      // the ground at camY (plus headroom for climbs).
      // Wider screens keep -100: above it there is no backdrop, and a jump
      // would lift the view into the empty band.
      const top = portrait ? Math.min(-100, this.camY - viewH / 2 - 400) : -100;
      this.cameras.main.setBounds(0, top, areaWidth(state?.area), bottom + 100 - top);
    }
    this.parallax?.resize();
  }
  renderScale() {
    return Number($("#game-canvas")?.dataset.scale) || 1;
  }
  applyQuality(p) {
    this.quality = p;
    this.lite = !p.glow;
    this.parallax?.setQuality(p);
    this.load.maxParallelDownloads = p.renderScale < 1 ? 3 : 6;
    this.resize();
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
    zone.on("pointerdown", (pointer) => {
      // Phaser can receive window-level touch events from controls above its canvas.
      if (!isWorldPointer(pointer, this.game.canvas)) return;
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
        cave ? floorInfo(state?.dungeon).color : 0x83b952,
      );
      this.decor.fillRoundedRect(p.x - 3, p.y, p.w + 6, 9, 4);
    }
  }
  actor(p, stamp, reset = false) {
    let a = this.actors.get(p.id);
    const skins = heroSkins(p);
    this.sprites.wantHero(skins);
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
            worldLabel: true,
            fontFamily: "Noto Sans Thai",
            fontSize: "14px",
            fontStyle: "bold",
            color: p.id === state.self.id ? "#fff0b5" : "#e4fff6",
            stroke: "#193c51",
            strokeThickness: 2,
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
            strokeThickness: 2,
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
                strokeThickness: 2,
              })
              .setOrigin(0.5)
              .setDepth(14)
          : null;
      const rim = createRim(this, null, 9.5, 1.4);
      a = {
        image,
        label,
        gearBadge,
        shadow,
        footLight,
        rim,
        marker,
        target: p,
        wasGrounded: p.grounded,
        footstepAt: 0,
      };
      if (p.id !== state.self.id && !p.ambient) {
        image.setInteractive({ useHandCursor: true });
        image.on("pointerdown", (pointer) => {
          if (!isWorldPointer(pointer, this.game.canvas) || activePanel || state.area !== "town") return;
          modal("ผู้เล่น · " + p.name, `<p>${escape(p.name)}</p><button id="invite-player" class="primary-button">ชวนเข้าปาร์ตี้</button>`, "player");
          $("#invite-player").onclick = async () => {
            const result = await emit("party:action", { action: "invite", target: p.id });
            if (result) closeModal();
          };
        });
      }
      a.bornAt = this.time.now;
      this.actors.set(p.id, a);
    }
    a.target = p;
    a.skins = skins;
    if (reset || !a.history) a.history = [];
    a.history.push({ time: stamp, x: p.x, y: p.y, vx: p.vx || 0 });
    if (a.history.length > 8) a.history.shift();
    return a;
  }
  applySnapshot(s) {
    const area =
      s.area === "town"
        ? "town:" + townOf(s.self).id
        : "dungeon" +
          s.dungeon.instanceId +
          ":" +
          s.dungeon.floor +
          ":" +
          s.dungeon.stage;
    const areaChanged = area !== this.lastArea;
    if (areaChanged) {
      loadingArrived(s);
      const fromTown = this.lastArea?.startsWith("town:");
      this.lastArea = area;
      const town = s.area === "town";
      const bossStage = !town && s.dungeon?.stage === 3 && !s.dungeon?.training;
      music(town ? "town" : bossStage ? "boss" : "dungeon");
      if (fromTown && !town) sfx("portal");
      if (bossStage) setTimeout(() => sfx("roar"), 600);
      this.parallax.setArea(
        town ? (townOf(s.self).id === "riverside" ? "riverside" : "town") : s.dungeon?.mine ? "mine" : "cave",
        town ? null : floorInfo(s.dungeon).color,
      );
      this.resize(); // the town and the dungeons frame the camera differently
      this.lookX = 0;
      this.npcs.forEach((n) => n.setVisible(town));
      this.hotspots.forEach((z) => (z.input.enabled = town));
      this.hoverRing.setVisible(false);
      this.portalLabel.setVisible(town);
      this.portalLabel.setText(townOf(s.self).id === "riverside" ? "เหมืองแร่แรร์เอิร์ธ\nทางเข้าเหมือง" : "ถ้ำหลวง\nประตูสู่ดอยนางนอน");
      this.travelLabel.setText("ประตูวาร์ป\n" + TOWNS[townOf(s.self).destination].name);
      this.portal.setVisible(town);
      this.portalGlow.setVisible(town);
      this.makePlatforms();
      this.cameras.main.centerOn(s.self.x, this.camY);
      this.actors.forEach((a) => {
        a.image.x = s.self.x;
        a.image.y = s.self.y;
      });
    }
    this.showDungeonSigns(area, s.dungeon?.signs || []);
    const townId = townOf(s.self).id;
    if (this.wandererTown !== townId) {
      this.wandererTown = townId;
      this.wanderers = townWanderers(townId, WORLD.ground);
    }
    const ambient = s.area === "town" ? this.wanderers : [];
    const all = [s.self, ...s.players, ...ambient],
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
            e.world ? (e.grand ? 600 : 460) :
            (mset ? mset.height + 12 : e.boss ? 210 : 95) *
            (e.elite ? 1.25 : 1) *
            (traitOf(e).scale || 1) *
            (e.night ? NIGHT_BOSS.scale : 1);
        const image = this.add
          .image(e.x, e.y, e.world ? "world-titan" : BOSSES[e.type] ? `boss-preview:${e.type}` : "monsters",
            e.world || BOSSES[e.type] ? undefined : Math.max(0, types.indexOf(e.type)))
          .setDisplaySize(size, size)
          .setOrigin(0.5, 1)
          .setDepth(8);
        const label = this.add
          .text(
            e.x,
            e.y - size - 15,
            e.boss
              ? floorInfo(s.dungeon).boss
              : s.dungeon?.mine
                ? `${TRAITS[e.trait]?.icon || ""} ${e.elite ? "หัวหน้า " : ""}${MONSTERS[e.type]?.name || e.type}กลายพันธุ์`
              : e.variant
                ? `${e.elite ? "★ หัวหน้า " : ""}${TRAITS[e.trait]?.icon || ""} ${e.variant}`
                : `${e.elite ? "★ หัวหน้า " : ""}${floorInfo(s.dungeon).prefix} · ${MONSTERS[e.type]?.name || e.type}`,
            {
              fontFamily: "Noto Sans Thai",
              fontSize: "14px",
              color: "#ffe1b5",
              stroke: "#152b4b",
              strokeThickness: 2,
            },
          )
          .setOrigin(0.5)
          .setDepth(15);
        const bar = this.add.graphics().setDepth(14);
        m = { image, label, bar, target: e, size, bornAt: this.time.now };
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
          (m.target.world || !playMonsterDeath(this, m.image, this.monsterSets.get(m.target.type)))
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
        const rim = createRim(this, null, 3.9, 1.4).sync(stall);
        const light = footGlow(this, shop.x, WORLD.ground - 2, 0.26)
          ?.setDisplaySize(170, 30)
          .setDepth(3);
        const label = this.add
          .text(shop.x, WORLD.ground - 141, shop.name, {
            worldLabel: true,
            fontFamily: "Noto Sans Thai",
            fontSize: "12px",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 138 },
            color: "#fff2cd",
            stroke: "#10202a",
            strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true, stroke: true },
          })
          .setOrigin(0.5)
          .setDepth(14);
        this.shopObjects.push(
          shadow,
          ...(light ? [light] : []),
          ...rim.parts,
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
  // Load one picture on demand, then call show(key). Gear art is pixel art,
  // so it samples nearest like the preloaded town and item textures.
  loadArt(key, url, show) {
    if (this.textures.exists(key)) return show(key);
    this.load.image(key, url);
    this.load.once(`filecomplete-image-${key}`, () => {
      if (key.startsWith("item-"))
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      show(key);
    });
    if (!this.load.isLoading()) this.load.start();
  }
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
  // "❄ แช่แข็ง!" over whoever just picked up a status.
  statusPop(x, y, st, loud) {
    const text = this.add
      .text(x, y, `${st.icon} ${st.name}!`, {
        fontFamily: "Noto Sans Thai",
        fontSize: loud ? "18px" : "15px",
        fontStyle: "bold",
        color: st.color,
        stroke: "#0b0f1a",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(43)
      .setScale(0.5);
    this.tweens.add({ targets: text, scale: 1, duration: 180, ease: "Back.Out" });
    this.tweens.add({
      targets: text,
      y: y - 36,
      alpha: 0,
      delay: 650,
      duration: 500,
      onComplete: () => text.destroy(),
    });
  }
  floatBanner(x, y, label, color, stroke) {
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Noto Sans Thai",
        fontSize: "22px",
        fontStyle: "bold",
        color,
        stroke,
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(46)
      .setScale(0.6);
    this.tweens.add({ targets: text, scale: 1, duration: 260, ease: "Back.Out" });
    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      delay: 1100,
      duration: 900,
      ease: "Cubic.In",
      onComplete: () => text.destroy(),
    });
  }
  effect(e) {
    if (e.kind === "ultimate") {
      if (e.actorId === state?.self.id) showUltimateCutin(e.class, e.gender);
      return;
    }
    if (e.kind === "stone") {
      if (e.actorId === state.self.id) {
        toast(`💠 ได้รับหินตีบวกขั้นสูง 100% ×${e.count} · ใช้ที่ลุงเหล็กกับอุปกรณ์ +${HIGH_STONE_FROM} ขึ้นไป`);
        soundCue("loot", "legendary");
      }
      return;
    }
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
          divine: "#a9fff1",
        }[item.rarity];
        const path = itemArtPath(e.item, item);
        if (path)
          this.loadArt(`item-${e.item}`, path, (key) =>
            this.showDrop(
              e,
              key,
              color,
              { common: 64, rare: 76, epic: 88, legendary: 104, divine: 120 }[item.rarity] ?? 64,
            ),
          );
        const text = this.add
          .text(e.x, e.y - 60, `${item.name}\n${RARITIES[item.rarity]}`, {
            align: "center",
            fontFamily: "Noto Sans Thai",
            fontSize: item.rarity === "legendary" ? "20px" : "16px",
            color,
            stroke: "#07131e",
            strokeThickness: 2,
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
    if (e.kind === "costume") {
      const c = COSTUME_ITEMS[e.item];
      if (c && e.actorId === state.self.id) {
        toast(`ได้รับชุดแต่งกาย ${c.name} [${RARITIES[c.rarity]}] · สวมได้ที่ตู้ชุด หรือนำไปขายในตลาด`);
        soundCue("loot", c.rarity);
        const key = `costume-${e.item}`,
          color = { rare: "#79d9f2", epic: "#d0a7ff", legendary: "#ffc35d" }[c.rarity],
          show = () => this.showDrop(e, key, color, 92);
        this.loadArt(key, costumeArtPath(e.item), show);
      }
      return;
    }
    if (e.kind === "material") {
      if (e.actorId === state.self.id) {
        toast(`รางวัลพิชิตบอส · ได้แร่จันทรา ×${e.amount}`);
        soundCue("material");
        this.showDrop(e, "drop-ore", "#9fe6ff", 48);
      }
      return;
    }
    if (e.kind === "buff") {
      const b = BUFFS[e.buff];
      if (b && e.targetId === state.self.id) {
        this.floatBanner(e.x, e.y, `${b.icon} ${b.name}`, b.color, "#1a1208");
        sfx("spell", null, 0.1);
      }
      if (b) {
        const target = this.actors.get(e.targetId)?.image;
        this.fx.ring(target?.x ?? e.x, (target?.y ?? e.y + 120) - 60, Phaser.Display.Color.HexStringToColor(b.color).color, 2.4, 480);
      }
      return;
    }
    if (e.kind === "summon") {
      this.floatBanner(e.x, e.y, "บอสโลกเรียกสมุน ×" + e.count + "!", "#ff9a8a", "#3a0a0a");
      shakeCamera(this.cameras.main, 260, 0.006);
      sfx("roar", null, 0.2);
      return;
    }
    if (e.kind === "miss") {
      this.statusPop(e.x, e.y, { icon: "💨", name: "MISS", color: "#bfe9ff" }, e.targetId === state.self.id);
      return;
    }
    if (e.kind === "status") {
      const st = e.status === "lightning"
        ? { icon: "⚡", name: "ศรสายฟ้าแลบ", color: "#ffe066" }
        : STATUSES[e.status];
      if (st) this.statusPop(e.x, e.y, st, e.targetId === state.self.id);
      return;
    }
    if (e.kind === "heal") {
      const text = this.add
        .text(e.x, e.y, `+${e.amount}`, {
          fontFamily: "Noto Sans Thai",
          fontSize: "20px",
          fontStyle: "bold",
          color: "#7dff9a",
          stroke: "#0b3318",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(36);
      this.tweens.add({
        targets: text,
        y: e.y - 40,
        alpha: 0,
        duration: 900,
        ease: "Cubic.Out",
        onComplete: () => text.destroy(),
      });
      return;
    }
    if (e.kind === "quest") {
      if (e.actorId === state.self.id) {
        toast(`ภารกิจสำเร็จ · ${e.text} · กด L รับรางวัล`);
        soundCue("material");
        this.floatBanner(e.x, e.y, "ภารกิจสำเร็จ!", "#9ff5c8", "#0f3a2a");
      }
      return;
    }
    if (e.kind === "bestiary") {
      if (e.actorId === state.self.id) {
        const m = MONSTERS[e.type];
        toast(
          `สมุดล่ามอน · ${m.name} ${"★".repeat(e.stars)} · ${m.stat.toUpperCase()} +${m.per} ถาวร`,
        );
        soundCue("loot", "epic");
        this.floatBanner(e.x, e.y, `${m.name} ${"★".repeat(e.stars)}`, "#ffd86b", "#4a2d00");
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
          strokeThickness: 2,
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
      if (e.status && !e.tick && STATUSES[e.status])
        this.statusPop(e.x, e.y - 70, STATUSES[e.status], false);
      if (e.tick) e.icon = STATUSES[e.status]?.icon;
      this.fx.hit(
        e,
        source?.x,
        monster || actor,
        e.targetId === state?.self.id,
      );
      if (e.double && e.actorId === state?.self.id)
        this.statusPop(e.x, e.y - 105, { icon: "➶", name: "ศรคู่", color: "#9ff0b8" }, false);
    } else {
      const cls = e.class || this.actors.get(e.actorId)?.target.class,
        kind = {
          swordsman: ["swing", "slash"],
          archer: ["arrow", "volley"],
          mage: ["cast", "spell"],
          priest: ["holy", "smite"],
        }[cls] || ["swing", "slash"];
      sfx(
        kind[e.skill ? 1 : 0],
        { volume: e.actorId === state?.self.id ? 1 : 0.35 },
        e.actorId === state?.self.id ? 0.02 : 0.1,
      );
      if (e.skill === 5) {
        if (e.actorId === state?.self.id) showUltimateImpact(e.class);
        return;
      }
      this.fx.attack(e);
      // Double strafe: the second arrow follows right behind the first.
      if (e.double) this.time.delayedCall(90, () => this.fx.attack({ ...e, y: e.y + 12, echo: true }));
    }
  }
  showDungeonSigns(area, signs) {
    this.updateDungeonProps ??= createDungeonProps(this);
    this.updateDungeonProps(area, signs);
  }

  drawDungeonHazards(time) {
    const g = this.telegraphs,
      d = state.dungeon;
    this.dangerHint.setVisible(false);
    // Cast name and time sit in the HUD under the boss bar (orange), so the
    // ground around the hero stays clear; the ring on the floor shows where.
    const cast = document.getElementById("cast-warning");
    let castText = "";
    const showCast = () => {
      if (cast.textContent !== castText) cast.textContent = castText;
      cast.hidden = !castText;
    };
    if (!d || d.clear) return showCast();
    const mechText = d.mech ? this.drawBossMechanic(d.mech, time) : "";
    const exposed = d.enemies.find((e) => e.boss && time < e.exposedUntil);
    if (exposed) {
      g.lineStyle(3, 0x8ef6e5, 0.95);
      g.strokeEllipse(exposed.x, exposed.y - 3, 156, 28);
    }
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
    if (mechText) castText = mechText;
    else if (hint)
      castText = `${hint.crystal ? "คริสตัลปะทุ" : "บอสทุบพื้น"} · ${Math.max(0, hint.impactAt - time).toFixed(1)} วิ · กระโดดหรือเดินหลบวง`;
    else if (exposed) castText = "บอสเสียหลัก · ตีสวน +50%";
    showCast();
  }
  // Boss mechanic warnings and effects; returns the line for the cast bar.
  drawBossMechanic(m, time) {
    const g = this.telegraphs,
      top = this.mechTop,
      G = WORLD.ground,
      view = this.cameras.main.worldView,
      left = view.x - 40,
      right = view.x + view.width + 40,
      ceil = view.y - 60,
      info = MECHANICS[m.kind],
      secs = (n) => Math.max(0, n).toFixed(1);
    if (m.kind === "rocks" || m.kind === "lightning") {
      const rock = m.kind === "rocks",
        color = rock ? 0xff9a5a : 0xfff07a;
      let next = Infinity;
      for (const s of m.strikes) {
        const until = s.impactAt - time;
        if (until > 0) {
          next = Math.min(next, until);
          const p = Phaser.Math.Clamp((time - m.startedAt) / (s.impactAt - m.startedAt), 0, 1),
            locked = !rock && until < 0.7;
          g.fillStyle(color, 0.05 + p * 0.08);
          g.fillRect(s.x - s.radius * 0.45, ceil, s.radius * 0.9, G - ceil);
          g.fillStyle(color, 0.14 + p * 0.26);
          g.fillEllipse(s.x, G - 3, s.radius * 2, 22);
          g.lineStyle(locked ? 3 : 2, color, 0.95);
          g.strokeEllipse(s.x, G - 3, s.radius * 2, 22);
          g.strokeEllipse(s.x, G - 3, s.radius * 2 * (1.6 - 0.6 * p), 22 * (1.6 - 0.6 * p));
          if (rock && until < 0.8) {
            const f = 1 - until / 0.8,
              y = ceil + (G - 24 - ceil) * f * f;
            top.fillStyle(0x6b5a4a, 1);
            top.fillCircle(s.x, y, 24);
            top.fillStyle(0x8e7a63, 1);
            top.fillCircle(s.x - 7, y - 7, 11);
            top.lineStyle(3, 0x2c241d, 1);
            top.strokeCircle(s.x, y, 24);
          }
        } else if (until > -0.35) {
          const a = 1 + until / 0.35;
          if (rock) {
            top.fillStyle(0x6b5a4a, a);
            for (const dx of [-26, -9, 8, 24]) top.fillCircle(s.x + dx, G - 8 - Math.abs(dx) * 0.2, 9);
          } else {
            const pts = [];
            for (let y = ceil, k = 0; y < G; y += 70, k++)
              pts.push(new Phaser.Math.Vector2(s.x + (k % 2 ? 18 : -18) * Math.sin(s.x + k), y));
            pts.push(new Phaser.Math.Vector2(s.x, G - 4));
            top.lineStyle(9, 0xfff07a, a * 0.5);
            top.strokePoints(pts);
            top.lineStyle(3, 0xffffff, a);
            top.strokePoints(pts);
            top.fillStyle(0xfff6b0, a * 0.6);
            top.fillEllipse(s.x, G - 4, s.radius * 2.2, 26);
          }
        }
      }
      return next < Infinity ? `${info.icon} ${info.name} · ${secs(next)} วิ · ${info.hint}` : "";
    }
    if (m.kind === "spikes") {
      const charging = time < m.impactAt,
        p = Phaser.Math.Clamp((time - m.startedAt) / (m.impactAt - m.startedAt), 0, 1);
      for (let k = Math.floor((left - m.phase) / SPIKE_BAND); m.phase + k * SPIKE_BAND < right; k++) {
        if (((k % 2) + 2) % 2) continue;
        const x0 = m.phase + k * SPIKE_BAND;
        if (charging) {
          g.fillStyle(0xff6b5a, 0.12 + p * 0.25);
          g.fillRect(x0, G - 8, SPIKE_BAND, 12);
          g.lineStyle(2, 0xff8a6b, 0.9);
          g.strokeRect(x0, G - 8, SPIKE_BAND, 12);
        }
        for (let x = x0 + 10; x < x0 + SPIKE_BAND - 8; x += 22) {
          const h = charging ? 6 + p * 10 : 50 + Math.sin(x * 0.7) * 16;
          (charging ? g : top).fillStyle(charging ? 0xffb08f : 0xd9c7ff, charging ? 0.55 : 0.95);
          (charging ? g : top).fillTriangle(x - 8, G, x, G - h, x + 8, G);
        }
      }
      return charging ? `${info.icon} ${info.name} · ${secs(m.impactAt - time)} วิ · ${info.hint}` : "";
    }
    // Flood: a dashed line shows where the water will reach, then it rises.
    const width = right - left;
    if (time < m.riseAt) {
      const p = Phaser.Math.Clamp((time - m.startedAt) / (m.riseAt - m.startedAt), 0, 1);
      g.lineStyle(2, 0x6fc8ff, 0.5 + 0.4 * Math.abs(Math.sin(time * 6)));
      for (let x = left; x < right; x += 36) g.lineBetween(x, WATER_Y, x + 20, WATER_Y);
      g.fillStyle(0x2f7fd0, 0.18 + p * 0.2);
      g.fillRect(left, G - 4 - p * 10, width, 14 + p * 10);
      return `${info.icon} น้ำกำลังท่วม! ${secs(m.riseAt - time)} วิ · ${info.hint}`;
    }
    const rise = Phaser.Math.Clamp((time - m.riseAt) / 0.6, 0, 1),
      fall = Phaser.Math.Clamp((m.endsAt - time) / 0.6, 0, 1),
      level = G + 10 - (G + 10 - WATER_Y) * Math.min(rise, fall);
    top.fillStyle(0x1f6fc4, 0.5);
    top.fillRect(left, level, width, G + 400 - level);
    top.lineStyle(3, 0xa8e4ff, 0.85);
    const wave = [];
    for (let x = left; x <= right; x += 24)
      wave.push(new Phaser.Math.Vector2(x, level + Math.sin(x * 0.03 + time * 4) * 4));
    top.strokePoints(wave);
    return `${info.icon} ${info.name} · ยืนบนชั้นอีก ${secs(m.endsAt - time)} วิ`;
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
    this.mechTop.clear();
    this.drawDungeonHazards(serverTime);
    this.townNpcs.update(
      time,
      state.area === "town",
      this.reducedMotion,
      state.self,
    );
    for (const [id, a] of this.actors) {
      const p = a.target;
      if (p.ambient) Object.assign(p, wandererPose(p, serverTime));
      // Specialization costume when its art exists, else the class look.
      const skin = a.skins.find((key) => this.spriteSets.has(key)),
        spriteSet = this.spriteSets.get(skin),
        pose = animateHero(a.image, p, serverTime, this.knightAtlas && !spriteSet);
      // Heroes with painted sets stay hidden until the set arrives, so the old
      // placeholder sheet never flashes; it shows only if loading fails.
      a.image.setVisible(
        !!spriteSet ||
          !a.skins.some((key) => this.sprites.listed("sets", key)) ||
          time - a.bornAt > ART_WAIT_MS,
      );
      if (spriteSet) {
        playSpriteSet(a.image, spriteSet, p, pose, serverTime);
        if (!a.image._spriteStill) a.image.setAngle(0);
        if (spriteSet.facing < 0) a.image.toggleFlipX();
      }
      const point = p.ambient ? p : sampleMotion(
        a.history,
        serverTime - (id === state.self.id ? 0.05 : 0.08),
      );
      a.image.setPosition(point.x, point.y);
      animateHeroBody(a, p, pose, serverTime, time);
      updateDivineAura(this, a, p, time);
      this.fx.applyKick(a, a.image);
      a.rim.sync(a.image);
      // Paper-doll heroes: worn gear stacked over the bare body.
      if (spriteSet?.layers)
        playLayers(this, a, a.image, spriteSet, gearDress(p, spriteSet), this.sprites);
      else if (a.layers) a.layers.destroy();
      // Name sits just above the head: painted sets know their height.
      const headroom = spriteSet ? spriteSet.height + 24 : 158;
      a.label.setScale(Math.max(1, 0.85 / (this.cameras.main.zoom / this.renderScale())));
      a.label.setPosition(a.image.x, a.image.y - (p.hp <= 0 ? 60 : headroom));
      effectRow(
        this,
        a,
        p.hp > 0 && state.area === "dungeon" ? activeEffects(p, serverTime) : [],
        a.image.x,
        a.image.y - headroom - (id === state.self.id ? 34 : 12),
      );
      const visibleGear = Object.values(p.equipment || {})
        .map((itemId) => GEAR[itemId])
        .filter(Boolean);
      const weapon = visibleGear.find((item) => item.slot === "weapon"),
        rarityRank = { common: 0, rare: 1, epic: 2, legendary: 3, divine: 4 },
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
          divine: "#a9fff1",
        }[best?.rarity || "common"];
      // Just the enhancement level, in the best item's rarity colour, beside
      // the name: text glyphs for weapon/armour read as clutter in the field.
      // setColor re-rasterises the text every call: only on change.
      if (a.gearColor !== gearColor) a.gearBadge.setColor((a.gearColor = gearColor));
      a.gearBadge
        .setText(p.upgrade && weapon ? `+${p.upgrade}` : "")
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
      // Max-enhanced weapon: golden aura at the feet (on the ground only).
      updateEnhanceAura(
        this,
        a,
        p.hp > 0 && !!weapon && p.upgrade >= AURA_LEVEL && p.grounded,
        a.image.x,
        p.y - 2,
        time,
      );
      // Weapon +11 to +15: coloured light orbiting the body with bubbles.
      updateSetGlow(this, a, p.hp > 0 ? p.glow || 0 : 0, a.image.x, p.y, headroom, time);
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
    // Low/Medium presets: monsters well outside the camera only keep their
    // position, label and bar in step; animation work resumes 300 px before
    // they come into view.
    const cam = this.cameras.main,
      cullX = this.quality?.cull || state?.dungeon?.mine ? cam.worldView.width / 2 + 300 : Infinity,
      cullY = state?.dungeon?.mine ? cam.worldView.height / 2 + 220 : Infinity;
    let mineFocus = null, focusDistance = Infinity;
    if (state?.dungeon?.mine) for (const m of this.monsters.values()) {
      const distance = Math.hypot(m.target.x - state.self.x, m.target.y - state.self.y);
      if (m.target.hp > 0 && distance < focusDistance && distance < 340) {
        mineFocus = m; focusDistance = distance;
      }
    }
    for (const m of this.monsters.values()) {
      const e = m.target;
      // Crowded mine floors keep one readable name instead of thirty overlapping labels.
      m.label.setVisible(!state?.dungeon?.mine || e.boss || m === mineFocus);
      if (Math.abs(m.image.x - cam.midPoint.x) > cullX || Math.abs(m.image.y - cam.midPoint.y) > cullY) {
        const point = sampleMotion(m.history, serverTime - 0.08);
        m.image.setPosition(point.x, point.y);
        m.label.setPosition(point.x, point.y - m.size - 14);
        m.bar.setPosition(point.x, point.y);
        continue;
      }
      const mpose = animateSlime(
          m.image,
          e,
          serverTime,
          this.slimeAtlas,
          m.size,
        ),
        mset = this.monsterSets.get(e.type);
      // As with heroes: no old placeholder art while the painted set loads.
      m.image.setVisible(
        !!mset || !this.sprites.listed("monsters", e.type) || time - m.bornAt > ART_WAIT_MS,
      );
      if (e.world && mset) {
        // World bosses: their own painted set, scaled up to giant size.
        playMonsterSet(m.image, mset, e, mpose, serverTime);
        const giant = (e.grand ? 1.35 : 1) * WORLD_BOSS_SCALE;
        m.image._spriteScale *= giant; // creature-fx re-applies this scale
        m.image.setScale(m.image._spriteScale).setVisible(true);
        m.size = mset.height * giant + 12;
      } else if (e.world) {
        m.image.setTexture("world-titan").setOrigin(.5, 1).setVisible(true)
          .setFlipX((e.direction || 1) > 0);
      } else if (mset) {
        // A set that finished loading after spawn: adopt its size.
        if (!m.setSized) {
          m.setSized = true;
          m.size =
            (mset.height + 12) *
            (e.elite ? 1.25 : 1) *
            (traitOf(e).scale || 1) *
            (e.night ? NIGHT_BOSS.scale : 1);
          m.shadow?.setSize(m.size * 0.62, m.size * 0.13);
        }
        playMonsterSet(m.image, mset, e, mpose, serverTime);
      }
      const point = sampleMotion(m.history, serverTime - 0.08);
      m.image.setPosition(point.x, point.y);
      animateMonsterBody(m, e, serverTime, time, this.slimeAtlas);
      const effects = activeEffects(e, serverTime),
        statusTint = effectTint(effects);
      if (serverTime - (e.hitAt || 0) > 0.18 && (statusTint || !state.dungeon?.training)) {
        // Status colours win; frenzied variants flush red below half health.
        m.image.setTint(
          statusTint ?? (state.dungeon?.mine ? floorInfo(state.dungeon).tint : undefined) ??
            (traitOf(e).frenzy && e.hp <= e.maxHp * 0.5
              ? 0xff7a6a
              : BOSSES[e.type] || EXTRA_MONSTERS[e.type] || e.world ? 0xffffff : floorInfo(state.dungeon).tint),
        );
      }
      this.fx.applyKick(m, m.image);
      if (e.boss)
        m.label.setText(
          floorInfo(state.dungeon).boss +
            (e.hp <= e.maxHp * 0.5 ? " · คลั่ง!" : ""),
        );
      m.label.setScale(Math.max(1, 0.85 / (this.cameras.main.zoom / this.renderScale())));
      // Headroom from the sprite as drawn: m.size can overshoot (the world
      // boss's art is drawn far smaller than its 3.2x size), which put its
      // name and bar off the top of the screen.
      const head = Math.round(Math.min(m.size, Math.abs(m.image.displayHeight) + 16));
      if (head !== m.head) {
        m.head = head;
        m.barHp = null;
      }
      m.label.setPosition(m.image.x, m.image.y - head - 14);
      // Stunned monsters get bobbing stars; the row lists every status.
      effectRow(
        this,
        m,
        effects,
        m.image.x,
        m.image.y - head - 26 + (effects.some((s) => s.type === "stun") ? Math.sin(time * 0.012) * 3 : 0),
      );
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
          top = -(m.head ?? m.size) + 4,
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
        this.telegraphs.fillStyle(BOSSES[e.type]?.color || 0xff725b, 0.08 + progress * 0.25);
        this.telegraphs.fillEllipse(
          e.action.kind === "slam" ? e.action.x : e.x + e.action.direction * 42,
          e.y - 3,
          e.action.kind === "slam" ? e.action.radius * 2 : e.boss ? 240 : 160,
          30,
        );
        this.telegraphs.lineStyle(2, BOSSES[e.type]?.color || 0xff9474, 0.8);
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
        lead = this.portrait && state.area !== "town" && ["archer", "mage", "priest"].includes(state.self.class)
          ? (me.target.direction || state.self.direction || 1) * 90
          : Phaser.Math.Clamp((me.target.vx || 0) * 0.35, -110, 110);
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
    this.nightSky.update(state, time, () =>
      toast("ราตรีมาเยือน… ถ้ำลึกลับปรากฏใต้ต้นไม้ใหญ่ทางซ้ายของเมือง"),
    );
    this.parallax.setDark(state?.area === "town" ? state.sky?.dark || 0 : 0);
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
$("#delete-hero").onclick = async () => {
  const character = characters.find((c) => c.id === lobbyCharacterId);
  if (!character || !confirm(`ลบตัวละคร “${character.name}” ถาวรหรือไม่?\nเลเวล เงิน ไอเทม และร้านค้าของตัวละครนี้จะถูกลบ และกู้คืนไม่ได้`)) return;
  const button = $("#delete-hero");
  button.disabled = true;
  try {
    await api(`characters/${encodeURIComponent(character.id)}/delete`, {});
    await refreshAccount();
    toast(`ลบตัวละคร ${character.name} แล้ว`);
  } catch (e) {
    toast(e.message, true);
  } finally {
    button.disabled = false;
  }
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
  const jobs = JOBS.filter((name) => CLASSES[name]);
  job = jobs[(jobs.indexOf(job) + direction + jobs.length) % jobs.length];
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
