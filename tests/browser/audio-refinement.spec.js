import { test, expect } from '@playwright/test';

test('the long arrangement has changing layers, bounded memory and clean phrase/loop seams', async ({ page }, info) => {
  await page.goto('./');
  const result = await page.evaluate(async () => {
    const { renderMusicLoop, MUSIC_ARRANGEMENT } = await import('/src/game/music-score.js');
    const at = performance.now(), buffer = await renderMusicLoop(window, 44100), data = buffer.getChannelData(0);
    const windows = MUSIC_ARRANGEMENT.map((_, section) => {
      const start = Math.ceil(section * data.length / 24), end = Math.ceil((section + 1) * data.length / 24);
      let energy = 0; for (let i = start; i < end; i++) energy += data[i] ** 2;
      return { rms: Math.sqrt(energy / (end - start)), seam: Math.abs(data[start] - (start ? data[start - 1] : data.at(-1))) };
    });
    let difference = 0;
    const phrase = data.length / 12;
    // Same notes and beat position, later arrangement: not a repeated old buffer.
    for (let i = 0; i < Math.floor(phrase); i++) difference += Math.abs(data[i] - data[i + phrase * 4]);
    return { duration: buffer.duration, channels: buffer.numberOfChannels, bytes: buffer.length * 4,
      renderMs: performance.now() - at, windows, difference: difference / phrase };
  });
  expect(result.duration).toBeCloseTo(384 * 60 / 110, 3);
  expect(result.channels).toBe(1); expect(result.bytes).toBeLessThan(40_000_000);
  expect(result.difference).toBeGreaterThan(.01);
  for (const window of result.windows) { expect(window.rms).toBeGreaterThan(.1); expect(window.seam).toBeLessThan(.006); }
  expect(result.windows[9].rms).toBeLessThan(result.windows[1].rms * .9);
  await info.attach('arrangement-windows', { body: JSON.stringify(result), contentType: 'application/json' });
});

test('roar uses slow sine pressure and full-length breath noise, with no buzzing oscillator or repeated noise loop', async ({ page }, info) => {
  await page.goto('./?debug=1'); await page.waitForFunction(() => !!window.pinballPresentation);
  const result = await page.evaluate(async () => {
    const original = window.pinballPresentation.sound;
    const ctx = new OfflineAudioContext(1, 48000 * 3, 48000), master = ctx.createGain();
    master.gain.value = .18; master.connect(ctx.destination);
    const ritual = new original.ritual.constructor({ context: ctx, master }); ritual.canPlay = () => true;
    ritual.roar();
    const group = [...ritual.groups][0];
    const stopped = ctx.suspend(.1), ended = ctx.suspend(2.35), rendering = ctx.startRendering();
    await stopped; // Read AudioParams after scheduled automation has actually rendered.
    const graph = group.sources.map(s => ({ type: s.type || 'noise', loop: !!s.loop, duration: s.buffer?.duration, frequency: s.frequency?.value }));
    await ctx.resume(); await ended;
    // Offline rendering can outrun JS onended callbacks. Yield at source end so
    // group/echo disconnection runs before rendering the silence-tail assertion.
    await new Promise(resolve => setTimeout(resolve, 0));
    await ctx.resume(); const samples = (await rendering).getChannelData(0);
    let peak = 0, energy = 0, tail = 0;
    for (let i = 0; i < samples.length; i++) { peak = Math.max(peak, Math.abs(samples[i])); energy += samples[i] ** 2; if (i > 48000 * 2.4) tail = Math.max(tail, Math.abs(samples[i])); }
    return { graph, peak, rms: Math.sqrt(energy / samples.length), tail, remaining: ritual.groups.size };
  });
  const tones = result.graph.filter(s => s.type !== 'noise'), noise = result.graph.filter(s => s.type === 'noise');
  expect(tones).toHaveLength(2); expect(tones.every(s => s.type === 'sine' && s.frequency < 75)).toBe(true);
  expect(noise).toHaveLength(3); expect(noise.every(s => !s.loop && s.duration >= 2.3)).toBe(true);
  expect(result.peak).toBeGreaterThan(.04); expect(result.peak).toBeLessThan(.2); expect(result.rms).toBeGreaterThan(.008);
  expect(result.tail).toBe(0); expect(result.remaining).toBe(0);
  await info.attach('roar-synthesis', { body: JSON.stringify(result), contentType: 'application/json' });
});
