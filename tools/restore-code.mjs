// Create a one-time progress restore code, e.g. on the server:
//   METRICS_PATH=/var/lib/tilmo/metrics.json node tools/restore-code.mjs --level 97 --cleared 64 --note "เคเค mage"
// The file is handed to the service's user so it can mark the code used.
import {chownSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {RestoreStore,restorePath} from '../server/restore.mjs';
const arg=name=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:undefined;};
const level=Number(arg('level')),cleared=Number(arg('cleared')||0),note=arg('note')||'';
if(!(level>=1)){console.error('usage: node tools/restore-code.mjs --level <1-150> [--cleared <0-150>] [--note "name"]');process.exit(1);}
const file=restorePath(),code=new RestoreStore(file).create({level,cleared,note});
try{const {uid,gid}=statSync(dirname(file));chownSync(file,uid,gid);}catch{}
console.log(`${code}  (Lv.${Math.min(150,level|0)}, cleared ${cleared|0}) -> ${file}`);
