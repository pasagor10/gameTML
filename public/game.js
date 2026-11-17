import { sampleMotion } from "/shared/smoothing.js";
import { ACTIONS } from "/shared/motion.js";
import {
  registerMotionAtlas,
  animateHero,
  animateSlime,
  monsterDeath,
} from "/combat-visuals.js?v=0.3.1";
import { createSelectionPreview } from "/selection-scene.js?v=0.2.2";
import { CLASSES, ITEMS, FLOORS, WORLD } from "/shared/config.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
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
  muted = true,
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
function heroStyle(c, g) {
  return `background-position:${JOBS.indexOf(c) * 50}% ${g === "female" ? 100 : 0}%`;
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
function tone(f = 440, d = 0.18, type = "sine", volume = 0.035) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, audio.currentTime + d);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + d);
  } catch {}
}
$("#sound").onclick = () => {
  muted = !muted;
  $("#sound").textContent = muted ? "♫ เปิดเสียง" : "♫ ปิดเสียง";
  tone(392, 0.7);
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
  $("#saved-characters").innerHTML = characters
    .map(
      (c) =>
        `<button data-resume="${c.id}">${CLASSES[c.class].icon} ${escape(c.name)} · Lv.${c.level} ↗</button>`,
    )
    .join("");
  $$("[data-resume]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = characters.find((c) => c.id === b.dataset.resume);
        selectedId = c.id;
        job = c.class;
        gender = c.gender;
        showPrologue();
      }),
  );
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
  const c = CLASSES[job],
    detail = heroDescriptions[job];
  $(".hero-showcase").style.setProperty(
    "--hero-accent",
    "#" + c.color.toString(16).padStart(6, "0"),
  );
  $("#selected-class").textContent = c.name;
  $("#selected-epithet").textContent = detail.title;
  $("#selected-lore").textContent = detail.lore;
  $(".hero-fallback").style.cssText = heroStyle(job, gender);
  $("#hero-stats").innerHTML =
    `<div class="stats-heading"><span>พลังเริ่มต้น</span><small>BASE ATTRIBUTES</small></div><p class="class-role">${detail.role}</p>${[
      ["HP", "พลังชีวิต", c.hp, 180],
      ["MP", "พลังเวท", c.mp, 150],
      ["ATK", "พลังโจมตี", c.atk, 35],
      ["DEF", "พลังป้องกัน", c.def, 12],
    ]
      .map(
        ([key, label, value, max]) =>
          `<div class="attribute"><div><span>${key} <small>${label}</small></span><b>${value}</b></div><div class="attribute-track"><i style="width:${(value / max) * 100}%"></i></div></div>`,
      )
      .join(
        "",
      )}<div class="signature-skill"><small>ความสามารถอาชีพ</small><p>${detail.skill}</p></div>`;
  $("#class-cards").innerHTML = JOBS.map(
    (name, i) =>
      `<button class="hero-card ${name === job ? "active" : ""}" data-class="${name}" aria-pressed="${name === job}" aria-label="เลือก${CLASSES[name].name}"><span class="hero-art" style="${heroStyle(name, gender)}" aria-hidden="true"></span><span class="class-card-copy"><small>${eng[i]}</small><strong>${CLASSES[name].name}</strong></span><span class="selected-mark" aria-hidden="true">◆</span></button>`,
  ).join("");
  $$("[data-gender]").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.gender === gender)),
  );
  selectionPreview?.setHero(job, gender);
  $$("[data-class]").forEach(
    (b) =>
      (b.onclick = () => {
        job = b.dataset.class;
        renderCards();
        tone(550, 0.1);
      }),
  );
}
$$("[data-gender]").forEach(
  (b) =>
    (b.onclick = () => {
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
refreshAccount().catch(() => toast("เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองใหม่", true));
$("#start").onclick = async () => {
  const b = $("#start");
  b.disabled = true;
  try {
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
  activePanel = panel || "modal";
  keys.clear();
  touchDirection = 0;
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").classList.remove("hidden");
  if (socket?.connected)
    socket.emit("player:input", { direction: 0, seq: ++seq, jump: false });
}
function closeModal() {
  activePanel = null;
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
function emit(event, data = {}) {
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
  return emit(event, { ...data, key: crypto.randomUUID() });
}
function enterGame() {
  $("#prologue").classList.add("hidden");
  $("#landing").classList.add("hidden");
  $("#game-screen").classList.remove("hidden");
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
  $("#avatar").style.cssText = heroStyle(p.class, p.gender);
  $("#hp-fill").style.width = (p.hp / p.maxHp) * 100 + "%";
  $("#mp-fill").style.width = (p.mp / p.maxMp) * 100 + "%";
  $("#hp-label").textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
  $("#mp-label").textContent = `MP ${Math.floor(p.mp)} / ${p.maxMp}`;
  $("#exp-fill").style.width = (p.exp / (p.level * 80)) * 100 + "%";
  $("#gold").textContent = p.gold.toLocaleString();
  $("#hp-potions").textContent = d?.training
    ? "ยา HP ∞"
    : "ยา HP ×" + p.inventory.hp;
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
      ? `ชั้น ${d.floor} / 3 · ด่าน ${d.stage} / 3 · ${d.stage === 3 ? "BOSS STAGE" : d.stage === 2 ? "ELITE STAGE" : "MONSTER STAGE"}`
      : "เมืองกลาง · CH.1 · เขตปลอดภัย";
  $("#map-title").textContent = d?.training
    ? "สนามฝึกผู้พิทักษ์"
    : d
      ? "ถ้ำหลวง · ชั้น " + d.floor
      : "เมืองหน้าถ้ำหลวง";
  $("#online-count").textContent = "● " + state.online + " ออนไลน์";
  $("#map-dot").setAttribute("cx", String(8 + (p.x / WORLD.width) * 200));
  $("#auto-button").classList.toggle("on", p.auto);
  $("#auto-button small").textContent = p.auto ? "เปิด" : "ปิด";
  $("#quest-description").textContent = d?.training
    ? "ฝึกเดิน กระโดด ฟัน และ Q/W/E · หลบเมื่อสไลม์ขึ้นวงเตือน"
    : d
      ? d.clear
        ? "เส้นทางเปิดแล้ว! เดินหน้าสู่ด่านต่อไป"
        : `กำจัด${d.stage === 3 ? FLOORS[d.floor - 1].boss : "มอนสเตอร์ทั้งหมด"} · เหลือ ${d.enemies.length} ตัว`
      : p.quest >= 3
        ? "ตำนานบทแรกสำเร็จ! กลับไปท้าทายดันเจียนได้อีกครั้ง"
        : "คุยกับผู้ใหญ่คำ แล้วเข้าสู่ประตูถ้ำหลวง";
  $("#quest-counter").textContent = `ดันเจียนที่พิชิต ${p.quest} / 3`;
  $("#quest-fill").style.width = (p.quest / 3) * 100 + "%";
  $("#stage-clear").classList.toggle(
    "hidden",
    !d?.clear || d?.training || p.hp <= 0 || p.auto,
  );
  $("#next-stage").textContent =
    d?.stage === 3 ? "รับชัยชนะ · กลับเมือง ➜" : "เข้าสู่ด่านต่อไป ➜";
  $("#death").classList.toggle("hidden", p.hp > 0);
  for (let i = 1; i <= 3; i++) {
    const button = $(`[data-action="skill${i}"] i`),
      remaining = ACTIONS[i].cooldown - (state.time - (p.cooldowns[i] || 0));
    const skillButton = button.parentElement;
    skillButton.disabled =
      p.hp <= 0 ||
      state.area !== "dungeon" ||
      p.mp < ACTIONS[i].mp ||
      remaining > 0;
    skillButton.title = p.mp < ACTIONS[i].mp ? "MP ไม่พอ" : "";
    button.style.display = remaining > 0 ? "grid" : "none";
    button.textContent = remaining > 0 ? Math.ceil(remaining) : "";
  }
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
}
function nearby() {
  if (!state) return null;
  const p = state.self;
  if (state.area === "dungeon")
    return state.dungeon.clear ? { id: "next", label: "เข้าสู่ด่านต่อไป" } : null;
  const npc = WORLD.npcs.find((n) => Math.abs(n.x - p.x) < 105);
  if (npc) return { ...npc, label: npc.name + " · " + npc.role };
  if (Math.abs(p.x - WORLD.portal) < 140)
    return { id: "portal", label: "เข้าสู่ดันเจียนถ้ำหลวง" };
  const shop = state.shops.find((s) => Math.abs(s.x - p.x) < 65);
  if (shop) return { id: "market", label: "เลือกซื้อของจากร้านผู้เล่น" };
  return null;
}
function interact() {
  const n = nearby();
  if (!n) return toast("เข้าใกล้ NPC หรือประตู แล้วกด F");
  if (n.id === "next") emit("dungeon:next");
  else if (n.id === "portal") showPanel("dungeon");
  else showPanel(n.id);
}
function action(name) {
  if (!state || activePanel) return;
  if (name === "attack") emit("player:attack", { skill: 0 });
  else if (name.startsWith("skill"))
    emit("player:attack", { skill: Number(name.slice(-1)) });
  else if (name === "hp") emit("player:potion", { type: "hp" });
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
function showPanel(panel) {
  if (!state) return;
  const p = state.self;
  const row = (icon, name, desc, button) =>
    `<div class="item-row"><span>${icon}</span><div><strong>${escape(name)}</strong><small>${escape(desc)}</small></div>${button || ""}</div>`;
  const btn = (data, label) => `<button ${data}>${label}</button>`;
  if (panel === "inventory") {
    modal(
      "กระเป๋านักเดินทาง",
      `<p>ทอง ${p.gold} · อาวุธ +${p.upgrade} · ${p.weapon ? "สวมอาวุธผู้พิทักษ์" : "อาวุธเริ่มต้น"} · ${p.armor ? "สวมเกราะนักเดินทาง" : "ชุดเริ่มต้น"}</p>${row("🧪", "ยาฟื้นฟู HP ×" + p.inventory.hp, "ฟื้นฟู 90 HP", btn('data-potion="hp"', "ใช้ยา"))}${row("💧", "ยาฟื้นฟู MP ×" + p.inventory.mp, "ฟื้นฟู 80 MP", btn('data-potion="mp"', "ใช้ยา"))}<div class="inventory-grid">${Array.from(
        { length: 40 },
        (_, i) => {
          const items = [
            ["⚔", p.upgrade ? "+" + p.upgrade : "1"],
            ["🛡", p.armor ? "1" : "—"],
            ["🧪", p.inventory.hp],
            ["💧", p.inventory.mp],
            ["💎", p.inventory.ore],
          ];
          return `<div class="inventory-slot">${items[i]?.[0] || ""}<small>${items[i]?.[1] ?? ""}</small></div>`;
        },
      ).join(
        "",
      )}</div><p class="hint">เดโมใช้อาวุธและเกราะอัตโนมัติเมื่อซื้อจาก NPC · วัตถุดิบดรอปจากมอนสเตอร์</p>`,
      "inventory",
    );
    $$("[data-potion]").forEach(
      (b) =>
        (b.onclick = async () => {
          await emit("player:potion", { type: b.dataset.potion });
        }),
    );
  } else if (panel === "potion" || panel === "weapon") {
    const items =
      panel === "potion" ? ["hp", "mp"] : ["weapon", "armor", "ore"];
    modal(
      panel === "potion" ? "มีรา · ร้านปรุงยา" : "อริน · อาวุธและอุปกรณ์",
      `<p>ยินดีต้อนรับผู้กล้า · ทองของเจ้า ${p.gold}</p>${items.map((id) => row(ITEMS[id].icon, ITEMS[id].name, id === "weapon" ? "เพิ่ม ATK 10 · สวมให้อัตโนมัติ" : id === "armor" ? "เพิ่ม HP 30 · ป้องกันเพิ่ม" : id === "ore" ? "วัตถุดิบตีบวก" : "ใช้ฟื้นฟูระหว่างต่อสู้", btn(`data-buy="${id}"`, ITEMS[id].price + " ◈"))).join("")}`,
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
        tone(r.success ? 800 : 150, 0.5);
        closeModal();
      }
    };
  } else if (panel === "elder" || panel === "quest") {
    modal(
      "ผู้ใหญ่คำ · เสียงเรียกจากขุนเขา",
      `<p>“เจ้าได้ยินเสียงนั้นไหม… ตั้งแต่แสงสีฟ้าส่องออกจากถ้ำ สัตว์ป่าก็ไม่เหมือนเดิมอีกเลย ผู้พิทักษ์ทั้งสามชั้นอาจรู้คำตอบ”</p>${FLOORS.map((f, i) => row(["🦇", "🪨", "🐍"][i], "ชั้น " + (i + 1) + " · " + f.name, `${f.boss} · 3 ด่าน · ${p.quest > i ? "พิชิตแล้ว ✓" : "ยังไม่พิชิต"}`)).join("")}<button id="elder-heal" class="primary-button">พักฟื้น HP / MP เต็ม</button><p class="hint">เล่นบทเปิดครบ 3 ชั้นเพื่อจบเดโม · โลกฉบับเต็มวางแผนไว้ 100 ชั้น</p>`,
    );
    $("#elder-heal").onclick = () => emit("player:heal");
  } else if (panel === "dungeon") {
    modal(
      "ประตูถ้ำหลวง · เลือกดันเจียน",
      `<p>แต่ละชั้นมี 3 ด่าน: มอนสเตอร์ → อีลิท → บอส<br>ปาร์ตี้สูงสุด 3 คน สมาชิกต้องกดพร้อมก่อนหัวหน้าเริ่ม</p>${FLOORS.map((f, i) => `<div class="dungeon-card"><h3>0${i + 1} / ${f.name}</h3><p>บอส: ${f.boss} · 3 ด่าน · ${i === 0 ? "เริ่มต้นการผจญภัย" : "ผ่านชั้น " + i + " ก่อน"}</p><button data-floor="${i + 1}" ${p.unlocked < i + 1 ? "disabled" : ""}>${p.unlocked < i + 1 ? "🔒 ยังไม่ปลดล็อก" : "เข้าสู่ดันเจียน ➜"}</button></div>`).join("")}`,
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
  } else if (panel === "market") {
    modal(
      "ตลาดนักเดินทาง",
      `<p>ร้านค้าจากผู้เล่นจริง · ไอเทมถูกเก็บเข้าร้านบนเซิร์ฟเวอร์</p>${state.shops.length ? state.shops.map((s) => row(ITEMS[s.item]?.icon, s.name, `${s.ownerName} · ${ITEMS[s.item]?.name} · เหลือ ${s.qty}`, btn(`data-shop-buy="${s.id}"`, s.price + " ◈"))).join("") : "<p>ยังไม่มีร้านค้า ลองตั้งร้านแรกของเมืองได้เลย</p>"}<button id="open-own-shop" class="primary-button">ตั้งร้านของฉัน</button>`,
    );
    $$("[data-shop-buy]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const r = await transaction("shop:buy", { id: b.dataset.shopBuy });
          if (r) closeModal();
          else b.disabled = false;
        }),
    );
    $("#open-own-shop").onclick = () => showPanel("shop");
  } else if (panel === "shop") {
    const existing = state.shops.find((s) => s.owner === p.id);
    if (existing) {
      modal(
        "ร้านค้าของฉัน",
        `<h3>${escape(existing.name)}</h3><p>${ITEMS[existing.item]?.name} · เหลือ ${existing.qty} · ราคา ${existing.price} ทอง<br>ร้านเปิดต่อเมื่อออกจากเกมได้</p><button id="close-shop" class="primary-button">ปิดร้านและรับสินค้าที่เหลือคืน</button>`,
      );
      $("#close-shop").onclick = async () => {
        const r = await transaction("shop:close");
        if (r) closeModal();
      };
    } else {
      modal(
        "ตั้งร้านในเมือง",
        `<p>ตั้งได้หนึ่งร้านต่อบัญชี ร้านยังขายได้เมื่อออกจากเกม · ไอเทมวางขายจะออกจากกระเป๋า</p><label>ชื่อร้าน<input id="shop-name" maxlength="35" placeholder="ร้านของผู้กล้า"></label><label>สินค้า<select id="shop-item">${["hp", "mp", "ore"].map((id) => `<option value="${id}">${ITEMS[id].name} · มี ${p.inventory[id]}</option>`).join("")}</select></label><label>จำนวน<input id="shop-qty" type="number" value="1" min="1" max="999"></label><label>ราคาต่อชิ้น (Gold)<input id="shop-price" type="number" value="20" min="1" max="100000"></label><button id="create-shop" class="primary-button">เปิดร้าน</button>`,
      );
      $("#create-shop").onclick = async () => {
        const r = await transaction("shop:create", {
          name: $("#shop-name").value.trim(),
          item: $("#shop-item").value,
          qty: Number($("#shop-qty").value),
          price: Number($("#shop-price").value),
        });
        if (r) closeModal();
      };
    }
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
      `<p>เกมบันทึกตัวละคร เงิน อุปกรณ์ และดันเจียนบนเซิร์ฟเวอร์อัตโนมัติ<br>บัญชีผู้มาเยือนผูกกับคุกกี้ในเบราว์เซอร์นี้</p><button id="toggle-sound" class="primary-button">${muted ? "เปิดเสียงเอฟเฟกต์" : "ปิดเสียงเอฟเฟกต์"}</button><button id="back-selection" class="text-button">กลับหน้าเลือกตัวละคร</button><p class="hint">Demo v0.3 · นักดาบหญิงและสไลม์มีเฟรมแอนิเมชันชุดแรก · ตัวอื่นยังใช้ภาพ idle · เป้าหมาย 20–30 คนต่อห้องยังไม่ได้ยืนยันด้วย load test</p>`,
    );
    $("#toggle-sound").onclick = () => {
      muted = !muted;
      tone(440, 0.3);
      closeModal();
    };
    $("#back-selection").onclick = () => {
      socket.disconnect();
      state = null;
      phaser?.loop.sleep();
      $("#game-screen").classList.add("hidden");
      $("#landing").classList.remove("hidden");
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
}
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
  if (e.code === "KeyI") showPanel("inventory");
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  touchDirection = 0;
  touchAttack = false;
});
const touchMoves = new Map();
const updateTouch = () => {
  touchDirection = [...touchMoves.values()].at(-1) || 0;
};
$$("[data-direction]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    touchMoves.set(e.pointerId, Number(b.dataset.direction));
    updateTouch();
  };
  for (const n of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(n, (e) => {
      touchMoves.delete(e.pointerId);
      updateTouch();
    });
});
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
    running:
      !!touchDirection || keys.has("ShiftLeft") || keys.has("ShiftRight"),
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
    this.load.image("town", "/assets/town.png");
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
    this.knightAtlas = registerMotionAtlas(this, "knight-motion", 8);
    this.slimeAtlas = registerMotionAtlas(this, "slime-motion", 6);
    this.telegraphs = this.add.graphics().setDepth(6);
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.cameras.main.setBackgroundColor("#234b68");
    this.back = this.add
      .image(0, -180, "town")
      .setOrigin(0)
      .setDisplaySize(2400, 1000)
      .setDepth(-20);
    this.decor = this.add.graphics().setDepth(-5);
    this.effectLayer = this.add.graphics().setDepth(30);
    this.npcs = [];
    for (const [i, n] of WORLD.npcs.entries()) {
      const image = this.add
        .image(n.x, 600, "heroes", [2, 5, 0, 0][i])
        .setOrigin(0.5, 1)
        .setDisplaySize(98, 98)
        .setDepth(7);
      const label = this.add
        .text(n.x, 466, n.name + "\n" + n.role, {
          fontFamily: "Noto Sans Thai",
          fontSize: "13px",
          color: "#fff1b5",
          align: "center",
          stroke: "#17384e",
          strokeThickness: 4,
          backgroundColor: "#17354a99",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 0)
        .setDepth(15);
      this.npcs.push(image, label);
    }
    this.portal = this.add
      .ellipse(WORLD.portal, 518, 94, 150, 0x63eaff, 0.25)
      .setStrokeStyle(3, 0xb5faff, 0.8)
      .setDepth(3);
    this.portalGlow = this.add
      .ellipse(WORLD.portal, 518, 65, 125, 0x99f7ff, 0.2)
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
      .text(WORLD.portal, 417, "ถ้ำหลวง\nประตูสู่ดอยนางนอน", {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        align: "center",
        color: "#d4fbff",
        stroke: "#173756",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.makePlatforms();
    this.cameras.main.centerOn(380, 350);
    this.scale.on("resize", () => this.resize());
    this.resize();
    if (state) this.applySnapshot(state);
  }
  resize() {
    const w = this.scale.width,
      h = this.scale.height,
      zoom = w < 700 ? Math.max(0.6, h / 900) : Math.max(0.7, h / 800);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.setBounds(0, -100, 2400, 950);
  }
  makePlatforms() {
    this.decor.clear();
    const cave = state?.area === "dungeon";
    for (const p of WORLD.platforms) {
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
      this.decor.fillStyle(cave ? 0x95b3db : 0x83b952);
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
    if (!a) {
      const shadow = this.add
          .ellipse(p.x, p.y - 3, 65, 15, 0x102b3c, 0.35)
          .setDepth(6),
        image = this.add
          .image(p.x, p.y, "heroes", frame(p.class, p.gender))
          .setOrigin(0.5, 1)
          .setDisplaySize(125, 125)
          .setDepth(10),
        label = this.add
          .text(p.x, p.y - 142, p.name, {
            fontFamily: "Noto Sans Thai",
            fontSize: "12px",
            color: p.id === state.self.id ? "#fff0b5" : "#e4fff6",
            stroke: "#193c51",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(14);
      a = {
        image,
        label,
        shadow,
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
      this.lastArea = area;
      const town = s.area === "town";
      this.back.setTexture(town ? "town" : "cave");
      this.back.clearTint();
      if (!town)
        this.back.setTint([0xc1b9ff, 0x95dfff, 0x91d7ce][s.dungeon.floor - 1]);
      this.npcs.forEach((n) => n.setVisible(town));
      this.portalLabel.setVisible(town);
      this.portal.setVisible(town);
      this.portalGlow.setVisible(town);
      this.makePlatforms();
      this.cameras.main.centerOn(s.self.x, 340);
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
        const size = e.boss ? 210 : 95;
        const image = this.add
          .image(e.x, e.y, "monsters", types.indexOf(e.type))
          .setDisplaySize(size, size)
          .setOrigin(0.5, 1)
          .setDepth(8);
        const label = this.add
          .text(
            e.x,
            e.y - size - 15,
            e.boss ? FLOORS[s.dungeon.floor - 1].boss : "",
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
        this.monsters.set(e.id, m);
      }
      m.target = e;
      if (areaChanged || !m.history) m.history = [];
      m.history.push({
        time: s.time,
        x: e.x,
        y: e.y,
        vx: e.moving ? e.direction * (e.boss ? 75 : 90) : 0,
      });
      if (m.history.length > 8) m.history.shift();
    }
    for (const [id, m] of this.monsters)
      if (!eids.has(id)) {
        this.burst(m.image.x, m.image.y - 40, 0xc3a6ff, 8);
        if (areaChanged) m.image.destroy();
        else monsterDeath(this, m, this.slimeAtlas);
        m.label.destroy();
        m.bar.destroy();
        this.monsters.delete(id);
      }
    for (const e of s.dungeon?.events || []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (seen.size > 500) seen = new Set([...seen].slice(-200));
      this.effect(e);
    }
    const sh = JSON.stringify(s.shops.map((v) => [v.id, v.qty]));
    if (sh !== this.lastShops) {
      this.shopObjects.forEach((o) => o.destroy());
      this.shopObjects = [];
      for (const shop of s.shops) {
        const roof = this.add.graphics().setDepth(4);
        roof.fillStyle(0x6b4155);
        roof.fillRect(shop.x - 42, 550, 84, 38);
        roof.fillStyle(0xdd9fb8);
        roof.fillTriangle(shop.x - 58, 550, shop.x, 505, shop.x + 58, 550);
        roof.lineStyle(3, 0xe9c587);
        roof.strokeRect(shop.x - 42, 550, 84, 38);
        const label = this.add
          .text(shop.x, 487, shop.name, {
            fontFamily: "Noto Sans Thai",
            fontSize: "10px",
            color: "#fff2cd",
            stroke: "#193851",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(14);
        this.shopObjects.push(roof, label);
      }
      this.lastShops = sh;
    }
    this.shopObjects.forEach((o) => o.setVisible(s.area === "town"));
  }
  burst(x, y, color, count = 12) {
    if (this.children.length > 220) return;
    count = Math.min(12, count);
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2,
        r = 30 + Math.random() * 60,
        dot = this.add.circle(x, y, 2 + Math.random() * 3, color).setDepth(35);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        alpha: 0,
        scale: 0,
        duration: 450 + Math.random() * 300,
        onComplete: () => dot.destroy(),
      });
    }
  }
  effect(e) {
    if (e.kind === "damage") {
      this.burst(
        e.x,
        e.y + 35,
        e.amount < 0 ? 0xffa291 : 0xffe8a0,
        e.crit ? 10 : 5,
      );
      tone(e.amount < 0 ? 105 : 720, 0.055, "triangle", 0.012);
      const label = this.add
        .text(e.x, e.y, (e.crit ? "CRIT " : "") + e.amount, {
          fontFamily: "Noto Sans Thai",
          fontSize: e.crit ? "28px" : "22px",
          fontStyle: "bold",
          color: e.amount < 0 ? "#ffad9b" : e.crit ? "#ffe185" : "#f0f8ff",
          stroke: "#273047",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(40);
      this.tweens.add({
        targets: label,
        y: e.y - 65,
        alpha: 0,
        duration: 850,
        onComplete: () => label.destroy(),
      });
    } else {
      tone(e.skill ? 220 : 480, 0.13);
      const g = this.add.graphics().setDepth(25);
      g.lineStyle(e.skill ? 8 : 5, e.color, 0.9);
      const radius = e.skill ? 110 : 65;
      if (e.class === "archer") {
        g.fillStyle(e.color);
        g.fillTriangle(0, -5, 34, 0, 0, 5);
        g.x = e.x + e.direction * 40;
        g.y = e.y;
        g.scaleX = e.direction;
        this.tweens.add({
          targets: g,
          x: g.x + e.direction * (e.skill ? 600 : 410),
          alpha: 0,
          duration: 360,
          onComplete: () => g.destroy(),
        });
      } else if (e.class === "mage") {
        g.fillStyle(e.color, 0.6);
        g.fillCircle(0, 0, e.skill ? 26 : 15);
        g.lineStyle(3, 0xffffff, 0.8);
        g.strokeCircle(0, 0, e.skill ? 30 : 18);
        g.x = e.x;
        g.y = e.y;
        this.tweens.add({
          targets: g,
          x: e.x + e.direction * 350,
          angle: 180,
          alpha: 0,
          duration: 450,
          onComplete: () => g.destroy(),
        });
      } else {
        g.x = e.x;
        g.y = e.y;
        g.scaleX = e.direction;
        const range = e.range || 130;
        if (e.skill === 3) {
          g.lineStyle(4, e.color, 0.8);
          g.strokeEllipse(0, 35, range * 2, 110);
          g.strokeEllipse(0, 35, range * 1.7, 80);
          for (let n = -3; n <= 3; n++) {
            g.fillStyle(n % 2 ? 0xfff4c4 : e.color, 0.65);
            g.fillTriangle(
              n * 70 - 10,
              45,
              n * 70,
              -100 - Math.abs(n) * 8,
              n * 70 + 10,
              45,
            );
          }
          this.tweens.add({
            targets: g,
            alpha: 0,
            scaleY: 1.25,
            duration: 420,
            onComplete: () => g.destroy(),
          });
        } else if (e.skill === 2) {
          g.lineStyle(6, 0xffe5a0, 0.9);
          g.strokeEllipse(range * 0.45, 25, range, 110);
          for (let n = 0; n < 7; n++) {
            const x = 25 + n * 23;
            g.lineBetween(x, 35, x + 25, -60 - Math.sin(n) * 25);
          }
          this.tweens.add({
            targets: g,
            alpha: 0,
            scaleY: 1.3,
            duration: 320,
            onComplete: () => g.destroy(),
          });
        } else if (e.skill === 1) {
          for (let n = 0; n < 3; n++) {
            g.lineStyle(6 - n, e.color, 1 - n * 0.22);
            g.beginPath();
            g.arc(range * (0.25 + n * 0.25), 0, 65, -1.25, 1.25);
            g.strokePath();
          }
          this.tweens.add({
            targets: g,
            x: e.x + e.direction * 20,
            alpha: 0,
            duration: 260,
            onComplete: () => g.destroy(),
          });
        } else {
          const flip = e.combo === 1 ? -1 : 1;
          g.lineStyle(6, e.color, 0.9);
          g.beginPath();
          g.arc(0, 0, range * 0.9, -1.35, 1.35);
          g.strokePath();
          g.lineStyle(2, 0xfff8dc, 0.9);
          g.beginPath();
          g.arc(0, 0, range * 0.8, -1.2, 1.2);
          g.strokePath();
          g.angle = -e.direction * flip * 20;
          this.tweens.add({
            targets: g,
            angle: e.direction * flip * 25,
            alpha: 0,
            duration: 230,
            onComplete: () => g.destroy(),
          });
        }
      }

      if (e.skill) {
        this.burst(e.x + e.direction * 120, e.y, e.color, e.skill * 8);
        if (e.skill === 3 && !this.reducedMotion)
          this.cameras.main.shake(100, 0.002);
      }
    }
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
    for (const [id, a] of this.actors) {
      const p = a.target,
        pose = animateHero(a.image, p, serverTime, this.knightAtlas);
      const point = sampleMotion(
        a.history,
        serverTime - (id === state.self.id ? 0.05 : 0.08),
      );
      a.image.setPosition(point.x, point.y);
      if (p.class !== "swordsman" || p.gender !== "female")
        a.image.y +=
          p.grounded && pose.state === "idle" ? Math.sin(time * 0.002) : 0;
      a.label.setPosition(a.image.x, a.image.y - (p.hp <= 0 ? 60 : 158));
      a.shadow
        .setPosition(a.image.x, p.grounded ? p.y : 600)
        .setAlpha(p.grounded ? 0.35 : 0.16)
        .setScale(p.grounded ? 1 : 0.65);
      if (p.grounded && !a.wasGrounded && p.hp > 0) {
        this.dust(a.image.x, p.y);
        if (id === state.self.id) tone(100, 0.07, "triangle", 0.009);
      }
      if (
        id === state.self.id &&
        p.moving &&
        p.grounded &&
        serverTime - a.footstepAt > (p.running ? 0.19 : 0.29)
      ) {
        a.footstepAt = serverTime;
        this.dust(a.image.x - p.direction * 12, p.y, 3);
        tone(75, 0.035, "triangle", 0.006);
      }
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
      }
    }
    for (const m of this.monsters.values()) {
      const e = m.target;
      animateSlime(m.image, e, serverTime, this.slimeAtlas, m.size);
      const point = sampleMotion(m.history, serverTime - 0.08);
      m.image.setPosition(point.x, point.y);
      if (e.type !== "slime")
        m.image.y += e.moving
          ? Math.sin(time * 0.009) * 3
          : Math.sin(time * 0.003) * 1;
      m.label.setPosition(m.image.x, m.image.y - m.size - 14);
      m.bar.setPosition(m.image.x, m.image.y);
      if (m.barHp !== e.hp) {
        m.barHp = e.hp;
        m.bar.clear();
        m.bar.fillStyle(0x152540, 0.9);
        m.bar.fillRoundedRect(-35, -m.size + 4, 70, 5, 2);
        m.bar.fillStyle(e.boss ? 0xdd8dcc : 0xffbd91);
        m.bar.fillRoundedRect(
          -35,
          -m.size + 4,
          70 * Math.max(0, e.hp / e.maxHp),
          5,
          2,
        );
      }
      if (e.action && serverTime < e.action.impactAt) {
        const progress = Math.max(
          0,
          (serverTime - e.action.startedAt) /
            (e.action.impactAt - e.action.startedAt),
        );
        this.telegraphs.fillStyle(0xff725b, 0.08 + progress * 0.25);
        this.telegraphs.fillEllipse(
          e.x + e.action.direction * 42,
          e.y - 3,
          e.boss ? 240 : 160,
          30,
        );
        this.telegraphs.lineStyle(2, 0xff9474, 0.8);
        this.telegraphs.strokeEllipse(
          e.x + e.action.direction * 42,
          e.y - 3,
          e.boss ? 240 : 160,
          30,
        );
      }
    }
    const me = this.actors.get(state.self.id);
    if (me) {
      const c = this.cameras.main,
        targetX = Phaser.Math.Clamp(
          me.image.x,
          c.width / c.zoom / 2,
          WORLD.width - c.width / c.zoom / 2,
        );
      c.centerOn(Phaser.Math.Linear(c.midPoint.x, targetX, 0.08), 340);
    }
  }
}
