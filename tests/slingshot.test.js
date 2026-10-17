import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { SLINGS, BALL_RADIUS } from '../src/game/table.js';
const { Body, Events, Vector } = Matter;

function fixture(side, position, velocity, passive = false) {
  const sim = new PinballPhysics();
  sim.state.launch();
  sim.shooter = false;
  sim.shotLock = 0;
  Body.setStatic(sim.ball, false);
  Body.setPosition(sim.ball, position);
  Body.setVelocity(sim.ball, velocity);
  const sling = sim.engine.world.bodies.find(b => b.label === `sling:${side}`);
  // Existing cooldown suppresses the coil only, giving an actual Matter passive
  // reference with identical geometry, restitution and initial motion.
  if (passive) sim.cooldowns.set(sling.id, Infinity);
  const contacts = [];
  Events.on(sim.engine, 'collisionStart', e => {
    for (const pair of e.pairs) if ([pair.bodyA, pair.bodyB].includes(sim.ball) && [pair.bodyA, pair.bodyB].includes(sling)) contacts.push(pair);
  });
  return { sim, sling, contacts };
}
function face(side, kind, fraction = .5) {
  const p = SLINGS[side], a = p[0], inner = p[side ? 2 : 1], outer = p[side ? 1 : 2];
  const [start, end] = kind === 'main' ? [a, inner] : kind === 'outer' ? [outer, a] : [inner, outer];
  const center = Vector.mult(p.reduce((sum, v) => Vector.add(sum, v), { x: 0, y: 0 }), 1 / 3);
  const point = Vector.add(start, Vector.mult(Vector.sub(end, start), fraction));
  const edge = Vector.sub(end, start);
  let normal = Vector.normalise({ x: edge.y, y: -edge.x });
  if (Vector.dot(normal, Vector.sub(point, center)) < 0) normal = Vector.neg(normal);
  return { point, normal };
}
function arrival(side, kind, speed = 6, fraction = .5) {
  const { point, normal } = face(side, kind, fraction);
  return { position: Vector.add(point, Vector.mult(normal, BALL_RADIUS + 3)), velocity: Vector.mult(normal, -speed) };
}
function firstContact(f) {
  for (let i = 0; i < 16 && !f.contacts.length; i++) f.sim.step();
  assert.ok(f.contacts.length, 'fixture must produce an actual sling collision');
}
function assertPassive(side, initial) {
  const actual = fixture(side, initial.position, initial.velocity);
  const reference = fixture(side, initial.position, initial.velocity, true);
  try {
    firstContact(actual); firstContact(reference);
    assert.equal(actual.sim.state.score, 0, 'passive rubber must not activate the 50-point switch');
    assert.equal(actual.sim.flashes.has(actual.sling.label), false);
    assert.ok(Vector.magnitude(Vector.sub(actual.sim.ball.velocity, reference.sim.ball.velocity)) < 1e-6, 'contact must retain natural solver restitution, not an active kick');
    assert.equal(actual.sim.ball.isStatic, false);
  } finally { actual.sim.destroy(); reference.sim.destroy(); }
}

