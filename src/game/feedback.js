import Matter from 'matter-js';
import { ArcadeAudio } from './audio.js';

// Presentation observes the existing score, flash timestamps and input state.
// It never writes to the simulation, its clocks, collision bodies or rules.
export class ArcadeFeedback {
  constructor(sim, table) {
    this.sim = sim;
    this.table = table;
    this.sound = new ArcadeAudio(document.getElementById('sound'));
    this.caption = document.getElementById('score-feedback');
    this.seen = new Map();
    this.previousScore = sim.state.score;
    this.previousPhase = sim.state.phase;
    this.previousBall = sim.ball;
    this.previousControls = { left: false, right: false };
    this.onCollision = ({ pairs }) => {
      if (sim.state.phase !== 'playing' || sim.state.paused || sim.travel || !sim.ball) return;
      for (const { bodyA, bodyB } of pairs) {
        const other = bodyA === sim.ball ? bodyB : bodyB === sim.ball ? bodyA : null;
        // Rubber posts get a quiet tick, not points or a new target mechanic.
        if (other?.label.startsWith('post:') && Math.hypot(sim.ball.velocity.x, sim.ball.velocity.y) > 2) this.sound.play('post');
      }
    };
    Matter.Events.on(sim.engine, 'collisionStart', this.onCollision);
  }
  update(time) {
    const { sim, sound } = this, { state, controls } = sim;
    const restarted = state.score < this.previousScore || (state.phase === 'ready' && state.ballNumber === 1 && sim.ball !== this.previousBall);
    sound.setPaused(state.paused);
    if (restarted) { this.seen.clear(); this.until = 0; sound.stopVoices(); }
    for (const side of ['left', 'right']) {
      if (controls[side] && !this.previousControls[side] && !state.paused) sound.play('flipper');
      this.previousControls[side] = controls[side];
    }
    if (state.phase === 'playing' && this.previousPhase === 'ready' && sim.ball === this.previousBall && !state.paused) sound.play('launch');
    const effects = [];
    for (const [id, expires] of sim.flashes) {
      if (expires === this.seen.get(id)) continue;
      this.seen.set(id, expires);
      if (expires <= sim.elapsed || restarted || state.paused) continue;
      const kind = id.startsWith('ward:') ? 'ward' : id.startsWith('bumper:') ? 'bumper' : id.startsWith('sling:') ? 'sling' : id.endsWith('orbit') ? 'orbit' : id.endsWith('ramp') ? 'ramp' : null;
      if (kind) { effects.push(kind); sound.play(kind); }
    }
    const delta = state.score - this.previousScore;
    if (delta > 0 && !restarted) {
      const labels = { ward: 'WARD', bumper: 'BUMPER', sling: 'SLING', orbit: 'ORBIT', ramp: 'RAMP' };
      const kinds = [...new Set(effects)];
      const label = kinds.length === 1 ? labels[kinds[0]] : 'POINTS';
      this.message = `${label} +${delta.toLocaleString('en-US')}`;
      this.caption.textContent = this.message;
      this.table.eventText.setText(this.message);
      this.until = time + 950;
    }
    const visible = !state.paused && state.phase === 'playing' && time < (this.until ?? 0);
    if (visible !== this.visible) {
      this.caption.classList.toggle('visible', visible);
      this.visible = visible;
    }
    this.table.eventText.setVisible(visible);
    if (visible) this.table.eventText.setAlpha(Math.min(1, (this.until - time) / 180));
    this.previousScore = state.score;
    this.previousPhase = state.phase;
    this.previousBall = sim.ball;
  }
  destroy() {
    Matter.Events.off(this.sim.engine, 'collisionStart', this.onCollision);
    this.sound.destroy();
  }
}
