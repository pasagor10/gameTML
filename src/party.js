// Party client: joins a 6-character party on the relay and tracks the other members' heroes.
// Members are only drawn (and only help) while they are in the same world as you.
export const PARTY_KEY = 'tilmo-party', SEND_EVERY = .12, STALE_MS = 6000;
export function partyUrl(loc = globalThis.location) {return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/ws`;}
export function cleanPartyCode(code) {return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);}

export class PartyLink {
  constructor({url = partyUrl(), Socket = globalThis.WebSocket, store = globalThis.localStorage, now = () => Date.now()} = {}) {
    this.url = url;this.Socket = Socket;this.store = store;this.now = now;
    this.ws = null;this.code = null;this.you = null;this.members = new Map();this.status = 'idle';this.error = '';
    this.queue = [];this.clock = 0;this.retry = 0;this.want = null;this.onchange = () => {};this.onjoin = () => {};
    try {this.want = cleanPartyCode(store?.getItem(PARTY_KEY)) || null;} catch {}
  }
  remember(code) {this.want = code;try {code ? this.store?.setItem(PARTY_KEY, code) : this.store?.removeItem(PARTY_KEY);} catch {}}
  send(msg) {if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));else this.queue.push(msg);}
  open() {
    if (this.ws && this.ws.readyState <= 1) return;
    if (!this.Socket) {this.status = 'offline';this.error = 'nosocket';this.onchange();return;}
    this.status = 'connecting';this.onchange();
    let ws;try {ws = new this.Socket(this.url);} catch {this.status = 'offline';this.onchange();return;}
    this.ws = ws;
    ws.onopen = () => {this.status = 'online';this.retry = 0;const q = this.queue;this.queue = [];q.forEach(m => this.send(m));this.onchange();};
    ws.onmessage = ev => {let m;try {m = JSON.parse(ev.data);} catch {return;}this.handle(m);};
    ws.onclose = () => {if (this.ws !== ws) return;this.ws = null;this.code = null;this.members.clear();this.status = 'offline';this.retry = Math.min(30, this.retry * 2 || 2);this.onchange();};
    ws.onerror = () => {};
  }
  // Rejoins a remembered party after a reload or a dropped connection.
  resume() {if (this.want && !this.code) {this.open();this.send({t: 'join', code: this.want});}}
  create() {this.error = '';this.open();this.send({t: 'create'});}
  join(code) {code = cleanPartyCode(code);if (code.length !== 6) {this.error = 'badcode';this.onchange();return false;}this.error = '';this.open();this.send({t: 'join', code});return true;}
  leave() {this.send({t: 'leave'});this.remember(null);this.code = null;this.members.clear();this.onchange();}
  handle(m) {
    if (m.t === 'party') {
      const fresh = this.code !== m.code;this.code = m.code;this.you = m.you;this.remember(m.code);this.members.clear();
      for (const x of m.members || []) this.members.set(x.id, this.member(x.id, x.s));
      this.onchange();if (fresh) this.onjoin(m.code);
    } else if (m.t === 'state') {
      const old = this.members.get(m.id);if (old) {old.s = m.s;old.at = this.now();} else {this.members.set(m.id, this.member(m.id, m.s));this.onchange();}
    } else if (m.t === 'gone') {if (this.members.delete(m.id)) this.onchange();}
    else if (m.t === 'error') {this.error = m.why;if (m.why === 'notfound' && this.want && !this.code) this.remember(null);this.onchange();}
    else if (m.t === 'left') {this.code = null;this.members.clear();this.onchange();}
  }
  member(id, s) {return {id, s, x: s.x, y: s.y, at: this.now()};}
  // Called every frame: sends our hero now and then, smooths members toward their last position.
  tick(dt, state) {
    if (!this.code && this.status === 'offline' && this.want) {this.retry -= dt;if (this.retry <= 0) {this.retry = 30;this.resume();}}
    this.clock -= dt;if (this.code && this.clock <= 0 && state) {this.clock = SEND_EVERY;this.send({t: 'state', s: typeof state === 'function' ? state() : state});}
    const k = Math.min(1, dt * 10), now = this.now();
    for (const m of this.members.values()) {
      if (Math.hypot(m.s.x - m.x, m.s.y - m.y) > 400) {m.x = m.s.x;m.y = m.s.y;}
      else {m.x += (m.s.x - m.x) * k;m.y += (m.s.y - m.y) * k;}
      m.stale = now - m.at > STALE_MS;
    }
  }
  list() {return [...this.members.values()];}
}
