import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function open(page) {
  await page.goto('./?debug=1'); await page.waitForFunction(() => !!window.pinballPresentation);
  await page.keyboard.press('d');
}
async function serve(page) {
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.pinball.charge === 1); await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
}
async function drainPose(page, final = false, teleport = false) {
  await page.keyboard.press('p');
  await page.evaluate(({ final, teleport }) => {
    const p = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
    // A final-ball audio fixture, not a complete three-ball game.
    if (final) p.state.ballNumber = 3;
    Body.setPosition(p.ball, { x: 250, y: teleport ? 960 : 938 }); Body.setVelocity(p.ball, { x: 0, y: 6 }); Body.setAngularVelocity(p.ball, 0);
  }, { final, teleport });
  await page.waitForTimeout(40); // Let presentation observe the fixture's ball number while paused.
  await page.keyboard.press('p');
}

for (const width of [1440, 390]) {
  test.describe(`audio lifecycle ${width}`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 1000 }, hasTouch: width === 390, isMobile: width === 390 });
    test('music unlock, touch/click, pause position, global mute, repeated toggles and saved preference', async ({ page }) => {
      const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
      expect(await page.evaluate(() => window.pinballPresentation.sound.context)).toBe(null);
      await expect(page.locator('#chant')).toHaveCount(0); await expect(page.locator('#music')).toHaveText('MUSIC: ON');
      const click = () => width === 390 ? page.locator('#music').tap() : page.locator('#music').click();
      await click(); await expect(page.locator('#music')).toHaveText('MUSIC: OFF');
      await page.waitForFunction(() => !window.pinballPresentation.sound.music.pending);
      expect(await page.evaluate(() => !!window.pinballPresentation.sound.music.source)).toBe(false);
      await click(); await page.waitForFunction(() => !!window.pinballPresentation.sound.music.source);
      await page.waitForTimeout(150); await page.keyboard.press('p');
      await page.waitForFunction(() => !window.pinballPresentation.sound.music.source);
      const held = await page.evaluate(() => window.pinballPresentation.sound.music.offset);
      await page.waitForTimeout(130); expect(await page.evaluate(() => window.pinballPresentation.sound.music.offset)).toBe(held);
      await page.keyboard.press('p'); await page.waitForFunction(() => !!window.pinballPresentation.sound.music.source);
      expect(await page.evaluate(() => window.pinballPresentation.sound.music.offset)).toBe(held);
      await page.locator('#sound').click();
      expect(await page.evaluate(() => ({ gain: window.pinballPresentation.sound.master.gain.value, source: !!window.pinballPresentation.sound.music.source,
        tail: !!window.pinballPresentation.sound.music.tail }))).toEqual({ gain: 0, source: false, tail: false });
      await page.locator('#sound').click(); await page.waitForFunction(() => !!window.pinballPresentation.sound.music.source);
      await page.evaluate(() => { const m = window.pinballPresentation.sound.music; for (let i = 0; i < 20; i++) { m.enabled = !m.enabled; m.sync(); } });
      expect(await page.evaluate(() => !!window.pinballPresentation.sound.music.source)).toBe(true);
      expect(await page.evaluate(() => !!window.pinballPresentation.sound.music.tail)).toBe(false);
      await click(); await page.waitForFunction(() => !window.pinballPresentation.sound.music.tail);
      await page.keyboard.down('KeyZ'); await page.waitForTimeout(80); await page.keyboard.up('KeyZ');
      expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('flipper'))).toBe(true);
      await page.reload(); await page.waitForFunction(() => !!window.pinballPresentation);
      await expect(page.locator('#music')).toHaveText('MUSIC: OFF');
      expect(await page.evaluate(() => window.pinballPresentation.sound.context)).toBe(null);
      expect(errors).toEqual([]);
    });
  });
}

for (const final of [false, true]) {
  test(`real bottom drain sounds once, ducks music and cleans up; final-ball fixture=${final}`, async ({ page }) => {
    await open(page); await serve(page); await page.waitForFunction(() => !!window.pinballPresentation.sound.music.source);
    await drainPose(page, final);
    await page.waitForFunction(() => [...window.pinballPresentation.sound.ritual.groups].some(g => g.name === 'ball-lost'));
    const at = await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.get('drain'));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.get('drain'))).toBe(at);
    expect(await page.evaluate(() => [...window.pinballPresentation.sound.ritual.groups].filter(g => g.name === 'ball-lost').length)).toBe(1);
    const state = await page.evaluate(() => { const a = window.pinballPresentation.sound; return { phase: window.pinball.state.phase,
      music: !!a.music.source, level: a.music.levelAt(a.context.currentTime), duck: a.music.duckState?.depth }; });
    expect(state.phase).toBe(final ? 'gameover' : 'ready'); expect(state.music).toBe(!final);
    expect(state.duck).toBe(.2); expect(state.level).toBeCloseTo(.02, 3);
    await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0 && window.pinballPresentation.sound.voices.size === 0);
    if (!final) expect(await page.evaluate(() => window.pinballPresentation.sound.music.gain.gain.value)).toBeCloseTo(.1, 3);
    else {
      expect(await page.evaluate(() => !!window.pinballPresentation.sound.music.source || !!window.pinballPresentation.sound.music.tail)).toBe(false);
      await page.keyboard.press('r'); await page.waitForFunction(() => !!window.pinballPresentation.sound.music.source);
      expect(await page.evaluate(() => window.pinballPresentation.sound.music.offset)).toBe(0);
    }
  });
}

