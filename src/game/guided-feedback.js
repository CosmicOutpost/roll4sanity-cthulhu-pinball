import { eyePalette } from './eye-colours.js';

// Observe guide identity and the simulation clock; never steer or update it.
export class GuidedFeedback {
  constructor(sim, lights, audio) { Object.assign(this, { sim, lights, audio }); this.journey = null; }
  reset() { this.journey = null; this.lights.cancelSpell(); this.audio.endSpell(false); }
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
    if (this.journey && this.journey.travel !== current) {
      const { travel, ball } = this.journey;
      const completed = !sim.travel && ball === sim.ball && sim.state.phase === 'playing'
        && sim.elapsed >= travel.started + travel.shot.duration;
      this.journey = null; // Consume before dispatch: repeated/re-entrant updates cannot replay it.
      if (completed) this.completeShot(travel.shot);
      else { lights.cancelSpell(); audio.endSpell(false, travel.shot.kind); }
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
