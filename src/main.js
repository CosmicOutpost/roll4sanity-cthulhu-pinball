import Phaser from 'phaser';
import './style.css';
import './cabinet.css';
import playfieldArt from './assets/playfield-art.png';
import { PinballPhysics } from './game/physics.js';
import { TableRenderer } from './game/render.js';
import { bindControls } from './game/controls.js';
import { ArcadeFeedback } from './game/feedback.js';
import { WIDTH, HEIGHT } from './game/table.js';

class PinballScene extends Phaser.Scene {
  constructor() { super('pinball'); }
  preload() {
    this.load.image('playfield-art', playfieldArt);
  }
  create() {
    this.sim = new PinballPhysics();
    this.table = new TableRenderer(this, this.sim);
    this.table.debug = new URLSearchParams(location.search).get('debug') === '1';
    const toggleDebug = () => { this.table.debug = !this.table.debug; this.refreshHUD(); };
    this.unbind = bindControls(this.sim, toggleDebug, () => this.refreshHUD());
    this.feedback = new ArcadeFeedback(this.sim, this.table);
    // Opt-in inspection for physics diagnostics and automated browser checks.
    if (new URLSearchParams(location.search).get('debug') === '1') {
      window.pinball = this.sim;
      window.pinballPresentation = this.feedback;
    }
    this.events.once('shutdown', () => {
      this.unbind(); this.feedback.destroy(); this.sim.destroy();
      delete window.pinball; delete window.pinballPresentation;
    });
    this.refreshHUD();
  }
  refreshHUD() {
    const { state } = this.sim;
    const charging = !state.paused && state.phase === 'ready' && this.sim.controls.plunger;
    const chargePercent = charging ? Math.round(this.sim.charge * 100) : 0;
    const signature = [state.score, state.ballNumber, state.phase, state.paused, state.lastEvent, this.table.debug, charging, chargePercent].join('|');
    if (this.hudSignature === signature) return;
    this.hudSignature = signature;
    document.getElementById('score').textContent = String(state.score).padStart(6, '0');
    document.getElementById('ball').innerHTML = `${String(state.ballNumber).padStart(2, '0')} <small>/ 03</small>`;
    const show = state.paused || state.phase !== 'playing';
    document.getElementById('message').classList.toggle('visible', show);
    document.getElementById('message-title').textContent = state.paused ? 'HOLD YOUR BREATH' : state.phase === 'gameover' ? 'CLAIMED BY THE DEEP' : charging ? `PLUNGER CHARGING · ${chargePercent}%` : state.lastEvent;
    document.getElementById('message-detail').textContent = state.paused ? 'PRESS P OR Ⅱ TO RESUME' : state.phase === 'gameover' ? `FINAL SCORE ${state.score.toLocaleString()} · PRESS R TO BEGIN AGAIN` : charging && chargePercent === 100 ? 'FULL CHARGE · RELEASE TO LAUNCH' : 'HOLD SPACE OR LAUNCH FOR 1.2s, THEN RELEASE';
    document.getElementById('pause').setAttribute('aria-label', state.paused ? 'Resume game' : 'Pause game');
    document.getElementById('pause').textContent = state.paused ? '▷' : 'II';
    document.getElementById('debug').setAttribute('aria-pressed', String(this.table.debug));
    const velocity = document.getElementById('velocity');
    velocity.hidden = !this.table.debug;
    velocity.textContent = this.sim.ball ? `VELOCITY ${this.sim.ball.velocity.x.toFixed(1)} / ${this.sim.ball.velocity.y.toFixed(1)}` : 'BALL DRAINED';
  }
  update(_time, delta) {
    this.sim.update(delta);
    this.table.draw();
    this.feedback.update(_time);
    this.refreshHUD();
    if (this.table.debug && (!this.lastVelocityUpdate || _time - this.lastVelocityUpdate > 120)) {
      this.lastVelocityUpdate = _time;
      const ball = this.sim.ball;
      document.getElementById('velocity').textContent = ball ? `VELOCITY ${ball.velocity.x.toFixed(1)} / ${ball.velocity.y.toFixed(1)}` : 'BALL DRAINED';
    }
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0c2330',
  antialias: true,
  banner: false,
  scene: PinballScene,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { powerPreference: 'low-power' },
});
