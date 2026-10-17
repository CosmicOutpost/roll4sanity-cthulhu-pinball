// Original synthesised arcade effects. No samples, downloads or third-party
// audio assets. The context is created/resumed only inside a trusted gesture.
const PRESETS = {
  flipper: [[150, 65, .055, 'triangle', .42]],
  bumper: [[780, 460, .11, 'triangle', .32], [1170, 900, .07, 'sine', .13]],
  sling: [[430, 180, .075, 'triangle', .3]],
  post: [[1250, 820, .045, 'sine', .12]],
  launch: [[110, 380, .18, 'triangle', .38]],
  orbit: [[523, 523, .1, 'sine', .24], [784, 784, .16, 'sine', .2, .08]],
  ramp: [[659, 659, .1, 'sine', .24], [988, 988, .18, 'sine', .2, .09]],
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
    this.button.setAttribute('aria-label', this.unavailable ? 'Sound unavailable in this browser' : this.muted ? 'Unmute sound' : 'Mute sound');
    this.button.title = this.unavailable ? 'Audio is unavailable; the game remains playable' : this.muted ? 'Sound off — click to unmute' : 'Arcade sounds on — click to mute';
  }
  unlock() {
    if (this.unavailable || this.muted) return;
    try {
      if (!this.context) {
        const Context = this.host.AudioContext || this.host.webkitAudioContext;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.setGain();
      }
      // A blocked/interrupted context is retried on the next player gesture.
      if (this.context.state !== 'running') this.context.resume().catch(() => {});
    } catch {
      this.unavailable = true;
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
  }
  play(kind) {
    const context = this.context;
    if (!PRESETS[kind] || !context || context.state !== 'running' || this.muted || this.paused) return false;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(kind) ?? -Infinity) < (kind === 'post' ? .12 : .035)) return false;
    const preset = PRESETS[kind];
    if (this.voices.size + preset.length > 10) return false;
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
    this.master?.disconnect();
    if (this.context) this.context.close().catch(() => {});
  }
}
