// Draw names as browser text, outside the scaled pixel-art game canvas.
export function createWorldLabels(scene, host) {
  const layer = document.createElement("div");
  Object.assign(layer.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", zIndex: "2" });
  host.append(layer);
  const labels = new Map();
  function register(label) {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", whiteSpace: "pre", fontFamily: '"Noto Sans Thai", sans-serif', fontWeight: "600", lineHeight: "1.35", textAlign: "center", textShadow: "0 1px 2px #10202a, 1px 0 1px #10202a, -1px 0 1px #10202a", background: "none" });
    // The HUD pixel theme uses !important; names explicitly keep a normal font.
    el.style.setProperty("font-family", '"Noto Sans Thai", sans-serif', "important");
    layer.append(el);
    label.setAlpha(0);
    labels.set(label, el);
    label.once("destroy", () => { el.remove(); labels.delete(label); });
    return label;
  }
  function update() {
    const cam = scene.cameras.main;
    const scale = scene.renderScale();
    for (const [label, el] of labels) {
      el.hidden = !label.visible || !label.active;
      if (el.hidden) continue;
      const text = label.text;
      if (el.textContent !== text) el.textContent = text;
      // worldView already accounts for zoom around the camera centre.
      const x = (label.x - cam.worldView.x) * cam.zoom / scale;
      const y = (label.y - cam.worldView.y) * cam.zoom / scale;
      const size = parseFloat(label.style.fontSize) || 14;
      el.style.fontSize = `${size}px`;
      el.style.color = label.style.color;
      el.style.transform = `translate(${x}px, ${y}px) translate(${-label.originX * 100}%, ${-label.originY * 100}%)`;
    }
  }
  scene.events.on("postupdate", update);
  scene.events.once("shutdown", () => { scene.events.off("postupdate", update); layer.remove(); labels.clear(); });
  return register;
}
