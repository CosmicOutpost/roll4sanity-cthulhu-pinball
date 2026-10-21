import { PinballPhysics } from '../../src/game/physics.js';
import { MAX_SPEED } from '../../src/game/table.js';

// Mechanism-level long session, complementary to real-keyboard browser games.
// Only ordinary control flags and fixed steps drive play. No fixtures or rescue.
export function actionSession({ threshold = 735, interval = 60 } = {}) {
  const sim = new PinballPhysics(), inputs = [], events = [], violations = [];
  const release = { left: 0, right: 0 }, next = { left: 0, right: 0 }, seen = new Map();
  let ballStart = 0, nextRead = 0, pocket = null;
  try {
    for (let i = 0; i < 120 * 240 && sim.state.phase !== 'gameover'; i++) {
      if (sim.state.phase === 'ready') {
        sim.controls.plunger = true;
        sim.controls.left = sim.controls.right = false;
        if (sim.charge === 1) {
          sim.controls.plunger = false;
          sim.launch();
          ballStart = sim.elapsed;
          inputs.push({ ball: sim.state.ballNumber, t: sim.elapsed, action: 'full launch' });
        }
      }
      if (sim.elapsed >= nextRead) {
        nextRead = sim.elapsed + interval;
        for (const side of ['left', 'right']) {
          if (sim.controls[side] && sim.elapsed >= release[side]) {
            sim.controls[side] = false;
            next[side] = sim.elapsed + 260;
            inputs.push({ ball: sim.state.ballNumber, t: sim.elapsed, action: side, down: false });
          } else if (!sim.controls[side] && sim.elapsed >= next[side] && sim.state.phase === 'playing'
            && sim.elapsed - ballStart < 22000 && !sim.travel && !sim.shooter
            && sim.ball.position.y > threshold && sim.ball.velocity.y > 0
            && (side === 'left' ? sim.ball.position.x < 250 : sim.ball.position.x >= 250)) {
            sim.controls[side] = true;
            release[side] = sim.elapsed + 160;
            inputs.push({ ball: sim.state.ballNumber, t: sim.elapsed, action: side, down: true });
          }
        }
      }
      if (sim.elapsed - ballStart >= 22000) sim.controls.left = sim.controls.right = false;
      sim.step();
      for (const [id, expiry] of sim.flashes) if (seen.get(id) !== expiry) {
        seen.set(id, expiry);
        events.push({ id, t: sim.elapsed, ball: sim.state.ballNumber });
      }
      const b = sim.ball;
      if (b && ![b.position.x, b.position.y, b.velocity.x, b.velocity.y].every(Number.isFinite)) violations.push('non-finite motion');
      if (b && sim.state.phase === 'playing' && !sim.travel && !sim.shooter) {
        if (Math.hypot(b.velocity.x, b.velocity.y) > MAX_SPEED + .01) violations.push('excess speed');
        if (!pocket || pocket.id !== b.id || Math.hypot(b.position.x - pocket.x, b.position.y - pocket.y) > 24) pocket = { id: b.id, ...b.position, t: sim.elapsed };
        else if (sim.elapsed - pocket.t > 6000) { violations.push(`pocket ${b.position.x.toFixed(1)},${b.position.y.toFixed(1)}`); break; }
      } else pocket = null;
    }
    return { threshold, interval, phase: sim.state.phase, ball: sim.state.ballNumber, score: sim.state.score,
      elapsed: Math.round(sim.elapsed), inputs, events, violations,
      wards: events.filter(e => e.id.startsWith('ward:')).length,
      combinations: events.filter((e, i) => i && e.ball === events[i - 1].ball && e.id !== events[i - 1].id && e.t - events[i - 1].t < 1000).length };
  } finally { sim.destroy(); }
}
