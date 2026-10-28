// Pure per-game rules. No clocks, physics, rendering, storage or audio ownership.
export const BINDS = Object.freeze([
  { id: 'right-ramp', kind: 'ramp', name: 'Arkham', colour: '#f23c55', shot: 'Right ramp' },
  { id: 'left-ramp', kind: 'ramp', name: 'Dunwich', colour: '#21e58d', shot: 'Left ramp' },
  { id: 'left-orbit', kind: 'orbit', name: 'Innsmouth', colour: '#329dff', shot: 'Left orbit' },
  { id: 'right-orbit', kind: 'orbit', name: 'Kingsport', colour: '#af58ff', shot: 'Right orbit' },
]);
export const SEAL_BONUS = 10000;
export class BindingRitual {
  constructor() {
    this.binds = new Set();
    this.stones = new Set();
    this.revision = 0;
    this.sealed = false;
    this.activations = new Map();
    this.sealedAt = null;
  }
  get empowered() { return this.binds.size === BINDS.length; }
  complete(shot) {
    if (!BINDS.some(b => b.id === shot.id && b.kind === shot.kind) || this.binds.has(shot.id)) return false;
    this.binds.add(shot.id); this.revision++;
    return true;
  }
  strike(id, now) {
    if (!this.empowered || this.sealed || !Number.isInteger(id) || id < 0 || id > 2 || this.stones.has(id)) return false;
    this.stones.add(id); this.activations.set(id, now); this.revision++;
    if (this.stones.size === 3) { this.sealed = true; this.sealedAt = now; }
    return true;
  }
}
