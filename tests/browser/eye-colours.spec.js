import { test, expect } from '@playwright/test';

// Presentation receiver fixture, not a simulated successful shot. Actual Matter
// captures and all four mappings are checked in ritual.spec.js on desktop/mobile.
for (const reduced of [false, true]) {
  test(`eye colour handover uses one palette, preserves brightness and expires; CALM=${reduced}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto('./?debug=1');
    await page.waitForFunction(() => !!window.pinballPresentation);
    await page.keyboard.press('d');
    const pixels = () => page.evaluate(() => {
      const ctx = document.querySelector('canvas').getContext('2d');
      return [230, 310].map(x => [...ctx.getImageData(x + 8, 391, 1, 1).data]);
    });
    const unlit = await pixels();
    for (const [i, id] of ['left-ramp', 'right-orbit', 'right-ramp', 'left-orbit'].entries()) {
      const handover = await page.evaluate(id => {
        const f = window.pinballPresentation, s = window.pinball;
        const old = f.table.lights.cues.get('eyes');
        f.table.lights.awaken(s.shots.find(shot => shot.id === id));
        const cue = f.table.lights.cues.get('eyes');
        return { cueId: cue.shotId, initial: cue.initialStrength, replaced: old !== cue,
          count: [...f.table.lights.cues].filter(([key]) => key === 'eyes').length };
      }, id);
      expect(handover.cueId).toBe(id); expect(handover.count).toBe(1); expect(handover.replaced).toBe(true);
      if (i) expect(handover.initial).toBe(1);
      else await page.waitForFunction(() => {
        const f = window.pinballPresentation;
        return window.pinball.elapsed - f.table.lights.cues.get('eyes').at >= 500;
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const actual = await pixels();
      if (!reduced) {
        const expected = { 'left-ramp': [89, 236, 170], 'right-ramp': [245, 109, 128], 'left-orbit': [101, 182, 255], 'right-orbit': [195, 130, 255] }[id];
        for (const pixel of actual) pixel.slice(0, 3).forEach((channel, c) => expect(Math.abs(channel - expected[c])).toBeLessThanOrEqual(2));
      } else expect(actual).not.toEqual(unlit);
    }
    await page.keyboard.press('p');
    const held = await page.evaluate(() => ({ ...window.pinballPresentation.table.lights.cues.get('eyes') }));
    await page.locator('#motion').click();
    expect(await page.evaluate(() => ({ ...window.pinballPresentation.table.lights.cues.get('eyes') }))).toEqual(held);
    await page.keyboard.press('p');
    await page.waitForFunction(() => !window.pinballPresentation.table.lights.cues.has('eyes'));
    await page.waitForTimeout(35);
    expect(await pixels()).toEqual(unlit);
    expect(await page.evaluate(() => ({ score: window.pinball.state.score, phase: window.pinball.state.phase,
      sounds: window.pinballPresentation.sound.ritual.groups.size }))).toEqual({ score: 0, phase: 'ready', sounds: 0 });
  });
}
