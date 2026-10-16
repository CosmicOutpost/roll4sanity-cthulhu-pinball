export class GameState {
  constructor() { this.restart(); }
  restart() {
    this.score = 0;
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
