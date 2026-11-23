import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
const source=process.env.TOPUP_DB_PATH||'/var/lib/tilmo/topup.sqlite',directory='/var/backups/tilmo';
mkdirSync(directory,{recursive:true,mode:0o700});
const destination=directory+'/topup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite',db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,destination);chmodSync(destination,0o600);const check=new DatabaseSync(destination,{readOnly:true});try{if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup verification failed');console.log('Top-up backup verified');}finally{check.close();}}finally{db.close();}
