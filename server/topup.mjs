import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex'),token=()=>randomBytes(32).toString('base64url');
export const GOLD_PACKS=[100,500,1000,5000,10000,35000].map(diamonds=>({id:'gold'+diamonds,diamonds,gold:diamonds*10}));
export const PACKAGE={id:'starter35',price:3500,coins:35000,promptpay:'0944555163'};
export class TopupStore{
 constructor(file){if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});this.db=new DatabaseSync(file);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,secret TEXT UNIQUE NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),character TEXT NOT NULL,name TEXT NOT NULL,price INTEGER NOT NULL,coins INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_slip',created INTEGER NOT NULL,reviewed INTEGER,reference TEXT UNIQUE,note TEXT,slip BLOB,mime TEXT,slip_hash TEXT UNIQUE);
 CREATE TABLE IF NOT EXISTS ledger(order_id TEXT PRIMARY KEY REFERENCES orders(id),account TEXT NOT NULL,coins INTEGER NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS exchanges(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),request TEXT NOT NULL,character TEXT NOT NULL,name TEXT NOT NULL,diamonds INTEGER NOT NULL,gold INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,UNIQUE(account,request));
 CREATE TABLE IF NOT EXISTS admin_sessions(secret TEXT PRIMARY KEY,expires INTEGER NOT NULL);`); }
 account(secret){return secret?this.db.prepare('SELECT id FROM accounts WHERE secret=?').get(hash(secret)):null;}
 createAccount(){const secret=token(),id=randomBytes(8).toString('hex');this.db.prepare('INSERT INTO accounts VALUES(?,?,?)').run(id,hash(secret),Date.now());return{id,secret};}
 orders(account){return this.db.prepare('SELECT id,character,name,price,coins,status,created,reviewed,note FROM orders WHERE account=? ORDER BY created DESC LIMIT 50').all(account);}
 balance(account){return this.db.prepare('SELECT (SELECT COALESCE(SUM(coins),0) FROM ledger WHERE account=?) - (SELECT COALESCE(SUM(diamonds),0) FROM exchanges WHERE account=?) n').get(account,account).n;}
 exchanges(account){return this.db.prepare("SELECT id,character,name,diamonds,gold,status,created FROM exchanges WHERE account=? ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created DESC LIMIT 200").all(account);}
 exchange(account,{pack,character,name,request}){
  const offer=GOLD_PACKS.find(p=>p.id===pack);if(!offer||!/^[-\w]{1,80}$/.test(character||'')||!/^[-\w]{8,80}$/.test(request||''))throw Error('ข้อมูลแพ็กทองไม่ถูกต้อง');
  this.db.exec('BEGIN IMMEDIATE');try{const old=this.db.prepare('SELECT * FROM exchanges WHERE account=? AND request=?').get(account,request);if(old){if(old.character!==character||old.diamonds!==offer.diamonds)throw Error('รหัสคำขอซ้ำกับรายการอื่น');this.db.exec('COMMIT');return old;}
   if(this.db.prepare("SELECT count(*) n FROM exchanges WHERE account=? AND status='pending'").get(account).n>=10)throw Error('มีทองรอส่งเข้าเซฟ กรุณารับทองค้างก่อนซื้อแพ็กเพิ่ม');
   if(this.balance(account)<offer.diamonds)throw Error('เพชรไม่เพียงพอ');const id='GX-'+randomBytes(12).toString('hex').toUpperCase();this.db.prepare('INSERT INTO exchanges(id,account,request,character,name,diamonds,gold,created) VALUES(?,?,?,?,?,?,?,?)').run(id,account,request,character,String(name||'นักผจญภัย').slice(0,24),offer.diamonds,offer.gold,Date.now());const row=this.db.prepare('SELECT id,character,name,diamonds,gold,status,created FROM exchanges WHERE id=?').get(id);this.db.exec('COMMIT');return row;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 delivered(account,id){this.db.prepare("UPDATE exchanges SET status='delivered' WHERE account=? AND id=?").run(account,id);}
 createOrder(account,character,name){if(!/^[-\w]{1,80}$/.test(character)||!name?.trim())throw Error('ข้อมูลตัวละครไม่ถูกต้อง');if(this.db.prepare("SELECT count(*) n FROM orders WHERE account=? AND status IN ('awaiting_slip','pending')").get(account).n>=3)throw Error('มีรายการรอตรวจครบ 3 รายการแล้ว');const id='TP-'+randomBytes(8).toString('hex').toUpperCase();this.db.prepare('INSERT INTO orders(id,account,character,name,price,coins,created) VALUES(?,?,?,?,?,?,?)').run(id,account,character,name.trim().slice(0,24),PACKAGE.price,PACKAGE.coins,Date.now());return id;}
 upload(id,account,bytes){const row=this.db.prepare('SELECT * FROM orders WHERE id=? AND account=?').get(id,account);if(!row||row.status!=='awaiting_slip')throw Error('รายการนี้แนบสลิปไม่ได้');const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;if(!mime||bytes.length<32||bytes.length>4*1024*1024)throw Error('ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 4 MB');this.db.prepare("UPDATE orders SET slip=?,mime=?,slip_hash=?,status='pending' WHERE id=?").run(bytes,mime,hash(bytes),id);}
 review(id,decision,reference,note=''){
  this.db.exec('BEGIN IMMEDIATE');try{const row=this.db.prepare('SELECT * FROM orders WHERE id=?').get(id);if(!row)throw Error('ไม่พบรายการ');if(row.status==='approved'&&decision==='approve'&&row.reference===reference){this.db.exec('COMMIT');return;}
  if(row.status!=='pending')throw Error('รายการนี้ไม่อยู่ในสถานะรอตรวจ');if(!['approve','reject'].includes(decision))throw Error('คำสั่งไม่ถูกต้อง');
  if(decision==='approve'){if(!/^[A-Za-z0-9._/-]{6,100}$/.test(reference||''))throw Error('กรอกเลขอ้างอิงธนาคารอย่างน้อย 6 ตัว');this.db.prepare("UPDATE orders SET status='approved',reference=?,note=?,reviewed=? WHERE id=?").run(reference,note.slice(0,200),Date.now(),id);this.db.prepare('INSERT INTO ledger VALUES(?,?,?,?)').run(id,row.account,row.coins,Date.now());}
  else this.db.prepare("UPDATE orders SET status='rejected',note=?,reviewed=? WHERE id=?").run(note.slice(0,200),Date.now(),id);
  this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 close(){this.db.close();}
}
const cookie=(req,key)=>{const s=String(req.headers.cookie||'').split('; ').find(x=>x.startsWith(key+'='));return s?.slice(key.length+1)||'';};
export function topupRoutes(store,{password=process.env.TOPUP_ADMIN_PASSWORD||'',secure=true}={}){
 const limits=new Map();return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/topup'))return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
 const reply=(code,obj)=>{res.writeHead(code);res.end(JSON.stringify(obj));return true;};
 const setCookie=(name,value,age)=>res.setHeader('Set-Cookie',`${name}=${value}; HttpOnly; SameSite=Strict; Path=/api/topup; Max-Age=${age}${secure?'; Secure':''}`);
 if(req.method!=='GET'&&req.headers.origin!==`https://${req.headers.host}`&&!( !secure&&req.headers.origin===`http://${req.headers.host}`))return reply(403,{error:'ต้นทางไม่ถูกต้อง'});
 const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress),minute=Math.floor(Date.now()/60000),key=ip+minute;for(const [k,v]of limits)if(v.minute!==minute)limits.delete(k);const rate=limits.get(key)||{n:0,login:0,minute};rate.n++;limits.set(key,rate);if(rate.n>100||limits.size>10000)return reply(429,{error:'ทำรายการถี่เกินไป กรุณารอสักครู่'});
 const body=async(max=4096)=>{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('ไฟล์หรือข้อมูลมีขนาดใหญ่เกินไป');chunks.push(chunk);}return Buffer.concat(chunks);};
 try{
 if(url.pathname==='/api/topup/admin/login'&&req.method==='POST'){
  if(++rate.login>5)return reply(429,{error:'ลองเข้าสู่ระบบถี่เกินไป'});const {password:given}=JSON.parse((await body()).toString());if(!password||!timingSafeEqual(Buffer.from(hash(String(given||''))),Buffer.from(hash(password))))return reply(401,{error:'รหัสผ่านไม่ถูกต้อง'});
  const secret=token();store.db.prepare('DELETE FROM admin_sessions WHERE expires<?').run(Date.now());store.db.prepare('INSERT INTO admin_sessions VALUES(?,?)').run(hash(secret),Date.now()+8*3600000);setCookie('tilmo_admin',secret,8*3600);return reply(200,{ok:true});
 }
 if(url.pathname.startsWith('/api/topup/admin')){
  const session=store.db.prepare('SELECT secret FROM admin_sessions WHERE secret=? AND expires>?').get(hash(cookie(req,'tilmo_admin')),Date.now());if(!session)return reply(401,{error:'กรุณาเข้าสู่ระบบแอดมิน'});
  if(url.pathname==='/api/topup/admin/logout'&&req.method==='POST'){store.db.prepare('DELETE FROM admin_sessions WHERE secret=?').run(session.secret);setCookie('tilmo_admin','',0);return reply(200,{ok:true});}
  if(url.pathname==='/api/topup/admin/orders'&&req.method==='GET')return reply(200,{orders:store.db.prepare('SELECT id,account,character,name,price,coins,status,created,reviewed,reference,note FROM orders ORDER BY created DESC LIMIT 200').all()});
  const match=url.pathname.match(/^\/api\/topup\/admin\/orders\/(TP-[A-F0-9]+)\/(slip|review)$/);if(match){if(match[2]==='slip'&&req.method==='GET'){const row=store.db.prepare('SELECT slip,mime FROM orders WHERE id=?').get(match[1]);if(!row?.slip)return reply(404,{error:'ไม่พบสลิป'});res.setHeader('Content-Type',row.mime);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.end(Buffer.from(row.slip));return true;}if(match[2]==='review'&&req.method==='POST'){const data=JSON.parse((await body()).toString());store.review(match[1],data.decision,String(data.reference||'').trim(),String(data.note||''));return reply(200,{ok:true});}}
  return reply(404,{error:'ไม่พบข้อมูล'});
 }
 let account=store.account(cookie(req,'tilmo_customer'));
 if(url.pathname==='/api/topup'&&req.method==='GET'){
  let recovery;if(!account){const created=store.createAccount();account=created;recovery=created.secret;setCookie('tilmo_customer',created.secret,365*86400);}
  return reply(200,{account:account.id,recovery,package:PACKAGE,goldPacks:GOLD_PACKS,balance:store.balance(account.id),orders:store.orders(account.id),exchanges:store.exchanges(account.id)});
 }
 if(url.pathname==='/api/topup/restore'&&req.method==='POST'){const {code}=JSON.parse((await body()).toString()),found=store.account(String(code||''));if(!found)return reply(400,{error:'รหัสสำรองไม่ถูกต้อง'});setCookie('tilmo_customer',code,365*86400);return reply(200,{ok:true,account:found.id});}
 if(!account)return reply(401,{error:'เปิดหน้าเติมเงินใหม่อีกครั้ง'});
 if(url.pathname==='/api/topup/exchange'&&req.method==='POST'){const data=JSON.parse((await body()).toString());return reply(200,{exchange:store.exchange(account.id,data)});}
 if(url.pathname==='/api/topup/delivered'&&req.method==='POST'){const {id}=JSON.parse((await body()).toString());store.delivered(account.id,String(id));return reply(200,{ok:true});}
 if(url.pathname==='/api/topup/orders'&&req.method==='POST'){const data=JSON.parse((await body()).toString());return reply(201,{id:store.createOrder(account.id,String(data.character||''),String(data.name||''))});}
 const upload=url.pathname.match(/^\/api\/topup\/orders\/(TP-[A-F0-9]+)\/slip$/);if(upload&&req.method==='PUT'){store.upload(upload[1],account.id,await body(4*1024*1024));return reply(200,{ok:true});}
 return reply(404,{error:'ไม่พบข้อมูล'});
 }catch(error){return reply(400,{error:String(error.message).includes('UNIQUE')?'สลิปหรือเลขอ้างอิงนี้เคยใช้แล้ว':error.message});}
 };}
