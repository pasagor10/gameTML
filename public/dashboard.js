// Public player dashboard: aggregate numbers only, hand-built SVG charts.
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};
let days = 1;
try { days = Number(localStorage.getItem("tml-dash-days-v2") ?? 1); } catch { /* storage blocked */ }
if (![1, 7, 30, 0].includes(days)) days = 1;

// --- Tooltip ---------------------------------------------------------------
const tip = $("#tip");
function showTip(html, x, y) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x + 14)) + "px";
  tip.style.top = Math.max(8, y - r.height - 12) + "px";
}
const hideTip = () => (tip.hidden = true);

// Nice round axis maximum and ticks.
function ticks(max, count = 4) {
  if (max <= 0) return { top: 4, list: [0, 1, 2, 3, 4] };
  const raw = max / count,
    mag = 10 ** Math.floor(Math.log10(raw)),
    // Counts of people: never a fractional tick.
    step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw));
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, list: Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step) };
}
function table(el, head, rows) {
  el.innerHTML = `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

// --- KPI tiles ---------------------------------------------------------------
function kpis(t, d1) {
  const tiles = [
    ["ผู้เข้าชมในช่วงนี้", fmt(t.visitors), `วันนี้ ${fmt(t.visitorsToday)} คน`],
    ["เข้าเว็บอย่างเดียว", fmt(t.visitOnly), `${pct(t.visitOnly, t.visitors)}% ของผู้เข้าชม ไม่กดเล่น`],
    ["บัญชีใหม่", fmt(t.accounts), `สมัครจริง ${fmt(t.registered)} · ผู้มาเยือน ${fmt(t.accounts - t.registered)}`],
    ["ตัวละครใหม่", fmt(t.characters), `บัญชีที่ยังไม่สร้างตัวละคร ${fmt(t.noCharacter)}`],
    ["ออนไลน์ตอนนี้", fmt(t.online), "ผู้เล่นในเกมขณะนี้"],
  ];
  if (d1)
    tiles.splice(4, 0, [
      "กลับมาวันถัดไป (D1)",
      d1.players ? pct(d1.returned, d1.players) + "%" : "–",
      d1.players ? `${fmt(d1.returned)} จาก ${fmt(d1.players)} คน · ในช่วงที่เลือก` : "ยังไม่มีข้อมูล",
    ]);
  $("#kpis").innerHTML = tiles
    .map(([l, v, s]) => `<div class="kpi"><small>${l}</small><strong>${v}</strong><span>${s}</span></div>`)
    .join("");
}

// --- Funnel ------------------------------------------------------------------
function funnel(steps) {
  const first = steps[0]?.count || Math.max(...steps.map((s) => s.count), 0);
  const top = Math.max(first, ...steps.map((s) => s.count), 1);
  let worst = -1,
    worstLoss = 0;
  steps.forEach((s, k) => {
    if (!k || !steps[k - 1].count) return;
    const loss = 1 - s.count / steps[k - 1].count;
    if (loss > worstLoss) [worst, worstLoss] = [k, loss];
  });
  $("#funnel").innerHTML = steps
    .map((s, k) => {
      const prev = k ? steps[k - 1].count : 0,
        drop = k && prev ? Math.max(0, Math.round((1 - s.count / prev) * 100)) : null;
      return `<div class="step${k === worst ? " worst" : ""}" data-k="${k}">
        <div class="name"><i>${k + 1}</i>${esc(s.label)}</div>
        <div class="track"><div class="bar" style="width:${(s.count / top) * 100}%"></div></div>
        <div class="nums"><b>${fmt(s.count)}</b> คน<small class="${drop >= 30 ? "drop" : ""}">${
          k === 0 ? "จุดเริ่มต้น" : drop === null ? "–" : `หลุด ${drop}% จากขั้นก่อน`
        }</small></div></div>`;
    })
    .join("");
  for (const row of document.querySelectorAll(".step")) {
    const k = Number(row.dataset.k),
      s = steps[k];
    row.onmousemove = (e) =>
      showTip(
        `<b>${esc(s.label)}</b><br>${fmt(s.count)} คน · ${pct(s.count, first)}% ของคนที่เข้าเว็บ${
          k ? `<br>ต่อจากขั้นก่อน ${pct(s.count, steps[k - 1].count)}%` : ""
        }`,
        e.clientX,
        e.clientY,
      );
    row.onmouseleave = hideTip;
  }
  $("#insight").innerHTML =
    worst > 0 && worstLoss > 0
      ? `จุดที่คนหลุดมากที่สุด: <b>${esc(steps[worst - 1].label)} → ${esc(steps[worst].label)}</b> · หลุด ${Math.round(
          worstLoss * 100,
        )}% (${fmt(steps[worst - 1].count - steps[worst].count)} คน) ควรปรับขั้นนี้ก่อน`
      : first
        ? ""
        : "ยังไม่มีข้อมูลในช่วงนี้ · ข้อมูล funnel จะเริ่มนับเมื่อมีคนเข้าหน้าเว็บหลังอัปเดต";
}

// --- Daily line chart ----------------------------------------------------------
const SERIES = [
  { key: "visitors", label: "ผู้เข้าชม", color: "var(--series-1)" },
  { key: "accounts", label: "บัญชีใหม่", color: "var(--series-2)" },
  { key: "characters", label: "ตัวละครใหม่", color: "var(--series-3)" },
];
function daily(rows) {
  const host = $("#daily");
  host.innerHTML = "";
  $("#daily-legend").innerHTML = SERIES.map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("");
  // Drawn at the container's real width so text stays readable on phones.
  const W = Math.max(300, host.clientWidth || 1000),
    H = W < 560 ? 220 : 280,
    m = { l: 34, r: W < 560 ? 78 : 104, t: 12, b: 28 },
    iw = W - m.l - m.r,
    ih = H - m.t - m.b;
  const max = Math.max(...rows.flatMap((r) => SERIES.map((s) => r[s.key])), 0),
    { top, list } = ticks(max);
  const x = (k) => m.l + (rows.length > 1 ? (k / (rows.length - 1)) * iw : iw / 2),
    y = (v) => m.t + ih - (v / top) * ih;
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "กราฟรายวัน ผู้เข้าชม บัญชีใหม่ ตัวละครใหม่" });
  const axis = svg("g", { class: "axis" });
  for (const v of list) {
    axis.append(svg("line", { class: v ? "gridline" : "baseline", x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }));
    axis.append(svg("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, fmt(v)));
  }
  rows.forEach((r, k) => {
    const every = W < 560 ? 4 : 2;
    if ((rows.length - 1 - k) % every) return; // anchored on today, never crowded
    const [, mo, d] = r.day.split("-");
    axis.append(svg("text", { x: x(k), y: H - 8, "text-anchor": "middle" }, `${Number(d)}/${Number(mo)}`));
  });
  root.append(axis);
  // Direct end labels, nudged apart so they never overlap.
  const ends = SERIES.map((s) => ({ s, y: y(rows.at(-1)[s.key]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
  for (const s of SERIES) {
    const d = rows.map((r, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(r[s.key]).toFixed(1)}`).join("");
    root.append(svg("path", { class: "line", d, stroke: s.color }));
  }
  for (const e of ends)
    root.append(svg("text", { class: "lbl value", x: x(rows.length - 1) + 8, y: e.y + 4 }, W < 560 ? fmt(rows.at(-1)[e.s.key]) : `${e.s.label} ${fmt(rows.at(-1)[e.s.key])}`));
  const cross = svg("line", { class: "crosshair", y1: m.t, y2: m.t + ih, visibility: "hidden" });
  const dots = SERIES.map((s) => svg("circle", { class: "dot", r: 5, fill: s.color, visibility: "hidden" }));
  root.append(cross, ...dots);
  const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" });
  root.append(hit);
  const move = (e) => {
    const box = root.getBoundingClientRect(),
      px = ((e.clientX - box.left) / box.width) * W,
      k = Math.max(0, Math.min(rows.length - 1, Math.round(((px - m.l) / iw) * (rows.length - 1))));
    cross.setAttribute("x1", x(k));
    cross.setAttribute("x2", x(k));
    cross.setAttribute("visibility", "visible");
    SERIES.forEach((s, n) => {
      dots[n].setAttribute("cx", x(k));
      dots[n].setAttribute("cy", y(rows[k][s.key]));
      dots[n].setAttribute("visibility", "visible");
    });
    const [yr, mo, d] = rows[k].day.split("-");
    showTip(
      `<b>${Number(d)}/${Number(mo)}/${Number(yr) + 543}</b>${SERIES.map(
        (s) => `<div class="row"><i style="background:${s.color}"></i>${s.label} ${fmt(rows[k][s.key])}</div>`,
      ).join("")}`,
      e.clientX,
      e.clientY,
    );
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => {
    hideTip();
    cross.setAttribute("visibility", "hidden");
    dots.forEach((d) => d.setAttribute("visibility", "hidden"));
  });
  host.append(root);
  table($("#daily-table"), ["วันที่", ...SERIES.map((s) => s.label)], rows.map((r) => [r.day, ...SERIES.map((s) => fmt(r[s.key]))]));
}

