import test from 'node:test';
import Matter from 'matter-js';
import assert from 'node:assert/strict';
import { PinballPhysics } from '../src/game/physics.js';
import { TableLights } from '../src/game/lights.js';
import { ArcadeFeedback } from '../src/game/feedback.js';

function environment({ reduced = false, blocked = false } = {}) {
  const node = () => ({ textContent: '', title: '', dataset: {},
    setAttribute(k, v) { this[k] = v; }, classList: { toggle() {} },
    addEventListener(k, f) { this[k] = f; }, removeEventListener(k) { delete this[k]; } });
  const nodes = new Map(['motion', 'sound', 'score-feedback'].map(id => [id, node()]));
  const media = { ...node(), matches: reduced };
  const host = { ...node(), document: { ...node(), documentElement: node(), getElementById: id => nodes.get(id) },
    matchMedia: () => media, localStorage: { getItem() { if (blocked) throw Error('blocked'); return null; }, setItem() { if (blocked) throw Error('blocked'); } } };
  const graphics = [];
  const scene = { add: { graphics() {
    const g = new Proxy({ depth: 0, commands: 0 }, { get(target, key) {
      if (key in target) return target[key];
      return (...args) => { target.commands++; if (key === 'setDepth') target.depth = args[0]; return g; };
    } });
    graphics.push(g); return g;
  } } };
  globalThis.window = host; globalThis.document = host.document;
  const sim = new PinballPhysics(), lights = new TableLights(scene, sim, host);
  const eventText = new Proxy({}, { get: () => () => eventText });
  const feedback = new ArcadeFeedback(sim, { lights, eventText });
  const sounds = [];
  feedback.sound.play = kind => { sounds.push(kind); return true; };
  return { sim, lights, feedback, sounds, media, nodes, graphics, destroy() { feedback.destroy(); sim.destroy(); } };
}

test('score cues are observed once; entry scores never awaken eyes and collision data stays untouched', () => {
  const e = environment();
  try {
    e.sim.state.launch(); e.feedback.update(0);
    for (const [id, kind, score] of [['bumper:0', 'bumper', 100], ['ward:1', 'ward', 75], ['left-orbit', 'orbit', 1000], ['right-ramp', 'ramp', 2500]]) {
      e.sim.state.addScore(score, id); e.sim.flashes.set(id, e.sim.elapsed + 300);
      const flashes = [...e.sim.flashes];
      e.feedback.update(100); e.feedback.update(110);
      assert.equal(e.sounds.filter(k => k === kind).length, ['ramp', 'orbit'].includes(kind) ? 0 : 1);
      assert.equal(e.lights.cues.get(id).kind, kind);
      assert.deepEqual([...e.sim.flashes], flashes);
    }
    assert.equal(e.sim.state.score, 3675);
    assert.equal(e.lights.cues.has('eyes'), false);
    e.sim.elapsed += 1800;
    e.lights.pulse('left-ramp', 'ramp', { x: 185, y: 455 });
    assert.equal(e.lights.cues.has('eyes'), false, 'only completed guided shots awaken the eyes');
  } finally { e.destroy(); }
});

test('drain and game-over cues occur once; weak plunger returns and restart are silent', () => {
  const e = environment();
  try {
    e.sim.state.launch(); e.feedback.update(0);
    e.sim.parkAtPlunger('PLUNGE TOO SOFT'); e.feedback.update(100);
    assert.ok(!e.sounds.includes('drain'));
    for (let ball = 1; ball <= 3; ball++) {
      e.sim.state.launch(); e.feedback.update(ball * 100);
      e.sim.state.drain(); if (ball < 3) e.sim.spawn();
      e.feedback.update(ball * 100 + 10); e.feedback.update(ball * 100 + 20);
    }
    assert.equal(e.sounds.filter(k => k === 'drain').length, 2);
    assert.equal(e.sounds.filter(k => k === 'gameover').length, 1);
    const count = e.sounds.length;
    e.sim.restart(); e.feedback.update(500);
    assert.equal(e.sounds.length, count);
    assert.equal(e.lights.cues.size, 0);
  } finally { e.destroy(); }
});

