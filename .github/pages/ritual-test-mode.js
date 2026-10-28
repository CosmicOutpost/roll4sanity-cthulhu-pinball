import { BINDS } from './binding-ritual.js';
import Matter from 'matter-js';
import './ritual-test-mode.css';
import './ritual-panel-draft.css';

// Included only in the separately built candidate. No persistent data or
// changes to collision, scores, rules, saved preferences or the other builds.
export class RitualTestMode {
  constructor(sim, scene) {
    this.sim = sim; this.glow = scene.add.graphics().setDepth(3.1); this.enabled = false; this.counts = [0, 0, 0]; this.contacts = [0, 0, 0]; this.hitAt = [-Infinity, -Infinity, -Infinity];
    this.bar = document.createElement('section');
    this.bar.id = 'ritual-test-mode';
    this.bar.setAttribute('aria-label', 'Ritual test mode');
    this.bar.innerHTML = '<div class="test-actions"><button id="test-toggle" type="button" aria-pressed="false">TEST MODE: OFF</button><button id="test-reset" type="button" disabled>RESET TEST</button></div><div id="test-counts" aria-live="polite"></div>';
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
      restart(); this.counts = [0, 0, 0]; this.contacts = [0, 0, 0]; this.hitAt = [-Infinity, -Infinity, -Infinity];
      if (this.enabled) for (const bind of BINDS) sim.state.ritual.complete(bind);
    };
    this.restoreRestart = () => { sim.restart = restart; };
    const hitStone = sim.state.hitStone.bind(sim.state);
    sim.state.hitStone = (id, now) => {
      const accepted = hitStone(id, now);
      if (accepted) {
        this.hitAt[id] = sim.elapsed;
        if (this.enabled) { this.counts[id]++; this.updateCounts(); }
      }
      return accepted;
    };
    this.restoreHitStone = () => { sim.state.hitStone = hitStone; };
    this.onContact = event => {
      if (!this.enabled || sim.state.phase !== 'playing' || sim.travel || !sim.ball) return;
      for (const {bodyA, bodyB} of event.pairs) {
        const other = bodyA === sim.ball ? bodyB : bodyB === sim.ball ? bodyA : null;
        const id = sim.stones.indexOf(other);
        if (id >= 0) { this.contacts[id]++; this.updateCounts(); }
      }
    };
    Matter.Events.on(sim.engine, 'collisionStart', this.onContact);
    this.update();
  }
  canStart() {
    const s = this.sim.state;
    return s.phase === 'gameover' || (s.phase === 'ready' && s.ballNumber === 1 && s.score === 0);
  }
  updateCounts() {
    this.bar.querySelector('#test-counts').innerHTML = ['WEST', 'CENTRE', 'EAST'].map((name, id) => `<span><b>${name}</b> CONTACT ${this.contacts[id]} · HIT ${this.counts[id]}</span>`).join('');
  }
  update() {
    this.glow.clear();
    if (this.sim.state.ritual.empowered) this.sim.stones.forEach((stone, id) => {
      const g = this.glow, {x, y} = stone.position;
      const age = this.sim.elapsed - this.hitAt[id], flash = age >= 0 && age < 800 ? 1 - age / 800 : 0;
      g.lineStyle(8, 0x16d388, .16).strokePoints(stone.vertices, true, true);
      g.lineStyle(4, 0x20e5a0, .7).strokePoints(stone.vertices, true, true);
      g.lineStyle(2, flash ? 0xffffff : 0xffdf71, 1).strokePoints(stone.vertices, true, true);
      g.lineStyle(2, flash ? 0xffffff : 0xffe8a0, 1);
      for (let mark = 0; mark <= id; mark++) {
        const dx = (mark-id/2)*4, c = Math.cos(stone.angle), s = Math.sin(stone.angle);
        g.lineBetween(x + dx*c + 4*s, y + dx*s - 4*c, x + dx*c - 4*s, y + dx*s + 4*c);
      }
      if (flash) {
        g.fillStyle(0xffed98, .45 * flash).fillPoints(stone.vertices, true);
        const u = 1-flash, px=x+(270-x)*u, py=y+(391-y)*u;
        g.lineStyle(3, 0xffdd70, .8*flash).lineBetween(x,y,px,py);
        g.fillStyle(0xffffff, .9*flash).fillCircle(px,py,5);
      }
    });
    this.toggle.disabled = !this.enabled && !this.canStart();
    this.toggle.title = this.toggle.disabled ? 'Finish the current game or press NEW GAME before starting test mode' : 'Switching modes starts a fresh game';
    this.toggle.textContent = `TEST MODE: ${this.enabled ? 'ON' : 'OFF'}`;
    this.toggle.setAttribute('aria-pressed', String(this.enabled));
    this.reset.disabled = !this.enabled;
    this.bar.dataset.active = String(this.enabled);
    this.updateCounts();
  }
  destroy() {
    this.toggle.removeEventListener('click', this.onToggle); this.reset.removeEventListener('click', this.onReset);
    Matter.Events.off(this.sim.engine, 'collisionStart', this.onContact);
    this.restoreRestart(); this.restoreHitStone(); this.glow.destroy(); this.bar.remove();
  }
}
