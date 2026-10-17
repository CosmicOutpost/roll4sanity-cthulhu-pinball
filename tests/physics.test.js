import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { FIXED_DT, BUMPERS, SHOTS, MAX_SPEED, SHOOTER } from '../src/game/table.js';
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

test('a full plunge stays out of the shooter lane and reaches the lower playfield', () => {
  const sim = new PinballPhysics();
  sim.charge = 1;
  sim.launch();
  let leftGuide = false, reachedLowerPlayfield = false;
  for (let i = 0; i < 1200 && sim.state.phase === 'playing'; i++) {
    step(sim, 1);
    if (!sim.shooter && !sim.travel) leftGuide = true;
    if (leftGuide && sim.state.phase === 'playing' && !sim.travel) {
      assert.ok(sim.ball.position.x < 486, 'live ball must not fall back into the enclosed shooter lane');
      if (sim.ball.position.y > 740) reachedLowerPlayfield = true;
    }
    if (leftGuide && sim.state.phase === 'ready') {
      assert.ok(sim.state.ballNumber > 1, 'a full plunge must not need reloading into the plunger');
    }
  }
  assert.ok(reachedLowerPlayfield, 'follow the ball beyond the launch guide, through bumpers to the flippers');
  assert.ok(sim.state.score > 100, 'ball should continue interacting with playfield mechanisms');
  sim.destroy();
});

