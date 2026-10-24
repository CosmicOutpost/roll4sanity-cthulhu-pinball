// Original procedural synthesis only. Every group owns and releases its sources,
// filters and echo loop. No audio downloads, speech API or perpetual ambience.
export class RitualAudio {
  constructor(owner) {
    this.owner = owner; this.groups = new Set(); this.travel = null;
    this.chantEnabled = true;
    try {
      const saved = owner.host.localStorage.getItem('roll4sanity-chant');
      if (saved === 'true' || saved === 'false') this.chantEnabled = saved === 'true';
    } catch { /* New players still hear the chant if persistence is unavailable. */ }
    this.button = owner.host.document.getElementById('chant');
    this.onToggle = () => {
      this.chantEnabled = !this.chantEnabled;
      try { owner.host.localStorage.setItem('roll4sanity-chant', String(this.chantEnabled)); } catch { /* Optional persistence. */ }
      if (!this.chantEnabled) for (const g of this.groups) if (g.name === 'chant') g.release(.06);
      this.refresh();
    };
    this.button?.addEventListener('click', this.onToggle);
    this.refresh();
  }
  refresh() {
    if (!this.button) return;
    this.button.textContent = this.chantEnabled ? 'CHANT: ON' : 'CHANT: OFF';
    this.button.setAttribute('aria-pressed', String(this.chantEnabled));
    this.button.setAttribute('aria-label', `${this.chantEnabled ? 'Disable' : 'Enable'} robotic chant`);
    this.button.title = 'Optional robotic vowel-like chant, not spoken words; independent of the SFX mute';
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
    const high = node(ctx.createBiquadFilter()); high.type = 'highpass'; high.frequency.value = 65;
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
    const g = this.group('completion', 2.5, kind === 'ramp' && this.chantEnabled ? .28 : .55, true); if (!g) return;
    this.tone(g, 'sine', 146.8, .36, 130.8, 1.9);
    this.tone(g, 'sine', 310, .2, 294, 1.65);
    this.tone(g, 'triangle', 427, .1, 392, 1.4);
    if (kind === 'ramp') this.awaken();
  }
  awaken() {
    const g = this.group('awakening', 2.7, this.chantEnabled ? .2 : .48); if (!g) return;
    const ctx = this.owner.context;
    g.filter.frequency.value = 1250;
    const body = this.tone(g, 'sawtooth', 94, .23, 55, 2.55);
    // A mild soft clip on the growl, not on mechanical pinball impacts.
    const shaper = g.node(ctx.createWaveShaper()); shaper.curve = Float32Array.from({ length: 256 }, (_, i) => Math.tanh((i / 127.5 - 1) * 2));
    body.source.disconnect(); body.source.connect(shaper); shaper.connect(body.envelope);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
    const modulation = g.node(ctx.createGain()); modulation.gain.value = 13;
    lfo.connect(modulation); modulation.connect(body.source.frequency);
    // Register LFO for lifetime/cleanup, with a silent direct output.
    this.source(g, lfo, 0);
    const noise = this.noise(g, .065);
    noise.gain.setValueAtTime(.0001, g.at); noise.gain.linearRampToValueAtTime(.065, g.at + .15); noise.gain.exponentialRampToValueAtTime(.0001, g.at + 2.55);
    this.tone(g, 'sine', 220, .14, 760, 2.5);
    if (this.chantEnabled) this.chant();
  }
  chant() {
    const g = this.group('chant', 2.55, 1.15, true); if (!g) return;
    const ctx = this.owner.context;
    g.filter.frequency.value = 3000;
    const voice = this.source(g, ctx.createOscillator(), .0001); voice.source.type = 'sawtooth';
    const quantiser = g.node(ctx.createWaveShaper());
    quantiser.curve = Float32Array.from({ length: 256 }, (_, i) => Math.round((i / 127.5 - 1) * 12) / 12 * .85);
    voice.source.disconnect(); voice.source.connect(quantiser);
    // Three parallel vocal resonances, rather than a single thin filtered beep.
    const formants = [5, 7, 10].map((q, i) => {
      const filter = g.node(ctx.createBiquadFilter()), level = g.node(ctx.createGain());
      filter.type = 'bandpass'; filter.Q.value = q; level.gain.value = [.7, .45, .22][i];
      quantiser.connect(filter); filter.connect(level); level.connect(voice.envelope);
      return filter;
    });
    const breath = this.noise(g, .0001), hiss = g.node(ctx.createBiquadFilter());
    hiss.type = 'bandpass'; hiss.frequency.value = 1800; hiss.Q.value = .7;
    breath.source.disconnect(); breath.source.connect(hiss); hiss.connect(breath.envelope);
    // Six deliberate, stepped syllables: a robotic ritual chant, not claimed speech.
    const syllables = [
      [0, .21, 130, [520, 1190, 2390]], [.26, .31, 98, [330, 870, 2240]],
      [.62, .22, 123, [330, 870, 2240]], [.91, .30, 147, [730, 1090, 2440]],
      [1.28, .27, 139, [530, 1840, 2480]], [1.67, .44, 98, [450, 1050, 2200]],
    ];
    for (const [offset, duration, hz, vowels] of syllables) {
      const at = g.at + offset;
      voice.source.frequency.setValueAtTime(hz, at);
      voice.source.frequency.exponentialRampToValueAtTime(hz * .94, at + duration);
      formants.forEach((filter, i) => filter.frequency.setTargetAtTime(vowels[i], at, .02));
      voice.gain.setValueAtTime(.0001, at);
      voice.gain.linearRampToValueAtTime(.72, at + .018);
      voice.gain.setValueAtTime(.68, at + duration * .6);
      voice.gain.exponentialRampToValueAtTime(.0001, at + duration);
      breath.gain.setValueAtTime(.0001, at);
      breath.gain.linearRampToValueAtTime(.035, at + .008);
      breath.gain.exponentialRampToValueAtTime(.0001, at + .06);
    }
  }
  stopAll(fade = .04) { for (const g of [...this.groups]) g.release(fade); this.travel = null; }
  destroy() { this.stopAll(0); this.button?.removeEventListener('click', this.onToggle); this.noiseBuffer = null; }
}
