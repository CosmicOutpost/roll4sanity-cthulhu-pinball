import { test, expect } from '@playwright/test';

for (const [width, height, calm] of [[1440, 900, false], [390, 844, false], [390, 844, true]]) {
  test(`bumper rings: normal launch renders the colour sequence at ${width}x${height}, calm=${calm}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./?debug=1');
    await page.waitForFunction(() => !!window.pinballPresentation);
    await page.keyboard.press('d');
    if (calm) await page.locator('#motion').click();
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
      const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      window.bumperColourCheck = { samples: [], done: false };
      let start;
      const observe = () => {
        const p = window.pinball, f = window.pinballPresentation, cue = f.table.lights.cues.get('bumper:0');
        if (cue && start === undefined) start = cue.at;
        if (start !== undefined) {
          const age = p.elapsed - start;
          window.bumperColourCheck.samples.push({ age, ring: pixel(271, 250), core: pixel(250, 246), halo: pixel(286, 250) });
          if (age >= 705) { f.table.scene.scene.pause(); window.bumperColourCheck.done = true; return; }
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.pinball.charge === 1);
    await page.keyboard.up('Space');
    await page.waitForFunction(() => window.bumperColourCheck.done);
    const samples = await page.evaluate(() => window.bumperColourCheck.samples);
    expect(samples.length).toBeGreaterThan(6);
    const emerald = [67, 127, 103, 255];
    expect(samples.at(-1).ring).toEqual(emerald);
    // The core and faint idle halo stay constant; only opaque ring colours move.
    expect(samples.every(s => s.ring[3] === 255)).toBe(true);
    expect(samples.every(s => JSON.stringify(s.core) === JSON.stringify(samples[0].core))).toBe(true);
    expect(samples.every(s => JSON.stringify(s.halo) === JSON.stringify(samples[0].halo))).toBe(true);
    if (calm) {
      const plateau = samples.filter(s => s.age >= 150 && s.age < 390);
      expect(plateau.length).toBeGreaterThan(0);
      expect(plateau.every(s => JSON.stringify(s.ring) === JSON.stringify([176, 157, 101, 255]))).toBe(true);
      expect(samples.every(s => s.ring[0] - s.ring[1] < 65)).toBe(true);
    } else {
      expect(samples.some(s => s.age >= 70 && s.age < 175 && s.ring[0] > 210 && s.ring[1] > 150 && s.ring[1] - s.ring[2] > 60)).toBe(true);
      expect(samples.some(s => s.age >= 200 && s.age < 360 && s.ring[0] > 170 && s.ring[0] - s.ring[1] > 70)).toBe(true);
    }
    expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('bumper'))).toBe(true);
  });
}
