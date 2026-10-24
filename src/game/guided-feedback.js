// Observe guide identity and the simulation clock; never steer or update it.
export class GuidedFeedback {
  constructor(sim, lights, audio) { Object.assign(this, { sim, lights, audio }); this.journey = null; }
  reset() { this.journey = null; this.lights.cancelSpell(); this.audio.endSpell(false); }
  update() {
    const { sim, lights, audio } = this;
    if (sim.state.paused) return;
    const current = ['ramp', 'orbit'].includes(sim.travel?.shot.kind) ? sim.travel : null;
    if (this.journey && this.journey.travel !== current) {
      const { travel, ball } = this.journey;
      const completed = !sim.travel && ball === sim.ball && sim.state.phase === 'playing'
        && sim.elapsed >= travel.started + travel.shot.duration;
      if (completed) lights.completeSpell(travel.shot);
      else lights.cancelSpell();
      audio.endSpell(completed, travel.shot.kind);
      this.journey = null;
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