// --- Vertical bar chart (one series) -------------------------------------------
function bars(host, tableHost, items, unit = "ตัวละคร") {
  host.innerHTML = "";
  const total = items.reduce((a, b) => a + b.count, 0);
  if (!total) {
    host.innerHTML = `<p class="empty">ยังไม่มีตัวละคร</p>`;
    tableHost.innerHTML = "";
    return;
  }
  const W = Math.max(300, host.clientWidth || 520),
    H = 240,
    m = { l: 34, r: 8, t: 22, b: 30 },
    iw = W - m.l - m.r,
    ih = H - m.t - m.b,
    { top, list } = ticks(Math.max(...items.map((i) => i.count)));
  const slot = iw / items.length,
    bw = Math.max(6, Math.min(44, slot - 2)),
    y = (v) => m.t + ih - (v / top) * ih;
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
  const axis = svg("g", { class: "axis" });
  for (const v of list) {
    axis.append(svg("line", { class: v ? "gridline" : "baseline", x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }));
    axis.append(svg("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, fmt(v)));
  }
  root.append(axis);
  const peak = items.reduce((a, b) => (b.count > a.count ? b : a));
  items.forEach((it, k) => {
    const cx = m.l + slot * k + slot / 2,
      h = Math.max(it.count ? 2 : 0, (it.count / top) * ih),
      x0 = cx - bw / 2,
      y0 = m.t + ih - h,
      r = Math.min(4, bw / 2, h);
    // Rounded data end, square at the baseline.
    root.append(
      svg("path", {
        d: `M${x0},${m.t + ih}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${m.t + ih}Z`,
        fill: "var(--series-1)",
      }),
    );
    const label = it.label.replace("ยังไม่ผ่าน", "0").replace("ชั้น ", slot < 44 ? "" : "ชั้น ").replace(/^Lv\.(?=\d+–)/, slot < 56 ? "" : "Lv.");
    root.append(svg("text", { class: "lbl", x: cx, y: H - 10, "text-anchor": "middle" }, label));
    if (it === peak) root.append(svg("text", { class: "lbl value", x: cx, y: y0 - 6, "text-anchor": "middle" }, fmt(it.count)));
    const hit = svg("rect", { x: m.l + slot * k, y: m.t, width: slot, height: ih, fill: "transparent" });
    hit.addEventListener("pointermove", (e) =>
      showTip(`<b>${esc(it.label)}</b><br>${fmt(it.count)} ${unit} · ${pct(it.count, total)}%`, e.clientX, e.clientY),
    );
    hit.addEventListener("pointerleave", hideTip);
    root.append(hit);
  });
  host.append(root);
  table(tableHost, ["กลุ่ม", unit, "%"], items.map((i) => [i.label, fmt(i.count), pct(i.count, total) + "%"]));
}

function hbars(items) {
  const total = items.reduce((a, b) => a + b.count, 0),
    top = Math.max(1, ...items.map((i) => i.count));
  $("#classes").innerHTML = total
    ? items
        .map(
          (i) => `<div class="hbar"><span>${esc(i.label)}</span><div class="track"><div class="bar" style="width:${(i.count / top) * 100}%"></div></div><span class="nums">${fmt(i.count)} · ${pct(i.count, total)}%</span></div>`,
        )
        .join("")
    : `<p class="empty">ยังไม่มีตัวละคร</p>`;
}

// --- Floor 1 exits: stacked bars per stage -------------------------------------
const REASONS = [
  { key: "death", label: "ตาย", color: "var(--series-2)" },
  { key: "leave", label: "ออกเอง", color: "var(--series-1)" },
  { key: "disconnect", label: "หลุด/ปิดเกม", color: "var(--series-3)" },
];
function exits(rows, people) {
  $("#exits-legend").innerHTML = REASONS.map((r) => `<span><i style="background:${r.color}"></i>${r.label}</span>`).join("");
  const total = rows.reduce((a, r) => a + r.total, 0),
    top = Math.max(1, ...rows.map((r) => r.total));
  $("#exits-note").textContent = total
    ? `${fmt(total)} รอบจาก ${fmt(people)} คน · นับเฉพาะคนที่ยังไม่เคยผ่านชั้น 1`
    : "";
  $("#exits").innerHTML = total
    ? rows
        .map(
          (r) => `<div class="hbar stack" data-stage="${r.stage}"><span>${esc(r.label)}</span><div class="track">${REASONS.map(
            (x) => `<div class="seg" style="width:${(r[x.key] / top) * 100}%;background:${x.color}"></div>`,
          ).join("")}</div><span class="nums">${fmt(r.total)} รอบ</span></div>`,
        )
        .join("")
    : `<p class="empty">ยังไม่มีข้อมูล · เริ่มนับตั้งแต่อัปเดตนี้</p>`;
  for (const el of document.querySelectorAll("#exits .stack")) {
    const r = rows.find((x) => x.stage === Number(el.dataset.stage));
    el.onmousemove = (e) =>
      showTip(
        `<b>${esc(r.label)}</b>${REASONS.map((x) => `<div class="row"><i style="background:${x.color}"></i>${x.label} ${fmt(r[x.key])}</div>`).join("")}`,
        e.clientX,
        e.clientY,
      );
    el.onmouseleave = hideTip;
  }
  table($("#exits-table"), ["ด่าน", ...REASONS.map((r) => r.label), "รวม"], rows.map((r) => [r.label, ...REASONS.map((x) => fmt(r[x.key])), fmt(r.total)]));
}

// --- Where visitors came from / on what: visitors bar, hero-made overlay -------
function origin(host, tableHost, rows) {
  const top = Math.max(1, ...rows.map((r) => r.visitors));
  host.innerHTML = rows.length
    ? rows
        .map(
          (r, k) => `<div class="hbar${r.id === "unknown" ? " unknown" : ""}" data-k="${k}"><span title="${esc(r.label)}">${esc(r.label)}</span><div class="track"><div class="bar" style="width:${(r.visitors / top) * 100}%"></div><div class="bar hero" style="width:${(r.hero / top) * 100}%"></div></div><span class="nums">${fmt(r.visitors)} · ${pct(r.hero, r.visitors)}%</span></div>`,
        )
        .join("")
    : `<p class="empty">ยังไม่มีข้อมูลในช่วงนี้</p>`;
  for (const el of host.querySelectorAll(".hbar")) {
    const r = rows[Number(el.dataset.k)];
    el.onmousemove = (e) =>
      showTip(
        `<b>${esc(r.label)}</b><br>เข้าชม ${fmt(r.visitors)} คน<br>กดเล่น ${fmt(r.played)} (${pct(r.played, r.visitors)}%)<br>สร้างตัวละคร ${fmt(r.hero)} (${pct(r.hero, r.visitors)}%)<br>เข้าเมือง ${fmt(r.town)} (${pct(r.town, r.visitors)}%)`,
        e.clientX,
        e.clientY,
      );
    el.onmouseleave = hideTip;
  }
  table(
    tableHost,
    ["ที่มา", "เข้าชม", "กดเล่น", "สร้างตัวละคร", "เข้าเมือง"],
    rows.map((r) => [r.label, fmt(r.visitors), `${fmt(r.played)} (${pct(r.played, r.visitors)}%)`, `${fmt(r.hero)} (${pct(r.hero, r.visitors)}%)`, `${fmt(r.town)} (${pct(r.town, r.visitors)}%)`]),
  );
}

function retention(rows) {
  const shown = rows.filter((r) => r.players);
  $("#retention").innerHTML = shown.length
    ? shown
        .map((r) => {
          const [, mo, d] = r.day.split("-"),
            live = r === rows.at(-1);
          return `<div class="hbar"><span>${Number(d)}/${Number(mo)}</span><div class="track"><div class="bar" style="width:${pct(r.returned, r.players)}%"></div></div><span class="nums">${fmt(r.returned)}/${fmt(r.players)}${live ? " · วันนี้ยังนับอยู่" : ""}</span></div>`;
        })
        .join("")
    : `<p class="empty">ยังไม่มีผู้เล่นใหม่ที่ครบ 1 วัน</p>`;
}

// --- Load ----------------------------------------------------------------------
let loadSeq = 0;
async function load() {
  const request = ++loadSeq;
  for (const b of document.querySelectorAll("[data-days]")) b.classList.toggle("active", Number(b.dataset.days) === days);
  try {
    const data = await fetch(`/api/dashboard?days=${days}`).then((r) => {
      if (!r.ok) throw Error(r.status);
      return r.json();
    });
    if (request !== loadSeq) return;
    last = data;
    render(data);
    $("#updated").textContent = `อัปเดต ${new Date(data.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · funnel ${
      days === 1 ? "วันนี้ · 1 วัน (เวลาไทย)" : days ? `${days} วันล่าสุด` : "ตั้งแต่เริ่มวัดผลใหม่"
    } · แสดงข้อมูลตั้งแต่ ${data.measurementFrom}`;
  } catch {
    if (request !== loadSeq) return;
    $("#updated").textContent = "โหลดข้อมูลไม่สำเร็จ · จะลองใหม่อัตโนมัติ";
  }
}
for (const b of document.querySelectorAll("[data-days]"))
  b.onclick = () => {
    days = Number(b.dataset.days);
    try { localStorage.setItem("tml-dash-days-v2", String(days)); } catch { /* storage blocked */ }
    load();
  };
let last = null;
const render = (data) => {
  kpis(data.totals, data.d1);
  funnel(data.funnel);
  origin($("#sources"), $("#sources-table"), data.sources || []);
  origin($("#devices"), $("#devices-table"), data.devices || []);
  exits(data.floor1Exits || [], data.exitPeople || 0);
  retention(data.retention || []);
  $("#excluded").textContent = data.totals.excludedAccounts ? ` · ไม่นับบัญชีทีมพัฒนา ${fmt(data.totals.excludedAccounts)} บัญชี` : "";
  daily(data.daily);
  bars($("#floors"), $("#floors-table"), data.floors);
  bars($("#levels"), $("#levels-table"), data.levels);
  hbars(data.classes);
};
let resizeAt;
addEventListener("resize", () => {
  clearTimeout(resizeAt);
  resizeAt = setTimeout(() => last && render(last), 150);
});
load();
setInterval(() => !document.hidden && load(), 30000);
