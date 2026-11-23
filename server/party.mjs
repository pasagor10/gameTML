// Party relay: players share a 6-character code and see each other's heroes in the same world.
// The server only relays presence; every client keeps its own monsters and applies ally hits
// locally. WebSocket framing is implemented here so the server needs no dependencies.
import crypto from 'node:crypto';

export const PARTY_MAX = 4, CODE_LEN = 6, CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', MAX_FRAME = 16384, STATE_PER_SEC = 20, RAID_SEND_MS = 200, TOP_TIER = 10;

export function makeCode(rng = Math.random) {let s = '';for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[Math.floor(rng() * CODE_CHARS.length)];return s;}
export function cleanCode(code) {return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);}

const num = (v, lo, hi, d = 0) => {const n = Number(v);return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;};
// Only known fields with clamped values are relayed to other players.
export function cleanState(s = {}) {
  if(!s || typeof s!=='object')s={};
  return {
    name: String(s.name || 'TILMO').slice(0, 16), job: ['knight', 'mage', 'gunner', 'novice'].includes(s.job) ? s.job : 'novice',
    app: s.app === 'b' ? 'b' : 'a', tier: num(s.tier, 0, TOP_TIER) | 0, armor: num(s.armor, -1, TOP_TIER, -1) | 0, helmet: num(s.helmet, -1, TOP_TIER, -1) | 0,
    lv: num(s.lv, 1, 999, 1) | 0, cp: num(s.cp, 0, 1e15), hit: num(s.hit, 0, 1e15), stage: num(s.stage, 1, 60, 1) | 0, hard: !!s.hard,
    cleared: num(s.cleared, 0, 60) | 0, raid: !!s.raid, x: num(s.x, -5000, 5000), y: num(s.y, -5000, 5000), mv: !!s.mv, atk: !!s.atk,
    face: s.face < 0 ? -1 : 1, dir: ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'].includes(s.dir) ? s.dir : 'se', hp: num(s.hp, 0, 1, 1),
    // World boss: which 10-minute window, damage so far and where the hero stands relative to the boss.
    rw: s.raid ? num(s.rw, 0, 1e9) | 0 : 0, dmg: s.raid ? num(s.dmg, 0, 1e18) : 0, rx: num(s.rx, -3000, 3000), ry: num(s.ry, -3000, 3000)
  };
}

