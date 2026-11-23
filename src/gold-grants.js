// A durable local delivery journal bridges server-paid gems to the existing local game save.
export function mergeGoldGrants(target,character,storage){
 const applied=new Set(target.paidGrants||[]);let added=0;
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith('tilmo-gold-grant:'))continue;let grant;try{grant=JSON.parse(storage.getItem(key));}catch{continue;}
  if(grant.character!==character||applied.has(grant.id)||!/^GX-[A-F0-9]+$/.test(grant.id)||!Number.isSafeInteger(grant.gold)||grant.gold<=0)continue;
  target.gold=(target.gold||0)+grant.gold;applied.add(grant.id);added+=grant.gold;
 }
 target.paidGrants=[...applied];return added;
}
export function deliverGoldGrant(grant,storage){
 const roster=JSON.parse(storage.getItem('tilmo-characters-v1')||'null');if(!roster?.slots?.some(s=>s.id===grant.character))throw Error('ไม่พบตัวละครปลายทางในเครื่องนี้ · กรุณาเปิดจากเบราว์เซอร์ที่มีตัวละครเดิม');
 storage.setItem('tilmo-gold-grant:'+grant.id,JSON.stringify({id:grant.id,character:grant.character,gold:grant.gold}));
 const key=grant.character+':tilmo-save',save=JSON.parse(storage.getItem(key)||'null');
 if(save?.run){mergeGoldGrants(save.run,grant.character,storage);storage.setItem(key,JSON.stringify(save));}
 else{const stashKey=grant.character+':tilmo-stash',stash=JSON.parse(storage.getItem(stashKey)||'{}');mergeGoldGrants(stash,grant.character,storage);storage.setItem(stashKey,JSON.stringify(stash));}
}
