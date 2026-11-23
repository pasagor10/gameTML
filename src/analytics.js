let visitor='';try{visitor=localStorage.getItem('tilmo-visitor')||crypto.randomUUID();localStorage.setItem('tilmo-visitor',visitor);}catch{visitor=crypto.randomUUID();}
export function track(type,seconds=0){fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor,type,seconds}),keepalive:true}).catch(()=>{});}
track('visit');
