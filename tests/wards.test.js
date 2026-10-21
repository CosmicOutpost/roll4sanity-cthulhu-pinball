import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { WARDS, WARD_RULES, BALL_RADIUS, MAX_SPEED, SHOTS, samplePath } from '../src/game/table.js';
import { actionSession } from './helpers/action-session.js';

const { Body, Events } = Matter;
function fixture(side, angle, speed = 3) {
  const sim = new PinballPhysics(), ward = WARDS[side];
  sim.state.launch(); sim.shooter = false; sim.shotLock = Infinity;
  Body.setStatic(sim.ball, false);
  const normal = { x: Math.cos(angle), y: Math.sin(angle) };
  Body.setPosition(sim.ball, { x: ward.x + normal.x * (ward.radius + BALL_RADIUS + (speed <= .1 ? -.3 : 1)), y: ward.y + normal.y * (ward.radius + BALL_RADIUS + (speed <= .1 ? -.3 : 1)) });
  Body.setVelocity(sim.ball, { x: -normal.x * speed, y: -normal.y * speed });
  return { sim, normal, body: sim.ball };
}
for (const side of [0, 1]) {
  test(`ward ${side}: actual contacts around all faces kick outward, once, at a modest bounded speed`, () => {
    for (const speed of [.1, 3, 14, MAX_SPEED]) for (let i = 0; i < 24; i++) {
      const { sim, normal, body } = fixture(side, i * Math.PI / 12, speed);
      try {
        let contact = false;
        Events.on(sim.engine, 'collisionStart', ({ pairs }) => { if (pairs.some(p => [p.bodyA.label, p.bodyB.label].includes(`ward:${side}`))) contact = true; });
        for (let j = 0; j < 30 && !contact; j++) sim.step();
        assert.ok(contact, `missing contact ${side}/${i}/${speed}`);
        assert.equal(sim.state.score, WARD_RULES.score);
        assert.equal(sim.ball, body);
        assert.ok(sim.ball.velocity.x * normal.x + sim.ball.velocity.y * normal.y > 0, `inward kick ${i}`);
        assert.ok(Math.abs(Math.hypot(sim.ball.velocity.x, sim.ball.velocity.y) - WARD_RULES.speed) < .01);
        assert.ok(WARD_RULES.speed < 12 && WARD_RULES.speed < MAX_SPEED);
        const expiry = sim.flashes.get(`ward:${side}`);
        for (let j = 0; j < 12; j++) sim.step();
        assert.equal(sim.flashes.get(`ward:${side}`), expiry, 'no repeated ward award for the same hit; downstream slings may score');
      } finally { sim.destroy(); }
    }
  });
  test(`ward ${side}: stationary crown and slow approaches leave without a pocket or powered loop`, () => {
    for (const speed of [0, .1, 3, 14]) for (let i = 0; i < 24; i++) {
      const { sim, body } = fixture(side, i * Math.PI / 12, speed);
      try {
        let pocket, wardHits = 0, previous = 0;
        for (let j = 0; j < 120 * 45 && sim.state.phase === 'playing'; j++) {
          sim.step();
          if (!sim.ball || sim.ball !== body || sim.state.phase !== 'playing') break;
          assert.ok([sim.ball.position.x, sim.ball.position.y, sim.ball.velocity.x, sim.ball.velocity.y].every(Number.isFinite));
          assert.ok(Math.hypot(sim.ball.velocity.x, sim.ball.velocity.y) <= MAX_SPEED + .01);
          const expiry = sim.flashes.get(`ward:${side}`) ?? 0;
          if (expiry !== previous) { wardHits++; previous = expiry; }
          const p = sim.ball.position;
          if (!pocket || Math.hypot(p.x - pocket.x, p.y - pocket.y) > 24) pocket = { ...p, t: sim.elapsed };
          assert.ok(sim.elapsed - pocket.t < 6000, `stuck ${side}/${i}/${speed} at ${p.x},${p.y}`);
        }
        assert.equal(sim.state.phase, 'ready', `failed natural drain ${side}/${i}/${speed}`);
        assert.ok(wardHits < 12, `powered loop ${side}/${i}/${speed}: ${wardHits}`);
      } finally { sim.destroy(); }
    }
  });
}

