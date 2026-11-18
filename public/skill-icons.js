// Small vector emblems remain crisp at every HUD scale.
const sword = '<path d="m19 45 27-29 3-2-2 7-25 28-4-4Z" fill="currentColor"/><path d="m14 41 13 13m-8-7-8 8m-2-2 5 5" stroke="currentColor" stroke-width="4"/>';
const bow = '<path d="M19 12q39 20 0 40l10-20-10-20Z"/><path d="M13 32h40m-7-6 7 6-7 6"/>';
const star = '<path d="m32 8 5 17 17 7-17 5-5 19-6-19-17-5 17-7Z" fill="currentColor" stroke-width="1"/>';
const shapes = {
  swordsman: [sword, '<path d="M12 48Q48 45 50 11 36 28 15 30q15 2 21-3Q29 40 12 48Z" fill="currentColor"/>', sword+'<path d="m10 25 8-2m-2-9 7 2m14 35 10-3"/>', '<path d="M40 9a23 23 0 1 0 15 33A19 19 0 0 1 40 9Z" fill="currentColor"/><path d="m14 15 5 3m-9 12h6m34 18 4 5"/>','<path d="M10 46 14 18l11 12 7-18 7 18 11-12 4 28Z" fill="currentColor"/><path d="M10 53h44"/>'],
  archer: [bow,bow+'<path d="M10 20h11m-11 24h11"/>','<path d="m15 48 31-31m-2 8 2-8-8 2M8 37l30-27m-2 8 2-8-8 2m-1 46 27-28m-2 8 2-8-8 2"/>',bow+'<circle cx="32" cy="32" r="23" stroke-dasharray="4 5"/>','<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="4" fill="currentColor"/><path d="M32 4v10m0 36v10M4 32h10m36 0h10"/>'],
  mage: [star,star+'<circle cx="32" cy="32" r="23" stroke-dasharray="3 6"/>','<circle cx="32" cy="32" r="14"/><path d="m32 5 3 12m24 15-13 3M32 59l-3-13M5 32l13-3m31-18-7 10m7 28-9-7M15 49l7-9M15 15l9 7"/>',star+'<circle cx="32" cy="32" r="25"/><path d="M7 32h50M32 7v50" stroke-width="1"/>','<path d="m32 6 22 13v26L32 58 10 45V19Z"/><path d="m32 16 13 8v16l-13 8-13-8V24Z" fill="currentColor"/>'],
};
export function skillIcon(cls, index) {
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(shapes[cls] || shapes.swordsman)[index] || star}</svg>`;
}
export const potionIcon = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M25 9h14v8H25z" fill="#bca77c"/><path d="M25 18v10c-19 15-13 28 7 28s26-13 7-28V18Z" fill="#791f28"/><path d="M18 39q14-7 28 0c5 12-4 17-14 17s-19-5-14-17Z" fill="#eb6561"/><path d="M25 31q-8 8-7 14" stroke="#fff0d0"/><path d="M32 36v13m-6-6h12" stroke="#fff3c4" stroke-width="3"/></svg>';
export const autoIcon = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M14 27a20 20 0 0 1 34-10l4 7m-1-14 1 14-14-2M50 37a20 20 0 0 1-34 10l-4-7m1 14-1-14 14 2"/><path d="m28 23 13 9-13 9Z" fill="currentColor" stroke-width="1"/></svg>';
