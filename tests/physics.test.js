import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { FIXED_DT, BUMPERS, SHOTS, MAX_SPEED } from '../src/game/table.js';
const { Body, Vector } = Matter;
const step = (sim, count) => { for (let i = 0; i < count; i++) sim.update(FIXED_DT); };
function liveBall(sim, position, velocity = { x: 0, y: 0 }) {
  sim.state.launch();
  sim.shooter = false;
  sim.shotLock = 0;
  Body.setStatic(sim.ball, false);
  Body.setPosition(sim.ball, position);
  Body.setVelocity(sim.ball, velocity);
}

test('full charge launches through shooter lane into main playfield', () => {
  const sim = new PinballPhysics();
  sim.controls.plunger = true;
  step(sim, 150);
  assert.equal(sim.charge, 1);
  sim.controls.plunger = false;
  assert.equal(sim.launch(), true);
  let entered = false;
  for (let i = 0; i < 300; i++) {
    step(sim, 1);
    if (!sim.shooter && !sim.travel && sim.ball?.position.x < 460) { entered = true; break; }
  }
  assert.ok(entered, 'plunge must reach and leave the lane');
  assert.equal(sim.state.ballNumber, 1);
  assert.equal(sim.state.phase, 'playing');
  sim.destroy();
});

test('weak plunge returns to the plunger without losing a ball', () => {
  const sim = new PinballPhysics();
  sim.charge = .01;
  sim.launch();
  step(sim, 500);
  assert.equal(sim.state.phase, 'ready');
  assert.equal(sim.state.ballNumber, 1);
  assert.equal(sim.ball.isStatic, true);
  sim.destroy();
});

test('all four shots are reachable via upward entrance and return to a live inlane', () => {
  for (const definition of SHOTS) {
    const sim = new PinballPhysics();
    liveBall(sim, { x: definition.entry.x, y: definition.entry.y + 10 }, { x: 0, y: -9 });
    step(sim, 3);
    assert.equal(sim.travel?.shot.id, definition.id);
    assert.equal(sim.state.score, definition.score);
    assert.equal(sim.ball.isStatic, true);
    step(sim, Math.ceil(definition.duration / FIXED_DT) + 2);
    assert.equal(sim.travel, null);
    assert.equal(sim.ball.isStatic, false);
    assert.equal(sim.ball.collisionFilter.mask, 0xFFFFFFFF);
    assert.ok(sim.ball.position.y > 710 && sim.ball.position.y < 755);
    assert.ok(sim.ball.velocity.y > 0, `${definition.id} must return down the inlane`);
    step(sim, 12);
    assert.ok(sim.ball.position.x > 75 && sim.ball.position.x < 425);
    assert.equal(sim.state.score, definition.score, 'return must not retrigger shot');
    sim.destroy();
  }
});

test('downward travel does not qualify for an orbit or ramp', () => {
  const sim = new PinballPhysics();
  liveBall(sim, { x: 185, y: 455 }, { x: 0, y: 5 });
  step(sim, 2);
  assert.equal(sim.travel, null);
  assert.equal(sim.state.score, 0);
  sim.destroy();
});

test('pop bumper gives a radial impulse and awards points', () => {
  const sim = new PinballPhysics();
  const bumper = BUMPERS[0];
  liveBall(sim, { x: bumper.x, y: bumper.y + 40 }, { x: 0, y: -5 });
  step(sim, 4);
  assert.equal(sim.state.score, 100);
  assert.ok(sim.ball.velocity.y > 8);
  sim.destroy();
});

test('both slings kick toward center and score', () => {
  for (const [x, vx] of [[153, -5], [347, 5]]) {
    const sim = new PinballPhysics();
    liveBall(sim, { x, y: 660 }, { x: vx, y: 0 });
    step(sim, 8);
    assert.ok(sim.state.score >= 50);
    assert.ok(x < 250 ? sim.ball.velocity.x > 0 : sim.ball.velocity.x < 0);
    sim.destroy();
  }
});

