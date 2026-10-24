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
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export async function renderMusicLoop(host, sampleRate) {
  const Context = host.OfflineAudioContext || host.webkitOfflineAudioContext;
  const frames = Math.round(sampleRate * MUSIC_BEATS * 60 / MUSIC_BPM);
  // Extract the middle cycle so every release and echo crossing the seam is
  // already present. All starts repeat at an exact integer sample period.
  const ctx = new Context(2, frames * 3, sampleRate), period = frames / sampleRate, beat = period / MUSIC_BEATS;
  const mix = ctx.createGain(); mix.gain.value = .72; mix.connect(ctx.destination);
  const delay = ctx.createDelay(.6), feedback = ctx.createGain(), echo = ctx.createGain(), dark = ctx.createBiquadFilter();
  delay.delayTime.value = beat * .5; feedback.gain.value = .21; echo.gain.value = .16;
  dark.type = 'lowpass'; dark.frequency.value = 1600;
  delay.connect(dark); dark.connect(feedback); feedback.connect(delay); dark.connect(echo); echo.connect(mix);
  const bus = (cutoff, send = false) => {
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .5;
    filter.connect(mix); if (send) filter.connect(delay); return filter;
  };
  const bass = bus(650), pads = bus(1600, true), melody = bus(2100, true), metal = bus(2600, true);
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
  const pulse = bus(700);
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
  const rendered = await ctx.startRendering(), loop = ctx.createBuffer(2, frames, sampleRate);
  let peak = 0;
  for (let channel = 0; channel < 2; channel++) {
    loop.copyToChannel(rendered.getChannelData(channel).subarray(frames, frames * 2), channel);
    for (const value of loop.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
  }
  const scale = peak ? .65 / peak : 1;
  for (let channel = 0; channel < 2; channel++) {
    const data = loop.getChannelData(channel); for (let i = 0; i < data.length; i++) data[i] *= scale;
  }
  return loop;
}
