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
    const flipperSpecs = [
      { pivot: { x: 155, y: 790 }, rest: .24, raised: -.53, side: 'left' },
      { pivot: { x: 345, y: 790 }, rest: Math.PI - .24, raised: Math.PI + .53, side: 'right' },
    ];
    this.rails = [];
    for (const rail of RAILS) {
      const points = rail.points.map(point => [...point]);
      if (rail.flipperFeed) {
        const f = flipperSpecs.find(f => f.side === rail.flipperFeed);
        // Continue the collision feed under the bat instead of terminating on
        // the outside of its pivot. The endpoint is hidden by the flipper; the
        // visible rail geometry is unchanged. This removes the rail/heel cup.
        const axis = { x: Math.cos(f.rest), y: Math.sin(f.rest) };
        const normal = f.side === 'left' ? { x: axis.y, y: -axis.x } : { x: -axis.y, y: axis.x };
        const inset = 8.5 - rail.width / 2;
        // Match the upper rubber surface, not the centerline: otherwise the
        // narrower rail leaves an uphill lip against the rounded heel.
        points[points.length - 1] = [f.pivot.x + axis.x * 22 + normal.x * inset, f.pivot.y + axis.y * 22 + normal.y * inset];
      }
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1], [bx, by] = points[i];
        const body = Bodies.rectangle((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) + rail.width / 2, rail.width, { isStatic: true, angle: Math.atan2(by - ay, bx - ax), restitution: .5, friction: .02, label: 'rail' });
        this.rails.push(add(body));
      }
    }
    BUMPERS.forEach((p, i) => add(Bodies.circle(p.x, p.y, 28, { isStatic: true, restitution: 1, label: `bumper:${i}` })));
    POSTS.forEach(([x, y, r], i) => {
      // Pivot covers belong to the moving bat, not a second, larger stationary
      // post that could shelter a ball from the flipper's contact surface.
      if (flipperSpecs.some(f => f.pivot.x === x && f.pivot.y === y)) return;
      add(Bodies.circle(x, y, r, { isStatic: true, restitution: .85, label: `post:${i}` }));
    });
    SLINGS.forEach((points, i) => {
      const center = { x: points.reduce((s, p) => s + p.x, 0) / 3, y: points.reduce((s, p) => s + p.y, 0) / 3 };
      add(Bodies.fromVertices(center.x, center.y, [points], { isStatic: true, restitution: .8, label: `sling:${i}` }));
    });
    this.flippers = flipperSpecs.map(f => {
      f.angle = f.rest;
      // Match the drawn capsule: centers at the pivot and 80px tip, with a
      // rounded heel extending behind the pivot rather than a flat cut end.
      f.length = 80;
      f.omega = 0;
      f.body = add(Bodies.rectangle(0, 0, f.length + 17, 17, { isStatic: true, chamfer: { radius: 8.5 }, restitution: .3, friction: .08, label: `flipper:${f.side}` }));
      this.positionFlipper(f);
      return f;
    });
  }
  positionFlipper(f, moving = false) {
    f.body.deltaTime = FIXED_DT;
    Body.setPosition(f.body, { x: f.pivot.x + Math.cos(f.angle) * f.length / 2, y: f.pivot.y + Math.sin(f.angle) * f.length / 2 }, moving);
    Body.setAngle(f.body, f.angle, moving);
    if (!moving) {
      Body.setVelocity(f.body, { x: 0, y: 0 });
      Body.setAngularVelocity(f.body, 0);
    }
  }
  spawn() {
    if (this.ball) Composite.remove(this.engine.world, this.ball);
    this.travel = null;
    this.pendingKick = null;
    this.shotLock = this.elapsed + 500;
    this.shooter = true;
    this.charge = 0;
    // Matter's default 9px circle is only a decagon. Its broad flat facets can
    // balance on a shallow flipper/feed slope instead of rolling like steel.
    this.ball = Bodies.polygon(SHOOTER.x, SHOOTER.y, 32, BALL_RADIUS, { circleRadius: BALL_RADIUS, restitution: .45, friction: .015, frictionAir: .0007, density: .008, label: 'ball', slop: .01 });
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
  parkAtPlunger(message) {
    // Weak plunges and any unexpected shooter return must rearm the same ball.
    // Recovery depends on position, not the flag cleared when the launch guide
    // starts; otherwise a returning ball is left dynamic and cannot be launched.
    if (!this.ball.isStatic) Body.setStatic(this.ball, true);
    Body.setPosition(this.ball, SHOOTER);
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
    this.ball.collisionFilter.mask = 0xFFFFFFFF;
    this.shooter = true;
    this.charge = 0;
    this.state.phase = 'ready';
    this.state.lastEvent = message;
  }
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
    const speed = Vector.magnitude(this.ball.velocity);
    if (speed > MAX_SPEED) Body.setVelocity(this.ball, Vector.mult(this.ball.velocity, MAX_SPEED / speed));
    const { x, y } = this.ball.position;
    // A short launch guide carries the shooter lane over its one-way exit rail.
    if (this.shooter && x > 475 && y < 221 && this.ball.velocity.y < 0) {
      this.beginTravel({ id: 'launch', kind: 'launch', duration: 520, path: samplePath([[x, y], [503, 146], [470, 84], [398, 54], [327, 100]]), exitVelocity: { x: -5, y: 7 } });
      this.shooter = false;
      return;
    }
    if (x > 486 && x < 526 && y >= SHOOTER.y && this.ball.velocity.y >= 0) {
      this.parkAtPlunger(this.shooter ? 'PLUNGE TOO SOFT' : 'BALL RETURNED TO PLUNGER');
      return;
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
      // Matter's solver reads positionPrev/anglePrev at each contact. Supplying
      // the actual displacement gives it the bat's surface velocity, including
      // for stationary balls, rounded heels, and the return stroke. Held bats
      // have zero displacement and cannot inject energy into a resting ball.
      this.positionFlipper(f, true);
    }
  }
  isActiveSlingFace(sling, collision) {
    const side = Number(sling.label.split(':')[1]);
    const points = SLINGS[side];
    const start = points[0], end = points[side === 0 ? 1 : 2];
    const edge = Vector.sub(end, start);
    const normal = Vector.normalise(side === 0
      ? { x: edge.y, y: -edge.x } : { x: -edge.y, y: edge.x });
    // Matter's normal points from body B to A. Orient it out of the rubber,
    // then require the long, playfield-facing edge rather than either back edge.
    const outward = Vector.mult(collision.normal, collision.bodyA === this.ball ? 1 : -1);
    const along = Vector.dot(Vector.sub(this.ball.position, start), edge) / Vector.dot(edge, edge);
    // Exclude contacts beyond the sharp tips even if a ball facet supplies an
    // almost parallel normal. Other faces retain Matter's passive restitution.
    return along > 0 && along < 1 && Vector.dot(outward, normal) > .99;
  }
  onCollision(event) {
    if (this.state.phase !== 'playing' || this.travel || !this.ball) return;
    for (const { bodyA, bodyB, collision } of event.pairs) {
      const other = bodyA === this.ball ? bodyB : bodyB === this.ball ? bodyA : null;
      if (!other) continue;
      const bumper = other.label.startsWith('bumper:');
      const sling = other.label.startsWith('sling:');
      if (!bumper && !sling) continue;
      if (sling && !this.isActiveSlingFace(other, collision)) continue;
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
