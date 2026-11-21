// NPC conversation box: a large portrait standing on the right over the
// world, a dark dialogue box along the bottom with a name tag, the spoken
// line on the left and numbered choices on the right (keys 1-9, tap/click).
//
// Portraits come from each NPC's pixel "talk" atlas (sprites/npcs/<id>/talk):
// the upper body is cropped out of the sprite and drawn large with
// nearest-neighbour sampling, cycling the talk frames while the box is open.
// An NPC without a set simply gets no portrait.

const SPRITES = "/assets/sprites/";
const clipCache = new Map();

// Load the talk (or idle) clip once: atlas image, frame cells and the bust
// crop measured from the frames' opaque pixels.
function loadClip(id) {
  if (clipCache.has(id)) return clipCache.get(id);
  const job = (async () => {
    const index = await fetch(SPRITES + "index.json").then((r) => r.json());
    const set = index.npcs?.[id];
    if (!set) return null;
    for (const action of [set.actions?.talk, set.actions?.idle].filter(Boolean)) {
      const base = `${SPRITES}${set.dir}/${action}/`;
      const anim = await fetch(base + "animation.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const page = anim?.fallback?.pages?.[0];
      if (!page) continue;
      const img = new Image();
      img.src = base + page.file;
      await img.decode();
      const [cw, ch] = anim.fallback.cellSize || anim.sourceSize;
      const frames = [];
      for (let i = 0; i < page.frameCount; i++)
        frames.push([(i % page.columns) * cw, Math.floor(i / page.columns) * ch]);
      const crop = measure(img, frames, cw, ch);
      return { img, frames, cw, ch, crop, durations: anim.durationsMs || frames.map(() => 250) };
    }
    return null;
  })().catch(() => null);
  clipCache.set(id, job);
  return job;
}

// Union of the opaque pixels over every frame, cut to the upper body.
function measure(img, frames, cw, ch) {
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d", { willReadFrequently: true });
  let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
  for (const [fx, fy] of frames) {
    g.clearRect(0, 0, cw, ch);
    g.drawImage(img, fx, fy, cw, ch, 0, 0, cw, ch);
    const { data } = g.getImageData(0, 0, cw, ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++)
        if (data[(y * cw + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  }
  if (x1 < x0) return { x: 0, y: 0, w: cw, h: ch };
  const h = Math.max(8, Math.round((y1 - y0 + 1) * 0.6));
  return { x: x0, y: y0, w: x1 - x0 + 1, h };
}

let root = null, timer = 0, typing = 0, current = null;

function build() {
  root = document.createElement("div");
  root.id = "npc-talk";
  root.className = "hidden";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "npc-talk-name");
  root.innerHTML = `<div class="npc-talk-portrait" aria-hidden="true"><canvas></canvas></div>
<section class="npc-talk-box">
  <header class="npc-talk-tag"><strong id="npc-talk-name"></strong><small></small></header>
  <button class="npc-talk-close" type="button" aria-label="ปิดบทสนทนา">✕</button>
  <div class="npc-talk-line"><p aria-live="polite"></p><span class="npc-talk-more" aria-hidden="true">▼</span></div>
  <ol class="npc-talk-choices"></ol>
</section>`;
  document.body.append(root);
  // The portrait stands on the box, whose height follows the text.
  const box = root.querySelector(".npc-talk-box");
  new ResizeObserver(() =>
    root.style.setProperty("--box-real-h", box.offsetHeight + "px"),
  ).observe(box);
  root.addEventListener("click", (e) => {
    if (e.target === root) current?.close();
  });
  root.querySelector(".npc-talk-close").onclick = () => current?.close();
  root.querySelector(".npc-talk-line").onclick = () => finishTyping();
  addEventListener("keydown", onKey, true);
}

function onKey(e) {
  if (!current || root.classList.contains("hidden")) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  const items = [...root.querySelectorAll(".npc-talk-choices button")];
  let handled = true;
  if (/^[1-9]$/.test(e.key)) {
    const b = items[Number(e.key) - 1];
    if (b) b.click();
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const i = items.indexOf(document.activeElement),
      next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[i < 0 ? 0 : next]?.focus();
  } else if (e.key === "Enter" || e.key === " ") {
    if (typing) finishTyping();
    else if (items.includes(document.activeElement)) document.activeElement.click();
    else items[0]?.click();
  } else if (e.key === "Escape") current.close();
  else handled = false;
  if (handled) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

// Thai vowels and tone marks stay with their consonant while typing.
const segmenter = globalThis.Intl?.Segmenter ? new Intl.Segmenter("th", { granularity: "grapheme" }) : null;
const graphemes = (text) => (segmenter ? [...segmenter.segment(text)].map((g) => g.segment) : [...text]);

// The whole line is laid out from the start (the untyped rest is hidden), so
// the box never changes height while it types.
function say(text) {
  const p = root.querySelector(".npc-talk-line p");
  clearInterval(typing);
  root.classList.add("typing");
  const chars = graphemes(text),
    shown = document.createElement("span"),
    rest = document.createElement("span");
  rest.className = "npc-talk-rest";
  rest.setAttribute("aria-hidden", "true");
  rest.textContent = text;
  p.replaceChildren(shown, rest);
  p.dataset.full = text;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finishTyping();
  let n = 0;
  typing = setInterval(() => {
    n += 2;
    shown.textContent = chars.slice(0, n).join("");
    rest.textContent = chars.slice(n).join("");
    if (n >= chars.length) finishTyping();
  }, 22);
}
function finishTyping() {
  const p = root.querySelector(".npc-talk-line p");
  clearInterval(typing);
  typing = 0;
  if (p.dataset.full) p.textContent = p.dataset.full;
  root.classList.remove("typing");
}

function setChoices(choices) {
  const list = root.querySelector(".npc-talk-choices");
  list.replaceChildren(
    ...choices.map((c, i) => {
      const li = document.createElement("li"),
        b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<kbd>${i + 1}</kbd><span></span>`;
      b.querySelector("span").textContent = c.label;
      b.onclick = () => c.run(current);
      li.append(b);
      return li;
    }),
  );
}

async function showPortrait(id) {
  const host = root.querySelector(".npc-talk-portrait"),
    canvas = host.querySelector("canvas");
  cancelAnimationFrame(timer);
  host.classList.remove("ready");
  const clip = await loadClip(id);
  if (!clip || current?.id !== id) return;
  const { img, frames, crop, durations } = clip,
    g = canvas.getContext("2d");
  canvas.width = crop.w;
  canvas.height = crop.h;
  host.style.setProperty("--aspect", `${crop.w} / ${crop.h}`);
  // Pixel-dense sprites get a whole-number scale so every pixel stays square.
  host.style.setProperty("--crop-h", crop.h);
  g.imageSmoothingEnabled = false;
  let i = -1, next = 0;
  const step = (t) => {
    if (t >= next) {
      i = (i + 1) % frames.length;
      next = t + durations[i];
      g.clearRect(0, 0, crop.w, crop.h);
      g.drawImage(img, frames[i][0] + crop.x, frames[i][1] + crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    }
    timer = requestAnimationFrame(step);
  };
  timer = requestAnimationFrame(step);
  host.classList.add("ready");
}

// Open a conversation. `npc` is {id, name, title}; `script` is
// {line, choices: [{label, run(talk)}]}. `talk.say(text)` swaps the line,
// `talk.close()` ends it. `onClose` runs once when it closes.
export function openNpcTalk(npc, script, onClose) {
  if (!root) build();
  current?.close(true);
  const talk = {
    id: npc.id,
    say: (text) => say(text),
    choices: (list) => setChoices(list),
    close(silent) {
      if (current !== talk) return;
      current = null;
      cancelAnimationFrame(timer);
      clearInterval(typing);
      root.classList.add("hidden");
      if (!silent) onClose?.();
    },
  };
  current = talk;
  root.querySelector("#npc-talk-name").textContent = npc.name;
  root.querySelector(".npc-talk-tag small").textContent = npc.title || "";
  root.classList.remove("hidden");
  setChoices(script.choices);
  say(script.line);
  showPortrait(npc.id);
  root.querySelector(".npc-talk-choices button")?.focus({ preventScroll: true });
  return talk;
}

export function closeNpcTalk() {
  current?.close(true);
}
export function npcTalkOpen() {
  return !!current;
}
