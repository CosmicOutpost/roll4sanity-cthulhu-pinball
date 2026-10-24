// Original eight-bar chamber-horror cue in D minor, 110 BPM. Two related phrases
// share a D-F-E-D motif; the second turns through G minor and a dominant b9.
export const MUSIC_BPM = 110;
export const MUSIC_BEATS = 32;
export const MUSIC_SCORE = [
  { bass: 38, chord: [50, 57, 62, 65], melody: [[0, 62, 1.5], [2.5, 65, .9]] },
  { bass: 38, chord: [50, 57, 64, 65], melody: [[.5, 64, 1.3], [2.5, 62, .9]] },
  { bass: 34, chord: [46, 53, 57, 62], melody: [[0, 65, 1.5], [2.5, 62, .9]] },
  { bass: 33, chord: [45, 52, 55, 58], melody: [[.5, 63, 1.3], [2.5, 61, .9]] },
  { bass: 38, chord: [50, 57, 62, 65], melody: [[0, 62, 1.5], [2.5, 65, .9]] },
  { bass: 31, chord: [43, 50, 55, 58], melody: [[.5, 67, 1.3], [2.5, 65, .9]] },
  { bass: 34, chord: [46, 53, 57, 62], melody: [[0, 65, 1.5], [2.5, 63, .9]] },
  { bass: 33, chord: [45, 52, 55, 58], melody: [[.5, 61, 1.3], [2.5, 64, .9]] },
];
// Four-bar arrangement windows, A then B throughout. All original notes and
// waveforms stay intact; only existing stems' balances change. 24 windows =
// 96 bars / 209.45 seconds. Ends return to the opening balance before the seam.
export const MUSIC_ARRANGEMENT = [
  [1, 1, 1, 1], [1, 1, 1, 1],
  [1, .82, 1, 0], [1, .82, .86, 0],
  [.9, 1, 1, 0], [.9, 1, .72, 1],
  [1, .65, 1, 0], [1, .65, 1, 0],
  [.94, 1, .55, 0], [.94, 1, 0, 0],
  [1, 1, .8, 0], [1, 1, 1, .7],
  [1, .85, 1, 0], [1, .85, .85, 0],
  [.88, 1, .65, 0], [.88, 1, 1, 0],
  [1, .6, 1, 0], [1, .6, 1, 1],
  [.94, 1, .78, 0], [.94, 1, .78, 0],
  [1, .9, 1, 0], [1, .9, 1, .6],
  [1, 1, 1, 0], [1, 1, 1, 1],
]; // bass, organ, melody, metallic accents; the clock pulse stays constant.
export const MUSIC_TOTAL_BEATS = MUSIC_ARRANGEMENT.length * 16;

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

