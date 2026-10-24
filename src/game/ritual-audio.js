// Original procedural synthesis only. Every group owns and releases its sources,
// filters and echo loop. No audio downloads, speech API or perpetual ambience.
export class RitualAudio {
  constructor(owner) {
    this.owner = owner; this.groups = new Set(); this.travel = null;
  }
  canPlay() { const a = this.owner; return a.context?.state === 'running' && !a.muted && !a.paused; }
  group(name, duration, level = .5, echo = false) {
    if (!this.canPlay()) return null;
    const ctx = this.owner.context, now = ctx.currentTime;
    if (this.groups.size >= 4) ([...this.groups].find(g => g !== this.travel) ?? this.groups.values().next().value).dispose();
    const g = { name, at: now, end: now + duration, nodes: [], sources: [], released: false };
    const node = n => { g.nodes.push(n); return n; };
    g.node = node;
    g.input = node(ctx.createGain());
    const high = g.high = node(ctx.createBiquadFilter()); high.type = 'highpass'; high.frequency.value = 65;
    g.filter = node(ctx.createBiquadFilter()); g.filter.type = 'lowpass'; g.filter.frequency.value = 3800; g.filter.Q.value = .6;
    g.gain = node(ctx.createGain()); g.gain.gain.value = level;
    g.input.connect(high); high.connect(g.filter); g.filter.connect(g.gain); g.gain.connect(this.owner.master);
    if (echo) {
      const delay = node(ctx.createDelay(.4)), feedback = node(ctx.createGain()), wet = node(ctx.createGain());
      delay.delayTime.value = .19; feedback.gain.value = .19; wet.gain.value = .24;
      g.filter.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(g.gain);
    }
    g.dispose = () => {
      if (!this.groups.has(g)) return;
      this.groups.delete(g);
      if (this.travel === g) this.travel = null;
      for (const source of g.sources) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } }
      for (const n of g.nodes) n.disconnect();
      g.sources.length = g.nodes.length = 0;
    };
    g.release = (seconds = .09) => {
      if (!seconds) { g.dispose(); return; }
      if (g.released) return;
      g.released = true;
      const at = ctx.currentTime;
      g.gain.gain.cancelScheduledValues(at);
      g.gain.gain.setTargetAtTime(.0001, at, seconds / 4);
      for (const source of g.sources) try { source.stop(at + seconds); } catch { /* Ended. */ }
    };
    this.groups.add(g);
    return g;
  }
  source(g, source, gain) {
    const ctx = this.owner.context, envelope = g.node(ctx.createGain());
    envelope.gain.value = gain; source.connect(envelope); envelope.connect(g.input);
    g.node(source); g.sources.push(source);
    source.onended = () => {
      source._finished = true;
      if (g.sources.every(s => s._finished)) g.dispose();
    };
    source.start(); source.stop(g.end);
    return { source, gain: envelope.gain, envelope };
  }
  tone(g, type, frequency, level, endFrequency = frequency, audible = g.end - g.at) {
    const ctx = this.owner.context, oscillator = ctx.createOscillator(); oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, g.at);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, g.at + Math.max(.03, audible));
    const voice = this.source(g, oscillator, .0001);
    voice.gain.setValueAtTime(.0001, g.at);
    voice.gain.linearRampToValueAtTime(level, g.at + .045);
    voice.gain.exponentialRampToValueAtTime(.0001, g.at + Math.max(.06, audible));
    return voice;
  }
  noise(g, level) {
    const ctx = this.owner.context;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .5), ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let seed = 1907;
      for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741824 - 1; }
    }
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = true;
    return this.source(g, source, level);
  }
  startSpell(progress = 0, activation = true) {
    if (!this.canPlay()) return;
    if (this.travel) this.travel.release();
    const g = this.group('travel', 8, .42); if (!g) return;
    this.travel = g; g.lastRune = Math.floor(progress * 12);
    g.filter.frequency.value = 2200;
    // A low rumble under two slightly detuned shimmer oscillators.
    const body = this.source(g, this.owner.context.createOscillator(), .2); body.source.type = 'triangle';
    const a = this.source(g, this.owner.context.createOscillator(), .11); a.source.type = 'sine'; a.source.detune.value = -7;
    const b = this.source(g, this.owner.context.createOscillator(), .1); b.source.type = 'triangle'; b.source.detune.value = 7;
    g.tones = [body.source, a.source, b.source];
    g.gain.gain.setValueAtTime(.0001, g.at); g.gain.gain.linearRampToValueAtTime(.42, g.at + .08);
    if (activation) this.tone(g, 'triangle', 92, .22, 55, .32);
    this.updateSpell(progress);
  }
  updateSpell(progress) {
    if (!this.canPlay()) return;
    if (!this.travel || this.travel.released) this.startSpell(progress, false);
    const g = this.travel; if (!g) return;
    const at = this.owner.context.currentTime, p = Math.max(0, Math.min(1, progress));
    [90 + p * 160, 420 + p * 900, 426 + p * 915].forEach((hz, i) => g.tones[i].frequency.setTargetAtTime(hz, at, .045));
    g.filter.frequency.setTargetAtTime(1800 + p * 1600, at, .06);
    g.gain.gain.setTargetAtTime(.42 + p * .2, at, .04);
    const rune = Math.floor(p * 12);
    if (rune > g.lastRune) { this.owner.play('rune'); g.lastRune = rune; }
    g.progress = p;
  }
  endSpell(completed, kind) {
    if (this.travel) { this.travel.release(.1); this.travel = null; }
    if (!completed || !this.canPlay()) return;
    const g = this.group('completion', 2.5, kind === 'ramp' ? .28 : .55, true); if (!g) return;
    this.tone(g, 'sine', 146.8, .36, 130.8, 1.9);
    this.tone(g, 'sine', 310, .2, 294, 1.65);
    this.tone(g, 'triangle', 427, .1, 392, 1.4);
  }
  roar() {
    for (const old of this.groups) if (old.name === 'roar' && !old.released) old.release(.06);
    const g = this.group('roar', 2.3, .62, true); if (!g) return;
    const ctx = this.owner.context;
    g.high.frequency.value = 35;
    g.filter.frequency.setValueAtTime(1900, g.at);
    g.filter.frequency.linearRampToValueAtTime(1100, g.at + 2.2);
    const envelope = (voice, level, attack = .13, hold = .8) => {
      voice.gain.cancelScheduledValues(g.at); voice.gain.setValueAtTime(.0001, g.at);
      voice.gain.linearRampToValueAtTime(level, g.at + attack);
      voice.gain.linearRampToValueAtTime(level * .88, g.at + hold);
      voice.gain.exponentialRampToValueAtTime(.0001, g.at + 2.23);
    };
    // Almost stationary fundamentals. No sawtooth, vocal formants or pitch LFO.
    envelope(this.tone(g, 'sine', 47, .22, 45, 2.23), .22, .16);
    envelope(this.tone(g, 'sine', 69, .055, 67.5, 2.23), .055, .19);
    const turbulence = (seed, type, cutoff, q, level, rough = false) => {
      // A full-length non-looping noise bed avoids the old half-second repetition.
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2.3), ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) { seed = seed * 16807 % 2147483647; data[i] = seed / 1073741824 - 1; }
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const voice = this.source(g, source, .0001), filter = g.node(ctx.createBiquadFilter());
      filter.type = type; filter.frequency.value = cutoff; filter.Q.value = q;
      source.disconnect(); source.connect(filter);
      if (rough) {
        const shaper = g.node(ctx.createWaveShaper());
        shaper.curve = Float32Array.from({ length: 512 }, (_, i) => Math.tanh((i / 255.5 - 1) * 2.4));
        filter.connect(shaper); shaper.connect(voice.envelope);
      } else filter.connect(voice.envelope);
      envelope(voice, level, rough ? .09 : .18, rough ? .65 : .95);
    };
    turbulence(1928, 'lowpass', 185, .5, .9); // geological pressure and uneven rumble
    turbulence(7331, 'bandpass', 630, .55, .46, true); // irregular, breathy rasp
    turbulence(10201, 'bandpass', 1250, .4, .19); // air above the throat, no voiced syllables
  }

  ballLost() {
    const g = this.group('ball-lost', 1.85, .72, true); if (!g) return false;
    const ctx = this.owner.context; g.high.frequency.value = 100; g.filter.frequency.value = 2500;
    for (const [note, frequency] of [293.665, 261.626, 220].entries()) {
      const at = g.at + note * .28;
      for (const [partial, ratio] of [1, 2.71, 4.07].entries()) {
        const oscillator = ctx.createOscillator(); oscillator.frequency.setValueAtTime(frequency * ratio, at);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * ratio * .992, at + .95);
        const voice = this.source(g, oscillator, 0);
        voice.gain.setValueAtTime(.0001, at); voice.gain.linearRampToValueAtTime([.23, .055, .025][partial], at + .007);
        voice.gain.exponentialRampToValueAtTime(.0001, at + [.95, .65, .45][partial]);
      }
    }
    this.owner.music?.duck(1.85, .2);
    return true;
  }
  stopAll(fade = .04) { for (const g of [...this.groups]) g.release(fade); this.travel = null; }
  destroy() { this.stopAll(0); this.noiseBuffer = null; }
}
