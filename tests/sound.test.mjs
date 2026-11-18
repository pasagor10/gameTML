import test from 'node:test';
import assert from 'node:assert/strict';

test('area recordings switch, fade, retry autoplay and respect music mute', async () => {
  const tracks = [], timers = [], gains = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { assert.ok(Number.isFinite(v) && v > 0); this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect(other) { return other; }, disconnect() {} });
  class Context {
    currentTime = 1; sampleRate = 100; state = 'running'; destination = node();
    createGain() { const g = { ...node(), gain: param() }; gains.push(g); return g; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), ratio: param() }; }
    createConvolver() { return node(); }
    createOscillator() { return { ...node(), frequency: { ...param(), exponentialRampToValueAtTime() {} }, detune: param(), start(t) { assert.ok(Number.isFinite(t)); }, stop(t) { assert.ok(Number.isFinite(t)); } }; }
    createBufferSource() { return { ...node(), start(t) { assert.ok(Number.isFinite(t)); }, stop(t) { assert.ok(Number.isFinite(t)); } }; }
    createBiquadFilter() { return { ...node(), Q: param(), frequency: { ...param(), exponentialRampToValueAtTime() {} } }; }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createMediaElementSource() { return node(); }
  }
  const originals = { window: globalThis.window, localStorage: globalThis.localStorage, Audio: globalThis.Audio, setTimeout: globalThis.setTimeout };
  globalThis.window = { AudioContext: Context, addEventListener() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.Audio = class {
    paused = true; plays = 0;
    constructor(src) { this.src = src; tracks.push(this); }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
  };
  globalThis.setTimeout = (fn) => timers.push(fn);
  try {
    const audio = await import(`../public/sound.js?test=${Date.now()}`);
    audio.music('town');
    assert.equal(tracks.length, 0);
    audio.unlockAudio();
    assert.match(tracks[0].src, /town.mp3$/);
    audio.music('town');
    assert.equal(tracks.length, 1);
    tracks[0].paused = true;
    audio.unlockAudio();
    assert.equal(tracks[0].plays, 2);
    audio.music('dungeon');
    assert.match(tracks[1].src, /battle.mp3$/);
    audio.music('boss');
    assert.match(tracks[2].src, /boss-epic.ogg$/);
    timers.splice(0).forEach(fn => fn());
    assert.equal(tracks[0].paused, true);
    assert.equal(tracks[1].paused, true);
    assert.equal(tracks[2].paused, false);
    for (const effect of ['swing', 'slash', 'arrow', 'volley', 'cast', 'spell', 'hit', 'crit']) {
      const before = gains.length;
      audio.sfx(effect, { class: 'mage', volume: 0.35 }, 0);
      assert.ok(gains.length > before + 1, `${effect} schedules layered voices`);
      assert.equal(gains[before].gain.value, 0.35);
    }
    audio.setMusic(false);
    assert.equal(gains[2].gain.value, 0);
    audio.music(null);
    timers.splice(0).forEach(fn => fn());
    assert.equal(tracks[2].paused, true);
  } finally { Object.assign(globalThis, originals); }
});
