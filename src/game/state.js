import { BindingRitual, SEAL_BONUS } from './binding-ritual.js';
import { STONE_RULES } from './table.js';

export class GameState {
  constructor() { this.restart(); }
  restart() {
    this.score = 0;
    this.ritual = new BindingRitual();
    this.ballNumber = 1;
    this.phase = 'ready';
    this.paused = false;
    this.lastEvent = 'THE DEEP IS WAITING';
  }
  launch() {
    if (this.phase !== 'ready' || this.paused) return false;
    this.phase = 'playing';
    return true;
  }
  addScore(points, label) {
    if (this.phase !== 'playing' || this.paused) return false;
    this.score += points;
    this.lastEvent = label;
    return true;
  }
  completeBind(shot) {
    if (this.phase !== 'playing' || this.paused) return false;
    return this.ritual.complete(shot);
  }
  hitStone(id, now) {
    if (this.phase !== 'playing' || this.paused || !Number.isInteger(id) || id < 0 || id > 2) return false;
    this.addScore(STONE_RULES.score, `COVER STONE ${id + 1} · +${STONE_RULES.score}`);
    const wasSealed = this.ritual.sealed;
    this.ritual.strike(id, now);
    if (!wasSealed && this.ritual.sealed) this.addScore(SEAL_BONUS, 'CTHULHU IS SEALED!');
    return true;
  }
  drain() {
    if (this.phase !== 'playing') return false;
    if (this.ballNumber === 3) {
      this.phase = 'gameover';
      this.lastEvent = 'CLAIMED BY THE DEEP';
    } else {
      this.ballNumber += 1;
      this.phase = 'ready';
      this.lastEvent = 'ANOTHER CHANCE';
    }
    return true;
  }
  togglePause() { this.paused = !this.paused; }
}
