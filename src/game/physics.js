import Matter from 'matter-js';
import { GameState } from './state.js';
import { BALL_RADIUS, FIXED_DT, MAX_SPEED, SHOOTER, BUMPERS, POSTS, RAILS, SLINGS, SHOTS, samplePath, pointOnPath } from './table.js';
const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class PinballPhysics {
  constructor() {
    this.engine = Engine.create({ gravity: { x: 0, y: .85 }, positionIterations: 8, velocityIterations: 8, enableSleeping: false });
    this.state = new GameState();
    this.elapsed = 0;
    this.accumulator = 0;
    this.charge = 0;
    this.controls = { left: false, right: false, plunger: false };
    this.flashes = new Map();
    this.shots = SHOTS.map(s => ({ ...s, path: samplePath(s.points) }));
    this.cooldowns = new Map();
    this.buildTable();
    this.spawn();
    Events.on(this.engine, 'collisionStart', event => this.onCollision(event));
  }
  buildTable() {
    const add = body => { Composite.add(this.engine.world, body); return body; };
    this.rails = [];
    for (const rail of RAILS) {
      for (let i = 1; i < rail.points.length; i++) {
        const [ax, ay] = rail.points[i - 1], [bx, by] = rail.points[i];
        const body = Bodies.rectangle((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) + rail.width / 2, rail.width, { isStatic: true, angle: Math.atan2(by - ay, bx - ax), restitution: .5, friction: .02, label: 'rail' });
        this.rails.push(add(body));
      }
    }
    BUMPERS.forEach((p, i) => add(Bodies.circle(p.x, p.y, 28, { isStatic: true, restitution: 1, label: `bumper:${i}` })));
    POSTS.forEach(([x, y, r], i) => add(Bodies.circle(x, y, r, { isStatic: true, restitution: .85, label: `post:${i}` })));
    SLINGS.forEach((points, i) => {
      const center = { x: points.reduce((s, p) => s + p.x, 0) / 3, y: points.reduce((s, p) => s + p.y, 0) / 3 };
      add(Bodies.fromVertices(center.x, center.y, [points], { isStatic: true, restitution: .8, label: `sling:${i}` }));
    });
    this.flippers = [
      { pivot: { x: 155, y: 790 }, rest: .24, raised: -.53, side: 'left' },
      { pivot: { x: 345, y: 790 }, rest: Math.PI - .24, raised: Math.PI + .53, side: 'right' },
    ].map(f => {
      f.angle = f.rest;
      f.length = 88;
      f.omega = 0;
      f.body = add(Bodies.rectangle(0, 0, f.length, 17, { isStatic: true, chamfer: { radius: 7 }, restitution: .3, friction: .08, label: `flipper:${f.side}` }));
      this.positionFlipper(f);
      return f;
    });
  }
  positionFlipper(f) {
    Body.setPosition(f.body, { x: f.pivot.x + Math.cos(f.angle) * f.length / 2, y: f.pivot.y + Math.sin(f.angle) * f.length / 2 });
    Body.setAngle(f.body, f.angle);
  }
  spawn() {
    if (this.ball) Composite.remove(this.engine.world, this.ball);
    this.travel = null;
    this.pendingKick = null;
    this.shotLock = this.elapsed + 500;
    this.shooter = true;
    this.charge = 0;
    this.ball = Bodies.circle(SHOOTER.x, SHOOTER.y, BALL_RADIUS, { restitution: .45, friction: .015, frictionAir: .0007, density: .008, label: 'ball', slop: .01 });
    Body.setStatic(this.ball, true);
    Composite.add(this.engine.world, this.ball);
  }
  restart() {
    this.state.restart();
    this.flashes.clear();
    this.cooldowns.clear();
    this.controls = { left: false, right: false, plunger: false };
    this.accumulator = 0;
    this.spawn();
    for (const f of this.flippers) { f.angle = f.rest; f.omega = 0; this.positionFlipper(f); }
  }
  releaseControls() { this.controls = { left: false, right: false, plunger: false }; this.charge = 0; }
  launch() {
    if (this.state.paused || this.charge <= 0) return false;
    if (!this.state.launch()) { this.charge = 0; return false; }
    Body.setStatic(this.ball, false);
    Body.setVelocity(this.ball, { x: 0, y: -(12 + 10 * this.charge) });
    this.charge = 0;
    return true;
  }
  update(delta) {
    if (this.state.paused) { this.accumulator = 0; return; }
    // Limit catch-up after stalls; never take a variable or oversized physics step.
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= FIXED_DT) {
      this.step();
      this.accumulator -= FIXED_DT;
    }
  }
  step() {
    if (this.state.paused) return;
    this.elapsed += FIXED_DT;
    if (this.controls.plunger && this.state.phase === 'ready') this.charge = clamp(this.charge + FIXED_DT / 1200, 0, 1);
    this.updateFlippers();
    if (this.travel) {
      this.updateTravel();
      return;
    }
    Engine.update(this.engine, FIXED_DT);
    this.applyPendingKick();
    if (this.state.phase !== 'playing') return;
    this.flipperImpulse();
    const speed = Vector.magnitude(this.ball.velocity);
    if (speed > MAX_SPEED) Body.setVelocity(this.ball, Vector.mult(this.ball.velocity, MAX_SPEED / speed));
    const { x, y } = this.ball.position;
    // A short launch guide carries the shooter lane over its one-way exit rail.
    if (this.shooter && x > 475 && y < 221 && this.ball.velocity.y < 0) {
      this.beginTravel({ id: 'launch', kind: 'launch', duration: 520, path: samplePath([[x, y], [503, 146], [470, 84], [398, 54], [327, 100]]), exitVelocity: { x: -5, y: 7 } });
      this.shooter = false;
      return;
    }
    // A weak plunge falls back into the lane and can be charged again, without losing a ball.
    if (this.shooter && x > 486 && y > 858 && this.ball.velocity.y > 0) {
      Body.setStatic(this.ball, true);
      Body.setPosition(this.ball, SHOOTER);
      this.state.phase = 'ready';
    }
    if (y > 942 || x < -30 || x > 570) {
      if (this.state.drain()) {
        if (this.state.phase === 'ready') this.spawn();
        else { Composite.remove(this.engine.world, this.ball); this.ball = null; }
      }
      return;
    }
    if (!this.shooter && this.elapsed > this.shotLock && this.ball.velocity.y < -2.5) {
      const shot = this.shots.find(s => Math.hypot(x - s.entry.x, y - s.entry.y) < s.entry.radius);
      if (shot) this.beginTravel(shot);
    }
  }
  updateFlippers() {
    for (const f of this.flippers) {
      const target = this.controls[f.side] ? f.raised : f.rest;
      const old = f.angle;
      const maxDelta = (this.controls[f.side] ? 13 : 8) * FIXED_DT / 1000;
      f.angle += clamp(target - f.angle, -maxDelta, maxDelta);
      f.omega = (f.angle - old) / (FIXED_DT / 1000);
      this.positionFlipper(f);
    }
  }
  flipperImpulse() {
    for (const f of this.flippers) {
      if (!this.controls[f.side] || Math.abs(f.omega) < .01) continue;
      const axis = { x: Math.cos(f.angle), y: Math.sin(f.angle) };
      const relative = Vector.sub(this.ball.position, f.pivot);
      const distance = clamp(Vector.dot(relative, axis), 0, f.length);
      const contact = Vector.add(f.pivot, Vector.mult(axis, distance));
      if (Vector.magnitude(Vector.sub(this.ball.position, contact)) > BALL_RADIUS + 12) continue;
      const normal = f.side === 'left' ? { x: axis.y, y: -axis.x } : { x: -axis.y, y: axis.x };
      // Matter resolves penetration; add only the rotating bat's missing contact velocity.
      // Velocity units here are pixels per Matter base tick (1/60 second).
      const surface = { x: -axis.y * distance * f.omega / 60, y: axis.x * distance * f.omega / 60 };
      const target = Math.max(0, Vector.dot(surface, normal)) * 1.12;
      const current = Vector.dot(this.ball.velocity, normal);
      if (current < target) Body.setVelocity(this.ball, Vector.add(this.ball.velocity, Vector.mult(normal, target - current)));
    }
  }
  onCollision(event) {
    if (this.state.phase !== 'playing' || this.travel || !this.ball) return;
    for (const { bodyA, bodyB } of event.pairs) {
      const other = bodyA === this.ball ? bodyB : bodyB === this.ball ? bodyA : null;
      if (!other) continue;
      const bumper = other.label.startsWith('bumper:');
      const sling = other.label.startsWith('sling:');
      if (!bumper && !sling) continue;
      if ((this.cooldowns.get(other.id) ?? 0) > this.elapsed) continue;
      this.cooldowns.set(other.id, this.elapsed + 160);
      this.flashes.set(other.label, this.elapsed + 180);
      let direction;
      if (bumper) direction = Vector.normalise(Vector.sub(this.ball.position, other.position));
      else direction = { x: other.label.endsWith('0') ? .82 : -.82, y: -.57 };
      // Apply after the solver so restitution cannot cancel the active coil kick.
      this.pendingKick = { direction, speed: bumper ? 12 : 13 };
      this.state.addScore(bumper ? 100 : 50, bumper ? 'THE DEPTHS AWAKEN · +100' : 'SLINGSHOT · +50');
    }
  }
  applyPendingKick() {
    if (this.pendingKick && this.ball && !this.travel) {
      Body.setVelocity(this.ball, Vector.mult(this.pendingKick.direction, this.pendingKick.speed));
    }
    this.pendingKick = null;
  }
  beginTravel(shot) {
    this.travel = { shot, started: this.elapsed };
    Body.setStatic(this.ball, true);
    this.ball.collisionFilter.mask = 0;
    if (shot.score) {
      this.state.addScore(shot.score, `${shot.name} · +${shot.score.toLocaleString('en-US')}`);
      this.flashes.set(shot.id, this.elapsed + shot.duration);
    }
  }
  updateTravel() {
    const { shot, started } = this.travel;
    const progress = clamp((this.elapsed - started) / shot.duration, 0, 1);
    Body.setPosition(this.ball, pointOnPath(shot.path, progress));
    if (progress >= 1) {
      this.travel = null;
      Body.setStatic(this.ball, false);
      this.ball.collisionFilter.mask = 0xFFFFFFFF;
      Body.setVelocity(this.ball, shot.exitVelocity);
      this.shotLock = this.elapsed + 900;
    }
  }
  destroy() { Events.off(this.engine); Composite.clear(this.engine.world, false); Engine.clear(this.engine); }
}
