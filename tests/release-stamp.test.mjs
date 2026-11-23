import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('static release versions every level of the module graph and replaces old stamps',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'tilmo-stamp-'));
 try{
 await mkdir(path.join(root,'src/nested'),{recursive:true});
 await writeFile(path.join(root,'index.html'),'<script type="module" src="/src/game.js?v=old"></script><link href="/style.css" rel="stylesheet">');
 await writeFile(path.join(root,'src/game.js'),"import {Run} from './model.js'; import('./nested/visual.js?v=old');");
 await writeFile(path.join(root,'src/model.js'),"export {thing} from './nested/visual.js';");
 await writeFile(path.join(root,'src/nested/visual.js'),"import '../model.js';");
 const script=new URL('../tools/stamp-release.py',import.meta.url).pathname;
 execFileSync('python3',[script,root,'release2']);execFileSync('python3',[script,root,'release2']);
 for(const name of ['src/game.js','src/model.js','src/nested/visual.js']){const text=await readFile(path.join(root,name),'utf8');assert.ok(text.includes('?v=release2'));assert.ok(!text.includes('old'));assert.ok(!text.includes('?v=release2?v='));}
 const html=await readFile(path.join(root,'index.html'),'utf8');assert.match(html,/game\.js\?v=release2/);assert.match(html,/style\.css\?v=release2/);
 }finally{await rm(root,{recursive:true,force:true});}
});
