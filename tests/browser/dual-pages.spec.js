import { test, expect } from '@playwright/test';

const base = process.env.DUAL_PAGES_URL?.replace(/\/+$/, '') + '/';
test.skip(!process.env.DUAL_PAGES_URL, 'Only run against the assembled dual Pages artifact');
for (const [label, suffix, hasRitual] of [['live', '', false], ['playtest', 'playtest/', true]]) {
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    test(`${label} ${device} loads local assets and launches`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      const errors = [], failed = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', req => failed.push(`${req.url()} ${req.failure()?.errorText}`));
      await page.goto(`${base}${suffix}?debug=1`);
      await page.waitForFunction(() => !!window.pinballPresentation);
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.locator('#ritual-progress')).toHaveCount(hasRitual ? 1 : 0);
      expect(await page.evaluate(() => window.pinballPresentation.table.artLayers.logo.visible)).toBe(true);
      await page.keyboard.press('d');
      if (device === 'mobile') {
        const launch = await page.locator('#launch').boundingBox();
        await page.mouse.move(launch.x + launch.width / 2, launch.y + launch.height / 2);
        await page.mouse.down();
        await page.waitForFunction(() => window.pinball.charge > .95);
        await page.mouse.up();
      } else {
        await page.keyboard.down('Space');
        await page.waitForFunction(() => window.pinball.charge > .95);
        await page.keyboard.up('Space');
      }
      await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
      if (device === 'mobile') {
        const flipper = await page.locator('#left-flipper').boundingBox();
        await page.mouse.move(flipper.x + flipper.width / 2, flipper.y + flipper.height / 2);
        await page.mouse.down();
        await page.waitForFunction(() => window.pinball.flippers[0].angle < 0);
        await page.mouse.up();
      } else {
        await page.keyboard.down('KeyZ');
        await page.waitForFunction(() => window.pinball.flippers[0].angle < 0);
        await page.keyboard.up('KeyZ');
      }
      await page.screenshot({ path: info.outputPath(`${label}-${device}.png`), fullPage: true });
      expect(errors).toEqual([]); expect(failed).toEqual([]);
    });
  }
}
