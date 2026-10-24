import { renderMusicLoop } from './music-score.js';

export const MUSIC_LEVEL = .1; // Normalised score, well below impacts/roar through the existing .18 master.
export function musicPreference(storage) {
  try { return storage.getItem('roll4sanity-music') !== 'false'; } catch { return true; }
}

// One pre-rendered procedural loop, one active source, no scheduling interval.
// Position survives pause/mute; every stopped source/filter is disconnected.
export class HorrorMusic {
  constructor(owner) {
    this.owner = owner;
    try { this.enabled = musicPreference(owner.host.localStorage); } catch { this.enabled = true; }
    this.offset = 0; this.ended = false; this.destroyed = false;
    this.buffer = null; this.pending = null; this.source = null; this.gain = null; this.tail = null;
    this.unavailable = owner.unavailable || !(owner.host.OfflineAudioContext || owner.host.webkitOfflineAudioContext);
    this.button = owner.host.document.getElementById('music');
    this.onToggle = () => {
      this.enabled = !this.enabled;
      try { owner.host.localStorage.setItem('roll4sanity-music', String(this.enabled)); } catch { /* Optional persistence. */ }
      this.refresh(); this.sync();
    };
    this.button?.addEventListener('click', this.onToggle); this.refresh();
  }
  refresh() {
    if (!this.button) return;
    this.button.textContent = this.enabled ? 'MUSIC: ON' : 'MUSIC: OFF';
    this.button.disabled = !!this.unavailable;
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.setAttribute('aria-label', this.enabled ? 'Turn music off' : 'Turn music on');
    this.button.title = this.unavailable ? 'Procedural music unavailable in this browser' : 'Quiet horror score; global SFX mute silences all audio';
  }
  canPlay() {
    const a = this.owner;
    return !this.destroyed && !this.unavailable && this.enabled && !this.ended && !a.muted && !a.paused && a.context?.state === 'running';
  }
  sync() {
    if (!this.canPlay()) {
      const softOff = !this.enabled && !this.owner.paused && !this.owner.muted && !this.ended && !this.destroyed && this.owner.context?.state === 'running';
      this.stop(!this.ended, !softOff); return;
    }
    if (this.source) return;
    if (this.buffer) { this.start(); return; }
    if (this.pending) return;
    this.pending = renderMusicLoop(this.owner.host, this.owner.context.sampleRate);
    this.pending.then(buffer => {
      this.pending = null;
      if (this.destroyed) return;
      this.buffer = buffer; this.sync();
    }).catch(() => {
      this.pending = null; this.unavailable = true; this.refresh(); // SFX/game remain available.
    });
  }
  start() {
    if (!this.canPlay() || this.source || !this.buffer) return;
    this.disposeTail();
    const ctx = this.owner.context, source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = this.buffer; source.loop = true;
    gain.connect(this.owner.master); source.connect(gain);
    this.source = source; this.gain = gain; this.startedAt = ctx.currentTime;
    this.scheduleGain(true); source.start(this.startedAt, this.offset % this.buffer.duration);
  }
  position() {
    return this.source ? (this.offset + this.owner.context.currentTime - this.startedAt) % this.buffer.duration : this.offset;
  }
  disposeTail() {
    if (!this.tail) return;
    const { source, gain } = this.tail; this.tail = null;
    source.onended = null; try { source.stop(); } catch { /* Already ended. */ }
    source.disconnect(); gain.disconnect();
  }
  stop(remember = true, immediate = true) {
    if (!remember) this.duckState = null;
    if (this.source) {
      const source = this.source, gain = this.gain, ctx = this.owner.context;
      this.offset = remember ? this.position() : 0;
      this.source = this.gain = null; this.disposeTail(); this.tail = { source, gain };
      if (immediate) this.disposeTail();
      else {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(this.levelAt(now), now);
        gain.gain.linearRampToValueAtTime(0, now + .025);
        source.onended = () => { if (this.tail?.source === source) this.disposeTail(); };
        source.stop(now + .03);
      }
    } else if (!remember) this.offset = 0;
    if (immediate) this.disposeTail();
  }
  levelAt(time) {
    const d = this.duckState;
    if (!d || time >= d.end) return MUSIC_LEVEL;
    if (time < d.at + .035) return d.from + (MUSIC_LEVEL * d.depth - d.from) * Math.max(0, (time - d.at) / .035);
    if (time < d.hold) return MUSIC_LEVEL * d.depth;
    return MUSIC_LEVEL * (d.depth + (1 - d.depth) * (time - d.hold) / (d.end - d.hold));
  }
  scheduleGain(fade = false) {
    if (!this.gain) return;
    const now = this.owner.context.currentTime, at = now + (fade ? .06 : 0), param = this.gain.gain, d = this.duckState;
    param.cancelScheduledValues(now); param.setValueAtTime(fade ? 0 : this.levelAt(now), now);
    if (fade) param.linearRampToValueAtTime(this.levelAt(at), at);
    if (d && d.end > at) {
      if (d.at + .035 > at) param.linearRampToValueAtTime(MUSIC_LEVEL * d.depth, d.at + .035);
      if (d.hold > at) param.setValueAtTime(MUSIC_LEVEL * d.depth, d.hold);
      param.linearRampToValueAtTime(MUSIC_LEVEL, d.end);
    }
  }
  duck(duration = 1.85, depth = .2) {
    if (!this.owner.context) return;
    const at = this.owner.context.currentTime, from = this.levelAt(at);
    this.duckState = { at, from, depth, hold: at + .75, end: at + duration };
    this.scheduleGain();
  }
  setEnded(ended) { if (ended !== this.ended) { this.ended = ended; this.sync(); } }
  restart() { this.stop(false, true); this.ended = false; this.sync(); }
  destroy() {
    this.destroyed = true; this.stop(false, true); this.buffer = null;
    this.button?.removeEventListener('click', this.onToggle);
  }
}
