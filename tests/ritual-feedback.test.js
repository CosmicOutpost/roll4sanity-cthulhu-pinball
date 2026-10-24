import test from 'node:test';
import assert from 'node:assert/strict';
import { GuidedFeedback } from '../src/game/guided-feedback.js';
import { SpellLights, awakeningStrength, AWAKEN_DURATION } from '../src/game/spell-lights.js';
import { SHOTS, samplePath, pointOnPath } from '../src/game/table.js';

// Presentation models only: no physics steps, artificial drains or whole games.
function observer(kind = 'ramp') {
  const shot = { kind, duration: 1950 }, travel = { shot, started: 100 };
  const sim = { elapsed: 100, ball: {}, travel, state: { paused: false, phase: 'playing' } };
  const calls = [];
  const lights = Object.fromEntries(['cancelSpell', 'completeSpell', 'beginSpell'].map(k => [k, arg => calls.push([k, arg])]));
  const audio = Object.fromEntries(['startSpell', 'updateSpell', 'endSpell'].map(k => [k, (...args) => calls.push([k, ...args])]));
  return { sim, calls, shot, travel, feedback: new GuidedFeedback(sim, lights, audio) };
}
test('guide observer starts once, follows actual progress and rewards completion once', () => {
  for (const kind of ['ramp', 'orbit']) {
    const e = observer(kind); e.feedback.update();
    e.sim.elapsed += 975; e.feedback.update();
    assert.deepEqual(e.calls.filter(c => c[0] === 'startSpell'), [['startSpell', 0, true]]);
    assert.deepEqual(e.calls.find(c => c[0] === 'updateSpell'), ['updateSpell', .5]);
    e.sim.elapsed = 2050; e.sim.travel = null; e.feedback.update(); e.feedback.update();
    assert.deepEqual(e.calls.filter(c => c[0] === 'completeSpell'), [['completeSpell', e.shot]]);
    assert.deepEqual(e.calls.at(-1), ['endSpell', true, kind]);
  }
});
test('interruption, replacement ball, launch and restart never reward a completed ritual', () => {
  for (const interrupt of [e => { e.sim.elapsed = 300; }, e => { e.sim.ball = {}; }, e => { e.sim.state.phase = 'ready'; }]) {
    const e = observer(); e.feedback.update(); e.sim.elapsed = 3000; e.sim.travel = null; interrupt(e); e.feedback.update();
    assert.equal(e.calls.some(c => c[0] === 'completeSpell'), false);
    assert.deepEqual(e.calls.at(-1), ['endSpell', false, 'ramp']);
  }
  const e = observer('launch'); e.feedback.update(); assert.equal(e.calls.length, 0);
  const r = observer(); r.feedback.update(); r.feedback.reset(); r.sim.travel = null; r.sim.elapsed = 3000; r.feedback.update();
  assert.equal(r.calls.some(c => c[0] === 'completeSpell'), false);
});
test('pause preserves guide identity without queuing starts or completions', () => {
  const e = observer(); e.feedback.update(); const before = e.calls.length;
  e.sim.state.paused = true; e.feedback.update(); e.feedback.update(); assert.equal(e.calls.length, before);
  e.sim.state.paused = false; e.feedback.update(); assert.deepEqual(e.calls.at(-1), ['updateSpell', 0]);
});
test('awakening has 250ms attack, 800ms peak and 1500ms smooth fade, then stays dark', () => {
  assert.equal(AWAKEN_DURATION, 2550);
  for (const age of [-10, 0, 2550, 10000]) assert.equal(awakeningStrength(age), 0);
  for (const age of [250, 500, 1050]) assert.equal(awakeningStrength(age), 1);
  assert.equal(awakeningStrength(125), .5);
  assert.equal(awakeningStrength(1800), .5);
});
test('spell heads sample all four existing paths, CALM has no chase and history is bounded', () => {
  const graphics = () => { let g; g = new Proxy({}, { get: () => () => g }); return g; };
  const shots = SHOTS.map(s => ({ ...s, path: samplePath(s.points) }));
  const sim = { shots, elapsed: 0, travel: null }, lights = new SpellLights(sim, graphics(), graphics());
  for (const shot of shots) {
    sim.travel = { shot, started: 0 }; lights.begin(sim.travel);
    for (const p of [0, .3, .85, .99]) {
      sim.elapsed = p * shot.duration;
      const result = lights.draw(false);
      assert.equal(result.id, shot.id);
      assert.deepEqual(result.head, pointOnPath(shot.path, p));
      assert.equal(lights.draw(true), null);
    }
    lights.complete(shot);
  }
  assert.equal(lights.completions.length, 2);
  sim.elapsed += 1100; lights.draw(false); assert.equal(lights.completions.length, 0);
});

test('CALM drawing commands stay stationary throughout a guided journey', () => {
  const commands = []; let g;
  g = new Proxy({}, { get: (_, key) => (...args) => { commands.push([key, ...args]); return g; } });
  const shot = { ...SHOTS[0], path: samplePath(SHOTS[0].points) };
  const sim = { shots: [shot], elapsed: 200, travel: { shot, started: 0 } };
  const lights = new SpellLights(sim, g, g); lights.begin(sim.travel);
  lights.draw(true); const early = structuredClone(commands); commands.length = 0;
  sim.elapsed = 1200; lights.draw(true);
  assert.ok(early.length > 0);
  assert.deepEqual(commands, early);
});
