// First-room hints for a new player (server: dungeon.tutorial). Phase 1 is
// one monster that does not fight back: attack, then a skill. Phase 2 the
// pack arrives: point at AUTO once, and at the potion when HP runs low.
const touch = matchMedia("(pointer: coarse)").matches;
const STEPS = {
  attack: {
    button: "attack",
    text: touch ? "เดินเข้าไปใกล้มอน แล้วแตะปุ่มดาบเพื่อโจมตี" : "เดินเข้าใกล้มอนด้วย A / D แล้วกด J โจมตี",
  },
  skill: {
    button: "skill1",
    text: touch ? "เยี่ยม! ลองแตะปุ่มสกิลแรกดู" : "เยี่ยม! กด Q ใช้สกิล",
  },
  pack: {
    button: "auto",
    text: touch ? "ฝูงมอนมาแล้ว! สู้ต่อเอง หรือแตะ AUTO ให้ตีอัตโนมัติ" : "ฝูงมอนมาแล้ว! สู้ต่อเอง หรือกด T เปิด AUTO",
    ttl: 7000,
  },
  potion: {
    button: "hp",
    text: touch ? "เลือดลดแล้ว! แตะปุ่มยาแดงเพื่อดื่ม" : "เลือดลดแล้ว! กด R ดื่มยา",
  },
};
const ACTION_STEP = { attack: "attack", skill1: "skill", auto: "pack", hp: "potion" };

let el = null,
  current = null,
  run = null,
  done = {},
  timer = 0;

function show(step) {
  if (step === current) return;
  document.querySelectorAll(".tut-glow").forEach((b) => b.classList.remove("tut-glow"));
  clearTimeout(timer);
  current = step;
  if (!el) {
    el = document.createElement("div");
    el.id = "tutorial-hint";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  if (!step) {
    el.classList.remove("on");
    return;
  }
  const s = STEPS[step];
  el.textContent = s.text;
  el.classList.add("on");
  document.querySelectorAll(`[data-action="${s.button}"]`).forEach((b) => b.classList.add("tut-glow"));
  if (s.ttl) timer = setTimeout(() => ((done[step] = true), show(null)), s.ttl);
}

// Every HUD refresh: state = the latest snapshot.
export function tutorialUpdate(state, blocked = false) {
  const d = state?.dungeon,
    p = state?.self,
    phase = (state?.area === "dungeon" && d?.tutorial) || 0;
  if (!phase || !p || p.hp <= 0 || blocked) {
    if (!phase) run = null;
    return show(null);
  }
  if (run !== d.instanceId) {
    run = d.instanceId;
    done = {};
  }
  let want = null;
  if (phase === 1) want = !done.attack ? "attack" : !done.skill ? "skill" : null;
  else if (!done.pack && !p.auto) want = "pack";
  if (!done.potion && p.hp < p.maxHp * 0.5) want = "potion";
  show(want);
}

// The player pressed an action button or key.
export function tutorialAction(name) {
  const step = ACTION_STEP[name];
  if (!step || !run) return;
  done[step] = true;
  if (current === step) show(null);
}

// Tutorial rooms start with AUTO off: the player is learning the buttons.
export const tutorialRoom = (d) => !!d?.tutorial;
