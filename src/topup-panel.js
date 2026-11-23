export function openTopupPanel({root,onClose,onGoldPacks}){
 root.innerHTML='<div class="panel topup-game-panel"><header class="char-head"><h2>เติมเพชร</h2><button id="closeTopupPanel" class="close-x" aria-label="ปิดเติมเพชร">✕</button></header><iframe id="topupFrame" src="/topup?embedded=1" title="เติมเพชร โอนพร้อมเพย์และแนบสลิป"></iframe></div>';
 const frame=root.querySelector('#topupFrame');const handler=event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;if(event.data?.type==='tilmo:wallet'&&Number.isSafeInteger(event.data.balance)){const hud=document.getElementById('paidCoins');if(hud)hud.textContent=event.data.balance.toLocaleString();}if(event.data?.type==='tilmo:gold-packs'){window.removeEventListener('message',handler);onGoldPacks();}};
 window.addEventListener('message',handler);root.querySelector('#closeTopupPanel').onclick=()=>{window.removeEventListener('message',handler);onClose();};
}
