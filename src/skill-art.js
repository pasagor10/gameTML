import {EXTRA_SKILLS} from './extra-classes.js';
import {SKILLS} from './model.js';

// v2 cartoon icons: one 4 × 3 sheet per group (1024 × 768, 256 px cells), row-major, cell 12 spare.
// Prompts: docs/SKILL_ART_V2_PROMPT.txt. Files: assets/ui/skills/v2/<sheet>.webp
export const SKILL_SHEETS = {
 general:['fire','ice','spark','gust','area','haste','ascension','titanbody','warlord','might','vigor'],
 knight:['whirl','wave','judgement','charge','quake','bladerain','heavensword','dragonstorm','worldsplitter','ironwill','bloodlust'],
 mage:['meteor','vortex','nova','blizzard2','thunder','beam','starfall','singularity','divinenova','manaflow','arcanemind'],
 gunner:['scatter','grenade','drone','rocket','mine','barrage','orbital','annihilation','railgun','deadeye','quickdraw'],
 archer:['piercingarrow','volleyfan','thorntrap','arrowrain','galearrow','snarefield','dragonarrow','arrowstorm','celestialbow','eagleeye','bowmastery'],
 assassin:['fanofknives','shadowcut','toxicmist','phantomstrike','blooddance','deathmark','eclipseblades','serpentmist','thousandcuts','killerinstinct','soulsteal'],
 cleric:['smite','holywave','sanctuary','purify','lightlance','dawncircle','seraphstorm','solarsanctum','judgementcross','resolve','blessedmind']
};
// Add a sheet's name here once its image is in assets/ui/skills/v2/; until then the v1 art or a symbol is shown.
export const READY_SHEETS = new Set([]);
const SHEET_OF = Object.fromEntries(Object.entries(SKILL_SHEETS).flatMap(([sheet,ids])=>ids.map((id,i)=>[id,[sheet,i]])));

// v1: stable row-major mapping for the AI-painted 6 × 7 atlas.
export const SKILL_ART_IDS = [
 'fire','ice','spark','gust','area','haste',
 'whirl','wave','judgement','meteor','vortex','nova',
 'scatter','grenade','drone','charge','quake','bladerain',
 'ironwill','bloodlust','blizzard2','thunder','beam','manaflow',
 'arcanemind','rocket','mine','barrage','deadeye','quickdraw',
 'heavensword','dragonstorm','worldsplitter','starfall','singularity','divinenova',
 'orbital','annihilation','railgun','ascension','might','vigor'
];
// Measured cell boundaries account for the painter's slightly uneven grid.
const COLS=[0,200,392,582,774,966,1161], ROWS=[0,192,381,566,756,930,1130,1354];

export function skillArt(id, classes='sk-icon') {
 const sheet=SHEET_OF[id];
 if(sheet&&READY_SHEETS.has(sheet[0])){
  const [name,i]=sheet,col=i%4,row=Math.floor(i/4);
  return `<span class="${classes} ai-skill skill-v2" style="background-image:url('/assets/ui/skills/v2/${name}.webp');--skill-x:${col/3*100}%;--skill-y:${row/2*100}%;--skill-w:400%;--skill-h:300%" aria-hidden="true"></span>`;
 }
 const extra=EXTRA_SKILLS.find(s=>s.id===id);
 if(extra)return `<span class="${classes} class-skill-art ${extra.job}" aria-hidden="true"><i>${extra.icon}</i><small>${EXTRA_SKILLS.filter(s=>s.job===extra.job).indexOf(extra)+1}</small></span>`;
 const index=SKILL_ART_IDS.indexOf(id);
 if(index<0){
  // Skills with no artwork yet (e.g. titanbody, warlord) still get a symbol tile instead of nothing.
  const skill=SKILLS.find(s=>s.id===id);
  return skill?`<span class="${classes} class-skill-art general" aria-hidden="true"><i>${skill.icon||'✦'}</i></span>`:'';
 }
 const col=index%6,row=Math.floor(index/6),left=COLS[col]+3,top=ROWS[row]+3;
 const width=COLS[col+1]-left-3,height=ROWS[row+1]-top-3;
 const x=left/(1161-width)*100,y=top/(1354-height)*100;
 const sizeX=1161/width*100,sizeY=1354/height*100;
 return `<span class="${classes} ai-skill" style="--skill-x:${x}%;--skill-y:${y}%;--skill-w:${sizeX}%;--skill-h:${sizeY}%" aria-hidden="true"></span>`;
}
