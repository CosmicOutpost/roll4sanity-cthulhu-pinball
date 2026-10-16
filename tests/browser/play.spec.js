import { test, expect } from '@playwright/test';

test('renders, charges, launches, flips, pauses, and restarts without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!window.pinball);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#message')).toHaveClass(/visible/);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .95);
  await page.keyboard.up('Space');
  await expect(page.locator('#message')).not.toHaveClass(/visible/);
  await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ShiftRight');
  await page.waitForFunction(() => window.pinball.flippers.every(f => Math.abs(f.angle - f.raised) < .001));
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ShiftRight');
  await page.keyboard.press('p');
  const before = await page.evaluate(() => ({ ...window.pinball.ball.position }));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => ({ ...window.pinball.ball.position }))).toEqual(before);
  await expect(page.locator('#message-title')).toHaveText('HOLD YOUR BREATH');
  await page.keyboard.press('p');
  await page.keyboard.press('r');
  expect(await page.evaluate(() => ({ phase: window.pinball.state.phase, ball: window.pinball.state.ballNumber, score: window.pinball.state.score }))).toEqual({ phase: 'ready', ball: 1, score: 0 });
  await page.screenshot({ path: '/tmp/roll4sanity-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('phone layout fits screen and pointer controls charge and flip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!window.pinball);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const left = await page.locator('#left-flipper').boundingBox();
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.pinball.controls.left);
  await page.mouse.up();
  await page.waitForFunction(() => !window.pinball.controls.left);
  const launch = await page.locator('#launch').boundingBox();
  await page.mouse.move(launch.x + launch.width / 2, launch.y + launch.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.pinball.charge > .4);
  await page.mouse.up();
  await page.waitForFunction(() => window.pinball.state.phase === 'playing');
  await page.screenshot({ path: '/tmp/roll4sanity-mobile.png', fullPage: true });
});

test('focus loss pauses safely without releasing a charged plunger', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!window.pinball);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => ({ phase: window.pinball.state.phase, paused: window.pinball.state.paused, charge: window.pinball.charge, plunger: window.pinball.controls.plunger }))).toEqual({ phase: 'ready', paused: true, charge: 0, plunger: false });
  await page.keyboard.up('Space');
  await page.keyboard.press('p');
  expect(await page.evaluate(() => window.pinball.state.phase)).toBe('ready');
});