for (const side of [0, 1]) {
  const name = side ? 'right' : 'left';
  test(`${name} sling main rubber face keeps its existing inward/upward kick and 50 points`, () => {
    for (const speed of [2, 6, 12]) for (const fraction of [.2, .5, .8]) {
      const initial = arrival(side, 'main', speed, fraction), f = fixture(side, initial.position, initial.velocity);
      try {
        firstContact(f);
        assert.equal(f.sim.state.score, 50);
        assert.ok(Math.abs(f.sim.ball.velocity.x - (side ? -10.66 : 10.66)) < 1e-6);
        assert.ok(Math.abs(f.sim.ball.velocity.y + 7.41) < 1e-6);
        assert.ok(f.sim.flashes.has(f.sling.label));
        f.sim.step();
        assert.equal(f.sim.state.score, 50, 'sustained contact must not award twice');
      } finally { f.sim.destroy(); }
    }
  });
  for (const kind of ['outer', 'underside']) test(`${name} sling ${kind} contacts use passive restitution at slow and normal speeds`, () => {
    for (const speed of [2, 6, 12]) for (const fraction of [.25, .5, .75]) assertPassive(side, arrival(side, kind, speed, fraction));
  });
  test(`${name} sling all three vertex tips remain passive`, () => {
    const points = SLINGS[side], center = Vector.mult(points.reduce((s, v) => Vector.add(s, v), { x: 0, y: 0 }), 1 / 3);
    for (const point of points) {
      const normal = Vector.normalise(Vector.sub(point, center));
      for (const speed of [2, 6, 12]) assertPassive(side, { position: Vector.add(point, Vector.mult(normal, BALL_RADIUS + 3)), velocity: Vector.mult(normal, -speed) });
    }
  });
  test(`${name} recorded lower-outer wedge releases a stationary ball under gravity`, () => {
    const f = fixture(side, { x: side ? 408.6797485546 : 91.3202514454, y: 685.2424188865 }, { x: 0, y: 0 });
    const id = f.sim.ball.id;
    let leftPocket = false;
    try {
      for (let i = 0; i < 120 * 20 && f.sim.state.phase === 'playing'; i++) {
        f.sim.step();
        if (f.sim.state.phase === 'playing') {
          assert.equal(f.sim.ball.id, id);
          assert.equal(f.sim.ball.isStatic, false);
          if (f.sim.ball.position.y > 740) leftPocket = true;
        }
      }
      assert.ok(leftPocket, 'stationary ball must fall past the sling without rescue');
      assert.equal(f.sim.state.phase, 'ready', 'ball must drain naturally after leaving the pocket');
    } finally { f.sim.destroy(); }
  });
  test(`${name} outer-corridor arrivals do not repeat active kicks or create ball traps`, () => {
    let returns = 0;
    for (const x of [405, 415]) for (const y of [570, 600, 650, 700]) for (const vx of [-2, 0, 2]) {
      const f = fixture(side, { x: side ? x : 500 - x, y }, { x: side ? vx : -vx, y: 4 });
      const id = f.sim.ball.id;
      let reachedBats = false, wrongKicks = 0;
      Events.on(f.sim.engine, 'collisionStart', e => {
        const { normal } = face(side, 'outer');
        for (const pair of e.pairs) {
          if (![pair.bodyA, pair.bodyB].includes(f.sim.ball) || ![pair.bodyA, pair.bodyB].includes(f.sling)) continue;
          const outward = Vector.mult(pair.collision.normal, pair.collision.bodyA === f.sim.ball ? 1 : -1);
          if (Vector.dot(outward, normal) > .99 && f.sim.flashes.get(f.sling.label) === f.sim.elapsed + 180) wrongKicks++;
        }
      });
      try {
        for (let i = 0; i < 120 * 20 && f.sim.state.phase === 'playing'; i++) {
          f.sim.step();
          assert.equal(f.sim.ball.id === id || f.sim.state.phase === 'ready', true);
          if (f.sim.state.phase === 'playing' && f.sim.ball.position.y > 740 && f.sim.ball.position.x > 75 && f.sim.ball.position.x < 425) reachedBats = true;
        }
        if (reachedBats) returns++;
        assert.equal(f.sim.state.phase, 'ready', `same ball must escape and drain naturally: ${JSON.stringify({ x, y, vx, position: f.sim.ball.position, velocity: f.sim.ball.velocity })}`);
        assert.equal(wrongKicks, 0, 'outer-corridor contacts must not activate the coil');
      } finally { f.sim.destroy(); }
    }
    assert.ok(returns > 0, 'corridor arrivals must include playable returns to the bats');
  });
}

test('mirrored main and passive sling contacts produce symmetric ball response', () => {
  for (const kind of ['main', 'outer', 'underside']) {
    const initial = arrival(0, kind);
    const left = fixture(0, initial.position, initial.velocity);
    const right = fixture(1, { x: 500 - initial.position.x, y: initial.position.y }, { x: -initial.velocity.x, y: initial.velocity.y });
    try {
      firstContact(left); firstContact(right);
      assert.equal(left.sim.state.score, right.sim.state.score);
      assert.ok(Math.abs(left.sim.ball.velocity.x + right.sim.ball.velocity.x) < .05);
      assert.ok(Math.abs(left.sim.ball.velocity.y - right.sim.ball.velocity.y) < .05);
      assert.ok(Math.abs(left.sim.ball.position.x + right.sim.ball.position.x - 500) < .05);
    } finally { left.sim.destroy(); right.sim.destroy(); }
  }
});
