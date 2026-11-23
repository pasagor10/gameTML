import {TopupStore,topupRoutes} from './topup.mjs';
const topups=new TopupStore(process.env.TOPUP_DB_PATH||'data/topup.sqlite');const payments=topupRoutes(topups);
// Standalone party relay for production: nginx proxies wss://<host>/ws to this process.
import http from 'node:http';
import {attachParty} from './party.mjs';
import {Metrics,metricsRoutes} from './metrics.mjs';
const metrics=new Metrics(process.env.METRICS_PATH||'data/metrics.json');let hub;const routes=metricsRoutes(metrics,()=>hub);

const port = Number(process.env.PARTY_PORT || 5191);
const server = http.createServer(async(req, res) => {if(await payments(req,res)||await routes(req,res))return;res.writeHead(200, {'Content-Type': 'text/plain'});res.end('tilmo party ok');});
hub = attachParty(server);
setInterval(()=>metrics.flush(),10000).unref();
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{metrics.flush();topups.close();process.exit(0);});
server.listen(port, '127.0.0.1', () => console.log(`TILMO party relay on 127.0.0.1:${port} (/ws)`));
setInterval(() => console.log(`parties=${hub.parties.size}`), 600000).unref();