test('weak serving, debug count changes, repositioning and teleport below drain never sound the loss cue', async ({ page }) => {
  await open(page); await serve(page);
  await page.keyboard.press('p');
  await page.evaluate(() => { window.pinball.state.ballNumber++; window.pinball.parkAtPlunger('DEBUG REPOSITION'); });
  await page.keyboard.press('p'); await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('drain'))).toBe(false);
  await serve(page); await drainPose(page, false, true);
  await page.waitForFunction(() => window.pinball.state.phase === 'ready');
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('drain'))).toBe(false);
});

test('music and DSP levels: seamless composed loop, finite roar/toll and headroom for a busy mix', async ({ page }, info) => {
  await open(page); await page.keyboard.down('KeyZ'); await page.waitForTimeout(100); await page.keyboard.up('KeyZ');
  await page.waitForFunction(() => !!window.pinballPresentation.sound.music.buffer);
  const result = await page.evaluate(async () => {
    const a = window.pinballPresentation.sound, buffer = a.music.buffer, data = buffer.getChannelData(0);
    let peak = 0, energy = 0, maxStep = 0;
    for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); energy += data[i] ** 2; if (i) maxStep = Math.max(maxStep, Math.abs(data[i] - data[i - 1])); }
    const results = { music: { duration: buffer.duration, peak, rmsAtOutput: Math.sqrt(energy / data.length) * .1 * .18,
      seam: Math.abs(data[0] - data.at(-1)), maxStep } };
    // Offline source graph checks, not autoplay/gesture tests.
    for (const mode of ['roar', 'ball-lost', 'overlap']) {
      const ctx = new OfflineAudioContext(1, 48000 * 3, 48000), master = ctx.createGain(); master.gain.value = .18; master.connect(ctx.destination);
      const r = new a.ritual.constructor({ context: ctx, master, music: { duck() {} } }); r.canPlay = () => true;
      if (mode === 'roar') r.roar(); else if (mode === 'ball-lost') r.ballLost(); else { r.endSpell(true, 'ramp'); r.ballLost(); }
      const raw = (await ctx.startRendering()).getChannelData(0); let peak = 0, energy = 0;
      for (const value of raw) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
      results[mode] = { peak, rms: Math.sqrt(energy / raw.length), remaining: r.groups.size }; r.destroy();
    }
    // Tap the real running master during coincident, unchanged pinball impacts.
    const analyser = a.context.createAnalyser(); analyser.fftSize = 1024; a.master.connect(analyser);
    const block = new Float32Array(1024); let livePeak = 0;
    window.pinballPresentation.table.scene.scene.pause();
    a.ritual.endSpell(true, 'ramp'); a.play('drain');
    for (const kind of ['bumper', 'ward', 'sling', 'flipper', 'gameover']) a.play(kind);
    for (let i = 0; i < 55; i++) { await new Promise(requestAnimationFrame); analyser.getFloatTimeDomainData(block); for (const v of block) livePeak = Math.max(livePeak, Math.abs(v)); }
    a.master.disconnect(analyser); analyser.disconnect(); results.livePeak = livePeak;
    a.destroy(); results.destroyed = { music: !!a.music.source, tail: !!a.music.tail, groups: a.ritual.groups.size, voices: a.voices.size };
    return results;
  });
  expect(result.music.duration).toBeCloseTo(384 * 60 / 110, 3); expect(result.music.peak).toBeCloseTo(.65, 3);
  expect(result.music.seam).toBeLessThan(result.music.maxStep * .15);
  expect(result.music.rmsAtOutput).toBeLessThan(result.roar.rms / 4);
  expect(result.music.rmsAtOutput).toBeLessThan(result['ball-lost'].rms / 2);
  for (const key of ['roar', 'ball-lost', 'overlap']) { expect(result[key].peak).toBeLessThan(.3); expect(result[key].rms).toBeGreaterThan(.002); expect(result[key].remaining).toBe(0); }
  expect(result.livePeak).toBeGreaterThan(.02); expect(result.livePeak).toBeLessThan(.5);
  expect(result.destroyed).toEqual({ music: false, tail: false, groups: 0, voices: 0 });
  await writeFile('/tmp/audio2-verified-levels.json', JSON.stringify(result, null, 2));
  await info.attach('audio-mix-and-loop-measurements', { body: JSON.stringify(result), contentType: 'application/json' });
});

test('missing offline synthesis support disables music gracefully while SFX remain available', async ({ page }) => {
  await page.addInitScript(() => { window.OfflineAudioContext = undefined; window.webkitOfflineAudioContext = undefined; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  await expect(page.locator('#music')).toBeDisabled(); await expect(page.locator('#sound')).toBeEnabled();
  await page.keyboard.down('KeyZ'); await page.waitForFunction(() => window.pinballPresentation.sound.context?.state === 'running'); await page.keyboard.up('KeyZ');
  expect(await page.evaluate(() => window.pinballPresentation.sound.music.source)).toBe(null); expect(errors).toEqual([]);
});

test('destroy during asynchronous score rendering cannot revive music or retain its buffer', async ({ page }) => {
  await open(page); await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => !!window.pinballPresentation.sound.context);
  const result = await page.evaluate(async () => {
    const a = window.pinballPresentation.sound, pending = a.music.pending;
    a.destroy(); if (pending) await pending;
    await new Promise(resolve => setTimeout(resolve, 50));
    return { source: !!a.music.source, buffer: !!a.music.buffer, pending: !!a.music.pending, groups: a.ritual.groups.size, state: a.context.state };
  });
  await page.keyboard.up('KeyZ');
  expect(result).toEqual({ source: false, buffer: false, pending: false, groups: 0, state: 'closed' });
});
