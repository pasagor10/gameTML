// HUD feedback driven by each world snapshot: damage trails, hit shake,
// low-HP warning, cooldown sweeps, gold count-up, level-up banner, area intro.
import { ACTIONS } from "/shared/motion.js";

const $ = (s) => document.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let prev = null,
  goldShown = 0,
  goldRaf = 0,
  lastArea = null;

function pulse(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el["_" + cls]);
  el["_" + cls] = setTimeout(() => el.classList.remove(cls), ms);
}

function countGold(target) {
  const el = $("#gold");
  cancelAnimationFrame(goldRaf);
  if (reduced || target < goldShown) {
    goldShown = target;
    el.textContent = target.toLocaleString();
    return;
  }
  const from = goldShown,
    start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 600);
    goldShown = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
    el.textContent = goldShown.toLocaleString();
    if (t < 1) goldRaf = requestAnimationFrame(step);
  };
  goldRaf = requestAnimationFrame(step);
}

function levelUp(level) {
  const screen = $("#game-screen");
  $("#level-up")?.remove();
  const banner = document.createElement("div");
  banner.id = "level-up";
  banner.setAttribute("role", "status");
  banner.innerHTML = `<strong>LEVEL UP!</strong><span>ระดับ ${level} · พลังเพิ่มขึ้น</span>`;
  screen.append(banner);
  setTimeout(() => banner.remove(), 2500);
  pulse(screen, "level-pop", 800);
}

export function enterHud() {
  pulse($("#game-screen"), "hud-enter", 1200);
}

// Call after the base HUD text/widths are written for this snapshot.
export function updateHudFx(state) {
  const p = state.self,
    screen = $("#game-screen"),
    hpPct = (p.hp / p.maxHp) * 100;
  $("#hp-trail").style.width = hpPct + "%";
  $("#mp-trail").style.width = (p.mp / p.maxMp) * 100 + "%";
  $(".stat-bar.hp").classList.toggle("low", p.hp > 0 && hpPct <= 30);
  screen.classList.toggle("danger", p.hp > 0 && hpPct <= 30);

  for (let i = 1; i <= 3; i++) {
    const btn = $(`[data-action="skill${i}"]`),
      remaining = ACTIONS[i].cooldown - (state.time - (p.cooldowns[i] || 0)),
      cd = Math.max(0, Math.min(1, remaining / ACTIONS[i].cooldown));
    btn.style.setProperty("--cd", cd.toFixed(3));
    if (btn._cooling && remaining <= 0) pulse(btn, "ready", 650);
    btn._cooling = remaining > 0;
  }

  const area =
    state.area === "town"
      ? "town"
      : `${state.dungeon?.floor}:${state.dungeon?.stage}:${state.dungeon?.training}`;
  if (area !== lastArea) {
    if (lastArea !== null) pulse(screen, "area-change", 1200);
    lastArea = area;
  }

  if (prev && prev.id === p.id) {
    if (p.hp < prev.hp - 0.5) pulse(screen, "hud-hit", 340);
    if (p.level > prev.level) levelUp(p.level);
    if (p.gold > prev.gold) pulse($(".gold-display"), "gain", 520);
    if (p.gold !== prev.gold) countGold(p.gold);
  } else {
    goldShown = p.gold;
    $("#gold").textContent = p.gold.toLocaleString();
  }
  prev = { id: p.id, hp: p.hp, level: p.level, gold: p.gold };
}