async function renderMusicStems(host, sampleRate) {
  const Context = host.OfflineAudioContext || host.webkitOfflineAudioContext;
  const frames = Math.round(sampleRate * MUSIC_BEATS * 60 / MUSIC_BPM);
  // Extract the middle cycle so every release and echo crossing the seam is
  // already present. All starts repeat at an exact integer sample period.
  const ctx = new Context(5, frames * 3, sampleRate), period = frames / sampleRate, beat = period / MUSIC_BEATS;
  // Original stereo channels were identical. Five temporary mono stems let us
  // retain the original synthesis, then assemble one bounded mono playback buffer.
  const merger = ctx.createChannelMerger(5); merger.connect(ctx.destination);
  const bus = (cutoff, channel, send = false) => {
    const mix = ctx.createGain(); mix.gain.value = .72; mix.connect(merger, 0, channel);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .5;
    filter.connect(mix);
    if (send) {
      const delay = ctx.createDelay(.6), feedback = ctx.createGain(), echo = ctx.createGain(), dark = ctx.createBiquadFilter();
      delay.delayTime.value = beat * .5; feedback.gain.value = .21; echo.gain.value = .16;
      dark.type = 'lowpass'; dark.frequency.value = 1600;
      filter.connect(delay); delay.connect(dark); dark.connect(feedback); feedback.connect(delay); dark.connect(echo); echo.connect(mix);
    }
    return filter;
  };
  const bass = bus(650, 0), pads = bus(1600, 1, true), melody = bus(2100, 2, true), metal = bus(2600, 3, true);
  const organ = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, .32, .14, .08, .03]));
  const voice = (target, type, frequency, at, duration, level, attack = .03, detune = 0) => {
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    if (typeof type === 'string') oscillator.type = type; else oscillator.setPeriodicWave(type);
    oscillator.frequency.value = frequency; oscillator.detune.value = detune;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + attack);
    envelope.gain.setValueAtTime(level * .8, at + Math.max(attack, duration * .55));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    envelope.gain.linearRampToValueAtTime(0, at + duration + .015);
    oscillator.connect(envelope); envelope.connect(target);
    oscillator.start(at); oscillator.stop(at + duration + .02);
  };
  const grain = ctx.createBuffer(1, Math.ceil(sampleRate * .08), sampleRate);
  const grainData = grain.getChannelData(0); let seed = 1928;
  for (let i = 0; i < grainData.length; i++) { seed = seed * 16807 % 2147483647; grainData[i] = (seed / 1073741824 - 1) * Math.exp(-i / (sampleRate * .012)); }
  const pulse = bus(700, 4);
  for (let cycle = 0; cycle < 3; cycle++) for (const [bar, notes] of MUSIC_SCORE.entries()) {
    const start = cycle * period + bar * beat * 4;
    for (let tick = 0; tick < 4; tick++) {
      const at = start + tick * beat, frequency = hz(notes.bass + [0, 12, 7, 12][tick]);
      voice(bass, 'triangle', frequency, at, beat * [.8, .5, .7, .5][tick], [.19, .1, .13, .09][tick]);
      const tap = ctx.createBufferSource(), gain = ctx.createGain(); tap.buffer = grain; gain.gain.value = tick % 2 ? .025 : .018;
      tap.connect(gain); gain.connect(pulse); tap.start(at); tap.stop(at + .08);
    }
    for (const note of notes.chord) {
      voice(pads, organ, hz(note), start, beat * 4.2, .035, .22, -3);
      voice(pads, 'triangle', hz(note), start, beat * 4.2, .018, .25, 3);
    }
    for (const [offset, note, length] of notes.melody) {
      voice(melody, organ, hz(note), start + offset * beat, length * beat, .085, .065);
      voice(melody, 'triangle', hz(note) / 2, start + offset * beat, length * beat, .02, .065, -5);
    }
    if (bar === 3 || bar === 7) for (const [i, ratio] of [1, 2.41, 3.73].entries()) {
      voice(metal, 'sine', 440 * ratio, start + 3 * beat, .9, [.024, .009, .004][i], .012);
    }
  }
  return { rendered: await ctx.startRendering(), frames, createBuffer: length => ctx.createBuffer(1, length, sampleRate) };
}

export async function renderMusicLoop(host, sampleRate) {
  const { rendered, frames, createBuffer } = await renderMusicStems(host, sampleRate);
  const stems = Array.from({ length: 5 }, (_, i) => rendered.getChannelData(i).subarray(frames, frames * 2));
  // Calibrate to the unchanged opening phrase, not to each arrangement window;
  // quiet passages remain quiet. Mono avoids retaining two identical channels.
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(stems.reduce((sum, stem) => sum + stem[i], 0)));
  const scale = peak ? .65 / peak : 1, cycles = MUSIC_TOTAL_BEATS / MUSIC_BEATS;
  const loop = createBuffer(frames * cycles);
  const data = loop.getChannelData(0);
  const transitionFrames = Math.round(.6 * sampleRate);
  for (let section = 0; section < MUSIC_ARRANGEMENT.length; section++) {
    const start = section * frames / 2, end = (section + 1) * frames / 2;
    const current = MUSIC_ARRANGEMENT[section], previous = MUSIC_ARRANGEMENT[(section + MUSIC_ARRANGEMENT.length - 1) % MUSIC_ARRANGEMENT.length];
    for (let i = Math.ceil(start); i < end; i++) {
      const at = i % frames, t = Math.min(1, (i - start) / transitionFrames), ease = t * t * (3 - 2 * t);
      let sum = stems[4][at]; // The existing restrained pulse is never removed.
      for (let stem = 0; stem < 4; stem++) sum += stems[stem][at] * (previous[stem] + (current[stem] - previous[stem]) * ease);
      data[i] = sum * scale;
    }
    // One finite build yield per window keeps controls responsive while assembling.
    // This is not an ongoing music scheduler; playback still has one source.
    if (section < MUSIC_ARRANGEMENT.length - 1) await new Promise(resolve => host.setTimeout(resolve, 0));
  }
  return loop;
}
