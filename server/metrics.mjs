import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
export const SEEN_MAX=300,SEEN_DAYS=30,RECENT_LIST=60,RANK_LIST=50;
export const dayOf=now=>new Date(now+7*3600000).toISOString().slice(0,10);
export class Metrics{
 constructor(file=null){this.file=file;this.days={};this.seen={};this.since=Date.now();this.dirty=false;this.getHub=null;if(file){try{const data=JSON.parse(readFileSync(file,'utf8'));this.days=data.days||{};this.seen=data.seen||{};this.since=data.since||this.since;}catch(e){if(e.code!=='ENOENT')throw e;}}}
 record(event,now=Date.now()){
  if(!['visit','start','character','play'].includes(event?.type)||!/^[-\w]{8,80}$/.test(event.visitor||''))return false;
  const day=dayOf(now),visitor=createHash('sha256').update(event.visitor).digest('hex').slice(0,24);
  const row=this.days[day]??={visitors:{},visits:0,starts:0,characters:0,seconds:0};
  if(!row.visitors[visitor]){if(Object.keys(row.visitors).length>=50000)return false;row.visitors[visitor]=1;}
  if(event.type==='visit')row.visits++;if(event.type==='start')row.starts++;if(event.type==='character')row.characters++;if(event.type==='play')row.seconds+=Math.min(30,Math.max(0,Number(event.seconds)||0));
  const cutoff=dayOf(now-90*86400000);for(const key of Object.keys(this.days))if(key<cutoff)delete this.days[key];this.dirty=true;return true;
 }
 // Remembers when each hero (name + class) was last connected, for the "recently played" list.
 observe(hub,now=Date.now()){
  if(!hub)return;for(const c of hub.clients){const s=c.state;if(!s||now-c.at>=45000)continue;const key=s.name+'|'+s.job,old=this.seen[key];
   this.seen[key]={name:s.name,level:s.lv,job:s.job,stage:s.stage,hard:!!s.hard,cleared:Math.max(s.hard?0:s.cleared|0,old?.cleared|0),cp:Math.max(s.cp||0,old?.cp||0),first:old?.first||now,last:now};this.dirty=true;}
  const cutoff=now-SEEN_DAYS*86400000;for(const k of Object.keys(this.seen))if(this.seen[k].last<cutoff){delete this.seen[k];this.dirty=true;}
  const extra=Object.keys(this.seen).length-SEEN_MAX;if(extra>0)for(const [k] of Object.entries(this.seen).sort((a,b)=>a[1].last-b[1].last).slice(0,extra))delete this.seen[k];
 }
 // Public leaderboard: real heroes seen in the last 30 days, plus who is connected right now.
 ranking(hub,now=Date.now()){
  this.observe(hub,now);const active=hub?[...hub.clients].filter(c=>c.state&&now-c.at<45000):[];
  const online=active.map(({state:s})=>({name:s.name,level:s.lv,job:s.job,stage:s.stage,hard:!!s.hard}));
  const top=Object.values(this.seen).map(p=>({name:p.name,job:p.job,level:p.level,cleared:p.cleared|0,cp:Math.round(p.cp||0),online:now-p.last<45000}))
   .sort((a,b)=>b.level-a.level||b.cleared-a.cleared||b.cp-a.cp).slice(0,RANK_LIST);
  return {at:now,online,top};
 }
 flush(){this.observe(this.getHub?.());if(!this.file||!this.dirty)return;mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file+'.tmp',JSON.stringify({since:this.since,days:this.days,seen:this.seen}));renameSync(this.file+'.tmp',this.file);this.dirty=false;}
 snapshot(hub,{days=7,now=Date.now()}={}){
  days=[7,30,90].includes(days)?days:7;this.observe(hub,now);const series=[];for(let i=days-1;i>=0;i--){const day=dayOf(now-i*86400000),r=this.days[day]||{};series.push({day,visitors:Object.keys(r.visitors||{}).length,visits:r.visits||0,starts:r.starts||0,characters:r.characters||0,minutes:Math.round((r.seconds||0)/60)});}
  const active=[...hub.clients].filter(c=>c.state&&now-c.at<45000);const classes={novice:0,knight:0,mage:0,gunner:0},levels={'1–9':0,'10–19':0,'20–29':0,'30+':0},stages={};for(const {state:s} of active){classes[s.job]=(classes[s.job]||0)+1;levels[s.lv<10?'1–9':s.lv<20?'10–19':s.lv<30?'20–29':'30+']++;stages[s.stage]=(stages[s.stage]||0)+1;}
  const unique=new Set();for(const r of series)for(const key of Object.keys(this.days[r.day]?.visitors||{}))unique.add(key);
  return {at:now,since:this.since,today:series.at(-1),series,summary:{visitors:unique.size,starts:series.reduce((n,r)=>n+r.starts,0),characters:series.reduce((n,r)=>n+r.characters,0),minutes:series.reduce((n,r)=>n+r.minutes,0)},players:active.map(({state:s})=>({name:s.name,level:s.lv,job:s.job,stage:s.stage,hard:s.hard})).sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name,'th')),recent:Object.values(this.seen).sort((a,b)=>b.last-a.last).slice(0,RECENT_LIST).map(p=>({...p,online:now-p.last<45000})),online:active.length,parties:[...hub.parties.values()].filter(p=>[...p].some(c=>active.includes(c))).length,classes,levels,stages};
 }
}
export function metricsRoutes(metrics,getHub){const rates=new Map();metrics.getHub=getHub;return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!['/api/dashboard','/api/analytics','/api/ranking'].includes(url.pathname))return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(url.pathname==='/api/ranking'&&req.method==='GET'){res.end(JSON.stringify(metrics.ranking(getHub())));return true;}
 if(url.pathname==='/api/dashboard'&&req.method==='GET'){res.end(JSON.stringify(metrics.snapshot(getHub(),{days:Number(url.searchParams.get('days'))})));return true;}
 if(url.pathname!=='/api/analytics'||req.method!=='POST'){res.writeHead(405);res.end('{}');return true;}
 if(req.headers.origin&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end('{}');return true;}
 const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress),minute=Math.floor(Date.now()/60000),key=ip+minute;for(const [k,v] of rates)if(v.minute!==minute)rates.delete(k);
 const rate=rates.get(key)||{minute,n:0};rate.n++;rates.set(key,rate);if(rate.n>120||rates.size>10000){res.writeHead(429);res.end('{}');return true;}
 let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2048){res.writeHead(413);res.end('{}');return true;}}const valid=metrics.record(JSON.parse(body));res.writeHead(valid?202:400);res.end('{}');}catch{res.writeHead(400);res.end('{}');}return true;
 };}