test('wards require real contact; cooldowns are per mechanism and reset cleanly', () => {
  const sim = new PinballPhysics();
  try {
    const bodies = sim.engine.world.bodies.filter(b => b.label.startsWith('ward:'));
    assert.equal(bodies.length, 2);
    sim.state.launch(); sim.shooter = false; sim.shotLock = Infinity;
    Body.setStatic(sim.ball, false);
    const hit = side => {
      const w = WARDS[side];
      Body.setPosition(sim.ball, { x: w.x, y: w.y + w.radius + BALL_RADIUS + 1 });
      Body.setVelocity(sim.ball, { x: 0, y: -3 });
      sim.step(); sim.step();
    };
    Body.setPosition(sim.ball, { x: 250, y: 550 });
    Body.setVelocity(sim.ball, { x: 0, y: 0 });
    sim.step();
    assert.equal(sim.state.score, 0, 'no proximity award');
    hit(0); assert.equal(sim.state.score, 75);
    hit(1); assert.equal(sim.state.score, 150, 'separate cooldowns');
    hit(0); assert.equal(sim.state.score, 150, 'early recontact is passive');
    Body.setPosition(sim.ball, { x: 250, y: 550 });
    Body.setVelocity(sim.ball, { x: 0, y: 0 });
    for (let i = 0; i < 35; i++) sim.step();
    hit(0); assert.equal(sim.state.score, 225, 'valid later contact scores again');
    sim.state.paused = true;
    const before = { score: sim.state.score, elapsed: sim.elapsed };
    sim.step(); assert.deepEqual({ score: sim.state.score, elapsed: sim.elapsed }, before);
    sim.restart();
    assert.equal(sim.state.score, 0); assert.equal(sim.cooldowns.size, 0); assert.equal(sim.flashes.size, 0);
  } finally { sim.destroy(); }
});

test('ordinary-input three-ball games stay bounded across eight imperfect timing policies', () => {
  let wardHits = 0;
  for (const threshold of [720, 735, 750, 765]) for (const interval of [60, 140]) {
    const run = actionSession({ threshold, interval });
    assert.equal(run.phase, 'gameover', JSON.stringify(run));
    assert.equal(run.ball, 3);
    assert.equal(run.inputs.filter(i => i.action === 'full launch').length, 3);
    assert.deepEqual(run.violations, []);
    wardHits += run.wards;
  }
  assert.ok(wardHits > 0, 'ordinary launches and flipper presses exercise the new mechanisms');
});

function distanceToSegment(q, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
}

test('ward clearances preserve ball-sized passages, capture zones and visible guided travel', () => {
  const sim = new PinballPhysics();
  try {
    for (const [side, ward] of WARDS.entries()) {
      for (const body of sim.engine.world.bodies.filter(b => b.isStatic && b.label !== `ward:${side}` && b.label !== 'ball')) {
        const gap = Math.min(...body.vertices.map((v, i, vs) => distanceToSegment(ward, v, vs[(i + 1) % vs.length]))) - ward.radius;
        assert.ok(gap > 2 * BALL_RADIUS + 10, `${body.label} gap ${gap}`);
      }
      for (const shot of SHOTS) {
        assert.ok(Math.hypot(ward.x - shot.entry.x, ward.y - shot.entry.y) - ward.radius - shot.entry.radius > 2 * BALL_RADIUS);
        const path = samplePath(shot.points).points;
        for (let i = 1; i < path.length; i++) {
          assert.ok(distanceToSegment(ward, path[i - 1], path[i]) - ward.radius - 11 > 5, `${shot.id} visible ball/ward overlap`);
        }
      }
    }
  } finally { sim.destroy(); }
});

test('mirrored ward contacts produce mirrored impulses, including crown and underside', () => {
  for (let i = 0; i < 24; i++) {
    const left = fixture(0, i * Math.PI / 12, 3).sim;
    const right = fixture(1, Math.PI - i * Math.PI / 12, 3).sim;
    try {
      for (let j = 0; j < 10 && !left.flashes.has('ward:0'); j++) { left.step(); right.step(); }
      assert.equal(left.state.score, 75); assert.equal(right.state.score, 75);
      assert.ok(Math.abs(left.ball.velocity.x + right.ball.velocity.x) < .01);
      assert.ok(Math.abs(left.ball.velocity.y - right.ball.velocity.y) < .01);
    } finally { left.destroy(); right.destroy(); }
  }
});
