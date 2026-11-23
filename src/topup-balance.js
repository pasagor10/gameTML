async function update(){try{const r=await fetch('/api/topup',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.recovery){try{localStorage.setItem('tilmo-topup-recovery:'+data.account,data.recovery);}catch{}}const el=document.getElementById('paidCoins');if(el)el.textContent=data.balance.toLocaleString();}catch{}}
update();setInterval(()=>{if(!document.hidden)update();},30000);
