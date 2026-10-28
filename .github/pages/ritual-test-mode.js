import { BINDS } from './binding-ritual.js';
import './ritual-test-mode.css';

// Included only in the separately built candidate. No persistent data or
// changes to collision, scores, rules, saved preferences or the other builds.
export class RitualTestMode {
  constructor(sim, scene) {
    this.sim = sim; this.glow = scene.add.graphics().setDepth(2.9); this.enabled = false; this.counts = [0, 0, 0];
    this.bar = document.createElement('section');
    this.bar.id = 'ritual-test-mode';
    this.bar.setAttribute('aria-label', 'Ritual test mode');
    this.bar.innerHTML = '<div class="test-actions"><button id="test-toggle" type="button" aria-pressed="false">TEST MODE: OFF</button><button id="test-reset" type="button" disabled>RESET TEST</button></div><div id="test-counts" aria-live="polite">WEST 0 · CENTRE 0 · EAST 0</div>';
    document.querySelector('#ritual-progress').insertAdjacentElement('afterend', this.bar);
    this.toggle = this.bar.querySelector('#test-toggle'); this.reset = this.bar.querySelector('#test-reset');
    this.onToggle = () => {
      // Never interrupt an in-progress normal game. Finish or restart first.
      if (!this.enabled && !this.canStart()) return;
      this.enabled = !this.enabled; this.sim.releaseControls(); this.sim.restart(); this.update();
    };
    this.onReset = () => { if (this.enabled) { this.sim.releaseControls(); this.sim.restart(); this.update(); } };
    this.toggle.addEventListener('click', this.onToggle); this.reset.addEventListener('click', this.onReset);
    const restart = sim.restart.bind(sim);
    sim.restart = () => {
      restart(); this.counts = [0, 0, 0];
      if (this.enabled) for (const bind of BINDS) sim.state.ritual.complete(bind);
    };
    this.restoreRestart = () => { sim.restart = restart; };
    const hitStone = sim.state.hitStone.bind(sim.state);
    sim.state.hitStone = (id, now) => {
      const accepted = hitStone(id, now);
      if (accepted && this.enabled) this.counts[id]++;
      return accepted;
    };
    this.restoreHitStone = () => { sim.state.hitStone = hitStone; };
    this.update();
  }
  canStart() {
    const s = this.sim.state;
    return s.phase === 'gameover' || (s.phase === 'ready' && s.ballNumber === 1 && s.score === 0);
  }
  update() {
    this.glow.clear();
    if (this.enabled) for (const stone of this.sim.stones) {
      this.glow.fillStyle(0xe4c874, .14).fillCircle(stone.position.x, stone.position.y, 18);
      this.glow.lineStyle(2, 0xf2d98a, .75).strokeCircle(stone.position.x, stone.position.y, 17);
    }
    this.toggle.disabled = !this.enabled && !this.canStart();
    this.toggle.title = this.toggle.disabled ? 'Finish the current game or press NEW GAME before starting test mode' : 'Switching modes starts a fresh game';
    this.toggle.textContent = `TEST MODE: ${this.enabled ? 'ON' : 'OFF'}`;
    this.toggle.setAttribute('aria-pressed', String(this.enabled));
    this.reset.disabled = !this.enabled;
    this.bar.dataset.active = String(this.enabled);
    this.bar.querySelector('#test-counts').textContent = `WEST ${this.counts[0]} · CENTRE ${this.counts[1]} · EAST ${this.counts[2]}`;
  }
  destroy() {
    this.toggle.removeEventListener('click', this.onToggle); this.reset.removeEventListener('click', this.onReset);
    this.restoreRestart(); this.restoreHitStone(); this.glow.destroy(); this.bar.remove();
  }
}