// Transport-free party bookkeeping, so it can be tested without sockets.
export class PartyHub {
  constructor(rng = Math.random) {this.rng = rng;this.parties = new Map();this.clients = new Set();this.next = 1;}
  connect(send) {const c = {id: this.next++, send, code: null, state: null, budget: STATE_PER_SEC, at: 0, chatBudget: 5, chatAt: 0};this.clients.add(c);return c;}
  members(code) {return [...(this.parties.get(code) || [])];}
  others(c) {return this.members(c.code).filter(m => m !== c);}
  roster(c) {return this.others(c).filter(m => m.state).map(m => ({id: m.id, s: m.state}));}
  message(c, msg, now = Date.now()) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'chat') {
      const channel = msg.channel;
      if (!['world','party'].includes(channel) || !c.state || (channel === 'party' && !c.code)) {c.send({t:'chatError',why:'unavailable'});return;}
      const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0,200);
      if (!text) return;
      c.chatBudget = Math.min(5,c.chatBudget + Math.max(0,now-c.chatAt)/2000);c.chatAt=now;
      if(c.chatBudget<1){c.send({t:'chatError',why:'rate'});return;}c.chatBudget--;
      const message={t:'chat',channel,text,name:c.state.name,job:c.state.job,lv:c.state.lv,id:c.id,at:now};
      for(const peer of channel==='party'?this.members(c.code):this.clients)peer.send(message);
    } else if (msg.t === 'create') {
      this.leave(c);let code;do code = makeCode(this.rng);while (this.parties.has(code));
      this.parties.set(code, new Set([c]));c.code = code;c.send({t: 'party', code, you: c.id, members: []});
    } else if (msg.t === 'join') {
      const code = cleanCode(msg.code), party = this.parties.get(code);
      if (code === c.code) {c.send({t: 'party', code, you: c.id, members: this.roster(c)});return;}
      if (!party) {c.send({t: 'error', why: 'notfound'});return;}
      if (party.size >= PARTY_MAX) {c.send({t: 'error', why: 'full'});return;}
      this.leave(c);party.add(c);c.code = code;c.send({t: 'party', code, you: c.id, members: this.roster(c)});
    } else if (msg.t === 'leave') {this.leave(c);c.send({t: 'left'});}
    else if (msg.t === 'state') {
      // A small token bucket keeps one client from flooding the party.
      c.budget = Math.min(STATE_PER_SEC, c.budget + (now - c.at) / 1000 * STATE_PER_SEC);c.at = now;
      if (c.budget < 1) return;c.budget--;
      const fresh = !c.state;c.state = cleanState(msg.s);this.raidState(c, now);if (!c.code) return;
      for (const m of this.others(c)) m.send({t: 'state', id: c.id, s: c.state, fresh});
    }
  }
  // Everyone fighting the world boss in the same window sees each other, party or not.
  raiders(c, win = c.raidWin) {return [...this.clients].filter(m => m !== c && win && m.raidWin === win);}
  raidState(c, now) {
    const was = c.raidWin || 0, win = c.state.raid && c.state.rw || 0;c.raidWin = win;
    if (was && was !== win) for (const m of this.raiders(c, was)) m.send({t: 'raidGone', id: c.id});
    if (!win || now - (c.raidAt || 0) < RAID_SEND_MS) return;c.raidAt = now;
    for (const m of this.raiders(c)) m.send({t: 'raider', id: c.id, s: c.state});
  }
  leave(c) {
    const code = c.code;if (!code) return;const party = this.parties.get(code);c.code = null;if (!party) return;
    party.delete(c);if (!party.size) {this.parties.delete(code);return;}
    for (const m of party) m.send({t: 'gone', id: c.id});
  }
  close(c) {this.leave(c);for (const m of this.raiders(c)) m.send({t: 'raidGone', id: c.id});c.raidWin = 0;this.clients.delete(c);}
}

function frame(text) {
  const body = Buffer.from(text), n = body.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
  return head ? Buffer.concat([head, body]) : null;
}

// Upgrades `path` on an http server to the party WebSocket.
export function attachParty(server, {path = '/ws', hub = new PartyHub()} = {}) {
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x'), key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {socket.destroy();return;}
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);
    let buf = Buffer.alloc(0), alive = true;
    const send = msg => {if (socket.writable) {const f = frame(JSON.stringify(msg));if (f) socket.write(f);}};
    const client = hub.connect(send);
    const done = () => {if (!alive) return;alive = false;clearInterval(ping);hub.close(client);socket.destroy();};
    let pong = true;const ping = setInterval(() => {if (!pong) return done();pong = false;if (socket.writable) socket.write(Buffer.from([0x89, 0]));}, 25000);
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const op = buf[0] & 15, masked = buf[1] & 128;let len = buf[1] & 127, at = 2;
        if (len === 126) {if (buf.length < 4) return;len = buf.readUInt16BE(2);at = 4;}
        else if (len === 127) return done();
        if (!masked || len > MAX_FRAME) return done();
        if (buf.length < at + 4 + len) return;
        const mask = buf.subarray(at, at + 4), data = Buffer.from(buf.subarray(at + 4, at + 4 + len));
        for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
        buf = buf.subarray(at + 4 + len);
        if (op === 8) return done();
        if (op === 9) {if (socket.writable) socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data]));continue;}
        if (op === 10) {pong = true;continue;}
        if (op === 1) {pong = true;let msg;try {msg = JSON.parse(data.toString('utf8'));} catch {continue;}hub.message(client, msg);}
      }
    });
    socket.on('close', done);socket.on('error', done);
  });
  return hub;
}
