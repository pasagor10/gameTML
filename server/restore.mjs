// One-time progress restore codes. An admin creates a code for a player who lost progress
// (tools/restore-code.mjs); the player redeems it once in game to get their level and stage back.
// Codes live in a small JSON file next to the metrics file, re-read on every request so codes
// created from the command line work without restarting the server.
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import crypto from 'node:crypto';

export const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',CODE_LEN=10,MAX_LEVEL=150,LAST_STAGE=150;
export function restorePath(env=process.env){return env.RESTORE_PATH||(env.METRICS_PATH?join(dirname(env.METRICS_PATH),'restore-codes.json'):'data/restore-codes.json');}
export function cleanRestoreCode(code){return String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,CODE_LEN);}

export class RestoreStore{
 constructor(file){this.file=file;}
 read(){try{return JSON.parse(readFileSync(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return {codes:{}};throw e;}}
 write(data){mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file+'.tmp',JSON.stringify(data,null,1));renameSync(this.file+'.tmp',this.file);}
 create({level,cleared=0,note=''},now=Date.now()){
  level=Math.max(1,Math.min(MAX_LEVEL,level|0));cleared=Math.max(0,Math.min(LAST_STAGE,cleared|0));
  const data=this.read();let code;do code=Array.from(crypto.randomBytes(CODE_LEN),b=>CODE_CHARS[b%CODE_CHARS.length]).join('');while(data.codes[code]);
  data.codes[code]={level,cleared,note:String(note).slice(0,80),created:now,used:null};this.write(data);return code;
 }
 redeem(code,who={},now=Date.now()){
  code=cleanRestoreCode(code);const data=this.read(),entry=data.codes[code];
  if(!entry)return {error:'notfound'};if(entry.used)return {error:'used'};
  entry.used={at:now,name:String(who.name||'').slice(0,16),job:String(who.job||'').slice(0,10)};this.write(data);
  return {level:entry.level,cleared:entry.cleared};
 }
}

export function restoreRoutes(store){const rates=new Map();return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/restore')return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.writeHead(405);res.end('{}');return true;}
 if(req.headers.origin&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end('{}');return true;}
 // A few tries per minute per address: codes are long, this only stops brute forcing.
 const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress),minute=Math.floor(Date.now()/60000);for(const [k,v] of rates)if(v.minute!==minute)rates.delete(k);
 const rate=rates.get(ip)||{minute,n:0};rate.n++;rates.set(ip,rate);if(rate.n>8){res.writeHead(429);res.end('{"error":"rate"}');return true;}
 let body='';try{for await(const chunk of req){body+=chunk;if(body.length>1024){res.writeHead(413);res.end('{}');return true;}}
  const {code,name,job}=JSON.parse(body||'{}'),out=store.redeem(code,{name,job});res.writeHead(out.error?400:200);res.end(JSON.stringify(out));}
 catch{res.writeHead(400);res.end('{"error":"bad"}');}
 return true;
};}
