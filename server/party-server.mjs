// Standalone party relay for production: nginx proxies wss://<host>/ws to this process.
import http from 'node:http';
import {attachParty} from './party.mjs';

const port = Number(process.env.PARTY_PORT || 5191);
const server = http.createServer((req, res) => {res.writeHead(200, {'Content-Type': 'text/plain'});res.end('tilmo party ok');});
const hub = attachParty(server);
server.listen(port, '127.0.0.1', () => console.log(`TILMO party relay on 127.0.0.1:${port} (/ws)`));
setInterval(() => console.log(`parties=${hub.parties.size}`), 600000).unref();
