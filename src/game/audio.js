import { RitualAudio } from './ritual-audio.js';
import { HorrorMusic } from './music.js';

// Original synthesised arcade effects. No samples, downloads or third-party
// audio assets. The context is created/resumed only inside a trusted gesture.
const PRESETS = {
  flipper: [[150, 65, .055, 'triangle', .42]],
  bumper: [[180, 70, .045, 'triangle', .28], [420, 330, .14, 'sine', .17], [84, 62, .12, 'sine', .1]],
  ward: [[1100, 700, .055, 'triangle', .2], [164, 138, .19, 'sine', .18]],
  sling: [[430, 180, .075, 'triangle', .3]],
  post: [[1250, 820, .045, 'sine', .12]],
  launch: [[110, 380, .18, 'triangle', .38]],
  orbit: [[523, 392, .14, 'sine', .18], [196, 147, .25, 'triangle', .12, .04]],
  ramp: [[659, 988, .19, 'sine', .19], [1320, 1046, .22, 'sine', .1, .09], [82, 65, .34, 'triangle', .13]],
  rune: [[1780, 1200, .08, 'sine', .11]],
  rail: [[1360, 710, .085, 'sine', .09], [220, 146, .13, 'triangle', .1]],
  gameover: [[110, 41, .62, 'triangle', .2], [165, 55, .52, 'sine', .13, .08], [82, 36, .64, 'sine', .1]],
};

export class ArcadeAudio {
  constructor(button, host = window) {
    this.host = host;
    this.button = button;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.lastPlayed = new Map();
    this.played = 0;
    this.paused = false;
    this.unavailable = !(host.AudioContext || host.webkitAudioContext);
    try { this.muted = host.localStorage.getItem('roll4sanity-muted') === 'true'; }
    catch { this.muted = false; }
    this.ritual = new RitualAudio(this);
    this.music = new HorrorMusic(this);
    this.onContextState = () => this.music.sync();
    this.onGesture = event => {
      if (event.isTrusted && (['pointerdown', 'pointerup'].includes(event.type) || ['KeyZ', 'Slash', 'Space', 'KeyP', 'KeyR'].includes(event.code))) this.unlock();
    };
    // Hidden tabs may stop Phaser updates before the feedback observer runs.
    // Silence directly on focus/visibility loss as well as ordinary pause.
    this.onBlur = () => this.setPaused(true);
    this.onVisibility = () => { if (host.document.hidden) this.onBlur(); };
    this.onToggle = event => {
      if (!event.isTrusted) return;
      this.muted = !this.muted;
      try { host.localStorage.setItem('roll4sanity-muted', String(this.muted)); } catch { /* Storage can be blocked in embeds. */ }
      this.stopVoices();
      if (!this.muted) this.unlock();
      this.setGain();
      this.music.sync();
      this.refreshButton();
    };
    host.addEventListener('pointerdown', this.onGesture, true);
    // Touch activation may be granted on release rather than press.
    host.addEventListener('pointerup', this.onGesture, true);
    host.addEventListener('keydown', this.onGesture, true);
    host.addEventListener('blur', this.onBlur);
    host.document.addEventListener('visibilitychange', this.onVisibility);
    button.addEventListener('click', this.onToggle);
    this.refreshButton();
  }
  refreshButton() {
    this.button.textContent = 'SFX';
    this.button.disabled = this.unavailable;
    this.button.setAttribute('aria-pressed', String(this.muted));
    this.button.setAttribute('aria-label', this.unavailable ? 'Sound unavailable in this browser' : this.muted ? 'Unmute all audio' : 'Mute all audio');
    this.button.title = this.unavailable ? 'Audio is unavailable; the game remains playable' : this.muted ? 'All audio off — click to unmute' : 'Sound effects and music on — click to mute all audio';
  }
  unlock() {
    if (this.unavailable || this.muted) return;
    try {
      if (!this.context) {
        const Context = this.host.AudioContext || this.host.webkitAudioContext;
        this.context = new Context();
        this.context.addEventListener('statechange', this.onContextState);
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.setGain();
      }
      // A blocked/interrupted context is retried on the next player gesture.
      if (this.context.state !== 'running') this.context.resume().then(() => this.music.sync()).catch(() => {});
      else this.music.sync();
    } catch {
      this.unavailable = true;
      this.music.unavailable = true; this.music.refresh();
      this.refreshButton();
    }
  }
  setGain() {
    if (this.master) this.master.gain.value = this.muted || this.paused ? 0 : .18;
  }
  setPaused(paused) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) this.stopVoices();
    this.setGain();
    this.music.sync();
  }
  play(kind) {
    const context = this.context;
    if ((!PRESETS[kind] && kind !== 'drain') || !context || context.state !== 'running' || this.muted || this.paused) return false;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(kind) ?? -Infinity) < (kind === 'rail' ? .35 : kind === 'post' ? .12 : kind === 'bumper' ? .1 : .035)) return false;
    if (kind === 'drain') {
      if (!this.ritual.ballLost()) return false;
      this.lastPlayed.set(kind, now); this.played++; this.lastEffect = kind;
      return true;
    }
    const preset = PRESETS[kind];
    if (this.voices.size + preset.length > 10) {
      if (kind === 'ramp' || kind === 'orbit') this.stopVoices();
      else return false;
    }
    this.lastPlayed.set(kind, now);
    for (const [start, end, duration, type, level, delay = 0] of preset) {
      const oscillator = context.createOscillator(), envelope = context.createGain();
      const at = now + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, at);
      oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(level, at + .004);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      const voice = { oscillator, envelope };
      this.voices.add(voice);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect(); this.voices.delete(voice);
      };
      oscillator.start(at);
      oscillator.stop(at + duration + .01);
    }
    this.played++;
    this.lastEffect = kind;
    return true;
  }
  stopVoices() {
    this.ritual.stopAll();
    for (const voice of this.voices) {
      try { voice.oscillator.stop(); } catch { /* An ended voice may be awaiting its callback. */ }
      voice.oscillator.disconnect(); voice.envelope.disconnect();
    }
    this.voices.clear();
  }
  destroy() {
    this.host.removeEventListener('pointerdown', this.onGesture, true);
    this.host.removeEventListener('pointerup', this.onGesture, true);
    this.host.removeEventListener('keydown', this.onGesture, true);
    this.host.removeEventListener('blur', this.onBlur);
    this.host.document.removeEventListener('visibilitychange', this.onVisibility);
    this.button.removeEventListener('click', this.onToggle);
    this.stopVoices();
    this.ritual.destroy();
    this.music.destroy();
    this.master?.disconnect();
    if (this.context) {
      this.context.removeEventListener('statechange', this.onContextState);
      this.context.close().catch(() => {});
    }
  }
}
