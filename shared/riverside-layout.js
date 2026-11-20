import { RIVER_PIECES } from './riverside-pieces.js';
export { RIVER_PIECES };
// Buildings are centred on their service NPC or gate, on the same street baseline.
export const RIVER_LAYOUT = [
 {piece:'tree',x:30,y:592,depth:-30},
 {piece:'pavilion',x:300,y:592},
 {piece:'stilt-house',x:600,y:592,depth:-29},
 {piece:'travelarch',x:900,y:600},
 {piece:'stilt-house',x:1100,y:592,depth:-29,scale:.65},
 {piece:'potion',x:1360,y:592},
 {piece:'stilt-house',x:1640,y:592,depth:-29,scale:.65},
 {piece:'classhall',x:1880,y:592},
 {piece:'weapon',x:2330,y:592},
 {piece:'tree',x:2630,y:592,depth:-30},
 {piece:'gemshop',x:2930,y:592},
 {piece:'stilt-house',x:3190,y:592,depth:-29,scale:.65},
 {piece:'smithy',x:3496,y:592},
 {piece:'stilt-house',x:3850,y:592},
 {piece:'minegate',x:4594,y:592},
 {piece:'boat',x:650,y:825,depth:-26},
 {piece:'boat',x:3250,y:815,depth:-26,flip:true},
];
// Visible raised timber decks: server collision, minimap and rendering share these.
export const RIVER_DOCKS = [
 {x:3820,w:220,y:528},
 {x:4020,w:280,y:480},
];
