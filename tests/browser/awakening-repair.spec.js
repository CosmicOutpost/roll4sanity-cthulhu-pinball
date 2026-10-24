import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function open(page) {
  await page.goto('./?debug=1'); await page.waitForFunction(() => !!window.pinballPresentation);
  await page.keyboard.press('d');
}
async function ramp(page, right = false) {
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.pinball.charge === 1); await page.keyboard.up('Space');
  await page.waitForFunction(() => { const s = window.pinball; return !s.travel && !s.shooter && s.elapsed > s.shotLock; });
  await page.keyboard.press('p');
  await page.evaluate(right => {
    // Initial pose only: real capture, guide timing and completion follow.
    const s = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
    Body.setPosition(s.ball, { x: right ? 315 : 185, y: 470 }); Body.setVelocity(s.ball, { x: 0, y: -7 }); Body.setAngularVelocity(s.ball, 0);
  }, right);
  await page.keyboard.press('p');
  await page.waitForFunction(right => window.pinball.travel?.shot.id === (right ? 'right-ramp' : 'left-ramp'), right);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(false);
  await page.waitForFunction(() => window.pinballPresentation.table.lights.cues.has('eyes'));
}
const evidence = 'test-results/awakening-repair-previews';

for (const width of [1440, 390]) {
  test.describe(`awakening repair at ${width}`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 1000 }, isMobile: width === 390, hasTouch: width === 390 });
    test('real ramp completes once: eyes and roar start together, survive mode changes and expire', async ({ page }) => {
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await open(page);
      const baselineHalo = await page.evaluate(() => {
        const ctx = document.querySelector('canvas').getContext('2d');
        return [230, 310].map(x => [...ctx.getImageData(x - 18, 391, 1, 1).data]);
      });
      const button = page.locator('#music'), box = await button.boundingBox();
      expect(box.y).toBeGreaterThan(0); expect(box.height).toBeGreaterThanOrEqual(28);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(button).toHaveText('MUSIC: ON');
      // A trusted touch/click must actually operate the preference on both layouts.
      if (width === 390) await button.tap(); else await button.click();
      await expect(button).toHaveText('MUSIC: OFF');
      if (width === 390) await button.tap(); else await button.click();
      await ramp(page, width === 390);
      const onset = await page.evaluate(() => {
        const f = window.pinballPresentation, groups = [...f.sound.ritual.groups];
        return { cue: f.table.lights.cues.get('eyes'), age: window.pinball.elapsed - f.table.lights.cues.get('eyes').at,
          times: groups.filter(g => ['completion', 'roar'].includes(g.name)).map(g => g.at),
          names: groups.map(g => g.name) };
      });
      expect(onset.names).toContain('roar'); expect(onset.names).not.toContain('chant');
      expect(Math.max(...onset.times) - Math.min(...onset.times)).toBeLessThan(.025);
      expect(onset.age).toBeLessThan(100);
      expect(onset.cue.until - onset.cue.at).toBeCloseTo(2550, 5);
      await page.waitForFunction(() => { const s = window.pinball, c = window.pinballPresentation.table.lights.cues.get('eyes'); return c && s.elapsed - c.at >= 500; });
      const peak = await page.evaluate(() => {
        const f = window.pinballPresentation, ctx = document.querySelector('canvas').getContext('2d');
        return { centres: [230, 310].map(x => [...ctx.getImageData(x, 391, 1, 1).data]),
          halo: [230, 310].map(x => [...ctx.getImageData(x - 18, 391, 1, 1).data]),
          art: [f.table.artwork.x, f.table.artwork.y, f.table.artwork.displayWidth, f.table.artwork.displayHeight],
          layers: [f.table.artwork.depth, f.table.lights.eyes.depth, f.table.moving.depth] };
      });
      for (const [r, g, b] of peak.centres) { expect(r).toBeGreaterThan(240); expect(g).toBeGreaterThan(225); expect(b).toBeGreaterThan(180); }
      peak.halo.forEach((rgb, i) => {
        expect(Math.max(...rgb.slice(0, 3).map((value, c) => value - baselineHalo[i][c]))).toBeGreaterThan(60);
      });
      expect(peak.art).toEqual([270, 480, 540, 960]); expect(peak.layers).toEqual([-1, 4.5, 5]);
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/after-full-${width}-peak.png` });
      await page.keyboard.press('p');
      await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
      const paused = await page.evaluate(() => ({ elapsed: window.pinball.elapsed, gain: window.pinballPresentation.sound.master.gain.value }));
      expect(paused.gain).toBe(0);
      await page.waitForTimeout(120); expect(await page.evaluate(() => window.pinball.elapsed)).toBe(paused.elapsed);
      await page.locator('#motion').click();
      expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.get('eyes').at)).toBe(onset.cue.at);
      await page.keyboard.press('p'); await page.waitForTimeout(70);
      await page.screenshot({ path: `${evidence}/after-calm-${width}-peak.png` });
      expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
      await page.locator('#motion').click();
      expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.get('eyes').at)).toBe(onset.cue.at);
      expect(await page.evaluate(() => [...window.pinballPresentation.sound.ritual.groups].some(g => g.name === 'roar'))).toBe(false);
      await page.waitForFunction(() => !window.pinballPresentation.table.lights.cues.has('eyes'));
      expect(errors).toEqual([]);
    });
  });
}

test('new and saved music preferences survive reload; mute still dominates music ON', async ({ page }) => {
  await open(page); await expect(page.locator('#music')).toHaveText('MUSIC: ON');
  await page.locator('#music').click();
  await page.reload(); await page.waitForFunction(() => !!window.pinballPresentation);
  await expect(page.locator('#music')).toHaveText('MUSIC: OFF');
  await page.locator('#music').click(); await expect(page.locator('#music')).toHaveText('MUSIC: ON');
  expect(await page.evaluate(() => localStorage.getItem('roll4sanity-music'))).toBe('true');
  await page.reload(); await page.waitForFunction(() => !!window.pinballPresentation); await page.keyboard.press('d');
  await expect(page.locator('#music')).toHaveText('MUSIC: ON');
  await page.locator('#sound').click(); await ramp(page);
  expect(await page.evaluate(() => window.pinballPresentation.sound.ritual.groups.size)).toBe(0);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
  await page.locator('#sound').click(); await page.waitForTimeout(80);
  expect(await page.evaluate(() => [...window.pinballPresentation.sound.ritual.groups].some(g => g.name === 'roar'))).toBe(false);
});

test('development console eye preview does not change game state or score', async ({ page }) => {
  test.skip(!!process.env.PINBALL_BASE_URL, 'Development-only hook; production absence is checked in static.spec.js.');
  await open(page);
  const observe = () => page.evaluate(() => {
    const s = window.pinball;
    return { score: s.state.score, phase: s.state.phase, ball: s.ball.id, position: { ...s.ball.position }, travel: s.travel };
  });
  const before = await observe();
  await page.evaluate(() => window.previewCthulhuEyes());
  await page.waitForTimeout(400);
  expect(await observe()).toEqual(before);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
  await page.waitForFunction(() => !window.pinballPresentation.table.lights.cues.has('eyes'));
});
