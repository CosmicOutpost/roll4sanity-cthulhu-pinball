import test from 'node:test';
import assert from 'node:assert/strict';
import { TableLights } from '../src/game/lights.js';
import { HorrorMusic } from '../src/game/music.js';
import { AWAKEN_DURATION, SpellLights, awakeningStrength } from '../src/game/spell-lights.js';
import { eyePalette, EYE_PALETTES } from '../src/game/eye-colours.js';
import { SHOTS, samplePath } from '../src/game/table.js';

function lights(reduced = false) {
  const commands = []; let graphics;
  graphics = new Proxy({}, { get: (_, method) => (...args) => { commands.push([method, ...args]); return graphics; } });
  const button = { addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const host = { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }),
    localStorage: { getItem: () => null }, document: { getElementById: () => button, documentElement: { dataset: {} } } };
  const sim = { shots: SHOTS.map(s => ({ ...s, path: samplePath(s.points) })), elapsed: 100, state: { paused: false } };
  return { sim, commands, value: new TableLights({ add: { graphics: () => graphics } }, sim, host) };
}
test('all four real shot IDs and kinds select the correct eyes, independent of shot order, in FULL and CALM', () => {
  const expected = { 'left-ramp': 0x21e58d, 'right-ramp': 0xf23c55, 'left-orbit': 0x329dff, 'right-orbit': 0xaf58ff };
  for (const reduced of [false, true]) {
    const { sim, value } = lights(reduced);
    value.pulse('bumper:0', 'bumper', { x: 250, y: 250 });
    value.pulse('left-ramp', 'ramp', { x: 185, y: 455 });
    assert.equal(value.cues.has('eyes'), false);
    for (const shot of [...sim.shots].reverse()) {
      value.completeSpell(shot);
      const cue = value.cues.get('eyes');
      assert.equal(cue.shotId, shot.id); assert.equal(cue.palette.colour, expected[shot.id]);
      assert.equal(cue.palette.kind, shot.kind); assert.equal(cue.at, sim.elapsed); assert.equal(cue.until, sim.elapsed + AWAKEN_DURATION);
    }
  }
});
test('unknown IDs, launch guides and mismatched kinds never awaken the eyes', () => {
  const { value } = lights();
  for (const shot of [undefined, { id: 'constructor' }, { id: 'toString' }, { id: 'launch', kind: 'launch' }, { id: 'new-ramp', kind: 'ramp' }, { id: 'left-ramp', kind: 'orbit' }, { id: 'right-orbit', kind: 'ramp' }]) {
    assert.equal(eyePalette(shot), null);
    if (shot) value.awaken(shot);
    assert.equal(value.cues.has('eyes'), false);
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
test('CALM eyes have stationary shot-colour geometry, no white flare or rays, and expire', () => {
  const commands = []; let g;
  g = new Proxy({}, { get: (_, name) => (...args) => { commands.push([name, ...args]); return g; } });
  const effect = new SpellLights({ shots: [] }, g, g);
  effect.drawEyes(500, true); const first = structuredClone(commands); commands.length = 0;
  effect.drawEyes(900, true); assert.deepEqual(commands, first);
  assert.equal(commands.filter(c => c[0] === 'fillEllipse').length, 4);
  assert.equal(commands.some(c => c[0] === 'lineStyle'), false);
  commands.length = 0; effect.drawEyes(2550, true); assert.equal(commands.length, 0);
});
test('every overlapping colour pair replaces one cue without a dark blink, mixed palette or stale expiry', () => {
  for (const reduced of [false, true]) for (const first of SHOTS) for (const next of SHOTS) {
    const { sim, value } = lights(reduced);
    value.awaken(first); sim.elapsed += 500;
    const old = value.cues.get('eyes');
    value.awaken(next); const current = value.cues.get('eyes');
    assert.notEqual(current, old); assert.equal(value.cues.size, 1);
    assert.equal(current.shotId, next.id); assert.equal(current.palette, EYE_PALETTES[next.id]);
    assert.equal(current.initialStrength, 1);
    assert.equal(awakeningStrength(0, current.initialStrength), 1);
    assert.equal(current.until, sim.elapsed + 2550);
    value.setReduced(!reduced); assert.equal(value.cues.get('eyes'), current);
    sim.elapsed = current.until; value.draw(); assert.equal(value.cues.has('eyes'), false);
  }
});
test('both eyes use the same palette, white-hot centres and unchanged geometry for every mapping', () => {
  for (const palette of Object.values(EYE_PALETTES)) for (const reduced of [false, true]) {
    const ellipses = []; let colour;
    const g = { fillStyle(c) { colour = c; return this; }, fillEllipse(x, y, w, h) { ellipses.push({ x, y, w, h, colour }); return this; },
      lineStyle() { return this; }, beginPath() { return this; }, moveTo() { return this; }, lineTo() { return this; }, strokePath() { return this; } };
    new SpellLights({ shots: [] }, g, g).drawEyes(500, reduced, palette);
    const count = reduced ? 2 : 6;
    assert.equal(ellipses.length, count * 2);
    assert.deepEqual(ellipses.slice(0, count).map(e => ({ ...e, x: e.x + 80 })), ellipses.slice(count));
    assert.deepEqual([ellipses[0].x, ellipses[0].y], [230, 391]);
    assert.equal(ellipses[0].colour, palette.colour);
    if (!reduced) {
      assert.deepEqual([ellipses[0].w, ellipses[0].h], [94, 60]);
      for (const shift of [16, 8, 0]) assert.ok(((palette.centre >> shift) & 255) >= 240);
    }
  }
});
test('music defaults ON for new/blocked storage and honours both saved preferences', () => {
  for (const [saved, expected] of [[null, true], ['true', true], ['false', false], ['invalid', true], [undefined, true]]) {
    const attributes = {}, listeners = {};
    const button = { setAttribute: (k, v) => { attributes[k] = v; }, addEventListener: (k, v) => { listeners[k] = v; }, removeEventListener: k => { delete listeners[k]; } };
    const storage = { getItem() { if (saved === undefined) throw Error('blocked'); return saved; }, setItem(k, v) { attributes[k] = v; } };
    const a = new HorrorMusic({ host: { localStorage: storage, document: { getElementById: () => button } } });
    assert.equal(a.enabled, expected); assert.equal(button.textContent, expected ? 'MUSIC: ON' : 'MUSIC: OFF');
    listeners.click(); assert.equal(attributes['roll4sanity-music'], String(!expected));
    a.destroy(); assert.equal(listeners.click, undefined);
  }
});
