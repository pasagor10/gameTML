const installButton = document.querySelector("#install-app");
const dialog = document.querySelector("#install-help");
const standalone = matchMedia("(display-mode: standalone)");
let pendingPrompt = null;
let installed = standalone.matches || navigator.standalone === true;
const ios =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function syncInstallButton() {
  installButton.hidden =
    installed || standalone.matches || navigator.standalone === true;
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pendingPrompt = event;
  syncInstallButton();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  pendingPrompt = null;
  if (dialog.open) dialog.close();
  syncInstallButton();
});
standalone.addEventListener("change", syncInstallButton);
installButton.addEventListener("click", async () => {
  if (pendingPrompt) {
    const prompt = pendingPrompt;
    pendingPrompt = null;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      showHelp();
    } finally {
      installButton.disabled = false;
      syncInstallButton();
    }
  } else showHelp();
});
function showHelp() {
  document.querySelector("#install-steps").textContent = ios
    ? "เปิดเว็บนี้ใน Safari → แตะปุ่มแชร์ → เลือก เพิ่มไปยังหน้าจอโฮม (Add to Home Screen) → ตรวจชื่อ TILMO แล้วแตะ เพิ่ม"
    : "เปิดเมนูของเบราว์เซอร์ ⋮ หรือ ⋯ → เลือก ติดตั้ง TILMO / ติดตั้งแอป หรือ เพิ่มลงในหน้าจอหลัก (Add to Home Screen) แล้วทำตามขั้นตอนบนหน้าจอ";
  if (!dialog.open) dialog.showModal();
}
document
  .querySelector("#install-help-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
// Keep lobby shortcuts (Enter / arrows) from firing behind the install dialog.
for (const type of ["keydown", "keyup"]) {
  dialog.addEventListener(type, (event) => event.stopPropagation());
}
syncInstallButton();
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) =>
          console.warn("TILMO install support unavailable", error),
        );
    },
    { once: true },
  );
}
