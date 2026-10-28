import { eyePalette } from './eye-colours.js';

// Observe guide identity and the simulation clock; never steer or update it.
export class GuidedFeedback {
  constructor(sim, lights, audio) { Object.assign(this, { sim, lights, audio }); this.journey = null; this.completed = sim.completedShot; }
  reset() { this.completed = this.sim.completedShot; this.journey = null; this.lights.cancelSpell(); this.audio.endSpell(false); }
  completeShot(shot) {
    // One confirmed event routes both effects, using the same real ID/kind gate.
    // Audio may be muted/unavailable; that must never suppress the eyes.
    if (!eyePalette(shot)) { this.lights.cancelSpell(); this.audio.endSpell(false, shot.kind); return; }
    this.lights.completeSpell(shot);
    this.audio.endSpell(true, shot.kind); // Existing route-specific bell/drone release.
    this.audio.roar(); // Exactly one request, independent of audio mute/cooldowns.
  }
  update() {
    const { sim, lights, audio } = this;
    if (sim.state.paused) return;
    const current = ['ramp', 'orbit'].includes(sim.travel?.shot.kind) ? sim.travel : null;
    const event = sim.completedShot;
    if (event && event !== this.completed) {
      this.completed = event; // Consume before callbacks, including re-entry.
      this.journey = null;
      if (event.ball === sim.ball && sim.state.phase === 'playing') this.completeShot(event.shot);
    }
    if (this.journey && this.journey.travel !== current) {
      const kind = this.journey.travel.shot.kind;
      this.journey = null;
      lights.cancelSpell(); audio.endSpell(false, kind);
    }
    if (!current) return;
    const progress = Math.max(0, Math.min(1, (sim.elapsed - current.started) / current.shot.duration));
    if (!this.journey) {
      this.journey = { travel: current, ball: sim.ball };
      lights.beginSpell(current);
      audio.startSpell(progress, true);
    } else audio.updateSpell(progress);
  }
}
