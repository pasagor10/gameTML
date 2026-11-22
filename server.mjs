import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);const file=path.resolve(root,name);if(!file.startsWith(root)||!['index.html','style.css','sprite-lab.html'].includes(name)&&!name.startsWith('src/')&&!name.startsWith('assets/sprites/heroes/')&&!name.startsWith('assets/generated/v1/')&&!name.startsWith('assets/scenes/')&&!name.startsWith('assets/monsters/')&&!name.startsWith('assets/brand/')&&!name.startsWith('assets/sfx/')&&!name.startsWith('assets/music/')&&!name.startsWith('assets/weapons/')){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT||5174),'127.0.0.1',()=>console.log('TILMO ready: http://localhost:5174'));
