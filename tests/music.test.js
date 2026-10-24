import test from 'node:test';
import assert from 'node:assert/strict';
import { HorrorMusic, MUSIC_LEVEL } from '../src/game/music.js';

function music() {
  const sources = [], gains = [], listeners = {};
  const param = () => ({ events: [], value: 0, cancelScheduledValues(t) { this.events.push(['cancel', t]); },
    setValueAtTime(v, t) { this.events.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); } });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; } });
  const context = { currentTime: 10, state: 'running', createBufferSource() {
    const s = { ...node(), start(...args) { this.started = args; }, stop() { this.stopped = true; } }; sources.push(s); return s;
  }, createGain() { const g = { ...node(), gain: param() }; gains.push(g); return g; } };
  const owner = { context, master: node(), muted: false, paused: false, unavailable: false,
    host: { OfflineAudioContext() {}, localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: () => ({ setAttribute() {},
      addEventListener(k, f) { listeners[k] = f; }, removeEventListener(k) { delete listeners[k]; } }) } } };
  const value = new HorrorMusic(owner); value.buffer = { duration: 17.45 };
  return { value, owner, context, sources, gains, listeners };
}
test('music uses one active loop and resumes the same position after pause and mute', () => {
  const e = music(); e.value.sync(); e.value.sync(); assert.equal(e.sources.length, 1);
  assert.equal(e.sources[0].loop, true);
  e.context.currentTime += 2.25; e.owner.paused = true; e.value.sync();
  assert.equal(e.value.source, null); assert.equal(e.value.position(), 2.25);
  assert.equal(e.sources[0].disconnected, true);
  e.context.currentTime += 20; e.owner.paused = false; e.value.sync();
  assert.equal(e.sources[1].started[1], 2.25);
  e.context.currentTime += .5; e.owner.muted = true; e.value.sync();
  assert.equal(e.value.position(), 2.75); assert.equal(e.value.tail, null);
  e.owner.muted = false; e.value.sync(); assert.equal(e.sources[2].started[1], 2.75);
  e.value.destroy(); assert.ok(e.sources.every(s => s.disconnected && s.stopped)); assert.ok(e.gains.every(g => g.disconnected));
});
test('rapid music toggles dispose retiring loops; game over and destroy release every node', () => {
  const e = music();
  for (let i = 0; i < 20; i++) { e.listeners.click(); e.listeners.click(); }
  assert.equal(e.value.enabled, true);
  assert.equal(e.sources.filter(s => !s.disconnected).length, 1);
  e.value.setEnded(true);
  assert.equal(e.value.source, null); assert.equal(e.value.tail, null); assert.equal(e.value.offset, 0);
  assert.equal(e.sources.filter(s => !s.disconnected).length, 0);
  e.value.sync(); assert.equal(e.value.source, null);
  e.value.restart(); assert.equal(e.value.source.started[1], 0);
  e.value.destroy(); e.value.sync(); assert.equal(e.value.source, null); assert.equal(e.listeners.click, undefined);
});
test('ball-loss duck has a short attack, restrained hold and smooth restoration', () => {
  const e = music(); e.value.sync(); e.value.duck();
  assert.equal(e.value.levelAt(10), MUSIC_LEVEL);
  assert.ok(Math.abs(e.value.levelAt(10.1) - MUSIC_LEVEL * .2) < 1e-9);
  assert.ok(e.value.levelAt(11.1) > MUSIC_LEVEL * .2 && e.value.levelAt(11.1) < MUSIC_LEVEL);
  assert.equal(e.value.levelAt(12), MUSIC_LEVEL);
  const ramps = e.value.gain.gain.events.filter(event => event[0] === 'ramp');
  assert.ok(ramps.some(event => event[1] === MUSIC_LEVEL * .2));
  assert.ok(ramps.some(event => event[1] === MUSIC_LEVEL && event[2] === 11.85));
  e.value.destroy();
});
test('blocked localStorage property access does not prevent audio or the game from constructing', () => {
  const e = music(); e.value.destroy();
  Object.defineProperty(e.owner.host, 'localStorage', { get() { throw Error('blocked'); } });
  const m = new HorrorMusic(e.owner); assert.equal(m.enabled, true); m.destroy();
});
