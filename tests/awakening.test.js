import test from 'node:test';
import assert from 'node:assert/strict';
import { TableLights } from '../src/game/lights.js';
import { RitualAudio } from '../src/game/ritual-audio.js';
import { AWAKEN_DURATION, SpellLights } from '../src/game/spell-lights.js';

function lights(reduced = false) {
  const commands = []; let graphics;
  graphics = new Proxy({}, { get: (_, method) => (...args) => { commands.push([method, ...args]); return graphics; } });
  const button = { addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const host = { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    localStorage: { getItem: () => null }, document: { getElementById: () => button, documentElement: { dataset: {} } } };
  const sim = { shots: [], elapsed: 100, state: { paused: false } };
  return { sim, commands, value: new TableLights({ add: { graphics: () => graphics } }, sim, host) };
}
test('completed ramps awaken eyes in FULL and CALM; entry scores and orbit completions do not', () => {
  for (const reduced of [false, true]) {
    const { sim, value } = lights(reduced);
    value.pulse('bumper:0', 'bumper', { x: 250, y: 250 });
    value.pulse('left-ramp', 'ramp', { x: 185, y: 455 });
    value.completeSpell({ kind: 'orbit' });
    assert.equal(value.cues.has('eyes'), false);
    value.completeSpell({ kind: 'ramp' });
    assert.deepEqual(value.cues.get('eyes'), { kind: 'eyes', x: 0, y: 0, at: sim.elapsed, until: sim.elapsed + AWAKEN_DURATION });
  }
});
test('switching light modes preserves the completion timestamp and full remaining lifetime', () => {
  const { sim, value } = lights(); value.awaken();
  const original = { ...value.cues.get('eyes') };
  sim.elapsed += 600; value.setReduced(true);
  assert.deepEqual(value.cues.get('eyes'), original);
  value.setReduced(false); assert.deepEqual(value.cues.get('eyes'), original);
  sim.state.paused = true; value.draw(); assert.deepEqual(value.cues.get('eyes'), original);
  sim.state.paused = false; sim.elapsed = original.until; value.draw();
  assert.equal(value.cues.has('eyes'), false);
});
test('CALM eyes have stationary amber geometry, no white flare, and expire', () => {
  const commands = []; let g;
  g = new Proxy({}, { get: (_, name) => (...args) => { commands.push([name, ...args]); return g; } });
  const effect = new SpellLights({ shots: [] }, g, g);
  effect.drawEyes(500, true); const first = structuredClone(commands); commands.length = 0;
  effect.drawEyes(900, true); assert.deepEqual(commands, first);
  assert.equal(commands.filter(c => c[0] === 'fillEllipse').length, 4);
  assert.equal(commands.some(c => c.includes(0xfffbe1)), false);
  commands.length = 0; effect.drawEyes(2550, true); assert.equal(commands.length, 0);
});
test('chant defaults ON for new/blocked storage and honours both saved preferences', () => {
  for (const [saved, expected] of [[null, true], ['true', true], ['false', false], ['invalid', true], [undefined, true]]) {
    const attributes = {}, listeners = {};
    const button = { setAttribute: (k, v) => { attributes[k] = v; }, addEventListener: (k, v) => { listeners[k] = v; }, removeEventListener: k => { delete listeners[k]; } };
    const storage = { getItem() { if (saved === undefined) throw Error('blocked'); return saved; }, setItem(k, v) { attributes[k] = v; } };
    const a = new RitualAudio({ host: { localStorage: storage, document: { getElementById: () => button } } });
    assert.equal(a.chantEnabled, expected); assert.equal(button.textContent, expected ? 'CHANT: ON' : 'CHANT: OFF');
    listeners.click(); assert.equal(attributes['roll4sanity-chant'], String(!expected));
    a.destroy(); assert.equal(listeners.click, undefined);
  }
});