test('repeated hits coalesce smoothly, expire, and keep a bounded cue budget', () => {
  const e = environment();
  try {
    e.lights.pulse('ward:0', 'ward', { x: 135, y: 550 });
    e.sim.elapsed += 100;
    assert.equal(e.lights.strength('ward:0'), 1);
    const started = e.lights.cues.get('ward:0').at;
    e.lights.pulse('ward:0', 'ward', { x: 135, y: 550 });
    assert.equal(e.lights.cues.get('ward:0').at, started);
    assert.equal(e.lights.strength('ward:0'), 1, 'no retrigger blackout');
    for (let i = 0; i < 50; i++) e.lights.pulse(String(i), 'bumper', { x: i, y: 250 });
    assert.equal(e.lights.cues.size, 16);
    e.sim.elapsed += 2000; e.lights.draw();
    assert.equal(e.lights.cues.size, 0);
    assert.equal(e.graphics.length, 2, 'no per-event display objects');
  } finally { e.destroy(); }
});

test('reduced motion follows the device, supports a manual choice and tolerates blocked storage', () => {
  const e = environment({ reduced: true, blocked: true });
  try {
    assert.equal(e.lights.reduced, true);
    e.lights.pulse('left-ramp', 'ramp', { x: 185, y: 455 });
    assert.equal(e.lights.cues.has('eyes'), false);
    assert.equal(e.lights.strength('left-ramp'), .2);
    e.media.matches = false; e.media.change();
    assert.equal(e.lights.reduced, false);
    e.nodes.get('motion').click();
    assert.equal(e.lights.reduced, true);
    e.media.change(); assert.equal(e.lights.reduced, true, 'manual preference wins');
  } finally { e.destroy(); }
  assert.equal(e.media.change, undefined, 'media listener cleaned up');
  assert.equal(e.nodes.get('motion').click, undefined, 'button listener cleaned up');
});

test('feedback observation preserves the actual launch trajectory and all rules', () => {
  const e = environment(), baseline = new PinballPhysics();
  try {
    for (const sim of [e.sim, baseline]) { sim.charge = 1; sim.launch(); }
    const snapshot = sim => ({ position: { ...sim.ball?.position }, velocity: { ...sim.ball?.velocity },
      score: sim.state.score, ball: sim.state.ballNumber, phase: sim.state.phase, travel: sim.travel?.shot.id });
    for (let step = 0; step < 120 * 15; step++) {
      e.sim.step(); baseline.step(); e.feedback.update(step * 1000 / 120); e.lights.draw();
      if (step % 60 === 0) assert.deepEqual(snapshot(e.sim), snapshot(baseline));
    }
    assert.deepEqual(snapshot(e.sim), snapshot(baseline));
  } finally { e.destroy(); baseline.destroy(); }
});


test('metal rail feedback uses normalised impact speed and stays quiet on soft contacts', () => {
  for (const speed of [2, 8]) {
    const e = environment();
    try {
      e.sim.state.launch(); e.sim.shooter = false;
      Matter.Body.setStatic(e.sim.ball, false);
      Matter.Body.setPosition(e.sim.ball, { x: 40, y: 400 });
      Matter.Body.setVelocity(e.sim.ball, { x: -speed, y: 0 });
      e.sim.step();
      assert.equal(e.sounds.includes('rail'), speed > 4);
      assert.equal(e.lights.cues.has('rail'), speed > 4);
      assert.equal(e.sim.state.score, 0);
    } finally { e.destroy(); }
  }
});

test('bumper hit bursts finish one 700ms colour sequence without extending or restarting it', () => {
  const e = environment();
  try {
    e.lights.pulse('bumper:0', 'bumper', { x: 250, y: 250 });
    const cue = { ...e.lights.cues.get('bumper:0') };
    e.sim.elapsed += 240;
    assert.equal(e.lights.bumperColours('bumper:0').ring, 0xd85a58);
    e.lights.pulse('bumper:0', 'bumper', { x: 250, y: 250 });
    assert.deepEqual(e.lights.cues.get('bumper:0'), cue);
    e.sim.elapsed += 460;
    assert.equal(e.lights.bumperColours('bumper:0').ring, 0x437f67);
    e.lights.pulse('bumper:0', 'bumper', { x: 250, y: 250 });
    assert.equal(e.lights.cues.get('bumper:0').at, e.sim.elapsed);
  } finally { e.destroy(); }
});