test('rising flippers transfer rotational velocity to the ball', () => {
  for (const side of ['left', 'right']) {
    const sim = new PinballPhysics();
    const f = sim.flippers.find(f => f.side === side);
    const offset = side === 'left' ? 60 : -60;
    liveBall(sim, { x: f.pivot.x + offset, y: 784 });
    sim.controls[side] = true;
    step(sim, 5);
    assert.ok(sim.ball.velocity.y < -5, `${side} flipper must strike upward; got ${sim.ball.velocity.y}`);
    step(sim, 10);
    assert.equal(f.angle, f.raised);
    sim.controls[side] = false;
    step(sim, 16);
    assert.equal(f.angle, f.rest);
    sim.destroy();
  }
});

test('normal-speed ball cannot cross either side wall or the shooter divider', () => {
  for (const [x, y, vx, bound, direction] of [[60, 450, -22, 39, 1], [500, 550, 22, 512, -1], [450, 400, 22, 465, -1], [504, 500, -22, 491, 1]]) {
    const sim = new PinballPhysics();
    liveBall(sim, { x, y }, { x: vx, y: 0 });
    for (let i = 0; i < 10; i++) {
      step(sim, 1);
      assert.ok(direction === 1 ? sim.ball.position.x > bound : sim.ball.position.x < bound);
      assert.ok(Vector.magnitude(sim.ball.velocity) <= MAX_SPEED + .001);
    }
    sim.destroy();
  }
});

test('central drain and both outlanes consume exactly one ball, third ends game', () => {
  const sim = new PinballPhysics();
  for (const x of [250, 47, 453]) {
    liveBall(sim, { x, y: x === 250 ? 870 : 720 }, { x: 0, y: 12 });
    let steps = 0;
    while (sim.state.phase === 'playing' && steps++ < 600) step(sim, 1);
    assert.ok(steps < 600, `drain at x=${x} should finish`);
  }
  assert.equal(sim.state.phase, 'gameover');
  assert.equal(sim.ball, null);
  step(sim, 100);
  sim.restart();
  assert.equal(sim.state.phase, 'ready');
  assert.ok(sim.ball.isStatic);
  assert.equal(sim.engine.world.bodies.filter(b => b.label === 'ball').length, 1);
  sim.destroy();
});

test('pause freezes physics, charge, and guided travel', () => {
  const sim = new PinballPhysics();
  liveBall(sim, { x: 185, y: 460 }, { x: 0, y: -9 });
  step(sim, 3);
  assert.ok(sim.travel);
  sim.state.togglePause();
  const position = { ...sim.ball.position }, time = sim.elapsed;
  step(sim, 100);
  assert.deepEqual(sim.ball.position, position);
  assert.equal(sim.elapsed, time);
  sim.state.togglePause();
  step(sim, 10);
  assert.notDeepEqual(sim.ball.position, position);
  sim.destroy();
});

test('physics result is independent of render frame subdivision', () => {
  const a = new PinballPhysics(), b = new PinballPhysics();
  for (const sim of [a, b]) { sim.charge = 1; sim.launch(); }
  for (let i = 0; i < 60; i++) a.update(FIXED_DT * 2);
  for (let i = 0; i < 120; i++) b.update(FIXED_DT);
  assert.ok(Math.abs(a.ball.position.y - b.ball.position.y) < .0001);
  assert.ok(Math.abs(a.ball.position.x - b.ball.position.x) < .0001);
  a.destroy(); b.destroy();
});

test('flippers block a normal-speed falling ball at rest and when held raised', () => {
  for (const side of ['left', 'right']) for (const raised of [false, true]) {
    const sim = new PinballPhysics();
    const f = sim.flippers.find(f => f.side === side);
    sim.controls[side] = raised;
    step(sim, 12);
    const x = f.pivot.x + Math.cos(f.angle) * 62;
    const y = f.pivot.y + Math.sin(f.angle) * 62;
    liveBall(sim, { x, y: y - 48 }, { x: 0, y: 22 });
    let bounced = false;
    for (let i = 0; i < 12; i++) {
      step(sim, 1);
      if (sim.ball.velocity.y < 0) bounced = true;
      assert.ok(sim.ball.position.y < y + 10, `${side} ${raised ? 'raised' : 'resting'} flipper must block the ball`);
    }
    assert.ok(bounced, 'must resolve a real collision');
    sim.destroy();
  }
});
