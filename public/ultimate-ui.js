import { ULTIMATES } from '/shared/ultimates.js';
const loaded = new Map();
let overlay, cleanup, clearEffects;
export function prepareUltimate(gender) {
  const key = gender === 'male' ? 'male' : 'female';
  if (!loaded.has(key)) { const image = new Image(); image.src = `/assets/ultimates/${key}.webp?v=1`; loaded.set(key,image); }
}
function host() {
  if (!overlay) {
    overlay = document.createElement('div'); overlay.id = 'ultimate-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML = '<div class="ult-dim"></div><div class="ult-cutin"><div class="ult-art"></div><strong class="ult-name"></strong></div><div class="ult-impact"></div><div class="ult-ring"></div>';
    document.querySelector('#game-screen').append(overlay);
  }
  return overlay;
}
export function showUltimateCutin(cls, gender) {
  const skill = ULTIMATES[cls]; if (!skill) return;
  const node = host(); clearTimeout(cleanup); clearTimeout(clearEffects);
  node.className = ''; void node.offsetWidth;
  node.style.setProperty('--ult-color',skill.color);
  const art=node.querySelector('.ult-art');
  art.style.backgroundImage=`url('/assets/ultimates/${gender === 'male' ? 'male' : 'female'}.webp?v=1')`;
  art.style.backgroundPosition=`center ${skill.row*100/3}%`;
  node.querySelector('.ult-name').textContent=skill.name;
  node.dataset.class=cls; node.classList.add('casting');
  cleanup=setTimeout(()=>{ node.className=''; },2800);
}
export function showUltimateImpact(cls) {
  const skill=ULTIMATES[cls];if(!skill)return;
  const node=host();node.dataset.class=cls;node.style.setProperty('--ult-color',skill.color);
  node.classList.remove('impact');void node.offsetWidth;node.classList.add('impact');
  clearTimeout(clearEffects);clearEffects=setTimeout(()=>node.classList.remove('impact'),1000);
}
// Returning to the roster must never leave a delayed full-screen effect on it.
const screen=document.querySelector('#game-screen');
new MutationObserver(()=>{
  if(screen.classList.contains('hidden')&&overlay){clearTimeout(cleanup);clearTimeout(clearEffects);overlay.className='';}
}).observe(screen,{attributes:true,attributeFilter:['class']});