test('a ball returning to the plunger can be relaunched even after leaving shooter mode', () => {
  const sim = new PinballPhysics();
  liveBall(sim, { x: SHOOTER.x, y: SHOOTER.y + 4 }, { x: 0, y: 5 });
  sim.state.addScore(100, 'bumper');
  step(sim, 2);
  assert.equal(sim.state.phase, 'ready');
  assert.equal(sim.shooter, true);
  assert.equal(sim.ball.isStatic, true);
  assert.deepEqual(sim.ball.position, SHOOTER);
  assert.equal(sim.state.ballNumber, 1);
  assert.equal(sim.state.score, 100);
  sim.controls.plunger = true;
  step(sim, 150);
  sim.controls.plunger = false;
  assert.equal(sim.launch(), true);
  step(sim, 250);
  assert.equal(sim.shooter, false);
  assert.equal(sim.state.phase, 'playing');
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

test('stationary and nearly stationary balls escape both former heel traps after repeated activation', () => {
  for (const side of ['left', 'right']) for (const slowVelocity of [0, .05]) {
    const sim = new PinballPhysics();
    // Recorded equilibrium from an actual full plunge, mirrored for the left.
    const start = { x: side === 'left' ? 143.4436245866962 : 356.5563754133038, y: 775.5288042036972 };
    liveBall(sim, start, { x: slowVelocity, y: 0 });
    const originalBall = sim.ball;
    let displacement = 0;
    for (let i = 0; i < 360 && sim.state.ballNumber === 1; i++) {
      sim.controls[side] = i % 36 < 10;
      step(sim, 1);
      displacement = Math.max(displacement, Vector.magnitude(Vector.sub(originalBall.position, start)));
    }
    assert.ok(displacement > 40, `${side}, vx=${slowVelocity}: the heel must not imprison the ball`);
    sim.destroy();
  }
});

test('stationary contacts on both bats respond to repeated rise and return strokes', () => {
  for (const side of ['left', 'right']) for (const returning of [false, true]) {
    const sim = new PinballPhysics(), f = sim.flippers.find(f => f.side === side);
    const originalBall = sim.ball;
    for (let repeat = 0; repeat < 3; repeat++) for (const distance of [5, 22, 55, 75]) {
      // Fixture setup only: rest the same dynamic ball on either side of the
      // actual collision shape, then let Matter resolve the entire stroke.
      Body.setPosition(originalBall, { x: 250, y: 600 });
      Body.setVelocity(originalBall, { x: 0, y: 0 });
      sim.controls[side] = returning;
      step(sim, 20);
      const axis = { x: Math.cos(f.angle), y: Math.sin(f.angle) };
      const normal = side === 'left' ? { x: axis.y, y: -axis.x } : { x: -axis.y, y: axis.x };
      const offset = returning ? -17.1 : 17.1;
      const start = { x: f.pivot.x + axis.x * distance + normal.x * offset, y: f.pivot.y + axis.y * distance + normal.y * offset };
      liveBall(sim, start, { x: 0, y: repeat === 1 ? .03 : 0 });
      Body.setAngularVelocity(sim.ball, 0);
      const ball = sim.ball;
      assert.equal(ball, originalBall, 'repeat strokes on the same ball, not a newly spawned one');
      sim.controls[side] = !returning;
      step(sim, 4);
      assert.equal(sim.ball, ball, 'contact must not replace or rescue the ball');
      assert.equal(ball.isStatic, false);
      assert.ok(returning ? ball.velocity.y > .5 : ball.velocity.y < -1, `${side} ${returning ? 'return' : 'rise'}, d=${distance}: contact must transfer the moving surface velocity`);
      assert.ok(Vector.magnitude(ball.velocity) <= MAX_SPEED + .001);
    }
    sim.destroy();
  }
});

test('a nearby ball receives no proximity kick before the moving bat touches it', () => {
  for (const side of ['left', 'right']) {
    const sim = new PinballPhysics(), f = sim.flippers.find(f => f.side === side);
    const axis = { x: Math.cos(f.angle), y: Math.sin(f.angle) };
    const normal = side === 'left' ? { x: axis.y, y: -axis.x } : { x: -axis.y, y: axis.x };
    liveBall(sim, { x: f.pivot.x + axis.x * 60 + normal.x * 30, y: f.pivot.y + axis.y * 60 + normal.y * 30 });
    sim.controls[side] = true;
    step(sim, 1);
    assert.ok(sim.ball.velocity.y > 0, 'only gravity should act before contact');
    sim.destroy();
  }
});

test('slow ball sweep around heels, feeds, and tips introduces no permanent pockets', () => {
  for (const side of ['left', 'right']) for (const distance of [-25, -15, -8, 0, 8, 20, 40, 60, 80, 90]) for (const vx of [0, .05]) {
    const sim = new PinballPhysics(), f = sim.flippers.find(f => f.side === side);
    const axis = { x: Math.cos(f.angle), y: Math.sin(f.angle) };
    const normal = side === 'left' ? { x: axis.y, y: -axis.x } : { x: -axis.y, y: axis.x };
    const start = { x: f.pivot.x + axis.x * distance + normal.x * 20, y: f.pivot.y + axis.y * distance + normal.y * 20 };
    liveBall(sim, start, { x: vx, y: 0 });
    const ball = sim.ball;
    let displacement = 0;
    for (let i = 0; i < 720 && sim.state.ballNumber === 1; i++) {
      sim.controls[side] = i % 60 < 30;
      step(sim, 1);
      displacement = Math.max(displacement, Vector.magnitude(Vector.sub(ball.position, start)));
      assert.ok(Number.isFinite(ball.position.x) && Number.isFinite(ball.position.y));
      assert.ok(Vector.magnitude(ball.velocity) <= MAX_SPEED + .001);
      if (sim.state.ballNumber === 1) {
        assert.equal(sim.ball, ball);
        assert.equal(sim.shooter, false);
        assert.ok(!ball.isStatic || sim.travel, 'no artificial rescue or parking');
      }
    }
    assert.ok(displacement > 40, `${side}, distance=${distance}, vx=${vx}: the ball must leave the contact pocket`);
    if (sim.state.ballNumber > 1) assert.ok(ball.position.y > 942, 'a normal drain must precede the next ball');
    sim.destroy();
  }
});

test('rounded flipper tips still leave the central drain open', () => {
  for (const x of [248, 250, 252]) {
    const sim = new PinballPhysics();
    liveBall(sim, { x, y: 760 });
    step(sim, 600);
    assert.equal(sim.state.ballNumber, 2, 'an unflipped center ball must drain rather than bridge the tips');
    sim.destroy();
  }
});

test('the screenshot upper-left pinch releases a stationary ball under gravity', () => {
  const sim = new PinballPhysics();
  // Equilibrium reproduced between the outer wall and curved inner rail.
  liveBall(sim, { x: 41.42304501804256, y: 163.00602621931975 });
  const ball = sim.ball;
  for (let i = 0; i < 360 && ball.position.y < 250; i++) {
    const before = { ...ball.position };
    step(sim, 1);
    assert.equal(sim.ball, ball);
    assert.equal(ball.isStatic, false);
    assert.equal(sim.travel, null, 'gravity and collision geometry must clear the curve');
    assert.ok(Vector.magnitude(Vector.sub(ball.position, before)) < 20, 'no teleport or automatic rescue');
  }
  assert.ok(ball.position.y > 250, 'the ball must fall through the curved rail gap');
  sim.destroy();
});

test('upper-left curve and downstream return remain open at slow and normal speeds', () => {
  for (const [x, y] of [[70, 85], [65, 100], [55, 120], [45, 150], [43, 165]]) {
    for (const velocity of [{ x: 0, y: 0 }, { x: -.05, y: 0 }, { x: -3, y: 3 }, { x: 3, y: 3 }, { x: 0, y: 22 }]) {
      const sim = new PinballPhysics();
      liveBall(sim, { x, y }, velocity);
      const ball = sim.ball;
      let maxY = y;
      for (let i = 0; i < 960 && sim.state.ballNumber === 1; i++) {
        step(sim, 1);
        maxY = Math.max(maxY, ball.position.y);
        assert.ok(Number.isFinite(ball.position.x) && Number.isFinite(ball.position.y));
        assert.ok(Vector.magnitude(ball.velocity) <= MAX_SPEED + .001);
        if (sim.state.ballNumber === 1) {
          assert.equal(sim.ball, ball);
          assert.equal(sim.shooter, false);
        }
      }
      assert.ok(maxY > 650, `start ${x},${y}, velocity ${velocity.x},${velocity.y}: must not transfer the trap to the next rail`);
      sim.destroy();
    }
  }
});

test('both guided orbits fit through the corrected upper-left rail curve', () => {
  const sim = new PinballPhysics();
  const rails = sim.rails.filter(body => body.bounds.min.x < 100 && body.bounds.min.y < 194 && body.bounds.max.y > 145);
  for (const shot of sim.shots.filter(shot => shot.kind === 'orbit')) {
    const points = shot.path.points.filter(point => point.x < 100 && point.y >= 148 && point.y <= 193);
    assert.ok(points.length > 10, 'check the sampled curve, not just its endpoints');
    for (const point of points) {
      Body.setPosition(sim.ball, point);
      assert.equal(Matter.Query.collides(sim.ball, rails).length, 0, `${shot.id}: the ball outline must clear the visible rails`);
    }
  }
  sim.destroy();
});
