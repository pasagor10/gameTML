import { SLOT_COST, SLOT_COOLDOWN_MS, SLOT_REWARDS, SLOT_TOTAL_WEIGHT } from "/shared/slots.js";
import { GEAR, RARITIES } from "/shared/rpg.js";
import { itemArt, supplyArt } from "/item-art.js";
const results = new Map();
let busy = false;
const keyFor = (id) => "tml-slot-pending:" + id;
function readPending(id) {
  try {
    return sessionStorage.getItem(keyFor(id));
  } catch {
    return null;
  }
}
const inMemoryKeys = new Map();
function pending(id) {
  return inMemoryKeys.get(id) || readPending(id);
}
function savePending(id, key) {
  if (key) inMemoryKeys.set(id, key);
  else inMemoryKeys.delete(id);
  try {
    if (key) sessionStorage.setItem(keyFor(id), key);
    else sessionStorage.removeItem(keyFor(id));
  } catch {}
}
function art(item) {
  return GEAR[item] ? itemArt(item, GEAR[item]) : supplyArt(item);
}
function rewardHtml(r) {
  if (!r) return "<small>รางวัลจะเข้ากระเป๋าทันทีเมื่อเซิร์ฟเวอร์ยืนยัน</small>";
  const name =
    GEAR[r.item]?.name || { hp: "ยา HP", mp: "ยา MP", ore: "แร่จันทรา" }[r.item];
  return `<span class="slot-prize-art">${art(r.item)}</span><div><small>${r.converted ? "เปลี่ยนเป็นแร่ · อุปกรณ์ซ้ำหรือยังไม่ถึงเงื่อนไข" : r.rarity === "common" ? "ได้รับเสบียง" : RARITIES[r.rarity]}${r.converted ? "" : " · เข้ากระเป๋าแล้ว"}</small><strong>${name} ×${r.qty}</strong></div>`;
}
export function slotPanelHtml(p) {
  const last = results.get(p.id),
    retry = pending(p.id);
  return `<section class="slot-panel"><header class="slot-intro"><small>MOONLIGHT TREASURY</small><h3>ตู้สมบัติจันทรา</h3><p>หมุนลุ้นเสบียงและอุปกรณ์สำหรับการเดินทาง</p></header><div class="slot-balance">${supplyArt("gold")}<span>ทองของคุณ <b id="slot-gold">${p.gold.toLocaleString()}</b></span></div><div class="slot-machine-ui"><div class="slot-marquee">✦ TML LUCKY TREASURE ✦</div><div class="slot-reels" aria-hidden="true">${["hp", "ore", "mp"].map((item) => `<div class="slot-reel">${art(last?.item || item)}</div>`).join("")}</div><div class="slot-result" role="status" aria-live="polite">${rewardHtml(last)}</div></div><button id="slot-spin" class="primary-button" ${busy || (!retry && p.gold < SLOT_COST) ? "disabled" : ""}>${busy ? "กำลังหมุน…" : retry ? "ตรวจสอบผลรอบเดิม" : "หมุน · 1,000 ทอง"}</button><p class="slot-note">ใช้ทองในเกมเท่านั้น · ได้รางวัลทุกครั้ง · ไม่มีหมุนอัตโนมัติ</p><details class="slot-odds" open><summary>โอกาสรางวัลต่อการหมุน</summary><div>${SLOT_REWARDS.map((r) => `<span>${r.label}<b>${((r.weight / SLOT_TOTAL_WEIGHT) * 100).toLocaleString()}%</b></span>`).join("")}</div><p>อุปกรณ์สุ่มจากของที่ตรงอาชีพ เลเวล และชั้นที่ปลดล็อกแล้ว ถ้าได้ของซ้ำหรือยังไม่มีของระดับนั้น จะได้แร่แทน: หายาก 20 / มหากาพย์ 35 / ตำนาน 80 ชิ้น</p></details></section>`;
}
export function bindSlotPanel(
  root,
  p,
  { request, sound, currentPlayer, onSettled },
) {
  const button = root.querySelector("#slot-spin");
  if (!button) return;
  button.onclick = async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = "กำลังหมุน…";
    const key = pending(p.id) || crypto.randomUUID();
    savePending(p.id, key);
    const machine = root.querySelector(".slot-machine-ui");
    machine.classList.add("spinning");
    const resultBox = root.querySelector(".slot-result");
    resultBox.textContent = "กำลังเปิดตู้สมบัติ…";
    sound("coin");
    try {
      const [result] = await Promise.all([
        request(key),
        new Promise((resolve) => setTimeout(resolve, SLOT_COOLDOWN_MS + 200)),
      ]);
      if (result) {
        results.set(p.id, result);
        savePending(p.id, null);
        if (root.isConnected) {
          root.querySelectorAll(".slot-reel").forEach((reel) => {
            reel.innerHTML = art(result.item);
          });
          resultBox.innerHTML = rewardHtml(result);
          machine.dataset.rarity = result.rarity;
          root.querySelector("#slot-gold").textContent =
            result.gold.toLocaleString();
          sound(
            result.rarity === "legendary" || result.rarity === "epic"
              ? "levelUp"
              : "coin",
          );
        }
      } else if (root.isConnected)
        resultBox.textContent =
          "ยังไม่ได้ยืนยันผล · กดตรวจสอบรอบเดิมได้ โดยไม่สร้างคำขอจ่ายรอบใหม่";
    } catch {
      if (root.isConnected)
        resultBox.textContent = "การเชื่อมต่อสะดุด · กดตรวจสอบผลรอบเดิมอีกครั้ง";
    } finally {
      busy = false;
      if (!root.isConnected) onSettled?.();
      if (root.isConnected) {
        machine.classList.remove("spinning");
        button.disabled =
          !pending(p.id) && (currentPlayer()?.gold ?? p.gold) < SLOT_COST;
        button.textContent = pending(p.id)
          ? "ตรวจสอบผลรอบเดิม"
          : "หมุนอีกครั้ง · 1,000 ทอง";
      }
    }
  };
}
