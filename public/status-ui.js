// Status and buff markers: a row of icons over a monster or hero, a tint for
// the strongest visible status, and the HUD strip of the hero's own effects.
import { STATUSES, BUFFS } from "/shared/skills.js";

const ORDER = ["freeze", "stun", "poison", "burn", "bleed", "slow", "weaken"];

export function activeEffects(x, t) {
  const out = [];
  for (const type of ORDER) {
    const s = x?.status?.[type];
    if (s && t < s.until)
      out.push({ type, ...STATUSES[type], left: s.until - t, stacks: s.stacks || 1 });
  }
  for (const [type, b] of Object.entries(x?.buffs || {}))
    if (b && BUFFS[type] && t < b.until) out.push({ type, ...BUFFS[type], left: b.until - t, buff: true });
  return out;
}

export const effectText = (list) =>
  list.map((s) => `${s.icon}${s.stacks > 1 ? `×${s.stacks}` : ""} ${Math.ceil(s.left)}s`).join("  ");

// Tint of the first status that colours the body (freeze beats burn, etc.).
export function effectTint(list) {
  return list.find((s) => s.tint)?.tint ?? null;
}

// A small text row that follows a body; created on first use.
export function effectRow(scene, holder, list, x, y) {
  const text = effectText(list);
  if (!holder.effects) {
    if (!text) return;
    holder.effects = scene.add
      .text(x, y, "", {
        fontFamily: "Noto Sans Thai",
        fontSize: "15px",
        stroke: "#0b0f1a",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(15);
  }
  if (holder.effectsText !== text) holder.effects.setText((holder.effectsText = text));
  holder.effects.setPosition(x, y).setVisible(!!text);
}

// Shared markup for the hero HUD and each party member's status strip.
export function effectsMarkup(p, t) {
  return activeEffects(p, t).map(s => {
    const label = `${s.buff ? "บัฟ" : "ดีบัฟ"}: ${s.name}${s.stacks > 1 ? ` ×${s.stacks}` : ""} · ${Math.ceil(s.left)} วิ`;
    return `<span class="fx-chip ${s.buff ? "buff" : "debuff"}" style="--fx:${s.color}" title="${label}" aria-label="${label}"><b>${s.icon}</b><span class="fx-name">${s.name}${s.stacks > 1 ? ` ×${s.stacks}` : ""}</span><small>${Math.ceil(s.left)}s</small></span>`;
  }).join("");
}
export function hudEffects(el, p, t) {
  if (!el) return;
  const html = effectsMarkup(p, t);
  if (el._html !== html) el.innerHTML = el._html = html;
}
