import { SpellLights, AWAKEN_DURATION } from './spell-lights.js';
import { BUMPER_COLOUR_DURATION, bumperRingColours } from './bumper-colours.js';

const COLOURS = { ward: 0xc1915a, sling: 0xa5cf96,
  rail: 0xc8ac70, orbit: 0x79c9b4, ramp: 0xe0bd72, drain: 0x9c4650, gameover: 0x9c4650 };
const DURATIONS = { rail: 400, bumper: BUMPER_COLOUR_DURATION, ward: 650, sling: 450, orbit: 850,
  ramp: 1100, eyes: AWAKEN_DURATION, drain: 950, gameover: 1700 };
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// A few reusable Canvas graphics and bounded event envelopes. No timers, physics
// writes, particles, shaders or ambient animation. The simulation clock pauses us.
export class TableLights {
  constructor(scene, sim, host = window) {
    this.sim = sim;
    this.host = host;
    this.graphics = scene.add.graphics().setDepth(1); // Below mechanisms and ball.
    this.eyes = scene.add.graphics().setDepth(4.5); // Above art/rail decks and labels, below ball and mechanisms.
    this.cues = new Map();
    this.media = host.matchMedia('(prefers-reduced-motion: reduce)');
    this.override = null;
    try {
      const saved = host.localStorage.getItem('roll4sanity-reduced-effects');
      if (saved === 'true' || saved === 'false') this.override = saved === 'true';
    } catch { /* Embedded storage may be blocked. */ }
    this.button = host.document.getElementById('motion');
    this.onPreference = () => this.setReduced(this.override ?? this.media.matches);
    this.onToggle = () => {
      this.override = !this.reduced;
      try { host.localStorage.setItem('roll4sanity-reduced-effects', String(this.override)); } catch { /* Optional persistence. */ }
      this.onPreference();
    };
    this.media.addEventListener('change', this.onPreference);
    this.button.addEventListener('click', this.onToggle);
    this.onPreference();
    this.spells = new SpellLights(sim, this.graphics, this.eyes);
  }

  setReduced(reduced) {
    this.reduced = reduced;
    this.cues.clear();
    this.button.textContent = reduced ? 'LIGHTS: CALM' : 'LIGHTS: FULL';
    this.button.setAttribute('aria-pressed', String(reduced));
    this.button.title = 'Reduced effects: quiet, stationary light cues; no chase lights or eye animation';
    this.host.document.documentElement.dataset.reducedEffects = String(reduced);
  }
  reset() { this.cues.clear(); this.spells.reset(); }
  beginSpell(travel) { this.spells.begin(travel); }
  cancelSpell() { this.spells.cancel(); }
  completeSpell(shot) {
    this.spells.complete(shot);
    if (shot.kind === 'ramp' && !this.reduced) {
      this.cues.delete('eyes');
      this.pulse('eyes', 'eyes', { x: 0, y: 0 });
    }
  }
  pulse(id, kind, position) {
    const now = this.sim.elapsed, duration = DURATIONS[kind];
    if (!duration || !position) return;
    const old = this.cues.get(id);
    // Finish one bumper colour cycle before accepting another. Scoring and
    // sounds still respond to every valid hit; a burst cannot restart the flash.
    if (kind === 'bumper' && old && old.until > now) return;
    // Other repeated hits sustain one glow instead of restarting its envelope.
    if (old && old.until > now) Object.assign(old, position, { until: now + duration });
    else {
      if (this.cues.size >= 16) this.cues.delete(this.cues.keys().next().value);
      this.cues.set(id, { kind, x: position.x, y: position.y, at: now, until: now + duration });
    }
  }

  bumperColours(id) {
    const cue = this.cues.get(id);
    return bumperRingColours(cue?.kind === 'bumper' ? this.sim.elapsed - cue.at : -1, this.reduced);
  }
  strength(id) {
    const cue = this.cues.get(id), now = this.sim.elapsed;
    if (!cue || now >= cue.until) return 0;
    if (this.reduced) return .2;
    return smooth((now - cue.at) / (cue.kind === 'eyes' ? 220 : 70))
      * smooth((cue.until - now) / (cue.kind === 'eyes' ? 700 : 350));
  }
  draw() {
    const g = this.graphics, eyes = this.eyes, sim = this.sim;
    g.clear(); eyes.clear();
    for (const [id, cue] of this.cues) if (sim.elapsed >= cue.until) this.cues.delete(id);
    this.chase = null; // Small opt-in debug observation, not a gameplay event.
    if (sim.state.paused) return;
    for (const [id, cue] of this.cues) {
      const strength = this.strength(id), { x, y, kind } = cue;
      // Bumpers change their existing opaque rings; no additive halo pulse.
      if (kind === 'bumper') continue;
      if (['eyes', 'ramp', 'orbit'].includes(kind)) continue;
      const colour = COLOURS[kind];
      if (kind === 'drain' || kind === 'gameover') {
        g.lineStyle(2, colour, .4 * strength).strokeTriangle(236, 899, 264, 899, 250, 916);
        continue;
      }
      const big = kind === 'ramp' || kind === 'orbit';
      const radius = kind === 'ward' ? 18 : big ? 25 : 13;
      g.fillStyle(colour, .11 * strength).fillCircle(x, y, radius + 6);
      g.lineStyle(big ? 2 : 1.5, colour, .65 * strength).strokeCircle(x, y, radius);
      if (kind === 'ward') g.lineStyle(1, 0xb4585c, .5 * strength).strokeCircle(x, y, radius + 3);
      // A restrained occult diamond on scoring mechanisms; larger awards get
      // a second brass ring. Everything is below the original ball/flipper draw.
      if (kind !== 'rail') {
        const size = big ? 10 : 5;
        const sy = y - radius - 9;
        g.lineStyle(1.5, colour, .7 * strength);
        g.beginPath().moveTo(x, sy - size).lineTo(x + size, sy).lineTo(x, sy + size).lineTo(x - size, sy).closePath().strokePath();
        if (big) g.lineStyle(1, colour, .3 * strength).strokeCircle(x, y, radius + 8);
      }
    }
    this.chase = this.spells.draw(this.reduced, this.cues.get('eyes'));
  }

  destroy() {
    this.media.removeEventListener('change', this.onPreference);
    this.button.removeEventListener('click', this.onToggle);
    this.graphics.destroy(); this.eyes.destroy();
  }
}
