// Keep the entire hint above the highest visible mobile control.
export function tutorialHintTop(height, hintHeight, controls) {
  const tops = controls.filter(r => r.width > 0 && r.height > 0 && r.top > 0 && r.top < height).map(r => r.top);
  const ceiling = tops.length ? Math.min(...tops) : height - 100;
  return Math.max(8, ceiling - hintHeight - 16);
}
