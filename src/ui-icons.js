// Glossy game-UI icons drawn as inline SVG (64x64). Any icon can be replaced by an AI-painted
// image: drop assets/ui/icons/<name>.png (square, transparent) and it is used automatically.
const O = '#2a1606'; // outline
let uid = 0;
const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rad = (id, stops, cx = .35, cy = .3) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".8">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const shine = (x, y, rx, ry, rot = -25) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(${rot} ${x} ${y})"/>`;

const ICONS = {
  coin: g => `<defs>${rad(g + 'a', [[0, '#fff7c2'], [.45, '#ffd23a'], [1, '#c27a00']])}${lin(g + 'b', [[0, '#ffe680'], [1, '#d08a00']])}</defs>
    <circle cx="32" cy="34" r="25" fill="#8a4a00" stroke="${O}" stroke-width="3"/><circle cx="32" cy="31" r="25" fill="url(#${g}a)" stroke="${O}" stroke-width="3"/>
    <circle cx="32" cy="31" r="17.5" fill="none" stroke="#b86e00" stroke-width="2.5"/><path d="M32 18l4 8.5 9 1-6.8 6 2 9-8.2-4.7-8.2 4.7 2-9-6.8-6 9-1z" fill="url(#${g}b)" stroke="#9a5a00" stroke-width="2" stroke-linejoin="round"/>${shine(22, 20, 8, 4)}`,
  skull: g => `<defs>${rad(g + 'a', [[0, '#ffffff'], [.7, '#e4e0ec'], [1, '#a8a0b8']])}</defs>
    <path d="M32 8C18 8 10 17 10 29c0 7 3 11 7 14v8c0 3 2 5 5 5h20c3 0 5-2 5-5v-8c4-3 7-7 7-14C54 17 46 8 32 8z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="23" cy="31" rx="6.5" ry="7.5" fill="#3a1a3a"/><ellipse cx="41" cy="31" rx="6.5" ry="7.5" fill="#3a1a3a"/><circle cx="24.5" cy="29" r="2" fill="#ff5a7a"/><circle cx="42.5" cy="29" r="2" fill="#ff5a7a"/>
    <path d="M32 38l-3.5 6h7z" fill="#3a1a3a"/><path d="M24 50v6M32 50v6M40 50v6" stroke="#9a90a8" stroke-width="2.5"/>${shine(20, 16, 7, 3.5)}`,
  potion: g => `<defs>${rad(g + 'a', [[0, '#ff9aa8'], [.5, '#f02a50'], [1, '#8a0a2a']], .4, .55)}${lin(g + 'b', [[0, '#e8faff'], [1, '#a8d8ef']])}</defs>
    <rect x="24" y="5" width="16" height="9" rx="3" fill="#b8763a" stroke="${O}" stroke-width="3"/><path d="M26 13h12v9c8 3 14 10 14 19 0 11-9 18-20 18S12 52 12 41c0-9 6-16 14-19z" fill="url(#${g}b)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M15 38c6-3 12 2 17 0s11-4 17 0c1 9-6 17-17 17S14 47 15 38z" fill="url(#${g}a)"/><circle cx="25" cy="45" r="2.6" fill="#ffd0d8"/><circle cx="36" cy="49" r="1.8" fill="#ffd0d8"/><circle cx="40" cy="42" r="1.4" fill="#ffd0d8"/>${shine(21, 30, 4, 8, 20)}<path d="M44 14l3-4M48 18l4-2M47 9l1-4" stroke="#ffe88a" stroke-width="2.5" stroke-linecap="round"/>`,
  magnet: g => `<defs>${lin(g + 'a', [[0, '#ff7a6a'], [1, '#c4102a']])}${lin(g + 'b', [[0, '#ffffff'], [1, '#a8b8cc']])}</defs>
    <path d="M14 12h12v22a6 6 0 0 0 12 0V12h12v22a18 18 0 0 1-36 0z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="14" y="8" width="12" height="11" rx="2" fill="url(#${g}b)" stroke="${O}" stroke-width="3"/><rect x="38" y="8" width="12" height="11" rx="2" fill="url(#${g}b)" stroke="${O}" stroke-width="3"/>
    <path d="M18 30c0 9 6 15 14 15" stroke="#ffffff90" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M56 40l-5 4 4 2-6 6" stroke="#7af0ff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="44" r="3" fill="#a8f0ff" stroke="${O}" stroke-width="1.5"/>`,
  town: g => `<defs>${lin(g + 'a', [[0, '#f4ead4'], [1, '#c4b08a']])}${lin(g + 'b', [[0, '#6ac4ff'], [1, '#1a5ab8']])}</defs>
    <path d="M8 58V30h10v-6h8v6h12v-6h8v6h10v28z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M6 31L13 16l7 15zM44 31l7-15 7 15z" fill="url(#${g}b)" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 26L32 6l10 20z" fill="url(#${g}b)" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 6V1" stroke="${O}" stroke-width="2"/><path d="M32 1h9l-3 3 3 3h-9z" fill="#ff4a5a" stroke="${O}" stroke-width="1.5"/>
    <path d="M26 58V46a6 6 0 0 1 12 0v12z" fill="#6a3a1a" stroke="${O}" stroke-width="2.5"/><rect x="11" y="38" width="5" height="7" rx="2.5" fill="#3a2a5a"/><rect x="48" y="38" width="5" height="7" rx="2.5" fill="#3a2a5a"/><rect x="29.5" y="31" width="5" height="7" rx="2.5" fill="#ffd25a" stroke="${O}" stroke-width="1.2"/>`,
  map: g => `<defs>${lin(g + 'a', [[0, '#fff2c8'], [1, '#e0c07a']])}</defs>
    <path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 8v42M42 14v42" stroke="#b8945a" stroke-width="2"/><path d="M12 44c6-4 6-14 14-12s8 10 16 4" stroke="#c44a2a" stroke-width="2.5" stroke-dasharray="3 3.5" fill="none" stroke-linecap="round"/>
    <path d="M43 30l7-7M50 30l-7-7" stroke="#e0182a" stroke-width="4" stroke-linecap="round"/><circle cx="14" cy="20" r="4" fill="#4ab85a" stroke="${O}" stroke-width="1.5"/><path d="M30 46l3-6 3 6z" fill="#8a7a6a" stroke="${O}" stroke-width="1.2"/>`,
  skills: g => `<defs>${lin(g + 'a', [[0, '#b88aff'], [1, '#5a22b8']])}${rad(g + 'b', [[0, '#ffffff'], [.4, '#9ff0ff'], [1, '#2a9adf']], .5, .5)}</defs>
    <path d="M8 16c8-3 16-3 24 2 8-5 16-5 24-2v38c-8-3-16-3-24 2-8-5-16-5-24-2z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 18v38" stroke="${O}" stroke-width="2.5"/><path d="M12 20c6-2 12-2 17 1M35 21c5-3 11-3 17-1" stroke="#e0c8ff" stroke-width="2" fill="none"/>
    <circle cx="32" cy="22" r="13" fill="url(#${g}b)" opacity=".85"/><path d="M32 8l3.5 9.5L45 21l-9.5 3.5L32 34l-3.5-9.5L19 21l9.5-3.5z" fill="#fffbe0" stroke="#ffb82a" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="50" cy="9" r="2.4" fill="#fff"/><circle cx="13" cy="10" r="1.8" fill="#fff"/>`,
  bag: g => `<defs>${lin(g + 'a', [[0, '#d88a4a'], [1, '#8a4a1a']])}${lin(g + 'b', [[0, '#b8662a'], [1, '#6a3410']])}</defs>
    <path d="M22 16c0-7 4-10 10-10s10 3 10 10" stroke="${O}" stroke-width="7" fill="none"/><path d="M22 16c0-7 4-10 10-10s10 3 10 10" stroke="#a8622a" stroke-width="3.5" fill="none"/>
    <path d="M12 26c0-7 5-11 12-11h16c7 0 12 4 12 11v26c0 4-3 6-6 6H18c-3 0-6-2-6-6z" fill="url(#${g}a)" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M12 30c6 5 34 5 40 0v8c-6 5-34 5-40 0z" fill="url(#${g}b)" stroke="${O}" stroke-width="2.5"/><rect x="27" y="31" width="10" height="11" rx="2" fill="#ffd25a" stroke="${O}" stroke-width="2.5"/><rect x="30.5" y="34" width="3" height="4" fill="${O}"/>
    <rect x="17" y="45" width="30" height="9" rx="3" fill="url(#${g}b)" stroke="${O}" stroke-width="2"/>${shine(20, 22, 4, 6, 20)}`,
  play: g => `<defs>${lin(g + 'a', [[0, '#c8ffb8'], [1, '#2aa84a']])}</defs><path d="M18 10l36 22-36 22z" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>${shine(25, 22, 3, 7, 0)}`,
  hold: g => `<defs>${lin(g + 'a', [[0, '#ffffff'], [1, '#c8f0d0']])}</defs><rect x="14" y="10" width="13" height="44" rx="3" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5"/><rect x="37" y="10" width="13" height="44" rx="3" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5"/>`,
  pause: g => `<defs>${lin(g + 'a', [[0, '#fff3c0'], [1, '#ffc23a']])}</defs><rect x="15" y="12" width="12" height="40" rx="3" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5"/><rect x="37" y="12" width="12" height="40" rx="3" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5"/>`,
  sound: g => `<defs>${lin(g + 'a', [[0, '#fff3c0'], [1, '#ffc23a']])}</defs><path d="M8 24h10l14-12v40L18 40H8z" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/><path d="M40 22c5 5 5 15 0 20M47 16c9 9 9 23 0 32" stroke="#ffd25a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M40 22c5 5 5 15 0 20M47 16c9 9 9 23 0 32" stroke="${O}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".5"/>`,
  mute: g => `<defs>${lin(g + 'a', [[0, '#e0e0e8'], [1, '#8a8a9a']])}</defs><path d="M8 24h10l14-12v40L18 40H8z" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/><path d="M40 24l16 16M56 24L40 40" stroke="#ff4a5a" stroke-width="5" stroke-linecap="round"/>`,
  power: g => `<defs>${lin(g + 'a', [[0, '#ffffff'], [1, '#9ab8d8']])}</defs>
    <path d="M10 8l30 30M54 8L24 38" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M10 8l30 30M54 8L24 38" stroke="url(#${g}a)" stroke-width="5" stroke-linecap="round"/>
    <path d="M34 34l12 12M30 34L18 46" stroke="#ffc23a" stroke-width="7" stroke-linecap="round"/><path d="M42 50l8 8M22 50l-8 8" stroke="#8a4a1a" stroke-width="6" stroke-linecap="round"/><circle cx="51" cy="57" r="4" fill="#ffd25a" stroke="${O}" stroke-width="2"/><circle cx="13" cy="57" r="4" fill="#ffd25a" stroke="${O}" stroke-width="2"/>`,
  heart: g => `<defs>${rad(g + 'a', [[0, '#ffb0b8'], [.5, '#ff3a50'], [1, '#a80a24']])}</defs><path d="M32 56S6 40 6 22C6 13 13 8 20 8c6 0 10 4 12 8 2-4 6-8 12-8 7 0 14 5 14 14 0 18-26 34-26 34z" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>${shine(18, 19, 5, 3.5)}`,
  crystal: g => `<defs>${lin(g + 'a', [[0, '#f0d0ff'], [1, '#7a2ae0']], 1, 1)}</defs><path d="M32 4l18 18-18 38-18-38z" fill="url(#${g}a)" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/><path d="M14 22h36M32 4l-7 18 7 38 7-38z" stroke="#ffffff80" stroke-width="1.8" fill="none"/>`
};
export const ICON_NAMES = Object.keys(ICONS);
export function iconSvg(name) {const g = `ui${name}${uid++}`;return `<svg class="uicon" viewBox="0 0 64 64" aria-hidden="true">${ICONS[name](g)}</svg>`;}

// AI-painted overrides: assets/ui/icons/manifest.json lists the names that have a <name>.png.
let manifest=null;
function probe(name){
  manifest??=fetch('/assets/ui/icons/manifest.json').then(r=>r.ok?r.json():[]).then(list=>new Set(Array.isArray(list)?list:[])).catch(()=>new Set());
  return manifest.then(set=>set.has(name)?`/assets/ui/icons/${name}.png`:null);
}
// Fills an element with the icon: SVG now, swapped for the painted PNG if one exists.
export function setIcon(el, name) {
  if (!el || el.dataset.icon === name) return;el.dataset.icon = name;el.innerHTML = iconSvg(name);
  probe(name).then(src => {if (src && el.dataset.icon === name) el.innerHTML = `<img class="uicon" src="${src}" alt="" draggable="false">`;});
}
export function applyIcons(root = document) {for (const el of root.querySelectorAll('[data-ico]')) setIcon(el, el.dataset.ico);}
