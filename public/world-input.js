// World hotspots may only receive presses that actually landed on the canvas.
export function isWorldPointer(pointer, canvas, doc = document) {
  const event = pointer?.event;
  if (!event || event.target !== canvas) return false;
  const touch = event.changedTouches?.[0] || event.touches?.[0];
  const x = touch?.clientX ?? event.clientX;
  const y = touch?.clientY ?? event.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return doc.elementFromPoint(x, y) === canvas;
}
